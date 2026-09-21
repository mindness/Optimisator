/** Format a euro amount for FR display (narrow/no-break spaces + €). */
export function formatEuro(amount: number, fractionDigits?: number): string {
  const digits =
    fractionDigits ?? (Number.isInteger(amount) ? 0 : 2);

  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(amount);
}

export type FlowTone =
  | 'cash'
  | 'vat'
  | 'is'
  | 'social'
  | 'div'
  | 'alert'
  | 'neutral';

const toneClass: Record<FlowTone, string> = {
  cash: 'text-flow-cash',
  vat: 'text-flow-vat',
  is: 'text-flow-is',
  social: 'text-flow-social',
  div: 'text-flow-div',
  alert: 'text-flow-alert',
  neutral: 'text-fg',
};

/** Format a ratio (0.41) as a FR percentage (41 %). */
export function formatPercent(ratio: number, fractionDigits = 0): string {
  return new Intl.NumberFormat('fr-FR', {
    style: 'percent',
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(ratio);
}

export type MetricBadgeProps = {
  amount: number;
  label?: string;
  tone?: FlowTone;
  fractionDigits?: number;
  /** `percent` traite `amount` comme un ratio (0,41 → 41 %). */
  unit?: 'eur' | 'percent';
  className?: string;
};

export function MetricBadge({
  amount,
  label,
  tone = 'neutral',
  fractionDigits,
  unit = 'eur',
  className = '',
}: MetricBadgeProps) {
  const formatted = unit === 'percent'
    ? formatPercent(amount, fractionDigits ?? 0)
    : formatEuro(amount, fractionDigits);

  return (
    <span
      className={`metric-badge inline-flex max-w-full items-baseline justify-between gap-3 text-sm ${className}`.trim()}
    >
      {label ? (
        <span className="min-w-0 font-sans text-xs text-fg-muted">
          {label}
        </span>
      ) : null}
      <span className={`font-amount shrink-0 whitespace-nowrap font-medium ${toneClass[tone]}`}>{formatted}</span>
    </span>
  );
}
