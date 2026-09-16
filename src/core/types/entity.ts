import { z } from 'zod';

/** Legal entity kinds rendered on the Money Flow canvas (design spec §6.1). */
export type EntityType =
  | 'sasu'
  | 'holding_sas'
  | 'holding_sarl'
  | 'sci_is'
  | 'sci_ir'
  | 'person'
  | 'client'
  | 'vendor'
  | 'tax_authority'
  | 'urssaf'
  | 'bank';

export const ENTITY_TYPES = [
  'sasu',
  'holding_sas',
  'holding_sarl',
  'sci_is',
  'sci_ir',
  'person',
  'client',
  'vendor',
  'tax_authority',
  'urssaf',
  'bank',
] as const satisfies readonly EntityType[];

export const entityTypeSchema = z.enum(ENTITY_TYPES);

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
  legalNoteIds: z.array(z.string()).optional(),
  warnings: z.array(z.string()).optional(),
});
