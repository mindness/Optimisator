import { annotate } from '@/components/common/Glossary';
import { useMemo, useState } from 'react';

import { formatEuro } from '@/components/common/MetricBadge';
import {
  optimizeRemuneration,
  URSSAF_BRANCHES_2026,
  URSSAF_EMPLOYEE_RATE_2026,
  URSSAF_EMPLOYER_RATE_2026,
  type OptimizationObjective,
  type OptimizationPoint,
} from '@/core/engine';
import type { WhatIfInputs } from '@/core/engine';
import type { ScenarioState } from '@/core/types';

const OBJECTIVES: ReadonlyArray<readonly [OptimizationObjective, string]> = [
  ['netPersonalCash', 'Cash perso (en main)'],
  ['netGroupCash', 'Cash groupe (conservé)'],
  ['totalNetCash', 'Total perso + groupe'],
];

const OBJECTIVE_NOTE: Record<OptimizationObjective, string> = {
  netPersonalCash: 'Maximise ce qui arrive sur le compte personnel après IS, URSSAF, PFU et IR.',
  netGroupCash:
    'Maximise la trésorerie laissée en société : l’optimum est logiquement « ne rien sortir ».',
  totalNetCash:
    'Additionne cash perso et cash groupe, alors que le cash groupe supporte encore la flat tax à la sortie : les deux ne sont pas comparables euro pour euro.',
};

// Chart box (SVG units = px at 1:1).
const W = 900;
const H = 200;
const PAD = { top: 14, right: 16, bottom: 28, left: 16 };

export type OptimizerProps = {
  scenario: ScenarioState;
  whatIf: WhatIfInputs;
  /** Applies the optimum to the live simulation. */
  onApply: (point: OptimizationPoint) => void;
};

