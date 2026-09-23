import { useEffect, useRef, useState } from 'react';
import { ENTITY_DRAG_TYPE, FlowCanvas } from '@/components/canvas/FlowCanvas';
import { formatEuro } from '@/components/common/MetricBadge';
import { ANIMATRICE_EVIDENCE, resolveScenarioGraph, type WhatIfInputs } from '@/core/engine';
import {
  DEFAULT_SOCIAL_REGIME,
  DEFAULT_TAX_REGIME,
  ENTITY_TYPE_LABELS,
  FLOW_CATEGORIES,
  FLOW_LAYERS,
  FLOW_PERIODICITIES,
  type EntityNodeData,
  type EntityType,
  type FlowEdgeData,
  type ScenarioState,
} from '@/core/types';
import { adviseFlow, autoCompanionFlows, completeScenario, loadDraft, newId, saveDraft, ENGINE_COVERED_TYPES, ENTITY_INPUT_FIELDS, ENTITY_INPUT_FIELD_LABELS, OUT_OF_ENGINE_REASON, loadWorkspace, removeEntity, saveWorkspace, simulationIssues, snapshotScenario, updateWorkspaceEntity, updateWorkspaceFlow } from '@/core/scenarioWorkspace';
import type { ConventionMatch } from '@/core/legal/conventions';
import { FREELANCE_SASU_PRESET, FULL_GROUP_PRESET, SASU_HOLDING_PRESET } from '@/core/presets';
import { LegalReference } from '@/components/inspector';
import { ConventionsPanel } from './ConventionsPanel';
import { OwnershipEditor } from './OwnershipEditor';
import { ScenarioFileButtons } from './ScenarioFileButtons';

const STARTERS: ScenarioState[] = [FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET, FULL_GROUP_PRESET];

const control = 'field';
const button = 'btn';
/** Champs à zéro par défaut ; les soldes d'ouverture restent absents tant qu'ils ne sont pas saisis. */
const ZERO_DEFAULT = new Set(['caHt', 'expensesHt', 'rentalIncomeHt', 'interestExpenses', 'buildingAmortization', 'otherCharges']);
const TAX_REGIME_OPTIONS: Record<string, string> = { is: 'Impôt sur les sociétés', ir: 'Impôt sur le revenu (transparence)' };
const SOCIAL_OPTIONS: Record<string, string> = { assimile_salarie: 'Assimilé salarié', tns: 'TNS (SSI)', none: 'Sans rémunération' };
const MICRO_OPTIONS: Record<string, string> = { bnc: 'BNC (prestations libérales)', bic_services: 'BIC services', bic_vente: 'BIC vente', meuble_tourisme: 'Meublé de tourisme' };
const OPERATING_TYPES: EntityType[] = ['sasu', 'eurl', 'sarl', 'micro_entreprise', 'entreprise_individuelle'];

/** Palette rangée par famille : société opérante → holding/SCI → tiers, chaque groupe trié par libellé. */
const PALETTE_GROUPS: ReadonlyArray<{ title: string; types: readonly EntityType[] }> = (() => {
  const byLabel = (a: EntityType, b: EntityType) => ENTITY_TYPE_LABELS[a].localeCompare(ENTITY_TYPE_LABELS[b], 'fr');
  const groups: ReadonlyArray<{ title: string; types: readonly EntityType[] }> = [
    { title: 'Sociétés', types: ['sasu', 'eurl', 'sarl', 'micro_entreprise', 'entreprise_individuelle'] },
    { title: 'Holdings et SCI', types: ['holding_sas', 'holding_sarl', 'sci_is', 'sci_ir'] },
    { title: 'Tiers', types: ['person', 'client', 'vendor', 'tax_authority', 'urssaf', 'bank'] },
  ];
  return groups.map((group) => ({ title: group.title, types: [...group.types].sort(byLabel) }));
})();

