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
      <h2 className="panel-title">Suivre un euro</h2>
      <p className="panel-help">
        Injectez un montant test comme chiffre d’affaires : le schéma surligne son parcours et
        chaque prélèvement rencontré.
      </p>

      <div className="flex items-end gap-2">
        <label className="flex min-w-0 flex-1 flex-col gap-1 text-xs font-medium text-fg">
          Montant (€)
          <input
            type="number"
            min={0}
            step={1000}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            className="field font-amount"
            aria-label="Montant d'injection Money Tracer"
          />
        </label>
        <button
          type="button"
          data-testid="money-tracer-inject"
          className="btn btn-primary"
          onClick={() => onInject(amount)}
        >
          Tracer
        </button>
        {moneyTrace.active ? (
          <button
            type="button"
            data-testid="money-tracer-clear"
            className="btn btn-ghost"
            onClick={onClear}
          >
            Effacer
          </button>
        ) : null}
      </div>

      {moneyTrace.active ? (
        <div
          className="flex flex-col gap-1 rounded-md bg-accent-soft px-3 py-2"
          data-testid="money-tracer-status"
          role="status"
        >
          <MetricBadge amount={moneyTrace.amount} label="Montant tracé" tone="cash" />
          <span className="text-xs text-fg-muted">
            {moneyTrace.pathFlowIds.length} flux sur le parcours — surlignés sur le schéma.
          </span>
        </div>
      ) : null}
    </section>
  );
}
