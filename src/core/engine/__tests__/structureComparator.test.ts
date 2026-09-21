import { describe, expect, it } from 'vitest';

import {
  STRUCTURE_BLIND_SPOTS,
  compareStructures,
  type StructureId,
} from '../structureComparator';
import { MICRO_BRACKETS_2026 } from '../taxRules';

function outcome(comparison: ReturnType<typeof compareStructures>, id: StructureId) {
  const found = comparison.outcomes.find((o) => o.id === id);
  expect(found, `structure ${id} absente du comparatif`).toBeDefined();
  return found!;
}

describe('compareStructures — périmètre', () => {
  const base = compareStructures({ caHt: 120_000, expensesHt: 20_000 });

  it('évalue les cinq structures et les classe par net décroissant', () => {
    expect(base.outcomes).toHaveLength(5);
    const eligible = base.outcomes.filter((o) => o.eligible);
    for (let i = 1; i < eligible.length; i++) {
      expect(eligible[i - 1]!.netPersonal).toBeGreaterThanOrEqual(eligible[i]!.netPersonal);
    }
    expect(base.best.netPersonal).toBe(eligible[0]!.netPersonal);
    expect(base.gainOverRunnerUp).toBeGreaterThanOrEqual(0);
  });

  it('expose ses angles morts, condition de lecture du classement', () => {
    expect(base.blindSpots).toEqual([...STRUCTURE_BLIND_SPOTS]);
    expect(base.blindSpots.length).toBeGreaterThan(5);
  });

  it('ne laisse jamais le net personnel dépasser le disponible', () => {
    for (const o of base.outcomes) {
      expect(o.netPersonal).toBeLessThanOrEqual(o.available);
      expect(o.effectiveRate).toBeGreaterThan(0);
    }
  });
});

describe('compareStructures — seuils et éligibilité', () => {
  it('exclut le micro au-delà du plafond de sa catégorie', () => {
    const ceiling = MICRO_BRACKETS_2026.bnc.ceilingEur;
    const under = outcome(compareStructures({ caHt: ceiling - 1_000 }), 'micro');
    const over = outcome(compareStructures({ caHt: ceiling + 1_000 }), 'micro');

    expect(under.eligible).toBe(true);
    expect(over.eligible).toBe(false);
    expect(over.warnings.some((w) => w.includes('Plafond'))).toBe(true);
    // Une structure inéligible ne peut pas être recommandée.
    expect(compareStructures({ caHt: ceiling + 1_000 }).best.id).not.toBe('micro');
  });

  it('classe le micro devant le réel à faibles charges, derrière à fortes charges', () => {
    const lean = compareStructures({ caHt: 60_000, expensesHt: 0 });
    const heavy = compareStructures({ caHt: 60_000, expensesHt: 35_000 });

    expect(outcome(lean, 'micro').netPersonal).toBeGreaterThan(outcome(lean, 'ei_ir').netPersonal);
    expect(outcome(heavy, 'micro').netPersonal).toBeLessThan(outcome(heavy, 'ei_ir').netPersonal);
  });
});

describe('compareStructures — arbitrages structurants', () => {
  it('la holding en redistribution intégrale coûte la friction QPFC', () => {
    const comparison = compareStructures({ caHt: 200_000, expensesHt: 30_000 });
    const sasu = outcome(comparison, 'sasu');
    const holding = outcome(comparison, 'sasu_holding');

    expect(holding.netPersonal).toBeLessThanOrEqual(sasu.netPersonal);
    expect(holding.warnings.some((w) => w.includes('réinvesti'))).toBe(true);
  });

  it('applique la règle des 10 % aux dividendes du gérant TNS', () => {
    const smallCapital = outcome(
      compareStructures({ caHt: 150_000, capitalPrimesAndCca: 1_000 }),
      'eurl_is',
    );
    const largeCapital = outcome(
      compareStructures({ caHt: 150_000, capitalPrimesAndCca: 400_000 }),
      'eurl_is',
    );

    expect(largeCapital.netPersonal).toBeGreaterThanOrEqual(smallCapital.netPersonal);
    if (smallCapital.dividendGross > 0) {
      expect(smallCapital.warnings.some((w) => w.includes('L131-6'))).toBe(true);
    }
  });

  it('retient pour chaque structure IS son propre optimum de partage', () => {
    const comparison = compareStructures({ caHt: 180_000, expensesHt: 20_000 });
    for (const id of ['eurl_is', 'sasu', 'sasu_holding'] as const) {
      const best = outcome(comparison, id);
      expect(best.salaryRatio).toBeGreaterThanOrEqual(0);
      expect(best.salaryRatio).toBeLessThanOrEqual(1);
      // L'optimum retenu bat les extrêmes imposés.
      const forced = compareStructures({ caHt: 180_000, expensesHt: 20_000, dividendTaxMode: 'pfu' });
      expect(best.netPersonal).toBeGreaterThanOrEqual(
        outcome(forced, id).netPersonal - 1,
      );
    }
  });

  it('le mode auto ne fait jamais moins bien que le PFU imposé', () => {
    const auto = compareStructures({ caHt: 150_000, expensesHt: 10_000 });
    const pfu = compareStructures({ caHt: 150_000, expensesHt: 10_000, dividendTaxMode: 'pfu' });

    expect(auto.best.netPersonal).toBeGreaterThanOrEqual(pfu.best.netPersonal - 1);
  });

  it('le quotient familial remonte le net de toutes les structures', () => {
    const single = compareStructures({ caHt: 120_000, expensesHt: 10_000 });
    const family = compareStructures({
      caHt: 120_000,
      expensesHt: 10_000,
      parts: 3,
      situation: 'couple',
    });

    expect(family.best.netPersonal).toBeGreaterThan(single.best.netPersonal);
    expect(family.best.marginalRate).toBeLessThanOrEqual(single.best.marginalRate);
  });

  it('les revenus du foyer hors structure ne réduisent jamais l’impôt', () => {
    const alone = compareStructures({ caHt: 90_000 });
    const withOther = compareStructures({ caHt: 90_000, otherTaxableIncome: 60_000 });

    expect(withOther.best.personalIncomeTax).toBeGreaterThan(alone.best.personalIncomeTax);
    expect(withOther.best.marginalRate).toBeGreaterThanOrEqual(alone.best.marginalRate);
  });

  it('reste défini sur un CA nul', () => {
    const empty = compareStructures({ caHt: 0 });
    for (const o of empty.outcomes) {
      expect(o.netPersonal).toBe(0);
      expect(o.effectiveRate).toBe(0);
    }
  });

  it('un coût de structure ne pénalise que la structure concernée', () => {
    const inputs = { caHt: 120_000, expensesHt: 20_000 };
    const net = (c: ReturnType<typeof compareStructures>, id: string) => c.outcomes.find((o) => o.id === id)!.netPersonal;
    const base = compareStructures(inputs);
    const costed = compareStructures({ ...inputs, structureCosts: { sasu: 3_000 } });
    expect(net(costed, 'sasu')).toBeLessThan(net(base, 'sasu'));
    // Charge déductible : la perte de net reste inférieure au coût saisi.
    expect(net(base, 'sasu') - net(costed, 'sasu')).toBeLessThan(3_000);
    expect(net(costed, 'eurl_is')).toBe(net(base, 'eurl_is'));
    expect(net(costed, 'micro')).toBe(net(base, 'micro'));
  });
});
