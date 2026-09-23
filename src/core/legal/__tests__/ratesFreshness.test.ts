import { describe, expect, it } from 'vitest';

import {
  RATES_AS_OF_DATES,
  RATES_NEWEST_SOURCE,
  RATES_OLDEST_SOURCE,
  RATES_VERIFIED_ON,
} from '../ratesFreshness';

describe('fraîcheur des barèmes', () => {
  it('collecte les dates asOf du moteur', () => {
    expect(RATES_AS_OF_DATES.length).toBeGreaterThan(20);
    for (const date of [RATES_OLDEST_SOURCE, RATES_NEWEST_SOURCE, RATES_VERIFIED_ON]) {
      expect(date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  // Garde-fou volontairement daté : ce test casse quand un barème n'a pas été revu
  // depuis 400 jours (une loi de finances est passée). Voir README « Revue annuelle des barèmes ».
  it('aucun barème vérifié il y a plus de 400 jours', () => {
    const limit = Date.now() - 400 * 24 * 3600 * 1000;
    const stale = RATES_AS_OF_DATES.filter((d) => new Date(d).getTime() < limit);
    expect(stale).toEqual([]);
  });

  // La date affichée à l'utilisateur est une affirmation : elle ne doit jamais
  // vieillir en silence, ni prétendre couvrir une source plus récente qu'elle.
  it('la revue d’ensemble date de moins de 400 jours', () => {
    const age = Date.now() - new Date(RATES_VERIFIED_ON).getTime();
    expect(age).toBeLessThan(400 * 24 * 3600 * 1000);
  });

  it('la revue d’ensemble ne devance pas la source la plus récente', () => {
    expect(RATES_VERIFIED_ON >= RATES_NEWEST_SOURCE).toBe(true);
  });
});
