import type { ScenarioState } from '@/core/types';

import { FULL_EXERCISE_DAYS, roundMoney } from './calculator';
import { emptyCarryOver, resolveScenarioGraph, type CarryOver, type WhatIfInputs } from './graphResolver';

export interface ForecastYear {
  /** Calendar year. */
  year: number;
  caHt: number;
  expensesHt: number;
  corporateTaxDue: number;
  netGroupCash: number;
  netPersonalCash: number;
  /** Group cash accumulated since the first projected year. */
  cumulativeGroupCash: number;
  cumulativePersonalCash: number;
  /** Stock de déficit reportable du groupe à la clôture de l'exercice. */
  deficitCarryForward: number;
  /** Capital restant dû des emprunts du groupe à la clôture. */
  debtOutstanding: number;
}

export interface ForecastResult {
  years: ForecastYear[];
  warnings: string[];
  /** État de clôture du dernier exercice projeté. */
  carryOut: CarryOver;
}

export interface ForecastOptions {
  /** Number of years projected, first year included. */
  years?: number;
  /** Yearly revenue growth (0.1 = +10 %/year). */
  caGrowth?: number;
  /** Yearly expense growth; defaults to `caGrowth`. */
  expenseGrowth?: number;
  startYear?: number;
}

/**
 * What a projection at frozen rates cannot see. Surfaced in the UI so a
 * ten-year curve is never read as a prediction.
 */
export const FORECAST_BLIND_SPOTS = [
  'Taux figés au barème 2026 : IS, URSSAF, PFU et tranches d’IR ne sont ni indexés ni réformés sur la période.',
  'Croissance appliquée uniformément au CA et aux charges : ni saisonnalité, ni paliers, ni embauche, ni investissement.',
  'La trésorerie, les comptes courants, les déficits et les emprunts se reportent d’un exercice à l’autre ; ni distribution de réserves, ni réinvestissement, ni décision d’assemblée ne sont modélisés.',
  'Le cumul additionne des euros de différentes années sans actualisation ni inflation ; la trésorerie de groupe étant reportée, son cumul compte plusieurs fois le même stock.',
] as const;

/**
 * Re-resolves the scenario once per year with revenue and expenses grown at a
 * constant rate. Exploration tool, not a prediction — see FORECAST_BLIND_SPOTS.
 */
export function forecastScenario(
  scenario: ScenarioState,
  inputs: WhatIfInputs = {},
  options: ForecastOptions = {},
): ForecastResult {
  const count = Math.max(1, Math.round(options.years ?? 5));
  const caGrowth = options.caGrowth ?? 0;
  const expenseGrowth = options.expenseGrowth ?? caGrowth;
  const startYear = options.startYear ?? new Date().getFullYear();

  const base = resolveScenarioGraph(scenario, inputs).summary;

  const years: ForecastYear[] = [];
  let cumulativeGroupCash = 0;
  let cumulativePersonalCash = 0;
  // P0 : l'exercice N+1 ouvre sur l'état de clôture de N — trésorerie, CCA, déficits, emprunts.
  let carry: CarryOver | undefined;

  for (let i = 0; i < count; i += 1) {
    const caHt = roundMoney(base.caHt * (1 + caGrowth) ** i);
    const expensesHt = roundMoney(base.expensesHt * (1 + expenseGrowth) ** i);
    // Seul le premier exercice peut être écourté ; les suivants sont pleins.
    const exerciseDays = i === 0 ? inputs.exerciseDays ?? scenario.options?.exerciseDays : FULL_EXERCISE_DAYS;
    const resolved = resolveScenarioGraph(scenario, { ...inputs, caHt, expensesHt, year: startYear + i, exerciseDays }, carry);
    const { summary } = resolved;
    carry = resolved.carryOut;

    cumulativeGroupCash = roundMoney(cumulativeGroupCash + summary.netGroupCash);
    cumulativePersonalCash = roundMoney(cumulativePersonalCash + summary.netPersonalCash);

    years.push({
      year: startYear + i,
      caHt,
      expensesHt,
      corporateTaxDue: roundMoney(summary.corporateTax.taxDue),
      netGroupCash: roundMoney(summary.netGroupCash),
      netPersonalCash: roundMoney(summary.netPersonalCash),
      cumulativeGroupCash,
      cumulativePersonalCash,
      deficitCarryForward: roundMoney(Object.values(carry.deficits).reduce((sum, stock) => sum + stock.carryForward, 0)),
      debtOutstanding: roundMoney(Object.values(carry.loans).reduce((sum, loan) => sum + loan.principalOutstanding, 0)),
    });
  }

  const warnings: string[] = [...FORECAST_BLIND_SPOTS];
  if (years.some((y) => y.expensesHt > y.caHt)) {
    warnings.unshift(
      'Au moins un exercice projeté est déficitaire : le moteur ne modélise ni le financement ni le report du déficit.',
    );
  }

  return { years, warnings, carryOut: carry ?? emptyCarryOver(startYear) };
}
