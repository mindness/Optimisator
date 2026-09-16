import { z } from 'zod';

import { entityNodeDataSchema, type EntityNodeData } from './entity';
import { flowCategorySchema, flowEdgeDataSchema, type FlowCategory, type FlowEdgeData } from './flow';
import { flowLayerSchema, type FlowLayer } from './layer';

/** External tax parameter with mandatory provenance (design spec §3.0). */
export type SourcedRateUnit = 'ratio' | 'eur' | 'pct_points';

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

export const sourcedRateUnitSchema = z.enum(['ratio', 'eur', 'pct_points']);

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
  ownerships?: Array<{ id: string; ownerId: string; companyId: string; percent: number }>;
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
  ownerships: z.array(z.object({ id: z.string().min(1), ownerId: z.string().min(1), companyId: z.string().min(1), percent: z.number().positive().max(100) })).optional(),
});

export function parseScenarioState(data: unknown): ScenarioState {
  return scenarioStateSchema.parse(data);
}

export function parseSourcedRate(data: unknown): SourcedRate {
  return sourcedRateSchema.parse(data);
}