/** Même tri pour le sélecteur de type d’une entité existante. */
const SORTED_ENTITY_TYPES: readonly EntityType[] = PALETTE_GROUPS.flatMap((group) => group.types);
const REGIME_CHOICE: Partial<Record<EntityType, boolean>> = { sasu: true, eurl: true, sarl: true, holding_sas: true, holding_sarl: true, entreprise_individuelle: true };
const SOCIAL_CHOICE: Partial<Record<EntityType, boolean>> = { sasu: true, eurl: true, sarl: true, holding_sas: true, holding_sarl: true };
const CATEGORY_LABELS: Record<string, string> = {
  revenue: 'Chiffre d’affaires', expense: 'Charges', salary: 'Rémunération', social_charges: 'Cotisations sociales',
  dividend: 'Dividendes', vat: 'TVA', is_tax: 'Impôt sur les sociétés', management_fees: 'Management fees',
  rent: 'Loyer', cca_advance: 'Apport en compte courant', cca_reimbursement: 'Remboursement de compte courant',
  loan_payment: 'Échéance d’emprunt', capital_contribution: 'Apport en capital',
  share_sale: 'Cession de titres', share_contribution: 'Apport de titres (report 150-0 B ter)', donation: 'Donation de titres',
  property_sale: 'Cession immobilière',
};
const HOLDING_TYPES: EntityType[] = ['holding_sas', 'holding_sarl'];
/** Types qui peuvent héberger une activité de location meublée au réel. */
const FURNISHED_TYPES: EntityType[] = ['entreprise_individuelle', 'eurl', 'sarl', 'sci_is', 'sci_ir'];
const LAYER_LABELS: Record<string, string> = { treasury: 'Trésorerie', vat: 'TVA', tax: 'IS / IR', social: 'Social', legal: 'Juridique' };
const PERIODICITY_LABELS: Record<string, string> = { annual: 'Annuel', monthly: 'Mensuel', quarterly: 'Trimestriel', one_off: 'Ponctuel' };
const label = (dict: Record<string, string>, key: string) => dict[key] ?? key;

function defaultInputs(entityType: EntityType): Record<string, number> {
  return Object.fromEntries((ENTITY_INPUT_FIELDS[entityType] ?? []).filter((key) => ZERO_DEFAULT.has(key)).map((key) => [key, 0]));
}

