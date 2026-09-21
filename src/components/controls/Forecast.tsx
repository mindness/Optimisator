import { useMemo, useState } from 'react';

import { formatEuro } from '@/components/common/MetricBadge';
import { forecastScenario, type ForecastYear } from '@/core/engine';
import type { WhatIfInputs } from '@/core/engine';
import type { ScenarioState } from '@/core/types';

/**
 * Two series, identity carried by the project's semantic flow colours
 * (cash = vert, dividende = jaune — The Role Color Rule), doubled by a legend
 * and by a label at each line's end so colour is never the only cue.
 */
const SERIES = [
  { key: 'cumulativeGroupCash', label: 'Cash groupe cumulé', stroke: 'var(--flow-cash)' },
  { key: 'cumulativePersonalCash', label: 'Cash perso cumulé', stroke: 'var(--flow-div)' },
] as const;

const GROWTH_CHOICES = [-0.1, -0.05, 0, 0.05, 0.1, 0.2] as const;
const HORIZONS = [3, 5, 10] as const;

const W = 900;
const H = 240;
const PAD = { top: 16, right: 150, bottom: 30, left: 16 };

export type ForecastProps = {
  scenario: ScenarioState;
  whatIf: WhatIfInputs;
};

export function Forecast({ scenario, whatIf }: ForecastProps) {
  const [horizon, setHorizon] = useState<number>(5);
  const [caGrowth, setCaGrowth] = useState(0.05);
  const [expenseGrowth, setExpenseGrowth] = useState(0.05);
  const [hovered, setHovered] = useState<number | null>(null);

  const { years, warnings } = useMemo(
    () =>
      forecastScenario(scenario, whatIf, { years: horizon, caGrowth, expenseGrowth }),
    [scenario, whatIf, horizon, caGrowth, expenseGrowth],
  );

  const yMax = Math.max(
    ...years.flatMap((y) => [y.cumulativeGroupCash, y.cumulativePersonalCash]),
    1,
  );
  const yMin = Math.min(
    0,
    ...years.flatMap((y) => [y.cumulativeGroupCash, y.cumulativePersonalCash]),
  );
  const span = yMax - yMin || 1;

  const x = (index: number) =>
    PAD.left + (years.length === 1 ? 0 : (index / (years.length - 1)) * (W - PAD.left - PAD.right));
  const y = (value: number) =>
    PAD.top + (1 - (value - yMin) / span) * (H - PAD.top - PAD.bottom);

  const pathFor = (key: (typeof SERIES)[number]['key']) =>
    years
      .map((row, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)} ${y(row[key]).toFixed(1)}`)
      .join(' ');

  const active = hovered === null ? null : years[hovered] ?? null;
  const last = years.at(-1)!;

  const pickNearest = (event: React.MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const svgX = ((event.clientX - box.left) / box.width) * W;
    let nearest = 0;
    for (let i = 1; i < years.length; i += 1) {
      if (Math.abs(x(i) - svgX) < Math.abs(x(nearest) - svgX)) nearest = i;
    }
    setHovered(nearest);
  };

  return (
    <section
      className="mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col gap-4 overflow-auto p-4"
      aria-label="Projection pluriannuelle"
    >
      <header>
        <h2 className="m-0 text-lg font-semibold tracking-tight text-fg">
          Projection sur {horizon} ans
        </h2>
        <p className="mt-0.5 max-w-prose text-sm text-fg-muted">
          Le scénario actuel rejoué chaque année, avec une croissance constante du CA et des
          charges. Une extrapolation à barème figé, pas une prévision.
        </p>
      </header>

      <div className="flex flex-wrap gap-4">
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          Horizon
          <select
            className="field w-auto"
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          >
            {HORIZONS.map((n) => (
              <option key={n} value={n}>
                {n} ans
              </option>
            ))}
          </select>
        </label>
        <GrowthSelect label="Croissance CA" value={caGrowth} onChange={setCaGrowth} />
        <GrowthSelect label="Croissance charges" value={expenseGrowth} onChange={setExpenseGrowth} />
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label={`CA ${last.year}`} value={formatEuro(last.caHt)} tone="text-fg" />
        <Stat
          label="Cash groupe cumulé"
          value={formatEuro(last.cumulativeGroupCash)}
          tone="text-flow-cash"
        />
        <Stat
          label="Cash perso cumulé"
          value={formatEuro(last.cumulativePersonalCash)}
          tone="text-flow-div"
        />
      </div>

      <figure className="m-0 card p-3">
        <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-fg-muted">
          {SERIES.map((s) => (
            <span key={s.key} className="inline-flex items-center gap-1.5">
              <span
                aria-hidden="true"
                className="inline-block h-0.5 w-4"
                style={{ background: s.stroke }}
              />
              {s.label}
            </span>
          ))}
          <span>Échelle {formatEuro(yMin)} → {formatEuro(yMax)}.</span>
        </figcaption>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label={`Cash cumulé de ${years[0]!.year} à ${last.year}`}
          onMouseMove={pickNearest}
          onMouseLeave={() => setHovered(null)}
        >
          <line
            x1={PAD.left}
            x2={W - PAD.right}
            y1={y(0)}
            y2={y(0)}
            stroke="var(--border)"
            strokeWidth="1"
          />
          {active && (
            <line
              x1={x(hovered!)}
              x2={x(hovered!)}
              y1={PAD.top}
              y2={H - PAD.bottom}
              stroke="var(--border-strong)"
              strokeWidth="1"
            />
          )}
          {SERIES.map((s) => (
            <g key={s.key}>
              <path d={pathFor(s.key)} fill="none" stroke={s.stroke} strokeWidth="2" strokeLinejoin="round" />
              <circle
                cx={x(years.length - 1)}
                cy={y(last[s.key])}
                r="4"
                fill={s.stroke}
                stroke="var(--surface)"
                strokeWidth="2"
              />
              {/* Direct label: identity never rests on colour alone. */}
              <text
                x={x(years.length - 1) + 10}
                y={y(last[s.key]) + 4}
                className="fill-fg-muted text-xs"
              >
                {s.label}
              </text>
            </g>
          ))}
          {years.map((row, i) => (
            <text
              key={row.year}
              x={x(i)}
              y={H - 8}
              textAnchor={i === 0 ? 'start' : i === years.length - 1 ? 'end' : 'middle'}
              className="fill-fg-muted text-xs"
            >
              {row.year}
            </text>
          ))}
        </svg>
        <p className="m-0 min-h-5 text-xs text-fg-muted" aria-live="polite">
          {active
            ? `${active.year} — groupe ${formatEuro(active.cumulativeGroupCash)} · perso ${formatEuro(active.cumulativePersonalCash)}`
            : 'Survolez la courbe pour lire une année.'}
        </p>
      </figure>

      <details className="disclosure card p-3 text-sm">
        <summary className="min-h-11 cursor-pointer text-fg">Voir le détail par exercice</summary>
        <div className="overflow-x-auto">
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs font-medium text-fg-muted">
                <th scope="col" className="py-1 pr-3 font-medium">Année</th>
                <th scope="col" className="py-1 pr-3 font-medium">CA HT</th>
                <th scope="col" className="py-1 pr-3 font-medium">Charges</th>
                <th scope="col" className="py-1 pr-3 font-medium">IS</th>
                <th scope="col" className="py-1 pr-3 font-medium">Cash groupe</th>
                <th scope="col" className="py-1 font-medium">Cash perso</th>
              </tr>
            </thead>
            <tbody className="font-amount">
              {years.map((row) => (
                <tr key={row.year} className="border-t border-border">
                  <td className="py-1 pr-3">{row.year}</td>
                  <td className="py-1 pr-3">{formatEuro(row.caHt)}</td>
                  <td className="py-1 pr-3">{formatEuro(row.expensesHt)}</td>
                  <td className="py-1 pr-3">{formatEuro(row.corporateTaxDue)}</td>
                  <td className="py-1 pr-3">{formatEuro(row.netGroupCash)}</td>
                  <td className="py-1">{formatEuro(row.netPersonalCash)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>

      <div className="rounded-md bg-negative-soft p-3">
        <h3 className="m-0 text-sm font-semibold text-fg">Ce que cette projection ne voit pas</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-fg-muted">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function GrowthSelect({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (next: number) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-xs text-fg-muted">
      {label}
      <select
        className="field w-auto"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      >
        {GROWTH_CHOICES.map((g) => (
          <option key={g} value={g}>
            {g > 0 ? '+' : ''}
            {Math.round(g * 100)} % / an
          </option>
        ))}
      </select>
    </label>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone: string }) {
  return (
    <div className="card p-3">
      <div className="text-xs font-medium text-fg-muted">{label}</div>
      <div className={`mt-1 font-amount text-xl ${tone}`}>{value}</div>
    </div>
  );
}

export type { ForecastYear };
