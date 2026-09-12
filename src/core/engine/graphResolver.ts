/**
 * Ordered graph resolver: applies What-If inputs, runs calculator math,
 * and tags each flow with its timeline step (Facturation → … → Dividendes).
 */
import type {
  EntityMetrics,
  EntityNodeData,
  FlowCategory,
  FlowEdgeData,
  ProvenanceKind,
  ScenarioState,
  TaxBreakdownLine,
  TaxCalculationResult,
} from '../types';
import {
  calculateCorporateTax,
  calculateExecutiveSalary,
  calculateFlatTax,
  calculateMotherDaughterDividend,
  calculateSciTax,
  calculateVAT,
  roundMoney,
  type CorporateTaxResult,
  type ExecutiveSalaryResult,
  type VatResult,
} from './calculator';
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
  sciTaxDue: number;
  netGroupCash: number;
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

function entityByType(entities: EntityNodeData[], type: EntityNodeData['entityType']): EntityNodeData | undefined {
  return entities.find((e) => e.entityType === type);
}

function findEntity(entities: EntityNodeData[], id: string): EntityNodeData | undefined {
  return entities.find((e) => e.id === id);
}

function isHolding(type: EntityNodeData['entityType']): boolean {
  return type === 'holding_sas' || type === 'holding_sarl';
}

function isSci(type: EntityNodeData['entityType']): boolean {
  return type === 'sci_is' || type === 'sci_ir';
}

function baseCaHt(scenario: ScenarioState, inputs: WhatIfInputs): number {
  if (inputs.caHt !== undefined) return inputs.caHt;
  const sasu = entityByType(scenario.entities, 'sasu');
  const fromInputs = sasu?.inputs?.caHt;
  const fromFlow = scenario.flows.find((f) => f.category === 'revenue')?.amount;
  const base = fromInputs ?? fromFlow ?? 0;
  return roundMoney(base * (inputs.caMultiplier ?? 1));
}

function baseExpensesHt(scenario: ScenarioState, inputs: WhatIfInputs): number {
  if (inputs.expensesHt !== undefined) return inputs.expensesHt;
  const sasu = entityByType(scenario.entities, 'sasu');
  const fromInputs = sasu?.inputs?.expensesHt;
  const fromFlow = scenario.flows
    .filter((f) => f.category === 'expense')
    .reduce((sum, f) => sum + f.amount, 0);
  return fromInputs ?? (fromFlow > 0 ? fromFlow : 0);
}

function baseExecutiveNet(scenario: ScenarioState, inputs: WhatIfInputs): number {
  if (inputs.executiveNetSalary !== undefined) return inputs.executiveNetSalary;
  const fromFlow = scenario.flows.find((f) => f.category === 'salary')?.amount;
  const person = entityByType(scenario.entities, 'person');
  return fromFlow ?? person?.inputs?.netSalary ?? 0;
}

function baseDividend(scenario: ScenarioState, inputs: WhatIfInputs): number {
  if (inputs.dividendAmount !== undefined) return inputs.dividendAmount;
  const opcoDiv = scenario.flows.find((f) => {
    if (f.category !== 'dividend') return false;
    const src = findEntity(scenario.entities, f.sourceId);
    return src?.entityType === 'sasu';
  });
  return opcoDiv?.amount ?? 0;
}

function baseSciRent(scenario: ScenarioState, inputs: WhatIfInputs): number {
  if (inputs.sciRentHt !== undefined) return inputs.sciRentHt;
  const rentFlow = scenario.flows.find((f) => f.category === 'rent');
  const sci = scenario.entities.find((e) => isSci(e.entityType));
  return rentFlow?.amount ?? sci?.inputs?.rentalIncomeHt ?? 0;
}

function taxResult(partial: Omit<TaxCalculationResult, 'provenance'> & { provenance?: ProvenanceKind }): TaxCalculationResult {
  return { provenance: 'derived', ...partial };
}

function line(label: string, amount: number, formula?: string): TaxBreakdownLine {
  return { label, amount, formula };
}

/**
 * Resolve the scenario graph in timeline order using calculator functions.
 *
 * Mère-fille pattern (explicit choice): QPFC friction uses
 * `calculateMotherDaughterDividend(amount, holdingTaxRate)` with a **flat**
 * holding tax rate (default IS standard 25%), NOT `calculateCorporateTax(qpfc)`.
 * This approximation does not determine eligibility for reduced IS.
 * The holding's full taxable result and regime eligibility are not evaluated.
 */
