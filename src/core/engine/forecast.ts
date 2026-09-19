import type { ScenarioState } from '@/core/types';

import { roundMoney } from './calculator';
import { resolveScenarioGraph, type WhatIfInputs } from './graphResolver';

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
}

export interface ForecastResult {
  years: ForecastYear[];
  warnings: string[];
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
  'Chaque exercice est calculé isolément : aucun report de déficit, aucun report à nouveau, aucune trésorerie réinvestie.',
  'Le cumul additionne des euros de différentes années sans actualisation ni inflation.',
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

  for (let i = 0; i < count; i += 1) {
    const caHt = roundMoney(base.caHt * (1 + caGrowth) ** i);
    const expensesHt = roundMoney(base.expensesHt * (1 + expenseGrowth) ** i);
    const { summary } = resolveScenarioGraph(scenario, { ...inputs, caHt, expensesHt });

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
    });
  }

  const warnings: string[] = [...FORECAST_BLIND_SPOTS];
  if (years.some((y) => y.expensesHt > y.caHt)) {
    warnings.unshift(
      'Au moins un exercice projeté est déficitaire : le moteur ne modélise ni le financement ni le report du déficit.',
    );
  }

  return { years, warnings };
}
