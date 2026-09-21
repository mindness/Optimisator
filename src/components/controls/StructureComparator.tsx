import { useMemo, useState } from 'react';

import { annotate } from '@/components/common/Glossary';
import { formatEuro, formatPercent } from '@/components/common/MetricBadge';
import {
  compareStructures,
  MICRO_BRACKETS_2026,
  type MicroCategory,
  type StructureId,
  type StructureOutcome,
  type WhatIfInputs,
} from '@/core/engine';

export type StructureComparatorProps = {
  whatIf: WhatIfInputs;
  /** Persiste coûts de structure et capital avec les autres hypothèses (JSON exporté, lien de partage). */
  onChange?: (patch: Partial<WhatIfInputs>) => void;
  /** Seeds CA / charges from the live scenario when What-If leaves them unset. */
  defaults?: Partial<WhatIfInputs>;
  className?: string;
};

const amount = (value: unknown, fallback: number) => {
  const parsed = typeof value === 'string' && value !== '' ? Number(value) : value;
  return typeof parsed === 'number' && Number.isFinite(parsed) ? Math.max(0, parsed) : fallback;
};

const MICRO_OPTIONS = Object.entries(MICRO_BRACKETS_2026) as Array<
  [MicroCategory, (typeof MICRO_BRACKETS_2026)[MicroCategory]]
>;

