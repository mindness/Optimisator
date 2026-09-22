/**
 * Tests de sortie du plan « exhaustivité des montages » (2026-09-21), phase par phase.
 * Chaque bloc reprend le test de sortie écrit dans le plan, sans le reformuler.
 */
import { describe, expect, it } from 'vitest';

import type { ScenarioState } from '../../types';
import {
  annualisedRevenue,
  bareOwnershipShare,
  calculateCorporateTax,
  calculateGiftTax,
  calculateIfi,
  calculateShareSaleTaxCompany,
  calculateShareSaleTaxPerson,
  cappedRentalAmortization,
  FULL_EXERCISE_DAYS,
  imputeCarriedDeficit,
  isProfessionalFurnishedRental,
  lateInterest,
  loanAnnuity,
  loanInstallment,
  loanSchedule,
  reducedRateThresholdFor,
  roundMoney,
  usufructShare,
} from '../calculator';
import { forecastScenario, FORECAST_BLIND_SPOTS } from '../forecast';
import { emptyCarryOver, resolveScenarioGraph, type CarryOver } from '../graphResolver';
import {
  DEFICIT_CARRYFORWARD_CAP_EUR,
  DMTG_DIRECT_LINE_ABATEMENT_EUR,
  DUTREIL_EXEMPTION_RATE,
  IFI_THRESHOLD_EUR,
  LMP_RECEIPTS_THRESHOLD_EUR,
  PARTICIPATION_QPFC_RATE,
  PFU_TOTAL_RATE,
  USUFRUIT_TEMPORAIRE_SHARE_PER_DECADE,
} from '../taxRules';

const NOW = '2026-09-21T00:00:00.000Z';

const base = (
  entities: ScenarioState['entities'],
  flows: ScenarioState['flows'],
  extra: Partial<ScenarioState> = {},
): ScenarioState => ({
  id: 's', name: 's', version: 1, createdAt: NOW, updatedAt: NOW,
  activeLayers: ['treasury'], entities, flows, ...extra,
});

const flow = (
  id: string,
  sourceId: string,
  targetId: string,
  category: ScenarioState['flows'][number]['category'],
  amount: number,
  extra: Partial<ScenarioState['flows'][number]> = {},
): ScenarioState['flows'][number] =>
  ({ id, sourceId, targetId, category, label: id, amount, periodicity: 'annual', layer: 'treasury', ...extra });

/** Enchaîne `count` exercices en passant l'état de clôture au suivant. */
function chain(scenario: ScenarioState, count: number, startYear = 2026) {
  const results = [];
  let carry: CarryOver | undefined;
  for (let i = 0; i < count; i += 1) {
    const resolved = resolveScenarioGraph(scenario, { year: startYear + i }, carry);
    carry = resolved.carryOut;
    results.push(resolved);
  }
  return results;
}

/* ---------------------------------------------------------------- P0 ---- */

describe('P0 — exercices chaînés', () => {
  const scenario = base(
    [
      { id: 'c', label: 'Clients', entityType: 'client' },
      { id: 'e', label: 'SASU', entityType: 'sasu', inputs: { openingTreasury: 10_000 } },
    ],
    [flow('rev', 'c', 'e', 'revenue', 100_000), flow('exp', 'e', 'v', 'expense', 40_000)]
      .filter((f) => f.id !== 'exp'),
  );

  it('ouvre l’exercice N+1 sur la trésorerie de clôture de N', () => {
    const [y1, y2, y3] = chain(scenario, 3);

    expect(y1!.carryOut.treasury.e).toBe(y1!.entities.find((entity) => entity.id === 'e')!.metrics.treasury);
    // L'ouverture de N+1 est la clôture de N : la trésorerie s'empile au lieu de repartir de zéro.
    expect(y2!.entities.find((entity) => entity.id === 'e')!.metrics.treasury)
      .toBeCloseTo(y1!.carryOut.treasury.e! + y2!.summary.corporateTax.netProfit, 0);
    expect(y3!.carryOut.year).toBe(2029);
  });

  it('part d’un état d’ouverture vide', () => {
    const empty = emptyCarryOver(2026);

    expect(empty).toEqual({
      year: 2026, deficits: {}, loans: {}, reports150_0Bter: [], amortizations: {},
      treasury: {}, cca: {}, perCeiling: {}, mecenat: {}, charasse: {},
    });
  });

  it('reste à l’identique sans état d’ouverture', () => {
    const withoutCarry = resolveScenarioGraph(scenario, { year: 2026 });
    const withEmptyCarry = chain(scenario, 1)[0]!;

    expect(withEmptyCarry.summary).toEqual(withoutCarry.summary);
  });

  it('ne dit plus que chaque exercice est calculé isolément', () => {
    expect(FORECAST_BLIND_SPOTS.some((line) => line.includes('calculé isolément'))).toBe(false);
    expect(forecastScenario(scenario, {}, { years: 3 }).carryOut.year).toBeGreaterThan(0);
  });
});