/** Section repliable : l'animation vit dans globals.css (.disclosure). */
function Section({ title, count, children, open = false }: { title: string; count?: number; children: React.ReactNode; open?: boolean }) {
  return (
    <details className="disclosure card" open={open}>
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
    <div className="space-y-2 card p-2" data-testid={`flow-regime-${flow.id}`}>
      <p className="m-0 text-sm font-semibold">{advice.regime}</p>
      <p className="m-0 text-xs text-fg-muted">
        Friction fiscale <span className="font-amount">{(advice.rate! * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %</span>
        {' — '}<span className="font-amount">{formatEuro(advice.tax ?? 0)}</span> sur ce flux.
      </p>
      {advice.warning && <p role="alert" className="m-0 rounded-md bg-negative-soft p-2 text-xs text-negative">{advice.warning}</p>}
      <LegalReference flow={flow} />
    </div>
  );
}

export function ScenarioWorkspace({ initialScenario, whatIf, onApply }: {
  initialScenario: ScenarioState; whatIf: WhatIfInputs; onApply: (scenario: ScenarioState) => void;
}) {
  const [draft, setDraftState] = useState(() => loadDraft(sessionStorage, initialScenario.id) ?? snapshotScenario(initialScenario, whatIf));
  const [history, setHistory] = useState<{ past: ScenarioState[]; future: ScenarioState[] }>({ past: [], future: [] });
  // Le plein écran prend palette + schéma : agrandir le dessin sans ses briques oblige à en ressortir pour chaque ajout.
  const workbench = useRef<HTMLDivElement>(null);
  useEffect(() => { saveDraft(sessionStorage, initialScenario.id, draft); }, [initialScenario.id, draft]);
  // ponytail: pile bornée à 50 états, sans fusion des frappes ; regrouper par champ si l'historique gêne.
  function setDraft(next: ScenarioState) {
    setHistory((h) => ({ past: [...h.past.slice(-49), draft], future: [] }));
    setDraftState(next);
  }
  function undo() {
    const previous = history.past.at(-1);
    if (!previous) return;
    setHistory((h) => ({ past: h.past.slice(0, -1), future: [draft, ...h.future] }));
    setDraftState(previous);
  }
  function redo() {
    const next = history.future[0];
    if (!next) return;
    setHistory((h) => ({ past: [...h.past, draft], future: h.future.slice(1) }));
    setDraftState(next);
  }
  // Ctrl/⌘+Z annule, Ctrl/⌘+Maj+Z ou Ctrl+Y rétablit — sauf dans un champ, où le navigateur gère sa propre frappe.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || (event.target instanceof Element && event.target.closest('input, textarea, select'))) return;
      const key = event.key.toLowerCase();
      if (key !== 'z' && key !== 'y') return;
      event.preventDefault();
      if (key === 'y' || event.shiftKey) redo(); else undo();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const [baseline, setBaseline] = useState<ScenarioState | null>(null);
  const [message, setMessage] = useState('Sauvegarde explicite dans ce navigateur. Le schéma peut dépasser la couverture du moteur.');
  const issues = simulationIssues(draft);
  const result = issues.length ? null : resolveScenarioGraph(draft);
  const reference = baseline && !simulationIssues(baseline).length ? resolveScenarioGraph(baseline) : null;

  // Les flux subis (TVA, URSSAF, IS) sont déduits du schéma à chaque édition, pas saisis :
  // supprimer la TVA d'une société qui vend n'a pas de sens, elle revient.
  function change(next: ScenarioState) { setDraft({ ...autoCompanionFlows(next), updatedAt: new Date().toISOString() }); }
  function patchEntity(id: string, patch: Partial<EntityNodeData>) { change(updateWorkspaceEntity(draft, id, patch)); }
  function patchFlow(id: string, patch: Partial<FlowEdgeData>) { change(updateWorkspaceFlow(draft, id, patch)); }

  function addEntity(entityType: EntityType, position?: { x: number; y: number }) {
    const id = newId();
    change({
      ...draft,
      entities: [...draft.entities, { id, label: ENTITY_TYPE_LABELS[entityType], entityType, inputs: defaultInputs(entityType) }],
      ...(position ? { nodePositions: { ...draft.nodePositions, [id]: position } } : {}),
    });
  }
  function addFlow(sourceId: string, targetId: string, category?: FlowEdgeData['category']) {
    // Le tracé propose sa nature : SASU → Holding devient un dividende mère-fille sans configuration.
    const advice = adviseFlow(draft, { sourceId, targetId, category });
    change({ ...draft, flows: [...draft.flows, {
      id: newId(), sourceId, targetId, amount: 0, periodicity: 'annual',
      category: advice?.category ?? category ?? 'management_fees', label: advice?.label ?? 'Flux à configurer',
      layer: advice?.layer ?? 'treasury', ...(advice?.legalNoteId ? { legalNoteId: advice.legalNoteId } : {}),
      ...(advice?.rate !== undefined ? { taxRate: advice.rate } : {}),
    }] });
  }
  function addConventionFlow(match: ConventionMatch) {
    if (!match.flow) return;
    addFlow(match.flow.sourceId, match.flow.targetId, match.flow.category);
    setMessage(`Flux « ${match.flow.label} » ajouté : renseignez son montant dans « Flux annuels ».`);
  }
  function startFrom(preset: ScenarioState) {
    setDraft(snapshotScenario({ ...preset, id: newId(), presetId: undefined }));
    setMessage(`Modèle « ${preset.name} » chargé : adaptez noms, montants et détentions.`);
  }
  function complete() {
    change(completeScenario(draft));
    setMessage('Schéma complété : tiers et flux obligatoires ajoutés à zéro, à renseigner.');
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
        <label className="flex items-center gap-2 text-sm">Partir d’un modèle
          <select className={control} value="" aria-label="Partir d’un modèle" onChange={(event) => { const preset = STARTERS.find((p) => p.id === event.target.value); if (preset) startFrom(preset); }}>
            <option value="">Choisir…</option>
            {STARTERS.map((preset) => <option key={preset.id} value={preset.id}>{preset.name}</option>)}
          </select>
        </label>
        <div className="flex items-center gap-0.5" role="group" aria-label="Historique">
          <button className="btn btn-ghost btn-sm px-2" onClick={undo} disabled={history.past.length === 0} aria-label="Annuler" title="Annuler (Ctrl+Z)">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
          </button>
          <button className="btn btn-ghost btn-sm px-2" onClick={redo} disabled={history.future.length === 0} aria-label="Rétablir" title="Rétablir (Ctrl+Y)">
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m15 14 5-5-5-5M20 9H9a5 5 0 0 0 0 10h3" /></svg>
          </button>
        </div>
        <button className="btn btn-primary" disabled={!result} onClick={() => onApply({ ...draft, id: newId(), presetId: undefined })}>Ouvrir dans le simulateur</button>
      </header>
      <p role="status" className="m-0 px-3 py-2 text-sm text-fg-muted">{message}</p>
      <div ref={workbench} className="workbench grid min-h-0 flex-1 gap-3 bg-surface p-3 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-3 lg:overflow-auto">
          <label className="block text-sm">Nom du scénario<input className={control} value={draft.name} onChange={(event) => change({ ...draft, name: event.target.value })} /></label>

          <Section title="Fichier et sauvegarde">
            <div className="flex flex-wrap gap-2">
              <button className={button} onClick={save}>Enregistrer localement</button>
              <button className={button} onClick={load}>Charger la sauvegarde</button>
              <ScenarioFileButtons scenario={draft} whatIf={{}} onMessage={setMessage}
                onImport={(scenario) => { setDraft(scenario); }} />
              <button className="btn btn-ghost" onClick={reset}>Repartir de zéro</button>
            </div>
          </Section>

          <Section title="Palette" open>
            <p className="m-0 text-xs text-fg-muted">Glissez une brique sur le schéma, ou cliquez pour l’ajouter. Chaque société porte son régime (IS / IR), le statut social de son dirigeant et ses soldes d’ouverture.</p>
            {PALETTE_GROUPS.map((group) => (
              <div key={group.title} className="mb-3 last:mb-0">
                <p className="m-0 mb-1.5 text-[0.6875rem] font-semibold text-fg-muted">{group.title}</p>
                <ul className="m-0 grid list-none grid-cols-2 gap-2 p-0">
                  {group.types.map((entityType) => (
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
              </div>
            ))}
          </Section>

          <Section title="Sociétés et acteurs" count={draft.entities.length} open>
            {draft.entities.length === 0 && <p className="m-0 text-sm text-fg-muted">Aucune entité : commencez par la palette.</p>}
            {draft.entities.map((item) => (
              <details key={item.id} data-testid="entity-card" className="disclosure card">
                <summary className="flex min-h-11 cursor-pointer items-center justify-between gap-2 px-2 text-sm">
                  <span className="truncate">{item.label}</span>
                  <span className="shrink-0 text-xs text-fg-muted">{ENTITY_TYPE_LABELS[item.entityType]}</span>
                </summary>
                <div className="space-y-2 border-t border-border p-2">
                  <label className="block text-sm">Nom<input className={control} value={item.label} onChange={(event) => patchEntity(item.id, { label: event.target.value })} /></label>
                  <label className="block text-sm">Type<select className={control} value={item.entityType} onChange={(event) => patchEntity(item.id, { entityType: event.target.value as EntityType, inputs: defaultInputs(event.target.value as EntityType) })}>{SORTED_ENTITY_TYPES.map((type) => <option key={type} value={type}>{ENTITY_TYPE_LABELS[type]}</option>)}</select></label>
                  {REGIME_CHOICE[item.entityType] && <label className="block text-sm">Impôt sur les bénéfices<select className={control} value={item.taxRegime ?? DEFAULT_TAX_REGIME[item.entityType] ?? 'is'} onChange={(event) => patchEntity(item.id, { taxRegime: event.target.value as EntityNodeData['taxRegime'] })}>{Object.entries(TAX_REGIME_OPTIONS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>}
                  {SOCIAL_CHOICE[item.entityType] && <label className="block text-sm">Statut social du dirigeant<select className={control} value={item.socialRegime ?? DEFAULT_SOCIAL_REGIME[item.entityType] ?? 'none'} onChange={(event) => patchEntity(item.id, { socialRegime: event.target.value as EntityNodeData['socialRegime'] })}>{Object.entries(SOCIAL_OPTIONS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>}
                  {item.entityType === 'micro_entreprise' && <fieldset className="space-y-1 card p-2 text-sm"><legend className="text-xs text-fg-muted">Options micro</legend>
                    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={item.options?.versementLiberatoire ?? false} onChange={(event) => patchEntity(item.id, { options: { ...item.options, versementLiberatoire: event.target.checked } })} />Versement libératoire de l’IR (CGI 151-0)</label>
                    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={item.options?.acre ?? false} onChange={(event) => patchEntity(item.id, { options: { ...item.options, acre: event.target.checked } })} />ACRE (cotisations −25 % les 12 premiers mois)</label>
                  </fieldset>}
                  {OPERATING_TYPES.includes(item.entityType) && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.options?.franchiseTva ?? item.entityType === 'micro_entreprise'} onChange={(event) => patchEntity(item.id, { options: { ...item.options, franchiseTva: event.target.checked } })} />Franchise en base de TVA (CGI 293 B)</label>}
                  {HOLDING_TYPES.includes(item.entityType) && <fieldset className="space-y-1 card p-2 text-sm"><legend className="text-xs text-fg-muted">Statut de la holding</legend>
                    <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={item.options?.animatrice ?? false} onChange={(event) => patchEntity(item.id, { options: { ...item.options, animatrice: event.target.checked } })} />Holding animatrice (CGI art. 787 B, 966, 975)</label>
                    {item.options?.animatrice && <><p className="m-0 text-xs text-fg-muted">Statut à prouver, jamais présumé. Preuves attendues :</p>
                      <ul className="m-0 list-disc pl-4 text-xs text-fg-muted">{ANIMATRICE_EVIDENCE.map((evidence) => <li key={evidence}>{evidence}</li>)}</ul></>}
                    {!item.options?.animatrice && <p className="m-0 text-xs text-fg-muted">Holding pure : aucun droit à déduction de TVA sur ses charges, titres non exonérés d’IFI.</p>}
                  </fieldset>}
                  {FURNISHED_TYPES.includes(item.entityType) && <label className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={item.options?.locationMeubleeReelle ?? false} onChange={(event) => patchEntity(item.id, { options: { ...item.options, locationMeubleeReelle: event.target.checked } })} />Location meublée au réel (LMNP / LMP, amortissement plafonné CGI art. 39 C, II)</label>}
                  {item.entityType === 'micro_entreprise' && <label className="block text-sm">Catégorie micro<select className={control} value={item.microCategory ?? 'bnc'} onChange={(event) => patchEntity(item.id, { microCategory: event.target.value as EntityNodeData['microCategory'] })}>{Object.entries(MICRO_OPTIONS).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select></label>}
                  {[...(ENTITY_INPUT_FIELDS[item.entityType] ?? []), ...(item.options?.locationMeubleeReelle && !(ENTITY_INPUT_FIELDS[item.entityType] ?? []).includes('buildingAmortization') ? ['buildingAmortization'] : [])].map((key) => <label key={key} className="block text-sm">{ENTITY_INPUT_FIELD_LABELS[key]} (€)<input type="number" min="0" step="0.01" className={control} value={item.inputs?.[key] ?? ''} placeholder="0" onChange={(event) => { const inputs = { ...item.inputs }; if (Number.isFinite(event.target.valueAsNumber)) inputs[key] = event.target.valueAsNumber; else delete inputs[key]; patchEntity(item.id, { inputs }); }} /></label>)}
                  <button className={button} onClick={() => change(removeEntity(draft, item.id))}>Supprimer cette entité et ses flux</button>
                </div>
              </details>
            ))}
          </Section>

          <Section title="Exercice">
            <label className="block text-sm">
              Durée du premier exercice (jours)
              <input className={control} type="number" min="1" max="365" step="1"
                value={draft.options?.exerciseDays ?? 365}
                onChange={(event) => {
                  const options = { ...draft.options };
                  if (Number.isFinite(event.target.valueAsNumber)) options.exerciseDays = Math.min(365, Math.max(1, Math.round(event.target.valueAsNumber)));
                  else delete options.exerciseDays;
                  change({ ...draft, options });
                }} />
            </label>
            <p className="m-0 text-xs text-fg-muted">
              Une société créée en cours d’année clôture un premier exercice écourté. Le plafond de 42 500 € du taux réduit d’IS est alors ramené à la durée de l’exercice, et le chiffre d’affaires annualisé pour le test des 10 M€ (CGI art. 219, I-b). Les exercices suivants sont pleins.
            </p>
          </Section>

          <Section title="Détentions">
            <OwnershipEditor scenario={draft} onChange={change} />
          </Section>

          <Section title="Conventions possibles" open>
            <ConventionsPanel scenario={draft} onAddFlow={addConventionFlow} onChange={change} />
          </Section>

          <Section title="Flux annuels" count={draft.flows.length} open>
            <p className="m-0 text-xs text-fg-muted">Reliez deux nœuds sur le schéma ou ajoutez un flux. Le tracé propose sa nature et son régime (mère-fille, PFU, management fees) ; vous restez libre de le changer.</p>
            {draft.flows.map((item) => (
              <details key={item.id} className="disclosure card">
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
                  {['cca_advance', 'loan_payment'].includes(item.category) && <label className="block text-sm">Intérêts annuels (€) — {item.category === 'loan_payment' ? 'part d’intérêts de l’échéance, déductible' : 'servis au prêteur, déductibles chez l’emprunteur'}<input className={control} type="number" min="0" step="0.01" value={item.interestAmount ?? ''} placeholder="0" onChange={(event) => patchFlow(item.id, { interestAmount: Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : undefined })} /></label>}
                  <MontageFields flow={item} patch={(patch) => patchFlow(item.id, patch)} />
                  <label className="block text-sm">Périodicité<select className={control} value={item.periodicity} onChange={(event) => patchFlow(item.id, { periodicity: event.target.value as typeof item.periodicity })}>{FLOW_PERIODICITIES.map((period) => <option key={period} value={period}>{label(PERIODICITY_LABELS, period)}</option>)}</select></label>
                  <label className="block text-sm">Calque<select className={control} value={item.layer} onChange={(event) => patchFlow(item.id, { layer: event.target.value as typeof item.layer })}>{FLOW_LAYERS.map((layer) => <option key={layer} value={layer}>{label(LAYER_LABELS, layer)}</option>)}</select></label>
                  <button className={button} onClick={() => change({ ...draft, flows: draft.flows.filter((flow) => flow.id !== item.id) })}>Supprimer le flux</button>
                </div>
              </details>
            ))}
            <button className={button} disabled={draft.entities.length < 2} onClick={() => addFlow(draft.entities[0]!.id, draft.entities[1]!.id)}>Ajouter un flux</button>
          </Section>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-col gap-3">
          <p className="m-0 text-sm text-fg-muted">Sur une carte : cliquez un montant pour le modifier, double-cliquez le nom pour le changer, × ou Suppr pour la supprimer (Échap désélectionne, Ctrl+Z annule).</p>
          <FlowCanvas scenario={draft} entities={draft.entities.map((item) => ({ ...item, metrics: undefined }))} className="min-h-[28rem] flex-1 card"
            onConnectEntities={addFlow} onDropEntityType={addEntity} onDeleteEntity={(id) => change(removeEntity(draft, id))} onRenameEntity={(id, label) => patchEntity(id, { label })}
            onPatchEntityInputs={(id, key, value) => patchEntity(id, { inputs: { ...draft.entities.find((e) => e.id === id)?.inputs, [key]: value } })}
            onPositionsChange={(nodePositions) => change({ ...draft, nodePositions })} fullscreenTarget={workbench} />
          {issues.length > 0 && (
            <div role="alert" className="space-y-2 rounded-md bg-negative-soft p-3">
              <strong>Simulation indisponible pour ce schéma</strong>
              <ul className="m-0 list-disc pl-4">{issues.map((issue) => <li key={issue}>{issue}</li>)}</ul>
              <button className={button} onClick={complete}>Compléter pour le calcul</button>
              <span className="ml-2 text-xs text-fg-muted">ajoute la SASU, les tiers et les flux obligatoires manquants, à zéro.</span>
            </div>
          )}
          <Section title="Notes du moteur et comparaison A / B">
            {result && <p className="max-w-[38rem] text-sm text-fg-muted">Calcul pédagogique possible, sous les limites du moteur : {result.warnings.join(' ')}</p>}
            <section aria-label="Comparaison A B">
              <h3 className="font-semibold">A / B — référence et brouillon courant</h3>
              <p className="text-sm text-fg-muted">Recalcul avec le référentiel actuel. Comparaison manuelle, pas recommandation ni recherche automatique d’un optimum.</p>
              <p className="text-sm text-fg-muted">
                A est la photo que vous figez ; B est le schéma en cours d’édition.
                Figez A, modifiez le schéma, et l’écart apparaît ci-dessous.
              </p>
              <button className={button} onClick={() => setBaseline(structuredClone(draft))}>
                Figer ce schéma comme référence A
              </button>
              {reference && result ? <table className="w-full text-right text-sm"><caption className="text-left">A : {baseline?.name} · B : {draft.name}</caption><thead><tr><th>Indicateur</th><th>A</th><th>B</th><th>Écart B − A</th></tr></thead><tbody>
                {(['netGroupCash', 'netPersonalCash'] as const).map((key) => <tr key={key}><th className="text-left">{key === 'netGroupCash' ? 'Trésorerie groupe' : 'Personnel avant IR rémunération'}</th><td className="font-amount">{formatEuro(reference.summary[key])}</td><td className="font-amount">{formatEuro(result.summary[key])}</td><td className="font-amount">{formatEuro(result.summary[key] - reference.summary[key])}</td></tr>)}
              </tbody></table> : <p className="text-sm">Définissez une référence A ; les deux scénarios doivent être couverts par le moteur.</p>}
            </section>
          </Section>
        </div>
      </div>
    </section>
  );
}

/**
 * Paramètres des montages patrimoniaux : emprunt réel, cession, apport en
 * report, donation. Affichés seulement pour la nature de flux concernée, pour
 * que l'éditeur ne grossisse pas de champs que le flux n'utilise pas.
 */
function MontageFields({ flow, patch }: { flow: FlowEdgeData; patch: (patch: Partial<FlowEdgeData>) => void }) {
  const num = (event: React.ChangeEvent<HTMLInputElement>) =>
    Number.isFinite(event.target.valueAsNumber) ? event.target.valueAsNumber : 0;

  if (flow.category === 'loan_payment') {
    const loan = flow.loan;
    return (
      <fieldset className="space-y-1 card p-2 text-sm">
        <legend className="text-xs text-fg-muted">Emprunt — l’échéance et le partage capital / intérêts sont calculés</legend>
        <label className="flex min-h-11 items-center gap-2">
          <input type="checkbox" checked={!!loan} onChange={(event) => patch({ loan: event.target.checked ? { principal: 0, rate: 0.03, years: 20, type: 'amortissable' } : undefined })} />
          Échéancier calculé (sinon, intérêts saisis à la main)
        </label>
        {loan ? (
          <>
            <label className="block">Capital emprunté (€)<input className={control} type="number" min="0" step="0.01" value={loan.principal} onChange={(event) => patch({ loan: { ...loan, principal: num(event) } })} /></label>
            <label className="block">Taux annuel (%)<input className={control} type="number" min="0" step="0.01" value={loan.rate * 100} onChange={(event) => patch({ loan: { ...loan, rate: num(event) / 100 } })} /></label>
            <label className="block">Durée (années)<input className={control} type="number" min="1" step="1" value={loan.years} onChange={(event) => patch({ loan: { ...loan, years: Math.max(1, Math.round(num(event))) } })} /></label>
            <label className="block">Type<select className={control} value={loan.type} onChange={(event) => patch({ loan: { ...loan, type: event.target.value as 'amortissable' | 'in_fine' } })}><option value="amortissable">Amortissable (annuité constante)</option><option value="in_fine">In fine</option></select></label>
          </>
        ) : null}
      </fieldset>
    );
  }

  if (flow.category === 'share_sale') {
    const share = flow.share ?? { acquisitionPrice: 0 };
    const update = (next: Partial<NonNullable<FlowEdgeData['share']>>) => patch({ share: { ...share, ...next } });
    return (
      <fieldset className="space-y-1 card p-2 text-sm">
        <legend className="text-xs text-fg-muted">Cession de titres — le flux porte les titres, le prix circule en sens inverse</legend>
        <label className="block">Prix d’acquisition (€)<input className={control} type="number" min="0" step="0.01" value={share.acquisitionPrice} onChange={(event) => update({ acquisitionPrice: num(event) })} /></label>
        <label className="block">Année d’acquisition<input className={control} type="number" step="1" value={share.acquisitionYear ?? ''} placeholder="ex. 2015" onChange={(event) => update({ acquisitionYear: event.target.value === '' ? undefined : Math.round(num(event)) })} /></label>
        <label className="block">Quote-part cédée (%)<input className={control} type="number" min="0" max="100" step="0.01" value={share.soldPercent ?? ''} placeholder="0" onChange={(event) => update({ soldPercent: num(event) })} /></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={share.retirementAllowance ?? false} onChange={(event) => update({ retirementAllowance: event.target.checked })} />Abattement fixe dirigeant partant à la retraite (500 000 €, CGI art. 150-0 D ter)</label>
        <label className="block">Remploi du produit de cession (%)<input className={control} type="number" min="0" max="100" step="1" value={(share.reinvestment?.ratio ?? 0) * 100} onChange={(event) => update({ reinvestment: { ratio: num(event) / 100, kind: share.reinvestment?.kind ?? 'eligible' } })} /></label>
        <label className="block">Nature du remploi<select className={control} value={share.reinvestment?.kind ?? 'eligible'} onChange={(event) => update({ reinvestment: { ratio: share.reinvestment?.ratio ?? 0, kind: event.target.value as 'eligible' | 'immobilier' | 'fonds' } })}>
          <option value="eligible">Activité économique éligible</option>
          <option value="fonds">Fonds de capital-investissement</option>
          <option value="immobilier">Immobilier patrimonial — non éligible</option>
        </select></label>
        <label className="block">Apport dont ces titres sont issus (identifiant du flux d’apport)<input className={control} value={share.deferredContributionId ?? ''} placeholder="laisser vide hors apport-cession" onChange={(event) => update({ deferredContributionId: event.target.value || undefined })} /></label>
      </fieldset>
    );
  }

  if (flow.category === 'share_contribution') {
    const contribution = flow.contribution ?? { acquisitionPrice: 0 };
    return (
      <fieldset className="space-y-1 card p-2 text-sm">
        <legend className="text-xs text-fg-muted">Apport de titres — report d’imposition (CGI art. 150-0 B ter)</legend>
        <label className="block">Prix d’acquisition des titres apportés (€)<input className={control} type="number" min="0" step="0.01" value={contribution.acquisitionPrice} onChange={(event) => patch({ contribution: { ...contribution, acquisitionPrice: num(event) } })} /></label>
        <label className="block">Contrôle de la société bénéficiaire (%)<input className={control} type="number" min="0" max="100" step="0.01" value={contribution.controlPercent ?? ''} placeholder="0" onChange={(event) => patch({ contribution: { ...contribution, controlPercent: num(event) } })} /></label>
        <p className="m-0 text-xs text-fg-muted">Cession des titres apportés sous 3 ans → remploi d’au moins 70 % du prix dans les 3 ans, conservé 5 ans. La gestion de son propre patrimoine immobilier est exclue du remploi éligible : un OBO immobilier ne tient pas au-delà de la poche libre de 30 %.</p>
      </fieldset>
    );
  }

  if (flow.category === 'property_sale') {
    const property = flow.property ?? { acquisitionPrice: 0 };
    const update = (next: Partial<NonNullable<FlowEdgeData['property']>>) => patch({ property: { ...property, ...next } });
    return (
      <fieldset className="space-y-1 card p-2 text-sm">
        <legend className="text-xs text-fg-muted">Cession immobilière — plus-value des particuliers (CGI art. 150 U à 150 VH)</legend>
        <label className="block">Prix d’acquisition (€)<input className={control} type="number" min="0" step="0.01" value={property.acquisitionPrice} onChange={(event) => update({ acquisitionPrice: num(event) })} /></label>
        <label className="block">Année d’acquisition<input className={control} type="number" step="1" value={property.acquisitionYear ?? ''} placeholder="ex. 2010" onChange={(event) => update({ acquisitionYear: event.target.value === '' ? undefined : Math.round(num(event)) })} /></label>
        <label className="block">Travaux justifiés (€)<input className={control} type="number" min="0" step="0.01" value={property.worksAmount ?? ''} placeholder="vide = forfait 15 % au-delà de 5 ans" onChange={(event) => update({ worksAmount: event.target.value === '' ? undefined : num(event) })} /></label>
        <label className="block">Amortissements déduits en meublé (€)<input className={control} type="number" min="0" step="0.01" value={property.deductedAmortization ?? ''} placeholder="0" onChange={(event) => update({ deductedAmortization: num(event) })} /></label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={property.principalResidence ?? false} onChange={(event) => update({ principalResidence: event.target.checked })} />Résidence principale au jour de la cession : exonération (art. 150 U, II-1°)</label>
        <p className="m-0 text-xs text-fg-muted">Abattements pour durée de détention distincts : exonération d’impôt sur le revenu à 22 ans, de prélèvements sociaux à 30 ans. Les amortissements déduits en meublé sont réintégrés au prix d’acquisition (art. 150 VB, III).</p>
      </fieldset>
    );
  }

  if (flow.category === 'donation') {
    const gift = flow.gift ?? {};
    const update = (next: Partial<NonNullable<FlowEdgeData['gift']>>) => patch({ gift: { ...gift, ...next } });
    return (
      <fieldset className="space-y-1 card p-2 text-sm">
        <legend className="text-xs text-fg-muted">Donation de titres — droits de mutation à titre gratuit</legend>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={gift.dutreil ?? false} onChange={(event) => update({ dutreil: event.target.checked })} />Pacte Dutreil : exonération de 75 % (CGI art. 787 B)</label>
        <label className="flex min-h-11 items-center gap-2"><input type="checkbox" checked={!!gift.reserveUsufruit} onChange={(event) => update({ reserveUsufruit: event.target.checked ? { age: 65 } : undefined })} />Donation avec réserve d’usufruit (assiette = nue-propriété, art. 669)</label>
        {gift.reserveUsufruit ? <label className="block">Âge du donateur<input className={control} type="number" min="0" max="120" step="1" value={gift.reserveUsufruit.age ?? 65} onChange={(event) => update({ reserveUsufruit: { age: Math.round(num(event)) } })} /></label> : null}
        <label className="block">Abattement déjà utilisé sur 15 ans (€)<input className={control} type="number" min="0" step="0.01" value={gift.previousAbatementUsed ?? ''} placeholder="0" onChange={(event) => update({ previousAbatementUsed: num(event) })} /></label>
        <label className="block">Apport dont ces titres sont issus (identifiant du flux d’apport)<input className={control} value={gift.deferredContributionId ?? ''} placeholder="laisser vide hors apport-cession" onChange={(event) => update({ deferredContributionId: event.target.value || undefined })} /></label>
      </fieldset>
    );
  }

  return null;
}
