import { formatEuro, type FlowTone } from '@/components/common/MetricBadge';
import type { FlowCategory, FlowEdgeData, FlowPeriodicity, TaxCalculationResult } from '@/core/types';

import { LegalReference } from './LegalReference';
import { StepBreakdown } from './StepBreakdown';

const PERIODICITY_LABEL: Record<FlowPeriodicity, string> = {
  monthly: 'mensuel',
  quarterly: 'trimestriel',
  annual: 'annuel',
  one_off: 'ponctuel',
};

function toneClass(tone: FlowTone): string {
  return tone === 'neutral' ? 'text-fg' : `text-flow-${tone}`;
}

function categoryTone(category: FlowCategory): FlowTone {
  switch (category) {
    case 'vat':
      return 'vat';
    case 'is_tax':
      return 'is';
    case 'salary':
    case 'social_charges':
      return 'social';
    case 'dividend':
      return 'div';
    case 'cca_advance':
      return 'alert';
    default:
      return 'cash';
  }
}

export type FlowInspectorProps = {
  flow: FlowEdgeData | null;
  /** Pour afficher les noms des parties plutôt que leurs identifiants. */
  entities?: ReadonlyArray<{ id: string; label: string }>;
  taxResult?: TaxCalculationResult;
  onClose: () => void;
  className?: string;
};

export function FlowInspector({
  flow,
  entities = [],
  taxResult,
  onClose,
  className = '',
}: FlowInspectorProps) {
  if (!flow) return null;

  const tone = categoryTone(flow.category);
  const amount = taxResult?.grossAmount ?? flow.amount;
  const name = (id: string) => entities.find((entity) => entity.id === id)?.label ?? id;

  return (
    <aside
      className={`flex w-full flex-col gap-4 ${className}`.trim()}
      data-testid="flow-inspector"
      aria-label={`Inspecteur de flux — ${flow.label}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="btn btn-ghost btn-sm -ml-2 mb-1"
            aria-label="Fermer l’inspecteur"
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 18-6-6 6-6" /></svg>
            Retour aux hypothèses
          </button>
          <h2 className="m-0 text-base font-semibold text-fg">
            {flow.label}
          </h2>
          <p className="m-0 mt-0.5 text-xs text-fg-muted">
            {name(flow.sourceId)} → {name(flow.targetId)} · {PERIODICITY_LABEL[flow.periodicity] ?? flow.periodicity}
          </p>
        </div>
      </header>

      <div className="rounded-md bg-surface-sunken px-3 py-2.5">
        <span className="block text-xs text-fg-muted">Montant du flux</span>
        <span className={`font-amount text-2xl font-semibold ${toneClass(tone)}`}>{formatEuro(amount)}</span>
      </div>

      {flow.warning ? (
        <p
          className="m-0 rounded-md bg-negative-soft px-3 py-2 text-xs text-negative"
          role="alert"
        >
          {flow.warning}
        </p>
      ) : null}

      <StepBreakdown flow={flow} taxResult={taxResult} />
      <LegalReference flow={flow} />
    </aside>
  );
}
