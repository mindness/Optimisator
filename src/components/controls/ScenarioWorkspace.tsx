import { useState } from 'react';
import { FlowCanvas } from '@/components/canvas/FlowCanvas';
import { formatEuro } from '@/components/common/MetricBadge';
import { resolveScenarioGraph, type WhatIfInputs } from '@/core/engine';
import { ENTITY_TYPES, FLOW_CATEGORIES, FLOW_LAYERS, FLOW_PERIODICITIES, type ScenarioState } from '@/core/types';
import { loadWorkspace, removeEntity, saveWorkspace, simulationIssues, snapshotScenario, updateWorkspaceEntity, updateWorkspaceFlow } from '@/core/scenarioWorkspace';
import { OwnershipEditor } from './OwnershipEditor';

const control = 'min-h-11 w-full border border-border bg-canvas px-2 text-sm text-fg';
const button = 'min-h-11 border border-border bg-canvas px-3 text-sm text-fg hover:border-border-strong disabled:opacity-40';
const fields: Record<string, string[]> = {
  sasu: ['caHt', 'expensesHt'], sci_is: ['rentalIncomeHt', 'interestExpenses', 'buildingAmortization', 'otherCharges'],
  sci_ir: ['rentalIncomeHt', 'interestExpenses', 'otherCharges'],
};
const fieldNames: Record<string, string> = { caHt: 'CA HT', expensesHt: 'Charges HT', rentalIncomeHt: 'Loyers HT', interestExpenses: 'Intérêts', buildingAmortization: 'Amortissement', otherCharges: 'Autres charges' };

