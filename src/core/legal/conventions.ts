/**
 * Catalogue des conventions intra-groupe : pour deux entités du schéma, quelles
 * conventions sont envisageables, à quelles conditions, et ce qu'elles apportent.
 * Les articles vivent dans legalNotes.json ; ici seulement la logique d'appariement.
 * Pédagogique : aucune condition « remplie » ne vaut validation juridique.
 */
import {
  DEFAULT_TAX_REGIME,
  type EntityNodeData,
  type EntityType,
  type FlowCategory,
  type FlowLayer,
  type ScenarioState,
} from '../types';

export type ConditionStatus = 'met' | 'unmet' | 'unknown';
export interface ConventionCondition { label: string; status: ConditionStatus }

export interface Convention {
  id: string;
  title: string;
  /** Une phrase : qui contracte avec qui. */
  parties: string;
  brings: string[];
  risks: string[];
  legalNoteId: string;
}

export interface ConventionMatch {
  convention: Convention;
  /** Parties dans l'orientation de la convention (ex. fille → mère). */
  from: EntityNodeData;
  to: EntityNodeData;
  conditions: ConventionCondition[];
  /** Flux monétaire que la convention crée, si elle en crée un. */
  flow?: { category: FlowCategory; sourceId: string; targetId: string; label: string; layer: FlowLayer };
}

const COMPANY_TYPES: readonly EntityType[] = ['sasu', 'eurl', 'sarl', 'holding_sas', 'holding_sarl', 'sci_is', 'sci_ir'];
const isCompany = (e: EntityNodeData) => COMPANY_TYPES.includes(e.entityType);
const isHolding = (e: EntityNodeData) => e.entityType === 'holding_sas' || e.entityType === 'holding_sarl';
const isSci = (e: EntityNodeData) => e.entityType === 'sci_is' || e.entityType === 'sci_ir';
const isOperating = (e: EntityNodeData) => ['sasu', 'eurl', 'sarl'].includes(e.entityType);
const isPerson = (e: EntityNodeData) => e.entityType === 'person';
const isIS = (e: EntityNodeData) => (e.taxRegime ?? DEFAULT_TAX_REGIME[e.entityType]) === 'is';

/** Part du capital de `company` détenue par `owner`, ou undefined si non renseignée. */
export function stakeOf(scenario: ScenarioState, ownerId: string, companyId: string): number | undefined {
  const link = (scenario.ownerships ?? []).find((own) => own.ownerId === ownerId && own.companyId === companyId);
  if (link) return link.percent;
  // Champ historique des presets : ownershipPercent de la fille = part détenue par la holding.
  const owner = scenario.entities.find((e) => e.id === ownerId);
  const company = scenario.entities.find((e) => e.id === companyId);
  if (owner && company && isHolding(owner) && company.entityType === 'sasu') return company.ownershipPercent;
  return undefined;
}

function stakeCondition(scenario: ScenarioState, ownerId: string, companyId: string, min: number, label: string): ConventionCondition {
  const pct = stakeOf(scenario, ownerId, companyId);
  return { label, status: pct === undefined ? 'unknown' : pct >= min ? 'met' : 'unmet' };
}
const bothIS = (a: EntityNodeData, b: EntityNodeData): ConventionCondition => ({
  label: 'Les deux sociétés sont à l’IS', status: isIS(a) && isIS(b) ? 'met' : 'unmet',
});
const toCheck = (label: string): ConventionCondition => ({ label, status: 'unknown' });

/** Règle d'appariement : `from`/`to` dans l'orientation de la convention. */
interface Rule extends Convention {
  /** Convention réciproque : un seul appariement par paire, pas un par sens. */
  symmetric?: boolean;
  applies: (from: EntityNodeData, to: EntityNodeData) => boolean;
  conditions: (scenario: ScenarioState, from: EntityNodeData, to: EntityNodeData) => ConventionCondition[];
  flow?: (from: EntityNodeData, to: EntityNodeData) => ConventionMatch['flow'];
}

