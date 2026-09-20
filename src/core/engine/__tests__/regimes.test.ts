import { describe, expect, it } from 'vitest';

import {
  calculateDividendTax,
  calculateMicroEnterprise,
  calculatePersonalIncomeTax,
  calculateSciIrIncome,
  calculateTnsContributions,
  calculateTnsDividendSurcharge,
  compareDividendTaxModes,
  findMaxGrossSalaryForTargetTMI,
  roundMoney,
} from '../calculator';
import {
  DIVIDEND_BAREME_ALLOWANCE,
  IR_2026_BRACKETS,
  MICRO_BRACKETS_2026,
  PFU_PS_RATE,
  PFU_TOTAL_RATE,
  QUOTIENT_FAMILIAL_CAP_PER_HALF_PART_EUR,
  TNS_DIVIDEND_EXEMPT_CAPITAL_SHARE,
  TNS_SOCIAL_RATE_APPROX,
} from '../taxRules';

describe('calculatePersonalIncomeTax — quotient familial et décote', () => {
  it('plafonne l’avantage du quotient familial à 1 807 € par demi-part', () => {
    // Revenu élevé : l'avantage brut des deux demi-parts dépasse le plafond.
    const withoutChildren = calculatePersonalIncomeTax(120_000, 2, { situation: 'couple' });
    const withOneChild = calculatePersonalIncomeTax(120_000, 2.5, { situation: 'couple' });

    expect(withOneChild.quotientCapAdjustment).toBeGreaterThan(0);
    const advantage = withoutChildren.taxDue - withOneChild.taxDue;
    // Une demi-part supplémentaire → avantage borné au plafond légal.
    expect(advantage).toBeLessThanOrEqual(
      QUOTIENT_FAMILIAL_CAP_PER_HALF_PART_EUR.value + 1,
    );
  });

  it('n’applique aucun plafonnement au foyer de référence', () => {
    expect(calculatePersonalIncomeTax(60_000, 1).quotientCapAdjustment).toBe(0);
    expect(
      calculatePersonalIncomeTax(60_000, 2, { situation: 'couple' }).quotientCapAdjustment,
    ).toBe(0);
  });

  it('applique la décote et ne rend jamais un impôt négatif', () => {
    const result = calculatePersonalIncomeTax(16_000);
    expect(result.decote).toBeGreaterThan(0);
    expect(result.taxDue).toBe(roundMoney(result.grossTaxDue - result.decote));
    expect(result.taxDue).toBeGreaterThanOrEqual(0);
  });

  it('efface l’impôt quand la décote l’excède', () => {
    const result = calculatePersonalIncomeTax(13_000);
    expect(result.taxDue).toBe(0);
    expect(result.decote).toBe(result.grossTaxDue);
  });

  it('intègre les autres revenus à l’assiette et relève la TMI', () => {
    const salaryOnly = calculatePersonalIncomeTax(30_000);
    const withDividends = calculatePersonalIncomeTax(30_000, 1, {
      otherTaxableIncome: 60_000,
    });
    expect(withDividends.taxableAfterAllowance).toBe(
      salaryOnly.taxableAfterAllowance + 60_000,
    );
    expect(withDividends.marginalRate).toBeGreaterThan(salaryOnly.marginalRate);
  });

  it('borne l’abattement forfaitaire au salaire lui-même', () => {
    // 10 % de 200 € = 20 € < plancher 509 €, mais l'abattement ne peut pas
    // dépasser le revenu : sinon l'assiette deviendrait négative.
    const result = calculatePersonalIncomeTax(200);
    expect(result.professionalAllowance).toBe(200);
    expect(result.taxableAfterAllowance).toBe(0);
  });

  it('expose un taux moyen inférieur à la TMI', () => {
    const result = calculatePersonalIncomeTax(90_000);
    expect(result.marginalRate).toBe(0.3);
    expect(result.averageRate).toBeLessThan(result.marginalRate);
    expect(result.averageRate).toBeGreaterThan(0);
  });
});