export function resolveScenarioGraph(
  scenario: ScenarioState,
  inputs: WhatIfInputs = {},
): ResolvedScenario {
  const caHt = baseCaHt(scenario, inputs);
  const expensesHt = baseExpensesHt(scenario, inputs);
  const executiveNet = baseExecutiveNet(scenario, inputs);
  const dividendGross = baseDividend(scenario, inputs);
  const sciRentHt = baseSciRent(scenario, inputs);

  const executiveSalary = calculateExecutiveSalary(executiveNet);
  const vat = calculateVAT(caHt, expensesHt);

  const hasSci = scenario.entities.some((e) => isSci(e.entityType));
  const sci = scenario.entities.find((e) => isSci(e.entityType));
  const sciInterest = sci?.inputs?.interestExpenses ?? 0;
  const sciAmort = sci?.inputs?.buildingAmortization ?? 0;
  const sciOther = sci?.inputs?.otherCharges ?? 0;
  const sciTax = hasSci
    ? calculateSciTax(sciRentHt, sciInterest, sciAmort, sciOther)
    : { taxableIncome: 0, taxDue: 0, cashFlowNet: 0 };

  // OpCo taxable income: CA − charges − company cost of salary − rent (intra-group).
  const rentDeduction = hasSci ? sciRentHt : 0;
  const taxableIncome = roundMoney(
    caHt - expensesHt - executiveSalary.totalCompanyCost - rentDeduction,
  );
  const corporateTax = calculateCorporateTax(taxableIncome);

  // Override only the first matching flow; other edges keep their own amounts.
  const opcoDividendId = scenario.flows.find((flow) =>
    flow.category === 'dividend' &&
    findEntity(scenario.entities, flow.sourceId)?.entityType === 'sasu',
  )?.id;
  const holdingDividendId = scenario.flows.find((flow) => {
    const source = findEntity(scenario.entities, flow.sourceId);
    return flow.category === 'dividend' && source && isHolding(source.entityType) &&
      findEntity(scenario.entities, flow.targetId)?.entityType === 'person';
  })?.id;
  const dividendAmountFor = (flow: FlowEdgeData): number => {
    if (flow.id === opcoDividendId) return dividendGross;
    if (flow.id === holdingDividendId) return inputs.holdingDividendAmount ?? flow.amount;
    return flow.amount;
  };
  const holdingTaxFor = (entityId: string): number => roundMoney(
    scenario.flows.filter((flow) =>
      flow.category === 'dividend' && flow.targetId === entityId &&
      findEntity(scenario.entities, flow.sourceId)?.entityType === 'sasu',
    ).reduce((sum, flow) => sum + calculateMotherDaughterDividend(dividendAmountFor(flow)).holdingTax, 0),
  );

  const calculations: TaxCalculationResult[] = [];
  const resolvedFlows: ResolvedFlow[] = [];

  const stepRank = new Map(timelineStepOrder().map((id, i) => [id, i]));
  const sortedFlows = [...scenario.flows].sort((a, b) => {
    const ra = stepRank.get(timelineStepIdForCategory(a.category)) ?? 0;
    const rb = stepRank.get(timelineStepIdForCategory(b.category)) ?? 0;
    if (ra !== rb) return ra - rb;
    return a.id.localeCompare(b.id);
  });

  for (const flow of sortedFlows) {
    const timelineStepId = timelineStepIdForCategory(flow.category);
    const source = findEntity(scenario.entities, flow.sourceId);
    const target = findEntity(scenario.entities, flow.targetId);
    let resolvedAmount = flow.amount;
    let flowTax: TaxCalculationResult | undefined;

    switch (flow.category) {
      case 'revenue': {
        resolvedAmount = caHt;
        break;
      }
      case 'expense': {
        resolvedAmount = expensesHt;
        break;
      }
      case 'salary': {
        // Cash paid is net; gross and contributions remain in the inspector.
        resolvedAmount = executiveNet;
        flowTax = taxResult({
          flowId: flow.id,
          category: 'salary',
          grossAmount: executiveSalary.grossSalary,
          taxAmount: executiveSalary.employeeCharges,
          netAmount: executiveNet,
          breakdown: [
            line('Coût entreprise', executiveSalary.totalCompanyCost, 'net × facteur cotisations'),
            line('Charges patronales', executiveSalary.employerCharges),
            line('Charges salariales', executiveSalary.employeeCharges),
          ],
        });
        break;
      }
      case 'social_charges': {
        resolvedAmount = roundMoney(
          executiveSalary.employerCharges + executiveSalary.employeeCharges,
        );
        flowTax = taxResult({
          flowId: flow.id,
          category: 'social_charges',
          grossAmount: resolvedAmount,
          taxAmount: resolvedAmount,
          netAmount: 0,
          breakdown: [
            line('Charges patronales', executiveSalary.employerCharges),
            line('Charges salariales', executiveSalary.employeeCharges),
          ],
        });
        break;
      }
      case 'rent': {
        resolvedAmount = sciRentHt;
        break;
      }
      case 'management_fees': {
        resolvedAmount = flow.amount;
        break;
      }
      case 'vat': {
        resolvedAmount = vat.netVatDue;
        flowTax = taxResult({
          flowId: flow.id,
          category: 'vat',
          grossAmount: vat.vatCollected,
          taxAmount: vat.netVatDue,
          netAmount: 0,
          breakdown: [
            line('TVA collectée', vat.vatCollected, 'CA HT × taux TVA'),
            line('TVA déductible', vat.vatDeductible, 'charges HT × taux TVA'),
            line('TVA nette due', vat.netVatDue),
          ],
        });
        break;
      }
      case 'is_tax': {
        const srcType = source?.entityType;
        if (source && isHolding(source.entityType)) {
          resolvedAmount = holdingTaxFor(source.id);
          flowTax = taxResult({
            flowId: flow.id,
            category: 'is_tax',
            grossAmount: resolvedAmount,
            taxAmount: resolvedAmount,
            netAmount: 0,
            breakdown: [line('IS holding simplifié sur QPFC', resolvedAmount)],
          });
        } else if (srcType && isSci(srcType)) {
          resolvedAmount = sciTax.taxDue;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'is_tax',
            grossAmount: sciTax.taxableIncome,
            taxAmount: sciTax.taxDue,
            netAmount: sciTax.cashFlowNet,
            breakdown: [line('IS SCI', sciTax.taxDue)],
          });
        } else {
          resolvedAmount = corporateTax.taxDue;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'is_tax',
            grossAmount: taxableIncome,
            taxAmount: corporateTax.taxDue,
            netAmount: corporateTax.netProfit,
            breakdown: [
              line('IS 15 %', corporateTax.bracket15),
              line('IS 25 %', corporateTax.bracket25),
              line('IS total', corporateTax.taxDue),
            ],
          });
        }
        break;
      }
      case 'dividend': {
        const fromSasu = source?.entityType === 'sasu';
        const fromHolding = source !== undefined && isHolding(source.entityType);
        const toHolding = target !== undefined && isHolding(target.entityType);
        const toPerson = target?.entityType === 'person';
        const grossDividend = dividendAmountFor(flow);
        const mereFille = calculateMotherDaughterDividend(grossDividend);
        const pfu = calculateFlatTax(grossDividend);

        if (fromSasu && toHolding) {
          // Flat holdingTaxRate path (see file-level comment).
          resolvedAmount = grossDividend;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'dividend',
            grossAmount: grossDividend,
            taxAmount: mereFille.holdingTax,
            netAmount: mereFille.netCashInHolding,
            legalNoteId: 'mere-fille-art-145',
            breakdown: [
              line('QPFC 5 %', mereFille.qpfc, 'dividend × 0.05'),
              line('IS holding (taux plat)', mereFille.holdingTax, 'QPFC × holdingTaxRate'),
            ],
          });
        } else if (fromHolding && toPerson) {
          resolvedAmount = grossDividend;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'dividend',
            grossAmount: grossDividend,
            taxAmount: pfu.totalTax,
            netAmount: pfu.netIncome,
            breakdown: [
              line('PFU IR 12,8 %', pfu.irPart),
              line('PFU PS', pfu.psPart),
              line('PFU total', pfu.totalTax),
            ],
          });
        } else if (fromSasu && toPerson) {
          resolvedAmount = grossDividend;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'dividend',
            grossAmount: grossDividend,
            taxAmount: pfu.totalTax,
            netAmount: pfu.netIncome,
            breakdown: [
              line('PFU IR 12,8 %', pfu.irPart),
              line('PFU PS', pfu.psPart),
              line('PFU total', pfu.totalTax),
            ],
          });
        } else {
          resolvedAmount = flow.amount;
        }
        break;
      }
      default:
        resolvedAmount = flow.amount;
    }

    if (flowTax) calculations.push(flowTax);

    resolvedFlows.push({
      ...flow,
      amount: resolvedAmount,
      resolvedAmount,
      timelineStepId,
      taxResult: flowTax,
    });
  }

  const dividends = resolvedFlows.filter((flow) => flow.category === 'dividend');
  const outgoingDividends = (entityId: string): number => roundMoney(
    dividends.filter((flow) => flow.sourceId === entityId)
      .reduce((sum, flow) => sum + flow.resolvedAmount, 0),
  );
  // Annual settled invoices: convert HT to TTC then settle VAT.
  // A VAT credit is a receivable, not an automatic cash refund.
  const vatCashAdjustment = roundMoney(vat.vatCollected - vat.vatDeductible - vat.netVatDue);

  const entities: ResolvedEntity[] = scenario.entities.map((entity) => {
    const metrics: EntityMetrics = { ...(entity.metrics ?? {}) };

    if (entity.entityType === 'sasu') {
      metrics.fiscalResult = taxableIncome;
      metrics.corporateTax = corporateTax.taxDue;
      metrics.netProfit = corporateTax.netProfit;
      metrics.treasury = roundMoney(
        corporateTax.netProfit + vatCashAdjustment - outgoingDividends(entity.id),
      );
    } else if (isHolding(entity.entityType)) {
      const received = roundMoney(dividends.filter((flow) => flow.targetId === entity.id)
        .reduce((sum, flow) => sum + (flow.taxResult?.netAmount ?? flow.resolvedAmount), 0));
      metrics.treasury = roundMoney(received - outgoingDividends(entity.id));
      metrics.corporateTax = holdingTaxFor(entity.id);
      metrics.netProfit = received;
    } else if (isSci(entity.entityType)) {
      metrics.fiscalResult = sciTax.taxableIncome;
      metrics.corporateTax = sciTax.taxDue;
      metrics.treasury = sciTax.cashFlowNet;
      metrics.netProfit = roundMoney(sciTax.taxableIncome - sciTax.taxDue);
    } else if (entity.entityType === 'person') {
      const received = roundMoney(resolvedFlows.filter((flow) =>
        flow.targetId === entity.id && (flow.category === 'salary' || flow.category === 'dividend'),
      ).reduce((sum, flow) => sum + (flow.taxResult?.netAmount ?? flow.resolvedAmount), 0));
      metrics.netPersonalCash = received;
      metrics.treasury = received;
    }

    return { ...entity, metrics };
  });

  const netGroupCash = roundMoney(entities.filter((entity) =>
    entity.entityType === 'sasu' || isHolding(entity.entityType) || isSci(entity.entityType),
  ).reduce((sum, entity) => sum + (entity.metrics.treasury ?? 0), 0));
  const netPersonalCash = roundMoney(entities.filter((entity) => entity.entityType === 'person')
    .reduce((sum, entity) => sum + (entity.metrics.netPersonalCash ?? 0), 0));
  const warnings = [
    'Modèle annuel simplifié, soldes initiaux nuls et paiements dans la période ; IR des rémunérations non calculé et cotisations approximatives.',
    'Éligibilité IS réduit et mère-fille non contrôlée ; IS holding limité à la QPFC. Taux issus du référentiel du dépôt, non revérifiés ici.',
    'Dividendes saisis sans validation du bénéfice distribuable, des réserves ni des conditions juridiques : une trésorerie positive ne vaut pas autorisation de distribution.',
  ];
  const unsupportedCategories: FlowCategory[] = ['management_fees', 'cca_advance', 'cca_reimbursement', 'loan_payment'];
  if (scenario.flows.some((flow) => unsupportedCategories.includes(flow.category) && flow.amount !== 0)) {
    warnings.push('Management fees, CCA et emprunts : flux affichés mais non intégrés aux soldes et résultats de ce modèle. Ne pas utiliser ces scénarios pour décider.');
  }
  if (scenario.entities.some((entity) => entity.entityType === 'sci_ir')) {
    warnings.push('SCI IR non prise en charge : le calcul SCI actuel est une approximation IS, non exploitable pour une SCI IR.');
  }
  if (scenario.flows.some((flow) => flow.periodicity !== 'annual')) {
    warnings.push('Périodicités non annuelles non résolues : les montants sont actuellement traités comme annuels.');
  }
  if (scenario.entities.filter((entity) => entity.entityType === 'sasu').length !== 1 ||
      scenario.entities.filter((entity) => isSci(entity.entityType)).length > 1 ||
      ['revenue', 'expense', 'salary'].some((category) => scenario.flows.filter((flow) => flow.category === category).length > 1)) {
    warnings.push('Topologie hors périmètre : plusieurs sociétés opérationnelles, SCI ou flux de même catégorie ne sont pas encore résolus indépendamment.');
  }
  if (vatCashAdjustment < 0) {
    warnings.push('Crédit de TVA non remboursé dans la période : il ne constitue pas de trésorerie disponible.');
  }
  for (const entity of entities) {
    if ((entity.metrics.treasury ?? 0) < 0) {
      warnings.push(`${entity.label} : trésorerie négative, scénario non financé dans les hypothèses actuelles.`);
    }
  }

  return {
    scenarioId: scenario.id,
    entities,
    flows: resolvedFlows,
    calculations,
    summary: {
      caHt,
      expensesHt,
      vat,
      corporateTax,
      executiveSalary,
      sciTaxDue: sciTax.taxDue,
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
