import { describe, expect, it } from 'vitest';

import { createSlug } from '../routes/scenarios';

describe('createSlug', () => {
  it('produit la longueur demandée dans l’alphabet attendu', () => {
    for (let i = 0; i < 200; i += 1) {
      expect(createSlug()).toMatch(/^[0-9a-z]{8}$/);
    }
    expect(createSlug(12)).toHaveLength(12);
  });

  it('ne privilégie pas le début de l’alphabet (pas de biais modulo)', () => {
    // Sans rejet, 0-3 sortiraient ~14 % plus souvent que 4-35.
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i += 1) {
      for (const ch of createSlug()) counts.set(ch, (counts.get(ch) ?? 0) + 1);
    }
    const head = ['0', '1', '2', '3'].reduce((n, c) => n + (counts.get(c) ?? 0), 0) / 4;
    const tail = ['9', 'a', 'z', 'm'].reduce((n, c) => n + (counts.get(c) ?? 0), 0) / 4;
    expect(Math.abs(head - tail) / tail).toBeLessThan(0.08);
  });
});
