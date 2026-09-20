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
  calculateSciIrIncome,
  calculateTnsContributions,
  calculateTnsDividendSurcharge,
  tnsGrossForNet,
  calculateVAT,
  compareDividendTaxModes,
  roundMoney,
  type CorporateTaxResult,
  type DividendArbitrage,
  type DividendTaxMode,
  type ExecutiveSalaryResult,
  type FiscalSituation,
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
} from './taxRules';
import {
  TIMELINE_STEPS,
  timelineStepIdForCategory,
  timelineStepOrder,
  type TimelineStepId,
} from './timelineEngine';

/** Live What-If overrides (absolute EUR annual unless noted). */
export interface WhatIfInputs {
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
   * Régime d'imposition des dividendes perçus par la personne physique.
   * `auto` retient le moins coûteux à la TMI constatée.
   */
  dividendTaxMode?: DividendTaxMode | 'auto';
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
}

const OPERATING: readonly EntityType[] = ['sasu', 'eurl', 'sarl', 'micro_entreprise', 'entreprise_individuelle'];
const COMPANIES: readonly EntityType[] = [...OPERATING, 'holding_sas', 'holding_sarl', 'sci_is', 'sci_ir'];
const TRANSFERS: readonly FlowCategory[] = ['cca_advance', 'cca_reimbursement', 'loan_payment', 'capital_contribution'];
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
}

