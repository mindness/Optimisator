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
  | 'loan_payment'
  | 'capital_contribution'
  | 'share_sale'
  | 'share_contribution'
  | 'donation'
  | 'property_sale';

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
  'capital_contribution',
  'share_sale',
  'share_contribution',
  'donation',
  'property_sale',
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
  /** Intérêts annuels attachés à un CCA / une avance / une échéance d'emprunt (€). */
  interestAmount?: number;
  /**
   * Emprunt réel : le partage capital / intérêts est calculé par échéance à
   * partir du capital restant dû, jamais saisi. `interestAmount` reste accepté
   * en repli pour les schémas antérieurs.
   */
  loan?: { principal: number; rate: number; years: number; type: 'amortissable' | 'in_fine' };
  /** Cession de titres : le flux porte les titres, la trésorerie circule en sens inverse. */
  share?: {
    acquisitionPrice: number;
    acquisitionYear?: number;
    /** Part du capital cédée (%), pour le régime des titres de participation. */
    soldPercent?: number;
    /** Abattement fixe dirigeant partant à la retraite (CGI art. 150-0 D ter). */
    retirementAllowance?: boolean;
    /** Titres reçus d'un apport en report : rattache la cession au report suivi. */
    deferredContributionId?: string;
    /** Remploi du produit de cession (CGI art. 150-0 B ter, I-2°). */
    reinvestment?: { ratio: number; kind: 'eligible' | 'immobilier' | 'fonds' };
  };
  /** Apport de titres à une société contrôlée (CGI art. 150-0 B ter). */
  contribution?: { acquisitionPrice: number; controlPercent?: number };
  /** Donation de titres (CGI art. 777 et 787 B). */
  gift?: {
    dutreil?: boolean;
    reserveUsufruit?: { age?: number; durationYears?: number };
    previousAbatementUsed?: number;
    /** Titres issus d'un apport en report : purge au terme du délai de conservation. */
    deferredContributionId?: string;
  };
  /** Cession d'un bien immobilier par un particulier (CGI art. 150 U à 150 VH). */
  property?: {
    acquisitionPrice: number;
    acquisitionYear?: number;
    /** Travaux justifiés ; à défaut le forfait de 15 % s'applique au-delà de cinq ans. */
    worksAmount?: number;
    /** Résidence principale au jour de la cession : exonération totale. */
    principalResidence?: boolean;
    /** Amortissements déduits en meublé, réintégrés au prix d'acquisition. */
    deductedAmortization?: number;
  };
  legalNoteId?: string;
  warning?: string;
}

const propertySchema = z.object({
  acquisitionPrice: z.number().min(0),
  acquisitionYear: z.number().int().optional(),
  worksAmount: z.number().min(0).optional(),
  principalResidence: z.boolean().optional(),
  deductedAmortization: z.number().min(0).optional(),
});

const loanSchema = z.object({
  principal: z.number().min(0),
  rate: z.number().min(0),
  years: z.number().int().positive(),
  type: z.enum(['amortissable', 'in_fine']),
});

const shareSchema = z.object({
  acquisitionPrice: z.number().min(0),
  acquisitionYear: z.number().int().optional(),
  soldPercent: z.number().min(0).max(100).optional(),
  retirementAllowance: z.boolean().optional(),
  deferredContributionId: z.string().optional(),
  reinvestment: z.object({ ratio: z.number().min(0).max(1), kind: z.enum(['eligible', 'immobilier', 'fonds']) }).optional(),
});

const giftSchema = z.object({
  dutreil: z.boolean().optional(),
  reserveUsufruit: z.object({ age: z.number().min(0).optional(), durationYears: z.number().min(0).optional() }).optional(),
  previousAbatementUsed: z.number().min(0).optional(),
  deferredContributionId: z.string().optional(),
});

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
  interestAmount: z.number().min(0).optional(),
  loan: loanSchema.optional(),
  share: shareSchema.optional(),
  contribution: z.object({ acquisitionPrice: z.number().min(0), controlPercent: z.number().min(0).max(100).optional() }).optional(),
  gift: giftSchema.optional(),
  property: propertySchema.optional(),
  legalNoteId: z.string().optional(),
  warning: z.string().optional(),
});
