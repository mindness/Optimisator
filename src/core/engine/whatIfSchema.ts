import { z } from 'zod';

import type { WhatIfInputs } from './graphResolver';

/**
 * Les hypothèses arrivent de trois sources hors de notre contrôle : un lien
 * partagé (`#s=`), un fichier importé, et le brouillon du navigateur — qui
 * peut être un ancien format ou un état corrompu. Sans garde, une valeur non
 * numérique traverse le moteur et ressort en `NaN` sur toutes les tuiles ;
 * persistée, elle survit au rechargement. On valide donc au point d'entrée.
 */
const money = z.number().finite();
/** Un compte de personnes ou de parts : positif et borné, jamais fractionné à l'excès. */
const count = z.number().finite().nonnegative();

export const whatIfInputsSchema: z.ZodType<WhatIfInputs> = z.object({
  year: z.number().int().min(1900).max(2200).optional(),
  exerciseDays: z.number().finite().positive().max(1_000).optional(),
  perContribution: money.optional(),
  dependents: count.optional(),
  caHt: money.optional(),
  caMultiplier: money.optional(),
  expensesHt: money.optional(),
  executiveNetSalary: money.optional(),
  dividendAmount: money.optional(),
  holdingDividendAmount: money.optional(),
  sciRentHt: money.optional(),
  parts: count.optional(),
  situation: z.enum(['single', 'couple']).optional(),
  otherIncome: money.optional(),
  dividendTaxMode: z.enum(['pfu', 'bareme', 'auto']).optional(),
  structureCosts: z.record(z.string(), money).optional(),
  capitalPrimesAndCca: money.optional(),
}).strict();

/**
 * Retient les hypothèses exploitables et écarte le reste, plutôt que de rejeter
 * tout le scénario : un lien dont une hypothèse est illisible reste ouvrable,
 * il repart simplement des valeurs du schéma.
 */
export function parseWhatIfInputs(value: unknown): WhatIfInputs | null {
  if (!value || typeof value !== 'object') return null;
  const direct = whatIfInputsSchema.safeParse(value);
  if (direct.success) return direct.data;

  const kept: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (whatIfInputsSchema.safeParse({ [key]: entry }).success) kept[key] = entry;
  }
  const salvaged = whatIfInputsSchema.safeParse(kept);
  return salvaged.success ? salvaged.data : null;
}
