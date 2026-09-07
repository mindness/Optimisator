import { MetricBadge, type FlowTone } from '@/components/common/MetricBadge';
import type { FlowCategory, FlowEdgeData, TaxCalculationResult } from '@/core/types';

import { LegalReference } from './LegalReference';
import { StepBreakdown } from './StepBreakdown';

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
  taxResult?: TaxCalculationResult;
  onClose: () => void;
  className?: string;
};

export function FlowInspector({
  flow,
  taxResult,
  onClose,
  className = '',
}: FlowInspectorProps) {
  if (!flow) return null;

  const tone = categoryTone(flow.category);
  const amount = taxResult?.grossAmount ?? flow.amount;

  return (
    <aside
      className={`flex w-full shrink-0 flex-col gap-4 border-t border-border bg-surface p-3 lg:w-80 lg:border-l lg:border-t-0 lg:overflow-y-auto ${className}`.trim()}
      data-testid="flow-inspector"
      aria-label={`Inspecteur de flux — ${flow.label}`}
    >
      <header className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-fg-muted">
            Inspecteur
          </p>
          <h2 className="m-0 mt-0.5 truncate text-base font-semibold text-fg">
            {flow.label}
          </h2>
          <p className="m-0 mt-0.5 text-xs text-fg-muted">
            {flow.sourceId} → {flow.targetId} · {flow.periodicity}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 border border-border bg-canvas px-2 py-1 text-xs text-fg-muted hover:border-border-strong hover:text-fg"
          aria-label="Fermer l’inspecteur"
        >
          Fermer
        </button>
      </header>

      <MetricBadge amount={amount} label="Montant" tone={tone} />

      {flow.warning ? (
        <p
          className="m-0 border border-flow-alert/40 bg-flow-alert/10 px-2 py-1.5 text-xs text-flow-alert"
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