const RULES: Rule[] = [
  {
    id: 'mere-fille',
    title: 'Régime mère-fille',
    parties: 'Filiale (IS) → société mère (IS) détenant ≥ 5 %',
    brings: [
      'Dividendes remontés exonérés à 95 % : friction ≈ 1,25 % au lieu de 31,4 % en PFU.',
      'Le cash s’accumule dans la holding pour réinvestir (SCI, participations) sans passer par l’IR.',
    ],
    risks: [
      'Titres conservés 2 ans (ou engagement de conservation).',
      'Rien n’est distribué au dirigeant : sortir le cash de la holding coûtera le PFU plus tard.',
    ],
    legalNoteId: 'mere-fille-art-145',
    applies: (from, to) => isCompany(from) && !isSci(from) && isHolding(to),
    conditions: (s, from, to) => [
      stakeCondition(s, to.id, from.id, 5, 'La mère détient ≥ 5 % du capital de la fille'),
      bothIS(from, to),
      toCheck('Titres détenus depuis 2 ans ou engagement de conservation'),
    ],
    flow: (from, to) => ({ category: 'dividend', sourceId: from.id, targetId: to.id, label: 'Dividendes mère-fille', layer: 'tax' }),
  },
  {
    id: 'integration-fiscale',
    title: 'Intégration fiscale',
    parties: 'Société mère (IS) détenant ≥ 95 % → filiale (IS)',
    brings: [
      'Un seul IS sur le résultat d’ensemble : les déficits d’une société s’imputent sur les bénéfices des autres.',
      'QPFC mère-fille ramenée à 1 % sur les dividendes internes au groupe.',
    ],
    risks: [
      'Option de 5 exercices, exercices alignés, chaque société solidaire de l’IS du groupe.',
      'Convention d’intégration à rédiger pour répartir la charge d’impôt entre sociétés.',
    ],
    legalNoteId: 'integration-fiscale',
    applies: (from, to) => isHolding(from) && isCompany(to) && !isHolding(to),
    conditions: (s, from, to) => [
      stakeCondition(s, from.id, to.id, 95, 'La mère détient ≥ 95 % du capital, de manière continue'),
      bothIS(from, to),
      toCheck('La mère n’est pas elle-même détenue à ≥ 95 % par une société à l’IS'),
    ],
    // Pas de flux : l'option se coche sur la carte et change le calcul de l'IS.
  },
  {
    id: 'management-fees',
    title: 'Convention de prestations de services (management fees)',
    parties: 'Holding prestataire → société d’exploitation cliente',
    brings: [
      'Remonte du cash vers la holding sans attendre une distribution : charge déductible chez la fille, produit imposable chez la holding.',
      'Permet de porter la rémunération du dirigeant (et ses frais) au niveau de la holding, financée par les fees.',
      'Si la holding anime effectivement le groupe (holding animatrice) : TVA récupérable sur ses frais et accès aux régimes de faveur des titres.',
    ],
    risks: [
      'Prestations réelles, distinctes du mandat social du dirigeant, à prix de marché : sinon acte anormal de gestion et réintégration chez la fille.',
      'Convention réglementée en SAS (rapport du président, vote des associés).',
      'TVA 20 % facturée : neutre si les deux sociétés récupèrent la TVA.',
    ],
    legalNoteId: 'management-fees',
    applies: (from, to) => isHolding(from) && isOperating(to),
    conditions: (s, from, to) => [
      stakeCondition(s, from.id, to.id, 0.01, 'Lien en capital ou contrôle entre les deux sociétés'),
      toCheck('Convention écrite décrivant les prestations et leur prix'),
      toCheck('Prestations effectivement rendues, distinctes du mandat social'),
    ],
    flow: (from, to) => ({ category: 'management_fees', sourceId: to.id, targetId: from.id, label: 'Management fees', layer: 'treasury' }),
  },
  {
    id: 'convention-tresorerie',
    title: 'Convention de trésorerie (cash pooling)',
    parties: 'Sociétés liées par un contrôle effectif en capital',
    brings: [
      'Les excédents d’une société financent les besoins d’une autre sans banque : ex. la holding avance à la SCI l’apport d’un achat immobilier.',
      'Intérêts déductibles chez l’emprunteuse, imposables chez la prêteuse : neutre au niveau du groupe.',
    ],
    risks: [
      'Sans lien de capital conférant un contrôle effectif, l’opération relève du monopole bancaire.',
      'Convention écrite, taux d’intérêt normal, remboursements suivis : sinon avance requalifiée en distribution.',
    ],
    legalNoteId: 'convention-tresorerie',
    symmetric: true,
    applies: (from, to) => isCompany(from) && isCompany(to) && from.id !== to.id,
    conditions: (s, from, to) => {
      const direct = stakeOf(s, from.id, to.id) ?? stakeOf(s, to.id, from.id);
      const commonParent = s.entities.some((p) => isCompany(p) && (stakeOf(s, p.id, from.id) ?? 0) > 50 && (stakeOf(s, p.id, to.id) ?? 0) > 50);
      return [
        { label: 'Lien de capital conférant un contrôle effectif (direct ou via une mère commune)', status: direct === undefined && !commonParent ? 'unknown' : (direct ?? 0) > 50 || commonParent ? 'met' : 'unmet' },
        toCheck('Convention écrite fixant plafond, taux et durée'),
      ];
    },
    flow: (from, to) => ({ category: 'cca_advance', sourceId: from.id, targetId: to.id, label: 'Avance de trésorerie intra-groupe', layer: 'treasury' }),
  },
  {
    id: 'cca-associe',
    title: 'Compte courant d’associé (apport de l’associé)',
    parties: 'Associé personne physique → société dont il est associé',
    brings: [
      'Financement souple : l’associé prête à sa société, remboursable à tout moment sans fiscalité sur le remboursement.',
      'Intérêts possibles, déductibles chez la société dans la limite du taux légal, imposés chez l’associé (PFU).',
    ],
    risks: [
      'Jamais débiteur pour un dirigeant personne physique : interdit à peine de nullité (SAS, SARL).',
      'Déduction des intérêts subordonnée à un capital entièrement libéré.',
    ],
    legalNoteId: 'cca-interets',
    applies: (from, to) => isPerson(from) && isCompany(to),
    conditions: (s, from, to) => [
      stakeCondition(s, from.id, to.id, 0.01, 'La personne est associée de la société'),
      toCheck('Capital entièrement libéré (pour déduire les intérêts)'),
    ],
    flow: (from, to) => ({ category: 'cca_advance', sourceId: from.id, targetId: to.id, label: 'Apport en compte courant', layer: 'treasury' }),
  },
  {
    id: 'bail-sci',
    title: 'Bail SCI → société d’exploitation',
    parties: 'SCI propriétaire → société d’exploitation locataire',
    brings: [
      'Loyer déductible chez l’exploitation, immeuble isolé du risque d’exploitation dans la SCI.',
      'SCI à l’IS : amortissement du bâti et IS à 15 % / 25 % ; SCI à l’IR : loyers imposés chez les associés (transparence).',
    ],
    risks: [
      'Loyer au prix de marché, bail écrit : un loyer surévalué est un acte anormal de gestion.',
      'Convention réglementée si le dirigeant est associé des deux côtés.',
    ],
    legalNoteId: 'bail-sci',
    applies: (from, to) => isSci(from) && isOperating(to),
    conditions: () => [
      toCheck('La SCI est propriétaire des locaux utilisés par l’exploitation'),
      toCheck('Bail écrit à loyer de marché'),
    ],
    flow: (from, to) => ({ category: 'rent', sourceId: to.id, targetId: from.id, label: 'Loyer', layer: 'treasury' }),
  },
  {
    id: 'distribution-personne',
    title: 'Distribution de dividendes à l’associé',
    parties: 'Société (IS) → associé personne physique',
    brings: [
      'Sortie de cash sans cotisations sociales : PFU 31,4 % ou barème avec abattement 40 % (comparé automatiquement).',
      'Complète une rémunération basse pour rester sous une tranche d’IR.',
    ],
    risks: [
      'Bénéfice distribuable et décision d’AG requis : la trésorerie ne suffit pas.',
      'Gérant majoritaire TNS (EURL / SARL) : la part de dividendes > 10 % du capital est soumise aux cotisations sociales.',
      'Aucun droit social (retraite, prévoyance) acquis, contrairement au salaire.',
    ],
    legalNoteId: 'pfu-dividendes',
    applies: (from, to) => isCompany(from) && isIS(from) && isPerson(to),
    conditions: (s, from, to) => [
      stakeCondition(s, to.id, from.id, 0.01, 'La personne est associée de la société'),
      toCheck('Bénéfice distribuable approuvé en assemblée'),
    ],
    flow: (from, to) => ({ category: 'dividend', sourceId: from.id, targetId: to.id, label: 'Dividendes', layer: 'tax' }),
  },
];

