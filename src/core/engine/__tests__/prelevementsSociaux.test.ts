import { describe, expect, it } from 'vitest';

import { calculatePropertyGain, calculateSciIrIncome, calculateShareSaleTaxPerson, calculateDividendTax } from '../calculator';
import { PFU_PS_RATE, PS_CAPITAL_DEROGATORY_RATE } from '../taxRules';

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
