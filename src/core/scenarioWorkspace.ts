import { z } from 'zod';
import { scenarioStateSchema, type ScenarioState, type EntityType, type EntityNodeData, type FlowEdgeData } from './types';
import type { WhatIfInputs } from './engine';

export const WORKSPACE_KEY = 'optimisator.workspace.v1';
const workspaceSchema = z.object({ version: z.literal(1), draft: scenarioStateSchema, baseline: scenarioStateSchema.nullable() });
export type Workspace = z.infer<typeof workspaceSchema>;

/** Materialize slider values before editing a copy, without mutating a preset. */
export function snapshotScenario(scenario: ScenarioState, inputs: WhatIfInputs = {}): ScenarioState {
  const copy = structuredClone(scenario);
  const opco = copy.entities.find((entity) => entity.entityType === 'sasu');
  const revenue = copy.flows.find((flow) => flow.category === 'revenue');
  const ca = inputs.caHt ?? ((opco?.inputs?.caHt ?? revenue?.amount ?? 0) * (inputs.caMultiplier ?? 1));
  if (opco) opco.inputs = { ...opco.inputs, caHt: ca, ...(inputs.expensesHt !== undefined ? { expensesHt: inputs.expensesHt } : {}) };
  const seen = new Set<string>();
  for (const flow of copy.flows) {
    const source = copy.entities.find((entity) => entity.id === flow.sourceId)?.entityType;
    const key = flow.category === 'dividend' ? `${flow.category}:${source}` : flow.category;
    if (seen.has(key)) continue;
    seen.add(key);
    if (flow.category === 'revenue') flow.amount = ca;
    if (flow.category === 'expense') flow.amount = inputs.expensesHt ?? flow.amount;
    if (flow.category === 'salary') flow.amount = inputs.executiveNetSalary ?? flow.amount;
    if (flow.category === 'rent') flow.amount = inputs.sciRentHt ?? flow.amount;
    if (flow.category === 'dividend' && source === 'sasu') flow.amount = inputs.dividendAmount ?? flow.amount;
    if (flow.category === 'dividend' && (source === 'holding_sas' || source === 'holding_sarl')) flow.amount = inputs.holdingDividendAmount ?? flow.amount;
  }
  return copy;
}

export function removeEntity(scenario: ScenarioState, id: string): ScenarioState {
  if (scenario.entities.length <= 1) return scenario;
  const nodePositions = { ...scenario.nodePositions };
  delete nodePositions[id];
  return { ...scenario, nodePositions, entities: scenario.entities.filter((entity) => entity.id !== id),
    ownerships: scenario.ownerships?.filter((link) => link.ownerId !== id && link.companyId !== id),
    flows: scenario.flows.filter((flow) => flow.sourceId !== id && flow.targetId !== id) };
}

export function ownershipIssues(scenario: ScenarioState): string[] {
  const problems: string[] = [];
  const companies: EntityType[] = ['sasu', 'holding_sas', 'holding_sarl', 'sci_is', 'sci_ir'];
  const totals = new Map<string, number>();
  const pairs = new Set<string>();
  const ids = new Set<string>();
  for (const link of scenario.ownerships ?? []) {
    const owner = scenario.entities.find((entity) => entity.id === link.ownerId);
    const company = scenario.entities.find((entity) => entity.id === link.companyId);
    if (!owner || !company || owner.id === company.id || !companies.includes(company.entityType) ||
        (owner.entityType !== 'person' && !companies.includes(owner.entityType))) problems.push('Détention : associé et société doivent être distincts et valides.');
    const pair = JSON.stringify([link.ownerId, link.companyId]);
    if (pairs.has(pair) || ids.has(link.id)) problems.push('Lien de détention dupliqué.');
    pairs.add(pair); ids.add(link.id);
    if (!Number.isFinite(link.percent) || link.percent <= 0 || link.percent > 100) problems.push('Pourcentage de détention invalide.');
    totals.set(link.companyId, (totals.get(link.companyId) ?? 0) + link.percent);
  }
  if ([...totals.values()].some((total) => total > 100 + 1e-9)) problems.push('La détention totale d’une société dépasse 100 %.');
  return [...new Set(problems)];
}

/** Keep the input fields read by the legacy engine consistent with editable cash-flow bases. */
export function updateWorkspaceFlow(scenario: ScenarioState, id: string, patch: Partial<FlowEdgeData>): ScenarioState {
  const flows = scenario.flows.map((flow) => flow.id === id ? { ...flow, ...patch } : flow);
  const entities = scenario.entities.map((entity) => {
    const inputs = { ...entity.inputs };
    const revenue = flows.find((flow) => flow.category === 'revenue' && flow.targetId === entity.id);
    const expense = flows.find((flow) => flow.category === 'expense' && flow.sourceId === entity.id);
    const rent = flows.find((flow) => flow.category === 'rent' && flow.targetId === entity.id);
    if (entity.entityType === 'sasu') {
      if (revenue) inputs.caHt = revenue.amount;
      if (expense) inputs.expensesHt = expense.amount;
    }
    if (rent && (entity.entityType === 'sci_is' || entity.entityType === 'sci_ir')) inputs.rentalIncomeHt = rent.amount;
    return { ...entity, inputs };
  });
  return { ...scenario, flows, entities };
}

