import { MetricBadge } from '@/components/common/MetricBadge';
import type { WhatIfInputs } from '@/core/engine';

export type WhatIfSlidersProps = {
  values: WhatIfInputs;
  /** Resolved/preset seeds when a whatIf key is unset. */
  defaults?: Partial<WhatIfInputs>;
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
    label: 'Salaire net',
    min: 0,
    max: 120_000,
    step: 1_000,
    defaultValue: 36_000,
  },
  {
    key: 'dividendAmount',
    label: 'Dividendes',
    min: 0,
    max: 200_000,
    step: 1_000,
    defaultValue: 20_000,
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
        <h2 className="m-0 text-[0.65rem] font-semibold uppercase tracking-wide text-fg-muted">
          What-If
        </h2>
        {onReset ? (
          <button
            type="button"
            onClick={onReset}
            className="border border-border px-2 py-0.5 text-[0.65rem] text-fg-muted hover:border-border-strong hover:text-fg"
          >
            Réinitialiser
          </button>
        ) : null}
      </div>

      <ul className="m-0 flex list-none flex-col gap-3 p-0">
        {SLIDERS.map((def) => {
          const value = readValue(values, def, defaults);
          const inputId = `what-if-${def.key}`;
          return (
            <li key={def.key} className="flex flex-col gap-1">
              <div className="flex items-baseline justify-between gap-2">
                <label htmlFor={inputId} className="text-xs font-medium text-fg">
                  {def.label}
                </label>
                <MetricBadge amount={value} tone="cash" fractionDigits={0} />
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
                className="w-full accent-[var(--flow-vat)]"
                aria-valuetext={`${value} euros`}
              />
            </li>
          );
        })}
      </ul>
    </section>
  );
}
