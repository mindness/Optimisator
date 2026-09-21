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

/** Dernière vérification d'un barème (ISO `YYYY-MM-DD`). */
export const RATES_LAST_VERIFIED = RATES_AS_OF_DATES[RATES_AS_OF_DATES.length - 1];

export function formatRatesDate(iso: string): string {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR');
}
