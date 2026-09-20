import { z } from 'zod';

/** Legal entity kinds rendered on the Money Flow canvas (design spec §6.1). */
export type EntityType =
  | 'sasu'
  | 'eurl'
  | 'sarl'
  | 'holding_sas'
  | 'holding_sarl'
  | 'sci_is'
  | 'sci_ir'
  | 'micro_entreprise'
  | 'entreprise_individuelle'
  | 'person'
  | 'client'
  | 'vendor'
  | 'tax_authority'
  | 'urssaf'
  | 'bank';

export const ENTITY_TYPES = [
  'sasu',
  'eurl',
  'sarl',
  'holding_sas',
  'holding_sarl',
  'sci_is',
  'sci_ir',
  'micro_entreprise',
  'entreprise_individuelle',
  'person',
  'client',
  'vendor',
  'tax_authority',
  'urssaf',
  'bank',
] as const satisfies readonly EntityType[];

export const entityTypeSchema = z.enum(ENTITY_TYPES);

/** Libellés lisibles : l'interface ne montre jamais les clés techniques. */
export const ENTITY_TYPE_LABELS: Record<EntityType, string> = {
  sasu: 'SASU',
  eurl: 'EURL (gérant TNS)',
  sarl: 'SARL (gérant majoritaire TNS)',
  holding_sas: 'Holding (SAS)',
  holding_sarl: 'Holding (SARL)',
  sci_is: 'SCI à l’IS',
  sci_ir: 'SCI à l’IR',
  micro_entreprise: 'Micro-entreprise',
  entreprise_individuelle: 'Entreprise individuelle',
  person: 'Dirigeant / personne',
  client: 'Client',
  vendor: 'Fournisseur',
  tax_authority: 'Trésor public',
  urssaf: 'URSSAF',
  bank: 'Banque',
};

/**
 * Impôt sur les bénéfices. Le type d'entité ne le détermine pas : une EURL est
 * à l'IR par défaut avec option IS, une SAS à l'IS avec option IR temporaire,
 * une SCI à l'IR sauf option IS irrévocable.
 */
export type TaxRegime = 'is' | 'ir';

export const TAX_REGIMES = ['is', 'ir'] as const satisfies readonly TaxRegime[];

export const taxRegimeSchema = z.enum(TAX_REGIMES);

export const TAX_REGIME_LABELS: Record<TaxRegime, string> = {
  is: 'Impôt sur les sociétés',
  ir: 'Impôt sur le revenu',
};

/**
 * Statut social du dirigeant. Détermine l'assiette des cotisations et, pour un
 * TNS, l'assujettissement des dividendes au-delà de 10 % du capital.
 */
export type SocialRegime = 'assimile_salarie' | 'tns' | 'none';

export const SOCIAL_REGIMES = [
  'assimile_salarie',
  'tns',
  'none',
] as const satisfies readonly SocialRegime[];

export const socialRegimeSchema = z.enum(SOCIAL_REGIMES);

export const SOCIAL_REGIME_LABELS: Record<SocialRegime, string> = {
  assimile_salarie: 'Assimilé salarié',
  tns: 'Travailleur non salarié (SSI)',
  none: 'Sans rémunération de dirigeant',
};

/** Catégorie du régime micro (CGI art. 50-0 / 102 ter). */
export type MicroCategoryId = 'bic_vente' | 'bic_services' | 'bnc' | 'meuble_tourisme';

export const MICRO_CATEGORIES = [
  'bic_vente',
  'bic_services',
  'bnc',
  'meuble_tourisme',
] as const satisfies readonly MicroCategoryId[];

export const microCategorySchema = z.enum(MICRO_CATEGORIES);

/** Régime par défaut d'un type d'entité, avant toute option exercée. */
export const DEFAULT_TAX_REGIME: Partial<Record<EntityType, TaxRegime>> = {
  sasu: 'is',
  eurl: 'ir',
  sarl: 'is',
  holding_sas: 'is',
  holding_sarl: 'is',
  sci_is: 'is',
  sci_ir: 'ir',
  micro_entreprise: 'ir',
  entreprise_individuelle: 'ir',
};

/** Statut social par défaut du dirigeant, par type d'entité. */
export const DEFAULT_SOCIAL_REGIME: Partial<Record<EntityType, SocialRegime>> = {
  sasu: 'assimile_salarie',
  eurl: 'tns',
  sarl: 'tns',
  holding_sas: 'assimile_salarie',
  holding_sarl: 'tns',
  micro_entreprise: 'tns',
  entreprise_individuelle: 'tns',
};

/** Live financial metrics attached to a canvas node (Derived by the engine). */
export interface EntityMetrics {
  treasury?: number;
  fiscalResult?: number;
  corporateTax?: number;
  netProfit?: number;
  netPersonalCash?: number;
  /** Cents after personal income tax on salary (barème, 1 part). */
  personalIncomeTax?: number;
  ccaBalance?: number;
}

export const entityMetricsSchema = z.object({
  treasury: z.number().optional(),
  fiscalResult: z.number().optional(),
  corporateTax: z.number().optional(),
  netProfit: z.number().optional(),
  netPersonalCash: z.number().optional(),
  personalIncomeTax: z.number().optional(),
  ccaBalance: z.number().optional(),
});

/** React Flow node payload for a financial entity. */
export interface EntityNodeData {
  id: string;
  label: string;
  entityType: EntityType;
  /** User-provided inputs (Given) keyed by field name. */
  inputs?: Record<string, number>;
  metrics?: EntityMetrics;
  /** Shareholding for legal layer (%). */
  ownershipPercent?: number;
  /** Impôt sur les bénéfices — défaut `DEFAULT_TAX_REGIME[entityType]`. */
  taxRegime?: TaxRegime;
  /** Statut social du dirigeant — défaut `DEFAULT_SOCIAL_REGIME[entityType]`. */
  socialRegime?: SocialRegime;
  /** Catégorie micro, pertinente pour `micro_entreprise` uniquement. */
  microCategory?: MicroCategoryId;
  legalNoteIds?: string[];
  warnings?: string[];
}

export const entityNodeDataSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  entityType: entityTypeSchema,
  inputs: z.record(z.string(), z.number()).optional(),
  metrics: entityMetricsSchema.optional(),
  ownershipPercent: z.number().min(0).max(100).optional(),
  taxRegime: taxRegimeSchema.optional(),
  socialRegime: socialRegimeSchema.optional(),
  microCategory: microCategorySchema.optional(),
  legalNoteIds: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});
