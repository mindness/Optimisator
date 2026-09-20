import { useState } from 'react';
import { ENTITY_DRAG_TYPE, FlowCanvas } from '@/components/canvas/FlowCanvas';
import { formatEuro } from '@/components/common/MetricBadge';
import { resolveScenarioGraph, type WhatIfInputs } from '@/core/engine';
import {
  ENTITY_TYPES,
  ENTITY_TYPE_LABELS,
  FLOW_CATEGORIES,
  FLOW_LAYERS,
  FLOW_PERIODICITIES,
  type EntityNodeData,
  type EntityType,
  type FlowEdgeData,
  type ScenarioState,
} from '@/core/types';
import { adviseFlow, ENGINE_COVERED_TYPES, OUT_OF_ENGINE_REASON, loadWorkspace, removeEntity, saveWorkspace, simulationIssues, snapshotScenario, updateWorkspaceEntity, updateWorkspaceFlow } from '@/core/scenarioWorkspace';
import { LegalReference } from '@/components/inspector';
import { OwnershipEditor } from './OwnershipEditor';

const control = 'min-h-11 w-full border border-border bg-canvas px-2 text-sm text-fg';
const button = 'min-h-11 border border-border bg-canvas px-3 text-sm text-fg hover:border-border-strong disabled:opacity-40';
const fields: Record<string, string[]> = {
  sasu: ['caHt', 'expensesHt'], sci_is: ['rentalIncomeHt', 'interestExpenses', 'buildingAmortization', 'otherCharges'],
  sci_ir: ['rentalIncomeHt', 'interestExpenses', 'otherCharges'],
};
const fieldNames: Record<string, string> = { caHt: 'CA HT', expensesHt: 'Charges HT', rentalIncomeHt: 'Loyers HT', interestExpenses: 'Intérêts', buildingAmortization: 'Amortissement', otherCharges: 'Autres charges' };
const CATEGORY_LABELS: Record<string, string> = {
  revenue: 'Chiffre d’affaires', expense: 'Charges', salary: 'Rémunération', social_charges: 'Cotisations sociales',
  dividend: 'Dividendes', vat: 'TVA', is_tax: 'Impôt sur les sociétés', management_fees: 'Management fees',
  rent: 'Loyer', cca_advance: 'Apport en compte courant', cca_reimbursement: 'Remboursement de compte courant',
  loan_payment: 'Échéance d’emprunt',
};
const LAYER_LABELS: Record<string, string> = { treasury: 'Trésorerie', vat: 'TVA', tax: 'IS / IR', social: 'Social', legal: 'Juridique' };
const PERIODICITY_LABELS: Record<string, string> = { annual: 'Annuel', monthly: 'Mensuel', quarterly: 'Trimestriel', one_off: 'Ponctuel' };
const label = (dict: Record<string, string>, key: string) => dict[key] ?? key;

function defaultInputs(entityType: EntityType): Record<string, number> {
  return Object.fromEntries((fields[entityType] ?? []).map((key) => [key, 0]));
}

/** Section repliable : l'animation vit dans globals.css (.disclosure). */
function Section({ title, count, children, open = false }: { title: string; count?: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="disclosure border border-border" open={open}>
      <summary className="flex min-h-11 cursor-pointer items-center gap-2 px-3 text-sm font-semibold">
        {title}
        {count !== undefined && <span className="text-fg-muted">({count})</span>}
      </summary>
      <div className="space-y-2 border-t border-border p-3">{children}</div>
    </details>
  );
}

