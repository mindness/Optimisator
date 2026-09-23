/**
 * Ordered graph resolver: applies What-If inputs, runs calculator math,
 * and tags each flow with its timeline step (Facturation → … → Dividendes).
 *
 * Résolution par entité : chaque société (SASU, EURL, SARL, micro, EI, holding,
 * SCI) reçoit ses flux entrants et sortants, calcule son résultat selon son
 * régime (IS / IR / micro) et son statut social (assimilé salarié / TNS), puis
 * sa trésorerie. La « société principale » (première SASU, sinon première
 * société opérationnelle) reçoit les curseurs What-If et alimente le résumé.
 *
 * Mère-fille : la QPFC entre dans le résultat imposable de la mère, soumis au
 * barème IS (15 % / 25 %) avec ses autres produits (fees, intérêts). Sur le flux,
 * l'IS attribué à la QPFC est au taux effectif de la mère. L'éligibilité (2 ans
 * de détention) n'est pas évaluée.
 */
import {
  DEFAULT_SOCIAL_REGIME,
  DEFAULT_TAX_REGIME,
  type EntityMetrics,
  type EntityNodeData,
  type EntityType,
  type FlowCategory,
  type FlowEdgeData,
  type ProvenanceKind,
  type ScenarioState,
  type TaxBreakdownLine,
  type TaxCalculationResult,
} from '../types';
import {
  calculateCorporateTax,
  calculateDividendTax,
  calculateExecutiveSalary,
  calculateFlatTax,
  calculateMicroEnterprise,
  calculateMotherDaughterDividend,
  calculatePersonalIncomeTax,
  findMaxGrossSalaryForTargetTMI,
  calculateTnsContributions,
  calculateTnsDividendSurcharge,
  tnsGrossForNet,
  calculateVAT,
  annualisedRevenue,
  calculateCdhr,
  calculateCharasseReintegration,
  calculateGiftTax,
  calculateHoldingAssetTax,
  calculateMecenat,
  calculatePerDeduction,
  calculatePropertyGain,
  calculateIfi,
  calculateShareSaleTaxCompany,
  calculateShareSaleTaxPerson,
  cappedRentalAmortization,
  compareDividendTaxModes,
  FULL_EXERCISE_DAYS,
  imputeCarriedDeficit,
  reducedRateThresholdFor,
  isProfessionalFurnishedRental,
  lateInterest,
  loanInstallment,
  roundMoney,
  type CorporateTaxResult,
  type DividendArbitrage,
  type DividendTaxMode,
  type ExecutiveSalaryResult,
  type FiscalSituation,
  type LoanInstallment,
  type PersonalIncomeTaxResult,
  type VatResult,
} from './calculator';
import {
  ACRE_MICRO_REDUCTION,
  CCA_INTEREST_CAP_RATE,
  MICRO_VERSEMENT_LIBERATOIRE_RATES,
  VAT_FRANCHISE_CEILING_GOODS_EUR,
  VAT_FRANCHISE_CEILING_SERVICES_EUR,
  INTEGRATED_GROUP_MIN_HOLDING_PCT,
  INTEGRATED_GROUP_QPFC_RATE,
  IS_REDUCED_CA_CEILING_EUR,
  MOTHER_DAUGHTER_MIN_HOLDING_PCT,
  MOTHER_DAUGHTER_QPFC_RATE,
  ANIMATRICE_EVIDENCE,
  DEFICIT_FONCIER_GLOBAL_CAP_EUR,
  DUTREIL_COLLECTIVE_YEARS,
  DUTREIL_INDIVIDUAL_YEARS,
  LMNP_DEFICIT_CARRY_YEARS,
  LMP_RECEIPTS_THRESHOLD_EUR,
  REPORT_CONTROL_PRESUMPTION_PCT,
  REPORT_DONATION_PURGE_YEARS,
  REPORT_DONATION_PURGE_YEARS_FUND,
  REPORT_REINVESTMENT_QUOTA,
  REPORT_REINVESTMENT_WINDOW_YEARS,
  REPORT_REINVESTMENT_HOLDING_YEARS,
  REPORT_SALE_WINDOW_YEARS,
  SHARE_SALE_ALLOWANCE_ACQUISITION_CUTOFF_YEAR,
  CDHR_RATE,
  CHARASSE_REINTEGRATION_YEARS,
  HOLDING_ASSET_TAX_CONTROL_PCT,
  HOLDING_ASSET_TAX_RATE,
  MECENAT_CARRY_YEARS,
  PER_CARRY_YEARS,
  PS_CAPITAL_DEROGATORY_RATE,
} from './taxRules';
import {
  TIMELINE_STEPS,
  timelineStepIdForCategory,
  timelineStepOrder,
  type TimelineStepId,
} from './timelineEngine';

/* ------------------------------------------------------------------------ *
 * P0 — exercices chaînés : ce qu'un exercice lègue au suivant.
 * Toute règle à report s'y branche ; sans `carryIn`, le moteur est à l'identique.
 * ------------------------------------------------------------------------ */

/** Déficit reportable d'une entité (CGI art. 209, I pour l'IS ; art. 156 pour l'IR). */
export interface DeficitStock {
  carryForward: number;
}

/** Emprunt en cours : capital restant dû et rang de la prochaine échéance. */
export interface LoanState {
  principalOutstanding: number;
  yearsElapsed: number;
}

/** Plus-value d'apport placée en report d'imposition (CGI art. 150-0 B ter). */
export interface DeferredGain {
  /** Identifiant du flux d'apport qui a créé le report. */
  id: string;
  /** Apporteur : la personne physique qui porte le report. */
  holderId: string;
  /** Société bénéficiaire de l'apport. */
  companyId: string;
  gain: number;
  contributedYear: number;
  /** Année de cession des titres apportés par la société bénéficiaire. */
  soldYear?: number;
  saleProceeds?: number;
  /** Part du produit de cession effectivement remployée. */
  reinvestedRatio?: number;
  /** Part remployée dans un actif éligible (l'immobilier patrimonial ne l'est pas). */
  reinvestedEligibleRatio?: number;
  /** Remploi via un fonds : porte le délai de purge par donation à 11 ans. */
  throughFund?: boolean;
}

/** Amortissements suivis d'un exercice à l'autre (usufruit temporaire, meublé au réel). */
export interface AssetSchedule {
  /** Valeur restant à amortir (usufruit temporaire acquis). */
  remaining: number;
  /** Dotation annuelle théorique. */
  annual: number;
  /** Dotation meublée non déduite, reportée sans limite (CGI art. 39 C, II-3). */
  carriedForward: number;
}

export interface CarryOver {
  /** Exercice auquel cet état se rapporte. */
  year: number;
  deficits: Record<string, DeficitStock>;
  loans: Record<string, LoanState>;
  reports150_0Bter: DeferredGain[];
  amortizations: Record<string, AssetSchedule>;
  /** Remplace `openingTreasury` dès le deuxième exercice. */
  treasury: Record<string, number>;
  /** Remplace `openingCca` dès le deuxième exercice. */
  cca: Record<string, number>;
  /** Plafond PER non utilisé par personne, reportable cinq ans (art. 163 quatervicies). */
  perCeiling: Record<string, number>;
  /** Versements de mécénat au-delà du plafond, reportables cinq exercices (art. 238 bis). */
  mecenat: Record<string, number>;
  /** Rachats à soi-même suivis pour l'amendement Charasse (art. 223 B). */
  charasse: Record<string, { acquisitionPrice: number; yearIndex: number }>;
}

/** État d'ouverture vide : celui de l'exercice 1. */
export function emptyCarryOver(year = new Date().getFullYear()): CarryOver {
  return { year, deficits: {}, loans: {}, reports150_0Bter: [], amortizations: {}, treasury: {}, cca: {}, perCeiling: {}, mecenat: {}, charasse: {} };
}

/** Live What-If overrides (absolute EUR annual unless noted). */
export interface WhatIfInputs {
  /** Exercice simulé : sert aux durées de détention et aux délais de report. */
  year?: number;
  /**
   * Durée de l'exercice en jours (365 par défaut). Un premier exercice écourté
   * ne proratise pas que le calendrier : il réduit le plafond du taux réduit
   * d'IS (CGI art. 219, I-b).
   */
  exerciseDays?: number;
  /** Versement annuel sur un PER, déductible du revenu global (art. 163 quatervicies). */
  perContribution?: number;
  /** Personnes à charge du foyer, pour l'abattement de la contribution différentielle. */
  dependents?: number;
  /** Absolute CA HT override (EUR). */
  caHt?: number;
  /** Multiplier applied when caHt is omitted (default 1). */
  caMultiplier?: number;
  /** Absolute charges HT override (EUR). */
  expensesHt?: number;
  /** Desired net executive salary (EUR annual). */
  executiveNetSalary?: number;
  /** Gross amount of the first OpCo dividend flow (EUR). */
  dividendAmount?: number;
  /** First holding-to-person dividend flow (EUR), independent of OpCo. */
  holdingDividendAmount?: number;
  /** SCI rent HT billed to OpCo (EUR annual). */
  sciRentHt?: number;
  /** Parts de quotient familial du foyer (défaut 1). */
  parts?: number;
  /** Situation du foyer, qui fixe le seuil de décote (défaut célibataire). */
  situation?: FiscalSituation;
  /**
   * Revenus imposables du foyer gagnés hors de ce schéma (salaire du conjoint,
   * autre activité…), déjà nets de leur propre abattement. Ils occupent le bas
   * du barème et remontent donc la TMI appliquée au schéma.
   */
  otherIncome?: number;
  /**
   * Régime d'imposition des dividendes perçus par la personne physique.
   * `auto` retient le moins coûteux à la TMI constatée.
   */
  dividendTaxMode?: DividendTaxMode | 'auto';
  /** Comparateur de structures : coût annuel saisi par structure (clé = `StructureId`). */
  structureCosts?: Partial<Record<string, number>>;
  /** Comparateur de structures : capital + primes + CCA (franchise de 10 % des dividendes TNS). */
  capitalPrimesAndCca?: number;
}

export interface ResolvedFlow extends FlowEdgeData {
  resolvedAmount: number;
  timelineStepId: TimelineStepId;
  taxResult?: TaxCalculationResult;
}

export interface ResolvedEntity extends EntityNodeData {
  metrics: EntityMetrics;
}

export interface ResolvedScenarioSummary {
  caHt: number;
  expensesHt: number;
  vat: VatResult;
  corporateTax: CorporateTaxResult;
  executiveSalary: ExecutiveSalaryResult;
  /** IR personnel sur le net imposable, dividendes au barème inclus le cas échéant. */
  personalIncomeTax: PersonalIncomeTaxResult;
  /** Comparaison PFU / barème sur les dividendes versés à la personne physique. */
  dividendArbitrage: DividendArbitrage;
  /** Régime effectivement appliqué aux dividendes de ce scénario. */
  dividendTaxMode: DividendTaxMode;
  /**
   * Rémunération imposable maximale du dirigeant avant de basculer dans la
   * tranche suivante, autres revenus du foyer déduits. `Infinity` à 45 %.
   */
  maxTaxableSalaryAtTmi: number;
  sciTaxDue: number;
  netGroupCash: number;
  /** Argent net après URSSAF, IS et IR personnel (rémunération + dividendes PFU). */
  netPersonalCash: number;
}

export interface ResolvedScenario {
  scenarioId: string;
  entities: ResolvedEntity[];
  flows: ResolvedFlow[];
  calculations: TaxCalculationResult[];
  summary: ResolvedScenarioSummary;
  /** Model limits and financing alerts; results are not a distribution authorization. */
  warnings: string[];
  timelineOrder: TimelineStepId[];
  /** État de clôture à passer en `carryIn` de l'exercice suivant. */
  carryOut: CarryOver;
}

