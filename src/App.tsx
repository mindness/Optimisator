import { lazy, Suspense, useEffect, useMemo, useState, type ReactNode } from 'react';

import { FlowCanvas } from '@/components/canvas/FlowCanvas';
import { DisclaimerBanner } from '@/components/common/DisclaimerBanner';
import { Glossary } from '@/components/common/Glossary';
import { KpiTile } from '@/components/common/KpiTile';
import { ThemeToggle } from '@/components/common/ThemeToggle';
import { FlowInspector } from '@/components/inspector/FlowInspector';
const ScenarioWorkspace = lazy(() =>
  import('@/components/controls/ScenarioWorkspace').then((m) => ({ default: m.ScenarioWorkspace })),
);
import {
  LayerSwitcher,
  MoneyTracer,
  ShareModal,
  TimelineBar,
  WhatIfSliders,
} from '@/components/controls';
import { ScenarioFileButtons } from '@/components/controls/ScenarioFileButtons';
const Optimizer = lazy(() =>
  import('@/components/controls/Optimizer').then((m) => ({ default: m.Optimizer })),
);
const Forecast = lazy(() =>
  import('@/components/controls/Forecast').then((m) => ({ default: m.Forecast })),
);
const StructureComparator = lazy(() =>
  import('@/components/controls/StructureComparator').then((m) => ({
    default: m.StructureComparator,
  })),
);
const SynthesePreview = lazy(() => import('@/previews/SynthesePreview').then((m) => ({ default: m.SynthesePreview })));
import { resolveScenarioGraph } from '@/core/engine';
import {
  FREELANCE_SASU_PRESET,
  FULL_GROUP_PRESET,
  SASU_HOLDING_PRESET,
} from '@/core/presets';
import type { FlowEdgeData, ScenarioState } from '@/core/types';
import {
  buildViewFlows,
  hasLocalDraft,
  useSimulation,
  whatIfDefaultsFromResolved,
} from '@/hooks/useSimulation';
import { useTimeline } from '@/hooks/useTimeline';
import { parseShareBootIntent, resolveShareBootPayload } from '@/hooks/useUrlState';

const PRESETS: ScenarioState[] = [
  FREELANCE_SASU_PRESET,
  SASU_HOLDING_PRESET,
  FULL_GROUP_PRESET,
];

type ViewId = null | 'architecture' | 'optimisation' | 'structures' | 'projection' | 'synthese';

const Icon = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
);

const VIEWS: ReadonlyArray<{ id: ViewId; label: string; icon: string; help: string }> = [
  { id: null, label: 'Simulation', icon: 'M4 12h4l3-8 4 16 3-8h2', help: 'Le schéma des flux et la synthèse, recalculés en direct.' },
  { id: 'architecture', label: 'Architecture', icon: 'M4 6h6v6H4zM14 12h6v6h-6zM10 9h4v6', help: 'Construire ou modifier le montage : entités, détentions, conventions.' },
  { id: 'optimisation', label: 'Optimisation', icon: 'M3 17l6-6 4 4 8-8M14 7h7v7', help: 'Balayer l’arbitrage rémunération / dividendes.' },
  { id: 'structures', label: 'Structures', icon: 'M4 4h16v6H4zM4 14h7v6H4zM13 14h7v6h-7', help: 'Comparer SASU, EURL, holding… à hypothèses égales.' },
  { id: 'projection', label: 'Projection', icon: 'M3 20h18M6 16V9M11 16V5M16 16v-6M21 16v-3', help: 'Projeter la trésorerie sur plusieurs exercices.' },
];

const DOCS: ReadonlyArray<{ id: ViewId; label: string }> = [
  { id: 'synthese', label: 'Synthèse' },
];

const GUIDE_HIDDEN_KEY = 'optimisator.guide.hidden';