/* ------------------------------------------------- exercice écourté ---- */

describe('Exercice écourté — plafond du taux réduit d’IS (CGI art. 219, I-b)', () => {
  it('proratise le plafond de 42 500 € sur la durée de l’exercice', () => {
    expect(reducedRateThresholdFor()).toBe(42_500);
    expect(reducedRateThresholdFor(FULL_EXERCISE_DAYS)).toBe(42_500);
    expect(reducedRateThresholdFor(43)).toBeCloseTo(42_500 * (43 / 365), 2);
    // Un exercice ne dépasse pas douze mois pour ce plafond.
    expect(reducedRateThresholdFor(500)).toBe(42_500);
  });

  it('annualise le chiffre d’affaires pour le test des 10 M€', () => {
    expect(annualisedRevenue(1_000_000)).toBe(1_000_000);
    expect(annualisedRevenue(1_000_000, 182.5)).toBe(2_000_000);
  });

  it('laisse l’exercice plein inchangé', () => {
    expect(calculateCorporateTax(100_000, true)).toEqual(calculateCorporateTax(100_000, true, FULL_EXERCISE_DAYS));
    expect(calculateCorporateTax(30_000, true).taxDue).toBe(4_500);
  });

  it('retrouve l’IS d’un premier exercice de 43 jours', () => {
    // Cas réel : bénéfice 20 681,32 € sur un exercice du 19/11 au 31/12.
    // Sans prorata le moteur rendait 3 102,20 € : tout au taux réduit, à tort.
    const full = calculateCorporateTax(20_681.32, true);
    const short = calculateCorporateTax(20_681.32, true, 43);

    expect(full.taxDue).toBeCloseTo(3_102.2, 2);
    expect(short.taxDue).toBeCloseTo(4_669.65, 2);
    expect(short.bracket25).toBeGreaterThan(0);
  });

  it('applique la durée d’exercice du scénario et l’explique', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'v', label: 'Fournisseurs', entityType: 'vendor' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
      ],
      [flow('rev', 'c', 'e', 'revenue', 21_850.47), flow('exp', 'e', 'v', 'expense', 1_169.15)],
      { options: { exerciseDays: 43 } },
    );
    const resolved = resolveScenarioGraph(scenario, { year: 2024 });

    expect(resolved.entities.find((entity) => entity.id === 'e')!.metrics.corporateTax).toBeCloseTo(4_669.65, 2);
    expect(resolved.warnings.some((warning) => warning.includes('exercice de 43 jours'))).toBe(true);
  });

  it('n’écourte que le premier exercice d’une projection', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'v', label: 'Fournisseurs', entityType: 'vendor' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
      ],
      [flow('rev', 'c', 'e', 'revenue', 21_850.47), flow('exp', 'e', 'v', 'expense', 1_169.15)],
      { options: { exerciseDays: 43 } },
    );
    const { years } = forecastScenario(scenario, {}, { years: 3, startYear: 2024 });

    expect(years[0]!.corporateTaxDue).toBeCloseTo(4_669.65, 2);
    // Exercices pleins ensuite : plafond entier, donc tout au taux réduit.
    expect(years[1]!.corporateTaxDue).toBeCloseTo(3_102.2, 2);
    expect(years[2]!.corporateTaxDue).toBeCloseTo(3_102.2, 2);
  });
});

/* ---------------------------------------------------------------- P1 ---- */

