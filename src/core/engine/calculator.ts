/**
 * Pure deterministic French tax math for the simulateur.
 * Money amounts (EUR) are rounded to cents: Math.round(x * 100) / 100.
 */
import {
  EXECUTIVE_COST_FACTOR_APPROX,
  EXECUTIVE_EMPLOYEE_RATE_APPROX,
  IS_REDUCED_RATE,
  IS_REDUCED_THRESHOLD_EUR,
  IS_STANDARD_RATE,
  MOTHER_DAUGHTER_QPFC_RATE,
  PFU_IR_RATE,
  PFU_PS_RATE,
  VAT_STANDARD,
} from './taxRules';

/** Round EUR amounts to the nearest cent. */
export function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export interface VatResult {
  vatCollected: number;
  vatDeductible: number;
  netVatDue: number;
}

/**
 * TVA: collected on CA HT, deductible on expenses HT.
 * Net due floored at 0 (credit carry-forward not modelled here).
 */
export function calculateVAT(
  caHt: number,
  expensesHt: number,
  vatRate: number = VAT_STANDARD.value,
): VatResult {
  const vatCollected = roundMoney(caHt * vatRate);
  const vatDeductible = roundMoney(expensesHt * vatRate);
  const netVatDue = roundMoney(Math.max(0, vatCollected - vatDeductible));
  return { vatCollected, vatDeductible, netVatDue };
}

export interface CorporateTaxResult {
  bracket15: number;
  bracket25: number;
  taxDue: number;
  netProfit: number;
}

/**
 * IS PME: 15% up to IS_REDUCED_THRESHOLD_EUR, then 25% on the excess (CGI art. 219).
 * Non-positive taxable income → zero tax; netProfit mirrors the loss.
 */
export function calculateCorporateTax(taxableIncome: number): CorporateTaxResult {
  if (taxableIncome <= 0) {
    return {
      bracket15: 0,
      bracket25: 0,
      taxDue: 0,
      netProfit: roundMoney(taxableIncome),
    };
  }

  const threshold = IS_REDUCED_THRESHOLD_EUR.value;
  const base15 = Math.min(taxableIncome, threshold);
  const base25 = Math.max(0, taxableIncome - threshold);
  const bracket15 = roundMoney(base15 * IS_REDUCED_RATE.value);
  const bracket25 = roundMoney(base25 * IS_STANDARD_RATE.value);
  const taxDue = roundMoney(bracket15 + bracket25);
  const netProfit = roundMoney(taxableIncome - taxDue);

  return { bracket15, bracket25, taxDue, netProfit };
}

export interface MotherDaughterDividendResult {
  qpfc: number;
  holdingTax: number;
  netCashInHolding: number;
}

/**
 * Régime mère-fille (CGI 145 / 216): 95% exemption, QPFC 5% reintegrated at holding IS.
 * Default holding rate = standard IS 25% → friction 1.25%, cash ≈ 98.75%.
 */
export function calculateMotherDaughterDividend(
  dividendAmount: number,
  holdingTaxRate: number = IS_STANDARD_RATE.value,
): MotherDaughterDividendResult {
  const qpfc = roundMoney(dividendAmount * MOTHER_DAUGHTER_QPFC_RATE.value);
  const holdingTax = roundMoney(qpfc * holdingTaxRate);
  const netCashInHolding = roundMoney(dividendAmount - holdingTax);
  return { qpfc, holdingTax, netCashInHolding };
}

export interface FlatTaxResult {
  irPart: number;
  psPart: number;
  totalTax: number;
  netIncome: number;
}

/**
 * PFU on dividends: IR 12.8% + PS 18.6% (2026 package) = 31.4% — see taxRules provenance.
 */
export function calculateFlatTax(grossDividend: number): FlatTaxResult {
  const irPart = roundMoney(grossDividend * PFU_IR_RATE.value);
  const psPart = roundMoney(grossDividend * PFU_PS_RATE.value);
  const totalTax = roundMoney(irPart + psPart);
  const netIncome = roundMoney(grossDividend - totalTax);
  return { irPart, psPart, totalTax, netIncome };
}

export interface ExecutiveSalaryResult {
  grossSalary: number;
  employerCharges: number;
  employeeCharges: number;
  totalCompanyCost: number;
}

/**
 * Approximate président assimilé-salarié cost from desired net.
 * totalCompanyCost = net × EXECUTIVE_COST_FACTOR_APPROX (placeholder 1.8).
 * Gross derived with EXECUTIVE_EMPLOYEE_RATE_APPROX (0.22); employer charges
 * are the residual so that gross + employer = totalCompanyCost (cent-safe).
 */
export function calculateExecutiveSalary(netDesired: number): ExecutiveSalaryResult {
  if (netDesired === 0) {
    return {
      grossSalary: 0,
      employerCharges: 0,
      employeeCharges: 0,
      totalCompanyCost: 0,
    };
  }

  const factor = EXECUTIVE_COST_FACTOR_APPROX.value;
  const employeeRate = EXECUTIVE_EMPLOYEE_RATE_APPROX;

  // Anchor cost to net × factor, then residual-decompose so cents reconcile.
  const totalCompanyCost = roundMoney(netDesired * factor);
  const grossSalary = roundMoney(netDesired / (1 - employeeRate));
  const employeeCharges = roundMoney(grossSalary - netDesired);
  const employerCharges = roundMoney(totalCompanyCost - grossSalary);

  return { grossSalary, employerCharges, employeeCharges, totalCompanyCost };
}

export interface SciTaxResult {
  taxableIncome: number;
  taxDue: number;
  cashFlowNet: number;
}

/**
 * SCI à l'IS: taxable = loyers HT − intérêts − amortissement bâti − autres charges.
 * Cash flow ignores non-cash amortization; IS via calculateCorporateTax.
 */
export function calculateSciTax(
  rentalIncomeHt: number,
  interestExpenses: number,
  buildingAmortization: number,
  otherCharges: number,
): SciTaxResult {
  const taxableIncome = roundMoney(
    rentalIncomeHt - interestExpenses - buildingAmortization - otherCharges,
  );
  const { taxDue } = calculateCorporateTax(taxableIncome);
  const cashFlowNet = roundMoney(
    rentalIncomeHt - interestExpenses - otherCharges - taxDue,
  );
  return { taxableIncome, taxDue, cashFlowNet };
}
