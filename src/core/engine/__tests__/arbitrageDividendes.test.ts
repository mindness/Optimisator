import { describe, expect, it } from 'vitest';

import { compareDividendTaxModes, calculatePersonalIncomeTax, roundMoney } from '../calculator';
import { resolveScenarioGraph } from '../graphResolver';

/** Coût réel, pour un foyer sans autre revenu, d'une base ajoutée au barème. */
const soloHousehold = (taxableBase: number) =>
  calculatePersonalIncomeTax(0, 1, { otherTaxableIncome: taxableBase }).taxDue;

describe('arbitrage PFU / barème', () => {
  it('chiffre le barème au coût réel, pas au taux marginal de départ', () => {
    // 100 000 € de dividendes chez un foyer sans salaire : la TMI de départ est
    // nulle, mais la base au barème (53,2 %) traverse les tranches.
    const flat = compareDividendTaxModes(100_000, 0);
    const real = compareDividendTaxModes(100_000, 0, soloHousehold);

    expect(flat.bareme.irPart).toBe(0);
    expect(real.bareme.irPart).toBeGreaterThan(0);
    expect(real.bareme.irPart).toBe(roundMoney(soloHousehold(real.bareme.taxableBase)));
  });

  it('ne désigne plus le barème à tort quand la base franchit les tranches', () => {
    // À TMI constante nulle, le barème paraissait gratuit et l'emportait.
    expect(compareDividendTaxModes(900_000, 0).best.mode).toBe('bareme');
    expect(compareDividendTaxModes(900_000, 0, soloHousehold).best.mode).toBe('pfu');
  });

  it('reste sur le barème quand il est réellement moins cher', () => {
    // Petit dividende, foyer sans autre revenu : la base reste sous le seuil
    // d'imposition, le barème coûte 0 € d'IR contre 12,8 % au PFU.
    const arbitrage = compareDividendTaxModes(15_000, 0, soloHousehold);
    expect(arbitrage.best.mode).toBe('bareme');
    expect(arbitrage.bareme.irPart).toBe(0);
  });

  it('coïncide avec le taux plat quand la TMI ne bouge pas', () => {
    // Foyer déjà à 45 % : chaque euro ajouté est taxé à 45 %, les deux
    // méthodes doivent donner le même chiffre.
    const highEarner = (base: number) =>
      calculatePersonalIncomeTax(0, 1, { otherTaxableIncome: 400_000 + base }).taxDue
      - calculatePersonalIncomeTax(0, 1, { otherTaxableIncome: 400_000 }).taxDue;
    const flat = compareDividendTaxModes(20_000, 0.45);
    const real = compareDividendTaxModes(20_000, 0.45, highEarner);
    expect(real.bareme.irPart).toBeCloseTo(flat.bareme.irPart, 0);
  });
});

describe('contribution différentielle — montant défalqué', () => {
  const scenario = {
    id: 'cdhr', name: 'CDHR', version: 1,
    createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z',
    entities: [
      { id: 'c', label: 'Clients', entityType: 'client' as const },
      { id: 'e', label: 'SASU', entityType: 'sasu' as const },
      { id: 'p', label: 'Dirigeant', entityType: 'person' as const },
    ],
    flows: [
      { id: 'rev', sourceId: 'c', targetId: 'e', category: 'revenue' as const, label: 'CA', amount: 2_000_000, periodicity: 'annual' as const, layer: 'treasury' as const },
      { id: 'div', sourceId: 'e', targetId: 'p', category: 'dividend' as const, label: 'Div', amount: 900_000, periodicity: 'annual' as const, layer: 'treasury' as const },
    ],
  };

  /**
   * CGI art. 224, III-2° : seuls l'impôt sur le revenu, la CEHR et les
   * prélèvements libératoires viennent en diminution des 20 %. Défalquer aussi
   * les prélèvements sociaux (18,6 % ici) annulait la contribution.
   */
  it('ne défalque que l’impôt sur le revenu, pas les prélèvements sociaux', () => {
    const resolved = resolveScenarioGraph(scenario as never, { year: 2026 });
    const person = resolved.entities.find((e) => e.id === 'p')!;

    // 20 % × 900 000 = 180 000, moins le PFU à 12,8 % (115 200) = 64 800.
    expect(resolved.summary.dividendTaxMode).toBe('pfu');
    expect(person.metrics.cdhrDue).toBe(64_800);
  });
});
