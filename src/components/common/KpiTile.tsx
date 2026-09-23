import { annotate } from './Glossary';
import { formatEuro, formatPercent } from './MetricBadge';

export type KpiTileProps = {
  label: string;
  value: number;
  /** Valeur du même indicateur avant tout What-If : l'écart s'affiche avant la valeur. */
  baseline?: number;
  unit?: 'eur' | 'percent';
  fractionDigits?: number;
  /** `cost` : une hausse est défavorable (IS, URSSAF). */
  direction?: 'gain' | 'cost' | 'neutral';
  hint?: string;
};

export function KpiTile({
  label,
  value,
  baseline,
  unit = 'eur',
  fractionDigits,
  direction = 'gain',
  hint,
}: KpiTileProps) {
  const fmt = (n: number) =>
    unit === 'percent' ? formatPercent(n, fractionDigits ?? 0) : formatEuro(n, fractionDigits ?? 0);
  const delta = baseline === undefined ? 0 : value - baseline;
  const threshold = unit === 'percent' ? 0.0005 : 0.5;
  const moved = Math.abs(delta) >= threshold;
  const favorable = direction === 'neutral' ? null : direction === 'gain' ? delta > 0 : delta < 0;
  const deltaTone = !moved || favorable === null
    ? 'text-fg-muted'
    : favorable
      ? 'text-positive'
      : 'text-negative';

  return (
    <div className="kpi" title={hint}>
      <span className="text-xs font-medium text-fg-muted">{annotate(label)}</span>
      <span className={`font-amount text-xs ${deltaTone}`} aria-label={moved ? `Écart vs point de départ : ${fmt(delta)}` : 'Aucun écart vs point de départ'}>
        {moved ? (
          <>
            <svg viewBox="0 0 24 24" className="inline size-3 align-[-1px]" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d={delta > 0 ? 'm6 15 6-6 6 6' : 'm6 9 6 6 6-6'} />
            </svg>
            {' '}{fmt(Math.abs(delta))}
          </>
        ) : (
          // Tant que rien n'a bougé, la ligne d'écart ne dit rien : on garde sa
          // place (pas de saut de grille au premier curseur) sans l'écrire.
          ' '
        )}
      </span>
      <span className="font-amount truncate text-lg font-semibold text-fg">{fmt(value)}</span>
    </div>
  );
}