export function ScenarioWorkspace({ initialScenario, whatIf, onApply }: {
  initialScenario: ScenarioState; whatIf: WhatIfInputs; onApply: (scenario: ScenarioState) => void;
}) {
  const [draft, setDraft] = useState(() => snapshotScenario(initialScenario, whatIf));
  const [baseline, setBaseline] = useState<ScenarioState | null>(null);
  const [entityId, setEntityId] = useState('');
  const [flowId, setFlowId] = useState('');
  const [message, setMessage] = useState('Sauvegarde explicite dans ce navigateur. Le schéma peut dépasser la couverture du moteur.');
  const entity = draft.entities.find((item) => item.id === entityId) ?? draft.entities[0]!;
  const flow = draft.flows.find((item) => item.id === flowId) ?? draft.flows[0];
  const issues = simulationIssues(draft);
  const result = issues.length ? null : resolveScenarioGraph(draft);
  const reference = baseline && !simulationIssues(baseline).length ? resolveScenarioGraph(baseline) : null;
  function change(next: ScenarioState) { setDraft({ ...next, updatedAt: new Date().toISOString() }); }
  function patchEntity(patch: Partial<typeof entity>) {
    change(updateWorkspaceEntity(draft, entity.id, patch));
  }
  function patchFlow(patch: Partial<NonNullable<typeof flow>>) {
    if (flow) change(updateWorkspaceFlow(draft, flow.id, patch));
  }
  function addFlow(sourceId: string, targetId: string) {
    const id = crypto.randomUUID();
    change({ ...draft, flows: [...draft.flows, { id, sourceId, targetId, category: 'management_fees', label: 'Flux à configurer', amount: 0, periodicity: 'annual', layer: 'treasury' }] });
    setFlowId(id);
  }
  function save() {
    try { saveWorkspace(localStorage, { version: 1, draft, baseline }); setMessage('Schéma et référence A enregistrés dans ce navigateur.'); }
    catch { setMessage('Enregistrement impossible : vérifiez les champs et la disponibilité du stockage.'); }
  }
  function load() {
    try {
      const saved = loadWorkspace(localStorage);
      if (!saved) { setMessage('Aucune sauvegarde locale.'); return; }
      setDraft(saved.draft); setBaseline(saved.baseline); setEntityId(''); setFlowId(''); setMessage('Sauvegarde locale chargée.');
    } catch { setMessage('Sauvegarde illisible : le brouillon actuel reste intact.'); }
  }
  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-auto bg-canvas" aria-label="Atelier architecture">
      <header className="flex flex-wrap items-center gap-2 border-b border-border p-3">
        <h2 className="mr-auto text-lg font-semibold">Architecture et comparaison</h2>
        <button className={button} onClick={save}>Enregistrer localement</button>
        <button className={button} onClick={load}>Charger la sauvegarde</button>
        <button className={button} onClick={() => setBaseline(structuredClone(draft))}>Définir comme A</button>
        <button className={button} disabled={!result} onClick={() => onApply({ ...draft, id: crypto.randomUUID(), presetId: undefined })}>Ouvrir dans le simulateur</button>
      </header>
      <p role="status" className="m-0 px-3 py-2 text-sm text-fg-muted">{message}</p>
      <div className="grid min-h-0 flex-1 gap-3 p-3 lg:grid-cols-[20rem_1fr]">
        <aside className="space-y-4 lg:overflow-auto">
          <label className="block text-sm">Nom du scénario<input className={control} value={draft.name} onChange={(event) => change({ ...draft, name: event.target.value })} /></label>
          <fieldset className="space-y-2 border border-border p-3">
            <legend>Sociétés et acteurs</legend>
            <label className="block text-sm">Entité<select className={control} value={entity.id} onChange={(event) => setEntityId(event.target.value)}>{draft.entities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
            <label className="block text-sm">Nom de l’entité<input className={control} value={entity.label} onChange={(event) => patchEntity({ label: event.target.value })} /></label>
            <label className="block text-sm">Type d’entité<select className={control} value={entity.entityType} onChange={(event) => patchEntity({ entityType: event.target.value as typeof entity.entityType, inputs: {} })}>{ENTITY_TYPES.map((type) => <option key={type}>{type}</option>)}</select></label>
            {(fields[entity.entityType] ?? []).map((key) => <label key={key} className="block text-sm">{fieldNames[key]} annuel (€)<input type="number" min="0" step="0.01" className={control} value={entity.inputs?.[key] ?? 0} onChange={(event) => patchEntity({ inputs: { ...entity.inputs, [key]: event.target.valueAsNumber } })} /></label>)}
            <button className={button} onClick={() => { const id = crypto.randomUUID(); change({ ...draft, entities: [...draft.entities, { id, label: 'Nouvelle société', entityType: 'sasu', inputs: { caHt: 0, expensesHt: 0 } }] }); setEntityId(id); }}>Ajouter une entité</button>
            <button className={button} disabled={draft.entities.length <= 1} onClick={() => { change(removeEntity(draft, entity.id)); setEntityId(''); }}>Supprimer cette entité et ses flux</button>
          </fieldset>
          <OwnershipEditor scenario={draft} onChange={change} />
          <fieldset className="space-y-2 border border-border p-3">
            <legend>Flux annuels</legend>
            <p className="text-xs text-fg-muted">Reliez deux nœuds ou ajoutez un flux, puis choisissez sa nature. Aucun régime fiscal n’est déduit du dessin.</p>
            {flow && <>
              <label className="block text-sm">Flux<select className={control} value={flow.id} onChange={(event) => setFlowId(event.target.value)}>{draft.flows.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="block text-sm">Libellé<input className={control} value={flow.label} onChange={(event) => patchFlow({ label: event.target.value })} /></label>
              {(['sourceId', 'targetId'] as const).map((key) => <label key={key} className="block text-sm">{key === 'sourceId' ? 'Source' : 'Destination'}<select className={control} value={flow[key]} onChange={(event) => patchFlow({ [key]: event.target.value })}>{draft.entities.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>)}
              <label className="block text-sm">Nature<select className={control} value={flow.category} onChange={(event) => patchFlow({ category: event.target.value as typeof flow.category })}>{FLOW_CATEGORIES.map((category) => <option key={category}>{category}</option>)}</select></label>
              <label className="block text-sm">Montant (€)<input className={control} type="number" min="0" step="0.01" value={flow.amount} onChange={(event) => patchFlow({ amount: event.target.valueAsNumber })} /></label>
              <label className="block text-sm">Périodicité<select className={control} value={flow.periodicity} onChange={(event) => patchFlow({ periodicity: event.target.value as typeof flow.periodicity })}>{FLOW_PERIODICITIES.map((period) => <option key={period}>{period}</option>)}</select></label>
              <label className="block text-sm">Calque<select className={control} value={flow.layer} onChange={(event) => patchFlow({ layer: event.target.value as typeof flow.layer })}>{FLOW_LAYERS.map((layer) => <option key={layer}>{layer}</option>)}</select></label>
              <button className={button} onClick={() => change({ ...draft, flows: draft.flows.filter((item) => item.id !== flow.id) })}>Supprimer le flux</button>
            </>}
            <button className={button} disabled={draft.entities.length < 2} onClick={() => addFlow(draft.entities[0]!.id, draft.entities[1]!.id)}>Ajouter un flux</button>
          </fieldset>
        </aside>
        <div className="flex min-w-0 flex-col gap-3">
          <p className="m-0 text-sm text-fg-muted">Schéma de saisie : montants bruts/HT saisis, pas des résultats calculés. Déplacez les nœuds pour organiser la vue.</p>
          <FlowCanvas scenario={draft} entities={draft.entities.map((item) => ({ ...item, metrics: undefined }))} className="min-h-[32rem] flex-1 border border-border"
            onFlowSelect={(item) => setFlowId(item.id)} onConnectEntities={addFlow}
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
