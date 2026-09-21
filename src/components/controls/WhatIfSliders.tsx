import type { CSSProperties } from 'react';

import { annotate } from '@/components/common/Glossary';
import { EditableAmount } from '@/components/common/EditableAmount';
import { formatPercent, MetricBadge } from '@/components/common/MetricBadge';
import { PFU_TOTAL_RATE, type WhatIfInputs } from '@/core/engine';

/** Libellé tiré du taux du moteur : l'interface ne peut pas afficher un autre PFU que celui calculé. */
const PFU_LABEL = `PFU ${formatPercent(PFU_TOTAL_RATE.value, 1)}`;

export type WhatIfSlidersProps = {
  values: WhatIfInputs;
  /** Resolved/preset seeds when a whatIf key is unset. */
  defaults?: Partial<WhatIfInputs>;
  hasHolding?: boolean;
  hasSci?: boolean;
  /** TMI résolue du foyer, affichée en regard du profil fiscal. */
  marginalRate?: number;
  /** Régime effectivement retenu pour les dividendes (utile en mode auto). */
  appliedDividendMode?: 'pfu' | 'bareme';
  onChange: (patch: Partial<WhatIfInputs>) => void;
  onReset?: () => void;
  className?: string;
};

type SliderDef = {
  key: keyof WhatIfInputs;
  label: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
};

const SLIDERS: SliderDef[] = [
  {
    key: 'caHt',
    label: 'CA HT',
    min: 0,
    max: 500_000,
    step: 1_000,
    defaultValue: 120_000,
  },
  {
    key: 'expensesHt',
    label: 'Charges HT',
    min: 0,
    max: 200_000,
    step: 1_000,
    defaultValue: 24_000,
  },
  {
    key: 'executiveNetSalary',
    label: 'Salaire net avant IR',
    min: 0,
    max: 120_000,
    step: 1_000,
    defaultValue: 36_000,
  },
  {
    key: 'dividendAmount',
    label: 'Dividendes SASU',
    min: 0,
    max: 200_000,
    step: 1_000,
    defaultValue: 20_000,
  },
  {
    key: 'holdingDividendAmount',
    label: 'Dividendes holding → personne',
    min: 0,
    max: 200_000,
    step: 1_000,
    defaultValue: 0,
  },
  {
    key: 'sciRentHt',
    label: 'Loyer SCI HT',
    min: 0,
    max: 60_000,
    step: 500,
    defaultValue: 12_000,
  },
];

function readValue(
  values: WhatIfInputs,
  def: SliderDef,
  defaults?: Partial<WhatIfInputs>,
): number {
  const raw = values[def.key];
  if (typeof raw === 'number') return raw;
  const seeded = defaults?.[def.key];
  if (typeof seeded === 'number') return seeded;
  return def.defaultValue;
}

