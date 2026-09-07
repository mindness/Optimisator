import { z } from 'zod';

import { flowLayerSchema, type FlowLayer } from './layer';

/** Semantic category of a monetary flow between entities (design spec §6.1). */
export type FlowCategory =
  | 'revenue'
  | 'expense'
  | 'management_fees'
  | 'dividend'
  | 'salary'
  | 'social_charges'
  | 'rent'
  | 'is_tax'
  | 'vat'
  | 'cca_advance'
  | 'cca_reimbursement'
  | 'loan_payment';

export const FLOW_CATEGORIES = [
  'revenue',
  'expense',
  'management_fees',
  'dividend',
  'salary',
  'social_charges',
  'rent',
  'is_tax',
  'vat',
  'cca_advance',
  'cca_reimbursement',
  'loan_payment',
] as const satisfies readonly FlowCategory[];

export const flowCategorySchema = z.enum(FLOW_CATEGORIES);

export type FlowPeriodicity = 'monthly' | 'quarterly' | 'annual' | 'one_off';

export const FLOW_PERIODICITIES = [
  'monthly',
  'quarterly',
  'annual',
  'one_off',
] as const satisfies readonly FlowPeriodicity[];

export const flowPeriodicitySchema = z.enum(FLOW_PERIODICITIES);

/** Directed monetary edge on the canvas (design spec §6.1). */
export interface FlowEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  category: FlowCategory;
  label: string;
  amount: number;
  periodicity: FlowPeriodicity;
  layer: FlowLayer;
  taxRate?: number;
  legalNoteId?: string;
  warning?: string;
}

export const flowEdgeDataSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  category: flowCategorySchema,
  label: z.string().min(1),
  amount: z.number(),
  periodicity: flowPeriodicitySchema,
  layer: flowLayerSchema,
  taxRate: z.number().optional(),
  legalNoteId: z.string().optional(),
  warning: z.string().optional(),
});
