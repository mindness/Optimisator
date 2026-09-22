import { z } from 'zod';
import { DEFAULT_TAX_REGIME, ENTITY_TYPE_LABELS, scenarioStateSchema, type ScenarioState, type EntityType, type EntityNodeData, type FlowCategory, type FlowEdgeData } from './types';
import {
  calculateCorporateTax,
  calculateFlatTax,
  calculateMotherDaughterDividend,
  MOTHER_DAUGHTER_MIN_HOLDING_PCT,
  PARTICIPATION_QPFC_RATE,
  REPORT_REINVESTMENT_HOLDING_YEARS,
  REPORT_REINVESTMENT_QUOTA,
  REPORT_REINVESTMENT_WINDOW_YEARS,
  REPORT_SALE_WINDOW_YEARS,
  type WhatIfInputs,
} from './engine';

/** `crypto.randomUUID` n'existe qu'en contexte sécurisé (HTTPS/localhost) : repli sur getRandomValues. */
export function newId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID();
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const OPCO_FIELDS = ['caHt', 'expensesHt', 'capital', 'openingTreasury', 'openingCca', 'donations'] as const;

/** Paramètres saisis par type d'entité — source unique pour l'accordéon et les cartes du canevas. */
export const ENTITY_INPUT_FIELDS: Partial<Record<EntityType, readonly string[]>> = {
  sasu: OPCO_FIELDS, eurl: OPCO_FIELDS, sarl: OPCO_FIELDS,
  micro_entreprise: ['caHt', 'expensesHt', 'openingTreasury'],
  entreprise_individuelle: ['caHt', 'expensesHt', 'openingTreasury'],
  holding_sas: ['capital', 'openingTreasury', 'openingCca', 'realEstateValue', 'totalAssets', 'nonProfessionalAssets', 'donations'],
  holding_sarl: ['capital', 'openingTreasury', 'openingCca', 'realEstateValue', 'totalAssets', 'nonProfessionalAssets', 'donations'],
  sci_is: ['rentalIncomeHt', 'interestExpenses', 'buildingAmortization', 'otherCharges', 'realEstateValue', 'capital', 'openingTreasury', 'openingCca'],
  sci_ir: ['rentalIncomeHt', 'interestExpenses', 'otherCharges', 'realEstateValue', 'capital', 'openingTreasury', 'openingCca'],
};

export const ENTITY_INPUT_FIELD_LABELS: Record<string, string> = {
  caHt: 'CA HT annuel', expensesHt: 'Charges HT annuelles', rentalIncomeHt: 'Loyers HT annuels', interestExpenses: 'Intérêts d’emprunt annuels',
  buildingAmortization: 'Amortissement annuel', otherCharges: 'Autres charges annuelles', capital: 'Capital libéré',
  openingTreasury: 'Trésorerie d’ouverture', openingCca: 'Compte courant d’associé d’ouverture',
  realEstateValue: 'Valeur des biens immobiliers (assiette IFI)',
  totalAssets: 'Valeur vénale des actifs détenus (taxe holdings)',
  nonProfessionalAssets: 'dont actifs non professionnels (taxe holdings)',
  donations: 'Versements de mécénat',
};

export const WORKSPACE_KEY = 'optimisator.workspace.v1';
export const DRAFT_KEY = 'optimisator.draft.v1';
const draftSchema = z.object({ sourceId: z.string(), draft: scenarioStateSchema });

/** Brouillon de session : survit au changement d'onglet, pas à un changement de scénario source. */
export function saveDraft(storage: Pick<Storage, 'setItem'>, sourceId: string, draft: ScenarioState): void {
  try { storage.setItem(DRAFT_KEY, JSON.stringify({ sourceId, draft })); } catch { /* quota ou stockage indisponible : le brouillon vit en mémoire */ }
}
export function loadDraft(storage: Pick<Storage, 'getItem'>, sourceId: string): ScenarioState | null {
  try {
    const raw = storage.getItem(DRAFT_KEY);
    if (raw === null) return null;
    const saved = draftSchema.parse(JSON.parse(raw));
    return saved.sourceId === sourceId ? saved.draft : null;
  } catch { return null; }
}
const workspaceSchema = z.object({ version: z.literal(1), draft: scenarioStateSchema, baseline: scenarioStateSchema.nullable() });
export type Workspace = z.infer<typeof workspaceSchema>;

