import type { FlowCategory, ScenarioState } from '../types';

/** Canonical timeline replay ids (design §5.1) — fixed order. */
export type TimelineStepId =
  | 'facturation'
  | 'charges'
  | 'remuneration'
  | 'intra_groupe'
  | 'impots'
  | 'dividendes'
  | 'patrimoine';

export interface TimelineStep {
  id: TimelineStepId;
  order: number;
  label: string;
  description: string;
  /** Flow categories that become active at this step. */
  categories: readonly FlowCategory[];
}

export const TIMELINE_STEPS: readonly TimelineStep[] = [
  {
    id: 'facturation',
    order: 1,
    label: 'Facturation',
    description: 'Facturation / encaissement Clients → SASU',
    categories: ['revenue'],
  },
  {
    id: 'charges',
    order: 2,
    label: 'Charges',
    description: 'Charges + TVA déductible SASU → Fournisseurs',
    categories: ['expense'],
  },
  {
    id: 'remuneration',
    order: 3,
    label: 'Rémunération',
    description: 'Rémunération + URSSAF SASU → Dirigeant / URSSAF',
    categories: ['salary', 'social_charges'],
  },
  {
    id: 'intra_groupe',
    order: 4,
    label: 'Intra-groupe',
    description: 'Intra-groupe (loyer SCI, management fees, CCA)',
    categories: ['management_fees', 'rent', 'cca_advance', 'cca_reimbursement', 'loan_payment', 'capital_contribution'],
  },
  {
    id: 'impots',
    order: 5,
    label: 'Impôts',
    description: 'Clôture fiscale TVA nette + IS → DGFiP',
    categories: ['is_tax', 'vat'],
  },
  {
    id: 'dividendes',
    order: 6,
    label: 'Dividendes',
    description: 'Dividendes / réserves (mère-fille ou Flat Tax)',
    categories: ['dividend'],
  },
  {
    id: 'patrimoine',
    order: 7,
    label: 'Patrimoine',
    description: 'Cessions de titres et d’immeubles, apport en report, donation',
    categories: ['share_sale', 'share_contribution', 'donation', 'property_sale'],
  },
] as const;

const CATEGORY_TO_STEP = new Map<FlowCategory, TimelineStepId>(
  TIMELINE_STEPS.flatMap((step) => step.categories.map((c) => [c, step.id] as const)),
);

/** Map a flow category to its timeline step id (defaults to facturation). */
export function timelineStepIdForCategory(category: FlowCategory): TimelineStepId {
  return CATEGORY_TO_STEP.get(category) ?? 'facturation';
}

/**
 * Returns the fixed 6-step timeline for a scenario.
 * Step order is structural (not data-dependent); scenario is accepted for API symmetry.
 */
export function getTimelineSteps(_scenario: ScenarioState): TimelineStep[] {
  return TIMELINE_STEPS.map((step) => ({ ...step, categories: [...step.categories] }));
}

export function timelineStepOrder(): TimelineStepId[] {
  return TIMELINE_STEPS.map((s) => s.id);
}