/** Régime fiscal déduit du tracé : taux effectif, montant, condition manquante, articles. */
function FlowRegime({ scenario, flow }: { scenario: ScenarioState; flow: FlowEdgeData }) {
  const advice = adviseFlow(scenario, flow);
  if (!advice?.regime) return null;
  return (
    <div className="space-y-2 border border-border p-2" data-testid={`flow-regime-${flow.id}`}>
      <p className="m-0 text-sm font-semibold">{advice.regime}</p>
      <p className="m-0 text-xs text-fg-muted">
        Friction fiscale <span className="font-amount">{(advice.rate! * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</span>
        {' — '}<span className="font-amount">{formatEuro(advice.tax ?? 0)}</span> sur ce flux.
      </p>
      {advice.warning && <p role="alert" className="m-0 border border-flow-alert p-2 text-xs">{advice.warning}</p>}
      <LegalReference flow={flow} />
    </div>
  );
}

export function ScenarioWorkspace({ initialScenario, whatIf, onApply }: {
  initialScenario: ScenarioState; whatIf: WhatIfInputs; onApply: (scenario: ScenarioState) => void;
}) {
  const [draft, setDraft] = useState(() => snapshotScenario(initialScenario, whatIf));
  const [baseline, setBaseline] = useState<ScenarioState | null>(null);
  const [message, setMessage] = useState('Sauvegarde explicite dans ce navigateur. Le schéma peut dépasser la couverture du moteur.');
  const issues = simulationIssues(draft);
  const result = issues.length ? null : resolveScenarioGraph(draft);
  const reference = baseline && !simulationIssues(baseline).length ? resolveScenarioGraph(baseline) : null;

  function change(next: ScenarioState) { setDraft({ ...next, updatedAt: new Date().toISOString() }); }
  function patchEntity(id: string, patch: Partial<EntityNodeData>) { change(updateWorkspaceEntity(draft, id, patch)); }
  function patchFlow(id: string, patch: Partial<FlowEdgeData>) { change(updateWorkspaceFlow(draft, id, patch)); }

  function addEntity(entityType: EntityType, position?: { x: number; y: number }) {
    const id = crypto.randomUUID();
    change({
      ...draft,
      entities: [...draft.entities, { id, label: ENTITY_TYPE_LABELS[entityType], entityType, inputs: defaultInputs(entityType) }],
      ...(position ? { nodePositions: { ...draft.nodePositions, [id]: position } } : {}),
    });
  }
  function addFlow(sourceId: string, targetId: string) {
    // Le tracé propose sa nature : SASU → Holding devient un dividende mère-fille sans configuration.
    const advice = adviseFlow(draft, { sourceId, targetId });
    change({ ...draft, flows: [...draft.flows, {
      id: crypto.randomUUID(), sourceId, targetId, amount: 0, periodicity: 'annual',
      category: advice?.category ?? 'management_fees', label: advice?.label ?? 'Flux à configurer',
      layer: advice?.layer ?? 'treasury', ...(advice?.legalNoteId ? { legalNoteId: advice.legalNoteId } : {}),
      ...(advice?.rate !== undefined ? { taxRate: advice.rate } : {}),
    }] });
  }
  function save() {
    try { saveWorkspace(localStorage, { version: 1, draft, baseline }); setMessage('Schéma et référence A enregistrés dans ce navigateur.'); }
    catch { setMessage('Enregistrement impossible : vérifiez les champs et la disponibilité du stockage.'); }
  }
  function load() {
    try {
      const saved = loadWorkspace(localStorage);
      if (!saved) { setMessage('Aucune sauvegarde locale.'); return; }
      setDraft(saved.draft); setBaseline(saved.baseline); setMessage('Sauvegarde locale chargée.');
    } catch { setMessage('Sauvegarde illisible : le brouillon actuel reste intact.'); }
  }
  function reset() {
    change({ ...draft, name: 'Nouveau schéma', entities: [], flows: [], ownerships: [], nodePositions: {} });
    setMessage('Schéma vidé : déposez des entités depuis la palette pour repartir de zéro.');
  }

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto bg-canvas" aria-label="Atelier architecture">
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <h2 className="mr-auto text-lg font-semibold">Architecture et comparaison</h2>
        <button className={button} onClick={reset}>Repartir de zéro</button>
        <button className={button} onClick={save}>Enregistrer localement</button>
        <button className={button} onClick={load}>Charger la sauvegarde</button>
        <button className={button} onClick={() => setBaseline(structuredClone(draft))}>Définir comme A</button>
        <button className={button} disabled={!result} onClick={() => onApply({ ...draft, id: crypto.randomUUID(), presetId: undefined })}>Ouvrir dans le simulateur</button>
      </header>
      <p role="status" className="m-0 px-3 py-2 text-sm text-fg-muted">{message}</p>
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-3 lg:overflow-auto">
          <label className="block text-sm">Nom du scénario<input className={control} value={draft.name} onChange={(event) => change({ ...draft, name: event.target.value })} /></label>

          <Section title="Palette" open>
            <p className="m-0 text-xs text-fg-muted">Glissez une brique sur le schéma, ou cliquez pour l’ajouter. Les briques marquées « schéma seul » se dessinent mais ne sont pas chiffrées.</p>
            <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
              {ENTITY_TYPES.map((entityType) => (
                <li key={entityType}>
                  <button
                    type="button"
                    draggable
                    className={`${button} w-full cursor-grab px-2 text-left active:cursor-grabbing`}
                    title={OUT_OF_ENGINE_REASON[entityType] ?? 'Chiffré par le moteur.'}
                    onDragStart={(event) => {
                      event.dataTransfer.setData(ENTITY_DRAG_TYPE, entityType);
                      event.dataTransfer.effectAllowed = 'copy';
                    }}
                    onClick={() => addEntity(entityType)}
                  >
                    {ENTITY_TYPE_LABELS[entityType]}
                    {!ENGINE_COVERED_TYPES.has(entityType) && <span className="block text-xs font-normal text-fg-muted">schéma seul</span>}
                  </button>
                </li>
              ))}
            </ul>
          </Section>

          <Section title="Sociétés et acteurs" count={draft.entities.length} open>
            {draft.entities.length === 0 && <p className="m-0 text-sm text-fg-muted">Aucune entité : commencez par la palette.</p>}
            {draft.entities.map((item) => (
              <details key={item.id} className="disclosure border border-border">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-2 text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 text-xs text-fg-muted">{ENTITY_TYPE_LABELS[item.entityType]}</span>
                </summary>
                <div className="space-y-2 border-t border-border p-2">
                  <label className="block text-sm">Nom<input className={control} value={item.label} onChange={(event) => patchEntity(item.id, { label: event.target.value })} /></label>
                  <label className="block text-sm">Type<select className={control} value={item.entityType} onChange={(event) => patchEntity(item.id, { entityType: event.target.value as EntityType, inputs: defaultInputs(event.target.value as EntityType) })}>{ENTITY_TYPES.map((type) => <option key={type} value={type}>{ENTITY_TYPE_LABELS[type]}</option>)}</select></label>
                  {(fields[item.entityType] ?? []).map((key) => <label key={key} className="block text-sm">{fieldNames[key]} annuel (€)<input type="number" min="0" step="0.01" className={control} value={item.inputs?.[key] ?? 0} onChange={(event) => patchEntity(item.id, { inputs: { ...item.inputs, [key]: event.target.valueAsNumber } })} /></label>)}
                  <button className={button} onClick={() => change(removeEntity(draft, item.id))}>Supprimer cette entité et ses flux</button>
                </div>
              </details>
            ))}
          </Section>

          <Section title="Détentions">
            <OwnershipEditor scenario={draft} onChange={change} />
          </Section>

          <Section title="Flux annuels" count={draft.flows.length} open>
            <p className="m-0 text-xs text-fg-muted">Reliez deux nœuds sur le schéma ou ajoutez un flux, puis choisissez sa nature. Aucun régime fiscal n’est déduit du dessin.</p>
            {draft.flows.map((item) => (
              <details key={item.id} className="disclosure border border-border">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-2 text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="font-amount shrink-0 text-xs text-fg-muted">{formatEuro(item.amount)}</span>
                </summary>
                <div className="space-y-2 border-t border-border p-2">
                  <label className="block text-sm">Libellé<input className={control} value={item.label} onChange={(event) => patchFlow(item.id, { label: event.target.value })} /></label>
                  {(['sourceId', 'targetId'] as const).map((key) => <label key={key} className="block text-sm">{key === 'sourceId' ? 'Source' : 'Destination'}<select className={control} value={item[key]} onChange={(event) => patchFlow(item.id, { [key]: event.target.value })}>{draft.entities.map((entity) => <option key={entity.id} value={entity.id}>{entity.label}</option>)}</select></label>)}
                  <label className="block text-sm">Nature<select className={control} value={item.category} onChange={(event) => {
                    const category = event.target.value as typeof item.category;
                    const next = adviseFlow(draft, { ...item, category });
                    patchFlow(item.id, { category, layer: next?.layer ?? item.layer, legalNoteId: next?.legalNoteId, taxRate: next?.rate });
                  }}>{FLOW_CATEGORIES.map((category) => <option key={category} value={category}>{label(CATEGORY_LABELS, category)}</option>)}</select></label>
                  <FlowRegime scenario={draft} flow={item} />
                  <label className="block text-sm">Montant (€)<input className={control} type="number" min="0" step="0.01" value={item.amount} onChange={(event) => patchFlow(item.id, { amount: event.target.valueAsNumber })} /></label>
                  <label className="block text-sm">Périodicité<select className={control} value={item.periodicity} onChange={(event) => patchFlow(item.id, { periodicity: event.target.value as typeof item.periodicity })}>{FLOW_PERIODICITIES.map((period) => <option key={period} value={period}>{label(PERIODICITY_LABELS, period)}</option>)}</select></label>
                  <label className="block text-sm">Calque<select className={control} value={item.layer} onChange={(event) => patchFlow(item.id, { layer: event.target.value as typeof item.layer })}>{FLOW_LAYERS.map((layer) => <option key={layer} value={layer}>{label(LAYER_LABELS, layer)}</option>)}</select></label>
                  <button className={button} onClick={() => change({ ...draft, flows: draft.flows.filter((flow) => flow.id !== item.id) })}>Supprimer le flux</button>
                </div>
              </details>
            ))}
            <button className={button} disabled={draft.entities.length < 2} onClick={() => addFlow(draft.entities[0]!.id, draft.entities[1]!.id)}>Ajouter un flux</button>
          </Section>
        </aside>

        <div className="flex min-w-0 flex-col gap-3">
          <p className="m-0 text-sm text-fg-muted">Schéma de saisie : montants bruts/HT saisis, pas des résultats calculés. Déplacez les nœuds pour organiser la vue.</p>
          <FlowCanvas scenario={draft} entities={draft.entities.map((item) => ({ ...item, metrics: undefined }))} className="flex-1 border border-border"
            onConnectEntities={addFlow} onDropEntityType={addEntity}
            onPositionsChange={(nodePositions) => change({ ...draft, nodePositions })} />
          {issues.length > 0 && <div role="alert" className="border border-flow-alert p-3"><strong>Simulation indisponible pour ce schéma</strong><ul className="list-disc pl-4">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul></div>}
          {result && <p className="text-sm text-fg-muted">Calcul pédagogique possible, sous les limites du moteur : {result.warnings.join(' ')}</p>}
          <section className="border-t border-border pt-3" aria-label="Comparaison A B">
            <h3 className="font-semibold">A / B — référence et brouillon courant</h3>
            <p className="text-sm text-fg-muted">Recalcul avec le référentiel actuel. Comparaison manuelle, pas recommandation ni recherche automatique d’un optimum.</p>
            {reference && result ? <table className="w-full text-right text-sm"><caption className="text-left">A : {baseline?.name} · B : {draft.name}</caption><thead><tr><th>Indicateur</th><th>A</th><th>B</th><th>Écart B − A</th></tr></thead><tbody>
              {(['netGroupCash', 'netPersonalCash'] as const).map((key) => <tr key={key}><th className="text-left">{key === 'netGroupCash' ? 'Trésorerie groupe' : 'Personnel avant IR rémunération'}</th><td className="font-amount">{formatEuro(reference.summary[key])}</td><td className="font-amount">{formatEuro(result.summary[key])}</td><td className="font-amount">{formatEuro(result.summary[key] - reference.summary[key])}</td></tr>)}
            </tbody></table> : <p className="text-sm">Définissez une référence A ; les deux scénarios doivent être couverts par le moteur.</p>}
          </section>
        </div>
      </div>
    </section>
  );
}