describe('P1 — report déficitaire', () => {
  it('impute un déficit de 300 k€ sur un bénéfice de 200 k€ et garde 100 k€ en stock', () => {
    const imputation = imputeCarriedDeficit(200_000, 300_000);

    expect(imputation.imputed).toBe(200_000);
    expect(imputation.taxableAfter).toBe(0);
    expect(imputation.stockAfter).toBe(100_000);
  });

  it('plafonne l’imputation à 1 M€ + 50 % de la fraction au-delà', () => {
    const profit = 3_000_000;
    const imputation = imputeCarriedDeficit(profit, 5_000_000);

    expect(imputation.imputed).toBe(DEFICIT_CARRYFORWARD_CAP_EUR.value + (profit - DEFICIT_CARRYFORWARD_CAP_EUR.value) * 0.5);
    expect(imputation.taxableAfter).toBe(profit - imputation.imputed);
    expect(imputation.cappedBy).toBeGreaterThan(0);
  });

  it('alimente le stock avec un exercice déficitaire', () => {
    expect(imputeCarriedDeficit(-80_000, 20_000).stockAfter).toBe(100_000);
  });

  it('annule l’IS de l’exercice suivant dans le moteur', () => {
    const loss = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
        { id: 'v', label: 'Fournisseurs', entityType: 'vendor' },
      ],
      [flow('rev', 'c', 'e', 'revenue', 100_000), flow('exp', 'e', 'v', 'expense', 400_000)],
    );
    const profitable = { ...loss, flows: [flow('rev', 'c', 'e', 'revenue', 300_000), flow('exp', 'e', 'v', 'expense', 100_000)] };

    const year1 = resolveScenarioGraph(loss, { year: 2026 });
    expect(year1.carryOut.deficits.e!.carryForward).toBe(300_000);

    const year2 = resolveScenarioGraph(profitable, { year: 2027 }, year1.carryOut);
    expect(year2.entities.find((entity) => entity.id === 'e')!.metrics.corporateTax).toBe(0);
    expect(year2.carryOut.deficits.e!.carryForward).toBe(100_000);
    expect(year2.warnings.some((warning) => warning.includes('déficit antérieur'))).toBe(true);
  });
});

/* ---------------------------------------------------------------- P2 ---- */

describe('P2 — emprunt : dette et tableau d’amortissement', () => {
  const terms = { principal: 200_000, rate: 0.03, years: 20, type: 'amortissable' as const };

  it('amortit 200 k€ / 20 ans / 3 % jusqu’à un capital restant dû nul', () => {
    const schedule = loanSchedule(terms);

    expect(schedule).toHaveLength(20);
    expect(schedule.at(-1)!.closing).toBeCloseTo(0, 2);
    expect(roundMoney(schedule.reduce((sum, row) => sum + row.principalRepaid, 0))).toBeCloseTo(200_000, 0);
    // Annuité constante : la part d'intérêts décroît, celle du capital croît.
    expect(schedule[0]!.interest).toBeCloseTo(6_000, 2);
    expect(schedule[0]!.interest).toBeGreaterThan(schedule.at(-1)!.interest);
    expect(roundMoney(schedule.reduce((sum, row) => sum + row.interest, 0))).toBeGreaterThan(60_000);
  });

  it('calcule l’annuité constante et l’échéance d’un exercice donné', () => {
    // 200 000 × 0,03 / (1 − 1,03⁻²⁰).
    expect(loanAnnuity(terms)).toBeCloseTo(13_443.14, 2);
    expect(loanAnnuity({ ...terms, rate: 0, years: 10 })).toBe(20_000);

    const first = loanInstallment(terms, terms.principal, 0);
    const second = loanInstallment(terms, first.closing, 1);
    expect(second.interest).toBeCloseTo(first.closing * terms.rate, 2);
    expect(second.payment).toBeCloseTo(first.payment, 2);
    expect(second.closing).toBeCloseTo(first.closing - second.principalRepaid, 2);
    // Emprunt soldé : plus d'échéance.
    expect(loanInstallment(terms, 0, 5).payment).toBe(0);
  });

  it('ne rembourse le capital qu’au terme pour un in fine', () => {
    const schedule = loanSchedule({ ...terms, type: 'in_fine', years: 5 });

    expect(schedule.slice(0, 4).every((row) => row.principalRepaid === 0)).toBe(true);
    expect(schedule.at(-1)!.principalRepaid).toBe(200_000);
    expect(schedule.every((row) => row.interest === 6_000)).toBe(true);
  });

  it('déduit les seuls intérêts et suit la dette d’un exercice à l’autre', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
        { id: 'b', label: 'Banque', entityType: 'bank' },
      ],
      [flow('rev', 'c', 'e', 'revenue', 100_000), flow('loan', 'e', 'b', 'loan_payment', 0, { loan: terms })],
    );
    const [year1, year2] = chain(scenario, 2);
    const company = (result: typeof year1) => result!.entities.find((entity) => entity.id === 'e')!;

    // Résultat imposable = CA − intérêts ; le capital n'est pas une charge.
    expect(company(year1).metrics.fiscalResult).toBeCloseTo(100_000 - 6_000, 2);
    expect(company(year1).metrics.debtOutstanding).toBeLessThan(200_000);
    expect(company(year2).metrics.debtOutstanding).toBeLessThan(company(year1).metrics.debtOutstanding!);
    expect(company(year2).metrics.fiscalResult!).toBeGreaterThan(company(year1).metrics.fiscalResult!);
  });
});

