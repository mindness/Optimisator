import * as taxRules from '../engine/taxRules';
import * as tnsRules from '../engine/tnsRules';

/** Toutes les dates `asOf` portées par les barèmes du moteur, y compris imbriquées. */
function collectAsOf(value: unknown, out: string[] = []): string[] {
  if (value && typeof value === 'object') {
    for (const [key, child] of Object.entries(value)) {
      if (key === 'asOf' && typeof child === 'string') out.push(child);
      else collectAsOf(child, out);
    }
  }
  return out;
}

export const RATES_AS_OF_DATES: readonly string[] = collectAsOf([taxRules, tnsRules]).sort();

/** Date de la source légale la plus ancienne encore utilisée (ISO `YYYY-MM-DD`). */
export const RATES_OLDEST_SOURCE = RATES_AS_OF_DATES[0]!;

/** Date de la source légale la plus récente (ISO `YYYY-MM-DD`). */
export const RATES_NEWEST_SOURCE = RATES_AS_OF_DATES[RATES_AS_OF_DATES.length - 1]!;

/**
 * Date de la dernière revue d'ensemble des barèmes — saisie à la main, pas
 * déduite des `asOf`.
 *
 * `asOf` date la *source* : l'arrêté PASS 2026 est du 22/12/2025 et reste
 * parfaitement à jour. Prendre le maximum de ces dates donnait une affirmation
 * de fraîcheur systématiquement optimiste — celle du taux le plus récemment
 * publié, pas celle du dernier contrôle. Cette constante est la seule qui
 * réponde à « quand a-t-on vérifié que tout cela tient encore ? ».
 *
 * À remonter à chaque revue (voir README « Revue annuelle des barèmes »).
 */
export const RATES_VERIFIED_ON = '2026-09-23';

export function formatRatesDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR');
}