/** Materialize slider values before editing a copy, without mutating a preset. */
export function snapshotScenario(scenario: ScenarioState, inputs: WhatIfInputs = {}): ScenarioState {
  const copy = structuredClone(scenario);
  const opco = copy.entities.find((entity) => entity.entityType === 'sasu') ?? copy.entities.find((entity) => OPERATING.includes(entity.entityType));
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
    if (flow.category === 'dividend' && opco && flow.sourceId === opco.id) flow.amount = inputs.dividendAmount ?? flow.amount;
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
    if (OPERATING.includes(entity.entityType)) {
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
      if (OPERATING.includes(edited.entityType) && flow.category === 'revenue' && flow.targetId === id) amount = patch.inputs.caHt ?? amount;
      if (OPERATING.includes(edited.entityType) && flow.category === 'expense' && flow.sourceId === id) amount = patch.inputs.expensesHt ?? amount;
      if (flow.category === 'rent' && flow.targetId === id) amount = patch.inputs.rentalIncomeHt ?? amount;
    }
    return { ...flow, amount };
  });
  return { ...scenario, entities, flows };
}

const OPERATING: EntityType[] = ['sasu', 'eurl', 'sarl', 'micro_entreprise', 'entreprise_individuelle'];
const COMPANIES: EntityType[] = [...OPERATING, 'holding_sas', 'holding_sarl', 'sci_is', 'sci_ir'];
const EMPLOYERS: EntityType[] = ['sasu', 'eurl', 'sarl', 'holding_sas', 'holding_sarl'];
const pairs = (sources: EntityType[], targets: EntityType[]) => sources.flatMap((s) => targets.map((t) => `${s}:${t}`));

/** Trajets calculables par le moteur : catégorie → couples `source:cible`. */
export const FLOW_ROUTES: Partial<Record<FlowCategory, string[]>> = {
  revenue: pairs(['client'], OPERATING),
  expense: pairs(OPERATING, ['vendor']),
  salary: pairs(EMPLOYERS, ['person']),
  social_charges: pairs([...EMPLOYERS, 'micro_entreprise', 'entreprise_individuelle'], ['urssaf']),
  vat: pairs(OPERATING, ['tax_authority']),
  is_tax: pairs(COMPANIES, ['tax_authority']),
  rent: pairs([...OPERATING, 'holding_sas', 'holding_sarl'], ['sci_is', 'sci_ir']),
  dividend: [...pairs(['sasu', 'sarl', 'holding_sas', 'holding_sarl', 'sci_is'], ['person']), ...pairs(['sasu', 'sarl', 'sci_is'], ['holding_sas', 'holding_sarl'])],
  management_fees: pairs(['sasu', 'eurl', 'sarl'], ['holding_sas', 'holding_sarl']),
  cca_advance: [...pairs(['person'], COMPANIES), ...pairs(COMPANIES, COMPANIES)],
  cca_reimbursement: [...pairs(COMPANIES, ['person']), ...pairs(COMPANIES, COMPANIES)],
  loan_payment: pairs(COMPANIES, ['bank']),
  capital_contribution: [...pairs(['person'], COMPANIES), ...pairs(['holding_sas', 'holding_sarl'], COMPANIES)],
  // Titres, pas trésorerie : la source est le cédant / l'apporteur / le donateur.
  share_sale: pairs(['person', ...COMPANIES], ['person', ...COMPANIES]),
  share_contribution: pairs(['person'], ['holding_sas', 'holding_sarl']),
  donation: pairs(['person'], ['person']),
  property_sale: pairs(['person', ...COMPANIES], ['person', ...COMPANIES]),
};

