import { describe, expect, it } from 'vitest';
import type { ScenarioState } from '../../types';
import { resolveScenarioGraph } from '../graphResolver';

import {
  calculateDividendTax,
  calculateMicroEnterprise,
  calculatePersonalIncomeTax,
  calculateSciIrIncome,
  calculateTnsContributions,
  calculateTnsDividendSurcharge,
  tnsGrossForNet,
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
  it('applique l’assiette unique 2026 : − 26 %, puis barème par branche', () => {
    const result = calculateTnsContributions(50_000);
    expect(result.assiette).toBe(37_000);
    expect(result.breakdown.map((line) => line.label)).toContain('Maladie-maternité (dégressive)');
    // Assiette 37 000 / PASS 48 060 = 0,77 → maladie entre 4 % et 6,5 % ; taux global attendu ≈ 30-33 % du super-brut.
    expect(result.contributions / result.base).toBeGreaterThan(0.28);
    expect(result.contributions / result.base).toBeLessThan(0.36);
    expect(result.netAfterContributions).toBe(roundMoney(50_000 - result.contributions));
  });

  it('exonère de maladie et d’allocations familiales sous les seuils, les applique au-delà', () => {
    const low = calculateTnsContributions(10_000);
    expect(low.breakdown.find((line) => line.label.startsWith('Maladie'))?.amount).toBe(0);
    const high = calculateTnsContributions(120_000);
    expect(high.breakdown.find((line) => line.label.startsWith('Allocations'))?.amount).toBeGreaterThan(0);
    // Effet de plafond : le taux moyen baisse au-delà du PASS (retraite de base et RCI plafonnées).
    expect(high.contributions / high.base).toBeLessThan(calculateTnsContributions(60_000).contributions / 60_000);
  });

  it('retrouve le brut pour un net voulu', () => {
    const gross = tnsGrossForNet(30_000);
    expect(gross.netAfterContributions).toBeCloseTo(30_000, 0);
    expect(gross.base).toBeGreaterThan(40_000);
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
    const result = calculateTnsDividendSurcharge(20_000, 50_000, 40_000);
    expect(result.subjectToContributions).toBe(15_000);
    expect(result.contributions).toBe(roundMoney(calculateTnsContributions(55_000).contributions - calculateTnsContributions(40_000).contributions));
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

describe('per-entity resolution', () => {
  const NOW = '2026-09-20T00:00:00.000Z';
  const base = (entities: ScenarioState['entities'], flows: ScenarioState['flows'], extra: Partial<ScenarioState> = {}): ScenarioState => ({
    id: 's', name: 's', version: 1, createdAt: NOW, updatedAt: NOW, activeLayers: ['treasury'], entities, flows, ...extra,
  });
  const flow = (id: string, sourceId: string, targetId: string, category: ScenarioState['flows'][number]['category'], amount: number, periodicity: 'annual' | 'monthly' = 'annual'): ScenarioState['flows'][number] =>
    ({ id, sourceId, targetId, category, label: id, amount, periodicity, layer: 'treasury' });

  it('costs a TNS salary with SSI contributions only and taxes the EURL at IS', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 'e', label: 'EURL', entityType: 'eurl', taxRegime: 'is' }, { id: 'p', label: 'Gérant', entityType: 'person' }],
      [flow('rev', 'c', 'e', 'revenue', 100_000), flow('sal', 'e', 'p', 'salary', 30_000)],
    );
    const result = resolveScenarioGraph(scenario);
    const salary = result.flows.find((f) => f.id === 'sal')!.taxResult!;
    // TNS : brut retrouvé par bissection sur le barème, pas de part patronale.
    expect(salary.grossAmount).toBeCloseTo(tnsGrossForNet(30_000).base, 0);
    expect(result.summary.executiveSalary.employerCharges).toBe(0);
    expect(result.summary.corporateTax.taxDue).toBeGreaterThan(0);
    expect(result.entities.find((e) => e.id === 'e')!.metrics.fiscalResult).toBeCloseTo(100_000 - salary.grossAmount, 0);
  });

  it('routes an EURL at IR to the owner’s income tax as transparent income', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 'e', label: 'EURL', entityType: 'eurl' }, { id: 'p', label: 'Gérant', entityType: 'person' }],
      [flow('rev', 'c', 'e', 'revenue', 60_000), flow('sal', 'e', 'p', 'salary', 20_000)],
    );
    const result = resolveScenarioGraph(scenario);
    expect(result.summary.corporateTax.taxDue).toBe(0);
    const eurl = result.entities.find((e) => e.id === 'e')!;
    // Bénéfice après SSI imposé chez l'associé ; le prélèvement de 20 000 sort de la trésorerie.
    expect(eurl.metrics.fiscalResult).toBe(roundMoney(60_000 - calculateTnsContributions(60_000).contributions));
    expect(eurl.metrics.treasury).toBeCloseTo(eurl.metrics.fiscalResult! - 20_000, 2);
    expect(result.summary.personalIncomeTax.taxDue).toBeGreaterThan(0);
    expect(result.entities.find((e) => e.id === 'p')!.metrics.netPersonalCash).toBeCloseTo(20_000 - result.summary.personalIncomeTax.taxDue, 2);
  });

  it('annualises monthly flows and applies opening balances and loan interest', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 's', label: 'SASU', entityType: 'sasu', inputs: { openingTreasury: 5_000, openingCca: 1_000 } },
       { id: 'p', label: 'Dirigeant', entityType: 'person' }, { id: 'b', label: 'Banque', entityType: 'bank' }],
      [flow('rev', 'c', 's', 'revenue', 10_000, 'monthly'), { ...flow('loan', 's', 'b', 'loan_payment', 12_000), interestAmount: 2_000 }, flow('cca', 'p', 's', 'cca_advance', 3_000)],
    );
    const result = resolveScenarioGraph(scenario);
    expect(result.summary.caHt).toBe(120_000);
    const sasu = result.entities.find((e) => e.id === 's')!;
    // Résultat = 120 000 − 2 000 d'intérêts ; IS dessus ; trésorerie = ouverture + net + CCA − échéance + intérêts déjà déduits.
    expect(sasu.metrics.fiscalResult).toBe(118_000);
    expect(sasu.metrics.treasury).toBe(5_000 + sasu.metrics.netProfit! + 3_000 - 12_000 + 2_000);
    expect(sasu.metrics.ccaBalance).toBe(4_000);
    expect(result.warnings.some((w) => w.includes('annualisés'))).toBe(true);
  });

  it('taxes SCI IR rents at the owner and pays social levies', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 's', label: 'SASU', entityType: 'sasu' }, { id: 'sci', label: 'SCI IR', entityType: 'sci_ir', inputs: { interestExpenses: 4_000, otherCharges: 1_000 } }, { id: 'p', label: 'Associé', entityType: 'person' }],
      [flow('rev', 'c', 's', 'revenue', 50_000), flow('rent', 's', 'sci', 'rent', 12_000)],
    );
    const result = resolveScenarioGraph(scenario);
    const sci = result.entities.find((e) => e.id === 'sci')!;
    expect(sci.metrics.fiscalResult).toBe(7_000);
    expect(sci.metrics.corporateTax).toBe(0);
    expect(sci.metrics.treasury).toBe(7_000);
    const person = result.entities.find((e) => e.id === 'p')!;
    // PS 18,6 % sur 7 000 = 1 302, plus l'IR au barème sur ce revenu foncier (nul sous le seuil, 1 part).
    expect(person.metrics.personalIncomeTax).toBe(1_302 + result.summary.personalIncomeTax.taxDue);
    expect(result.summary.sciTaxDue).toBe(0);
  });

  it('adds SSI contributions on SARL dividends above 10 % of capital and CCA', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 's', label: 'SARL', entityType: 'sarl', inputs: { capital: 10_000 } }, { id: 'p', label: 'Gérant', entityType: 'person' }],
      [flow('rev', 'c', 's', 'revenue', 100_000), flow('div', 's', 'p', 'dividend', 21_000)],
    );
    const result = resolveScenarioGraph(scenario, { dividendTaxMode: 'pfu' });
    const dividend = result.flows.find((f) => f.id === 'div')!.taxResult!;
    // Exonéré : 10 % × 10 000 = 1 000 ; 20 000 cotisent au barème marginal.
    expect(dividend.breakdown.at(-1)?.amount).toBe(calculateTnsContributions(20_000).contributions);
    expect(result.warnings.some((w) => w.includes('10 %'))).toBe(true);
  });

  it('splits transparent income between owners pro rata and taxes each separately', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 'e', label: 'EURL', entityType: 'eurl' }, { id: 'a', label: 'A', entityType: 'person' }, { id: 'b', label: 'B', entityType: 'person' }],
      [flow('rev', 'c', 'e', 'revenue', 200_000)],
      { ownerships: [{ id: 'o1', ownerId: 'a', companyId: 'e', percent: 75 }, { id: 'o2', ownerId: 'b', companyId: 'e', percent: 25 }] },
    );
    const result = resolveScenarioGraph(scenario);
    const a = result.entities.find((e) => e.id === 'a')!.metrics.personalIncomeTax!;
    const b = result.entities.find((e) => e.id === 'b')!.metrics.personalIncomeTax!;
    expect(a).toBeGreaterThan(b);
    expect(b).toBeGreaterThan(0);
    expect(result.warnings.some((w) => w.includes('prorata'))).toBe(true);
  });

  it('reintegrates CCA interest above the reference rate', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 's', label: 'SASU', entityType: 'sasu' }, { id: 'p', label: 'Dirigeant', entityType: 'person' }],
      [flow('rev', 'c', 's', 'revenue', 100_000), { ...flow('cca', 'p', 's', 'cca_advance', 10_000), interestAmount: 1_000 }],
    );
    const result = resolveScenarioGraph(scenario);
    // Plafond 4,33 % × 10 000 = 433 déductibles ; 567 réintégrés.
    expect(result.entities.find((e) => e.id === 's')!.metrics.fiscalResult).toBe(100_000 - 433);
    expect(result.flows.find((f) => f.id === 'cca')!.taxResult?.warning).toContain('567');
  });

  it('applies micro options: versement libératoire, ACRE and VAT franchise ceiling', () => {
    const micro = (options: NonNullable<ScenarioState['entities'][number]['options']>, revenue = 50_000) => resolveScenarioGraph(base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 'm', label: 'Micro', entityType: 'micro_entreprise', microCategory: 'bnc', options }, { id: 'p', label: 'Moi', entityType: 'person' }],
      [flow('rev', 'c', 'm', 'revenue', revenue), flow('vat', 'm', 'dgfip', 'vat', 0)].filter((f) => f.id !== 'vat'),
    ));
    const plain = micro({});
    const lib = micro({ versementLiberatoire: true });
    const acre = micro({ acre: true });
    expect(plain.summary.vat.netVatDue).toBe(0);
    expect(plain.summary.personalIncomeTax.taxDue).toBeGreaterThan(0);
    expect(lib.summary.personalIncomeTax.taxDue).toBe(0);
    expect(lib.entities.find((e) => e.id === 'm')!.metrics.treasury).toBe(plain.entities.find((e) => e.id === 'm')!.metrics.treasury! - 50_000 * 0.022);
    expect(acre.entities.find((e) => e.id === 'm')!.metrics.treasury).toBeGreaterThan(plain.entities.find((e) => e.id === 'm')!.metrics.treasury!);
    expect(micro({}, 60_000).warnings.some((w) => w.includes('293 B'))).toBe(true);
    expect(micro({ franchiseTva: false }).summary.vat.netVatDue).toBe(10_000);
  });

  it('moves a capital contribution into the company and counts it for the 10 % rule', () => {
    const scenario = base(
      [{ id: 'c', label: 'Clients', entityType: 'client' }, { id: 's', label: 'SARL', entityType: 'sarl' }, { id: 'p', label: 'Gérant', entityType: 'person' }],
      [flow('rev', 'c', 's', 'revenue', 100_000), flow('cap', 'p', 's', 'capital_contribution', 50_000), flow('div', 's', 'p', 'dividend', 5_000)],
    );
    const result = resolveScenarioGraph(scenario, { dividendTaxMode: 'pfu' });
    const sarl = result.entities.find((e) => e.id === 's')!;
    expect(sarl.metrics.treasury).toBe(sarl.metrics.netProfit! + 50_000 - 5_000);
    // 10 % × 50 000 = 5 000 exonérés : aucune cotisation sur ce dividende.
    expect(result.flows.find((f) => f.id === 'div')!.taxResult?.breakdown.at(-1)?.amount).toBe(0);
    expect(result.entities.find((e) => e.id === 'p')!.metrics.netPersonalCash).toBeLessThan(0);
  });
});
