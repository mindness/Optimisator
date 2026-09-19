export {
  calculateCorporateTax,
  calculateExecutiveSalary,
  calculateFlatTax,
  calculateMotherDaughterDividend,
  calculatePersonalIncomeTax,
  calculateSciTax,
  calculateVAT,
  findMaxGrossSalaryForTargetTMI,
  roundMoney,
  type CorporateTaxResult,
  type ExecutiveSalaryResult,
  type FlatTaxResult,
  type MotherDaughterDividendResult,
  type PersonalIncomeTaxResult,
  type SciTaxResult,
  type VatResult,
} from './calculator';

export {
  EXECUTIVE_COST_FACTOR_APPROX,
  EXECUTIVE_EMPLOYEE_RATE_APPROX,
  IR_2026_BRACKETS,
  IR_EXPENSE_ALLOWANCE_CAP_EUR,
  IR_EXPENSE_ALLOWANCE_FLOOR_EUR,
  IR_EXPENSE_FLAT_10_PCT,
  IS_REDUCED_CA_CEILING_EUR,
  IS_REDUCED_RATE,
  IS_REDUCED_THRESHOLD_EUR,
  IS_STANDARD_RATE,
  MOTHER_DAUGHTER_MIN_HOLDING_PCT,
  MOTHER_DAUGHTER_QPFC_RATE,
  PFU_IR_RATE,
  PFU_PS_RATE,
  PFU_TOTAL_RATE,
  URSSAF_BRANCHES_2026,
  URSSAF_EMPLOYEE_RATE_2026,
  URSSAF_EMPLOYER_RATE_2026,
  VAT_STANDARD,
  type UrssafBranch,
} from './taxRules';

export {
  categoriesVisibleThrough,
  resolveScenarioGraph,
  type ResolvedEntity,
  type ResolvedFlow,
  type ResolvedScenario,
  type ResolvedScenarioSummary,
  type WhatIfInputs,
} from './graphResolver';

export {
  FORECAST_BLIND_SPOTS,
  forecastScenario,
  type ForecastOptions,
  type ForecastResult,
  type ForecastYear,
} from './forecast';

export {
  DEFAULT_PAYOUT_RATIOS,
  OPTIMIZER_BLIND_SPOTS,
  optimizeRemuneration,
  type OptimizationObjective,
  type OptimizationPoint,
  type OptimizationResult,
  type OptimizeOptions,
} from './optimizer';

export {
  TIMELINE_STEPS,
  getTimelineSteps,
  timelineStepIdForCategory,
  timelineStepOrder,
  type TimelineStep,
  type TimelineStepId,
} from './timelineEngine';