/** Mouvements de trésorerie : plusieurs flux par source acceptés. */
export const TRANSFER_CATEGORIES: readonly FlowCategory[] = ['cca_advance', 'cca_reimbursement', 'loan_payment', 'capital_contribution'];

/** Types que le moteur sait chiffrer : dérivé des trajets, jamais listé à la main. */
export const ENGINE_COVERED_TYPES: ReadonlySet<EntityType> = new Set(
  Object.values(FLOW_ROUTES).flat().flatMap((route) => route.split(':') as EntityType[]),
);

/** Pourquoi une brique reste un dessin, en une phrase affichable. */
export const OUT_OF_ENGINE_REASON: Partial<Record<EntityType, string>> = {};

const CATEGORY_LAYER: Partial<Record<FlowCategory, FlowEdgeData['layer']>> = {
  revenue: 'treasury', expense: 'treasury', rent: 'treasury', management_fees: 'treasury',
  cca_advance: 'treasury', cca_reimbursement: 'treasury', loan_payment: 'treasury', capital_contribution: 'legal',
  salary: 'social', social_charges: 'social', vat: 'vat', is_tax: 'tax', dividend: 'tax',
  share_sale: 'tax', share_contribution: 'legal', donation: 'legal', property_sale: 'tax',
};
const CATEGORY_LABEL: Partial<Record<FlowCategory, string>> = {
  revenue: 'Chiffre d’affaires', expense: 'Charges', salary: 'Rémunération', social_charges: 'Cotisations URSSAF',
  vat: 'TVA nette', is_tax: 'Impôt sur les sociétés', rent: 'Loyer', dividend: 'Dividendes',
  management_fees: 'Management fees', cca_advance: 'Apport en compte courant',
  cca_reimbursement: 'Remboursement de compte courant', loan_payment: 'Échéance d’emprunt', capital_contribution: 'Apport en capital',
  share_sale: 'Cession de titres', share_contribution: 'Apport de titres (report 150-0 B ter)', donation: 'Donation de titres',
  property_sale: 'Cession immobilière',
};

/**
 * Régime applicable au tracé source → cible : catégorie proposée à la création,
 * puis taux et note légale affichés dans l'éditeur de flux.
 * Le taux vient des calculateurs du moteur, jamais d'une constante recopiée.
 */
export type FlowAdvice = {
  category: FlowCategory;
  label: string;
  layer: FlowEdgeData['layer'];
  legalNoteId?: string;
  /** Nom du régime, vide si le trajet n'en déclenche aucun. */
  regime?: string;
  /** Taux effectif de friction fiscale sur ce flux (0–1). */
  rate?: number;
  tax?: number;
  warning?: string;
};

