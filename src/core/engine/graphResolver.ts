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
  calculateDividendTax,
  calculateExecutiveSalary,
  calculateMotherDaughterDividend,
  calculatePersonalIncomeTax,
  calculateSciTax,
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
  IS_REDUCED_CA_CEILING_EUR,
  MOTHER_DAUGHTER_MIN_HOLDING_PCT,
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
  // CGI art. 219 I-b: reduced 15% rate only if CA ≤ 10 M€ (PME ceiling).
  // Full ownership conditions (capital paid-up, ≥75% individuals) not modelled.
  const reducedRateEligible = caHt <= IS_REDUCED_CA_CEILING_EUR.value;
  const corporateTax = calculateCorporateTax(taxableIncome, reducedRateEligible);

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

  // Dividendes encaissés par une personne physique : ils fixent l'arbitrage
  // PFU / barème et, sur option barème, remontent la TMI du foyer.
  const parts = inputs.parts ?? 1;
  const situation: FiscalSituation = inputs.situation ?? 'single';
  const personalDividendGross = roundMoney(
    scenario.flows
      .filter((flow) =>
        flow.category === 'dividend' &&
        findEntity(scenario.entities, flow.targetId)?.entityType === 'person',
      )
      .reduce((sum, flow) => sum + dividendAmountFor(flow), 0),
  );
  // G3 : l'IR porte sur le net imposable (net + CSG/CRDS non déductibles),
  // pas sur le net versé.
  const salaryIncomeTax = calculatePersonalIncomeTax(executiveSalary.netImposable, parts, {
    situation,
  });
  // ponytail: l'arbitrage utilise la TMI hors dividendes ; passer à un point
  // fixe si un scénario fait basculer la tranche par les dividendes eux-mêmes.
  const dividendArbitrage = compareDividendTaxModes(
    personalDividendGross,
    salaryIncomeTax.marginalRate,
  );
  const requestedMode = inputs.dividendTaxMode ?? 'auto';
  const dividendTaxMode: DividendTaxMode =
    requestedMode === 'auto' ? dividendArbitrage.best.mode : requestedMode;
  const personalIncomeTax = dividendTaxMode === 'bareme'
    ? calculatePersonalIncomeTax(executiveSalary.netImposable, parts, {
        situation,
        otherTaxableIncome: dividendArbitrage.bareme.taxableBase,
      })
    : salaryIncomeTax;
  const holdingTaxFor = (entityId: string): number => roundMoney(
    scenario.flows.filter((flow) =>
      flow.category === 'dividend' && flow.targetId === entityId &&
      findEntity(scenario.entities, flow.sourceId)?.entityType === 'sasu',
    ).reduce((sum, flow) => sum + calculateMotherDaughterDividend(dividendAmountFor(flow)).holdingTax, 0),
  );

  /**
   * CGI art. 145: mother-daughter regime requires ≥ 5% of the target's capital.
   * Check ownership links (or the legacy `ownershipPercent` on the OpCo).
   */
  const holdingQualifies = (holdingId: string): boolean => {
    const links = scenario.ownerships ?? [];
    const linkOk = links.some(
      (link) => link.ownerId === holdingId && link.percent >= MOTHER_DAUGHTER_MIN_HOLDING_PCT.value * 100,
    );
    if (linkOk) return true;
    const sasu = entityByType(scenario.entities, 'sasu');
    return (sasu?.ownershipPercent ?? 0) >= MOTHER_DAUGHTER_MIN_HOLDING_PCT.value * 100;
  };
  const holdingsBelowThreshold = scenario.entities.filter(
    (entity) => isHolding(entity.entityType) && !holdingQualifies(entity.id),
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
        const personalDividend = calculateDividendTax(
          grossDividend,
          dividendTaxMode,
          salaryIncomeTax.marginalRate,
        );

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
            taxAmount: personalDividend.totalTax,
            netAmount: personalDividend.netIncome,
            breakdown: personalDividend.breakdown,
          });
        } else if (fromSasu && toPerson) {
          resolvedAmount = grossDividend;
          flowTax = taxResult({
            flowId: flow.id,
            category: 'dividend',
            grossAmount: grossDividend,
            taxAmount: personalDividend.totalTax,
            netAmount: personalDividend.netIncome,
            breakdown: personalDividend.breakdown,
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
      // IR de la rémunération : assis sur le net imposable, foyer paramétré.
      // Les dividendes portent leur propre imposition dans le flux.
      const salaryNet = roundMoney(resolvedFlows.filter((flow) =>
        flow.targetId === entity.id && flow.category === 'salary',
      ).reduce((sum, flow) => sum + (flow.taxResult?.netAmount ?? flow.resolvedAmount), 0));
      const irDue = salaryNet > 0 ? salaryIncomeTax.taxDue : 0;
      metrics.netPersonalCash = roundMoney(received - irDue);
      metrics.personalIncomeTax = irDue;
      metrics.treasury = metrics.netPersonalCash;
    }

    return { ...entity, metrics };
  });

  const netGroupCash = roundMoney(entities.filter((entity) =>
    entity.entityType === 'sasu' || isHolding(entity.entityType) || isSci(entity.entityType),
  ).reduce((sum, entity) => sum + (entity.metrics.treasury ?? 0), 0));
  const netPersonalCash = roundMoney(entities.filter((entity) => entity.entityType === 'person')
    .reduce((sum, entity) => sum + (entity.metrics.netPersonalCash ?? 0), 0));
  const warnings = [
    'Modèle annuel simplifié, soldes initiaux nuls et paiements dans la période ; IR des rémunérations calculé selon le barème 2026 (1 part) et cotisations approximatives.',
  ];
  if (!reducedRateEligible) {
    warnings.push('CA > 10 M€ : le taux réduit d’IS (15 %) n’est pas applicable (CGI art. 219 I-b) — l’IS est calculé au taux normal de 25 %.');
  } else {
    warnings.push('IS réduit 15 % appliqué : éligibilité CA ≤ 10 M€ vérifiée ; conditions de détention du capital (libéré, ≥ 75 % personnes physiques) non contrôlées.');
  }
  if (holdingsBelowThreshold.length > 0) {
    warnings.push('Holding(s) sous le seuil mère-fille (détention < 5 %) : le régime (CGI art. 145) est appliqué de façon conservatrice mais requiert vérification par un professionnel.');
  }
  if (executiveNet > 0) {
    warnings.push(`IR personnel : barème 2026 sur le net imposable, ${parts} part(s), abattement 10 %, plafonnement du quotient et décote appliqués ; réductions et crédits d’impôt non modélisés.`);
  }
  if (personalDividendGross > 0) {
    warnings.push(dividendTaxMode === 'bareme'
      ? 'Dividendes imposés au barème (option globale CGI art. 200 A, 2) : l’option engage tous les revenus de capitaux mobiliers du foyer, non modélisés ici.'
      : 'Dividendes imposés au PFU (CGI art. 200 A, 1) ; l’option barème est comparée à TMI constante, hors autres revenus de capitaux mobiliers.');
  }
  warnings.push('Dividendes saisis sans validation du bénéfice distribuable, des réserves ni des conditions juridiques : une trésorerie positive ne vaut pas autorisation de distribution.');
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
      personalIncomeTax,
      dividendArbitrage,
      dividendTaxMode,
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
