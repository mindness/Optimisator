import { useEffect, useMemo, useState } from 'react';

import { FlowCanvas } from '@/components/canvas/FlowCanvas';
import { DisclaimerBanner } from '@/components/common/DisclaimerBanner';
import { MetricBadge } from '@/components/common/MetricBadge';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import {
  LayerSwitcher,
  MoneyTracer,
  ShareModal,
  TimelineBar,
  WhatIfSliders,
} from '@/components/controls';
import { KbisPreview } from '@/previews/KbisPreview';
import { LiassePreview } from '@/previews/LiassePreview';
import { TicketPreview } from '@/previews/TicketPreview';
import {
  FREELANCE_SASU_PRESET,
  FULL_GROUP_PRESET,
  SASU_HOLDING_PRESET,
} from '@/core/presets';
import type { FlowEdgeData, ScenarioState } from '@/core/types';
import {
  buildViewFlows,
  useSimulation,
  whatIfDefaultsFromResolved,
} from '@/hooks/useSimulation';
import { useTimeline } from '@/hooks/useTimeline';
import { resolveShareBootPayload } from '@/hooks/useUrlState';

const PRESETS: ScenarioState[] = [
  FREELANCE_SASU_PRESET,
  SASU_HOLDING_PRESET,
  FULL_GROUP_PRESET,
];

