import { describe, expect, it } from 'vitest';

import {
  calculateFlatTax,
  calculateMotherDaughterDividend,
} from '../calculator';
import { resolveScenarioGraph } from '../graphResolver';
import { getTimelineSteps } from '../timelineEngine';
import {
  FREELANCE_SASU_PRESET,
  FULL_GROUP_PRESET,
  SASU_HOLDING_PRESET,
} from '../../presets/structurePresets';
import type { ScenarioState } from '../../types';
import type { WhatIfInputs } from '../graphResolver';

const TIMELINE_LABELS = [
  'Facturation',
  'Charges',
  'Rémunération',
  'Intra-groupe',
  'Impôts',
  'Dividendes',
] as const;

function euros(n: number): number {
  return Math.round(n * 100) / 100;
}

describe('getTimelineSteps', () => {
  it('returns exactly 6 steps in design order', () => {
    const steps = getTimelineSteps(FREELANCE_SASU_PRESET);

    expect(steps).toHaveLength(6);
    expect(steps.map((s) => s.order)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(steps.map((s) => s.label)).toEqual([...TIMELINE_LABELS]);
    expect(steps.map((s) => s.id)).toEqual([
      'facturation',
      'charges',
      'remuneration',
      'intra_groupe',
      'impots',
      'dividendes',
    ]);
  });

  it('keeps the same step order for every structure preset', () => {
    for (const preset of [FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET, FULL_GROUP_PRESET]) {
      expect(getTimelineSteps(preset).map((s) => s.label)).toEqual([...TIMELINE_LABELS]);
    }
  });
});

describe('resolveScenarioGraph — ordered resolution', () => {
  it('resolves flows in timeline order (facturation before impôts before dividendes)', () => {
    const resolved = resolveScenarioGraph(FREELANCE_SASU_PRESET, {});

    const stepIds = resolved.flows.map((f) => f.timelineStepId);
    const orderOf = (id: string) =>
      resolved.timelineOrder.indexOf(id as (typeof resolved.timelineOrder)[number]);

    for (let i = 1; i < stepIds.length; i++) {
      expect(orderOf(stepIds[i]!)).toBeGreaterThanOrEqual(orderOf(stepIds[i - 1]!));
    }

    const firstRevenue = resolved.flows.find((f) => f.category === 'revenue');
    const firstTax = resolved.flows.find((f) => f.category === 'is_tax' || f.category === 'vat');
    const firstDividend = resolved.flows.find((f) => f.category === 'dividend');

    expect(firstRevenue).toBeDefined();
    expect(firstTax).toBeDefined();
    expect(firstDividend).toBeDefined();
    expect(orderOf(firstRevenue!.timelineStepId)).toBeLessThan(orderOf(firstTax!.timelineStepId));
    expect(orderOf(firstTax!.timelineStepId)).toBeLessThan(orderOf(firstDividend!.timelineStepId));
  });

  it('applies What-If CA override and recomputes VAT / IS via calculator', () => {
    const inputs: WhatIfInputs = {
      caHt: 100_000,
      expensesHt: 20_000,
      executiveNetSalary: 0,
      dividendAmount: 0,
    };
    const resolved = resolveScenarioGraph(FREELANCE_SASU_PRESET, inputs);

    expect(resolved.summary.caHt).toBe(100_000);
    expect(resolved.summary.expensesHt).toBe(20_000);
    expect(resolved.summary.vat.vatCollected).toBe(20_000);
    expect(resolved.summary.vat.vatDeductible).toBe(4_000);
    expect(resolved.summary.vat.netVatDue).toBe(16_000);
    // taxable ≈ CA − charges − salary cost; salary 0 → 80_000
    expect(resolved.summary.corporateTax.taxDue).toBeGreaterThan(0);
    expect(resolved.summary.corporateTax.netProfit).toBe(
      euros(80_000 - resolved.summary.corporateTax.taxDue),
    );
  });
});

describe('resolveScenarioGraph — composite mère-fille → PFU chain', () => {
  it('chains SASU dividend → holding (QPFC at the holding effective IS rate) → PFU to person', () => {
    const inputs: WhatIfInputs = {
      caHt: 200_000,
      expensesHt: 40_000,
      executiveNetSalary: 0,
      dividendAmount: 50_000,
      holdingDividendAmount: 20_000,
      // Sans ce choix explicite, l'arbitrage retient le barème : à TMI 0 %,
      // la part IR du PFU est un coût sec.
      dividendTaxMode: 'pfu',
    };
    const resolved = resolveScenarioGraph(SASU_HOLDING_PRESET, inputs);

    const sasuToHolding = resolved.flows.find(
      (f) => f.category === 'dividend' && f.sourceId.includes('sasu') && f.targetId.includes('holding'),
    );
    const holdingToPerson = resolved.flows.find(
      (f) => f.category === 'dividend' && f.sourceId.includes('holding') && f.targetId.includes('person'),
    );

    expect(sasuToHolding).toBeDefined();
    expect(holdingToPerson).toBeDefined();

    // La QPFC (2 500 + 12 000 de fees) forme le résultat de la holding, taxé à 15 % : taux effectif 0,15.
    const mereFille = calculateMotherDaughterDividend(50_000, 0.15);
    expect(sasuToHolding!.resolvedAmount).toBe(50_000);
    expect(sasuToHolding!.taxResult?.taxAmount).toBe(mereFille.holdingTax);
    expect(sasuToHolding!.taxResult?.netAmount).toBe(mereFille.netCashInHolding);

    // The personal distribution is independent of the retained holding cash.
    const pfuBase = 20_000;
    const pfu = calculateFlatTax(pfuBase);
    expect(holdingToPerson!.resolvedAmount).toBe(pfuBase);
    expect(holdingToPerson!.taxResult?.taxAmount).toBe(pfu.totalTax);
    expect(holdingToPerson!.taxResult?.netAmount).toBe(pfu.netIncome);

    expect(resolved.summary.netPersonalCash).toBe(pfu.netIncome);
    expect(resolved.summary.dividendTaxMode).toBe('pfu');
  });

  it('retient le barème plutôt que le PFU quand la TMI est nulle', () => {
    const resolved = resolveScenarioGraph(SASU_HOLDING_PRESET, {
      caHt: 200_000,
      expensesHt: 40_000,
      executiveNetSalary: 0,
      dividendAmount: 50_000,
      holdingDividendAmount: 20_000,
    });

    expect(resolved.summary.dividendTaxMode).toBe('bareme');
    expect(resolved.summary.dividendArbitrage.gain).toBeGreaterThan(0);
    expect(resolved.summary.personalIncomeTax.marginalRate).toBe(0);
  });
});

describe('structure presets', () => {
  it('exposes the three design presets as ScenarioState', () => {
    expect(FREELANCE_SASU_PRESET.presetId).toBe('freelance-sasu');
    expect(SASU_HOLDING_PRESET.presetId).toBe('sasu-holding');
    expect(FULL_GROUP_PRESET.presetId).toBe('full-group');

    for (const preset of [FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET, FULL_GROUP_PRESET]) {
      expect(preset.entities.length).toBeGreaterThanOrEqual(2);
      expect(preset.flows.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('resolves FULL_GROUP_PRESET without throwing', () => {
    expect(() => resolveScenarioGraph(FULL_GROUP_PRESET, {})).not.toThrow();
    const resolved = resolveScenarioGraph(FULL_GROUP_PRESET, {
      caHt: 150_000,
      sciRentHt: 18_000,
    });
    expect(resolved.entities.some((e) => e.entityType === 'sci_is')).toBe(true);
    expect(resolved.flows.some((f) => f.category === 'rent')).toBe(true);
    expect(resolved.summary.caHt).toBe(150_000);
  });

  it('resolves every preset with empty What-If inputs', () => {
    const presets: ScenarioState[] = [
      FREELANCE_SASU_PRESET,
      SASU_HOLDING_PRESET,
      FULL_GROUP_PRESET,
    ];
    for (const preset of presets) {
      const resolved = resolveScenarioGraph(preset, {});
      expect(resolved.scenarioId).toBe(preset.id);
      expect(resolved.flows.length).toBeGreaterThan(0);
      expect(resolved.timelineOrder).toHaveLength(6);
    }
  });
});