/* ---------------------------------------------------------------- P3 ---- */

describe('P3 — cession de titres et plus-values', () => {
  const salePrice = 1_000_000;
  const acquisitionPrice = 200_000;

  it('sépare le traitement du cédant personne physique et celui de la holding', () => {
    const person = calculateShareSaleTaxPerson(salePrice, acquisitionPrice, { mode: 'pfu' });
    const company = calculateShareSaleTaxCompany(salePrice, acquisitionPrice, { holdingYears: 5, stakePercent: 100 });

    expect(person.totalTax).toBeCloseTo(800_000 * PFU_TOTAL_RATE.value, 2);
    expect(company.participationRegime).toBe(true);
    expect(company.qpfc).toBeCloseTo(800_000 * PARTICIPATION_QPFC_RATE.value, 2);
    // Seule la quote-part de 12 % entre au résultat : les deux régimes divergent nettement.
    expect(company.taxableAddition).toBeLessThan(person.totalTax);
  });

  it('refuse le régime de participation en deçà de deux ans ou de 5 %', () => {
    expect(calculateShareSaleTaxCompany(salePrice, acquisitionPrice, { holdingYears: 1, stakePercent: 100 }).participationRegime).toBe(false);
    expect(calculateShareSaleTaxCompany(salePrice, acquisitionPrice, { holdingYears: 5, stakePercent: 2 }).taxableAddition).toBe(800_000);
  });

  it('réserve l’abattement pour durée de détention aux titres acquis avant 2018 et au barème', () => {
    const before = calculateShareSaleTaxPerson(salePrice, acquisitionPrice, { mode: 'bareme', marginalRate: 0.41, holdingYears: 10, acquisitionYear: 2015 });
    const after = calculateShareSaleTaxPerson(salePrice, acquisitionPrice, { mode: 'bareme', marginalRate: 0.41, holdingYears: 10, acquisitionYear: 2019 });
    const pfu = calculateShareSaleTaxPerson(salePrice, acquisitionPrice, { mode: 'pfu', holdingYears: 10, acquisitionYear: 2015 });

    expect(before.durationAllowance).toBeCloseTo(800_000 * 0.65, 2);
    expect(after.durationAllowance).toBe(0);
    expect(pfu.durationAllowance).toBe(0);
  });

  it('applique l’abattement fixe de 500 000 € du dirigeant partant à la retraite', () => {
    const sale = calculateShareSaleTaxPerson(salePrice, acquisitionPrice, { mode: 'pfu', retirementAllowance: true });

    expect(sale.fixedAllowance).toBe(500_000);
    expect(sale.totalTax).toBeCloseTo(300_000 * PFU_TOTAL_RATE.value, 2);
  });

  it('affiche le piège quand les titres sont acquis après 2018', () => {
    const scenario = base(
      [
        { id: 'p', label: 'Dirigeant', entityType: 'person' },
        { id: 'a', label: 'Acquéreur', entityType: 'person' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
        { id: 'c', label: 'Clients', entityType: 'client' },
      ],
      [
        flow('rev', 'c', 'e', 'revenue', 50_000),
        flow('sale', 'p', 'a', 'share_sale', salePrice, { share: { acquisitionPrice, acquisitionYear: 2021 } }),
      ],
    );
    const resolved = resolveScenarioGraph(scenario, { year: 2026 });
    const sale = resolved.flows.find((f) => f.id === 'sale')!;

    expect(sale.taxResult!.taxAmount).toBeGreaterThan(0);
    expect(sale.taxResult!.warning).toContain('acquis en 2021');
    expect(resolved.entities.find((e) => e.id === 'p')!.metrics.netPersonalCash!).toBeGreaterThan(0);
  });
});

/* ---------------------------------------------------------------- P4 ---- */

describe('P4 — apport-cession 150-0 B ter', () => {
  const holdingGroup = (reinvestment?: { ratio: number; kind: 'eligible' | 'immobilier' | 'fonds' }) => base(
    [
      { id: 'p', label: 'Apporteur', entityType: 'person' },
      { id: 'h', label: 'Holding', entityType: 'holding_sas' },
      { id: 'a', label: 'Acquéreur', entityType: 'person' },
      { id: 'c', label: 'Clients', entityType: 'client' },
      { id: 'e', label: 'SASU', entityType: 'sasu' },
    ],
    [
      flow('rev', 'c', 'e', 'revenue', 50_000),
      flow('apport', 'p', 'h', 'share_contribution', 1_000_000, { contribution: { acquisitionPrice: 100_000, controlPercent: 100 } }),
      ...(reinvestment
        ? [flow('cession', 'h', 'a', 'share_sale', 1_000_000, { share: { acquisitionPrice: 1_000_000, acquisitionYear: 2026, soldPercent: 100, deferredContributionId: 'apport', reinvestment } })]
        : []),
    ],
  );

  it('compte l’intérêt de retard à 0,20 % par mois', () => {
    expect(lateInterest(10_000, 24)).toBeCloseTo(10_000 * 24 * 0.002, 2);
    expect(lateInterest(10_000, -5)).toBe(0);
  });

  it('place la plus-value d’apport en report sans l’imposer', () => {
    const resolved = resolveScenarioGraph(holdingGroup(), { year: 2026 });
    const apport = resolved.flows.find((f) => f.id === 'apport')!;

    expect(apport.taxResult!.taxAmount).toBe(0);
    expect(resolved.carryOut.reports150_0Bter).toHaveLength(1);
    expect(resolved.carryOut.reports150_0Bter[0]!.gain).toBe(900_000);
  });

  it('déchoit le report quand le remploi n’atteint pas 70 % dans le délai', () => {
    const contribution = resolveScenarioGraph(holdingGroup(), { year: 2026 });
    // Cession deux ans après l'apport, remploi de 65 % seulement.
    const sale = resolveScenarioGraph(holdingGroup({ ratio: 0.65, kind: 'eligible' }), { year: 2028 }, contribution.carryOut);
    expect(sale.carryOut.reports150_0Bter).toHaveLength(1);
    expect(sale.warnings.some((w) => w.includes('65 % sur les 70 %'))).toBe(true);

    // Trois ans après la cession, le délai de remploi est écoulé : déchéance.
    const forfeit = resolveScenarioGraph(holdingGroup({ ratio: 0.65, kind: 'eligible' }), { year: 2031 }, sale.carryOut);
    expect(forfeit.carryOut.reports150_0Bter).toHaveLength(0);
    const message = forfeit.warnings.find((w) => w.includes('déchu'));
    expect(message).toBeDefined();
    expect(message).toContain('intérêt de retard');
    expect(forfeit.entities.find((e) => e.id === 'p')!.metrics.netPersonalCash!).toBeLessThan(0);
  });

  it('maintient le report à 70 % de remploi éligible', () => {
    const contribution = resolveScenarioGraph(holdingGroup(), { year: 2026 });
    const sale = resolveScenarioGraph(holdingGroup({ ratio: 0.7, kind: 'eligible' }), { year: 2028 }, contribution.carryOut);
    const later = resolveScenarioGraph(holdingGroup({ ratio: 0.7, kind: 'eligible' }), { year: 2031 }, sale.carryOut);

    expect(later.carryOut.reports150_0Bter).toHaveLength(1);
    expect(later.warnings.some((w) => w.includes('déchu'))).toBe(false);
    expect(later.warnings.some((w) => w.includes('à conserver 5 ans'))).toBe(true);
  });

  it('refuse l’immobilier patrimonial comme remploi éligible', () => {
    const contribution = resolveScenarioGraph(holdingGroup(), { year: 2026 });
    const sale = resolveScenarioGraph(holdingGroup({ ratio: 1, kind: 'immobilier' }), { year: 2028 }, contribution.carryOut);

    expect(sale.carryOut.reports150_0Bter[0]!.reinvestedEligibleRatio).toBe(0);
    expect(sale.warnings.some((w) => w.includes('OBO immobilier ne tient pas'))).toBe(true);
  });
});

/* ---------------------------------------------------------------- P5 ---- */

describe('P5 — démembrement de propriété', () => {
  it('valorise l’usufruit temporaire à 23 % par période de dix ans entamée', () => {
    expect(usufructShare({ durationYears: 10 })).toBeCloseTo(USUFRUIT_TEMPORAIRE_SHARE_PER_DECADE.value, 5);
    expect(usufructShare({ durationYears: 11 })).toBeCloseTo(0.46, 5);
    expect(bareOwnershipShare({ durationYears: 10 })).toBeCloseTo(0.77, 5);
  });

  it('valorise l’usufruit viager par tranche d’âge', () => {
    expect(usufructShare({ age: 55 })).toBe(0.5);
    expect(usufructShare({ age: 95 })).toBe(0.1);
    // Un usufruit temporaire ne peut pas valoir plus que l'usufruit viager du même âge.
    expect(usufructShare({ durationYears: 30, age: 75 })).toBe(0.3);
  });

  it('amortit l’usufruit temporaire chez la SCI à l’IS et l’éteint au terme', () => {
    const scenario = base(
      [
        { id: 's', label: 'SCI IS', entityType: 'sci_is', inputs: { rentalIncomeHt: 60_000 } },
        { id: 'n', label: 'Nu-propriétaire', entityType: 'person' },
      ],
      [],
      { ownerships: [{ id: 'o', ownerId: 's', companyId: 'n', percent: 100, nature: 'usufruit', dureeAnnees: 10, acquisitionPrice: 300_000 }] },
    );
    const years = chain(scenario, 11);
    const sci = (index: number) => years[index]!.entities.find((entity) => entity.id === 's')!;

    // Prix / durée, chaque exercice, jusqu'à extinction.
    expect(sci(0).metrics.fiscalResult).toBeCloseTo(60_000 - 30_000, 2);
    expect(years[0]!.carryOut.amortizations.s!.remaining).toBe(270_000);
    expect(sci(9).metrics.fiscalResult).toBeCloseTo(30_000, 2);
    expect(years[9]!.carryOut.amortizations.s!.remaining).toBe(0);
    expect(sci(10).metrics.fiscalResult).toBeCloseTo(60_000, 2);
  });

  it('attribue les fruits à l’usufruitier, pas au nu-propriétaire', () => {
    const scenario = base(
      [
        { id: 'sci', label: 'SCI IR', entityType: 'sci_ir', inputs: { rentalIncomeHt: 40_000 } },
        { id: 'u', label: 'Usufruitier', entityType: 'person' },
        { id: 'np', label: 'Nu-propriétaire', entityType: 'person' },
      ],
      [],
      {
        ownerships: [
          { id: 'o1', ownerId: 'u', companyId: 'sci', percent: 100, nature: 'usufruit' },
          { id: 'o2', ownerId: 'np', companyId: 'sci', percent: 100, nature: 'nue_propriete' },
        ],
      },
    );
    const resolved = resolveScenarioGraph(scenario, { year: 2026 });

    expect(resolved.entities.find((e) => e.id === 'u')!.metrics.personalIncomeTax!).toBeGreaterThan(0);
    expect(resolved.entities.find((e) => e.id === 'np')!.metrics.personalIncomeTax).toBe(0);
  });

  it('signale l’article 13, 5° et l’abus de droit', () => {
    const scenario = base(
      [
        { id: 'sci', label: 'SCI IS', entityType: 'sci_is', inputs: { rentalIncomeHt: 10_000 } },
        { id: 'u', label: 'Dirigeant', entityType: 'person' },
      ],
      [],
      { ownerships: [{ id: 'o', ownerId: 'u', companyId: 'sci', percent: 100, nature: 'usufruit', dureeAnnees: 10 }] },
    );
    const { warnings } = resolveScenarioGraph(scenario, { year: 2026 });

    expect(warnings.some((w) => w.includes('art. 13, 5°'))).toBe(true);
  });
});

/* ---------------------------------------------------------------- P6 ---- */

describe('P6 — holding animatrice, TVA de holding, IFI', () => {
  const group = (animatrice: boolean) => base(
    [
      { id: 'c', label: 'Clients', entityType: 'client' },
      { id: 'e', label: 'SASU', entityType: 'sasu' },
      { id: 'v', label: 'Fournisseurs', entityType: 'vendor' },
      { id: 'h', label: 'Holding', entityType: 'holding_sas', options: { animatrice }, inputs: { realEstateValue: 2_000_000 } },
      { id: 'p', label: 'Dirigeant', entityType: 'person' },
    ],
    [
      flow('rev', 'c', 'e', 'revenue', 300_000),
      flow('fees', 'e', 'h', 'management_fees', 60_000),
      flow('exp', 'h', 'v', 'expense', 20_000),
    ],
    { ownerships: [{ id: 'o', ownerId: 'p', companyId: 'h', percent: 100 }] },
  );

  it('ouvre le droit à déduction de TVA à la seule holding animatrice', () => {
    const pure = resolveScenarioGraph(group(false), { year: 2026 });
    const animee = resolveScenarioGraph(group(true), { year: 2026 });
    const holding = (result: typeof pure) => result.entities.find((e) => e.id === 'h')!;

    expect(pure.warnings.some((w) => w.includes('coefficient de déduction nul'))).toBe(true);
    expect(animee.warnings.some((w) => w.includes('holding animatrice revendiquée'))).toBe(true);
    // La holding pure ne déduit rien ; l'animatrice déduit la TVA de ses charges.
    expect(holding(pure).metrics.vatDeductible).toBe(0);
    expect(holding(animee).metrics.vatDeductible).toBeCloseTo(20_000 * 0.2, 2);
  });

  it('exonère les titres de la holding animatrice de l’assiette IFI', () => {
    const pure = resolveScenarioGraph(group(false), { year: 2026 });
    const animee = resolveScenarioGraph(group(true), { year: 2026 });

    expect(pure.entities.find((e) => e.id === 'p')!.metrics.ifiDue!).toBeGreaterThan(0);
    expect(animee.entities.find((e) => e.id === 'p')!.metrics.ifiDue).toBe(0);
  });

  it('n’impose l’IFI qu’au-delà du seuil d’assujettissement', () => {
    expect(calculateIfi(IFI_THRESHOLD_EUR.value).due).toBe(0);
    expect(calculateIfi(IFI_THRESHOLD_EUR.value).taxable).toBe(false);
    // 2 M€ : 0 % jusqu'à 800 k€, 0,5 % jusqu'à 1,3 M€, 0,7 % au-delà.
    expect(calculateIfi(2_000_000).due).toBeCloseTo(500_000 * 0.005 + 700_000 * 0.007, 2);
  });
});

/* ---------------------------------------------------------------- P7 ---- */

describe('P7 — transmission : donation et pacte Dutreil', () => {
  it('enchaîne réserve d’usufruit, Dutreil et abattement, étape par étape', () => {
    const gift = calculateGiftTax(2_000_000, { dutreil: true, reserveUsufruit: { age: 65 } });

    // Donateur de 65 ans : usufruit 40 %, la nue-propriété transmise vaut 60 %.
    expect(gift.transferredValue).toBe(1_200_000);
    expect(gift.dutreilExemption).toBe(1_200_000 * DUTREIL_EXEMPTION_RATE.value);
    expect(gift.abatement).toBe(DMTG_DIRECT_LINE_ABATEMENT_EUR.value);
    expect(gift.taxableBase).toBe(1_200_000 * 0.25 - 100_000);
    expect(gift.duties).toBeGreaterThan(0);
    expect(gift.breakdown.map((line) => line.label)).toContain('Exonération Dutreil 75 %');
  });

  it('réduit l’abattement déjà consommé sur quinze ans', () => {
    const fresh = calculateGiftTax(300_000);
    const reused = calculateGiftTax(300_000, { previousAbatementUsed: 100_000 });

    expect(fresh.abatement).toBe(100_000);
    expect(reused.abatement).toBe(0);
    expect(reused.duties).toBeGreaterThan(fresh.duties);
  });

  it('met les droits à la charge du donataire et rappelle les engagements', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
        { id: 'd', label: 'Parent', entityType: 'person' },
        { id: 'f', label: 'Enfant', entityType: 'person' },
      ],
      [
        flow('rev', 'c', 'e', 'revenue', 50_000),
        flow('don', 'd', 'f', 'donation', 1_000_000, { gift: { dutreil: true } }),
      ],
    );
    const resolved = resolveScenarioGraph(scenario, { year: 2026 });
    const don = resolved.flows.find((f) => f.id === 'don')!;

    expect(don.taxResult!.taxAmount).toBeGreaterThan(0);
    expect(don.taxResult!.warning).toContain('individuel de 6 ans');
    expect(resolved.entities.find((e) => e.id === 'f')!.metrics.netPersonalCash!)
      .toBeCloseTo(-don.taxResult!.taxAmount, 2);
  });

  it('purge le report 150-0 B ter par donation au terme du délai', () => {
    const scenario = base(
      [
        { id: 'p', label: 'Apporteur', entityType: 'person' },
        { id: 'h', label: 'Holding', entityType: 'holding_sas' },
        { id: 'f', label: 'Enfant', entityType: 'person' },
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
      ],
      [
        flow('rev', 'c', 'e', 'revenue', 50_000),
        flow('apport', 'p', 'h', 'share_contribution', 1_000_000, { contribution: { acquisitionPrice: 100_000, controlPercent: 100 } }),
        flow('don', 'p', 'f', 'donation', 1_000_000, { gift: { deferredContributionId: 'apport' } }),
      ],
    );
    const contribution = resolveScenarioGraph(scenario, { year: 2026 });

    const tooEarly = resolveScenarioGraph(scenario, { year: 2030 }, contribution.carryOut);
    expect(tooEarly.carryOut.reports150_0Bter).toHaveLength(1);

    const purged = resolveScenarioGraph(scenario, { year: 2032 }, contribution.carryOut);
    expect(purged.carryOut.reports150_0Bter).toHaveLength(0);
  });
});

