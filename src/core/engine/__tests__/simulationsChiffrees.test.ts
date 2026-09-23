import { describe, expect, it } from 'vitest';

import type { ScenarioState } from '../../types';
import { resolveScenarioGraph } from '../graphResolver';

/**
 * Simulations complètes dont chaque montant attendu est recalculé ici, à partir
 * du texte, sans réutiliser les constantes ni les fonctions du moteur. Un test
 * qui réemploierait `IS_REDUCED_RATE` ou `calculateCorporateTax` ne pourrait pas
 * contredire le moteur : il vérifierait sa cohérence avec lui-même.
 */
const NOW = '2026-01-01T00:00:00.000Z';

const scenarioOf = (
  entities: ScenarioState['entities'],
  flows: ScenarioState['flows'],
  extra: Partial<ScenarioState> = {},
): ScenarioState => ({
  id: 's', name: 's', version: 1, createdAt: NOW, updatedAt: NOW,
  activeLayers: ['treasury'], entities, flows, ...extra,
});

const flowOf = (
  id: string,
  sourceId: string,
  targetId: string,
  category: ScenarioState['flows'][number]['category'],
  amount: number,
  extra: Partial<ScenarioState['flows'][number]> = {},
): ScenarioState['flows'][number] =>
  ({ id, sourceId, targetId, category, label: id, amount, periodicity: 'annual', layer: 'treasury', ...extra });

const CLIENT = { id: 'c', label: 'Clients', entityType: 'client' as const };
const PERSON = { id: 'p', label: 'Dirigeant', entityType: 'person' as const };

/** IS 2026 recalculé à la main : 15 % jusqu'à 42 500 €, puis 25 % (CGI art. 219, I et I-b). */
function isDuFromLaw(taxable: number, reducedRateEligible = true): number {
  if (taxable <= 0) return 0;
  if (!reducedRateEligible) return round2(taxable * 0.25);
  const reduced = Math.min(taxable, 42_500);
  return round2(reduced * 0.15 + Math.max(0, taxable - 42_500) * 0.25);
}

