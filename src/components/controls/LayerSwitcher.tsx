import { FLOW_LAYERS, type FlowLayer } from '@/core/types';

const LAYER_LABELS: Record<FlowLayer, string> = {
  treasury: 'Trésorerie',
  vat: 'TVA',
  tax: 'IS / IR',
  social: 'Social',
  legal: 'Juridique',
};

export type LayerSwitcherProps = {
  activeLayers: readonly FlowLayer[];
  onToggle: (layer: FlowLayer) => void;
  className?: string;
};

export function LayerSwitcher({
  activeLayers,
  onToggle,
  className = '',
}: LayerSwitcherProps) {
  const active = new Set(activeLayers);

  return (
    <fieldset
      className={`m-0 border-0 p-0 ${className}`.trim()}
      data-testid="layer-switcher"
    >
      <legend className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-fg-muted">
        Calques
      </legend>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Calques thématiques">
        {FLOW_LAYERS.map((layer) => {
          const isOn = active.has(layer);
          return (
            <button
              key={layer}
              type="button"
              aria-pressed={isOn}
              data-layer={layer}
              onClick={() => onToggle(layer)}
              className={[
                'border px-2 py-1 text-xs font-medium',
                isOn
                  ? 'border-flow-vat bg-flow-vat/12 text-fg'
                  : 'border-border bg-canvas text-fg-muted hover:border-border-strong',
              ].join(' ')}
            >
              {LAYER_LABELS[layer]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