export default function App() {
  const simulation = useSimulation();
  const timeline = useTimeline(simulation.scenario);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [bootStatus, setBootStatus] = useState<'idle' | 'loading' | 'ready'>(
    'loading',
  );

  const sharePayload = useMemo(
    () => ({
      scenario: simulation.scenario,
      whatIf: simulation.whatIf,
      activeLayers: simulation.activeLayers,
    }),
    [simulation.scenario, simulation.whatIf, simulation.activeLayers],
  );

  const whatIfDefaults = useMemo(
    () => whatIfDefaultsFromResolved(simulation.resolved),
    [simulation.resolved],
  );

  const visibleFlows = useMemo(() => {
    const views = buildViewFlows(
      simulation.resolved,
      simulation.activeLayers,
      timeline.visibleCategories,
      simulation.moneyTrace,
    );
    return views.filter((f) => !f.hidden);
  }, [
    simulation.resolved,
    simulation.activeLayers,
    timeline.visibleCategories,
    simulation.moneyTrace,
  ]);

  const selectedFlow = useMemo(() => {
    if (!selectedFlowId) return null;
    return (
      simulation.resolved.flows.find((f) => f.id === selectedFlowId) ??
      visibleFlows.find((f) => f.id === selectedFlowId) ??
      null
    );
  }, [selectedFlowId, simulation.resolved.flows, visibleFlows]);

  // Boot: `#s=` lz hash, `?s=` slug, or `/s/:slug` → Zustand.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const payload = await resolveShareBootPayload();
        if (!cancelled && payload) {
          simulation.hydrateFromShare(payload);
        }
      } catch {
        /* keep default preset */
      } finally {
        if (!cancelled) setBootStatus('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
    // Mount-only boot hydrate into Zustand.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once
  }, []);

  useEffect(() => {
    setSelectedFlowId(null);
  }, [simulation.scenario.id]);

  const handleFlowSelect = (flow: FlowEdgeData) => {
    setSelectedFlowId(flow.id);
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-canvas" data-boot={bootStatus}>
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-border px-4 py-3">
        <div>
          <h1 className="m-0 text-xl font-semibold tracking-tight text-fg">
            Simulateur de Flux d&apos;Entreprise
          </h1>
          <p className="mt-0.5 text-sm text-fg-muted">
            SASU · Holding · SCI — simulation pédagogique
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-fg-muted">
            Preset
            <select
              className="border border-border bg-surface px-2 py-1 text-sm text-fg"
              value={simulation.scenario.id}
              aria-label="Choisir un preset de structure"
              data-testid="preset-select"
              onChange={(e) => {
                const next = PRESETS.find((p) => p.id === e.target.value);
                if (next) simulation.setScenario(next);
              }}
            >
              {PRESETS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => setShareOpen(true)}
            className="inline-flex h-11 items-center justify-center border border-border bg-surface px-3 text-sm font-medium text-fg hover:border-border-strong"
            aria-haspopup="dialog"
          >
            Partager
          </button>
          <ThemeToggle />
        </div>
      </header>

      {shareOpen && (
        <ShareModal
          open={shareOpen}
          onClose={() => setShareOpen(false)}
          payload={sharePayload}
        />
      )}

      {previewId === 'kbis' && <KbisPreview />}
      {previewId === 'liasse' && <LiassePreview />}
      {previewId === 'ticket' && <TicketPreview />}

      {!previewId && (
        <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex w-full shrink-0 flex-col gap-4 border-b border-border bg-surface p-3 lg:w-72 lg:border-b-0 lg:border-r lg:overflow-y-auto">
          <LayerSwitcher
            activeLayers={simulation.activeLayers}
            onToggle={simulation.toggleLayer}
          />
          <WhatIfSliders
            values={simulation.whatIf}
            defaults={whatIfDefaults}
            onChange={simulation.setWhatIf}
            onReset={simulation.resetWhatIf}
          />
          <MoneyTracer
            moneyTrace={simulation.moneyTrace}
            onInject={simulation.injectMoneyTrace}
            onClear={simulation.clearMoneyTrace}
            defaultAmount={simulation.resolved.summary.caHt || 10_000}
          />
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <div className="flex gap-2 p-2 bg-surface border-b border-border">
            <button onClick={() => setPreviewId('kbis')} className="text-xs p-2 bg-canvas">Kbis</button>
            <button onClick={() => setPreviewId('liasse')} className="text-xs p-2 bg-canvas">Liasse</button>
            <button onClick={() => setPreviewId('ticket')} className="text-xs p-2 bg-canvas">Ticket</button>
            <button onClick={() => setPreviewId(null)} className="text-xs p-2 bg-canvas">Simulation</button>
          </div>
          <div className="min-h-0 flex-1 px-2 py-2 md:px-3">
            <FlowCanvas
              scenario={simulation.scenario}
              entities={simulation.resolved.entities}
              flows={visibleFlows}
              selectedFlowId={selectedFlowId}
              onFlowSelect={handleFlowSelect}
              className="h-full min-h-[28rem] rounded-sm border border-border"
            />
          </div>

          <TimelineBar timeline={timeline} />

          <div
            className="flex flex-wrap items-center gap-2 border-t border-border bg-surface px-3 py-2 md:px-4"
            aria-label="Synthèse scénario"
          >
            <MetricBadge
              amount={simulation.resolved.summary.caHt}
              label="CA HT"
              tone="cash"
            />
            <MetricBadge
              amount={simulation.resolved.summary.corporateTax.taxDue}
              label="IS"
              tone="is"
            />
            <MetricBadge
              amount={
                simulation.resolved.summary.executiveSalary.employerCharges +
                simulation.resolved.summary.executiveSalary.employeeCharges
              }
              label="URSSAF"
              tone="social"
            />
            <MetricBadge
              amount={simulation.resolved.summary.netGroupCash}
              label="Cash groupe"
              tone="cash"
            />
            <MetricBadge
              amount={simulation.resolved.summary.netPersonalCash}
              label="Cash perso"
              tone="div"
            />
          </div>
        </div>

        <FlowInspector
          flow={selectedFlow}
          taxResult={selectedFlow?.taxResult}
          onClose={() => setSelectedFlowId(null)}
        />
      </div>

      <footer className="shrink-0 border-t border-border bg-canvas px-4 py-2">
        <DisclaimerBanner className="text-xs" />
      </footer>
    </div>
  );
}
