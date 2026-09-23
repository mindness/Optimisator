import { describe, expect, it } from 'vitest';

import {
  bareOwnershipShare,
  calculateGiftTax,
  calculateHoldingAssetTax,
  calculateIfi,
  calculateShareSaleTaxCompany,
  usufructShare,
} from '../calculator';

/**
 * Montages patrimoniaux : chaque montant attendu est recalculé ici à partir du
 * texte, sans réutiliser les constantes du moteur. L'absence de NaN sur un
 * Dutreil ne disait rien de la justesse de son abattement de 75 % — c'est ce
 * que ces cas vérifient.
 */
const round2 = (n: number) => Math.round(n * 100) / 100;

/** Barème des droits en ligne directe (CGI art. 777, tableau I), réécrit ici. */
function droitsLigneDirecte(taxable: number): number {
  const brackets: Array<[number, number]> = [
    [8_072, 0.05], [12_109, 0.1], [15_932, 0.15], [552_324, 0.2],
    [902_838, 0.3], [1_805_677, 0.4], [Infinity, 0.45],
  ];
  let duty = 0;
  let floor = 0;
  for (const [ceiling, rate] of brackets) {
    if (taxable <= floor) break;
    duty += (Math.min(taxable, ceiling) - floor) * rate;
    floor = ceiling;
  }
  return round2(duty);
}

describe('Démembrement — CGI art. 669', () => {
  it('suit le barème viager par tranche d’âge de l’usufruitier', () => {
    // I : moins de 21 ans → 90 %, puis −10 points par décennie révolue.
    const attendu: Array<[number, number]> = [
      [20, 0.9], [30, 0.8], [40, 0.7], [50, 0.6],
      [60, 0.5], [70, 0.4], [80, 0.3], [90, 0.2], [95, 0.1],
    ];
    for (const [age, part] of attendu) {
      expect(usufructShare({ age })).toBeCloseTo(part, 10);
      expect(bareOwnershipShare({ age })).toBeCloseTo(1 - part, 10);
    }
  });

  it('bascule de tranche à l’âge révolu, pas un an plus tard', () => {
    // « Moins de 31 ans révolus » : 30 ans → 80 %, 31 ans → 70 %.
    expect(usufructShare({ age: 30 })).toBeCloseTo(0.8, 10);
    expect(usufructShare({ age: 31 })).toBeCloseTo(0.7, 10);
  });

  it('évalue l’usufruit à durée fixe à 23 % par période de dix ans', () => {
    // II : « sans fraction », donc toute décennie entamée compte pour une.
    expect(usufructShare({ durationYears: 10 })).toBeCloseTo(0.23, 10);
    expect(usufructShare({ durationYears: 11 })).toBeCloseTo(0.46, 10);
    expect(usufructShare({ durationYears: 30 })).toBeCloseTo(0.69, 10);
  });

  it('retient la valeur la plus faible quand l’âge et la durée sont connus', () => {
    // Un usufruit temporaire ne peut pas valoir plus que l'usufruit viager.
    expect(usufructShare({ durationYears: 30, age: 80 })).toBeCloseTo(0.3, 10);
    expect(usufructShare({ durationYears: 10, age: 25 })).toBeCloseTo(0.23, 10);
  });
});

describe('Donation — abattement, barème et Dutreil', () => {
  it('applique l’abattement de 100 000 € puis le barème en ligne directe', () => {
    const result = calculateGiftTax(300_000);
    // CGI art. 779, I puis 777 : 300 000 − 100 000 = 200 000 € taxables.
    expect(result.taxableBase).toBe(200_000);
    expect(result.duties).toBe(droitsLigneDirecte(200_000));
    // 8 072 × 5 % + 4 037 × 10 % + 3 823 × 15 % + 184 068 × 20 %.
    expect(result.duties).toBe(403.6 + 403.7 + 573.45 + 36_813.6);
    expect(result.duties).toBe(38_194.35);
  });

  it('ne taxe rien tant que la valeur reste sous l’abattement', () => {
    expect(calculateGiftTax(80_000).duties).toBe(0);
  });

  it('tient compte d’un abattement déjà consommé depuis moins de quinze ans', () => {
    // CGI art. 784 : l'abattement se reconstitue tous les quinze ans.
    const result = calculateGiftTax(300_000, { previousAbatementUsed: 60_000 });
    expect(result.taxableBase).toBe(300_000 - (100_000 - 60_000));
    expect(result.duties).toBe(droitsLigneDirecte(260_000));
  });

  it('exonère 75 % de la valeur sous pacte Dutreil, avant l’abattement', () => {
    // CGI art. 787 B : exonération de 75 %, puis abattement personnel.
    const result = calculateGiftTax(2_000_000, { dutreil: true });
    const apresDutreil = 2_000_000 * 0.25;
    expect(result.taxableBase).toBe(apresDutreil - 100_000);
    expect(result.duties).toBe(droitsLigneDirecte(400_000));
    // Sans le pacte, les droits seraient bien plus lourds.
    expect(result.duties).toBeLessThan(calculateGiftTax(2_000_000).duties / 3);
  });

  it('cumule Dutreil et donation en nue-propriété', () => {
    // Donateur de 60 ans : nue-propriété = 50 % (art. 669, I).
    const result = calculateGiftTax(2_000_000, { dutreil: true, reserveUsufruit: { age: 60 } });
    const transmis = 2_000_000 * 0.5;
    const apresDutreil = transmis * 0.25;
    expect(result.taxableBase).toBe(apresDutreil - 100_000);
    expect(result.duties).toBe(droitsLigneDirecte(150_000));
  });
});