export function WhatIfSliders({
  values,
  defaults,
  hasHolding = false,
  hasSci = false,
  marginalRate,
  appliedDividendMode,
  onChange,
  onReset,
  className = '',
}: WhatIfSlidersProps) {
  return (
    <section
      className={`flex flex-col gap-3 ${className}`.trim()}
      data-testid="what-if-sliders"
      aria-label="Curseurs What-If"
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="panel-title">Hypothèses</h2>
        {onReset ? (
          <button type="button" onClick={onReset} className="btn btn-ghost btn-sm">
            Réinitialiser
          </button>
        ) : null}
      </div>

      <p className="panel-help">
        Montants annuels. Glissez un curseur ou cliquez un montant pour le saisir : le schéma et la
        synthèse se recalculent aussitôt.
      </p>
      <ul className="m-0 flex list-none flex-col gap-3.5 p-0">
        {SLIDERS.filter((def) => (hasHolding || def.key !== 'holdingDividendAmount') && (hasSci || def.key !== 'sciRentHt')).map((def) => {
          const value = readValue(values, def, defaults);
          const inputId = `what-if-${def.key}`;
          // Un montant saisi peut dépasser la course du curseur : le remplissage plafonne à 100 %.
          const fill = `${Math.min(1, (value - def.min) / (def.max - def.min)) * 100}%`;
          const modified = typeof values[def.key] === 'number' && values[def.key] !== readValue({}, def, defaults);
          return (
            <li key={def.key} className="flex flex-col gap-0.5">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={inputId} className="text-xs font-medium text-fg">
                  {annotate(def.label)}
                </label>
                <span className="flex items-baseline gap-1">
                  {modified ? (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm px-1 py-0 text-xs"
                      onClick={() => onChange({ [def.key]: undefined } as Partial<WhatIfInputs>)}
                      aria-label={`Revenir à la valeur d’origine — ${def.label}`}
                      title="Revenir à la valeur d’origine"
                    >
                      ↺
                    </button>
                  ) : null}
                  <EditableAmount
                    label={def.label}
                    hideLabel
                    value={value}
                    onChange={(next) => onChange({ [def.key]: next } as Partial<WhatIfInputs>)}
                  />
                </span>
              </div>
              <input
                id={inputId}
                type="range"
                min={def.min}
                max={def.max}
                step={def.step}
                value={value}
                onChange={(e) =>
                  onChange({ [def.key]: Number(e.target.value) } as Partial<WhatIfInputs>)
                }
                style={{ '--fill': fill } as CSSProperties}
                aria-valuetext={`${value} euros`}
              />
            </li>
          );
        })}
      </ul>

      <fieldset className="m-0 flex flex-col gap-2.5 rounded-md bg-surface-sunken p-3">
        <legend className="sr-only">Foyer fiscal</legend>
        <p className="m-0 text-xs font-semibold text-fg">Foyer fiscal</p>

        <div className="flex flex-col gap-1">
          <label htmlFor="what-if-situation" className="text-xs font-medium text-fg">
            Situation
          </label>
          <select
            id="what-if-situation"
            value={values.situation ?? 'single'}
            onChange={(e) => onChange({ situation: e.target.value as 'single' | 'couple' })}
            className="field field-sm"
          >
            <option value="single">Célibataire</option>
            <option value="couple">Couple (imposition commune)</option>
          </select>
        </div>

        <div className="flex items-center justify-between gap-2">
          <label htmlFor="what-if-parts" className="text-xs font-medium text-fg">
            Parts de quotient familial
          </label>
          <input
            id="what-if-parts"
            type="number"
            min={1}
            max={10}
            step={0.5}
            value={values.parts ?? (values.situation === 'couple' ? 2 : 1)}
            onChange={(e) => onChange({ parts: Math.max(1, Number(e.target.value)) })}
            className="field field-sm font-amount w-16 text-right"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="what-if-dividend-mode" className="text-xs font-medium text-fg">
            Imposition des dividendes
          </label>
          <select
            id="what-if-dividend-mode"
            value={values.dividendTaxMode ?? 'auto'}
            onChange={(e) =>
              onChange({ dividendTaxMode: e.target.value as 'auto' | 'pfu' | 'bareme' })
            }
            className="field field-sm"
          >
            <option value="auto">Automatique (le moins coûteux)</option>
            <option value="pfu">{PFU_LABEL}</option>
            <option value="bareme">Barème + abattement 40 %</option>
          </select>
        </div>

        {marginalRate !== undefined ? (
          <MetricBadge amount={marginalRate} label="Tranche marginale du foyer" unit="percent" tone="neutral" />
        ) : null}

        {appliedDividendMode && (values.dividendTaxMode ?? 'auto') === 'auto' ? (
          <p className="panel-help">
            Régime retenu : {appliedDividendMode === 'pfu' ? PFU_LABEL : 'barème (option globale)'}.
            L’option barème engage tous les revenus de capitaux mobiliers du foyer.
          </p>
        ) : null}
      </fieldset>
    </section>
  );
}