const STEPS = [
  { n: 1, label: 'Structure', help: 'Choisissez un point de départ, ou dessinez le vôtre dans Architecture.' },
  { n: 2, label: 'Hypothèses', help: 'Réglez CA, charges, salaire, dividendes dans le panneau de droite.' },
  { n: 3, label: 'Flux', help: 'Cliquez un flux sur le schéma pour lire son calcul et sa base légale.' },
  { n: 4, label: 'Synthèse', help: 'Les tuiles du haut montrent l’écart avec votre point de départ.' },
];

function Loading({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-3 p-4 lg:p-6" role="status" aria-live="polite" aria-busy="true">
      <p className="m-0 text-sm text-fg-muted">{children}</p>
      <div className="skeleton h-9 w-72" />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
        <div className="skeleton h-20" />
      </div>
      <div className="skeleton h-64" />
    </div>
  );
}

export default function App() {
  const simulation = useSimulation();
  const timeline = useTimeline(simulation.scenario);
  const [selectedFlowId, setSelectedFlowId] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [previewId, setPreviewId] = useState<ViewId>(null);
  // Le guide 1→4 se masque une fois lu ; la préférence survit au rechargement.
  const [guideHidden, setGuideHidden] = useState(() => localStorage.getItem(GUIDE_HIDDEN_KEY) === '1');
  const toggleGuide = (hidden: boolean) => {
    setGuideHidden(hidden);
    if (hidden) localStorage.setItem(GUIDE_HIDDEN_KEY, '1'); else localStorage.removeItem(GUIDE_HIDDEN_KEY);
  };
  // Le squelette n'apparaît que si l'URL porte un scénario à résoudre : sinon le preset est déjà là.
  const [bootStatus, setBootStatus] = useState<'idle' | 'loading' | 'ready'>(
    () => (parseShareBootIntent().kind === 'none' ? 'idle' : 'loading'),
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

  // Point de départ = le scénario sans aucun What-If : les tuiles affichent l'écart avant la valeur.
  const baseline = useMemo(
    () => resolveScenarioGraph(simulation.scenario, {}).summary,
    [simulation.scenario],
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
          // Un lien partagé écrase le brouillon local : on ne le fait sans
          // demander que si aucun travail en cours n'est en jeu.
          const overwrite = !hasLocalDraft() || window.confirm(
            'Ouvrir ce lien remplacera votre scénario en cours, enregistré dans ce navigateur. Continuer ?',
          );
          if (overwrite) {
            simulation.hydrateFromShare(payload);
          } else {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
          }
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

  // Changer de scénario invalide la sélection : ajusté pendant le rendu, un
  // effet forcerait un second rendu avec un flux sélectionné devenu fantôme.
  const [seenScenarioId, setSeenScenarioId] = useState(simulation.scenario.id);
  if (seenScenarioId !== simulation.scenario.id) {
    setSeenScenarioId(simulation.scenario.id);
    setSelectedFlowId(null);
  }

  // Échap referme l'inspecteur de flux ; la modale de partage gère sa propre touche.
  useEffect(() => {
    if (!selectedFlowId || shareOpen) return;
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setSelectedFlowId(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedFlowId, shareOpen]);

  const handleFlowSelect = (flow: FlowEdgeData) => {
    setSelectedFlowId(flow.id);
  };

  const summary = simulation.resolved.summary;
  const urssaf = (s: typeof summary) => s.executiveSalary.employerCharges + s.executiveSalary.employeeCharges;
  const currentView = VIEWS.find((v) => v.id === previewId);
  const currentDoc = DOCS.find((d) => d.id === previewId);
  const isDoc = Boolean(currentDoc);
  const hasNegativeTreasury = simulation.resolved.entities.some((entity) => (entity.metrics.treasury ?? 0) < 0);

  return (
    <div className="app-shell flex min-h-dvh flex-col bg-canvas lg:h-dvh lg:flex-row lg:overflow-hidden print:!h-auto print:!overflow-visible" data-boot={bootStatus}>
      <aside className="flex shrink-0 print:hidden flex-col border-b border-border bg-surface lg:w-[232px] lg:border-r lg:border-b-0">
        <div className="flex items-center gap-2.5 px-4 py-3.5 lg:py-4">
          <span className="grid size-8 shrink-0 place-items-center rounded-md bg-accent text-accent-fg" aria-hidden>
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round"><path d="M4 14l5-5 4 4 7-7M14 6h6v6" /></svg>
          </span>
          <div className="min-w-0">
            <h1 className="m-0 text-sm font-semibold leading-tight tracking-tight text-fg">
              Simulateur de Flux d&apos;Entreprise
            </h1>
            <p className="m-0 text-xs text-fg-muted">Simulation pédagogique</p>
          </div>
        </div>

        <nav className="nav-scroll flex gap-1 overflow-x-auto px-3 pb-2 lg:flex-1 lg:flex-col lg:px-3 lg:pb-3" aria-label="Vues du simulateur">
          <p className="m-0 hidden px-2.5 pb-1 pt-2 text-[0.6875rem] font-semibold text-fg-muted lg:block">Piloter</p>
          {VIEWS.map((view) => (
            <button key={view.label} type="button" onClick={() => setPreviewId(view.id)}
              aria-pressed={previewId === view.id} title={view.help}
              className="nav-item w-auto shrink-0 lg:w-full">
              <Icon d={view.icon} />
              {view.label}
            </button>
          ))}
          <p className="m-0 hidden px-2.5 pb-1 pt-4 text-[0.6875rem] font-semibold text-fg-muted lg:block">Documents</p>
          {DOCS.map((doc) => (
            <button key={doc.label} type="button" onClick={() => setPreviewId(doc.id)}
              aria-pressed={previewId === doc.id}
              className="nav-item w-auto shrink-0 lg:w-full">
              <Icon d="M6 3h8l4 4v14H6zM14 3v4h4M9 13h6M9 17h6" />
              {doc.label}
            </button>
          ))}
          <div className="hidden flex-1 lg:block" />
          {guideHidden && (
            <button type="button" className="nav-item w-auto shrink-0 lg:w-full" onClick={() => { toggleGuide(false); setPreviewId(null); }}>
              <Icon d="M12 17v.01M12 14a2.5 2.5 0 1 0-2.5-2.5M3 12a9 9 0 1 0 18 0 9 9 0 0 0-18 0" />
              Afficher le guide
            </button>
          )}
          <ThemeToggle className="w-auto shrink-0 lg:w-full" />
        </nav>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-surface px-4 py-3 lg:px-6">
          <div className="min-w-0">
            <h2 className="m-0 truncate text-lg font-semibold tracking-tight text-fg">
              {currentView?.id ? currentView.label : currentDoc ? currentDoc.label : simulation.scenario.name}
            </h2>
            <p className="m-0 text-xs text-fg-muted">
              {currentView ? currentView.help : 'Les chiffres de la simulation en cours, à imprimer pour votre rendez-vous.'}
              <span className="print:hidden"> · Enregistré automatiquement dans ce navigateur.</span>
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <label className="flex items-center gap-2 text-xs font-medium text-fg-muted">
              <span className="sr-only">Point de départ</span>
              <select
                className="field w-auto max-w-[16rem]"
                value={simulation.scenario.id}
                aria-label="Choisir un preset de structure"
                data-testid="preset-select"
                onChange={(e) => {
                  const next = PRESETS.find((p) => p.id === e.target.value);
                  if (next) simulation.setScenario(next);
                }}
              >
                {!PRESETS.some((preset) => preset.id === simulation.scenario.id) && (
                  <option value={simulation.scenario.id}>{simulation.scenario.name}</option>
                )}
                {PRESETS.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>
            {previewId !== 'architecture' && <ScenarioFileButtons
              scenario={simulation.scenario}
              whatIf={simulation.whatIf}
              onImport={(scenario, whatIf) => {
                simulation.setScenario(scenario);
                simulation.setWhatIf(whatIf);
                setPreviewId(null);
              }}
            />}
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              className="btn btn-primary"
              aria-haspopup="dialog"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7M12 15V3M8 7l4-4 4 4" /></svg>
              Partager
            </button>
          </div>
        </header>

        {shareOpen && (
          <ShareModal
            open={shareOpen}
            onClose={() => setShareOpen(false)}
            payload={sharePayload}
          />
        )}

        {previewId === 'architecture' && (
          <Suspense fallback={<Loading>Chargement de l’atelier…</Loading>}>
            <ScenarioWorkspace initialScenario={simulation.scenario} whatIf={simulation.whatIf}
              onApply={(scenario) => { simulation.setScenario(scenario); setPreviewId(null); }} />
          </Suspense>
        )}
        {previewId === 'optimisation' && (
          <Suspense fallback={<Loading>Chargement du balayage…</Loading>}>
            <Optimizer
              scenario={simulation.scenario}
              whatIf={simulation.whatIf}
              onApply={(point) => {
                simulation.setWhatIf({
                  executiveNetSalary: point.executiveNetSalary,
                  dividendAmount: point.dividendGross,
                });
                setPreviewId(null);
              }}
            />
          </Suspense>
        )}
        {previewId === 'structures' && (
          <Suspense fallback={<Loading>Chargement du comparateur…</Loading>}>
            <StructureComparator whatIf={simulation.whatIf} onChange={simulation.setWhatIf} defaults={whatIfDefaults} />
          </Suspense>
        )}
        {previewId === 'projection' && (
          <Suspense fallback={<Loading>Chargement de la projection…</Loading>}>
            <Forecast scenario={simulation.scenario} whatIf={simulation.whatIf} />
          </Suspense>
        )}
        {isDoc && (
          <div className="min-h-0 flex-1 overflow-auto">
            <Suspense fallback={<Loading>Chargement…</Loading>}>
              <SynthesePreview name={simulation.scenario.name} resolved={simulation.resolved} />
            </Suspense>
          </div>
        )}

        {!previewId && bootStatus === 'loading' && (
          <div className="flex flex-1 flex-col gap-3 p-3 lg:p-4" role="status" aria-busy="true" aria-label="Chargement du scénario partagé">
            <div className="skeleton h-5 w-2/3" />
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
              {Array.from({ length: 6 }, (_, i) => <div key={i} className="skeleton h-[5.5rem]" />)}
            </div>
            <div className="flex min-h-0 flex-1 gap-3">
              <div className="skeleton min-h-[20rem] flex-1" />
              <div className="skeleton hidden w-[320px] lg:block" />
            </div>
          </div>
        )}
        {!previewId && bootStatus !== 'loading' && (
          <main className="flex min-h-0 flex-1 flex-col gap-3 p-3 lg:overflow-hidden lg:p-4">
            {!guideHidden && (
            <div className="flex items-start gap-2">
            <details className="disclosure steps-guide min-w-0 flex-1" aria-label="Comment utiliser le simulateur">
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-5 gap-y-1 text-xs text-fg-muted">
                {STEPS.map((step) => (
                  <span key={step.n} className="flex items-center gap-1.5">
                    <span className="step-no">{step.n}</span>
                    <span className="font-medium text-fg">{step.label}</span>
                    <span className="hidden xl:inline">· {step.help}</span>
                  </span>
                ))}
                <span className="xl:hidden">Comment ça marche ?</span>
              </summary>
              <ol className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-xs text-fg-muted xl:hidden">
                {STEPS.map((step) => (
                  <li key={step.n} className="flex gap-1.5"><span className="step-no">{step.n}</span>{step.help}</li>
                ))}
              </ol>
            </details>
            <button type="button" className="btn btn-ghost btn-sm shrink-0 px-2 py-0 text-xs" onClick={() => toggleGuide(true)}
              title="Masquer le guide — il reste disponible dans la barre latérale">
              Masquer
            </button>
            </div>
            )}

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6" aria-label="Synthèse scénario">
              <KpiTile label="Chiffre d’affaires HT" value={summary.caHt} baseline={baseline.caHt} />
              <KpiTile label="Impôt sur les sociétés" value={summary.corporateTax.taxDue} baseline={baseline.corporateTax.taxDue} direction="cost" />
              <KpiTile label="Cotisations URSSAF" value={urssaf(summary)} baseline={urssaf(baseline)} direction="cost" />
              <KpiTile label="Cash groupe" value={summary.netGroupCash} baseline={baseline.netGroupCash} />
              <KpiTile label="Cash perso net" value={summary.netPersonalCash} baseline={baseline.netPersonalCash} hint="Après URSSAF, IS et IR personnel" />
              <KpiTile label="Tranche marginale IR" value={summary.personalIncomeTax.marginalRate} baseline={baseline.personalIncomeTax.marginalRate} unit="percent" direction="cost"
                hint={`Taux moyen : ${(summary.personalIncomeTax.averageRate * 100).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} %`} />
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-3 lg:flex-row">
              <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-3">
                <FlowCanvas
                  scenario={simulation.scenario}
                  entities={simulation.resolved.entities}
                  flows={visibleFlows}
                  showOwnership={simulation.activeLayers.includes('legal')}
                  selectedFlowId={selectedFlowId}
                  onFlowSelect={handleFlowSelect}
                  className="card overflow-hidden"
                />
                <TimelineBar timeline={timeline} />
              </div>

              <aside className="card flex w-full shrink-0 flex-col gap-5 p-4 lg:w-[320px] lg:overflow-y-auto" aria-label="Panneau latéral">
                {selectedFlow ? (
                  <FlowInspector
                    flow={selectedFlow}
                    entities={simulation.scenario.entities}
                    taxResult={selectedFlow?.taxResult}
                    onClose={() => setSelectedFlowId(null)}
                  />
                ) : (
                  <>
                    {hasNegativeTreasury && (
                      <p role="alert" className="m-0 rounded-md bg-negative-soft px-3 py-2 text-xs text-negative">
                        Trésorerie négative : scénario non financé. Réduisez les sorties ou modélisez le financement avant toute décision.
                      </p>
                    )}
                    <WhatIfSliders
                      values={simulation.whatIf}
                      defaults={whatIfDefaults}
                      hasHolding={simulation.scenario.entities.some((entity) =>
                        entity.entityType === 'holding_sas' || entity.entityType === 'holding_sarl',
                      )}
                      hasSci={simulation.scenario.entities.some((entity) =>
                        entity.entityType === 'sci_is' || entity.entityType === 'sci_ir',
                      )}
                      marginalRate={summary.personalIncomeTax.marginalRate}
                      appliedDividendMode={summary.dividendTaxMode}
                      onChange={simulation.setWhatIf}
                      onReset={simulation.resetWhatIf}
                    />
                    <hr className="m-0 border-0 border-t border-border" />
                    <LayerSwitcher
                      activeLayers={simulation.activeLayers}
                      onToggle={simulation.toggleLayer}
                      onSelectLayers={simulation.setActiveLayers}
                    />
                    <hr className="m-0 border-0 border-t border-border" />
                    <MoneyTracer
                      moneyTrace={simulation.moneyTrace}
                      onInject={simulation.injectMoneyTrace}
                      onClear={simulation.clearMoneyTrace}
                      defaultAmount={summary.caHt || 10_000}
                    />
                    <details className="disclosure border-t border-border pt-3 text-xs text-fg-muted">
                      <summary className="cursor-pointer text-xs font-medium text-fg-muted">
                        Limites du modèle ({simulation.resolved.warnings.length})
                      </summary>
                      <ul className="m-0 mt-2 list-disc space-y-1.5 pl-4 leading-relaxed">
                        {simulation.resolved.warnings.map((warning) => <li key={warning}>{warning}</li>)}
                      </ul>
                    </details>
                    <Glossary className="border-t border-border pt-3" />
                  </>
                )}
              </aside>
            </div>
          </main>
        )}

        <footer className="shrink-0 border-t border-border bg-surface px-4 py-2 lg:px-6">
          <DisclaimerBanner className="border-0 bg-transparent p-0 text-xs" />
        </footer>
      </div>
    </div>
  );
}