export function adviseFlow(
  scenario: ScenarioState,
  link: { sourceId: string; targetId: string; category?: FlowCategory; amount?: number },
): FlowAdvice | null {
  const source = scenario.entities.find((entity) => entity.id === link.sourceId);
  const target = scenario.entities.find((entity) => entity.id === link.targetId);
  if (!source || !target) return null;
  const route = `${source.entityType}:${target.entityType}`;
  // Holding → personne : la distribution est le tracé attendu, la rémunération se choisit ensuite.
  const category = link.category
    ?? ((source.entityType === 'holding_sas' || source.entityType === 'holding_sarl') && target.entityType === 'person' ? 'dividend' : undefined)
    ?? (Object.keys(FLOW_ROUTES) as FlowCategory[]).find((key) => FLOW_ROUTES[key]!.includes(route));
  if (!category) return null;

  const advice: FlowAdvice = {
    category,
    label: CATEGORY_LABEL[category] ?? 'Flux à configurer',
    layer: CATEGORY_LAYER[category] ?? 'treasury',
  };
  const amount = link.amount ?? 0;
  // Taux effectif dérivé sur 10 000 € quand le montant est encore nul : sinon 0/0.
  const probe = 10_000;
  if (category === 'management_fees' && FLOW_ROUTES.management_fees!.includes(route)) {
    advice.regime = 'Convention de prestations : déductible chez la SASU, imposé chez la holding';
    advice.legalNoteId = 'management-fees';
    advice.rate = calculateCorporateTax(probe, true).taxDue / probe;
    advice.tax = calculateCorporateTax(amount, true).taxDue;
    advice.warning = 'Prestations réelles, convention écrite et prix de marché exigés : sinon acte anormal de gestion.';
    return advice;
  }
  if (category === 'share_contribution') {
    advice.regime = 'Apport-cession : report d’imposition (CGI art. 150-0 B ter)';
    advice.warning = `Cession des titres apportés sous ${REPORT_SALE_WINDOW_YEARS.value} ans : remploi d’au moins ${REPORT_REINVESTMENT_QUOTA.value * 100} % du prix dans les ${REPORT_REINVESTMENT_WINDOW_YEARS.value} ans, conservé ${REPORT_REINVESTMENT_HOLDING_YEARS.value} ans. La gestion de son propre patrimoine immobilier est exclue du remploi éligible : un OBO immobilier adossé au report ne tient pas au-delà de la poche libre de ${Math.round((1 - REPORT_REINVESTMENT_QUOTA.value) * 100)} %.`;
    return advice;
  }
  if (category === 'share_sale') {
    const person = source.entityType === 'person';
    advice.regime = person
      ? 'Plus-value de cession de titres (CGI art. 150-0 A) : PFU ou barème sur option globale'
      : 'Titres de participation (CGI art. 219, I-a quinquies) : exonération sous quote-part de frais et charges de 12 %';
    advice.rate = person ? calculateFlatTax(probe).totalTax / probe : PARTICIPATION_QPFC_RATE.value;
    advice.warning = person
      ? 'Les abattements pour durée de détention ne visent que les titres acquis avant 2018, et seulement sur option barème.'
      : 'Régime de participation soumis à une détention d’au moins 5 % depuis 2 ans : renseignez la quote-part cédée et l’année d’acquisition.';
    return advice;
  }
  if (category === 'donation') {
    advice.regime = 'Donation en ligne directe : abattement 100 000 € par parent et par enfant, renouvelable 15 ans';
    advice.warning = 'Pacte Dutreil : exonération de 75 % subordonnée à un engagement collectif de 2 ans, un engagement individuel de 6 ans et une fonction de direction — conditions à vérifier, jamais supposées.';
    return advice;
  }
  if (category !== 'dividend' || !FLOW_ROUTES.dividend!.includes(route)) return advice;

  if (target.entityType === 'holding_sas' || target.entityType === 'holding_sarl') {
    advice.regime = 'Régime mère-fille (CGI art. 145 / 216)';
    advice.label = 'Dividendes mère-fille';
    advice.legalNoteId = 'mere-fille-art-145';
    advice.rate = calculateMotherDaughterDividend(probe).holdingTax / probe;
    advice.tax = calculateMotherDaughterDividend(amount).holdingTax;
    // Même lecture de la détention que le moteur (graphResolver) : lien explicite ou ownershipPercent de la fille.
    const minPercent = MOTHER_DAUGHTER_MIN_HOLDING_PCT.value * 100;
    const held = (scenario.ownerships ?? []).some(
      (own) => own.ownerId === target.id && own.companyId === source.id && own.percent >= minPercent,
    ) || (source.ownershipPercent ?? 0) >= minPercent;
    if (!held) {
      advice.warning = `Régime conditionné à une détention ≥ ${minPercent} % conservée 2 ans : renseignez la détention de la holding dans la SASU.`;
    }
  } else {
    advice.regime = 'Flat tax (PFU)';
    advice.label = 'Dividendes → PFU dirigeant';
    advice.rate = calculateFlatTax(probe).totalTax / probe;
    advice.tax = calculateFlatTax(amount).totalTax;
  }
  return advice;
}