describe('findMaxGrossSalaryForTargetTMI', () => {
  it('renvoie le brut dont le net imposable atteint exactement le sommet de tranche', () => {
    for (const bracket of IR_2026_BRACKETS.value) {
      if (bracket.upTo === Infinity) continue;
      const gross = findMaxGrossSalaryForTargetTMI(bracket.rate);
      const atCeiling = calculatePersonalIncomeTax(gross);
      expect(atCeiling.marginalRate).toBe(bracket.rate);
      // Un euro de plus fait basculer dans la tranche supérieure.
      expect(calculatePersonalIncomeTax(gross + 100).marginalRate).toBeGreaterThan(
        bracket.rate,
      );
    }
  });

  it('n’a pas de plafond sur la dernière tranche', () => {
    expect(findMaxGrossSalaryForTargetTMI(0.45)).toBe(Infinity);
    expect(findMaxGrossSalaryForTargetTMI(0.99)).toBe(Infinity);
  });

  it('proportionne le plafond au nombre de parts', () => {
    expect(findMaxGrossSalaryForTargetTMI(0.11, 2)).toBeGreaterThan(
      findMaxGrossSalaryForTargetTMI(0.11, 1),
    );
  });
});

describe('calculateDividendTax', () => {
  it('applique le PFU à 31,4 % sur le brut', () => {
    const result = calculateDividendTax(10_000, 'pfu');
    expect(result.totalTax).toBe(roundMoney(10_000 * PFU_TOTAL_RATE.value));
    expect(result.netIncome).toBe(roundMoney(10_000 - result.totalTax));
    expect(result.effectiveRate).toBeCloseTo(PFU_TOTAL_RATE.value, 6);
  });

  it('applique l’abattement de 40 % et la CSG déductible au barème', () => {
    const gross = 10_000;
    const result = calculateDividendTax(gross, 'bareme', 0.3);
    expect(result.taxableBase).toBe(roundMoney(gross * (1 - 0.4 - 0.068)));
    expect(result.irPart).toBe(roundMoney(result.taxableBase * 0.3));
    expect(result.psPart).toBe(roundMoney(gross * PFU_PS_RATE.value));
    expect(DIVIDEND_BAREME_ALLOWANCE.value).toBe(0.4);
  });

  it('ne taxe rien à l’IR quand la TMI est nulle', () => {
    const result = calculateDividendTax(10_000, 'bareme', 0);
    expect(result.irPart).toBe(0);
    expect(result.totalTax).toBe(roundMoney(10_000 * PFU_PS_RATE.value));
  });

  it('gère un dividende nul sans division par zéro', () => {
    expect(calculateDividendTax(0, 'pfu').effectiveRate).toBe(0);
    expect(calculateDividendTax(0, 'bareme', 0.41).effectiveRate).toBe(0);
  });
});

describe('compareDividendTaxModes', () => {
  it('préfère le barème sous TMI 11 %', () => {
    const arbitrage = compareDividendTaxModes(20_000, 0.11);
    expect(arbitrage.best.mode).toBe('bareme');
    expect(arbitrage.gain).toBeGreaterThan(0);
  });

  it('préfère le PFU à TMI 41 %', () => {
    const arbitrage = compareDividendTaxModes(20_000, 0.41);
    expect(arbitrage.best.mode).toBe('pfu');
  });

  it('bascule entre les deux régimes autour de la TMI 30 %', () => {
    // Point d'indifférence : 12,8 % = TMI × (1 − 40 % − 6,8 %).
    const breakeven = 0.128 / (1 - 0.4 - 0.068);
    expect(compareDividendTaxModes(20_000, breakeven - 0.02).best.mode).toBe('bareme');
    expect(compareDividendTaxModes(20_000, breakeven + 0.02).best.mode).toBe('pfu');
  });

  it('retient le PFU en cas d’égalité stricte', () => {
    const breakeven = 0.128 / (1 - 0.4 - 0.068);
    expect(compareDividendTaxModes(20_000, breakeven).best.mode).toBe('pfu');
  });
});

describe('calculateTnsContributions', () => {
  it('assoit les cotisations sur le revenu professionnel', () => {
    const result = calculateTnsContributions(50_000);
    expect(result.contributions).toBe(roundMoney(50_000 * TNS_SOCIAL_RATE_APPROX.value));
    expect(result.netAfterContributions).toBe(roundMoney(50_000 - result.contributions));
  });

  it('ne cotise pas sur un revenu négatif', () => {
    const result = calculateTnsContributions(-5_000);
    expect(result.base).toBe(0);
    expect(result.contributions).toBe(0);
  });
});

