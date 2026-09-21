import { describe, expect, it } from 'vitest';

import { RATES_AS_OF_DATES, RATES_LAST_VERIFIED } from '../ratesFreshness';

describe('fraîcheur des barèmes', () => {
  it('collecte les dates asOf du moteur', () => {
    expect(RATES_AS_OF_DATES.length).toBeGreaterThan(20);
    expect(RATES_LAST_VERIFIED).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  // Garde-fou volontairement daté : ce test casse quand un barème n'a pas été revu
  // depuis 400 jours (une loi de finances est passée). Voir README « Revue annuelle des barèmes ».
  it('aucun barème vérifié il y a plus de 400 jours', () => {
    const limit = Date.now() - 400 * 24 * 3600 * 1000;
    const stale = RATES_AS_OF_DATES.filter((d) => new Date(d).getTime() < limit);
    expect(stale).toEqual([]);
  });
});
