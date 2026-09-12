import { describe, expect, it } from 'vitest';

import { FREELANCE_SASU_PRESET, FULL_GROUP_PRESET, SASU_HOLDING_PRESET } from '../../presets';
import type { ScenarioState } from '../../types';
import { roundMoney } from '../calculator';
import { resolveScenarioGraph } from '../graphResolver';

function holdingScenario(): ScenarioState {
  return {
    ...SASU_HOLDING_PRESET,
    flows: SASU_HOLDING_PRESET.flows.filter((flow) => flow.category !== 'management_fees'),
  };
}

const noPay = { executiveNetSalary: 0, dividendAmount: 0 };

describe('annual cash reconciliation', () => {
  it('reconciles TTC receipts and payments without deducting VAT twice', () => {
    const result = resolveScenarioGraph(FREELANCE_SASU_PRESET, {
      ...noPay, caHt: 100_000, expensesHt: 20_000,
    });
    // Model IS = 6,375 + 9,375. Cash = 120,000 - 24,000 - 16,000 - 15,750.
    expect(result.summary.corporateTax.taxDue).toBe(15_750);
    expect(result.summary.netGroupCash).toBe(64_250);
  });

  it('does not turn a VAT credit into an automatic refund', () => {
    const result = resolveScenarioGraph(FREELANCE_SASU_PRESET, {
      ...noPay, caHt: 10_000, expensesHt: 50_000,
    });
    expect(result.summary.vat.netVatDue).toBe(0);
    expect(result.summary.netGroupCash).toBe(-48_000);
    expect(result.warnings.some((warning) => warning.includes('Crédit de TVA'))).toBe(true);
  });

  it('retains holding cash when its distribution is zero', () => {
    const result = resolveScenarioGraph(holdingScenario());
    expect(result.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(49_375);
    expect(result.summary.netPersonalCash).toBe(0);
  });

  it('conserves cash with an independent personal dividend', () => {
    const retained = resolveScenarioGraph(holdingScenario());
    const distributed = resolveScenarioGraph(holdingScenario(), { holdingDividendAmount: 20_000 });
    expect(distributed.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(29_375);
    expect(retained.summary.netGroupCash - distributed.summary.netGroupCash).toBe(20_000);
    const dividend = distributed.flows.find((flow) => flow.sourceId === 'holding-1' && flow.category === 'dividend')!;
    expect(roundMoney(distributed.summary.netPersonalCash + dividend.taxResult!.taxAmount)).toBe(20_000);
    expect(distributed.summary.corporateTax).toEqual(retained.summary.corporateTax);
  });

  it('does not invent a personal distribution without an edge', () => {
    const scenario = holdingScenario();
    scenario.flows = scenario.flows.filter((flow) => flow.sourceId !== 'holding-1');
    const result = resolveScenarioGraph(scenario, { holdingDividendAmount: 20_000 });
    expect(result.summary.netPersonalCash).toBe(0);
    expect(result.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(49_375);
  });

  it('does not subtract an OpCo dividend without an edge', () => {
    const scenario = {
      ...FREELANCE_SASU_PRESET,
      flows: FREELANCE_SASU_PRESET.flows.filter((flow) => flow.category !== 'dividend'),
    };
    const zero = resolveScenarioGraph(scenario, noPay);
    const requested = resolveScenarioGraph(scenario, { ...noPay, dividendAmount: 50_000 });
    expect(requested.summary.netGroupCash).toBe(zero.summary.netGroupCash);
    expect(requested.summary.netPersonalCash).toBe(0);
  });

  it('keeps direct personal dividends independent of an unrelated holding', () => {
    const scenario: ScenarioState = {
      ...FREELANCE_SASU_PRESET,
      entities: [...FREELANCE_SASU_PRESET.entities, { id: 'unrelated', label: 'Autre holding', entityType: 'holding_sas' }],
    };
    const direct = resolveScenarioGraph(FREELANCE_SASU_PRESET);
    const result = resolveScenarioGraph(scenario);
    expect(result.summary.netPersonalCash).toBe(direct.summary.netPersonalCash);
    expect(result.summary.netGroupCash).toBe(direct.summary.netGroupCash);
    expect(result.entities.find((entity) => entity.id === 'unrelated')?.metrics.treasury).toBe(0);
  });

  it('reconciles net salary plus contributions with company cost', () => {
    const result = resolveScenarioGraph(FREELANCE_SASU_PRESET);
    const salary = result.flows.find((flow) => flow.category === 'salary')!;
    const social = result.flows.find((flow) => flow.category === 'social_charges')!;
    expect(salary.resolvedAmount).toBe(36_000);
    expect(roundMoney(salary.resolvedAmount + social.resolvedAmount)).toBe(result.summary.executiveSalary.totalCompanyCost);
    expect(salary.taxResult?.netAmount).toBe(salary.resolvedAmount);
  });

  it('consolidates company balances, excluding people and authorities', () => {
    const result = resolveScenarioGraph(FULL_GROUP_PRESET);
    const cash = result.entities.filter((entity) => ['sasu', 'holding_sas', 'sci_is'].includes(entity.entityType))
      .reduce((sum, entity) => sum + (entity.metrics.treasury ?? 0), 0);
    expect(result.summary.netGroupCash).toBe(roundMoney(cash));
    expect(result.warnings.some((warning) => warning.includes('Management fees'))).toBe(true);
  });

  it('reports an unfunded holding distribution instead of clamping it silently', () => {
    const result = resolveScenarioGraph(holdingScenario(), { holdingDividendAmount: 60_000 });
    expect(result.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(-10_625);
    expect(result.warnings.some((warning) => warning.includes('trésorerie négative'))).toBe(true);
  });
});