/* ---------------------------------------------------------------- P8 ---- */

describe('P8 — location meublée au réel', () => {
  it('plafonne l’amortissement au loyer diminué des autres charges et reporte l’excédent', () => {
    const first = cappedRentalAmortization(20_000, 30_000, 25_000);
    expect(first.cap).toBe(5_000);
    expect(first.deducted).toBe(5_000);
    expect(first.carriedForward).toBe(15_000);

    // L'excédent reporté se déduit dès que le plafond le permet (art. 39 C, II-3).
    const next = cappedRentalAmortization(20_000, 60_000, 10_000, first.carriedForward);
    expect(next.deducted).toBe(35_000);
    expect(next.carriedForward).toBe(0);
  });

  it('trace la frontière LMNP / LMP sur les deux conditions cumulatives', () => {
    expect(isProfessionalFurnishedRental(LMP_RECEIPTS_THRESHOLD_EUR.value, 0)).toBe(false);
    expect(isProfessionalFurnishedRental(40_000, 50_000)).toBe(false);
    expect(isProfessionalFurnishedRental(40_000, 30_000)).toBe(true);
  });

  it('n’autorise jamais l’amortissement meublé à créer un déficit', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Locataires', entityType: 'client' },
        { id: 'v', label: 'Fournisseurs', entityType: 'vendor' },
        { id: 'l', label: 'Meublé', entityType: 'entreprise_individuelle', options: { locationMeubleeReelle: true }, inputs: { buildingAmortization: 40_000 } },
      ],
      [flow('rev', 'c', 'l', 'revenue', 30_000), flow('exp', 'l', 'v', 'expense', 10_000)],
    );
    const [year1, year2] = chain(scenario, 2);
    const company = (result: typeof year1) => result!.entities.find((entity) => entity.id === 'l')!;

    expect(company(year1).metrics.fiscalResult).toBe(0);
    expect(year1!.carryOut.amortizations.l!.carriedForward).toBe(20_000);
    expect(company(year2).metrics.fiscalResult).toBe(0);
    expect(year1!.warnings.some((w) => w.includes('régime LMP'))).toBe(true);
    expect(year1!.warnings.some((w) => w.includes('art. 39 C, II'))).toBe(true);
  });

  it('bascule en LMNP quand les autres revenus du foyer dominent', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Locataires', entityType: 'client' },
        { id: 'l', label: 'Meublé', entityType: 'entreprise_individuelle', options: { locationMeubleeReelle: true } },
      ],
      [flow('rev', 'c', 'l', 'revenue', 30_000)],
    );
    const { warnings } = resolveScenarioGraph(scenario, { year: 2026, otherIncome: 90_000 });

    expect(warnings.some((w) => w.includes('régime LMNP'))).toBe(true);
    expect(warnings.some((w) => w.includes('revenus de même nature'))).toBe(true);
  });
});