/** Barème IR 2026 par part (CGI art. 197, I-1), hors décote et plafonnement. */
function irBaremeFromLaw(perPart: number): number {
  const brackets: Array<[number, number]> = [
    [11_600, 0], [29_579, 0.11], [84_577, 0.3], [181_917, 0.41], [Infinity, 0.45],
  ];
  let tax = 0;
  let floor = 0;
  for (const [ceiling, rate] of brackets) {
    if (perPart <= floor) break;
    tax += (Math.min(perPart, ceiling) - floor) * rate;
    floor = ceiling;
  }
  return tax;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

describe('SASU à l’IS — chaîne complète', () => {
  const scenario = scenarioOf(
    [CLIENT, { id: 'e', label: 'SASU', entityType: 'sasu' }, PERSON],
    [
      flowOf('rev', 'c', 'e', 'revenue', 120_000),
      flowOf('exp', 'e', 'c', 'expense', 24_000),
      // Le curseur « salaire net » ajuste un flux existant : sans lui, il n'a rien à régler.
      flowOf('sal', 'e', 'p', 'salary', 0),
    ],
  );

  it('taxe le résultat au taux réduit et laisse le net correspondant', () => {
    const { summary, entities } = resolveScenarioGraph(scenario, { executiveNetSalary: 0, dividendAmount: 0 });
    const sasu = entities.find((e) => e.id === 'e')!;

    // Sans rémunération : résultat = 120 000 − 24 000 = 96 000.
    expect(sasu.metrics.fiscalResult).toBe(96_000);
    // 42 500 × 15 % + 53 500 × 25 % = 6 375 + 13 375 = 19 750.
    expect(summary.corporateTax.taxDue).toBe(isDuFromLaw(96_000));
    expect(summary.corporateTax.taxDue).toBe(19_750);
  });

  it('bascule au taux normal exactement au seuil de 42 500 €', () => {
    const sous = resolveScenarioGraph(scenario, { caHt: 66_500, executiveNetSalary: 0, dividendAmount: 0 });
    const auSeuil = resolveScenarioGraph(scenario, { caHt: 66_500 + 1, executiveNetSalary: 0, dividendAmount: 0 });

    expect(sous.summary.corporateTax.taxDue).toBe(isDuFromLaw(42_500));
    expect(sous.summary.corporateTax.taxDue).toBe(6_375);
    // L'euro suivant est imposé à 25 %, pas à 15 %.
    expect(round2(auSeuil.summary.corporateTax.taxDue - sous.summary.corporateTax.taxDue)).toBe(0.25);
  });

  it('déduit le coût complet de la rémunération avant l’IS', () => {
    const { summary, entities } = resolveScenarioGraph(scenario, { executiveNetSalary: 36_000, dividendAmount: 0 });
    const sasu = entities.find((e) => e.id === 'e')!;
    const coutTotal = round2(summary.executiveSalary.grossSalary + summary.executiveSalary.employerCharges);

    expect(sasu.metrics.fiscalResult).toBe(round2(120_000 - 24_000 - coutTotal));
    expect(summary.corporateTax.taxDue).toBe(isDuFromLaw(sasu.metrics.fiscalResult!));
    // Le net versé est bien le net demandé.
    expect(round2(summary.executiveSalary.grossSalary - summary.executiveSalary.employeeCharges)).toBeCloseTo(36_000, 0);
  });
});

describe('Dividendes de la personne physique', () => {
  const scenario = scenarioOf(
    [CLIENT, { id: 'e', label: 'SASU', entityType: 'sasu' }, PERSON],
    [flowOf('rev', 'c', 'e', 'revenue', 300_000), flowOf('div', 'e', 'p', 'dividend', 50_000)],
  );

  it('applique 12,8 % + 18,6 % au PFU, soit 31,4 % du brut', () => {
    const { summary } = resolveScenarioGraph(scenario, { dividendTaxMode: 'pfu' });
    const pfu = summary.dividendArbitrage.pfu;

    expect(pfu.irPart).toBe(round2(50_000 * 0.128));
    expect(pfu.psPart).toBe(round2(50_000 * 0.186));
    expect(pfu.totalTax).toBe(round2(50_000 * 0.314));
    expect(pfu.totalTax).toBe(15_700);
  });

  it('retient 40 % d’abattement et 6,8 points de CSG déductible au barème', () => {
    const { summary } = resolveScenarioGraph(scenario, { dividendTaxMode: 'bareme' });
    const bareme = summary.dividendArbitrage.bareme;

    // CGI art. 158, 3-2° et 154 quinquies, II.
    expect(bareme.taxableBase).toBe(round2(50_000 * (1 - 0.4 - 0.068)));
    expect(bareme.taxableBase).toBe(26_600);
    // Les prélèvements sociaux, eux, portent sur le brut.
    expect(bareme.psPart).toBe(round2(50_000 * 0.186));
  });

  it('chiffre le barème au coût réel du foyer, pas au taux marginal de départ', () => {
    const { summary } = resolveScenarioGraph(scenario, { executiveNetSalary: 0, dividendAmount: 50_000 });
    const bareme = summary.dividendArbitrage.bareme;

    // Foyer sans autre revenu, 1 part : 26 600 € au barème.
    const attendu = irBaremeFromLaw(26_600);
    // Décote comprise : (897 − 45,25 % × impôt) si l'impôt est inférieur.
    const decote = Math.min(attendu, Math.max(0, 897 - 0.4525 * attendu));
    expect(bareme.irPart).toBeCloseTo(round2(attendu - decote), 0);
    expect(bareme.irPart).toBeGreaterThan(0);
  });
});

describe('SCI à l’IR — revenus fonciers', () => {
  it('impose au barème et prélève 17,2 %, pas 18,6 %', () => {
    const scenario = scenarioOf(
      [
        { id: 'sci', label: 'SCI', entityType: 'sci_ir', inputs: { rentalIncomeHt: 30_000, interestExpenses: 6_000, otherCharges: 2_000 } },
        PERSON,
      ],
      [],
      { ownerships: [{ id: 'o', ownerId: 'p', companyId: 'sci', percent: 100 }] },
    );
    const { entities, summary } = resolveScenarioGraph(scenario, {});
    const person = entities.find((e) => e.id === 'p')!;

    // Net foncier = 30 000 − 6 000 − 2 000 = 22 000.
    // CSG 9,2 + solidarité 7,5 + CRDS 0,5 = 17,2 % (CSS L. 136-8, IV-1°).
    const levies = round2(person.metrics.personalIncomeTax! - summary.personalIncomeTax.taxDue);
    expect(levies).toBe(round2(22_000 * 0.172));
    expect(levies).toBe(3_784);
  });
});

describe('Cessions', () => {
  it('taxe la plus-value immobilière à 19 % d’IR et 17,2 % de prélèvements', () => {
    const scenario = scenarioOf(
      [PERSON, { id: 'b', label: 'Acquéreur', entityType: 'client' }],
      [flowOf('sale', 'p', 'b', 'property_sale', 300_000, {
        property: { acquisitionPrice: 200_000, acquisitionYear: 2026 },
      } as never)],
    );
    const { flows } = resolveScenarioGraph(scenario, { year: 2026 });
    const sale = flows.find((f) => f.id === 'sale')!.taxResult!;

    // Détention nulle : aucun abattement. Prix majoré de 7,5 % de frais (CGI 150 VB, II-3°).
    const majore = 200_000 * 1.075;
    const gain = 300_000 - majore;           // 85 000 €
    const ir = round2(gain * 0.19);          // CGI art. 200 B
    const ps = round2(gain * 0.172);         // CSS L. 136-8, IV-2°
    // Surtaxe des plus-values > 50 000 € : 2 % de 60 001 à 100 000 € (CGI art. 1609 nonies G).
    const surtaxe = round2(gain * 0.02);
    expect(sale.taxAmount).toBeCloseTo(ir + ps + surtaxe, 0);
    expect(sale.taxAmount).toBeCloseTo(32_470, 0);
  });

  it('taxe la cession de titres à 12,8 % d’IR et 18,6 % de prélèvements', () => {
    const scenario = scenarioOf(
      [PERSON, { id: 'b', label: 'Acquéreur', entityType: 'client' }],
      [flowOf('sale', 'p', 'b', 'share_sale', 250_000, {
        share: { acquisitionPrice: 50_000, acquisitionYear: 2020 },
      } as never)],
    );
    const { flows } = resolveScenarioGraph(scenario, { year: 2026, dividendTaxMode: 'pfu' });
    const sale = flows.find((f) => f.id === 'sale')!.taxResult!;

    const gain = 200_000;
    expect(sale.taxAmount).toBeCloseTo(round2(gain * 0.128) + round2(gain * 0.186), 0);
  });
});

describe('Holding — régime mère-fille', () => {
  it('n’impose que la quote-part de 5 % chez la mère', () => {
    const scenario = scenarioOf(
      [
        CLIENT,
        { id: 'f', label: 'Fille', entityType: 'sasu' },
        { id: 'h', label: 'Holding', entityType: 'holding_sas' },
      ],
      [flowOf('rev', 'c', 'f', 'revenue', 400_000), flowOf('div', 'f', 'h', 'dividend', 100_000)],
      { ownerships: [{ id: 'o', ownerId: 'h', companyId: 'f', percent: 100 }] },
    );
    const { flows } = resolveScenarioGraph(scenario, {});
    const dividend = flows.find((f) => f.id === 'div')!.taxResult!;

    // CGI art. 216, I : quote-part de frais et charges de 5 %, seule imposée.
    const qpfc = 100_000 * 0.05;
    // La fille est au taux normal au-delà de 42 500 € : la mère l'est aussi ici.
    expect(dividend.taxAmount).toBeLessThanOrEqual(round2(qpfc * 0.25) + 0.01);
    expect(dividend.taxAmount).toBeGreaterThan(0);
    // La friction reste très inférieure à une distribution taxée en direct.
    expect(dividend.taxAmount / 100_000).toBeLessThan(0.02);
  });
});

describe('Foyer — décote et quotient familial', () => {
  const salarie = (net: number, extra: Partial<Parameters<typeof resolveScenarioGraph>[1]> = {}) =>
    resolveScenarioGraph(
      scenarioOf(
        [CLIENT, { id: 'e', label: 'SASU', entityType: 'sasu' }, PERSON],
        [flowOf('rev', 'c', 'e', 'revenue', 400_000), flowOf('sal', 'e', 'p', 'salary', net)],
      ),
      { executiveNetSalary: net, dividendAmount: 0, ...extra },
    );

  it('annule l’impôt d’un petit revenu par la décote', () => {
    const { summary } = salarie(14_000);
    expect(summary.personalIncomeTax.taxDue).toBe(0);
    expect(summary.personalIncomeTax.decote).toBeGreaterThan(0);
  });

  it('plafonne l’avantage du quotient familial à 1 807 € par demi-part', () => {
    const sansEnfant = salarie(150_000, { parts: 2, situation: 'couple' });
    const avecEnfant = salarie(150_000, { parts: 2.5, situation: 'couple' });
    const avantage = sansEnfant.summary.personalIncomeTax.taxDue - avecEnfant.summary.personalIncomeTax.taxDue;

    expect(avantage).toBeGreaterThan(0);
    expect(avantage).toBeLessThanOrEqual(1_807 + 1);
  });

  it('remonte la TMI quand le foyer a d’autres revenus', () => {
    const seul = salarie(40_000);
    const avecConjoint = salarie(40_000, { otherIncome: 120_000 });
    expect(avecConjoint.summary.personalIncomeTax.marginalRate)
      .toBeGreaterThan(seul.summary.personalIncomeTax.marginalRate);
  });
});

describe('Contribution différentielle sur les hauts revenus', () => {
  it('porte l’imposition à 20 % du revenu, sans compter les prélèvements sociaux', () => {
    const scenario = scenarioOf(
      [CLIENT, { id: 'e', label: 'SASU', entityType: 'sasu' }, PERSON],
      [flowOf('rev', 'c', 'e', 'revenue', 2_000_000), flowOf('div', 'e', 'p', 'dividend', 900_000)],
    );
    const { entities } = resolveScenarioGraph(scenario, { year: 2026 });
    const person = entities.find((e) => e.id === 'p')!;

    // CGI art. 224 : 20 % × 900 000 = 180 000, diminué du seul impôt sur le
    // revenu — le PFU à 12,8 %, soit 115 200. Les 18,6 % de prélèvements
    // sociaux ne viennent pas en diminution (III-2°).
    expect(person.metrics.cdhrDue).toBe(round2(900_000 * 0.2 - 900_000 * 0.128));
    expect(person.metrics.cdhrDue).toBe(64_800);
  });
});