const strip = ({ applies: _a, conditions: _c, flow: _f, symmetric: _s, ...convention }: Rule): Convention => convention;
export const CONVENTIONS: readonly Convention[] = RULES.map(strip);

function matchFor(scenario: ScenarioState, rule: Rule, from: EntityNodeData, to: EntityNodeData): ConventionMatch | null {
  if (from.id === to.id || !rule.applies(from, to)) return null;
  const convention = strip(rule);
  return { convention, from, to, conditions: rule.conditions(scenario, from, to), flow: rule.flow?.(from, to) };
}

/** Conventions envisageables entre deux entités, dans les deux sens. */
export function conventionsBetween(scenario: ScenarioState, aId: string, bId: string): ConventionMatch[] {
  const a = scenario.entities.find((e) => e.id === aId);
  const b = scenario.entities.find((e) => e.id === bId);
  if (!a || !b) return [];
  return RULES.flatMap((rule) => [matchFor(scenario, rule, a, b), rule.symmetric ? null : matchFor(scenario, rule, b, a)])
    .filter((m): m is ConventionMatch => m !== null);
}

/** Toutes les conventions envisageables du schéma, par paire de parties. */
export function listConventionMatches(scenario: ScenarioState): ConventionMatch[] {
  const parties = scenario.entities.filter((e) => isCompany(e) || isPerson(e));
  const out: ConventionMatch[] = [];
  for (let i = 0; i < parties.length; i++) {
    for (let j = i + 1; j < parties.length; j++) out.push(...conventionsBetween(scenario, parties[i]!.id, parties[j]!.id));
  }
  return out;
}

/** Le flux de la convention existe-t-il déjà sur le schéma ? */
export function conventionFlowExists(scenario: ScenarioState, match: ConventionMatch): boolean {
  const f = match.flow;
  return !!f && scenario.flows.some((flow) => flow.category === f.category && flow.sourceId === f.sourceId && flow.targetId === f.targetId);
}