export function Optimizer({ scenario, whatIf, onApply }: OptimizerProps) {
  const [objective, setObjective] = useState<OptimizationObjective>('netPersonalCash');
  const [hovered, setHovered] = useState<number | null>(null);

  const result = useMemo(
    () => optimizeRemuneration(scenario, whatIf, { objective, steps: 40 }),
    [scenario, whatIf, objective],
  );

  // One series: the objective along the salary axis, at the winning payout ratio.
  const series = useMemo(
    () =>
      result.points
        .filter((p) => p.payoutRatio === result.best.payoutRatio)
        .sort((a, b) => a.executiveNetSalary - b.executiveNetSalary),
    [result],
  );

  const values = series.map((p) => p[objective]);
  const yMin = Math.min(...values);
  const yMax = Math.max(...values);
  const xMax = Math.max(...series.map((p) => p.executiveNetSalary), 1);
  const span = yMax - yMin || 1;

  const x = (salary: number) =>
    PAD.left + (salary / xMax) * (W - PAD.left - PAD.right);
  const y = (value: number) =>
    PAD.top + (1 - (value - yMin) / span) * (H - PAD.top - PAD.bottom);

  const path = series
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${x(p.executiveNetSalary).toFixed(1)} ${y(p[objective]).toFixed(1)}`)
    .join(' ');

  const gain = result.best[objective] - result.baseline[objective];
  const active = hovered === null ? null : series[hovered] ?? null;

  const pickNearest = (event: React.MouseEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const ratio = ((event.clientX - box.left) / box.width) * W;
    const salary = ((ratio - PAD.left) / (W - PAD.left - PAD.right)) * xMax;
    let nearest = 0;
    for (let i = 1; i < series.length; i += 1) {
      const a = Math.abs(series[i]!.executiveNetSalary - salary);
      const b = Math.abs(series[nearest]!.executiveNetSalary - salary);
      if (a < b) nearest = i;
    }
    setHovered(nearest);
  };

  return (
    <section className="mx-auto flex w-full max-w-4xl min-h-0 flex-1 flex-col gap-4 overflow-auto p-4" aria-label="Optimisation salaire / dividendes">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold tracking-tight text-fg">
            Arbitrage salaire / dividendes
          </h2>
          <p className="mt-0.5 max-w-prose text-sm text-fg-muted">
            Balayage de {result.points.length} combinaisons à CA et charges constants. Le meilleur
            point en cash n’est pas un conseil : lisez les limites ci-dessous.
          </p>
        </div>
        <label className="flex items-center gap-2 text-xs text-fg-muted">
          Objectif
          <select
            className="field w-auto"
            value={objective}
            onChange={(e) => setObjective(e.target.value as OptimizationObjective)}
          >
            {OBJECTIVES.map(([id, label]) => (
              <option key={id} value={id}>
                {label}
              </option>
            ))}
          </select>
        </label>
      </header>

      <p className="m-0 max-w-prose text-sm text-fg-muted">{annotate(OBJECTIVE_NOTE[objective])}</p>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Optimum trouvé" value={formatEuro(result.best[objective])} tone="text-fg" />
        <Stat label="Scénario actuel" value={formatEuro(result.baseline[objective])} tone="text-fg" />
        <Stat
          label="Écart"
          value={`${gain >= 0 ? '+' : ''}${formatEuro(gain)}`}
          tone={gain >= 0 ? 'text-positive' : 'text-negative'}
        />
      </div>

      <dl className="grid gap-x-6 gap-y-1 card p-3 text-sm sm:grid-cols-2">
        <Row label="Salaire net annuel" value={formatEuro(result.best.executiveNetSalary)} />
        <Row label="Part du résultat distribuée" value={`${Math.round(result.best.payoutRatio * 100)} %`} />
        <Row label="Dividende brut" value={formatEuro(result.best.dividendGross)} />
        <Row label="Cotisations sociales" value={formatEuro(result.best.socialCharges)} />
        <Row label="IS dû" value={formatEuro(result.best.corporateTaxDue)} />
        <Row label="TMI atteinte" value={`${Math.round(result.best.marginalRate * 100)} %`} />
      </dl>

      <figure className="m-0 card p-3">
        <figcaption className="mb-2 text-xs text-fg-muted">
          {OBJECTIVES.find(([id]) => id === objective)?.[1]} selon le salaire net, à{' '}
          {Math.round(result.best.payoutRatio * 100)} % de distribution. Échelle verticale
          tronquée : {formatEuro(yMin)} → {formatEuro(yMax)}.
        </figcaption>
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="block w-full"
          role="img"
          aria-label={`Courbe du cash selon le salaire net, optimum à ${formatEuro(result.best.executiveNetSalary)}`}
          onMouseMove={pickNearest}
          onMouseLeave={() => setHovered(null)}
        >
          <line
            x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom}
            stroke="var(--border)" strokeWidth="1"
          />
          <path d={path} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" />
          <circle
            cx={x(result.best.executiveNetSalary)} cy={y(result.best[objective])} r="4.5"
            fill="var(--accent)" stroke="var(--surface)" strokeWidth="2"
          />
          {active && (
            <>
              <line
                x1={x(active.executiveNetSalary)} x2={x(active.executiveNetSalary)}
                y1={PAD.top} y2={H - PAD.bottom}
                stroke="var(--border-strong)" strokeWidth="1"
              />
              <circle
                cx={x(active.executiveNetSalary)} cy={y(active[objective])} r="4"
                fill="var(--surface)" stroke="var(--accent)" strokeWidth="2"
              />
            </>
          )}
          <text x={PAD.left} y={H - 6} className="fill-fg-muted text-xs">0 €</text>
          <text x={W - PAD.right} y={H - 6} textAnchor="end" className="fill-fg-muted text-xs">
            {formatEuro(xMax)}
          </text>
        </svg>
        <p className="m-0 min-h-5 text-xs text-fg-muted" aria-live="polite">
          {active
            ? `Salaire ${formatEuro(active.executiveNetSalary)} → ${formatEuro(active[objective])}`
            : 'Survolez la courbe pour lire un point.'}
        </p>
      </figure>

      <details className="disclosure card p-3 text-sm">
        <summary className="min-h-11 cursor-pointer text-fg">Voir les valeurs balayées</summary>
        <table className="mt-2 w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs font-medium text-fg-muted">
              <th scope="col" className="py-1 pr-3 font-medium">Salaire net</th>
              <th scope="col" className="py-1 pr-3 font-medium">Dividende brut</th>
              <th scope="col" className="py-1 font-medium">Objectif</th>
            </tr>
          </thead>
          <tbody className="font-amount">
            {series.map((p) => (
              <tr key={p.executiveNetSalary} className="border-t border-border">
                <td className="py-1 pr-3">{formatEuro(p.executiveNetSalary)}</td>
                <td className="py-1 pr-3">{formatEuro(p.dividendGross)}</td>
                <td className="py-1">{formatEuro(p[objective])}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>

      <details className="disclosure card p-3 text-sm">
        <summary className="min-h-11 cursor-pointer text-fg">
          D’où viennent les cotisations ({(URSSAF_EMPLOYEE_RATE_2026.value * 100).toFixed(2)} %
          salariales + {(URSSAF_EMPLOYER_RATE_2026.value * 100).toFixed(2)} % patronales)
        </summary>
        <ul className="mt-2 space-y-2">
          {URSSAF_BRANCHES_2026.map((branch) => (
            <li key={branch.label} className="border-t border-border pt-2 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <span className="text-fg">{branch.label}</span>
                <span className="font-amount text-fg-muted">
                  {(branch.employee * 100).toFixed(2)} % / {(branch.employer * 100).toFixed(2)} %
                </span>
              </div>
              <p className="m-0 text-xs text-fg-muted">
                {branch.status === 'verified' ? '' : `[${branch.status}] `}
                {branch.source}
              </p>
              {branch.note && <p className="m-0 text-xs text-fg-muted">{branch.note}</p>}
            </li>
          ))}
        </ul>
      </details>

      <div className="rounded-md bg-negative-soft p-3">
        <h3 className="m-0 text-sm font-semibold text-fg">Ce que ce balayage ne voit pas</h3>
        <ul className="mt-2 list-disc space-y-1 pl-4 text-sm text-fg-muted">
          {result.warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      </div>

      <div>
        <button
          type="button"
          onClick={() => onApply(result.best)}
          className="btn"
        >
          Appliquer au simulateur
        </button>
      </div>
    </section>
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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border py-1 last:border-b-0">
      <dt className="text-fg-muted">{annotate(label)}</dt>
      <dd className="m-0 font-amount text-fg">{value}</dd>
    </div>
  );
}