export function updateWorkspaceEntity(scenario: ScenarioState, id: string, patch: Partial<EntityNodeData>): ScenarioState {
  const entities = scenario.entities.map((entity) => entity.id === id ? { ...entity, ...patch } : entity);
  const edited = entities.find((entity) => entity.id === id);
  const flows = scenario.flows.map((flow) => {
    let amount = flow.amount;
    if (patch.inputs && edited) {
      if (edited.entityType === 'sasu' && flow.category === 'revenue' && flow.targetId === id) amount = patch.inputs.caHt ?? amount;
      if (edited.entityType === 'sasu' && flow.category === 'expense' && flow.sourceId === id) amount = patch.inputs.expensesHt ?? amount;
      if (flow.category === 'rent' && flow.targetId === id) amount = patch.inputs.rentalIncomeHt ?? amount;
    }
    return { ...flow, amount };
  });
  return { ...scenario, entities, flows };
}

/** Coverage gate, NOT a legal eligibility check. Unsupported drafts remain editable. */
export function simulationIssues(scenario: ScenarioState): string[] {
  if (!scenarioStateSchema.safeParse(scenario).success) return ['Champs incomplets ou montants non valides.'];
  const issues: string[] = ownershipIssues(scenario);
  const ids = new Set(scenario.entities.map((entity) => entity.id));
  if (ids.size !== scenario.entities.length || new Set(scenario.flows.map((flow) => flow.id)).size !== scenario.flows.length) issues.push('Identifiants dupliqués.');
  const count = (type: EntityType) => scenario.entities.filter((entity) => entity.entityType === type).length;
  if (count('sasu') !== 1 || count('sci_is') > 1 || count('holding_sas') > 1 || count('holding_sarl') || count('sci_ir')) issues.push('Le moteur couvre une SASU, au plus une holding SAS et une SCI IS. Les autres structures restent des schémas.');
  if (scenario.entities.some((entity) => Object.values(entity.inputs ?? {}).some((value) => !Number.isFinite(value) || value < 0))) issues.push('Les paramètres doivent être des nombres positifs ou nuls.');
  const byId = new Map(scenario.entities.map((entity) => [entity.id, entity.entityType]));
  const routes: Record<string, string[]> = {
    revenue: ['client:sasu'], expense: ['sasu:vendor'], salary: ['sasu:person'], social_charges: ['sasu:urssaf'],
    vat: ['sasu:tax_authority'], is_tax: ['sasu:tax_authority', 'holding_sas:tax_authority', 'sci_is:tax_authority'],
    rent: ['sasu:sci_is'], dividend: ['sasu:person', 'sasu:holding_sas', 'holding_sas:person'],
  };
  const seen = new Set<string>();
  for (const flow of scenario.flows) {
    if (!ids.has(flow.sourceId) || !ids.has(flow.targetId) || flow.sourceId === flow.targetId) issues.push('Flux sans source/destination distinctes et existantes.');
    if (!Number.isFinite(flow.amount) || flow.amount < 0 || flow.periodicity !== 'annual') issues.push('Le moteur attend des montants annuels positifs ou nuls.');
    if (!routes[flow.category]?.includes(`${byId.get(flow.sourceId)}:${byId.get(flow.targetId)}`)) issues.push(`Flux non calculable : ${flow.label} (${flow.category}).`);
    const key = `${flow.sourceId}:${flow.category}`;
    if (seen.has(key)) issues.push('Plusieurs flux de même catégorie par source ne sont pas encore pris en charge.');
    seen.add(key);
  }
  for (const category of ['revenue', 'expense', 'salary', 'social_charges', 'vat']) {
    if (scenario.flows.filter((flow) => flow.category === category).length !== 1) issues.push(`Le modèle nécessite un flux ${category}, éventuellement à zéro.`);
  }
  for (const entity of scenario.entities) {
    if (entity.entityType === 'sasu') {
      const revenue = scenario.flows.find((flow) => flow.category === 'revenue' && flow.targetId === entity.id);
      const expense = scenario.flows.find((flow) => flow.category === 'expense' && flow.sourceId === entity.id);
      if ((revenue && entity.inputs?.caHt !== undefined && revenue.amount !== entity.inputs.caHt) ||
          (expense && entity.inputs?.expensesHt !== undefined && expense.amount !== entity.inputs.expensesHt)) issues.push('Montants du schéma et paramètres de la SASU incohérents : éditez le flux pour les synchroniser.');
    }
  }
  return [...new Set(issues)];
}

export function saveWorkspace(storage: Pick<Storage, 'setItem'>, workspace: Workspace): void {
  storage.setItem(WORKSPACE_KEY, JSON.stringify(workspaceSchema.parse(workspace)));
}

export function loadWorkspace(storage: Pick<Storage, 'getItem'>): Workspace | null {
  const raw = storage.getItem(WORKSPACE_KEY);
  return raw === null ? null : workspaceSchema.parse(JSON.parse(raw));
}
