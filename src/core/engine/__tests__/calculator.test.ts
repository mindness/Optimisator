import { describe, expect, it } from 'vitest';

import {
  calculateCorporateTax,
  calculateExecutiveSalary,
  calculateFlatTax,
  calculateMotherDaughterDividend,
  calculatePersonalIncomeTax,
  calculateSciTax,
  calculateVAT,
} from '../calculator';
import {
  EXECUTIVE_COST_FACTOR_APPROX,
  IR_2026_BRACKETS,
  IR_EXPENSE_ALLOWANCE_CAP_EUR,
  IR_EXPENSE_ALLOWANCE_FLOOR_EUR,
  IR_EXPENSE_FLAT_10_PCT,
  IS_REDUCED_CA_CEILING_EUR,
  IS_REDUCED_RATE,
  IS_REDUCED_THRESHOLD_EUR,
  IS_STANDARD_RATE,
  MOTHER_DAUGHTER_QPFC_RATE,
  PFU_IR_RATE,
  PFU_PS_RATE,
  PFU_TOTAL_RATE,
  URSSAF_BRANCHES_2026,
  URSSAF_EMPLOYEE_RATE_2026,
  URSSAF_EMPLOYER_RATE_2026,
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

  it('derives the aggregate contribution rates from the sourced branch table', () => {
    const sum = (side: 'employee' | 'employer') =>
      URSSAF_BRANCHES_2026.reduce((total, branch) => total + branch[side], 0);

    expect(URSSAF_EMPLOYEE_RATE_2026.value).toBeCloseTo(sum('employee'), 4);
    expect(URSSAF_EMPLOYER_RATE_2026.value).toBeCloseTo(sum('employer'), 4);
    // Sourced line by line, but summed flat: never claim 'verified'.
    expect(URSSAF_EMPLOYEE_RATE_2026.status).toBe('assumed');
    expect(URSSAF_EMPLOYER_RATE_2026.status).toBe('assumed');
  });

  it('cites a source for every contribution branch', () => {
    for (const branch of URSSAF_BRANCHES_2026) {
      expect(branch.source.length).toBeGreaterThan(0);
    }
    // No unemployment branch: a président de SASU is not affiliated.
    expect(URSSAF_BRANCHES_2026.some((b) => /chômage/i.test(b.label))).toBe(false);
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
    expect(IS_REDUCED_CA_CEILING_EUR).toMatchObject({ value: 10_000_000, status: 'verified' });
    expect(IR_EXPENSE_FLAT_10_PCT).toMatchObject({ value: 0.1, status: 'verified' });
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

  it('applies the full standard rate when reduced-rate eligibility is false', () => {
    const income = 50_000;
    const result = calculateCorporateTax(income, false);
    expect(result.bracket15).toBe(0);
    expect(result.bracket25).toBe(euros(income * IS_STANDARD_RATE.value));
    expect(result.taxDue).toBe(result.bracket25);
    expect(result.netProfit).toBe(euros(income - result.taxDue));
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

describe('calculatePersonalIncomeTax — barème IR 2026 (CGI art. 197, abattement 10 % art. 83)', () => {
  it('exposes the 2026 verified bracket scale with 10% professional allowance', () => {
    expect(IR_2026_BRACKETS.status).toBe('verified');
    expect(IR_EXPENSE_FLAT_10_PCT.status).toBe('verified');
    expect(IR_2026_BRACKETS.value).toEqual([
      { upTo: 11_600, rate: 0 },
      { upTo: 29_579, rate: 0.11 },
      { upTo: 84_577, rate: 0.3 },
      { upTo: 181_917, rate: 0.41 },
      { upTo: Number.POSITIVE_INFINITY, rate: 0.45 },
    ]);
  });

  it('is zero below the first bracket', () => {
    const result = calculatePersonalIncomeTax(10_000);
    expect(result.taxableAfterAllowance).toBe(9_000);
    expect(result.taxDue).toBe(0);
    expect(result.netAfterIr).toBe(10_000);
  });

  it('applies 11% only above 11 600 € (1 part)', () => {
    const gross = 30_000; // abattement 10% → 27 000 taxable
    const result = calculatePersonalIncomeTax(gross);
    const taxable = 27_000;
    const base = taxable - 11_600; // 15 400
    expect(result.taxableAfterAllowance).toBe(taxable);
    expect(result.breakdown).toContainEqual(
      expect.objectContaining({ label: '11 %', amount: euros(base * 0.11) }),
    );
    // La décote (CGI art. 197 I-4-a) s'impute sur l'impôt brut de barème.
    expect(result.grossTaxDue).toBe(euros(base * 0.11));
    expect(result.taxDue).toBe(euros(result.grossTaxDue - result.decote));
    expect(result.netAfterIr).toBe(euros(gross - result.taxDue));
  });

  it('clips the 10% allowance to the 14 555 € cap and 509 € floor', () => {
    const high = calculatePersonalIncomeTax(200_000);
    expect(high.professionalAllowance).toBe(IR_EXPENSE_ALLOWANCE_CAP_EUR.value);
    const low = calculatePersonalIncomeTax(3_000);
    // 10% of 3 000 = 300 < 509 floor → allowance 509
    expect(low.professionalAllowance).toBe(IR_EXPENSE_ALLOWANCE_FLOOR_EUR.value);
  });

  it('supports a fraction of share (quotient familial)', () => {
    const single = calculatePersonalIncomeTax(80_000, 1);
    const couple = calculatePersonalIncomeTax(80_000, 2);
    expect(couple.taxDue).toBeLessThan(single.taxDue);
    expect(couple.taxDue).toBeGreaterThan(0);
  });
});

describe('calculateExecutiveSalary', () => {
  it('reconstructs gross / charges from flat model assumptions (salariales 21 %, patronales 39 %)', () => {
    const netDesired = 50_000;
    const result = calculateExecutiveSalary(netDesired);

    expect(result.grossSalary).toBe(euros(netDesired / (1 - URSSAF_EMPLOYEE_RATE_2026.value)));
    expect(result.employeeCharges).toBe(euros(result.grossSalary - netDesired));
    expect(result.employerCharges).toBe(euros(result.grossSalary * URSSAF_EMPLOYER_RATE_2026.value));
    expect(result.totalCompanyCost).toBe(euros(result.grossSalary + result.employerCharges));
    expect(result.grossSalary).toBeGreaterThan(netDesired);
    expect(result.employerCharges).toBeGreaterThan(0);
    expect(result.employeeCharges).toBeGreaterThan(0);
    expect(euros(result.grossSalary - result.employeeCharges)).toBe(netDesired);
    // coherence: ratio cost/net ≈ 1,76 (URSSAF 2026 xxx)
    expect(result.totalCompanyCost / netDesired).toBeCloseTo(1.76, 1);
  });

  it('returns zeros for zero net desired', () => {
    expect(calculateExecutiveSalary(0)).toEqual({
      grossSalary: 0,
      employerCharges: 0,
      employeeCharges: 0,
      totalCompanyCost: 0,
      netImposable: 0,
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