describe('IFI — CGI art. 964 et 977', () => {
  it('n’assujettit pas un patrimoine au seuil de 1 300 000 €', () => {
    expect(calculateIfi(1_300_000).taxable).toBe(false);
    expect(calculateIfi(1_300_000).due).toBe(0);
  });

  it('impose dès le premier euro au-delà, mais à partir de 800 000 €', () => {
    // Le barème repart à 800 000 € une fois le seuil franchi (art. 977, 1).
    const result = calculateIfi(1_400_000);
    expect(result.taxable).toBe(true);
    // 800 000 → 1 300 000 à 0,5 % = 2 500 ; 1 300 000 → 1 400 000 à 0,7 % = 700.
    const brut = round2(500_000 * 0.005 + 100_000 * 0.007);
    expect(result.grossDuty).toBe(brut);
    expect(brut).toBe(3_200);
  });

  it('applique la décote entre 1 300 000 et 1 400 000 €', () => {
    // Art. 977, 2 : 17 500 € − 1,25 % de la valeur nette taxable.
    const result = calculateIfi(1_350_000);
    expect(result.decote).toBe(round2(17_500 - 0.0125 * 1_350_000));
    expect(result.due).toBe(round2(result.grossDuty - result.decote));
    expect(result.due).toBeGreaterThanOrEqual(0);
  });

  it('éteint la décote au-delà de 1 400 000 €', () => {
    expect(calculateIfi(1_500_000).decote).toBe(0);
  });
});

describe('Cession de titres par une société — régime des titres de participation', () => {
  it('n’impose que la quote-part de 12 % après deux ans et 5 % du capital', () => {
    // CGI art. 219, I-a quinquies : taux de 0 %, quote-part de 12 % du brut.
    const result = calculateShareSaleTaxCompany(1_000_000, 200_000, { holdingYears: 3, stakePercent: 100 });
    const gain = 800_000;
    expect(result.participationRegime).toBe(true);
    expect(result.qpfc).toBe(round2(gain * 0.12));
    expect(result.taxableAddition).toBe(96_000);
  });

  it('impose la plus-value en totalité quand les conditions ne sont pas réunies', () => {
    const tropTot = calculateShareSaleTaxCompany(1_000_000, 200_000, { holdingYears: 1, stakePercent: 100 });
    const tropPeu = calculateShareSaleTaxCompany(1_000_000, 200_000, { holdingYears: 3, stakePercent: 2 });
    for (const result of [tropTot, tropPeu]) {
      expect(result.participationRegime).toBe(false);
      expect(result.taxableAddition).toBe(800_000);
    }
  });
});

describe('Taxe sur les actifs non professionnels des holdings — CGI art. 235 ter C', () => {
  const base = {
    totalAssets: 20_000_000,
    nonProfessionalAssets: 12_000_000,
    individualControlPercent: 100,
    passiveIncome: 900_000,
    totalIncome: 1_000_000,
  };

  it('taxe les actifs non professionnels à 2 % quand les trois conditions sont réunies', () => {
    const result = calculateHoldingAssetTax(base);
    // Seuil de 5 M€ d'actifs, contrôle > 50 %, revenus passifs > 50 %.
    expect(result.due).toBeGreaterThan(0);
    expect(result.taxableAssets).toBe(12_000_000);
  });

  it('ne s’applique pas si la holding n’est pas contrôlée à plus de 50 %', () => {
    expect(calculateHoldingAssetTax({ ...base, individualControlPercent: 40 }).due).toBe(0);
  });

  it('ne s’applique pas si les revenus passifs restent minoritaires', () => {
    expect(calculateHoldingAssetTax({ ...base, passiveIncome: 100_000 }).due).toBe(0);
  });

  it('ne s’applique pas sous le seuil de 5 millions d’euros d’actifs', () => {
    expect(calculateHoldingAssetTax({
      ...base, totalAssets: 4_000_000, nonProfessionalAssets: 3_000_000,
    }).due).toBe(0);
  });

  it('déduit la dette d’acquisition de l’assiette', () => {
    const avecDette = calculateHoldingAssetTax({ ...base, deductibleDebt: 2_000_000 });
    expect(avecDette.taxableAssets).toBe(10_000_000);
    expect(avecDette.due).toBeLessThan(calculateHoldingAssetTax(base).due);
  });
});
