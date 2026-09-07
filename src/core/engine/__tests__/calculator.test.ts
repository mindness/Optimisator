import { describe, expect, it } from 'vitest';

import {
  calculateCorporateTax,
  calculateExecutiveSalary,
  calculateFlatTax,
  calculateMotherDaughterDividend,
  calculateSciTax,
  calculateVAT,
} from '../calculator';
import {
  EXECUTIVE_COST_FACTOR_APPROX,
  IS_REDUCED_RATE,
  IS_REDUCED_THRESHOLD_EUR,
  IS_STANDARD_RATE,
  MOTHER_DAUGHTER_QPFC_RATE,
  PFU_IR_RATE,
  PFU_PS_RATE,
  PFU_TOTAL_RATE,
  VAT_STANDARD,
} from '../taxRules';

/** Cent rounding helper mirroring engine contract. */
function euros(n: number): number {
  return Math.round(n * 100) / 100;
}

describe('taxRules provenance', () => {
  it('freezes PFU PS 18.6% and total 31.4% as verified (2026 CSG package)', () => {
    expect(PFU_PS_RATE.status).toBe('verified');
    expect(PFU_PS_RATE.value).toBe(0.186);
    expect(PFU_TOTAL_RATE.status).toBe('verified');
    expect(PFU_TOTAL_RATE.value).toBe(0.314);
    expect(PFU_IR_RATE.status).toBe('verified');
    expect(PFU_IR_RATE.value).toBe(0.128);
  });

  it('marks executive cost factor as placeholder ~1.8', () => {
    expect(EXECUTIVE_COST_FACTOR_APPROX.status).toBe('placeholder');
    expect(EXECUTIVE_COST_FACTOR_APPROX.value).toBe(1.8);
  });

  it('exposes verified IS / TVA / QPFC rates from the draft', () => {
    expect(VAT_STANDARD).toMatchObject({ value: 0.2, status: 'verified' });
    expect(IS_STANDARD_RATE).toMatchObject({ value: 0.25, status: 'verified' });
    expect(IS_REDUCED_RATE).toMatchObject({ value: 0.15, status: 'verified' });
    expect(IS_REDUCED_THRESHOLD_EUR).toMatchObject({ value: 42500, status: 'verified' });
    expect(MOTHER_DAUGHTER_QPFC_RATE).toMatchObject({ value: 0.05, status: 'verified' });
  });
});

describe('calculateVAT', () => {
  it('computes collected, deductible and net due at standard 20%', () => {
    const result = calculateVAT(100_000, 40_000);

    expect(result).toEqual({
      vatCollected: euros(100_000 * VAT_STANDARD.value),
      vatDeductible: euros(40_000 * VAT_STANDARD.value),
      netVatDue: euros(20_000 - 8_000),
    });
  });

  it('floors net VAT due at zero when deductible exceeds collected', () => {
    const result = calculateVAT(10_000, 50_000);
    expect(result.netVatDue).toBe(0);
    expect(result.vatCollected).toBe(2_000);
    expect(result.vatDeductible).toBe(10_000);
  });

  it('accepts an override vatRate', () => {
    const result = calculateVAT(1_000, 0, 0.055);
    expect(result.vatCollected).toBe(euros(55));
    expect(result.vatDeductible).toBe(0);
    expect(result.netVatDue).toBe(euros(55));
  });
});

describe('calculateCorporateTax', () => {
  it('applies only the 15% PME bracket when income ≤ 42 500 €', () => {
    const result = calculateCorporateTax(42_500);

    expect(result.bracket15).toBe(euros(42_500 * IS_REDUCED_RATE.value));
    expect(result.bracket25).toBe(0);
    expect(result.taxDue).toBe(result.bracket15);
    expect(result.netProfit).toBe(euros(42_500 - result.taxDue));
  });

  it('splits 15% then 25% above the PME threshold', () => {
    const income = 100_000;
    const result = calculateCorporateTax(income);

    const expected15 = euros(IS_REDUCED_THRESHOLD_EUR.value * IS_REDUCED_RATE.value);
    const expected25 = euros((income - IS_REDUCED_THRESHOLD_EUR.value) * IS_STANDARD_RATE.value);

    expect(result.bracket15).toBe(expected15);
    expect(result.bracket25).toBe(expected25);
    expect(result.taxDue).toBe(euros(expected15 + expected25));
    expect(result.netProfit).toBe(euros(income - result.taxDue));
  });

  it('returns zero tax and unchanged net for non-positive taxable income', () => {
    expect(calculateCorporateTax(0)).toEqual({
      bracket15: 0,
      bracket25: 0,
      taxDue: 0,
      netProfit: 0,
    });
    expect(calculateCorporateTax(-10_000)).toEqual({
      bracket15: 0,
      bracket25: 0,
      taxDue: 0,
      netProfit: -10_000,
    });
  });
});