export function StructureComparator({ whatIf, onChange, defaults, className = '' }: StructureComparatorProps) {
  const [microCategory, setMicroCategory] = useState<MicroCategory>('bnc');
  // Un fichier importé n'est pas validé champ par champ : tout ce qui n'est pas un montant vaut 0.
  const capital = amount(whatIf.capitalPrimesAndCca, 1_000);
  const structureCosts = useMemo(
    () => Object.fromEntries(
      Object.entries(whatIf.structureCosts ?? {}).map(([id, cost]) => [id, amount(cost, 0)]),
    ) as Partial<Record<StructureId, number>>,
    [whatIf.structureCosts],
  );

  const caHt = whatIf.caHt ?? defaults?.caHt ?? 120_000;
  const expensesHt = whatIf.expensesHt ?? defaults?.expensesHt ?? 0;

  const comparison = useMemo(
    () =>
      compareStructures({
        caHt,
        expensesHt,
        parts: whatIf.parts,
        situation: whatIf.situation,
        microCategory,
        dividendTaxMode: whatIf.dividendTaxMode,
        capitalPrimesAndCca: capital,
        structureCosts,
      }),
    [caHt, expensesHt, whatIf.parts, whatIf.situation, whatIf.dividendTaxMode, microCategory, capital, structureCosts],
  );

  return (
    <section
      className={`mx-auto flex w-full max-w-5xl min-h-0 flex-1 flex-col gap-4 overflow-auto p-4 ${className}`.trim()}
      aria-label="Comparateur de structures"
      data-testid="structure-comparator"
    >
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="m-0 text-lg font-semibold tracking-tight text-fg">
            Choix de structure — IS, IR, micro
          </h2>
          <p className="mt-0.5 max-w-prose text-sm text-fg-muted">
            À {formatEuro(caHt)} de CA HT et {formatEuro(expensesHt)} de charges, ce qu’il reste net
            au dirigeant selon la forme retenue. Chaque structure est évaluée à son propre optimum de
            partage rémunération / dividendes. Ce classement est une simulation, pas un conseil.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Activité micro
            <select
              className="field w-auto"
              value={microCategory}
              onChange={(e) => setMicroCategory(e.target.value as MicroCategory)}
            >
              {MICRO_OPTIONS.map(([id, bracket]) => (
                <option key={id} value={id}>
                  {bracket.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Capital + CCA
            <input
              type="number"
              min={0}
              step={1_000}
              value={capital}
              onChange={(e) => onChange?.({ capitalPrimesAndCca: amount(e.target.value, 0) })}
              className="field font-amount w-28 text-right"
            />
          </label>
        </div>
      </header>

      <p className="m-0 card p-3 text-sm text-fg">
        <strong className="font-semibold">{comparison.best.label}</strong> arrive en tête avec{' '}
        <span className="font-amount text-flow-cash">{formatEuro(comparison.best.netPersonal)}</span>{' '}
        nets, soit {formatEuro(comparison.gainOverRunnerUp)} de plus que la suivante. Le capital et le
        compte courant saisis fixent la franchise de 10 % sur les dividendes du gérant TNS. Saisissez vos
        propres coûts annuels par structure (expert-comptable, greffe, CFE…) : ils s’ajoutent aux charges.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">Net personnel par structure, classé par ordre décroissant</caption>
          <thead>
            <tr className="border-b border-border text-left text-xs font-medium text-fg-muted">
              <th scope="col" className="py-2 pr-3 font-medium">Structure</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Coût annuel</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Rémunération</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Dividendes</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Cotisations</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{annotate('IS')}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">{annotate('IR + PS')}</th>
              <th scope="col" className="py-2 pr-3 text-right font-medium">Net perso</th>
              <th scope="col" className="py-2 text-right font-medium">Prélèvements</th>
            </tr>
          </thead>
          <tbody>
            {comparison.outcomes.map((outcome) => (
              <StructureRow
                key={outcome.id}
                outcome={outcome}
                isBest={outcome.id === comparison.best.id}
                cost={structureCosts[outcome.id] ?? 0}
                onCostChange={(cost) => onChange?.({ structureCosts: { ...structureCosts, [outcome.id]: cost } })}
              />
            ))}
          </tbody>
        </table>
      </div>

      <details className="card p-3 text-sm">
        <summary className="cursor-pointer text-fg">Limites du comparatif ({comparison.blindSpots.length})</summary>
        <ul className="mt-2 mb-0 flex list-disc flex-col gap-1 pl-5 text-fg-muted">
          {comparison.blindSpots.map((spot) => (
            <li key={spot}>{spot}</li>
          ))}
        </ul>
      </details>
    </section>
  );
}

function StructureRow({ outcome, isBest, cost, onCostChange }: {
  outcome: StructureOutcome;
  isBest: boolean;
  cost: number;
  onCostChange: (cost: number) => void;
}) {
  return (
    <tr className={`border-b border-border align-top ${outcome.eligible ? '' : 'opacity-60'}`}>
      <th scope="row" className="py-2 pr-3 text-left font-normal">
        <span className={`block ${isBest ? 'font-semibold text-fg' : 'text-fg'}`}>{outcome.label}</span>
        <span className="block text-xs text-fg-muted">
          {outcome.eligible
            ? `Rémunération ${formatPercent(outcome.salaryRatio)} du disponible · TMI ${formatPercent(outcome.marginalRate)}`
            : 'Non applicable à ce niveau de CA'}
        </span>
        {outcome.warnings.map((warning) => (
          <span key={warning} className="mt-1 block text-xs text-flow-alert">{warning}</span>
        ))}
      </th>
      <td className="py-2 pr-3 text-right">
        <input
          type="number"
          min={0}
          step={100}
          value={cost}
          onChange={(e) => onCostChange(amount(e.target.value, 0))}
          aria-label={`Coût annuel de structure — ${outcome.label}`}
          className="field font-amount w-24 text-right"
        />
      </td>
      <td className="py-2 pr-3 text-right font-amount">{formatEuro(outcome.salaryCash)}</td>
      <td className="py-2 pr-3 text-right font-amount">
        {formatEuro(outcome.dividendGross)}
        {outcome.dividendTaxMode !== 'none' ? (
          <span className="block text-xs text-fg-muted">
            {outcome.dividendTaxMode === 'pfu' ? 'PFU' : 'barème'}
          </span>
        ) : null}
      </td>
      <td className="py-2 pr-3 text-right font-amount text-flow-social">
        {formatEuro(outcome.socialContributions)}
      </td>
      <td className="py-2 pr-3 text-right font-amount text-flow-is">{formatEuro(outcome.corporateTax)}</td>
      <td className="py-2 pr-3 text-right font-amount text-flow-div">
        {formatEuro(outcome.personalIncomeTax + outcome.dividendTax)}
      </td>
      <td className={`py-2 pr-3 text-right font-amount ${isBest ? 'text-flow-cash' : 'text-fg'}`}>
        {formatEuro(outcome.netPersonal)}
      </td>
      <td className="py-2 text-right font-amount text-fg-muted">{formatPercent(outcome.effectiveRate, 1)}</td>
    </tr>
  );
}
