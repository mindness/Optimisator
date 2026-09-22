/**
 * Lot 2026 : contribution différentielle (art. 224), taxe sur les holdings
 * patrimoniales (art. 235 ter C), amendement Charasse (art. 223 B), PER
 * (art. 163 quatervicies), mécénat (art. 238 bis) et plus-value immobilière
 * des particuliers (art. 150 U à 150 VH, 200 B, 1609 nonies G).
 */
import { describe, expect, it } from 'vitest';

import type { ScenarioState } from '../../types';
import {
  calculateCdhr,
  calculateCharasseReintegration,
  calculateHoldingAssetTax,
  calculateMecenat,
  calculatePerDeduction,
  calculatePropertyGain,
  propertyAllowanceIncomeTax,
  propertyAllowanceSocialLevies,
  propertySurtax,
} from '../calculator';
import { resolveScenarioGraph } from '../graphResolver';
import {
  CDHR_RATE,
  HOLDING_ASSET_TAX_RATE,
  MECENAT_CAP_FLOOR_EUR,
  PROPERTY_GAIN_IR_RATE,
  PFU_PS_RATE,
} from '../taxRules';
import { PASS_2026_EUR } from '../tnsRules';

const NOW = '2026-09-22T00:00:00.000Z';

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

/* ------------------------------------------------ CDHR (art. 224) ------- */

describe('Contribution différentielle sur les hauts revenus', () => {
  it('ne s’applique pas sous le seuil', () => {
    expect(calculateCdhr(250_000, 40_000).liable).toBe(false);
    expect(calculateCdhr(250_000, 40_000).due).toBe(0);
    expect(calculateCdhr(400_000, 40_000, { situation: 'couple' }).liable).toBe(false);
  });

  it('porte l’imposition au plancher de 20 % du revenu de référence', () => {
    // 1 M€ de revenu, 120 000 € d'impôt payé : le plancher est de 200 000 €.
    const cdhr = calculateCdhr(1_000_000, 120_000);

    expect(cdhr.floorTax).toBe(1_000_000 * CDHR_RATE.value);
    expect(cdhr.smoothing).toBe(0);
    expect(cdhr.due).toBe(80_000);
  });

  it('ne réclame rien quand l’impôt déjà dû dépasse le plancher', () => {
    expect(calculateCdhr(1_000_000, 350_000).due).toBe(0);
  });

  it('lisse l’entrée dans le dispositif entre 250 000 et 330 000 €', () => {
    const justOver = calculateCdhr(260_000, 0);
    const wellOver = calculateCdhr(400_000, 0);

    // À 260 000 €, le lissage retranche presque tout : 52 000 − 82,5 % × 10 000.
    expect(justOver.smoothing).toBeCloseTo(52_000 - 0.825 * 10_000, 2);
    expect(justOver.due).toBeCloseTo(8_250, 2);
    expect(wellOver.smoothing).toBe(0);
    expect(justOver.due).toBeLessThan(wellOver.due);
  });

  it('majore l’impôt retenu des abattements de foyer', () => {
    const single = calculateCdhr(1_000_000, 120_000);
    const family = calculateCdhr(1_000_000, 120_000, { situation: 'couple', dependents: 2 });

    // Couple : seuil doublé, et 12 500 € + 2 × 1 500 € d'abattement forfaitaire.
    expect(family.creditedTax).toBe(120_000 + 12_500 + 3_000);
    expect(family.due).toBe(single.due - 15_500);
  });

  it('s’applique au dirigeant dans le moteur', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
        { id: 'p', label: 'Dirigeant', entityType: 'person' },
      ],
      [
        flow('rev', 'c', 'e', 'revenue', 2_000_000),
        flow('div', 'e', 'p', 'dividend', 900_000),
      ],
    );
    const resolved = resolveScenarioGraph(scenario, { year: 2026 });
    const person = resolved.entities.find((entity) => entity.id === 'p')!;

    expect(person.metrics.cdhrDue!).toBeGreaterThan(0);
    expect(resolved.warnings.some((w) => w.includes('contribution différentielle'))).toBe(true);
  });
});

/* -------------------------- Taxe holdings (art. 235 ter C) --------------- */

