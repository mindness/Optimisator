import { z } from 'zod';

/** Thematic overlay filters for the Money Flow canvas (design spec §5.3). */
export type FlowLayer = 'treasury' | 'vat' | 'tax' | 'social' | 'legal';

export const FLOW_LAYERS = [
  'treasury',
  'vat',
  'tax',
  'social',
  'legal',
] as const satisfies readonly FlowLayer[];

export const flowLayerSchema = z.enum(FLOW_LAYERS);

/** Optional timeline / temporal layer (design spec §5.3). */
export type OptionalFlowLayer = 'temporal' | 'roles';

export const OPTIONAL_FLOW_LAYERS = ['temporal', 'roles'] as const satisfies readonly OptionalFlowLayer[];

export const optionalFlowLayerSchema = z.enum(OPTIONAL_FLOW_LAYERS);