const OPERATING: readonly EntityType[] = ['sasu', 'eurl', 'sarl', 'micro_entreprise', 'entreprise_individuelle'];
const COMPANIES: readonly EntityType[] = [...OPERATING, 'holding_sas', 'holding_sarl', 'sci_is', 'sci_ir'];
const TRANSFERS: readonly FlowCategory[] = ['cca_advance', 'cca_reimbursement', 'loan_payment', 'capital_contribution'];
/** Opérations patrimoniales : le flux porte des titres, pas de la trésorerie. */
const SECURITIES: readonly FlowCategory[] = ['share_sale', 'share_contribution', 'donation', 'property_sale'];
const PERIODS: Record<FlowEdgeData['periodicity'], number> = { monthly: 12, quarterly: 4, annual: 1, one_off: 1 };

const isHolding = (type: EntityType) => type === 'holding_sas' || type === 'holding_sarl';
const isSci = (type: EntityType) => type === 'sci_is' || type === 'sci_ir';
const isCompany = (type: EntityType) => COMPANIES.includes(type);
const isMicro = (type: EntityType) => type === 'micro_entreprise';
const NO_TAX: CorporateTaxResult = { bracket15: 0, bracket25: 0, taxDue: 0, netProfit: 0 };
const NO_SALARY = calculateExecutiveSalary(0);

function taxResult(partial: Omit<TaxCalculationResult, 'provenance'> & { provenance?: ProvenanceKind }): TaxCalculationResult {
  return { provenance: 'derived', ...partial };
}

function line(label: string, amount: number, formula?: string): TaxBreakdownLine {
  return { label, amount, formula };
}

/**
 * Coût d'une rémunération nette selon le statut social. TNS : brut trouvé par
 * bissection sur le barème 2026 (assiette − 26 %, branches), net imposable ≈ net
 * (l'abattement de 10 % de l'art. 62 est appliqué ensuite par le barème IR).
 */
function salaryCost(net: number, regime: 'assimile_salarie' | 'tns' | 'none'): ExecutiveSalaryResult {
  if (net <= 0 || regime === 'none') return NO_SALARY;
  if (regime === 'assimile_salarie') return calculateExecutiveSalary(net);
  const tns = tnsGrossForNet(net);
  return { grossSalary: tns.base, employerCharges: 0, employeeCharges: tns.contributions, totalCompanyCost: tns.base, netImposable: net };
}

/** Résultat par société, avant intégration fiscale. */
interface CompanyBook {
  entity: EntityNodeData;
  taxRegime: 'is' | 'ir';
  revenue: number;
  expenses: number;
  salaryNet: number;
  salary: ExecutiveSalaryResult;
  rentPaid: number;
  rentReceived: number;
  feesPaid: number;
  feesReceived: number;
  interestPaid: number;
  interestReceived: number;
  /** Dividendes bruts reçus de sociétés à l'IS. */
  dividendsReceived: number;
  qpfc: number;
  /** Résultat fiscal (IS) ou bénéfice imposable chez l'associé (IR / micro). */
  taxable: number;
  /** IS payé par la société elle-même (hors intégration). */
  corporateTax: CorporateTaxResult;
  /** Cotisations sociales sur le bénéfice : micro, IR au réel (TNS). */
  socialOnProfit: number;
  /** Versement libératoire de l'IR (micro) : libère le bénéfice de l'IR du foyer. */
  liberatoire: number;
  /** Intérêts de CCA au-delà du plafond, réintégrés au résultat. */
  interestExcess: number;
  vat: VatResult;
  reducedRateEligible: boolean;
  /** Bénéfice après IS et cotisations, hors dividendes et transferts. */
  netProfit: number;
  /** Base d'imposition après imputation du déficit antérieur (P1). */
  taxableAfterDeficit: number;
  deficitImputed: number;
  /** Stock de déficit reporté à l'exercice suivant. */
  deficitCarryForward: number;
  /** Déficit foncier imputé sur le revenu global de l'associé (10 700 €). */
  foncierRelief: number;
  /** Dotation aux amortissements déduite (SCI IS, meublé au réel plafonné). */
  amort: number;
  /** Amortissement de l'usufruit temporaire acquis (P5). */
  usufructCharge: number;
  /** Résultat de cession de titres entré au résultat imposable (P3). */
  shareSaleAddition: number;
  /** Statut de holding animatrice revendiqué (P6). */
  animatrice: boolean;
  /** Plafonnement de l'amortissement meublé (P8), absent hors régime réel. */
  furnished?: { deducted: number; carriedForward: number; cap: number };
  /** Recettes de l'activité meublée, pour la frontière LMNP / LMP. */
  furnishedReceipts: number;
  /** Versements de mécénat de l'exercice (CGI art. 238 bis). */
  donations: number;
  /** Réduction d'impôt de mécénat, absente hors versement. */
  mecenat?: ReturnType<typeof calculateMecenat>;
}