/** Coverage gate, NOT a legal eligibility check. Unsupported drafts remain editable. */
export function simulationIssues(scenario: ScenarioState): string[] {
  if (!scenarioStateSchema.safeParse(scenario).success) return ['Champs incomplets ou montants non valides.'];
  const issues: string[] = ownershipIssues(scenario);
  const ids = new Set(scenario.entities.map((entity) => entity.id));
  if (ids.size !== scenario.entities.length || new Set(scenario.flows.map((flow) => flow.id)).size !== scenario.flows.length) issues.push('Identifiants dupliqués.');
  if (!scenario.entities.some((entity) => COMPANIES.includes(entity.entityType))) issues.push('Ajoutez au moins une société.');
  if (scenario.entities.some((entity) => Object.values(entity.inputs ?? {}).some((value) => !Number.isFinite(value) || value < 0))) issues.push('Les paramètres doivent être des nombres positifs ou nuls.');
  for (const entity of scenario.entities) {
    const reason = OUT_OF_ENGINE_REASON[entity.entityType];
    if (reason) issues.push(`${ENTITY_TYPE_LABELS[entity.entityType]} — ${reason}`);
  }
  const byId = new Map(scenario.entities.map((entity) => [entity.id, entity.entityType]));
  const routes = FLOW_ROUTES;
  const seen = new Set<string>();
  for (const flow of scenario.flows) {
    if (!ids.has(flow.sourceId) || !ids.has(flow.targetId) || flow.sourceId === flow.targetId) issues.push('Flux sans source/destination distinctes et existantes.');
    if (!Number.isFinite(flow.amount) || flow.amount < 0) issues.push('Les montants doivent être positifs ou nuls.');
    if (!routes[flow.category]?.includes(`${byId.get(flow.sourceId)}:${byId.get(flow.targetId)}`)) issues.push(`Flux non calculable : ${flow.label} (${flow.category}).`);
    const key = `${flow.sourceId}:${flow.category}:${flow.targetId}`;
    if (seen.has(key)) issues.push('Deux flux de même nature entre les mêmes parties : fusionnez-les.');
    seen.add(key);
  }
  for (const entity of scenario.entities) {
    // La location meublée est commerciale par nature : une SCI à l'IR bascule à l'IS (CGI art. 206, 2).
    if (entity.options?.locationMeubleeReelle && entity.entityType === 'sci_ir') {
      issues.push(`${entity.label} : location meublée dans une SCI à l’IR — activité commerciale par nature, la société bascule à l’IS. Passez le régime à l’IS.`);
    }
    if (OPERATING.includes(entity.entityType)) {
      const revenue = scenario.flows.find((flow) => flow.category === 'revenue' && flow.targetId === entity.id);
      const expense = scenario.flows.find((flow) => flow.category === 'expense' && flow.sourceId === entity.id);
      if ((revenue && entity.inputs?.caHt !== undefined && revenue.amount !== entity.inputs.caHt) ||
          (expense && entity.inputs?.expensesHt !== undefined && expense.amount !== entity.inputs.expensesHt)) issues.push('Montants du schéma et paramètres de la SASU incohérents : éditez le flux pour les synchroniser.');
    }
  }
  return [...new Set(issues)];
}

/** Fichier `.json` échangeable : le schéma, ses réglages What-If et ses calques. */
export const SCENARIO_FILE_FORMAT = 'optimisator.scenario';
const scenarioFileSchema = z.object({
  format: z.literal(SCENARIO_FILE_FORMAT),
  version: z.literal(1),
  exportedAt: z.string(),
  scenario: scenarioStateSchema,
  whatIf: z.record(z.string(), z.unknown()).optional(),
});
export type ScenarioFile = z.infer<typeof scenarioFileSchema>;

export function exportScenarioFile(scenario: ScenarioState, whatIf: WhatIfInputs = {}): string {
  const file: ScenarioFile = { format: SCENARIO_FILE_FORMAT, version: 1, exportedAt: new Date().toISOString(), scenario, whatIf: { ...whatIf } };
  return JSON.stringify(file, null, 2);
}

