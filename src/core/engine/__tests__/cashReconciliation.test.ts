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
    expect(result.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(49_625);
    expect(result.summary.netPersonalCash).toBe(0);
  });

  it('conserves cash with an independent personal dividend', () => {
    const retained = resolveScenarioGraph(holdingScenario());
    const distributed = resolveScenarioGraph(holdingScenario(), { holdingDividendAmount: 20_000 });
    expect(distributed.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(29_625);
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
    expect(result.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(49_625);
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

  it('deducts management fees at the OpCo and taxes them at the holding', () => {
    const without = resolveScenarioGraph(holdingScenario());
    const withFees = resolveScenarioGraph(SASU_HOLDING_PRESET);
    // 12 000 € de fees : résultat OpCo − 12 000, produit imposable chez la holding.
    expect(withFees.summary.corporateTax.taxDue).toBeLessThan(without.summary.corporateTax.taxDue);
    // Holding : 15 % × (QPFC 2 500 + fees 12 000) = 2 175.
    expect(withFees.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.corporateTax).toBe(2_175);
    expect(withFees.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(50_000 + 12_000 - 2_175);
    const fees = withFees.flows.find((flow) => flow.category === 'management_fees')!;
    expect(fees.taxResult).toMatchObject({ legalNoteId: 'management-fees' });
    expect(withFees.warnings.some((warning) => warning.includes('acte anormal'))).toBe(true);
  });

  it('reports an unfunded holding distribution instead of clamping it silently', () => {
    const result = resolveScenarioGraph(holdingScenario(), { holdingDividendAmount: 60_000 });
    expect(result.entities.find((entity) => entity.entityType === 'holding_sas')?.metrics.treasury).toBe(-10_375);
    expect(result.warnings.some((warning) => warning.includes('trésorerie négative'))).toBe(true);
  });

  it('moves CCA advances and loan payments through treasuries without touching the result', () => {
    const base = resolveScenarioGraph(FREELANCE_SASU_PRESET, noPay);
    const scenario: ScenarioState = {
      ...FREELANCE_SASU_PRESET,
      entities: [...FREELANCE_SASU_PRESET.entities, { id: 'bank-1', label: 'Banque', entityType: 'bank' }],
      flows: [...FREELANCE_SASU_PRESET.flows,
        { id: 'cca', sourceId: 'person-1', targetId: 'sasu-1', category: 'cca_advance', label: 'Apport CCA', amount: 10_000, periodicity: 'annual', layer: 'treasury' },
        { id: 'loan', sourceId: 'sasu-1', targetId: 'bank-1', category: 'loan_payment', label: 'Échéance', amount: 4_000, periodicity: 'annual', layer: 'treasury' },
      ],
    };
    const result = resolveScenarioGraph(scenario, noPay);
    const sasu = result.entities.find((entity) => entity.entityType === 'sasu')!;
    expect(result.summary.corporateTax).toEqual(base.summary.corporateTax);
    expect(sasu.metrics.treasury).toBe(base.summary.netGroupCash + 10_000 - 4_000);
    expect(sasu.metrics.ccaBalance).toBe(10_000);
    expect(result.summary.netPersonalCash).toBe(-10_000);
    expect(result.warnings.some((warning) => warning.includes('débiteur'))).toBe(false);
  });

  it('flags a debtor CCA to a natural person', () => {
    const scenario: ScenarioState = {
      ...FREELANCE_SASU_PRESET,
      flows: [...FREELANCE_SASU_PRESET.flows,
        { id: 'cca', sourceId: 'sasu-1', targetId: 'person-1', category: 'cca_advance', label: 'Avance au dirigeant', amount: 5_000, periodicity: 'annual', layer: 'treasury' }],
    };
    const result = resolveScenarioGraph(scenario, noPay);
    expect(result.flows.find((flow) => flow.id === 'cca')?.taxResult?.legalNoteId).toBe('cca-debiteur');
    expect(result.warnings.some((warning) => warning.includes('débiteur'))).toBe(true);
  });

  it('simulates tax consolidation: QPFC 1 % and a single group IS with a neutral convention', () => {
    const plain = resolveScenarioGraph(SASU_HOLDING_PRESET);
    const integrated = resolveScenarioGraph({ ...SASU_HOLDING_PRESET, options: { integrationFiscale: true } });
    const holding = integrated.entities.find((entity) => entity.entityType === 'holding_sas')!;
    const dividend = integrated.flows.find((flow) => flow.id === 'flow-dividend-sasu-holding')!;
    expect(dividend.taxResult?.breakdown[0]?.amount).toBe(500);
    // SASU : 200 000 − 40 000 − 12 000 = 148 000 → seule : 6 375 + 26 375 = 32 750. Groupe : 148 000 + 12 000 + 500 = 160 500 → 6 375 + 29 500 = 35 875.
    expect(integrated.summary.corporateTax.taxDue).toBe(plain.summary.corporateTax.taxDue);
    expect(holding.metrics.corporateTax).toBe(35_875 - 32_750);
    expect(plain.entities.find((entity) => entity.entityType === 'holding_sas')!.metrics.corporateTax).toBe(2_175);
    expect(holding.metrics.corporateTax).toBeGreaterThan(plain.entities.find((entity) => entity.entityType === 'holding_sas')!.metrics.corporateTax!);
    expect(integrated.warnings.some((warning) => warning.includes('Intégration fiscale simulée'))).toBe(true);
    const unqualified = resolveScenarioGraph({ ...SASU_HOLDING_PRESET, options: { integrationFiscale: true }, ownerships: [{ id: 'o', ownerId: 'holding-1', companyId: 'sasu-1', percent: 60 }] });
    expect(unqualified.warnings.some((warning) => warning.includes('option ignorée'))).toBe(true);
  });
});