describe('Taxe sur les actifs non professionnels des holdings', () => {
  const liable = {
    totalAssets: 8_000_000,
    nonProfessionalAssets: 2_000_000,
    individualControlPercent: 100,
    passiveIncome: 300_000,
    totalIncome: 400_000,
  };

  it('taxe à 20 % quand les trois conditions sont réunies', () => {
    const tax = calculateHoldingAssetTax(liable);

    expect(tax.liable).toBe(true);
    expect(tax.due).toBe(2_000_000 * HOLDING_ASSET_TAX_RATE.value);
  });

  it('déduit les dettes d’acquisition de l’assiette', () => {
    const tax = calculateHoldingAssetTax({ ...liable, deductibleDebt: 500_000 });

    expect(tax.taxableAssets).toBe(1_500_000);
    expect(tax.due).toBe(300_000);
  });

  it('exige les trois conditions, pas deux', () => {
    expect(calculateHoldingAssetTax({ ...liable, totalAssets: 4_000_000 }).liable).toBe(false);
    expect(calculateHoldingAssetTax({ ...liable, individualControlPercent: 40 }).liable).toBe(false);
    // Revenus passifs à 50 % exactement : le texte exige « plus de 50 % ».
    expect(calculateHoldingAssetTax({ ...liable, passiveIncome: 200_000 }).liable).toBe(false);
  });

  it('se déclenche dans le moteur et sort de la trésorerie', () => {
    const scenario = base(
      [
        { id: 'p', label: 'Dirigeant', entityType: 'person' },
        { id: 'f', label: 'SASU', entityType: 'sasu' },
        { id: 'c', label: 'Clients', entityType: 'client' },
        {
          id: 'h', label: 'Holding', entityType: 'holding_sas',
          inputs: { totalAssets: 8_000_000, nonProfessionalAssets: 2_000_000, openingTreasury: 1_000_000 },
        },
      ],
      [flow('rev', 'c', 'f', 'revenue', 100_000), flow('div', 'f', 'h', 'dividend', 400_000)],
      { ownerships: [{ id: 'o', ownerId: 'p', companyId: 'h', percent: 100 }] },
    );
    const resolved = resolveScenarioGraph(scenario, { year: 2026 });
    const holding = resolved.entities.find((entity) => entity.id === 'h')!;

    expect(holding.metrics.holdingAssetTax).toBe(400_000);
    expect(resolved.warnings.some((w) => w.includes('235 ter C'))).toBe(true);
  });
});

/* ----------------------- Amendement Charasse (art. 223 B) ---------------- */

describe('Amendement Charasse', () => {
  const input = { acquisitionPrice: 1_500_000, groupAverageDebt: 2_000_000, financialCharges: 80_000 };

  it('réintègre les charges au prorata du prix sur les dettes du groupe', () => {
    const first = calculateCharasseReintegration({ ...input, yearIndex: 0 });

    expect(first.ratio).toBeCloseTo(0.75, 5);
    expect(first.reintegrated).toBe(60_000);
    expect(first.active).toBe(true);
  });

  it('court neuf exercices, puis s’arrête', () => {
    expect(calculateCharasseReintegration({ ...input, yearIndex: 8 }).active).toBe(true);
    expect(calculateCharasseReintegration({ ...input, yearIndex: 9 }).active).toBe(false);
    expect(calculateCharasseReintegration({ ...input, yearIndex: 9 }).reintegrated).toBe(0);
  });

  it('plafonne le ratio à 1 quand le prix dépasse les dettes', () => {
    expect(calculateCharasseReintegration({ ...input, groupAverageDebt: 500_000, yearIndex: 0 }).ratio).toBe(1);
  });

  it('ne s’applique qu’au rachat à soi-même dans un groupe intégré', () => {
    const scenario = base(
      [
        { id: 'p', label: 'Dirigeant', entityType: 'person' },
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'b', label: 'Banque', entityType: 'bank' },
        { id: 'f', label: 'SASU', entityType: 'sasu' },
        { id: 'h', label: 'Holding', entityType: 'holding_sas' },
      ],
      [
        flow('rev', 'c', 'f', 'revenue', 500_000),
        flow('loan', 'h', 'b', 'loan_payment', 0, { loan: { principal: 1_000_000, rate: 0.05, years: 10, type: 'amortissable' } }),
        flow('rachat', 'p', 'h', 'share_sale', 1_000_000, { share: { acquisitionPrice: 100_000, acquisitionYear: 2015, soldPercent: 100 } }),
      ],
      {
        options: { integrationFiscale: true },
        ownerships: [
          { id: 'o1', ownerId: 'p', companyId: 'h', percent: 100 },
          { id: 'o2', ownerId: 'h', companyId: 'f', percent: 100 },
        ],
      },
    );
    const withIntegration = resolveScenarioGraph(scenario, { year: 2026 });
    const without = resolveScenarioGraph({ ...scenario, options: {} }, { year: 2026 });

    expect(withIntegration.warnings.some((w) => w.includes('Amendement Charasse'))).toBe(true);
    expect(without.warnings.some((w) => w.includes('Amendement Charasse'))).toBe(false);
    expect(without.warnings.some((w) => w.includes('Rachat à soi-même détecté hors intégration'))).toBe(true);
    // La réintégration alourdit le résultat d'ensemble, donc l'IS du groupe.
    expect(withIntegration.carryOut.charasse.rachat!.yearIndex).toBe(1);
  });
});