/** Accepte le fichier exporté, un ScenarioState nu ou un payload de partage `{ scenario }`. Lève si invalide. */
export function parseScenarioFile(text: string): { scenario: ScenarioState; whatIf: WhatIfInputs } {
  const raw: unknown = JSON.parse(text);
  const file = scenarioFileSchema.safeParse(raw);
  if (file.success) return { scenario: file.data.scenario, whatIf: (file.data.whatIf ?? {}) as WhatIfInputs };
  const wrapped = raw && typeof raw === 'object' && 'scenario' in raw ? (raw as { scenario: unknown; whatIf?: unknown }) : null;
  const scenario = scenarioStateSchema.parse(wrapped ? wrapped.scenario : raw);
  return { scenario, whatIf: (wrapped?.whatIf && typeof wrapped.whatIf === 'object' ? wrapped.whatIf : {}) as WhatIfInputs };
}

/** Nom de fichier sûr, dérivé du nom du scénario. */
export function scenarioFileName(scenario: ScenarioState): string {
  const slug = scenario.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'schema';
  return `${slug}.optimisator.json`;
}

/**
 * Complète un schéma pour qu'il soit calculable : ajoute la SASU si absente, les
 * tiers obligatoires (client, fournisseur, URSSAF, Trésor) et les flux requis à zéro.
 * Ne touche ni aux montants existants ni aux entités déjà là.
 */
export function completeScenario(scenario: ScenarioState): ScenarioState {
  const entities = [...scenario.entities];
  const flows = [...scenario.flows];
  const ensureEntity = (entityType: EntityType, label: string): EntityNodeData => {
    let found = entities.find((entity) => entity.entityType === entityType);
    if (!found) {
      found = { id: newId(), label, entityType, ...(entityType === 'sasu' ? { inputs: { caHt: 0, expensesHt: 0 } } : {}) };
      entities.push(found);
    }
    return found;
  };
  const existing = entities.find((entity) => entity.entityType === 'sasu') ?? entities.find((entity) => OPERATING.includes(entity.entityType));
  const sasu = existing ?? ensureEntity('sasu', 'SASU');
  const required: Array<[FlowCategory, EntityType, string, 'in' | 'out', string, FlowEdgeData['layer']]> = [
    ['revenue', 'client', 'Clients', 'in', 'Chiffre d’affaires HT', 'treasury'],
    ['expense', 'vendor', 'Fournisseurs', 'out', 'Charges HT', 'treasury'],
    ['salary', 'person', 'Dirigeant', 'out', 'Rémunération nette', 'social'],
    ['social_charges', 'urssaf', 'URSSAF', 'out', 'Cotisations URSSAF', 'social'],
    ['vat', 'tax_authority', 'Trésor public', 'out', 'TVA nette', 'vat'],
    ['is_tax', 'tax_authority', 'Trésor public', 'out', 'Impôt sur les sociétés', 'tax'],
  ];
  for (const [category, otherType, otherLabel, direction, label, layer] of required) {
    if (flows.some((flow) => flow.category === category && (direction === 'in' ? flow.targetId : flow.sourceId) === sasu.id)) continue;
    const other = ensureEntity(otherType, otherLabel);
    const amount = category === 'revenue' ? sasu.inputs?.caHt ?? 0 : category === 'expense' ? sasu.inputs?.expensesHt ?? 0 : 0;
    flows.push({
      id: newId(), category, label, amount, periodicity: 'annual', layer,
      sourceId: direction === 'in' ? other.id : sasu.id, targetId: direction === 'in' ? sasu.id : other.id,
    });
  }
  // Une holding ou une SCI IS déjà posée paie son IS : le flux est requis par le moteur.
  for (const entity of entities) {
    if (['holding_sas', 'holding_sarl', 'sci_is'].includes(entity.entityType) && !flows.some((flow) => flow.category === 'is_tax' && flow.sourceId === entity.id)) {
      const treasury = ensureEntity('tax_authority', 'Trésor public');
      flows.push({ id: newId(), category: 'is_tax', label: `IS ${entity.label}`, amount: 0, periodicity: 'annual', layer: 'tax', sourceId: entity.id, targetId: treasury.id });
    }
  }
  return { ...scenario, entities, flows };
}

