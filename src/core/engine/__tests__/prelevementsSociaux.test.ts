import { describe, expect, it } from 'vitest';

import { calculatePropertyGain, calculateSciIrIncome, calculateShareSaleTaxPerson, calculateDividendTax } from '../calculator';
import { PFU_PS_RATE, PS_CAPITAL_DEROGATORY_RATE } from '../taxRules';
import { emptyCarryOver, resolveScenarioGraph } from '../graphResolver';
import { roundMoney } from '../calculator';

/**
 * Depuis la loi n° 2026-534 du 25 juin 2026, la CSG sur le capital est à 10,6 %
 * (CSS L. 136-8, I-2°) — mais le IV du même article en sort deux catégories,
 * maintenues à 9,2 %. Les deux forfaits doivent rester distincts : les
 * confondre fausse d'1,4 point tout l'immobilier du modèle.
 */
describe('prélèvements sociaux sur le capital', () => {
  it('pose les deux forfaits aux valeurs de la loi', () => {
    expect(PFU_PS_RATE.value).toBe(0.186); // CSG 10,6 + solidarité 7,5 + CRDS 0,5
    expect(PS_CAPITAL_DEROGATORY_RATE.value).toBe(0.172); // CSG 9,2 + 7,5 + 0,5
  });

  it('taxe les revenus fonciers à 17,2 % (CSS L. 136-8, IV-1°)', () => {
    const result = calculateSciIrIncome(30_000, 0, 0, 0);
    expect(result.socialLevies).toBe(30_000 * 0.172);
  });

  it('taxe la plus-value immobilière à 17,2 % (CSS L. 136-8, IV-2° → CGI 150 U)', () => {
    const gain = calculatePropertyGain(300_000, 200_000, { holdingYears: 0 });
    expect(gain.socialLevies).toBeCloseTo(gain.taxableSocialLevies * 0.172, 2);
  });

  it('laisse les dividendes à 18,6 % (L. 136-7 I-1°, hors dérogation)', () => {
    expect(calculateDividendTax(10_000, 'pfu').psPart).toBe(10_000 * 0.186);
  });

  it('laisse la cession de titres à 18,6 % (L. 136-6 I-e, hors dérogation)', () => {
    const sale = calculateShareSaleTaxPerson(100_000, 0, { mode: 'pfu' });
    expect(sale.breakdown.find((l) => l.label === 'Prélèvements sociaux')?.amount)
      .toBe(100_000 * 0.186);
  });
});

describe('assiette des prélèvements sociaux fonciers', () => {
  const scenario = {
    id: 'sci-ir', name: 'SCI IR', version: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    entities: [
      { id: 'sci', label: 'SCI', entityType: 'sci_ir' as const, inputs: { rentalIncomeHt: 24_000, interestExpenses: 0, otherCharges: 0 } },
      { id: 'p', label: 'Associé', entityType: 'person' as const },
    ],
    flows: [],
    ownerships: [{ id: 'o', ownerId: 'p', companyId: 'sci', percent: 100 }],
  };

  /**
   * CSS L. 136-6, I : la contribution est assise « sur le montant net retenu
   * pour l'établissement de l'impôt sur le revenu ». Un déficit foncier
   * antérieur réduit donc aussi l'assiette des prélèvements sociaux — calculer
   * ceux-ci sur les loyers bruts les décorrélerait de l'IR.
   */
  it('impute le déficit antérieur avant les prélèvements, comme pour l’IR', () => {
    const carried = { ...emptyCarryOver(2026), deficits: { sci: { carryForward: 10_000 } } };
    const result = resolveScenarioGraph(scenario as never, {}, carried);

    // 24 000 € de loyers − 10 000 € de déficit reporté = 14 000 € de net foncier.
    // L'IR tombe à zéro sous le seuil, et les prélèvements portent sur 14 000 €,
    // pas sur les 24 000 € bruts (ce qui donnerait 4 128 €).
    expect(result.summary.personalIncomeTax.taxDue).toBe(0);
    expect(result.entities.find((e) => e.id === 'p')!.metrics.personalIncomeTax)
      .toBe(roundMoney(14_000 * 0.172));
  });

  it('porte sur le foncier brut quand aucun déficit n’est reporté', () => {
    const result = resolveScenarioGraph(scenario as never, {});
    const levies = result.entities.find((e) => e.id === 'p')!.metrics.personalIncomeTax!
      - result.summary.personalIncomeTax.taxDue;
    expect(levies).toBeCloseTo(24_000 * 0.172, 2);
  });
});
