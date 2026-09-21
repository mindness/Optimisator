import { useEffect, useRef, useState } from 'react';

import { formatEuro } from './MetricBadge';

export type EditableAmountProps = {
  label: string;
  value: number;
  onChange: (value: number) => void;
  /** Libellé porté par `aria-label` seulement, quand un `<label>` voisin l'affiche déjà. */
  hideLabel?: boolean;
  className?: string;
};

/**
 * Montant au format `MetricBadge`, qui devient un champ nombre au clic. `nodrag nopan`
 * empêche React Flow d'interpréter le clic comme un déplacement de nœud ou un pan du canevas.
 */
export function EditableAmount({ label, value, onChange, hideLabel = false, className = '' }: EditableAmountProps) {
  const [editing, setEditing] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  // Le focus suit l'ouverture de l'édition ; via ref plutôt que `autoFocus` (jsx-a11y/no-autofocus).
  // `select()` : la frappe remplace l'ancien montant au lieu de s'y ajouter.
  useEffect(() => { if (editing) { inputRef.current?.focus(); inputRef.current?.select(); } }, [editing]);

  if (editing) {
    return (
      <label className={`metric-badge nodrag nopan inline-flex max-w-full items-baseline justify-between gap-3 text-sm ${className}`.trim()}>
        {hideLabel ? null : <span className="min-w-0 font-sans text-xs text-fg-muted">{label}</span>}
        <input
          ref={inputRef}
          type="number"
          step="0.01"
          defaultValue={value}
          aria-label={label}
          className="field font-amount w-24 shrink-0 py-0.5 text-right text-sm"
          onBlur={(event) => { onChange(Math.max(0, event.target.valueAsNumber || 0)); setEditing(false); }}
          onKeyDown={(event) => {
            if (event.key === 'Enter') event.currentTarget.blur();
            if (event.key === 'Escape') setEditing(false);
          }}
        />
      </label>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className={`metric-badge nodrag nopan inline-flex max-w-full items-baseline justify-between gap-3 rounded text-sm hover:bg-surface-sunken ${className}`.trim()}
      title="Cliquer pour modifier"
      aria-label={hideLabel ? `${label} : ${formatEuro(value)}, cliquer pour modifier` : undefined}
    >
      {hideLabel ? null : <span className="min-w-0 font-sans text-xs text-fg-muted">{label}</span>}
      <span className="font-amount shrink-0 whitespace-nowrap font-medium text-fg underline decoration-dotted underline-offset-2">
        {formatEuro(value)}
      </span>
    </button>
  );
}