/**
 * Flux subis, déduits du schéma lui-même : une vente appelle la TVA, une
 * rémunération appelle les cotisations, un bénéfice à l'IS appelle l'impôt.
 * Ils sont créés à zéro — le moteur les chiffre à partir des taux vérifiés,
 * l'utilisateur n'a jamais à les saisir. Les trajets autorisés viennent de
 * `FLOW_ROUTES` : aucune liste de types n'est réécrite ici.
 */
export function autoCompanionFlows(scenario: ScenarioState): ScenarioState {
  const entities = [...scenario.entities];
  const flows = [...scenario.flows];
  const ensureEntity = (entityType: EntityType, label: string): EntityNodeData => {
    let found = entities.find((entity) => entity.entityType === entityType);
    if (!found) { found = { id: newId(), label, entityType }; entities.push(found); }
    return found;
  };
  const routed = (category: FlowCategory, from: EntityType, to: EntityType) =>
    FLOW_ROUTES[category]?.includes(`${from}:${to}`) ?? false;
  const ensureFlow = (category: FlowCategory, company: EntityNodeData, toType: EntityType, toLabel: string, label: string) => {
    if (!routed(category, company.entityType, toType)) return;
    if (flows.some((flow) => flow.category === category && flow.sourceId === company.id)) return;
    const other = ensureEntity(toType, toLabel);
    flows.push({
      id: newId(), category, label: `${label} — ${company.label}`, amount: 0, periodicity: 'annual',
      layer: CATEGORY_LAYER[category] ?? 'treasury', sourceId: company.id, targetId: other.id,
    });
  };

  for (const company of scenario.entities) {
    if (!COMPANIES.includes(company.entityType)) continue;
    const sells = flows.some((flow) => ['revenue', 'rent', 'management_fees'].includes(flow.category) && flow.targetId === company.id)
      || (company.inputs?.caHt ?? company.inputs?.rentalIncomeHt ?? 0) > 0;
    const buys = flows.some((flow) => flow.category === 'expense' && flow.sourceId === company.id)
      || (company.inputs?.expensesHt ?? 0) > 0;
    const pays = flows.some((flow) => flow.category === 'salary' && flow.sourceId === company.id);
    // Franchise en base : pas de TVA facturée ni déductible, donc pas de flux TVA.
    const franchise = company.options?.franchiseTva ?? company.entityType === 'micro_entreprise';
    if ((sells || buys) && !franchise) ensureFlow('vat', company, 'tax_authority', 'Trésor public', 'TVA nette');
    if (pays) ensureFlow('social_charges', company, 'urssaf', 'URSSAF', 'Cotisations URSSAF');
    // Une société à l'IS liquide son impôt même à zéro : le flux porte le calcul.
    const regime = company.taxRegime ?? DEFAULT_TAX_REGIME[company.entityType];
    if (regime === 'is' && (sells || buys || pays)) ensureFlow('is_tax', company, 'tax_authority', 'Trésor public', 'Impôt sur les sociétés');
  }
  return flows.length === scenario.flows.length ? scenario : { ...scenario, entities, flows };
}

export function saveWorkspace(storage: Pick<Storage, 'setItem'>, workspace: Workspace): void {
  storage.setItem(WORKSPACE_KEY, JSON.stringify(workspaceSchema.parse(workspace)));
}

export function loadWorkspace(storage: Pick<Storage, 'getItem'>): Workspace | null {
  const raw = storage.getItem(WORKSPACE_KEY);
  return raw === null ? null : workspaceSchema.parse(JSON.parse(raw));
}
