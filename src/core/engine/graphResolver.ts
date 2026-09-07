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
  /** Gross dividends distributed from OpCo (EUR). */
  dividendAmount?: number;
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
 * Rationale: V1 mirrors the calculator contract / PME bracket does not apply
 * to the 5% QPFC reintegration in this simplified model.
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

  const hasHolding = scenario.entities.some((e) => isHolding(e.entityType));
  const mereFille = hasHolding
    ? calculateMotherDaughterDividend(dividendGross)
    : { qpfc: 0, holdingTax: 0, netCashInHolding: dividendGross };

  // Personal PFU: direct OpCo→person when no holding; else holding→person on net cash after QPFC.
  const pfuBase = hasHolding ? mereFille.netCashInHolding : dividendGross;
  const pfu = calculateFlatTax(pfuBase);

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
        resolvedAmount = executiveSalary.grossSalary || executiveNet;
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
        if (srcType && isSci(srcType)) {
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

        if (fromSasu && toHolding) {
          // Flat holdingTaxRate path (see file-level comment).
          resolvedAmount = dividendGross;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'dividend',
            grossAmount: dividendGross,
            taxAmount: mereFille.holdingTax,
            netAmount: mereFille.netCashInHolding,
            legalNoteId: 'mere-fille-art-145',
            breakdown: [
              line('QPFC 5 %', mereFille.qpfc, 'dividend × 0.05'),
              line('IS holding (taux plat)', mereFille.holdingTax, 'QPFC × holdingTaxRate'),
            ],
          });
        } else if (fromHolding && toPerson) {
          resolvedAmount = pfuBase;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'dividend',
            grossAmount: pfuBase,
            taxAmount: pfu.totalTax,
            netAmount: pfu.netIncome,
            breakdown: [
              line('PFU IR 12,8 %', pfu.irPart),
              line('PFU PS', pfu.psPart),
              line('PFU total', pfu.totalTax),
            ],
          });
        } else if (fromSasu && toPerson) {
          resolvedAmount = dividendGross;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'dividend',
            grossAmount: dividendGross,
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

  const salaryNetToPerson = executiveNet;
  const dividendNetToPerson = hasHolding
    ? pfu.netIncome
    : scenario.flows.some(
          (f) =>
            f.category === 'dividend' &&
            findEntity(scenario.entities, f.targetId)?.entityType === 'person',
        )
      ? pfu.netIncome
      : 0;
  const netPersonalCash = roundMoney(salaryNetToPerson + dividendNetToPerson);

  const netGroupCash = roundMoney(
    corporateTax.netProfit -
      (hasHolding ? mereFille.holdingTax : 0) +
      (hasSci ? sciTax.cashFlowNet : 0) -
      vat.netVatDue,
  );

  const entities: ResolvedEntity[] = scenario.entities.map((entity) => {
    const metrics: EntityMetrics = { ...(entity.metrics ?? {}) };

    if (entity.entityType === 'sasu') {
      metrics.fiscalResult = taxableIncome;
      metrics.corporateTax = corporateTax.taxDue;
      metrics.netProfit = corporateTax.netProfit;
      metrics.treasury = roundMoney(
        caHt - expensesHt - executiveSalary.totalCompanyCost - rentDeduction - corporateTax.taxDue - vat.netVatDue - dividendGross,
      );
    } else if (isHolding(entity.entityType)) {
      metrics.treasury = mereFille.netCashInHolding - (hasHolding ? pfuBase : 0);
      metrics.corporateTax = mereFille.holdingTax;
      metrics.netProfit = mereFille.netCashInHolding;
    } else if (isSci(entity.entityType)) {
      metrics.fiscalResult = sciTax.taxableIncome;
      metrics.corporateTax = sciTax.taxDue;
      metrics.treasury = sciTax.cashFlowNet;
      metrics.netProfit = sciTax.cashFlowNet;
    } else if (entity.entityType === 'person') {
      metrics.netPersonalCash = netPersonalCash;
      metrics.treasury = netPersonalCash;
    }

    return { ...entity, metrics };
  });

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
    timelineOrder: timelineStepOrder(),
  };
}

/** Categories active up to and including the given timeline step (for replay UI). */
export function categoriesVisibleThrough(stepId: TimelineStepId): FlowCategory[] {
  const idx = timelineStepOrder().indexOf(stepId);
  return TIMELINE_STEPS.filter((_, i) => i <= idx).flatMap((s) => [...s.categories]);
}
