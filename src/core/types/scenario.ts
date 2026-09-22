import { z } from 'zod';

import { entityNodeDataSchema, type EntityNodeData } from './entity';
import { flowCategorySchema, flowEdgeDataSchema, type FlowCategory, type FlowEdgeData } from './flow';
import { flowLayerSchema, type FlowLayer } from './layer';

/** External tax parameter with mandatory provenance (design spec §3.0). */
export type SourcedRateUnit = 'ratio' | 'eur' | 'pct_points' | 'years' | 'year';

export type SourcedRateStatus = 'verified' | 'assumed' | 'placeholder';

/** Progressive bracket: income band upper bound (€) and marginal rate. */
export type TaxBracket = { upTo: number; rate: number };

/** External tax parameter with mandatory provenance (design spec §3.0). */
export interface SourcedRate<TValue = number> {
  value: TValue;
  unit: SourcedRateUnit;
  source: string;
  asOf: string;
  status: SourcedRateStatus;
}

export const sourcedRateUnitSchema = z.enum(['ratio', 'eur', 'pct_points', 'years', 'year']);

export const sourcedRateStatusSchema = z.enum(['verified', 'assumed', 'placeholder']);

export const sourcedRateSchema = z.object({
  value: z.number(),
  unit: sourcedRateUnitSchema,
  source: z.string().min(1),
  asOf: z.string().min(1),
  status: sourcedRateStatusSchema,
});

export type ProvenanceKind = 'given' | 'derived' | 'external';

export const provenanceKindSchema = z.enum(['given', 'derived', 'external']);

export interface TaxBreakdownLine {
  label: string;
  amount: number;
  rate?: SourcedRate;
  formula?: string;
}

export const taxBreakdownLineSchema = z.object({
  label: z.string().min(1),
  amount: z.number(),
  rate: sourcedRateSchema.optional(),
  formula: z.string().optional(),
});

/** Result of a fiscal calculation step exposed in the flow inspector. */
export interface TaxCalculationResult {
  flowId: string;
  category: FlowCategory;
  grossAmount: number;
  taxAmount: number;
  netAmount: number;
  breakdown: TaxBreakdownLine[];
  provenance: ProvenanceKind;
  legalNoteId?: string;
  warning?: string;
}

export const taxCalculationResultSchema = z.object({
  flowId: z.string().min(1),
  category: flowCategorySchema,
  grossAmount: z.number(),
  taxAmount: z.number(),
  netAmount: z.number(),
  breakdown: z.array(taxBreakdownLineSchema),
  provenance: provenanceKindSchema,
  legalNoteId: z.string().optional(),
  warning: z.string().optional(),
});

/** Persisted simulation graph: entities, flows, and active layer filters. */
export interface ScenarioState {
  id: string;
  name: string;
  description?: string;
  entities: EntityNodeData[];
  flows: FlowEdgeData[];
  activeLayers: FlowLayer[];
  version: number;
  createdAt: string;
  updatedAt: string;
  presetId?: string;
  nodePositions?: Record<string, { x: number; y: number }>;
  /** Directed legal relationships, never monetary flows. Unspecified owners remain unknown. */
  ownerships?: Array<{
    id: string;
    ownerId: string;
    companyId: string;
    percent: number;
    /** Nature de la détention : une part n'est plus un pourcentage plat (CGI art. 669). */
    nature?: 'pleine_propriete' | 'usufruit' | 'nue_propriete';
    /** Usufruit temporaire : durée fixe en années (art. 669, II). */
    dureeAnnees?: number;
    /** Âge de l'usufruitier pour un usufruit viager (art. 669, I). */
    ageUsufruitier?: number;
    /** Prix payé pour le droit démembré : base d'amortissement chez un usufruitier à l'IS. */
    acquisitionPrice?: number;
  }>;
  /** Options fiscales exercées par le groupe (conventions activées). */
  options?: {
    integrationFiscale?: boolean;
    /**
     * Durée du premier exercice en jours (365 par défaut). Un exercice écourté
     * ne donne droit qu'à une fraction du plafond de 42 500 € du taux réduit
     * d'IS (CGI art. 219, I-b).
     */
    exerciseDays?: number;
  };
}

export const scenarioStateSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),
  entities: z.array(entityNodeDataSchema).min(1),
  flows: z.array(flowEdgeDataSchema),
  activeLayers: z.array(flowLayerSchema).min(1),
  version: z.number().int().nonnegative(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  presetId: z.string().optional(),
  nodePositions: z.record(z.string(), z.object({ x: z.number(), y: z.number() })).optional(),
  ownerships: z.array(z.object({
    id: z.string().min(1),
    ownerId: z.string().min(1),
    companyId: z.string().min(1),
    percent: z.number().positive().max(100),
    nature: z.enum(['pleine_propriete', 'usufruit', 'nue_propriete']).optional(),
    dureeAnnees: z.number().positive().optional(),
    ageUsufruitier: z.number().min(0).optional(),
    acquisitionPrice: z.number().min(0).optional(),
  })).optional(),
  options: z.object({
    integrationFiscale: z.boolean().optional(),
    exerciseDays: z.number().int().positive().max(365).optional(),
  }).optional(),
});

export function parseScenarioState(data: unknown): ScenarioState {
  return scenarioStateSchema.parse(data);
}

export function parseSourcedRate(data: unknown): SourcedRate {
  return sourcedRateSchema.parse(data);
}