export function resolveScenarioGraph(
  scenario: ScenarioState,
  inputs: WhatIfInputs = {},
  carryIn?: CarryOver,
): ResolvedScenario {
  const entities = scenario.entities;
  const byId = new Map(entities.map((entity) => [entity.id, entity]));
  const typeOf = (id: string): EntityType | undefined => byId.get(id)?.entityType;
  const annual = (flow: FlowEdgeData): number => roundMoney(flow.amount * PERIODS[flow.periodicity]);
  const flowsOf = (category: FlowCategory, side: 'sourceId' | 'targetId', entityId: string) =>
    scenario.flows.filter((flow) => flow.category === category && flow[side] === entityId);

  // Société principale : reçoit les curseurs What-If et alimente le résumé.
  const primary = entities.find((entity) => entity.entityType === 'sasu')
    ?? entities.find((entity) => OPERATING.includes(entity.entityType));
  const primaryRevenueFlow = primary && flowsOf('revenue', 'targetId', primary.id)[0];
  const primaryExpenseFlows = primary ? flowsOf('expense', 'sourceId', primary.id) : [];
  const primarySalaryFlow = primary && flowsOf('salary', 'sourceId', primary.id)[0];
  const rentFlow = scenario.flows.find((flow) => flow.category === 'rent');
  const opcoDividendFlow = scenario.flows.find((flow) =>
    flow.category === 'dividend' && primary && flow.sourceId === primary.id);
  const holdingDividendFlow = scenario.flows.find((flow) =>
    flow.category === 'dividend' && isHolding(typeOf(flow.sourceId) ?? 'person') && typeOf(flow.targetId) === 'person');

  const caHt = inputs.caHt ?? roundMoney(
    (primary?.inputs?.caHt ?? (primaryRevenueFlow ? annual(primaryRevenueFlow) : 0)) * (inputs.caMultiplier ?? 1));
  const expensesHt = inputs.expensesHt ?? primary?.inputs?.expensesHt
    ?? roundMoney(primaryExpenseFlows.reduce((sum, flow) => sum + annual(flow), 0));
  const executiveNet = inputs.executiveNetSalary
    ?? (primarySalaryFlow ? annual(primarySalaryFlow) : undefined)
    ?? entities.find((entity) => entity.entityType === 'person')?.inputs?.netSalary ?? 0;
  const dividendGross = inputs.dividendAmount ?? (opcoDividendFlow ? annual(opcoDividendFlow) : 0);
  const sci = entities.find((entity) => isSci(entity.entityType));
  const sciRentHt = inputs.sciRentHt ?? (rentFlow ? annual(rentFlow) : undefined) ?? sci?.inputs?.rentalIncomeHt ?? 0;

  // ---- P0 : état d'ouverture (exercice 1 = paramètres saisis, ensuite l'état reporté) ----
  const year = inputs.year ?? carryIn?.year ?? new Date().getFullYear();
  // Exercice écourté : plafond du taux réduit proratisé, CA ramené à douze mois.
  const exerciseDays = Math.max(1, Math.min(inputs.exerciseDays ?? scenario.options?.exerciseDays ?? FULL_EXERCISE_DAYS, FULL_EXERCISE_DAYS));
  const openingTreasuryOf = (id: string) => carryIn?.treasury[id] ?? byId.get(id)?.inputs?.openingTreasury ?? 0;
  const openingCcaOf = (id: string) => carryIn?.cca[id] ?? byId.get(id)?.inputs?.openingCca ?? 0;

  // ---- P2 : échéancier d'emprunt, calculé et non saisi ----
  const installments = new Map<string, LoanInstallment>();
  for (const flow of scenario.flows) {
    if (flow.category !== 'loan_payment' || !flow.loan) continue;
    const state = carryIn?.loans[flow.id];
    installments.set(flow.id, loanInstallment(flow.loan, state?.principalOutstanding ?? flow.loan.principal, state?.yearsElapsed ?? 0));
  }

  /** Montant annuel effectif d'un flux, curseurs appliqués. */
  const amountOf = (flow: FlowEdgeData): number => {
    const installment = installments.get(flow.id);
    if (installment) return installment.payment;
    if (flow.id === primaryRevenueFlow?.id) return caHt;
    if (primaryExpenseFlows.length === 1 && flow.id === primaryExpenseFlows[0]!.id) return expensesHt;
    if (flow.id === primarySalaryFlow?.id) return executiveNet;
    if (flow.id === rentFlow?.id) return sciRentHt;
    if (flow.id === opcoDividendFlow?.id) return dividendGross;
    if (flow.id === holdingDividendFlow?.id) return inputs.holdingDividendAmount ?? annual(flow);
    return annual(flow);
  };
  const sumOf = (category: FlowCategory, side: 'sourceId' | 'targetId', entityId: string, pick: (flow: FlowEdgeData) => number = amountOf) =>
    roundMoney(flowsOf(category, side, entityId).reduce((sum, flow) => sum + pick(flow), 0));
  const interestOf = (flow: FlowEdgeData) => installments.get(flow.id)?.interest ?? flow.interestAmount ?? 0;
  // CGI art. 39, 1-3° : chaque compte courant est plafonné séparément, sur l'avance de l'exercice.
  const interestExcessOf = (flow: FlowEdgeData) =>
    flow.category === 'cca_advance' ? roundMoney(Math.max(0, interestOf(flow) - amountOf(flow) * CCA_INTEREST_CAP_RATE.value)) : 0;

  /** Part du capital de `company` détenue par `owner` (lien explicite, sinon champ historique de la fille). */
  const stake = (ownerId: string, companyId: string): number => {
    const link = (scenario.ownerships ?? []).find((own) => own.ownerId === ownerId && own.companyId === companyId);
    if (link) return link.percent;
    const owner = byId.get(ownerId);
    const company = byId.get(companyId);
    return owner && company && isHolding(owner.entityType) && company.entityType === 'sasu' ? company.ownershipPercent ?? 0 : 0;
  };
  const motherQualifies = (holdingId: string, subsidiaryId: string) =>
    stake(holdingId, subsidiaryId) >= MOTHER_DAUGHTER_MIN_HOLDING_PCT.value * 100;

  // Intégration fiscale : une holding et ses filiales IS détenues ≥ 95 %.
  const integrationHolding = scenario.options?.integrationFiscale
    ? entities.find((holding) => isHolding(holding.entityType) && entities.some((sub) =>
        isCompany(sub.entityType) && sub.id !== holding.id && stake(holding.id, sub.id) >= INTEGRATED_GROUP_MIN_HOLDING_PCT.value * 100))
    : undefined;
  const inGroup = (companyId: string) => !!integrationHolding && (companyId === integrationHolding.id ||
    stake(integrationHolding.id, companyId) >= INTEGRATED_GROUP_MIN_HOLDING_PCT.value * 100);
  const qpfcRateFor = (holdingId: string, subsidiaryId: string) =>
    inGroup(holdingId) && inGroup(subsidiaryId) ? INTEGRATED_GROUP_QPFC_RATE.value : MOTHER_DAUGHTER_QPFC_RATE.value;

  // ---- P5 : démembrement — une détention n'est plus un pourcentage plat ----
  const ownerships = scenario.ownerships ?? [];
  const usufructLinksOf = (ownerId: string) => ownerships.filter((own) =>
    own.ownerId === ownerId && own.nature === 'usufruit' && (own.dureeAnnees ?? 0) > 0 && (own.acquisitionPrice ?? 0) > 0);
  const usufructBaseOf = (ownerId: string) => roundMoney(usufructLinksOf(ownerId).reduce((sum, own) => sum + (own.acquisitionPrice ?? 0), 0));
  const usufructAnnualOf = (ownerId: string) => roundMoney(usufructLinksOf(ownerId).reduce((sum, own) => sum + (own.acquisitionPrice ?? 0) / (own.dureeAnnees ?? 1), 0));
  const usufructRemainingOf = (ownerId: string) => carryIn?.amortizations[ownerId]?.remaining ?? usufructBaseOf(ownerId);
  /** Amortissement de l'usufruit temporaire acquis, chez l'usufruitier à l'IS (CE, 2019). */
  const usufructChargeOf = (ownerId: string) => roundMoney(Math.min(usufructAnnualOf(ownerId), Math.max(0, usufructRemainingOf(ownerId))));

  // ---- P3 : cession de titres par une société — pré-passe, le résultat entre au livre ----
  const shareSaleFlows = scenario.flows.filter((flow) => flow.category === 'share_sale');
  const holdingYearsOf = (flow: FlowEdgeData) =>
    flow.share?.acquisitionYear === undefined ? 0 : Math.max(0, year - flow.share.acquisitionYear);
  const companyShareSales = new Map<string, ReturnType<typeof calculateShareSaleTaxCompany>>();
  for (const flow of shareSaleFlows) {
    const seller = byId.get(flow.sourceId);
    if (!seller || !isCompany(seller.entityType)) continue;
    // Sans quote-part cédée renseignée, le régime des titres de participation n'est pas présumé.
    companyShareSales.set(flow.id, calculateShareSaleTaxCompany(amountOf(flow), flow.share?.acquisitionPrice ?? 0, {
      holdingYears: holdingYearsOf(flow),
      stakePercent: flow.share?.soldPercent ?? 0,
    }));
  }
  const shareSaleAdditionOf = (companyId: string) => roundMoney(shareSaleFlows
    .filter((flow) => flow.sourceId === companyId)
    .reduce((sum, flow) => sum + (companyShareSales.get(flow.id)?.taxableAddition ?? 0), 0));

  // ---- Livres par société -------------------------------------------------
  const books = new Map<string, CompanyBook>();
  for (const entity of entities) {
    if (!isCompany(entity.entityType)) continue;
    const taxRegime = entity.taxRegime ?? DEFAULT_TAX_REGIME[entity.entityType] ?? 'is';
    const socialRegime = entity.socialRegime ?? DEFAULT_SOCIAL_REGIME[entity.entityType] ?? 'none';
    const revenue = sumOf('revenue', 'targetId', entity.id);
    const expenses = sumOf('expense', 'sourceId', entity.id);
    const salaryNet = sumOf('salary', 'sourceId', entity.id);
    // IR au réel : la rémunération du dirigeant est un prélèvement, pas une charge.
    const salary = taxRegime === 'is' ? salaryCost(salaryNet, socialRegime) : NO_SALARY;
    const rentPaid = sumOf('rent', 'sourceId', entity.id);
    const rentReceived = isSci(entity.entityType) && !flowsOf('rent', 'targetId', entity.id).length
      ? entity.inputs?.rentalIncomeHt ?? 0
      : sumOf('rent', 'targetId', entity.id);
    const feesPaid = sumOf('management_fees', 'sourceId', entity.id);
    const feesReceived = sumOf('management_fees', 'targetId', entity.id);
    const interestPaid = roundMoney(sumOf('cca_advance', 'targetId', entity.id, interestOf) + sumOf('loan_payment', 'sourceId', entity.id, interestOf));
    const interestExcess = sumOf('cca_advance', 'targetId', entity.id, interestExcessOf);
    const franchise = entity.options?.franchiseTva ?? isMicro(entity.entityType);
    const interestReceived = sumOf('cca_advance', 'sourceId', entity.id, interestOf);
    const dividendsReceived = roundMoney(flowsOf('dividend', 'targetId', entity.id)
      .filter((flow) => (DEFAULT_TAX_REGIME[typeOf(flow.sourceId) ?? 'person'] ?? 'ir') === 'is')
      .reduce((sum, flow) => sum + amountOf(flow), 0));
    const qpfc = roundMoney(flowsOf('dividend', 'targetId', entity.id)
      .reduce((sum, flow) => sum + amountOf(flow) * qpfcRateFor(entity.id, flow.sourceId), 0));
    const interest = sci?.id === entity.id ? entity.inputs?.interestExpenses ?? 0 : 0;
    const other = sci?.id === entity.id ? entity.inputs?.otherCharges ?? 0 : 0;
    // P8 : meublé au réel — la dotation ne peut pas créer de déficit (CGI art. 39 C, II).
    const meuble = entity.options?.locationMeubleeReelle ?? false;
    const furnishedReceipts = roundMoney(revenue + rentReceived);
    const furnished = meuble
      ? cappedRentalAmortization(
          entity.inputs?.buildingAmortization ?? 0,
          furnishedReceipts,
          roundMoney(expenses + interest + other + interestPaid),
          carryIn?.amortizations[entity.id]?.carriedForward ?? 0,
        )
      : undefined;
    const usufructCharge = usufructChargeOf(entity.id);
    const shareSaleAddition = shareSaleAdditionOf(entity.id);
    // Mécénat : la réduction s'impute sur l'IS, le versement n'est pas déductible (art. 238 bis, 8).
    const donations = entity.inputs?.donations ?? 0;
    const mecenat = donations > 0 || (carryIn?.mecenat[entity.id] ?? 0) > 0
      ? calculateMecenat(donations, revenue, carryIn?.mecenat[entity.id] ?? 0)
      : undefined;
    const amort = furnished ? furnished.deducted
      : entity.entityType === 'sci_is' ? entity.inputs?.buildingAmortization ?? 0 : 0;
    // P6 : une holding pure n'ouvre pas droit à déduction ; animatrice et facturant, elle est assujettie.
    const animatrice = entity.options?.animatrice ?? false;
    const vat = franchise
      ? calculateVAT(0, 0)
      : isHolding(entity.entityType)
        ? calculateVAT(animatrice ? feesReceived : 0, animatrice ? expenses : 0)
        : calculateVAT(revenue, expenses);
    const reducedRateEligible = annualisedRevenue(revenue, exerciseDays) <= IS_REDUCED_CA_CEILING_EUR.value;

    let taxable: number;
    let corporateTax = NO_TAX;
    let socialOnProfit = 0;
    let liberatoire = 0;
    let netProfit: number;
    const deficitIn = carryIn?.deficits[entity.id]?.carryForward ?? 0;
    let foncierRelief = 0;
    let deficitImputed = 0;
    let deficitCarryForward = deficitIn;
    let taxableAfterDeficit = 0;
    /**
     * P1 — report déficitaire. Le résultat publié reste celui de l'exercice :
     * seule la base d'imposition est réduite du déficit antérieur imputable
     * (CGI art. 209, I). Un exercice déficitaire alimente le stock.
     */
    const taxBaseAfterDeficit = (raw: number): number => {
      const imputation = imputeCarriedDeficit(roundMoney(raw + foncierRelief), deficitIn);
      deficitImputed = imputation.imputed;
      deficitCarryForward = imputation.stockAfter;
      taxableAfterDeficit = imputation.taxableAfter;
      return imputation.imputed > 0 ? imputation.taxableAfter : raw;
    };
    if (isMicro(entity.entityType)) {
      const category = entity.microCategory ?? 'bnc';
      const micro = calculateMicroEnterprise(revenue, category);
      taxable = micro.taxableProfit;
      socialOnProfit = roundMoney(micro.socialContributions * (entity.options?.acre ? 1 - ACRE_MICRO_REDUCTION.value : 1));
      liberatoire = entity.options?.versementLiberatoire ? roundMoney(revenue * MICRO_VERSEMENT_LIBERATOIRE_RATES[category].value) : 0;
      netProfit = roundMoney(revenue - socialOnProfit - liberatoire - expenses - rentPaid - feesPaid - interestPaid);
      taxBaseAfterDeficit(taxable);
    } else if (isSci(entity.entityType)) {
      taxable = roundMoney(rentReceived + interestReceived - interest - amort - other - interestPaid - usufructCharge + shareSaleAddition);
      // Déficit foncier : imputable sur le revenu global dans la limite de 10 700 € (art. 156, I-3°).
      if (entity.entityType === 'sci_ir' && taxable < 0) {
        foncierRelief = roundMoney(Math.min(DEFICIT_FONCIER_GLOBAL_CAP_EUR.value, -taxable));
      }
      const base = taxBaseAfterDeficit(taxable);
      if (taxRegime === 'is') corporateTax = calculateCorporateTax(base, reducedRateEligible, exerciseDays);
      netProfit = roundMoney(rentReceived + interestReceived - interest - other - interestPaid - corporateTax.taxDue);
    } else {
      taxable = roundMoney(revenue + rentReceived + feesReceived + interestReceived + qpfc + shareSaleAddition
        - expenses - salary.totalCompanyCost - rentPaid - feesPaid - interestPaid - amort - usufructCharge + interestExcess);
      if (taxRegime === 'is') {
        corporateTax = calculateCorporateTax(taxBaseAfterDeficit(taxable), reducedRateEligible, exerciseDays);
        // Les dividendes reçus sont encaissés en trésorerie ; seule la QPFC est imposée.
        netProfit = roundMoney(taxable - qpfc + dividendsReceived - corporateTax.taxDue);
      } else {
        socialOnProfit = calculateTnsContributions(taxable).contributions;
        taxable = roundMoney(taxable - socialOnProfit);
        taxBaseAfterDeficit(taxable);
        netProfit = roundMoney(taxable - salaryNet);
      }
    }
    // La réduction de mécénat s'impute sur l'impôt dû, sans le rendre négatif.
    if (mecenat) {
      const relief = roundMoney(Math.min(corporateTax.taxDue, mecenat.reduction));
      corporateTax = { ...corporateTax, taxDue: roundMoney(corporateTax.taxDue - relief), netProfit: roundMoney(corporateTax.netProfit + relief) };
      netProfit = roundMoney(netProfit + relief - donations);
    }
    books.set(entity.id, {
      entity, taxRegime, revenue, expenses, salaryNet, salary, rentPaid, rentReceived, feesPaid, feesReceived,
      interestPaid, interestReceived, dividendsReceived, qpfc, taxable, corporateTax, socialOnProfit, liberatoire, interestExcess, vat,
      reducedRateEligible, netProfit,
      taxableAfterDeficit, deficitImputed, deficitCarryForward, foncierRelief,
      amort, usufructCharge, shareSaleAddition, animatrice, furnished, furnishedReceipts,
      donations, mecenat,
    });
  }

  /**
   * Amendement Charasse (CGI art. 223 B, al. 6) : quand une société du groupe
   * rachète les titres d'une société qui y entre aux personnes qui la
   * contrôlent, les charges financières sont réintégrées au résultat d'ensemble
   * pendant neuf exercices. C'est le contrecoup fiscal de l'OBO intégré.
   */
  const selfPurchases = shareSaleFlows.filter((flow) => {
    const seller = byId.get(flow.sourceId);
    const buyer = byId.get(flow.targetId);
    if (!seller || !buyer || seller.entityType !== 'person' || !isCompany(buyer.entityType)) return false;
    return stake(seller.id, buyer.id) > 50;
  });
  // La réintégration ne vise que le groupe intégré ; hors groupe, seul l'abus de droit est en jeu.
  const charasseSales = selfPurchases.filter((flow) => inGroup(flow.targetId));
  const charasseStates: Record<string, { acquisitionPrice: number; yearIndex: number }> = {};
  let charasseReintegration = 0;

  // ---- Intégration fiscale : IS unique, filiales à leur IS seul, écart chez la mère ----
  let groupTaxable = 0;
  let groupTax: CorporateTaxResult | undefined;
  if (integrationHolding) {
    const members = [...books.values()].filter((book) => book.taxRegime === 'is' && inGroup(book.entity.id));
    const groupDebt = roundMoney(members.reduce((sum, book) => sum
      + scenario.flows.filter((flow) => flow.category === 'loan_payment' && flow.sourceId === book.entity.id)
        .reduce((debt, flow) => debt + (installments.get(flow.id)?.opening ?? flow.loan?.principal ?? 0), 0)
      + openingCcaOf(book.entity.id), 0));
    const financialCharges = roundMoney(members.reduce((sum, book) => sum + book.interestPaid, 0));
    for (const flow of charasseSales) {
      const carried = carryIn?.charasse[flow.id];
      const acquisitionPrice = carried?.acquisitionPrice ?? amountOf(flow);
      const yearIndex = carried ? carried.yearIndex : 0;
      const charasse = calculateCharasseReintegration({ acquisitionPrice, groupAverageDebt: groupDebt, financialCharges, yearIndex });
      charasseReintegration = roundMoney(charasseReintegration + charasse.reintegrated);
      if (charasse.active) charasseStates[flow.id] = { acquisitionPrice, yearIndex: yearIndex + 1 };
    }
    groupTaxable = roundMoney(members.reduce((sum, book) => sum + book.taxable, 0) + charasseReintegration);
    groupTax = calculateCorporateTax(groupTaxable, members.every((book) => book.reducedRateEligible), exerciseDays);
    const subsidiariesTax = roundMoney(members.filter((book) => book.entity.id !== integrationHolding.id)
      .reduce((sum, book) => sum + book.corporateTax.taxDue, 0));
    const mother = books.get(integrationHolding.id)!;
    const motherTax = roundMoney(groupTax.taxDue - subsidiariesTax);
    mother.netProfit = roundMoney(mother.netProfit + mother.corporateTax.taxDue - motherTax);
    mother.corporateTax = { ...groupTax, taxDue: motherTax, netProfit: roundMoney(mother.taxable - motherTax) };
  }

  /** IS effectivement payé par une société (flux is_tax). */
  const corporateTaxOf = (companyId: string): number => books.get(companyId)?.corporateTax.taxDue ?? 0;

  // ---- Personne physique : IR, dividendes ----------------------------------
  const parts = inputs.parts ?? 1;
  const situation: FiscalSituation = inputs.situation ?? 'single';
  const persons = entities.filter((entity) => entity.entityType === 'person');
  const primaryPerson = persons[0];
  const personalDividendGross = roundMoney(scenario.flows
    .filter((flow) => flow.category === 'dividend' && typeOf(flow.targetId) === 'person')
    .reduce((sum, flow) => sum + amountOf(flow), 0));
  /**
   * Quote-part d'une personne dans une société transparente : détentions saisies au prorata
   * entre personnes physiques ; sans aucune détention, tout va au premier dirigeant.
   */
  const shareOf = (personId: string, companyId: string): number => {
    const all = ownerships.filter((own) => own.companyId === companyId && typeOf(own.ownerId) === 'person');
    if (all.length === 0) return personId === primaryPerson?.id ? 1 : 0;
    // P5 : les fruits reviennent à l'usufruitier ; le nu-propriétaire n'a pas de quote-part de résultat.
    const links = all.some((own) => own.nature === 'usufruit') ? all.filter((own) => own.nature !== 'nue_propriete') : all;
    const total = links.reduce((sum, own) => sum + own.percent, 0);
    if (total === 0) return 0;
    return (links.find((own) => own.ownerId === personId)?.percent ?? 0) / total;
  };
  // Revenus transparents : bénéfices IR (EURL / EI / micro hors versement libératoire), revenus fonciers SCI IR.
  const transparentIncomeOf = (personId: string) => roundMoney([...books.values()]
    .filter((book) => book.taxRegime === 'ir' && !book.liberatoire)
    .reduce((sum, book) => sum + (Math.max(0, book.taxableAfterDeficit) - book.foncierRelief) * shareOf(personId, book.entity.id), 0));
  const salaryNetImposableOf = (personId: string) => roundMoney([...books.values()]
    .reduce((sum, book) => sum + book.salary.netImposable * (sumOf('salary', 'sourceId', book.entity.id) > 0 ? sumOf('salary', 'sourceId', book.entity.id, (f) => f.targetId === personId ? amountOf(f) : 0) / sumOf('salary', 'sourceId', book.entity.id) : 0), 0));
  // SCI IR : prélèvements sociaux sur le revenu foncier, en plus du barème.
  // Même assiette que l'impôt sur le revenu — la CSG sur les revenus du
  // patrimoine est « assise sur le montant net retenu pour l'établissement de
  // l'impôt sur le revenu » (CSS L. 136-6, I). Recalculer les prélèvements sur
  // les loyers bruts moins les charges saisies les décorrélerait de l'IR dès
  // qu'un déficit antérieur, des intérêts reçus ou une cession entrent en jeu.
  const sciIrLeviesOf = (personId: string) => roundMoney([...books.values()]
    .filter((book) => book.entity.entityType === 'sci_ir')
    .reduce((sum, book) => sum
      + Math.max(0, book.taxableAfterDeficit) * PS_CAPITAL_DEROGATORY_RATE.value * shareOf(personId, book.entity.id), 0));
  const otherIncome = Math.max(0, inputs.otherIncome ?? 0);
  // Les revenus gagnés ailleurs entrent au barème du même foyer : ils décalent la TMI du schéma.
  const transparentIncome = roundMoney(transparentIncomeOf(primaryPerson?.id ?? '') + otherIncome);
  const salaryNetImposable = salaryNetImposableOf(primaryPerson?.id ?? '');
  // PER : le versement se déduit du revenu net global, plafonné à 10 % des revenus
  // d'activité retenus dans la limite de huit PASS (CGI art. 163 quatervicies).
  const per = calculatePerDeduction(
    Math.max(0, inputs.perContribution ?? 0),
    roundMoney(salaryNetImposable + transparentIncome),
    { carriedCeiling: carryIn?.perCeiling[primaryPerson?.id ?? ''] ?? 0 },
  );
  // La déduction s'impute d'abord sur les revenus transparents, puis sur la rémunération.
  const transparentAfterPer = roundMoney(Math.max(0, transparentIncome - per.deducted));
  const salaryAfterPer = roundMoney(Math.max(0, salaryNetImposable - Math.max(0, per.deducted - transparentIncome)));
  const salaryIncomeTax = calculatePersonalIncomeTax(salaryAfterPer, parts, { situation, otherTaxableIncome: transparentAfterPer });
  // Coût réel du barème pour ce foyer : l'impôt avec les dividendes dans
  // l'assiette, moins l'impôt sans. `salaryIncomeTax` est exactement ce second
  // terme. Comparer à TMI constante ignorait le franchissement de tranche et
  // pouvait désigner le barème alors que le PFU coûte moins cher.
  const irCostOfBaremeBase = (taxableBase: number) => roundMoney(
    calculatePersonalIncomeTax(salaryAfterPer, parts, {
      situation,
      otherTaxableIncome: roundMoney(transparentAfterPer + taxableBase),
    }).taxDue - salaryIncomeTax.taxDue,
  );
  const dividendArbitrage = compareDividendTaxModes(
    personalDividendGross, salaryIncomeTax.marginalRate, irCostOfBaremeBase,
  );
  const requestedMode = inputs.dividendTaxMode ?? 'auto';
  const dividendTaxMode: DividendTaxMode = requestedMode === 'auto' ? dividendArbitrage.best.mode : requestedMode;
  const personalIncomeTax = dividendTaxMode === 'bareme'
    ? calculatePersonalIncomeTax(salaryAfterPer, parts, { situation, otherTaxableIncome: roundMoney(transparentAfterPer + dividendArbitrage.bareme.taxableBase) })
    : salaryIncomeTax;
  // ponytail: le foyer (parts, situation) des curseurs vaut pour le premier dirigeant ; les autres associés sont à 1 part, célibataire.
  const incomeTaxResultOf = (personId: string) => personId === primaryPerson?.id
    ? salaryIncomeTax
    : calculatePersonalIncomeTax(salaryNetImposableOf(personId), 1, { situation: 'single', otherTaxableIncome: transparentIncomeOf(personId) });
  const incomeTaxOf = (personId: string) => incomeTaxResultOf(personId).taxDue;

  // ---- Flux résolus -----------------------------------------------------------
  const calculations: TaxCalculationResult[] = [];
  const resolvedFlows: ResolvedFlow[] = [];
  /**
   * Part « impôt sur le revenu » seule des flux imposés chez la personne.
   * La CDHR ne défalque que l'IR, la CEHR et les prélèvements libératoires
   * (CGI art. 224, III-2°) : y inclure les prélèvements sociaux l'annulerait
   * à tort. On la suit donc à part du total payé sur le flux.
   */
  const personIncomeTaxOnFlows = new Map<string, number>();
  const addPersonIncomeTax = (personId: string, amount: number) => {
    personIncomeTaxOnFlows.set(personId, roundMoney((personIncomeTaxOnFlows.get(personId) ?? 0) + amount));
  };
  const stepRank = new Map(timelineStepOrder().map((id, i) => [id, i]));
  const sortedFlows = [...scenario.flows].sort((a, b) => {
    const ra = stepRank.get(timelineStepIdForCategory(a.category)) ?? 0;
    const rb = stepRank.get(timelineStepIdForCategory(b.category)) ?? 0;
    return ra !== rb ? ra - rb : a.id.localeCompare(b.id);
  });
  const debtorCcaFlows = scenario.flows.filter((flow) =>
    flow.category === 'cca_advance' && flow.amount > 0 && typeOf(flow.targetId) === 'person' && typeOf(flow.sourceId) !== 'person');
  const tnsSurcharges = new Map<string, number>();
  /** Droits de mutation supportés par chaque donataire (P7). */
  const giftDuties = new Map<string, number>();
  /** Plus-values immobilières des particuliers, par flux. */
  const propertyGains = new Map<string, ReturnType<typeof calculatePropertyGain>>();

  for (const flow of sortedFlows) {
    const timelineStepId = timelineStepIdForCategory(flow.category);
    const source = byId.get(flow.sourceId);
    const target = byId.get(flow.targetId);
    const book = source && books.get(source.id);
    let resolvedAmount = amountOf(flow);
    let flowTax: TaxCalculationResult | undefined;

    switch (flow.category) {
      case 'salary': {
        if (!book) break;
        const cost = book.salary;
        flowTax = taxResult({
          flowId: flow.id, category: 'salary', grossAmount: cost.grossSalary || resolvedAmount,
          taxAmount: cost.employeeCharges, netAmount: resolvedAmount,
          breakdown: book.taxRegime === 'is'
            ? [line('Coût entreprise', cost.totalCompanyCost, 'net × facteur cotisations'), line('Charges patronales', cost.employerCharges), line('Charges salariales', cost.employeeCharges)]
            : [line('Prélèvement sur le bénéfice (IR)', resolvedAmount), line('Cotisations SSI sur le bénéfice', book.socialOnProfit)],
        });
        break;
      }
      case 'social_charges': {
        if (!book) break;
        resolvedAmount = roundMoney(book.salary.employerCharges + book.salary.employeeCharges + book.socialOnProfit);
        flowTax = taxResult({
          flowId: flow.id, category: 'social_charges', grossAmount: resolvedAmount, taxAmount: resolvedAmount, netAmount: 0,
          breakdown: [line('Charges patronales', book.salary.employerCharges), line('Charges salariales', book.salary.employeeCharges),
            ...(book.socialOnProfit ? [line('Cotisations sur le bénéfice / CA', book.socialOnProfit)] : [])],
        });
        break;
      }
      case 'management_fees': {
        if (source && target && books.has(target.id)) {
          const fees = calculateCorporateTax(resolvedAmount, true, exerciseDays);
          flowTax = taxResult({
            flowId: flow.id, category: 'management_fees', grossAmount: resolvedAmount, taxAmount: fees.taxDue, netAmount: fees.netProfit,
            legalNoteId: 'management-fees',
            breakdown: [line('Déduit du résultat du client', -resolvedAmount, 'CGI art. 39, 1-1°'), line('IS du prestataire sur les fees (indicatif)', fees.taxDue, 'barème 15 % / 25 %')],
          });
        }
        break;
      }
      case 'vat': {
        if (!book) break;
        resolvedAmount = book.vat.netVatDue;
        flowTax = taxResult({
          flowId: flow.id, category: 'vat', grossAmount: book.vat.vatCollected, taxAmount: book.vat.netVatDue, netAmount: 0,
          breakdown: [line('TVA collectée', book.vat.vatCollected, 'CA HT × taux TVA'), line('TVA déductible', book.vat.vatDeductible, 'charges HT × taux TVA'), line('TVA nette due', book.vat.netVatDue)],
        });
        break;
      }
      case 'is_tax': {
        if (!book) break;
        resolvedAmount = corporateTaxOf(book.entity.id);
        const isMother = groupTax && book.entity.id === integrationHolding?.id;
        flowTax = taxResult({
          flowId: flow.id, category: 'is_tax', grossAmount: isMother ? groupTaxable : book.taxable, taxAmount: resolvedAmount,
          netAmount: book.corporateTax.netProfit,
          breakdown: isMother
            ? [line('Résultat d’ensemble du groupe', groupTaxable, 'CGI art. 223 B'), line('IS du groupe', groupTax!.taxDue), line('IS supporté par les filles (convention neutre)', -roundMoney(groupTax!.taxDue - resolvedAmount))]
            : book.taxRegime === 'ir'
              ? [line('Société à l’IR : bénéfice imposé chez l’associé', book.taxable)]
              : [line('IS 15 %', book.corporateTax.bracket15), line('IS 25 %', book.corporateTax.bracket25),
                 ...(book.qpfc ? [line('dont QPFC mère-fille imposée', book.qpfc)] : []), line('IS total', resolvedAmount)],
        });
        break;
      }
      case 'dividend': {
        if (!source || !target) break;
        if (isCompany(target.entityType)) {
          const rate = qpfcRateFor(target.id, source.id);
          const mother = books.get(target.id);
          const effective = mother && mother.taxable > 0 ? mother.corporateTax.taxDue / mother.taxable : 0;
          const mereFille = calculateMotherDaughterDividend(resolvedAmount, effective, rate);
          flowTax = taxResult({
            flowId: flow.id, category: 'dividend', grossAmount: resolvedAmount, taxAmount: mereFille.holdingTax, netAmount: mereFille.netCashInHolding,
            legalNoteId: 'mere-fille-art-145',
            warning: motherQualifies(target.id, source.id) ? undefined : `Détention < ${MOTHER_DAUGHTER_MIN_HOLDING_PCT.value * 100} % : régime mère-fille appliqué par hypothèse, à vérifier.`,
            breakdown: [line(`QPFC ${rate * 100} %`, mereFille.qpfc, `dividend × ${rate}`), line('IS de la mère sur la QPFC', mereFille.holdingTax, 'QPFC × taux effectif IS de la mère')],
          });
        } else if (target.entityType === 'person') {
          const personal = calculateDividendTax(resolvedAmount, dividendTaxMode, salaryIncomeTax.marginalRate, irCostOfBaremeBase);
          addPersonIncomeTax(target.id, personal.irPart);
          const breakdown = [...personal.breakdown];
          let extra = 0;
          // Gérant majoritaire TNS : dividendes > 10 % (capital + CCA) cotisent (CSS L131-6).
          if ((source.socialRegime ?? DEFAULT_SOCIAL_REGIME[source.entityType]) === 'tns' && (source.entityType === 'eurl' || source.entityType === 'sarl' || source.entityType === 'holding_sarl')) {
            const capitalBase = (source.inputs?.capital ?? 0) + openingCcaOf(source.id) + sumOf('cca_advance', 'targetId', source.id) + sumOf('capital_contribution', 'targetId', source.id);
            const surcharge = calculateTnsDividendSurcharge(resolvedAmount, capitalBase, books.get(source.id)?.salary.grossSalary ?? 0);
            extra = surcharge.contributions;
            tnsSurcharges.set(source.id, roundMoney((tnsSurcharges.get(source.id) ?? 0) + extra));
            breakdown.push(line('Part > 10 % du capital + CCA soumise aux cotisations SSI', surcharge.subjectToContributions), line('Cotisations SSI sur dividendes', extra));
          }
          flowTax = taxResult({
            flowId: flow.id, category: 'dividend', grossAmount: resolvedAmount, taxAmount: roundMoney(personal.totalTax + extra),
            netAmount: roundMoney(personal.netIncome - extra), breakdown,
          });
        }
        break;
      }
      case 'capital_contribution': {
        flowTax = taxResult({
          flowId: flow.id, category: flow.category, grossAmount: resolvedAmount, taxAmount: 0, netAmount: resolvedAmount,
          breakdown: [line('Capital libéré : trésorerie de la société, base de la règle des 10 % et de la déduction des intérêts de CCA', resolvedAmount)],
        });
        break;
      }
      case 'cca_advance':
      case 'cca_reimbursement':
      case 'loan_payment': {
        const debtor = debtorCcaFlows.includes(flow);
        const interest = interestOf(flow);
        const excess = interestExcessOf(flow);
        const lenderIsPerson = flow.category === 'cca_advance' && source?.entityType === 'person';
        const interestTax = lenderIsPerson ? calculateFlatTax(interest).totalTax : 0;
        flowTax = taxResult({
          flowId: flow.id, category: flow.category, grossAmount: resolvedAmount, taxAmount: interestTax, netAmount: resolvedAmount,
          legalNoteId: flow.category === 'loan_payment' ? undefined : debtor ? 'cca-debiteur' : 'cca-interets',
          warning: debtor ? 'Compte courant débiteur au profit d’une personne physique : interdit (C. com. L. 225-43 / L. 227-12).'
            : excess ? `Intérêts au-delà du plafond de ${(CCA_INTEREST_CAP_RATE.value * 100).toLocaleString('fr-FR')} % (BOI-BIC-CHG-50-50-30) : ${excess} € non déductibles.` : undefined,
          breakdown: [line('Mouvement de trésorerie, sans effet sur le résultat', resolvedAmount),
            ...(interest ? [line(flow.category === 'loan_payment' ? 'dont intérêts déductibles' : 'Intérêts annuels (déductibles chez l’emprunteur)', interest, 'CGI art. 39, 1-3°')] : []),
            ...(excess ? [line('dont excédent réintégré (plafond CCA)', excess)] : []),
            ...(interestTax ? [line('PFU sur les intérêts perçus par l’associé', interestTax)] : [])],
        });
        break;
      }
      case 'share_sale': {
        if (!source) break;
        const acquisitionPrice = flow.share?.acquisitionPrice ?? 0;
        const holdingYears = holdingYearsOf(flow);
        if (source.entityType === 'person') {
          const sale = calculateShareSaleTaxPerson(resolvedAmount, acquisitionPrice, {
            mode: dividendTaxMode,
            marginalRate: salaryIncomeTax.marginalRate,
            holdingYears,
            acquisitionYear: flow.share?.acquisitionYear,
            retirementAllowance: flow.share?.retirementAllowance,
          });
          addPersonIncomeTax(source.id, sale.irPart);
          const acquired = flow.share?.acquisitionYear;
          flowTax = taxResult({
            flowId: flow.id, category: 'share_sale', grossAmount: resolvedAmount,
            taxAmount: sale.totalTax, netAmount: sale.netProceeds, breakdown: sale.breakdown,
            warning: acquired !== undefined && acquired >= SHARE_SALE_ALLOWANCE_ACQUISITION_CUTOFF_YEAR.value
              ? `Titres acquis en ${acquired} : aucun abattement pour durée de détention — il est réservé aux titres acquis avant ${SHARE_SALE_ALLOWANCE_ACQUISITION_CUTOFF_YEAR.value} (CGI art. 150-0 D, 1 ter-B-1°).`
              : dividendTaxMode === 'pfu' && holdingYears >= 2
                ? 'Abattement pour durée de détention indisponible sous PFU : il suppose l’option globale pour le barème (CGI art. 150-0 D, 1 ter-B-2°).'
                : undefined,
          });
        } else if (isCompany(source.entityType)) {
          const sale = companyShareSales.get(flow.id);
          if (!sale) break;
          flowTax = taxResult({
            flowId: flow.id, category: 'share_sale', grossAmount: resolvedAmount,
            // L'impôt est porté par l'IS de la société via la QPFC : jamais compté deux fois sur le flux.
            taxAmount: 0, netAmount: resolvedAmount, breakdown: sale.breakdown,
            warning: sale.participationRegime
              ? undefined
              : 'Régime des titres de participation non retenu : renseignez la quote-part cédée (≥ 5 %) et l’année d’acquisition (détention ≥ 2 ans), sinon la plus-value est imposée au taux normal.',
          });
        }
        break;
      }
      case 'share_contribution': {
        const gain = roundMoney(Math.max(0, resolvedAmount - (flow.contribution?.acquisitionPrice ?? 0)));
        const controlled = (flow.contribution?.controlPercent ?? 0) >= REPORT_CONTROL_PRESUMPTION_PCT.value * 100;
        flowTax = taxResult({
          flowId: flow.id, category: 'share_contribution', grossAmount: resolvedAmount, taxAmount: 0, netAmount: resolvedAmount,
          breakdown: [
            line('Plus-value d’apport placée en report d’imposition', gain, 'CGI art. 150-0 B ter'),
            line(`Remploi exigé si cession sous ${REPORT_SALE_WINDOW_YEARS.value} ans`, roundMoney(resolvedAmount * REPORT_REINVESTMENT_QUOTA.value), `${REPORT_REINVESTMENT_QUOTA.value * 100} % du produit de cession`),
          ],
          warning: controlled
            ? undefined
            : `Report subordonné au contrôle de la société bénéficiaire (présomption à ${(REPORT_CONTROL_PRESUMPTION_PCT.value * 100).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} %, CGI art. 150-0 B ter, III) : renseignez la quote-part détenue.`,
        });
        break;
      }
      case 'property_sale': {
        if (!source) break;
        const property = flow.property;
        const holdingYears = property?.acquisitionYear === undefined ? 0 : Math.max(0, year - property.acquisitionYear);
        if (source.entityType === 'person') {
          const gain = calculatePropertyGain(resolvedAmount, property?.acquisitionPrice ?? 0, {
            holdingYears,
            principalResidence: property?.principalResidence,
            worksAmount: property?.worksAmount,
            deductedAmortization: property?.deductedAmortization,
          });
          propertyGains.set(flow.id, gain);
          // La surtaxe de l'art. 1609 nonies G est une taxe distincte de l'IR :
          // elle ne se défalque pas de la CDHR.
          if (source?.entityType === 'person') addPersonIncomeTax(source.id, gain.incomeTax);
          flowTax = taxResult({
            flowId: flow.id, category: 'property_sale', grossAmount: resolvedAmount,
            taxAmount: gain.totalTax, netAmount: gain.netProceeds, breakdown: gain.breakdown,
            warning: property?.deductedAmortization
              ? 'Amortissements de location meublée réintégrés au prix d’acquisition (CGI art. 150 VB, III) : l’économie faite pendant la détention est reprise à la cession.'
              : property?.acquisitionYear === undefined
                ? 'Année d’acquisition non renseignée : aucun abattement pour durée de détention appliqué.'
                : undefined,
          });
        } else if (isCompany(source.entityType)) {
          // Société à l'IS : la plus-value entre au résultat au taux normal, pas de régime des particuliers.
          flowTax = taxResult({
            flowId: flow.id, category: 'property_sale', grossAmount: resolvedAmount, taxAmount: 0, netAmount: resolvedAmount,
            breakdown: [line('Plus-value intégrée au résultat imposable', roundMoney(Math.max(0, resolvedAmount - (property?.acquisitionPrice ?? 0))), 'société à l’IS : ni abattement pour durée, ni exonération de résidence principale')],
            warning: 'Cession par une société à l’IS : la plus-value est calculée sur la valeur nette comptable, que le moteur ne suit pas. Renseignez un prix d’acquisition déjà net d’amortissements.',
          });
        }
        break;
      }
      case 'donation': {
        const gift = calculateGiftTax(resolvedAmount, {
          dutreil: flow.gift?.dutreil,
          reserveUsufruit: flow.gift?.reserveUsufruit,
          previousAbatementUsed: flow.gift?.previousAbatementUsed,
        });
        if (target) giftDuties.set(target.id, roundMoney((giftDuties.get(target.id) ?? 0) + gift.duties));
        flowTax = taxResult({
          flowId: flow.id, category: 'donation', grossAmount: resolvedAmount,
          taxAmount: gift.duties, netAmount: gift.netTransferred, breakdown: gift.breakdown,
          warning: flow.gift?.dutreil
            ? `Dutreil : engagement collectif de ${DUTREIL_COLLECTIVE_YEARS.value} ans en cours au jour de la transmission, engagement individuel de ${DUTREIL_INDIVIDUAL_YEARS.value} ans et fonction de direction — conditions à vérifier, jamais supposées (CGI art. 787 B).`
            : undefined,
        });
        break;
      }
      default:
        break;
    }

    if (flowTax) calculations.push(flowTax);
    resolvedFlows.push({ ...flow, amount: resolvedAmount, resolvedAmount, timelineStepId, taxResult: flowTax });
  }

  // ---- Trésoreries ------------------------------------------------------------
  const outgoingDividends = (entityId: string) => roundMoney(resolvedFlows
    .filter((flow) => flow.category === 'dividend' && flow.sourceId === entityId).reduce((sum, flow) => sum + flow.resolvedAmount, 0));
  const transfersFor = (entityId: string) => roundMoney(resolvedFlows.filter((flow) => TRANSFERS.includes(flow.category))
    .reduce((sum, flow) => sum + (flow.targetId === entityId ? flow.resolvedAmount : 0) - (flow.sourceId === entityId ? flow.resolvedAmount : 0), 0));
  // L'échéance d'emprunt sort en entier de la trésorerie ; ses intérêts, déjà déduits du
  // résultat, sont rajoutés pour ne pas les compter deux fois.
  const loanInterestFor = (entityId: string) => sumOf('loan_payment', 'sourceId', entityId, interestOf);
  const ccaBalanceFor = (companyId: string) => roundMoney(openingCcaOf(companyId) + resolvedFlows.reduce((sum, flow) => {
    if (flow.category === 'cca_advance' && flow.targetId === companyId) return sum + flow.resolvedAmount;
    if (flow.category === 'cca_reimbursement' && flow.sourceId === companyId) return sum - flow.resolvedAmount;
    return sum;
  }, 0));

  const shareCashFor = (entityId: string) => roundMoney(resolvedFlows
    .filter((flow) => flow.category === 'share_sale')
    .reduce((sum, flow) => sum
      + (flow.sourceId === entityId ? flow.resolvedAmount - (flow.taxResult?.taxAmount ?? 0) : 0)
      - (flow.targetId === entityId ? flow.resolvedAmount : 0), 0));
  const debtOutstandingFor = (entityId: string) => roundMoney(scenario.flows
    .filter((flow) => flow.category === 'loan_payment' && flow.sourceId === entityId && flow.loan)
    .reduce((sum, flow) => sum + (installments.get(flow.id)?.closing ?? 0), 0));

  // ---- P4 : report d'imposition 150-0 B ter, suivi d'un exercice à l'autre ----
  const reports: DeferredGain[] = (carryIn?.reports150_0Bter ?? []).map((report) => ({ ...report }));
  for (const flow of scenario.flows) {
    if (flow.category !== 'share_contribution' || reports.some((report) => report.id === flow.id)) continue;
    reports.push({
      id: flow.id,
      holderId: flow.sourceId,
      companyId: flow.targetId,
      gain: roundMoney(Math.max(0, amountOf(flow) - (flow.contribution?.acquisitionPrice ?? 0))),
      contributedYear: year,
    });
  }
  for (const flow of shareSaleFlows) {
    const report = flow.share?.deferredContributionId
      ? reports.find((candidate) => candidate.id === flow.share!.deferredContributionId)
      : reports.find((candidate) => candidate.companyId === flow.sourceId && candidate.soldYear === undefined);
    if (!report || report.soldYear !== undefined) continue;
    const reinvestment = flow.share?.reinvestment;
    report.soldYear = year;
    report.saleProceeds = amountOf(flow);
    report.reinvestedRatio = reinvestment?.ratio ?? 0;
    // L'immobilier patrimonial est exclu du remploi éligible : seule la poche libre de 30 % l'absorbe.
    report.reinvestedEligibleRatio = reinvestment && reinvestment.kind !== 'immobilier' ? reinvestment.ratio : 0;
    report.throughFund = reinvestment?.kind === 'fonds';
  }
  const purged = new Set<string>();
  for (const flow of scenario.flows) {
    const linked = flow.category === 'donation' ? flow.gift?.deferredContributionId : undefined;
    const report = linked ? reports.find((candidate) => candidate.id === linked) : undefined;
    if (!report) continue;
    const purgeYears = report.throughFund ? REPORT_DONATION_PURGE_YEARS_FUND.value : REPORT_DONATION_PURGE_YEARS.value;
    if (year - report.contributedYear >= purgeYears) purged.add(report.id);
  }
  const forfeits: Array<{ report: DeferredGain; tax: number; interest: number }> = [];
  const openReports = reports.filter((report) => {
    if (purged.has(report.id)) return false;
    const sold = report.soldYear;
    // Pas de cession, ou cession au-delà de trois ans : aucune obligation de remploi.
    if (sold === undefined || sold - report.contributedYear >= REPORT_SALE_WINDOW_YEARS.value) return true;
    if (year - sold < REPORT_REINVESTMENT_WINDOW_YEARS.value) return true;
    if ((report.reinvestedEligibleRatio ?? 0) >= REPORT_REINVESTMENT_QUOTA.value) return true;
    const tax = calculateFlatTax(report.gain).totalTax;
    forfeits.push({ report, tax, interest: lateInterest(tax, (year - report.contributedYear) * 12) });
    return false;
  });
  const forfeitFor = (personId: string) => roundMoney(forfeits
    .filter((forfeit) => forfeit.report.holderId === personId)
    .reduce((sum, forfeit) => sum + forfeit.tax + forfeit.interest, 0));

  // ---- P6 : assiette IFI — biens professionnels et holding animatrice exonérés ----
  const ifiBaseOf = (personId: string) => roundMoney((byId.get(personId)?.inputs?.realEstateValue ?? 0) + ownerships
    .filter((own) => own.ownerId === personId)
    .reduce((sum, own) => {
      const company = byId.get(own.companyId);
      const value = company?.inputs?.realEstateValue ?? 0;
      if (!company || !value) return sum;
      if (OPERATING.includes(company.entityType) || company.options?.animatrice) return sum;
      // CGI art. 968 : l'usufruitier est imposé sur la valeur en pleine propriété.
      if (own.nature === 'nue_propriete') return sum;
      return sum + value * (own.percent / 100);
    }, 0));

  /** Trésorerie d'une cession immobilière : le prix entre, l'impôt sort. */
  const propertyCashFor = (entityId: string) => roundMoney(resolvedFlows
    .filter((flow) => flow.category === 'property_sale')
    .reduce((sum, flow) => sum
      + (flow.sourceId === entityId ? flow.resolvedAmount - (flow.taxResult?.taxAmount ?? 0) : 0)
      - (flow.targetId === entityId ? flow.resolvedAmount : 0), 0));

  // ---- Taxe de 20 % sur les actifs non professionnels des holdings (art. 235 ter C) ----
  /** Détention par une personne physique, directe ou via une société qu'elle contrôle à 50 % au moins. */
  const individualControlOf = (companyId: string) => Math.max(0, ...persons.map((person) => {
    const direct = stake(person.id, companyId);
    if (direct >= HOLDING_ASSET_TAX_CONTROL_PCT.value * 100) return 100;
    const through = entities
      .filter((holder) => isCompany(holder.entityType) && stake(person.id, holder.id) >= HOLDING_ASSET_TAX_CONTROL_PCT.value * 100)
      .reduce((best, holder) => Math.max(best, stake(holder.id, companyId)), 0);
    return Math.max(direct, through);
  }), 0);
  const holdingAssetTaxOf = (book: CompanyBook) => {
    const totalAssets = book.entity.inputs?.totalAssets ?? 0;
    const nonProfessionalAssets = book.entity.inputs?.nonProfessionalAssets ?? 0;
    if (totalAssets <= 0 && nonProfessionalAssets <= 0) return undefined;
    // Revenus passifs de l'art. 235 ter C, I-B-2 : dividendes, intérêts, loyers, redevances.
    const passiveIncome = roundMoney(book.dividendsReceived + book.interestReceived + book.rentReceived);
    const totalIncome = roundMoney(passiveIncome + book.revenue + book.feesReceived);
    return calculateHoldingAssetTax({
      totalAssets,
      nonProfessionalAssets,
      deductibleDebt: debtOutstandingFor(book.entity.id),
      individualControlPercent: individualControlOf(book.entity.id),
      passiveIncome,
      totalIncome,
    });
  };
  const holdingAssetTaxes = new Map<string, ReturnType<typeof calculateHoldingAssetTax>>();
  for (const book of books.values()) {
    const tax = holdingAssetTaxOf(book);
    if (tax) holdingAssetTaxes.set(book.entity.id, tax);
  }

  // ---- Contribution différentielle sur les hauts revenus (art. 224) ----
  const personGainsOf = (personId: string) => roundMoney(resolvedFlows.reduce((sum, flow) => {
    if (flow.sourceId !== personId) return sum;
    if (flow.category === 'share_sale') return sum + Math.max(0, flow.resolvedAmount - (flow.share?.acquisitionPrice ?? 0));
    if (flow.category === 'property_sale') return sum + (propertyGains.get(flow.id)?.taxableIncomeTax ?? 0);
    return sum;
  }, 0));
  /**
   * Revenu de référence reconstitué à partir de ce que le moteur connaît :
   * rémunération imposable, revenus transparents, dividendes bruts et
   * plus-values. Ce n'est pas le revenu fiscal de référence complet de
   * l'art. 1417, qui intègre des revenus hors schéma.
   */
  const cdhrFor = (personId: string) => {
    const dividends = roundMoney(resolvedFlows
      .filter((flow) => flow.category === 'dividend' && flow.targetId === personId)
      .reduce((sum, flow) => sum + flow.resolvedAmount, 0));
    const income = roundMoney(salaryNetImposableOf(personId) + transparentIncomeOf(personId)
      + (personId === primaryPerson?.id ? otherIncome : 0) + dividends + personGainsOf(personId));
    // CGI art. 224, III-2° : seuls l'impôt sur le revenu, la CEHR et les
    // prélèvements libératoires viennent en diminution. Les prélèvements
    // sociaux, eux, ne s'y défalquent pas — d'où la part IR suivie à part.
    const paid = roundMoney(incomeTaxOf(personId) + (personIncomeTaxOnFlows.get(personId) ?? 0));
    return calculateCdhr(income, paid, { situation: personId === primaryPerson?.id ? situation : 'single', dependents: personId === primaryPerson?.id ? inputs.dependents : 0 });
  };

  const resolvedEntities: ResolvedEntity[] = entities.map((entity) => {
    const metrics: EntityMetrics = { ...(entity.metrics ?? {}) };
    const book = books.get(entity.id);
    if (book) {
      // Crédit de TVA : créance, pas un remboursement automatique.
      const vatCashAdjustment = roundMoney(book.vat.vatCollected - book.vat.vatDeductible - book.vat.netVatDue);
      const surcharge = tnsSurcharges.get(entity.id) ?? 0;
      metrics.fiscalResult = book.taxable;
      metrics.vatDeductible = book.vat.vatDeductible;
      metrics.corporateTax = book.corporateTax.taxDue;
      metrics.netProfit = roundMoney(book.netProfit - surcharge);
      metrics.treasury = roundMoney(openingTreasuryOf(entity.id) + metrics.netProfit + vatCashAdjustment
        + transfersFor(entity.id) + loanInterestFor(entity.id) + shareCashFor(entity.id) - outgoingDividends(entity.id));
      metrics.deficitCarryForward = book.deficitCarryForward;
      metrics.debtOutstanding = debtOutstandingFor(entity.id);
      metrics.mecenatReduction = book.mecenat?.reduction ?? 0;
      const assetTax = holdingAssetTaxes.get(entity.id);
      metrics.holdingAssetTax = assetTax?.due ?? 0;
      metrics.treasury = roundMoney(metrics.treasury - (assetTax?.due ?? 0) + propertyCashFor(entity.id));
      metrics.ccaBalance = ccaBalanceFor(entity.id);
    } else if (entity.entityType === 'person') {
      const received = roundMoney(resolvedFlows.filter((flow) =>
        flow.targetId === entity.id && (flow.category === 'salary' || flow.category === 'dividend'),
      ).reduce((sum, flow) => sum + (flow.taxResult?.netAmount ?? flow.resolvedAmount), 0));
      const interestNet = roundMoney(resolvedFlows.filter((flow) => flow.category === 'cca_advance' && flow.sourceId === entity.id)
        .reduce((sum, flow) => sum + interestOf(flow) - (flow.taxResult?.taxAmount ?? 0), 0));
      // Les dividendes portent leur propre imposition dans le flux : l'IR ici est celui des
      // rémunérations et revenus transparents, plus les prélèvements sociaux SCI IR.
      const irDue = roundMoney(incomeTaxOf(entity.id) + sciIrLeviesOf(entity.id));
      const ifi = calculateIfi(ifiBaseOf(entity.id));
      metrics.personalIncomeTax = irDue;
      metrics.marginalRate = incomeTaxResultOf(entity.id).marginalRate;
      metrics.ifiDue = ifi.due;
      const cdhr = cdhrFor(entity.id);
      metrics.cdhrDue = cdhr.due;
      metrics.netPersonalCash = roundMoney(received + interestNet - irDue + transfersFor(entity.id)
        + shareCashFor(entity.id) + propertyCashFor(entity.id) - (giftDuties.get(entity.id) ?? 0)
        - forfeitFor(entity.id) - ifi.due - cdhr.due);
      metrics.treasury = metrics.netPersonalCash;
    }
    return { ...entity, metrics };
  });

  const netGroupCash = roundMoney(resolvedEntities.filter((entity) => books.has(entity.id))
    .reduce((sum, entity) => sum + (entity.metrics.treasury ?? 0), 0));
  const netPersonalCash = roundMoney(resolvedEntities.filter((entity) => entity.entityType === 'person')
    .reduce((sum, entity) => sum + (entity.metrics.netPersonalCash ?? 0), 0));

  // ---- Avertissements ---------------------------------------------------------
  const primaryBook = primary ? books.get(primary.id) : undefined;
  const warnings = [
    'Modèle annuel simplifié, paiements dans la période ; IR au barème 2026 ; assimilé salarié en taux plats (sans plafond ni réduction générale) ; TNS selon l’assiette unique 2026 (− 26 %, barème par branche, RCI et invalidité-décès en valeurs usuelles).',
  ];
  if (!primary) warnings.push('Aucune société opérationnelle : le schéma se dessine mais les curseurs What-If n’ont pas de cible.');
  for (const book of books.values()) {
    if (book.taxRegime !== 'is' || isSci(book.entity.entityType)) continue;
    warnings.push(book.reducedRateEligible
      ? `${book.entity.label} : IS réduit 15 % appliqué (CA ≤ 10 M€) ; conditions de détention du capital (libéré, ≥ 75 % personnes physiques) non contrôlées.`
      : `${book.entity.label} : CA > 10 M€, taux réduit d’IS non applicable (CGI art. 219 I-b).`);
    if (exerciseDays < FULL_EXERCISE_DAYS && book.reducedRateEligible) {
      warnings.push(`${book.entity.label} : exercice de ${exerciseDays} jours — plafond du taux réduit ramené à ${reducedRateThresholdFor(exerciseDays).toLocaleString('fr-FR')} € (CGI art. 219, I-b, « par période de douze mois ») et chiffre d’affaires annualisé pour le test des 10 M€.`);
    }
  }
  for (const flow of scenario.flows) {
    const target = byId.get(flow.targetId);
    if (flow.category === 'dividend' && target && isCompany(target.entityType) && !motherQualifies(target.id, flow.sourceId)) {
      warnings.push(`${target.label} : détention < 5 % dans ${byId.get(flow.sourceId)?.label ?? flow.sourceId}, le régime mère-fille (CGI art. 145) est appliqué par hypothèse — à vérifier.`);
    }
  }
  if (salaryNetImposable > 0 || transparentIncome > 0) {
    warnings.push(`IR personnel : barème 2026 sur le net imposable, ${parts} part(s), abattement 10 %, plafonnement du quotient et décote appliqués ; réductions et crédits d’impôt non modélisés.`);
  }
  if (transparentIncome > 0) warnings.push('Sociétés à l’IR / micro / SCI IR : bénéfice imputé en totalité au foyer du dirigeant, hors quote-parts entre associés.');
  if (personalDividendGross > 0) {
    warnings.push(dividendTaxMode === 'bareme'
      ? 'Dividendes imposés au barème (option globale CGI art. 200 A, 2) : l’option engage tous les revenus de capitaux mobiliers du foyer, non modélisés ici.'
      : 'Dividendes imposés au PFU (CGI art. 200 A, 1) ; l’option barème est chiffrée au coût réel pour ce foyer, mais hors autres revenus de capitaux mobiliers non saisis.');
  }
  if (tnsSurcharges.size > 0) warnings.push('Gérant majoritaire TNS : dividendes au-delà de 10 % du capital et du compte courant soumis aux cotisations SSI (CSS L131-6), déduits du net perçu.');
  warnings.push('Dividendes saisis sans validation du bénéfice distribuable, des réserves ni des conditions juridiques : une trésorerie positive ne vaut pas autorisation de distribution.');
  if ([...books.values()].some((book) => book.feesPaid > 0)) {
    warnings.push('Management fees : déduits chez le client et imposés chez le prestataire, TVA supposée neutre entre assujettis. Convention écrite, prestations réelles et prix de marché exigés (acte anormal de gestion).');
  }
  if (scenario.flows.some((flow) => TRANSFERS.includes(flow.category) && flow.amount !== 0)) {
    warnings.push('CCA, avances et échéances d’emprunt : mouvements de trésorerie sans effet sur le résultat ; seuls les intérêts renseignés sont déduits (emprunteur) ou imposés (prêteur, PFU pour un associé). Plafond de taux (CGI art. 39, 1-3°) non contrôlé.');
  }
  if (debtorCcaFlows.length > 0) {
    warnings.push('Compte courant débiteur au profit d’une personne physique : interdit à peine de nullité (C. com. L. 225-43 / L. 227-12). Schéma à corriger.');
  }
  if (integrationHolding) {
    warnings.push(`Intégration fiscale simulée (CGI art. 223 A) : ${integrationHolding.label} seule redevable de l’IS sur le résultat d’ensemble, QPFC 1 %, filiales à leur IS seul par convention neutre. Option de 5 exercices et exercices alignés non vérifiés.`);
  } else if (scenario.options?.integrationFiscale) {
    warnings.push('Intégration fiscale demandée mais aucune holding ne détient ≥ 95 % d’une société : option ignorée.');
  }
  if (scenario.flows.some((flow) => flow.periodicity !== 'annual')) {
    warnings.push('Flux mensuels / trimestriels annualisés (× 12, × 4) ; ponctuels comptés une fois.');
  }
  for (const book of books.values()) {
    if (isMicro(book.entity.entityType)) {
      warnings.push(`${book.entity.label} : abattement forfaitaire et cotisations sur le CA${book.liberatoire ? ', versement libératoire (le seuil de RFR N-2 de l’art. 151-0 n’est pas contrôlé)' : ''}${book.entity.options?.acre ? ', ACRE : cotisations à 75 % du taux normal (12 premiers mois, CSS D131-6-3 ; dégressivité au-delà de ¾ PASS non modélisée)' : ''}.`);
    }
    const franchise = book.entity.options?.franchiseTva ?? isMicro(book.entity.entityType);
    const services = book.entity.entityType !== 'micro_entreprise' || (book.entity.microCategory ?? 'bnc') !== 'bic_vente';
    const ceiling = services ? VAT_FRANCHISE_CEILING_SERVICES_EUR.value : VAT_FRANCHISE_CEILING_GOODS_EUR.value;
    if (franchise && book.revenue > ceiling) {
      warnings.push(`${book.entity.label} : CA ${book.revenue.toLocaleString('fr-FR')} € au-delà du plafond de franchise en base (${ceiling.toLocaleString('fr-FR')} €, CGI art. 293 B) — la TVA redevient due dès le dépassement.`);
    }
    if (book.interestExcess > 0) warnings.push(`${book.entity.label} : intérêts de compte courant au-delà du plafond de ${(CCA_INTEREST_CAP_RATE.value * 100).toLocaleString('fr-FR')} %, ${book.interestExcess} € réintégrés.`);
  }
  if (persons.length > 1) warnings.push('Plusieurs associés personnes physiques : bénéfices transparents répartis au prorata des détentions saisies ; foyer des curseurs appliqué au premier dirigeant, les autres à 1 part.');
  for (const book of books.values()) {
    if (book.vat.vatCollected - book.vat.vatDeductible - book.vat.netVatDue < 0) {
      warnings.push(`${book.entity.label} : Crédit de TVA non remboursé dans la période, il ne constitue pas de trésorerie disponible.`);
    }
  }
  for (const entity of resolvedEntities) {
    if ((entity.metrics.treasury ?? 0) < 0) warnings.push(`${entity.label} : trésorerie négative, scénario non financé dans les hypothèses actuelles.`);
  }

  // ---- Exhaustivité des montages : ce qui est appliqué, et ce qui ne l'est pas ----
  const euros = (amount: number) => amount.toLocaleString('fr-FR');
  for (const book of books.values()) {
    const label = book.entity.label;
    if (book.deficitImputed > 0) {
      warnings.push(`${label} : ${euros(book.deficitImputed)} € de déficit antérieur imputés (CGI art. 209, I — 1 000 000 € + 50 % de la fraction au-delà). Le report en arrière (art. 220 quinquies) n’est pas modélisé.`);
    }
    if (book.deficitCarryForward > 0) {
      warnings.push(`${label} : ${euros(book.deficitCarryForward)} € de déficit reportés sur les exercices suivants ; le changement d’activité réelle (art. 221, 5) qui ferait tomber le report n’est pas contrôlé.`);
    }
    if (book.foncierRelief > 0) {
      warnings.push(`${label} : déficit foncier imputé sur le revenu global à hauteur de ${euros(book.foncierRelief)} € (plafond ${euros(DEFICIT_FONCIER_GLOBAL_CAP_EUR.value)} €, CGI art. 156, I-3°) ; le surplus reste imputable sur les revenus fonciers des dix années suivantes, et la part provenant des intérêts d’emprunt n’est pas isolée.`);
    }
    if (book.usufructCharge > 0) {
      warnings.push(`${label} : usufruit temporaire amorti sur sa durée (${euros(book.usufructCharge)} €/an). Le prix du droit démembré doit être validé par un expert indépendant ; l’abus de droit à but principalement fiscal (LPF art. L. 64 A) est signalé, jamais arbitré.`);
    }
    if (book.shareSaleAddition > 0) {
      warnings.push(`${label} : résultat de cession de titres intégré au résultat imposable pour ${euros(book.shareSaleAddition)} € ; les moins-values antérieures et la valeur réelle des titres ne sont pas modélisées.`);
    }
    if (book.furnished) {
      const professional = isProfessionalFurnishedRental(book.furnishedReceipts, Math.max(0, inputs.otherIncome ?? 0));
      warnings.push(`${label} : location meublée au réel — régime ${professional ? 'LMP' : 'LMNP'} (recettes ${euros(book.furnishedReceipts)} €, seuil ${euros(LMP_RECEIPTS_THRESHOLD_EUR.value)} € et prépondérance, CGI art. 155, IV). ${professional ? 'Déficit imputable sur le revenu global.' : `Déficit imputable sur les seuls revenus de même nature pendant ${LMNP_DEFICIT_CARRY_YEARS.value} ans (art. 156, I-1° ter).`}`);
      warnings.push(`${label} : amortissement plafonné au loyer diminué des autres charges (CGI art. 39 C, II) — ${euros(book.furnished.deducted)} € déduits, ${euros(book.furnished.carriedForward)} € reportés. L’amortissement par composants n’est pas décomposé, et la réintégration des amortissements dans la plus-value de cession n’est pas modélisée : vérifiez l’état du droit avant de conclure.`);
      if (book.entity.entityType === 'sci_ir') {
        warnings.push(`${label} : la location meublée est une activité commerciale par nature — une SCI à l’IR qui l’héberge bascule à l’impôt sur les sociétés (CGI art. 206, 2). Corrigez le régime du schéma.`);
      }
    }
    if (book.animatrice) {
      warnings.push(`${book.entity.label} : holding animatrice revendiquée — statut à prouver, jamais présumé. Preuves attendues : ${ANIMATRICE_EVIDENCE.join(' ')}`);
    } else if (isHolding(book.entity.entityType) && (book.feesReceived > 0 || book.expenses > 0)) {
      warnings.push(`${book.entity.label} : holding pure — aucun droit à déduction de TVA sur ses charges (coefficient de déduction nul). Seule une holding qui facture réellement ses filiales devient assujettie.`);
    }
  }
  for (const report of openReports) {
    if (report.soldYear === undefined) continue;
    if (report.soldYear - report.contributedYear >= REPORT_SALE_WINDOW_YEARS.value) continue;
    const eligible = report.reinvestedEligibleRatio ?? 0;
    if (eligible < REPORT_REINVESTMENT_QUOTA.value) {
      warnings.push(`Report 150-0 B ter : remploi éligible de ${Math.round(eligible * 100)} % sur les ${Math.round(REPORT_REINVESTMENT_QUOTA.value * 100)} % exigés, délai courant jusqu’en ${report.soldYear + REPORT_REINVESTMENT_WINDOW_YEARS.value}. La gestion de son propre patrimoine immobilier est exclue du remploi éligible : un OBO immobilier ne tient pas au-delà de la poche libre de ${Math.round((1 - REPORT_REINVESTMENT_QUOTA.value) * 100)} %.`);
    } else {
      warnings.push(`Report 150-0 B ter maintenu : remploi de ${Math.round(eligible * 100)} % à conserver ${REPORT_REINVESTMENT_HOLDING_YEARS.value} ans (CGI art. 150-0 B ter, I-2°).`);
    }
  }
  for (const forfeit of forfeits) {
    warnings.push(`Report 150-0 B ter déchu : plus-value de ${euros(forfeit.report.gain)} € imposée (${euros(forfeit.tax)} €) et intérêt de retard de ${euros(forfeit.interest)} € (CGI art. 1727) — remploi insuffisant dans le délai de ${REPORT_REINVESTMENT_WINDOW_YEARS.value} ans.`);
  }
  for (const own of ownerships) {
    if (own.nature !== 'usufruit' || typeOf(own.ownerId) !== 'person' || !own.dureeAnnees) continue;
    warnings.push(`${byId.get(own.ownerId)?.label ?? own.ownerId} : la cession d’un usufruit temporaire par une personne physique est imposée au barème dans la catégorie du revenu procuré, et non en plus-value (CGI art. 13, 5°). C’est ce qui motive de démembrer les parts plutôt que l’immeuble.`);
  }
  if (scenario.flows.some((flow) => SECURITIES.includes(flow.category))) {
    warnings.push('Cessions, apports et donations : l’app prend un prix saisi, elle ne valorise pas les titres. Agrément, préemption et clauses statutaires ne sont pas vérifiés.');
  }

  // ---- Lot 2026 : contributions et taxes nouvelles ----
  for (const book of books.values()) {
    if (book.mecenat) {
      warnings.push(`${book.entity.label} : mécénat — ${euros(book.mecenat.retained)} € retenus sur un plafond de ${euros(book.mecenat.cap)} € (20 000 € ou 5 ‰ du CA), réduction d’impôt de ${euros(book.mecenat.reduction)} € (CGI art. 238 bis). Les versements ne sont pas déductibles du bénéfice${book.mecenat.carriedForward > 0 ? `, et ${euros(book.mecenat.carriedForward)} € sont reportés sur les ${MECENAT_CARRY_YEARS.value} exercices suivants` : ''}.`);
    }
    const assetTax = holdingAssetTaxes.get(book.entity.id);
    if (!assetTax) continue;
    if (assetTax.liable) {
      warnings.push(`${book.entity.label} : taxe de ${HOLDING_ASSET_TAX_RATE.value * 100} % sur les actifs non professionnels (CGI art. 235 ter C) — ${euros(assetTax.due)} € dus sur une assiette de ${euros(assetTax.taxableAssets)} €. Due au titre des exercices clos à compter du 31 décembre 2026 ; elle n’est pas déductible de l’IS.`);
    } else {
      const missing = [
        assetTax.assetsOverThreshold ? null : 'actifs sous 5 M€',
        assetTax.controlledByIndividual ? null : `détention par une personne physique sous ${HOLDING_ASSET_TAX_CONTROL_PCT.value * 100} %`,
        assetTax.passiveIncomeMajority ? null : 'revenus passifs sous la moitié des produits',
      ].filter(Boolean);
      warnings.push(`${book.entity.label} : taxe sur les holdings patrimoniales non due — ${missing.join(', ')} (CGI art. 235 ter C, conditions cumulatives). La nature professionnelle des actifs n’est pas contrôlée.`);
    }
  }
  if (charasseReintegration > 0) {
    warnings.push(`Amendement Charasse : ${euros(charasseReintegration)} € de charges financières réintégrées au résultat d’ensemble (CGI art. 223 B, al. 6). La réintégration court sur l’exercice de rachat et les huit suivants, soit ${CHARASSE_REINTEGRATION_YEARS.value} exercices.`);
  } else if (selfPurchases.length > 0) {
    warnings.push('Rachat à soi-même détecté hors intégration fiscale : l’amendement Charasse ne s’applique pas, mais l’abus de droit reste à documenter (motifs économiques, prix d’expert).');
  }
  if (per.deducted > 0) {
    warnings.push(`PER : ${euros(per.deducted)} € déduits du revenu global sur un plafond de ${euros(per.ceiling)} € (CGI art. 163 quatervicies)${per.unusedCeiling > 0 ? `, ${euros(per.unusedCeiling)} € reportés sur les ${PER_CARRY_YEARS.value} années suivantes` : ''}. La sortie en capital ou en rente n’est pas modélisée.`);
  }
  for (const entity of resolvedEntities) {
    if (entity.entityType !== 'person' || !(entity.metrics.cdhrDue ?? 0)) continue;
    warnings.push(`${entity.label} : contribution différentielle sur les hauts revenus — ${euros(entity.metrics.cdhrDue!)} € (CGI art. 224, imposition minimale de ${CDHR_RATE.value * 100} % à compter des revenus 2026). Le revenu de référence est reconstitué à partir du seul schéma : les revenus extérieurs non saisis le majoreraient.`);
  }
  for (const [flowId, gain] of propertyGains) {
    const label = byId.get(scenario.flows.find((flow) => flow.id === flowId)?.sourceId ?? '')?.label ?? 'Cédant';
    if (gain.exempt) {
      warnings.push(`${label} : plus-value immobilière exonérée — ${gain.exemptionReason}`);
    } else {
      warnings.push(`${label} : plus-value immobilière de ${euros(gain.grossGain)} € — abattements pour durée de détention de ${Math.round(gain.allowanceIncomeTax * 100)} % à l’impôt sur le revenu et ${Math.round(gain.allowanceSocialLevies * 100)} % aux prélèvements sociaux (exonération à 22 et 30 ans)${gain.surtax ? `, surtaxe de ${euros(gain.surtax)} €` : ''}. Frais et travaux au forfait à défaut de justificatifs.`);
    }
  }

  return {
    scenarioId: scenario.id,
    entities: resolvedEntities,
    flows: resolvedFlows,
    calculations,
    summary: {
      caHt,
      expensesHt,
      vat: primaryBook?.vat ?? calculateVAT(0, 0),
      corporateTax: primaryBook?.corporateTax ?? NO_TAX,
      executiveSalary: primaryBook?.salary ?? NO_SALARY,
      personalIncomeTax,
      dividendArbitrage,
      dividendTaxMode,
      maxTaxableSalaryAtTmi: findMaxGrossSalaryForTargetTMI(salaryIncomeTax.marginalRate, parts, transparentAfterPer),
      sciTaxDue: roundMoney([...books.values()].filter((book) => isSci(book.entity.entityType)).reduce((sum, book) => sum + book.corporateTax.taxDue, 0)),
      netGroupCash,
      netPersonalCash,
    },
    warnings,
    timelineOrder: timelineStepOrder(),
    carryOut: {
      year: year + 1,
      deficits: Object.fromEntries([...books.values()]
        .filter((book) => book.deficitCarryForward > 0)
        .map((book) => [book.entity.id, { carryForward: book.deficitCarryForward }])),
      loans: Object.fromEntries([...installments].map(([id, installment]) =>
        [id, { principalOutstanding: installment.closing, yearsElapsed: installment.index + 1 }])),
      reports150_0Bter: openReports,
      amortizations: Object.fromEntries([...books.values()]
        .map((book) => [book.entity.id, {
          remaining: roundMoney(Math.max(0, usufructRemainingOf(book.entity.id) - book.usufructCharge)),
          annual: usufructAnnualOf(book.entity.id),
          carriedForward: book.furnished?.carriedForward ?? 0,
        }] as const)
        // L'échéancier reste dans l'état reporté même à zéro : sinon l'exercice suivant
        // repartirait du prix d'acquisition et amortirait une seconde fois.
        .filter(([, schedule]) => schedule.annual > 0 || schedule.carriedForward > 0)),
      treasury: Object.fromEntries(resolvedEntities
        .filter((entity) => books.has(entity.id))
        .map((entity) => [entity.id, entity.metrics.treasury ?? 0])),
      cca: Object.fromEntries(resolvedEntities
        .filter((entity) => books.has(entity.id))
        .map((entity) => [entity.id, entity.metrics.ccaBalance ?? 0])),
      perCeiling: primaryPerson && per.unusedCeiling > 0 ? { [primaryPerson.id]: per.unusedCeiling } : {},
      mecenat: Object.fromEntries([...books.values()]
        .filter((book) => (book.mecenat?.carriedForward ?? 0) > 0)
        .map((book) => [book.entity.id, book.mecenat!.carriedForward])),
      charasse: charasseStates,
    },
  };
}

/** Categories active up to and including the given timeline step (for replay UI). */
export function categoriesVisibleThrough(stepId: TimelineStepId): FlowCategory[] {
  const idx = timelineStepOrder().indexOf(stepId);
  return TIMELINE_STEPS.filter((_, i) => i <= idx).flatMap((s) => [...s.categories]);
}