describe('calculateMotherDaughterDividend', () => {
  it('reintegrates QPFC 5% and taxes it at holding IS (default 25%)', () => {
    const dividend = 100_000;
    const result = calculateMotherDaughterDividend(dividend);

    const qpfc = euros(dividend * MOTHER_DAUGHTER_QPFC_RATE.value);
    const holdingTax = euros(qpfc * IS_STANDARD_RATE.value);

    expect(result.qpfc).toBe(qpfc);
    expect(result.holdingTax).toBe(holdingTax);
    expect(result.netCashInHolding).toBe(euros(dividend - holdingTax));
    // Effective friction ≈ 1.25% → cash ≈ 98.75%
    expect(result.netCashInHolding).toBe(98_750);
  });

  it('uses an optional holding tax rate override', () => {
    const result = calculateMotherDaughterDividend(100_000, 0.15);
    expect(result.qpfc).toBe(5_000);
    expect(result.holdingTax).toBe(euros(5_000 * 0.15));
    expect(result.netCashInHolding).toBe(euros(100_000 - 750));
  });
});

describe('calculateFlatTax', () => {
  it('splits PFU into verified IR 12.8% and verified PS 18.6% (total 31.4%)', () => {
    const gross = 10_000;
    const result = calculateFlatTax(gross);

    expect(result.irPart).toBe(euros(gross * PFU_IR_RATE.value));
    expect(result.psPart).toBe(euros(gross * PFU_PS_RATE.value));
    expect(result.totalTax).toBe(euros(result.irPart + result.psPart));
    expect(result.netIncome).toBe(euros(gross - result.totalTax));
    expect(result.totalTax).toBe(euros(gross * PFU_TOTAL_RATE.value));
  });

  it('rounds money amounts to cents', () => {
    const result = calculateFlatTax(333.33);
    expect(result.irPart).toBe(euros(333.33 * 0.128));
    expect(result.psPart).toBe(euros(333.33 * 0.186));
    expect(result.totalTax).toBe(euros(result.irPart + result.psPart));
    expect(result.netIncome).toBe(euros(333.33 - result.totalTax));
  });
});

describe('calculateExecutiveSalary', () => {
  it('scales company cost by placeholder factor 1.8 and decomposes charges', () => {
    const netDesired = 50_000;
    const result = calculateExecutiveSalary(netDesired);

    expect(result.totalCompanyCost).toBe(euros(netDesired * EXECUTIVE_COST_FACTOR_APPROX.value));
    expect(result.grossSalary).toBeGreaterThan(netDesired);
    expect(result.employerCharges).toBeGreaterThan(0);
    expect(result.employeeCharges).toBeGreaterThan(0);
    expect(
      euros(result.grossSalary + result.employerCharges),
    ).toBe(result.totalCompanyCost);
    expect(euros(result.grossSalary - result.employeeCharges)).toBe(netDesired);
  });

  it('returns zeros for zero net desired', () => {
    expect(calculateExecutiveSalary(0)).toEqual({
      grossSalary: 0,
      employerCharges: 0,
      employeeCharges: 0,
      totalCompanyCost: 0,
    });
  });
});

describe('calculateSciTax', () => {
  it('deducts interest, amortization and charges then applies IS (cash ignores amortization)', () => {
    const rentalIncomeHt = 36_000;
    const interestExpenses = 8_000;
    const buildingAmortization = 10_000;
    const otherCharges = 2_000;

    const result = calculateSciTax(
      rentalIncomeHt,
      interestExpenses,
      buildingAmortization,
      otherCharges,
    );

    const taxableIncome = euros(
      rentalIncomeHt - interestExpenses - buildingAmortization - otherCharges,
    );
    const is = calculateCorporateTax(taxableIncome);

    expect(result.taxableIncome).toBe(taxableIncome);
    expect(result.taxDue).toBe(is.taxDue);
    // Cash flow: amortization is non-cash
    expect(result.cashFlowNet).toBe(
      euros(rentalIncomeHt - interestExpenses - otherCharges - result.taxDue),
    );
  });

  it('yields zero tax and negative cash when charges wipe the result', () => {
    const result = calculateSciTax(12_000, 5_000, 20_000, 1_000);
    expect(result.taxableIncome).toBe(-14_000);
    expect(result.taxDue).toBe(0);
    expect(result.cashFlowNet).toBe(euros(12_000 - 5_000 - 1_000));
  });
});
