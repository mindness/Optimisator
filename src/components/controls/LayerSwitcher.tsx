import { VIEW_PRESETS } from '@/core/presets';
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
  /** Presets de vue 1-clic : absent → seuls les calques sont proposés. */
  onSelectLayers?: (layers: readonly FlowLayer[]) => void;
  className?: string;
};

function sameLayers(a: Set<FlowLayer>, b: readonly FlowLayer[]): boolean {
  return a.size === b.length && b.every((layer) => a.has(layer));
}

export function LayerSwitcher({
  activeLayers,
  onToggle,
  onSelectLayers,
  className = '',
}: LayerSwitcherProps) {
  const active = new Set(activeLayers);

  return (
    <fieldset
      className={`m-0 flex flex-col gap-2 border-0 p-0 ${className}`.trim()}
      data-testid="layer-switcher"
    >
      <legend className="panel-title mb-1">Calques affichés</legend>
      <p className="panel-help">
        Filtrez le schéma par famille de flux : une vue prête à l’emploi, ou calque par calque.
      </p>
      {onSelectLayers ? (
        <div
          className="flex flex-wrap gap-1.5"
          role="group"
          aria-label="Presets de vue"
          data-testid="view-presets"
        >
          {VIEW_PRESETS.map((preset) => {
            const isOn = sameLayers(active, preset.layers);
            return (
              <button
                key={preset.id}
                type="button"
                aria-pressed={isOn}
                title={preset.description}
                data-view-preset={preset.id}
                onClick={() => onSelectLayers(preset.layers)}
                className="chip"
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      ) : null}
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
              className="chip"
            >
              <span
                className={`size-1.5 rounded-full ${isOn ? 'bg-accent' : 'bg-border-strong'}`}
                aria-hidden
              />
              {LAYER_LABELS[layer]}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