/* ------------------------------ PER (art. 163 quatervicies) ------------- */

describe('Déduction PER', () => {
  it('plafonne à 10 % des revenus d’activité, dans la limite de huit PASS', () => {
    const plafond = calculatePerDeduction(50_000, 1_000_000);

    expect(plafond.annualCeiling).toBe(0.1 * 8 * PASS_2026_EUR.value);
    expect(plafond.deducted).toBe(plafond.annualCeiling < 50_000 ? plafond.annualCeiling : 50_000);
  });

  it('garantit un plancher de 10 % du PASS', () => {
    const petit = calculatePerDeduction(10_000, 0);

    expect(petit.annualCeiling).toBe(0.1 * PASS_2026_EUR.value);
    expect(petit.deducted).toBe(0.1 * PASS_2026_EUR.value);
  });

  it('ajoute le report des plafonds non utilisés', () => {
    const avecReport = calculatePerDeduction(30_000, 100_000, { carriedCeiling: 20_000 });

    expect(avecReport.ceiling).toBe(10_000 + 20_000);
    expect(avecReport.deducted).toBe(30_000);
    expect(avecReport.unusedCeiling).toBe(0);
  });

  it('reporte la fraction inutilisée', () => {
    const rien = calculatePerDeduction(0, 100_000);

    expect(rien.deducted).toBe(0);
    expect(rien.unusedCeiling).toBe(10_000);
  });

  it('réduit l’impôt sur le revenu du dirigeant et se reporte', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
        { id: 'p', label: 'Dirigeant', entityType: 'person' },
      ],
      [flow('rev', 'c', 'e', 'revenue', 300_000), flow('sal', 'e', 'p', 'salary', 90_000)],
    );
    const sans = resolveScenarioGraph(scenario, { year: 2026 });
    const avec = resolveScenarioGraph(scenario, { year: 2026, perContribution: 20_000 });
    const ir = (result: typeof sans) => result.entities.find((entity) => entity.id === 'p')!.metrics.personalIncomeTax!;

    expect(ir(avec)).toBeLessThan(ir(sans));
    expect(avec.warnings.some((w) => w.includes('PER'))).toBe(true);
    expect(sans.carryOut.perCeiling.p).toBeGreaterThan(0);
  });
});

/* --------------------------- Mécénat (art. 238 bis) --------------------- */

describe('Mécénat d’entreprise', () => {
  it('plafonne les versements à 20 000 € ou 5 ‰ du chiffre d’affaires', () => {
    expect(calculateMecenat(50_000, 1_000_000).cap).toBe(MECENAT_CAP_FLOOR_EUR.value);
    expect(calculateMecenat(50_000, 10_000_000).cap).toBe(50_000);
  });

  it('réduit l’impôt de 60 % des versements retenus', () => {
    const don = calculateMecenat(20_000, 10_000_000);

    expect(don.retained).toBe(20_000);
    expect(don.reduction).toBe(12_000);
    expect(don.carriedForward).toBe(0);
  });

  it('reporte l’excédent au-delà du plafond', () => {
    const don = calculateMecenat(50_000, 1_000_000);

    expect(don.retained).toBe(20_000);
    expect(don.carriedForward).toBe(30_000);
  });

  it('bascule à 40 % au-delà de 2 M€ de versements', () => {
    const don = calculateMecenat(3_000_000, 2_000_000_000);

    expect(don.reduction).toBe(2_000_000 * 0.6 + 1_000_000 * 0.4);
  });

  it('s’impute sur l’IS sans le rendre négatif, et sort de la trésorerie', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'v', label: 'Fournisseurs', entityType: 'vendor' },
        { id: 'e', label: 'SASU', entityType: 'sasu', inputs: { donations: 20_000 } },
      ],
      [flow('rev', 'c', 'e', 'revenue', 200_000), flow('exp', 'e', 'v', 'expense', 50_000)],
    );
    const sans = resolveScenarioGraph({ ...scenario, entities: scenario.entities.map((e) => e.id === 'e' ? { ...e, inputs: {} } : e) }, { year: 2026 });
    const avec = resolveScenarioGraph(scenario, { year: 2026 });
    const company = (result: typeof avec) => result.entities.find((entity) => entity.id === 'e')!;

    // Le don n'est pas déductible : le résultat fiscal ne bouge pas, seul l'impôt baisse.
    expect(company(avec).metrics.fiscalResult).toBe(company(sans).metrics.fiscalResult);
    expect(company(avec).metrics.mecenatReduction).toBe(12_000);
    expect(company(avec).metrics.corporateTax!).toBe(company(sans).metrics.corporateTax! - 12_000);
    expect(avec.warnings.some((w) => w.includes('mécénat'))).toBe(true);
  });
});

