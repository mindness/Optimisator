import { useState } from 'react';

import { MetricBadge } from '@/components/common/MetricBadge';
import type { MoneyTraceState } from '@/hooks/useSimulation';

export type MoneyTracerProps = {
  moneyTrace: MoneyTraceState;
  onInject: (amount: number) => void;
  onClear: () => void;
  /** Suggested default injection amount (EUR). */
  defaultAmount?: number;
  className?: string;
};

export function MoneyTracer({
  moneyTrace,
  onInject,
  onClear,
  defaultAmount = 10_000,
  className = '',
}: MoneyTracerProps) {
  const [draft, setDraft] = useState(String(defaultAmount));

  const parsed = Number(draft.replace(/\s/g, '').replace(',', '.'));
  const amount = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;

  return (
    <section
      className={`flex flex-col gap-2 ${className}`.trim()}
      data-testid="money-tracer"
      aria-label="Money Tracer"
    >
      <h2 className="m-0 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Money Tracer
      </h2>
      <p className="m-0 text-xs text-fg-muted">
        Injectez un montant test pour tracer le parcours cash et les frictions fiscales.
      </p>

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex min-w-[8rem] flex-1 flex-col gap-1 text-xs font-medium text-fg">
          Montant (€)
          <input
            type="number"
            min={0}
            step={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="font-amount border border-border bg-canvas px-2 py-1.5 text-sm text-fg"
            aria-label="Montant d'injection Money Tracer"
          />
        </label>
        <button
          type="button"
          data-testid="money-tracer-inject"
          className="border border-flow-cash bg-flow-cash/10 px-3 py-1.5 text-sm font-medium text-fg hover:bg-flow-cash/20"
          onClick={() => onInject(amount)}
        >
          Injecter
        </button>
        {moneyTrace.active ? (
          <button
            type="button"
            data-testid="money-tracer-clear"
            className="border border-border px-3 py-1.5 text-sm text-fg-muted hover:border-border-strong hover:text-fg"
            onClick={onClear}
          >
            Effacer
          </button>
        ) : null}
      </div>

      {moneyTrace.active ? (
        <div
          className="flex flex-wrap items-center gap-2 border border-border bg-canvas px-2 py-1.5"
          data-testid="money-tracer-status"
          role="status"
        >
          <MetricBadge amount={moneyTrace.amount} label="Trace" tone="cash" />
          <span className="font-amount text-xs text-fg-muted">
            {moneyTrace.pathFlowIds.length} flux sur le parcours
          </span>
        </div>
      ) : null}
    </section>
  );
}
