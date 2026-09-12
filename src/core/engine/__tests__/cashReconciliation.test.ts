import { describe, expect, it } from 'vitest';

import { FREELANCE_SASU_PRESET, FULL_GROUP_PRESET, SASU_HOLDING_PRESET } from '../../presets';
import type { ScenarioState } from '../../types';
import { roundMoney } from '../calculator';
import { resolveScenarioGraph } from '../graphResolver';

function holdingScenario(): ScenarioState {
  return {
    ...SASU_HOLDING_PRESET,
    // Isolate supported dividend mechanics from unimplemented fees.
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
    expect(result.entities.find((entity) => entity.entityType === 'sasu')?.metrics.treasury).toBe(64_250);
  });

  it('does not turn a VAT credit into an automatic refund', () => {
    const result = resolveScenarioGraph(FREELANCE_SASU_PRESET, {
      ...noPay, caHt: 10_000, expensesHt: 50_000,
    });
    expect(result.summary.vat.netVatDue).toBe(0);
    expect(result.summary.netGroupCash).toBe(-48_000);
    expect(result.warnings.some((warning) => warning.includes('Crédit de TVA'))).toBe(true);
  });

  it('retains incoming holding cash when its distribution is zero', () => {
    const result = resolveScenarioGraph(holdingScenario());
    expect(result.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(49_375);
    expect(result.summary.netPersonalCash).toBe(0);
    expect(result.flows.find((flow) => flow.sourceId === 'holding-1' && flow.category === 'dividend')?.resolvedAmount).toBe(0);
  });

  it('conserves cash across the group boundary with an independent personal dividend', () => {
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
    expect(result.entities.find((entity) => entity.entityType === 'holding_s