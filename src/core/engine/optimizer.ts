import type { ScenarioState } from '@/core/types';

import { roundMoney } from './calculator';
import { resolveScenarioGraph, type WhatIfInputs } from './graphResolver';
import { URSSAF_EMPLOYEE_RATE_2026, URSSAF_EMPLOYER_RATE_2026 } from './taxRules';

/** What the sweep maximises. Cash only — never a recommendation. */
export type OptimizationObjective = 'netPersonalCash' | 'netGroupCash' | 'totalNetCash';

export interface OptimizationPoint {
  /** Net executive salary tested (EUR/year). */
  executiveNetSalary: number;
  /** Share of the post-IS profit distributed (0 = everything retained). */
  payoutRatio: number;
  /** Gross dividend distributed at this salary level (EUR/year). */
  dividendGross: number;
  netPersonalCash: number;
  netGroupCash: number;
  /** netPersonalCash + netGroupCash. */
  totalNetCash: number;
  corporateTaxDue: number;
  /** Employer + employee contributions on the salary (EUR). */
  socialCharges: number;
  personalIncomeTaxDue: number;
  /** TMI reached on the salary at this point. */
  marginalRate: number;
}

export interface OptimizationResult {
  points: OptimizationPoint[];
  best: OptimizationPoint;
  /** The scenario as currently configured, for a gain comparison. */
  baseline: OptimizationPoint;
  objective: OptimizationObjective;
  warnings: string[];
}

export interface OptimizeOptions {
  objective?: OptimizationObjective;
  /** Number of salary levels tested between 0 and the affordable ceiling. */
  steps?: number;
  /** Override the affordable ceiling (EUR net/year). */
  maxNetSalary?: number;
  /** Payout ratios explored at each salary level. */
  payoutRatios?: readonly number[];
}

/** Retaining profit defers the PFU, so the payout share is a real lever. */
export const DEFAULT_PAYOUT_RATIOS = [0, 0.25, 0.5, 0.75, 1] as const;

/**
 * Limits the sweep can never see. Surfaced in the UI so a cash optimum is
 * never read as advice.
 */
export const OPTIMIZER_BLIND_SPOTS = [
  'Arbitrage salaire/dividendes seul, à structure et charges constantes.',
  'Les droits sociaux (retraite, chômage, prévoyance, indemnités journalières) ne sont pas valorisés : un optimum en cash peut coûter cher en couverture.',
  'Cotisations sociales sommées à taux plats sur le brut : ni plafond de sécurité sociale, ni réduction générale, ni tranche 2. Ce n’est pas un bulletin de paie.',
  'La distribution de dividendes suppose un résultat distribuable et une décision d’assemblée : le moteur ne vérifie ni les réserves ni les capitaux propres.',
] as const;

/** Net salary whose total company cost exactly consumes `available`. */
function affordableNetSalary(available: number): number {
  if (available <= 0) return 0;
  const employeeRate = URSSAF_EMPLOYEE_RATE_2026.value;
  const employerRate = URSSAF_EMPLOYER_RATE_2026.value;
  return roundMoney((available * (1 - employeeRate)) / (1 + employerRate));
}

/**
 * Resolves one salary level, distributing the whole post-IS profit as dividend.
 * Two passes: the distributable profit is only known once the salary is booked.
 */
function evaluate(
  scenario: ScenarioState,
  inputs: WhatIfInputs,
  executiveNetSalary: number,
  payoutRatio: number,
): OptimizationPoint {
  const probe = resolveScenarioGraph(scenario, {
    ...inputs,
    executiveNetSalary,
    dividendAmount: 0,
  });
  const distributable = Math.max(0, probe.summary.corporateTax.netProfit);
  const dividendGross = roundMoney(distributable * payoutRatio);

  const final = resolveScenarioGraph(scenario, {
    ...inputs,
    executiveNetSalary,
    dividendAmount: dividendGross,
  });
  const { summary } = final;

  return {
    executiveNetSalary: roundMoney(executiveNetSalary),
    payoutRatio,
    dividendGross,
    netPersonalCash: roundMoney(summary.netPersonalCash),
    netGroupCash: roundMoney(summary.netGroupCash),
    totalNetCash: roundMoney(summary.netPersonalCash + summary.netGroupCash),
    corporateTaxDue: roundMoney(summary.corporateTax.taxDue),
    socialCharges: roundMoney(
      summary.executiveSalary.employerCharges + summary.executiveSalary.employeeCharges,
    ),
    personalIncomeTaxDue: roundMoney(summary.personalIncomeTax.taxDue),
    marginalRate: summary.personalIncomeTax.marginalRate,
  };
}

/**
 * Sweeps salary × payout ratio and returns the cash-maximising point.
 *
 * Exploration tool, not a recommendation: the objective is pure cash and
 * ignores everything in OPTIMIZER_BLIND_SPOTS. The sweep is a grid, so the
 * reported optimum is the best tested point, not a proven global maximum.
 * `totalNetCash` counts retained profit as wealth, which defers rather than
 * avoids the PFU — it is not comparable to cash in hand.
 */
export function optimizeRemuneration(
  scenario: ScenarioState,
  inputs: WhatIfInputs = {},
  options: OptimizeOptions = {},
): OptimizationResult {
  const objective = options.objective ?? 'netPersonalCash';
  const steps = Math.max(2, options.steps ?? 40);

  const reference = resolveScenarioGraph(scenario, inputs);
  const available = reference.summary.caHt - reference.summary.expensesHt;
  const ceiling = options.maxNetSalary ?? affordableNetSalary(available);

  const payoutRatios = options.payoutRatios ?? DEFAULT_PAYOUT_RATIOS;
  const salaries = ceiling > 0
    ? Array.from({ length: steps + 1 }, (_, i) => (ceiling * i) / steps)
    : [0];

  const points: OptimizationPoint[] = [];
  for (const salary of salaries) {
    for (const ratio of payoutRatios) {
      points.push(evaluate(scenario, inputs, salary, ratio));
    }
  }

  const best = points.reduce((a, b) => (b[objective] > a[objective] ? b : a));
  const currentSalary = reference.summary.executiveSalary.grossSalary
    - reference.summary.executiveSalary.employeeCharges;
  const baseline = evaluate(scenario, inputs, Math.max(0, currentSalary), 1);

  const warnings: string[] = [...OPTIMIZER_BLIND_SPOTS];
  if (available <= 0) {
    warnings.unshift("Aucune marge disponible (charges ≥ CA) : le balayage n'a rien à arbitrer.");
  }

  return { points, best, baseline, objective, warnings: [...warnings] };
}