export function resolveScenarioGraph(
  scenario: ScenarioState,
  inputs: WhatIfInputs = {},
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

  /** Montant annuel effectif d'un flux, curseurs appliqués. */
  const amountOf = (flow: FlowEdgeData): number => {
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
  const interestOf = (flow: FlowEdgeData) => flow.interestAmount ?? 0;
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
    const amort = entity.entityType === 'sci_is' ? entity.inputs?.buildingAmortization ?? 0 : 0;
    const vat = franchise ? calculateVAT(0, 0) : calculateVAT(revenue, expenses);
    const reducedRateEligible = revenue <= IS_REDUCED_CA_CEILING_EUR.value;

    let taxable: number;
    let corporateTax = NO_TAX;
    let socialOnProfit = 0;
    let liberatoire = 0;
    let netProfit: number;
    if (isMicro(entity.entityType)) {
      const category = entity.microCategory ?? 'bnc';
      const micro = calculateMicroEnterprise(revenue, category);
      taxable = micro.taxableProfit;
      socialOnProfit = roundMoney(micro.socialContributions * (entity.options?.acre ? 1 - ACRE_MICRO_REDUCTION.value : 1));
      liberatoire = entity.options?.versementLiberatoire ? roundMoney(revenue * MICRO_VERSEMENT_LIBERATOIRE_RATES[category].value) : 0;
      netProfit = roundMoney(revenue - socialOnProfit - liberatoire - expenses - rentPaid - feesPaid - interestPaid);
    } else if (isSci(entity.entityType)) {
      taxable = roundMoney(rentReceived + interestReceived - interest - amort - other - interestPaid);
      if (taxRegime === 'is') corporateTax = calculateCorporateTax(taxable, reducedRateEligible);
      netProfit = roundMoney(rentReceived + interestReceived - interest - other - interestPaid - corporateTax.taxDue);
    } else {
      taxable = roundMoney(revenue + rentReceived + feesReceived + interestReceived + qpfc
        - expenses - salary.totalCompanyCost - rentPaid - feesPaid - interestPaid + interestExcess);
      if (taxRegime === 'is') {
        corporateTax = calculateCorporateTax(taxable, reducedRateEligible);
        // Les dividendes reçus sont encaissés en trésorerie ; seule la QPFC est imposée.
        netProfit = roundMoney(taxable - qpfc + dividendsReceived - corporateTax.taxDue);
      } else {
        socialOnProfit = calculateTnsContributions(taxable).contributions;
        taxable = roundMoney(taxable - socialOnProfit);
        netProfit = roundMoney(taxable - salaryNet);
      }
    }
    books.set(entity.id, {
      entity, taxRegime, revenue, expenses, salaryNet, salary, rentPaid, rentReceived, feesPaid, feesReceived,
      interestPaid, interestReceived, dividendsReceived, qpfc, taxable, corporateTax, socialOnProfit, liberatoire, interestExcess, vat,
      reducedRateEligible, netProfit,
    });
  }

  // ---- Intégration fiscale : IS unique, filiales à leur IS seul, écart chez la mère ----
  let groupTaxable = 0;
  let groupTax: CorporateTaxResult | undefined;
  if (integrationHolding) {
    const members = [...books.values()].filter((book) => book.taxRegime === 'is' && inGroup(book.entity.id));
    groupTaxable = roundMoney(members.reduce((sum, book) => sum + book.taxable, 0));
    groupTax = calculateCorporateTax(groupTaxable, members.every((book) => book.reducedRateEligible));
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
    const links = (scenario.ownerships ?? []).filter((own) => own.companyId === companyId && typeOf(own.ownerId) === 'person');
    if (links.length === 0) return personId === primaryPerson?.id ? 1 : 0;
    const total = links.reduce((sum, own) => sum + own.percent, 0);
    return (links.find((own) => own.ownerId === personId)?.percent ?? 0) / total;
  };
  // Revenus transparents : bénéfices IR (EURL / EI / micro hors versement libératoire), revenus fonciers SCI IR.
  const transparentIncomeOf = (personId: string) => roundMoney([...books.values()]
    .filter((book) => book.taxRegime === 'ir' && !book.liberatoire)
    .reduce((sum, book) => sum + Math.max(0, book.taxable) * shareOf(personId, book.entity.id), 0));
  const salaryNetImposableOf = (personId: string) => roundMoney([...books.values()]
    .reduce((sum, book) => sum + book.salary.netImposable * (sumOf('salary', 'sourceId', book.entity.id) > 0 ? sumOf('salary', 'sourceId', book.entity.id, (f) => f.targetId === personId ? amountOf(f) : 0) / sumOf('salary', 'sourceId', book.entity.id) : 0), 0));
  // SCI IR : prélèvements sociaux sur le revenu foncier, en plus du barème.
  const sciIrLeviesOf = (personId: string) => roundMoney([...books.values()].filter((book) => book.entity.entityType === 'sci_ir')
    .reduce((sum, book) => sum + calculateSciIrIncome(book.rentReceived, book.entity.inputs?.interestExpenses ?? 0, book.entity.inputs?.otherCharges ?? 0, 0).socialLevies * shareOf(personId, book.entity.id), 0));
  const transparentIncome = transparentIncomeOf(primaryPerson?.id ?? '');
  const salaryNetImposable = salaryNetImposableOf(primaryPerson?.id ?? '');
  const salaryIncomeTax = calculatePersonalIncomeTax(salaryNetImposable, parts, { situation, otherTaxableIncome: transparentIncome });
  const dividendArbitrage = compareDividendTaxModes(personalDividendGross, salaryIncomeTax.marginalRate);
  const requestedMode = inputs.dividendTaxMode ?? 'auto';
  const dividendTaxMode: DividendTaxMode = requestedMode === 'auto' ? dividendArbitrage.best.mode : requestedMode;
  const personalIncomeTax = dividendTaxMode === 'bareme'
    ? calculatePersonalIncomeTax(salaryNetImposable, parts, { situation, otherTaxableIncome: roundMoney(transparentIncome + dividendArbitrage.bareme.taxableBase) })
    : salaryIncomeTax;
  // ponytail: le foyer (parts, situation) des curseurs vaut pour le premier dirigeant ; les autres associés sont à 1 part, célibataire.
  const incomeTaxOf = (personId: string) => personId === primaryPerson?.id
    ? salaryIncomeTax.taxDue
    : calculatePersonalIncomeTax(salaryNetImposableOf(personId), 1, { situation: 'single', otherTaxableIncome: transparentIncomeOf(personId) }).taxDue;

  // ---- Flux résolus -----------------------------------------------------------
  const calculations: TaxCalculationResult[] = [];
  const resolvedFlows: ResolvedFlow[] = [];
  const stepRank = new Map(timelineStepOrder().map((id, i) => [id, i]));
  const sortedFlows = [...scenario.flows].sort((a, b) => {
    const ra = stepRank.get(timelineStepIdForCategory(a.category)) ?? 0;
    const rb = stepRank.get(timelineStepIdForCategory(b.category)) ?? 0;
    return ra !== rb ? ra - rb : a.id.localeCompare(b.id);
  });
  const debtorCcaFlows = scenario.flows.filter((flow) =>
    flow.category === 'cca_advance' && flow.amount > 0 && typeOf(flow.targetId) === 'person' && typeOf(flow.sourceId) !== 'person');
  const tnsSurcharges = new Map<string, number>();

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
          const fees = calculateCorporateTax(resolvedAmount, true);
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
          const personal = calculateDividendTax(resolvedAmount, dividendTaxMode, salaryIncomeTax.marginalRate);
          const breakdown = [...personal.breakdown];
          let extra = 0;
          // Gérant majoritaire TNS : dividendes > 10 % (capital + CCA) cotisent (CSS L131-6).
          if ((source.socialRegime ?? DEFAULT_SOCIAL_REGIME[source.entityType]) === 'tns' && (source.entityType === 'eurl' || source.entityType === 'sarl' || source.entityType === 'holding_sarl')) {
            const capitalBase = (source.inputs?.capital ?? 0) + (source.inputs?.openingCca ?? 0) + sumOf('cca_advance', 'targetId', source.id) + sumOf('capital_contribution', 'targetId', source.id);
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
  const ccaBalanceFor = (companyId: string) => roundMoney((byId.get(companyId)?.inputs?.openingCca ?? 0) + resolvedFlows.reduce((sum, flow) => {
    if (flow.category === 'cca_advance' && flow.targetId === companyId) return sum + flow.resolvedAmount;
    if (flow.category === 'cca_reimbursement' && flow.sourceId === companyId) return sum - flow.resolvedAmount;
    return sum;
  }, 0));

  const resolvedEntities: ResolvedEntity[] = entities.map((entity) => {
    const metrics: EntityMetrics = { ...(entity.metrics ?? {}) };
    const book = books.get(entity.id);
    if (book) {
      // Crédit de TVA : créance, pas un remboursement automatique.
      const vatCashAdjustment = roundMoney(book.vat.vatCollected - book.vat.vatDeductible - book.vat.netVatDue);
      const surcharge = tnsSurcharges.get(entity.id) ?? 0;
      metrics.fiscalResult = book.taxable;
      metrics.corporateTax = book.corporateTax.taxDue;
      metrics.netProfit = roundMoney(book.netProfit - surcharge);
      metrics.treasury = roundMoney((entity.inputs?.openingTreasury ?? 0) + metrics.netProfit + vatCashAdjustment
        + transfersFor(entity.id) + loanInterestFor(entity.id) - outgoingDividends(entity.id));
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
      metrics.personalIncomeTax = irDue;
      metrics.netPersonalCash = roundMoney(received + interestNet - irDue + transfersFor(entity.id));
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
      : 'Dividendes imposés au PFU (CGI art. 200 A, 1) ; l’option barème est comparée à TMI constante, hors autres revenus de capitaux mobiliers.');
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
      sciTaxDue: roundMoney([...books.values()].filter((book) => isSci(book.entity.entityType)).reduce((sum, book) => sum + book.corporateTax.taxDue, 0)),
      netGroupCash,
      netPersonalCash,
    },
    warnings,
    timelineOrder: timelineStepOrder(),
  };
}

/** Categories active up to and including the given timeline step (for replay UI). */
export function categoriesVisibleThrough(stepId: TimelineStepId): FlowCategory[] {
  const idx = timelineStepOrder().indexOf(stepId);
  return TIMELINE_STEPS.filter((_, i) => i <= idx).flatMap((s) => [...s.categories]);
}