/* ------------- Plus-value immobilière des particuliers ------------------ */

describe('Plus-value immobilière des particuliers', () => {
  it('applique les deux barèmes d’abattement, 22 ans pour l’IR et 30 ans pour les PS', () => {
    expect(propertyAllowanceIncomeTax(5)).toBe(0);
    expect(propertyAllowanceIncomeTax(6)).toBeCloseTo(0.06, 5);
    expect(propertyAllowanceIncomeTax(21)).toBeCloseTo(0.96, 5);
    expect(propertyAllowanceIncomeTax(22)).toBe(1);

    expect(propertyAllowanceSocialLevies(21)).toBeCloseTo(0.264, 5);
    expect(propertyAllowanceSocialLevies(22)).toBeCloseTo(0.28, 5);
    expect(propertyAllowanceSocialLevies(30)).toBe(1);
  });

  it('calcule la surtaxe au-delà de 50 000 € de plus-value', () => {
    expect(propertySurtax(50_000)).toBe(0);
    expect(propertySurtax(80_000)).toBe(1_600);
    // Tranche lissée : 2 % × 55 000 − (60 000 − 55 000) / 20.
    expect(propertySurtax(55_000)).toBeCloseTo(0.02 * 55_000 - 5_000 / 20, 2);
    expect(propertySurtax(300_000)).toBe(18_000);
  });

  it('exonère la résidence principale et les petites cessions', () => {
    expect(calculatePropertyGain(500_000, 200_000, { principalResidence: true }).totalTax).toBe(0);
    expect(calculatePropertyGain(12_000, 5_000).exempt).toBe(true);
    expect(calculatePropertyGain(500_000, 200_000, { principalResidence: true }).exemptionReason).toContain('150 U');
  });

  it('majore le prix des frais et travaux au forfait', () => {
    const gain = calculatePropertyGain(400_000, 200_000, { holdingYears: 10 });

    // 200 000 + 7,5 % de frais + 15 % de travaux = 245 000.
    expect(gain.adjustedAcquisitionPrice).toBe(245_000);
    expect(gain.grossGain).toBe(155_000);
  });

  it('réintègre les amortissements du meublé au prix d’acquisition', () => {
    const sans = calculatePropertyGain(350_000, 250_000, { holdingYears: 10 });
    const avec = calculatePropertyGain(350_000, 250_000, { holdingYears: 10, deductedAmortization: 60_000 });

    expect(avec.grossGain).toBe(sans.grossGain + 60_000);
    expect(avec.totalTax).toBeGreaterThan(sans.totalTax);
    expect(avec.breakdown.some((line) => line.formula === 'CGI art. 150 VB, III')).toBe(true);
  });

  it('chiffre l’impôt et les prélèvements sociaux séparément', () => {
    const gain = calculatePropertyGain(400_000, 200_000, { holdingYears: 10, worksAmount: 0 });

    expect(gain.incomeTax).toBeCloseTo(gain.taxableIncomeTax * PROPERTY_GAIN_IR_RATE.value, 2);
    expect(gain.socialLevies).toBeCloseTo(gain.taxableSocialLevies * PFU_PS_RATE.value, 1);
    // Les PS s'abattent moins vite que l'IR : leur base est plus large.
    expect(gain.taxableSocialLevies).toBeGreaterThan(gain.taxableIncomeTax);
  });

  it('se trace dans le moteur et alimente la trésorerie du cédant', () => {
    const scenario = base(
      [
        { id: 'c', label: 'Clients', entityType: 'client' },
        { id: 'e', label: 'SASU', entityType: 'sasu' },
        { id: 'p', label: 'Vendeur', entityType: 'person' },
        { id: 'a', label: 'Acquéreur', entityType: 'person' },
      ],
      [
        flow('rev', 'c', 'e', 'revenue', 50_000),
        flow('vente', 'p', 'a', 'property_sale', 400_000, { property: { acquisitionPrice: 200_000, acquisitionYear: 2016 } }),
      ],
    );
    const resolved = resolveScenarioGraph(scenario, { year: 2026 });
    const vente = resolved.flows.find((f) => f.id === 'vente')!;

    expect(vente.taxResult!.taxAmount).toBeGreaterThan(0);
    expect(resolved.entities.find((e) => e.id === 'p')!.metrics.netPersonalCash!).toBeGreaterThan(300_000);
    expect(resolved.entities.find((e) => e.id === 'a')!.metrics.netPersonalCash!).toBeCloseTo(-400_000, 2);
    expect(resolved.warnings.some((w) => w.includes('plus-value immobilière'))).toBe(true);
  });
});