describe('calculateTnsDividendSurcharge', () => {
  it('exonère les dividendes sous 10 % du capital et CCA', () => {
    const result = calculateTnsDividendSurcharge(3_000, 50_000);
    expect(result.exemptThreshold).toBe(5_000);
    expect(result.subjectToContributions).toBe(0);
    expect(result.contributions).toBe(0);
  });

  it('assujettit la fraction excédant le seuil', () => {
    const result = calculateTnsDividendSurcharge(20_000, 50_000);
    expect(result.subjectToContributions).toBe(15_000);
    expect(result.contributions).toBe(roundMoney(15_000 * TNS_SOCIAL_RATE_APPROX.value));
    expect(TNS_DIVIDEND_EXEMPT_CAPITAL_SHARE.value).toBe(0.1);
  });

  it('assujettit tout le dividende quand le capital est nul', () => {
    const result = calculateTnsDividendSurcharge(20_000, 0);
    expect(result.exemptThreshold).toBe(0);
    expect(result.subjectToContributions).toBe(20_000);
  });
});

describe('calculateMicroEnterprise', () => {
  it('applique l’abattement propre à chaque catégorie', () => {
    expect(calculateMicroEnterprise(100_000, 'bic_vente').taxableProfit).toBe(29_000);
    expect(calculateMicroEnterprise(60_000, 'bic_services').taxableProfit).toBe(30_000);
    expect(calculateMicroEnterprise(60_000, 'bnc').taxableProfit).toBe(39_600);
    expect(calculateMicroEnterprise(10_000, 'meuble_tourisme').taxableProfit).toBe(7_000);
  });

  it('respecte le plancher d’abattement de 305 €', () => {
    const result = calculateMicroEnterprise(500, 'bnc');
    // 34 % de 500 = 170 € < 305 € → plancher retenu.
    expect(result.allowance).toBe(305);
    expect(result.taxableProfit).toBe(195);
  });

  it('borne l’abattement au chiffre d’affaires', () => {
    const result = calculateMicroEnterprise(100, 'bnc');
    expect(result.allowance).toBe(100);
    expect(result.taxableProfit).toBe(0);
  });

  it('assoit les cotisations sur le CA brut, pas sur le bénéfice', () => {
    const result = calculateMicroEnterprise(60_000, 'bic_services');
    expect(result.socialContributions).toBe(
      roundMoney(60_000 * MICRO_BRACKETS_2026.bic_services.socialRate),
    );
    expect(result.cashBeforeIr).toBe(roundMoney(60_000 - result.socialContributions));
  });

  it('signale le dépassement de seuil', () => {
    expect(calculateMicroEnterprise(83_600, 'bnc').ceilingExceeded).toBe(false);
    expect(calculateMicroEnterprise(83_601, 'bnc').ceilingExceeded).toBe(true);
    expect(calculateMicroEnterprise(203_101, 'bic_vente').ceilingExceeded).toBe(true);
  });

  it('traite un CA négatif comme nul', () => {
    expect(calculateMicroEnterprise(-1_000, 'bnc').revenue).toBe(0);
  });
});

describe('calculateSciIrIncome', () => {
  it('n’amortit pas le bâti et impose à la TMI plus les prélèvements sociaux', () => {
    const result = calculateSciIrIncome(36_000, 8_000, 3_000, 0.3);
    expect(result.taxableIncome).toBe(25_000);
    expect(result.incomeTax).toBe(roundMoney(25_000 * 0.3));
    expect(result.socialLevies).toBe(roundMoney(25_000 * PFU_PS_RATE.value));
    expect(result.cashFlowNet).toBe(
      roundMoney(25_000 - result.incomeTax - result.socialLevies),
    );
  });

  it('ne taxe pas un déficit foncier', () => {
    const result = calculateSciIrIncome(10_000, 14_000, 2_000, 0.41);
    expect(result.taxableIncome).toBe(-6_000);
    expect(result.incomeTax).toBe(0);
    expect(result.socialLevies).toBe(0);
  });

  it('est plus lourde qu’une SCI à l’IS à cash identique, faute d’amortissement', () => {
    // Même immeuble, même loyer : l'IR sans amortissement taxe une base plus large.
    const ir = calculateSciIrIncome(36_000, 8_000, 3_000, 0.3);
    expect(ir.taxableIncome).toBeGreaterThan(36_000 - 8_000 - 3_000 - 10_000);
  });
});
