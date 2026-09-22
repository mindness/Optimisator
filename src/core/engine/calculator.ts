/**
 * Pure deterministic French tax math for the simulateur.
 * Money amounts (EUR) are rounded to cents: Math.round(x * 100) / 100.
 */
import type { TaxBracket, TaxBreakdownLine } from '../types';
import {
  CSG_DEDUCTIBLE_POINTS,
  DIVIDEND_BAREME_ALLOWANCE,
  IR_2026_BRACKETS,
  IR_DECOTE_COUPLE_EUR,
  IR_DECOTE_SINGLE_EUR,
  IR_DECOTE_SLOPE,
  IR_EXPENSE_ALLOWANCE_CAP_EUR,
  IR_EXPENSE_ALLOWANCE_FLOOR_EUR,
  IR_EXPENSE_FLAT_10_PCT,
  IS_REDUCED_RATE,
  IS_REDUCED_THRESHOLD_EUR,
  IS_STANDARD_RATE,
  MICRO_ALLOWANCE_FLOOR_EUR,
  MICRO_BRACKETS_2026,
  MOTHER_DAUGHTER_QPFC_RATE,
  PFU_IR_RATE,
  PFU_PS_RATE,
  QUOTIENT_FAMILIAL_CAP_PER_HALF_PART_EUR,
  SALARY_NON_DEDUCTIBLE_CSG_CRDS,
  TNS_DIVIDEND_EXEMPT_CAPITAL_SHARE,
  URSSAF_EMPLOYEE_RATE_2026,
  URSSAF_EMPLOYER_RATE_2026,
  VAT_STANDARD,
  DEFICIT_CARRYFORWARD_CAP_EUR,
  DEFICIT_CARRYFORWARD_MARGINAL_SHARE,
  DMTG_DIRECT_LINE_ABATEMENT_EUR,
  DMTG_DIRECT_LINE_BRACKETS,
  DUTREIL_EXEMPTION_RATE,
  IFI_BRACKETS,
  IFI_DECOTE_BASE_EUR,
  IFI_DECOTE_SLOPE,
  IFI_THRESHOLD_EUR,
  LATE_INTEREST_MONTHLY_RATE,
  LMP_RECEIPTS_THRESHOLD_EUR,
  PARTICIPATION_MIN_HOLDING_PCT,
  PARTICIPATION_MIN_HOLDING_YEARS,
  PARTICIPATION_QPFC_RATE,
  RETIREMENT_FIXED_ALLOWANCE_EUR,
  SHARE_SALE_ALLOWANCE_2_TO_8,
  SHARE_SALE_ALLOWANCE_ACQUISITION_CUTOFF_YEAR,
  SHARE_SALE_ALLOWANCE_OVER_8,
  USUFRUIT_TEMPORAIRE_SHARE_PER_DECADE,
  USUFRUIT_VIAGER_BAREME,
  CDHR_ALLOWANCE_COUPLE_EUR,
  CDHR_ALLOWANCE_PER_DEPENDENT_EUR,
  CDHR_RATE,
  CDHR_SMOOTHING_CEILING_COUPLE_EUR,
  CDHR_SMOOTHING_CEILING_SINGLE_EUR,
  CDHR_SMOOTHING_SLOPE,
  CDHR_THRESHOLD_COUPLE_EUR,
  CDHR_THRESHOLD_SINGLE_EUR,
  CHARASSE_REINTEGRATION_YEARS,
  HOLDING_ASSET_TAX_CONTROL_PCT,
  HOLDING_ASSET_TAX_PASSIVE_SHARE,
  HOLDING_ASSET_TAX_RATE,
  HOLDING_ASSET_TAX_THRESHOLD_EUR,
  MECENAT_CAP_FLOOR_EUR,
  MECENAT_CAP_REVENUE_SHARE,
  MECENAT_RATE,
  MECENAT_RATE_ABOVE_THRESHOLD,
  MECENAT_RATE_THRESHOLD_EUR,
  PER_CARRY_YEARS,
  PER_DEDUCTION_RATE,
  PER_INCOME_CAP_PASS,
  PROPERTY_ACQUISITION_COSTS_FLAT,
  PROPERTY_ALLOWANCE_IR_PER_YEAR,
  PROPERTY_ALLOWANCE_IR_YEAR_22,
  PROPERTY_ALLOWANCE_PS_BEYOND_22,
  PROPERTY_ALLOWANCE_PS_PER_YEAR,
  PROPERTY_ALLOWANCE_PS_YEAR_22,
  PROPERTY_GAIN_IR_RATE,
  PROPERTY_SMALL_SALE_EXEMPTION_EUR,
  PROPERTY_SURTAX_BRACKETS,
  PROPERTY_WORKS_FLAT,
  PROPERTY_WORKS_FLAT_MIN_YEARS,
  type MicroCategory,
} from './taxRules';
import {
  PASS_2026_EUR,
  TNS_ABATTEMENT_CEILING_EUR,
  TNS_ABATTEMENT_FLOOR_EUR,
  TNS_AF_FULL_PASS,
  TNS_AF_MAX_RATE,
  TNS_AF_START_PASS,
  TNS_ASSIETTE_ABATTEMENT,
  TNS_CSG_CRDS_RATE,
  TNS_FORMATION_RATE_OF_PASS,
  TNS_IJ_CEILING_PASS,
  TNS_IJ_RATE,
  TNS_INVALIDITE_DECES_FLOOR_PASS,
  TNS_INVALIDITE_DECES_RATE,
  TNS_MALADIE_ABOVE_3_PASS,
  TNS_MALADIE_STEPS,
  TNS_RCI_CEILING_PASS,
  TNS_RCI_T1,
  TNS_RCI_T2,
  TNS_RETRAITE_BASE_DEPLAFONNEE,
  TNS_RETRAITE_BASE_PLAFONNEE,
} from './tnsRules';

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

/** Durée d'un exercice plein, en jours : référence du prorata de l'art. 219, I-b. */
export const FULL_EXERCISE_DAYS = 365;

/**
 * Plafond du taux réduit ramené à la durée de l'exercice.
 * CGI art. 219, I-b : le taux de 15 % s'applique « dans la limite de 42 500 €
 * de bénéfice imposable **par période de douze mois** ». Un premier exercice
 * écourté, ou un exercice de transition, n'ouvre donc qu'une fraction du plafond.
 */
export function reducedRateThresholdFor(exerciseDays: number = FULL_EXERCISE_DAYS): number {
  const days = Math.max(1, Math.min(exerciseDays, FULL_EXERCISE_DAYS));
  return roundMoney(IS_REDUCED_THRESHOLD_EUR.value * (days / FULL_EXERCISE_DAYS));
}

/**
 * Chiffre d'affaires ramené à douze mois, pour le test du plafond de 10 M€.
 * Même alinéa : le CA est annualisé, alors que le plafond de bénéfice est réduit.
 */
export function annualisedRevenue(revenue: number, exerciseDays: number = FULL_EXERCISE_DAYS): number {
  const days = Math.max(1, exerciseDays);
  return roundMoney(revenue * (FULL_EXERCISE_DAYS / days));
}

/**
 * IS PME: 15% up to IS_REDUCED_THRESHOLD_EUR, then 25% on the excess (CGI art. 219).
 * Non-positive taxable income → zero tax; netProfit mirrors the loss.
 * `reducedRateEligible` defaults to true (preset PME assumption); when false,
 * the 25% standard rate applies to the whole taxable income.
 * `exerciseDays` proratise le plafond du taux réduit ; 365 par défaut, donc
 * aucun changement pour un exercice plein.
 */
export function calculateCorporateTax(
  taxableIncome: number,
  reducedRateEligible: boolean = true,
  exerciseDays: number = FULL_EXERCISE_DAYS,
): CorporateTaxResult {
  if (taxableIncome <= 0) {
    return {
      bracket15: 0,
      bracket25: 0,
      taxDue: 0,
      netProfit: roundMoney(taxableIncome),
    };
  }

  if (!reducedRateEligible) {
    const taxDue = roundMoney(taxableIncome * IS_STANDARD_RATE.value);
    return {
      bracket15: 0,
      bracket25: taxDue,
      taxDue,
      netProfit: roundMoney(taxableIncome - taxDue),
    };
  }

  const threshold = reducedRateThresholdFor(exerciseDays);
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
  qpfcRate: number = MOTHER_DAUGHTER_QPFC_RATE.value,
): MotherDaughterDividendResult {
  const qpfc = roundMoney(dividendAmount * qpfcRate);
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

export type FiscalSituation = 'single' | 'couple';

/** Foyer fiscal inputs driving the barème: parts and marital situation. */
export interface FiscalProfile {
  /** Number of quotient-familial parts (1 = célibataire, 2 = couple, +0,5/enfant). */
  parts?: number;
  situation?: FiscalSituation;
  /**
   * Taxable income already net of its own allowance, added to the barème base:
   * dividendes imposés au barème, revenus fonciers, BIC/BNC micro ou réel.
   */
  otherTaxableIncome?: number;
}

export interface PersonalIncomeTaxResult {
  /** Marginal tax rate: rate of the highest bracket reached (TMI). */
  marginalRate: number;
  /** Gross salary/treatment income (€). */
  grossIncome: number;
  /** CGI art. 83-3° flat allowance (10%, clamped to [509, 14 555] €). */
  professionalAllowance: number;
  /** Net salary subject to brackets after allowance, plus otherTaxableIncome (€). */
  taxableAfterAllowance: number;
  /** Number of quotient-familial parts (default 1). */
  parts: number;
  situation: FiscalSituation;
  /** Tax before plafonnement du quotient familial and décote (€). */
  grossTaxDue: number;
  /** Extra tax caused by the quotient-familial cap, CGI art. 197 I-2 (€). */
  quotientCapAdjustment: number;
  /** Décote applied, CGI art. 197 I-4-a (€). */
  decote: number;
  /** Progressive tax after cap and décote (€). */
  taxDue: number;
  /** gross − taxDue (what actually lands in the pocket). */
  netAfterIr: number;
  /** taxDue / taxableAfterAllowance — what is actually paid, unlike the TMI. */
  averageRate: number;
  breakdown: TaxBreakdownLine[];
}

interface BracketTax {
  tax: number;
  marginalRate: number;
  breakdown: TaxBreakdownLine[];
}

/** Barème progressif appliqué à une part de revenu (CGI art. 197, I-1). */
function taxOneShare(share: number): BracketTax {
  let tax = 0;
  let marginalRate = 0;
  const breakdown: TaxBreakdownLine[] = [];
  let lowerBound = 0;

  for (const bracket of IR_2026_BRACKETS.value) {
    if (share <= lowerBound) break;
    const slice = Math.min(share, bracket.upTo) - lowerBound;
    if (slice > 0) {
      const sliceTax = roundMoney(slice * bracket.rate);
      tax += sliceTax;
      breakdown.push({
        label: `${Math.round(bracket.rate * 100)} %`,
        amount: sliceTax,
        formula: `${roundMoney(slice)} € × ${Math.round(bracket.rate * 100)} %`,
      });
      marginalRate = bracket.rate;
    }
    if (bracket.upTo === Infinity) break;
    lowerBound = bracket.upTo;
  }

  return { tax: roundMoney(tax), marginalRate, breakdown };
}

/**
 * IR personnel 2026 (CGI art. 197 + art. 83).
 *
 * Forfait frais pro 10 % plafonné/planchéré sur le salaire, ajout des autres
 * revenus déjà nets d'abattement, barème progressif par part, puis
 * **plafonnement du quotient familial** (art. 197 I-2) et **décote**
 * (art. 197 I-4-a).
 *
 * Reste hors modèle : réductions et crédits d'impôt, parts supplémentaires
 * catégorielles (invalidité, parent isolé, veuf), revenus de remplacement,
 * pensions. Ce n'est pas une déclaration de revenus.
 */
export function calculatePersonalIncomeTax(
  grossIncome: number,
  parts: number = 1,
  profile: Omit<FiscalProfile, 'parts'> = {},
): PersonalIncomeTaxResult {
  const safeParts = Math.max(0.5, parts);
  const situation: FiscalSituation = profile.situation ?? 'single';
  const otherTaxableIncome = profile.otherTaxableIncome ?? 0;

  const rawAllowance = grossIncome * IR_EXPENSE_FLAT_10_PCT.value;
  // Le plancher de 509 € ne peut pas dépasser le salaire lui-même.
  const professionalAllowance = roundMoney(
    Math.min(
      Math.min(
        Math.max(rawAllowance, IR_EXPENSE_ALLOWANCE_FLOOR_EUR.value),
        IR_EXPENSE_ALLOWANCE_CAP_EUR.value,
      ),
      Math.max(0, grossIncome),
    ),
  );
  const taxableAfterAllowance = roundMoney(
    Math.max(0, grossIncome - professionalAllowance) + otherTaxableIncome,
  );

  // Quotient familial : impôt avec les parts réelles, puis plafonné par
  // référence au foyer sans personne à charge (1 part seul, 2 parts en couple).
  const withParts = taxOneShare(roundMoney(taxableAfterAllowance / safeParts));
  const grossTaxDue = roundMoney(withParts.tax * safeParts);

  const baseParts = situation === 'couple' ? 2 : 1;
  let quotientCapAdjustment = 0;
  if (safeParts > baseParts) {
    const withoutDependants = taxOneShare(roundMoney(taxableAfterAllowance / baseParts));
    const referenceTax = roundMoney(withoutDependants.tax * baseParts);
    const advantage = roundMoney(referenceTax - grossTaxDue);
    const halfParts = (safeParts - baseParts) * 2;
    const cap = roundMoney(halfParts * QUOTIENT_FAMILIAL_CAP_PER_HALF_PART_EUR.value);
    if (advantage > cap) quotientCapAdjustment = roundMoney(advantage - cap);
  }
  const cappedTax = roundMoney(grossTaxDue + quotientCapAdjustment);

  // Décote : min(impôt, seuil − 45,25 % × impôt), jamais négative.
  const decoteThreshold = situation === 'couple'
    ? IR_DECOTE_COUPLE_EUR.value
    : IR_DECOTE_SINGLE_EUR.value;
  const decote = roundMoney(
    Math.min(cappedTax, Math.max(0, decoteThreshold - IR_DECOTE_SLOPE.value * cappedTax)),
  );
  const taxDue = roundMoney(Math.max(0, cappedTax - decote));

  return {
    grossIncome,
    professionalAllowance,
    taxableAfterAllowance,
    parts: safeParts,
    situation,
    grossTaxDue,
    quotientCapAdjustment,
    decote,
    taxDue,
    netAfterIr: roundMoney(grossIncome - taxDue),
    averageRate: taxableAfterAllowance > 0 ? taxDue / taxableAfterAllowance : 0,
    breakdown: withParts.breakdown,
    marginalRate: withParts.marginalRate,
  };
}

/**
 * Salaire brut le plus élevé qui laisse la TMI à `targetMarginalRate` sans
 * franchir la tranche suivante — inverse de `calculatePersonalIncomeTax`.
 *
 * Le plafond visé est le sommet de la tranche cible : on inverse l'abattement
 * de 10 %, qui est forfaitaire sous 145 550 € de brut puis plafonné à 14 555 €.
 * `otherTaxableIncome` (revenus du foyer hors salaire) occupe déjà le bas du
 * barème : il est retranché avant l'inversion, et peut ramener le plafond à 0.
 * Renvoie `Infinity` pour la dernière tranche, qui n'a pas de sommet.
 */
export function findMaxGrossSalaryForTargetTMI(
  targetMarginalRate: number,
  parts: number = 1,
  otherTaxableIncome: number = 0,
): number {
  const target = IR_2026_BRACKETS.value.find((b) => b.rate === targetMarginalRate);
  if (!target || target.upTo === Infinity) return Infinity;

  const safeParts = Math.max(0.5, parts);
  const maxTaxable = Math.max(0, target.upTo * safeParts - Math.max(0, otherTaxableIncome));
  if (maxTaxable === 0) return 0;
  const cap = IR_EXPENSE_ALLOWANCE_CAP_EUR.value;
  // Sous le plafond d'abattement : taxable = brut × 90 %.
  const flatAllowanceGross = maxTaxable / (1 - IR_EXPENSE_FLAT_10_PCT.value);
  const gross = flatAllowanceGross * IR_EXPENSE_FLAT_10_PCT.value <= cap
    ? flatAllowanceGross
    : maxTaxable + cap;
  return roundMoney(gross);
}

export interface ExecutiveSalaryResult {
  grossSalary: number;
  employerCharges: number;
  employeeCharges: number;
  totalCompanyCost: number;
  /**
   * Assiette de l'IR : brut − cotisations déductibles. La CSG non déductible
   * (2,4 pts) et la CRDS (0,5 pt) restent imposables, donc le net imposable est
   * supérieur au net à payer. C'est cette base, et non le net, qui entre au barème.
   */
  netImposable: number;
}

/**
 * Approximate président assimilé-salarié cost from desired net.
 * Flat model assumptions: employee charges 21 % and employer charges 39 % of gross.
 * These unverified aggregates are not a statutory payroll calculation.
 * Gross = net / (1 - employee rate); company cost = gross + employer charges.
 * Monetary components are rounded to cents.
 */
export function calculateExecutiveSalary(netDesired: number): ExecutiveSalaryResult {
  if (netDesired === 0) {
    return {
      grossSalary: 0,
      employerCharges: 0,
      employeeCharges: 0,
      totalCompanyCost: 0,
      netImposable: 0,
    };
  }

  const employeeRate = URSSAF_EMPLOYEE_RATE_2026.value;
  const employerRate = URSSAF_EMPLOYER_RATE_2026.value;
  const grossSalary = roundMoney(netDesired / (1 - employeeRate));
  const employeeCharges = roundMoney(grossSalary - netDesired);
  const employerCharges = roundMoney(grossSalary * employerRate);
  const totalCompanyCost = roundMoney(grossSalary + employerCharges);

  const netImposable = roundMoney(
    netDesired + grossSalary * SALARY_NON_DEDUCTIBLE_CSG_CRDS.value,
  );

  return {
    grossSalary,
    employerCharges,
    employeeCharges,
    totalCompanyCost,
    netImposable,
  };
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

/* ------------------------------------------------------------------------ *
 * Régimes ajoutés le 2026-09-20 : arbitrage PFU / barème, TNS, micro, SCI IR.
 * ------------------------------------------------------------------------ */

export type DividendTaxMode = 'pfu' | 'bareme';

export interface DividendTaxResult {
  mode: DividendTaxMode;
  grossDividend: number;
  /** Assiette retenue à l'IR (brut sous PFU, brut − 40 % − CSG déd. au barème). */
  taxableBase: number;
  irPart: number;
  psPart: number;
  totalTax: number;
  netIncome: number;
  /** totalTax / grossDividend. */
  effectiveRate: number;
  breakdown: TaxBreakdownLine[];
}

/**
 * Imposition d'un dividende, au PFU ou sur option globale au barème.
 *
 * - **PFU** (CGI art. 200 A) : 12,8 % IR + prélèvements sociaux, sans abattement.
 * - **Barème** (option globale, CGI art. 200 A, 2) : abattement de 40 %
 *   (art. 158, 3-2°), CSG déductible à hauteur de 6,8 points (art. 154 quinquies II),
 *   puis barème progressif. Les prélèvements sociaux restent dus sur le brut.
 *
 * Approximation assumée : la fraction imposable est taxée à plat au taux
 * marginal `marginalRate`. Un dividende qui chevauche deux tranches est donc
 * légèrement surestimé. L'option barème est globale et irrévocable pour
 * l'année : elle s'applique à tous les revenus de capitaux mobiliers du foyer,
 * ce que ce calcul isolé ne vérifie pas.
 */
export function calculateDividendTax(
  grossDividend: number,
  mode: DividendTaxMode,
  marginalRate: number = 0,
): DividendTaxResult {
  const psPart = roundMoney(grossDividend * PFU_PS_RATE.value);

  if (mode === 'pfu') {
    const irPart = roundMoney(grossDividend * PFU_IR_RATE.value);
    const totalTax = roundMoney(irPart + psPart);
    return {
      mode,
      grossDividend,
      taxableBase: grossDividend,
      irPart,
      psPart,
      totalTax,
      netIncome: roundMoney(grossDividend - totalTax),
      effectiveRate: grossDividend > 0 ? totalTax / grossDividend : 0,
      breakdown: [
        { label: 'PFU IR 12,8 %', amount: irPart, rate: PFU_IR_RATE },
        { label: 'Prélèvements sociaux', amount: psPart, rate: PFU_PS_RATE },
      ],
    };
  }

  const allowance = roundMoney(grossDividend * DIVIDEND_BAREME_ALLOWANCE.value);
  const csgDeductible = roundMoney(grossDividend * CSG_DEDUCTIBLE_POINTS.value);
  const taxableBase = roundMoney(Math.max(0, grossDividend - allowance - csgDeductible));
  const irPart = roundMoney(taxableBase * marginalRate);
  const totalTax = roundMoney(irPart + psPart);

  return {
    mode,
    grossDividend,
    taxableBase,
    irPart,
    psPart,
    totalTax,
    netIncome: roundMoney(grossDividend - totalTax),
    effectiveRate: grossDividend > 0 ? totalTax / grossDividend : 0,
    breakdown: [
      { label: 'Abattement 40 %', amount: -allowance, rate: DIVIDEND_BAREME_ALLOWANCE },
      { label: 'CSG déductible 6,8 pts', amount: -csgDeductible, rate: CSG_DEDUCTIBLE_POINTS },
      {
        label: `IR au barème (TMI ${Math.round(marginalRate * 100)} %)`,
        amount: irPart,
        formula: `${taxableBase} € × ${Math.round(marginalRate * 100)} %`,
      },
      { label: 'Prélèvements sociaux', amount: psPart, rate: PFU_PS_RATE },
    ],
  };
}

export interface DividendArbitrage {
  pfu: DividendTaxResult;
  bareme: DividendTaxResult;
  best: DividendTaxResult;
  /** Gain en € du meilleur régime sur l'autre. */
  gain: number;
}

/**
 * Compare PFU et option barème à TMI donnée et renvoie le moins coûteux.
 * En cas d'égalité stricte, le PFU l'emporte : il n'engage pas les autres
 * revenus de capitaux mobiliers du foyer.
 */
export function compareDividendTaxModes(
  grossDividend: number,
  marginalRate: number,
): DividendArbitrage {
  const pfu = calculateDividendTax(grossDividend, 'pfu');
  const bareme = calculateDividendTax(grossDividend, 'bareme', marginalRate);
  const best = bareme.totalTax < pfu.totalTax ? bareme : pfu;
  return {
    pfu,
    bareme,
    best,
    gain: roundMoney(Math.abs(pfu.totalTax - bareme.totalTax)),
  };
}

export interface TnsContributionsResult {
  /** Revenu super-brut soumis (€), avant abattement. */
  base: number;
  /** Assiette après abattement de 26 % (bornée), commune aux cotisations et à la CSG. */
  assiette: number;
  contributions: number;
  netAfterContributions: number;
  breakdown: Array<{ label: string; amount: number }>;
}

/** Taux maladie pour une assiette donnée : interpolation linéaire entre paliers (CSS D621-2). */
function tnsMaladieRate(assiette: number, pass: number): number {
  const steps = TNS_MALADIE_STEPS.value;
  const x = assiette / pass;
  if (x <= steps[0]!.atPass) return 0;
  for (let i = 1; i < steps.length; i++) {
    const prev = steps[i - 1]!;
    const next = steps[i]!;
    if (x <= next.atPass) return prev.rate + (next.rate - prev.rate) * (x - prev.atPass) / (next.atPass - prev.atPass);
  }
  return steps[steps.length - 1]!.rate;
}

/**
 * Cotisations et contributions d'un travailleur indépendant (gérant majoritaire
 * SARL/EURL à l'IS, EI ou EURL au réel) selon la méthode en vigueur depuis 2025 :
 * assiette unique = revenu super-brut − 26 % (plancher / plafond), puis barème par
 * branche sur cette assiette (maladie dégressive, IJ, retraite de base plafonnée
 * et déplafonnée, RCI, invalidité-décès, allocations familiales, CSG-CRDS,
 * formation). Voir tnsRules.ts pour chaque source.
 */
export function calculateTnsContributions(revenuProfessionnel: number): TnsContributionsResult {
  const base = roundMoney(Math.max(0, revenuProfessionnel));
  const pass = PASS_2026_EUR.value;
  const abattement = Math.min(Math.max(base * TNS_ASSIETTE_ABATTEMENT.value, TNS_ABATTEMENT_FLOOR_EUR.value), TNS_ABATTEMENT_CEILING_EUR.value);
  const assiette = roundMoney(Math.max(0, base - abattement));
  if (base === 0) return { base, assiette: 0, contributions: 0, netAfterContributions: 0, breakdown: [] };

  const under = (k: number) => Math.min(assiette, k * pass);
  const between = (from: number, to: number) => Math.max(0, Math.min(assiette, to * pass) - from * pass);
  const maladie = tnsMaladieRate(assiette, pass) * under(3) + TNS_MALADIE_ABOVE_3_PASS.value * Math.max(0, assiette - 3 * pass);
  const ij = TNS_IJ_RATE.value * under(TNS_IJ_CEILING_PASS);
  const retraiteBase = TNS_RETRAITE_BASE_PLAFONNEE.value * under(1) + TNS_RETRAITE_BASE_DEPLAFONNEE.value * assiette;
  const rci = TNS_RCI_T1.value * under(1) + TNS_RCI_T2.value * between(1, TNS_RCI_CEILING_PASS);
  const invalidite = TNS_INVALIDITE_DECES_RATE.value * Math.max(under(1), TNS_INVALIDITE_DECES_FLOOR_PASS.value * pass);
  const afSpan = (TNS_AF_FULL_PASS - TNS_AF_START_PASS) * pass;
  const afRate = TNS_AF_MAX_RATE.value * Math.min(1, Math.max(0, assiette - TNS_AF_START_PASS * pass) / afSpan);
  const af = afRate * assiette;
  const csg = TNS_CSG_CRDS_RATE.value * assiette;
  const formation = TNS_FORMATION_RATE_OF_PASS.value * pass;
  const breakdown = [
    { label: 'Maladie-maternité (dégressive)', amount: roundMoney(maladie) },
    { label: 'Indemnités journalières', amount: roundMoney(ij) },
    { label: 'Retraite de base', amount: roundMoney(retraiteBase) },
    { label: 'Retraite complémentaire (RCI)', amount: roundMoney(rci) },
    { label: 'Invalidité-décès', amount: roundMoney(invalidite) },
    { label: 'Allocations familiales', amount: roundMoney(af) },
    { label: 'CSG-CRDS', amount: roundMoney(csg) },
    { label: 'Formation professionnelle', amount: roundMoney(formation) },
  ];
  const contributions = roundMoney(breakdown.reduce((sum, line) => sum + line.amount, 0));
  return { base, assiette, contributions, netAfterContributions: roundMoney(base - contributions), breakdown };
}

/**
 * Revenu super-brut dont le net après cotisations vaut `netDesired` (bissection :
 * les cotisations sont croissantes en fonction du brut).
 */
export function tnsGrossForNet(netDesired: number): TnsContributionsResult {
  if (netDesired <= 0) return calculateTnsContributions(0);
  let low = netDesired;
  let high = netDesired * 2;
  while (calculateTnsContributions(high).netAfterContributions < netDesired) high *= 2;
  for (let i = 0; i < 60 && high - low > 0.005; i++) {
    const mid = (low + high) / 2;
    if (calculateTnsContributions(mid).netAfterContributions < netDesired) low = mid; else high = mid;
  }
  return calculateTnsContributions(roundMoney(high));
}

export interface TnsDividendSurchargeResult {
  /** Fraction exonérée = 10 % du capital, primes et CCA. */
  exemptThreshold: number;
  /** Part du dividende assujettie aux cotisations SSI. */
  subjectToContributions: number;
  contributions: number;
}

/**
 * Règle des 10 % (CSS art. L136-3, II-2°) : pour un gérant majoritaire, la part
 * des dividendes excédant 10 % du capital social, des primes d'émission et des
 * sommes versées en compte courant d'associé entre dans l'assiette des
 * cotisations sociales. Le surcoût est marginal : cotisations(rémunération +
 * part assujettie) − cotisations(rémunération).
 */
export function calculateTnsDividendSurcharge(
  grossDividend: number,
  capitalPrimesAndCca: number,
  baseRevenue = 0,
): TnsDividendSurchargeResult {
  const exemptThreshold = roundMoney(
    Math.max(0, capitalPrimesAndCca) * TNS_DIVIDEND_EXEMPT_CAPITAL_SHARE.value,
  );
  const subjectToContributions = roundMoney(
    Math.max(0, grossDividend - exemptThreshold),
  );
  const contributions = roundMoney(
    calculateTnsContributions(baseRevenue + subjectToContributions).contributions
      - calculateTnsContributions(baseRevenue).contributions,
  );
  return { exemptThreshold, subjectToContributions, contributions };
}

export interface MicroEnterpriseResult {
  category: MicroCategory;
  revenue: number;
  /** Abattement forfaitaire pour frais, plancher 305 € (CGI art. 50-0 / 102 ter). */
  allowance: number;
  /** Bénéfice imposable = CA − abattement. Aucune charge réelle n'est déductible. */
  taxableProfit: number;
  socialContributions: number;
  /** CA − cotisations. L'IR reste à calculer sur `taxableProfit`. */
  cashBeforeIr: number;
  ceilingEur: number;
  ceilingExceeded: boolean;
}

/**
 * Régime micro (CGI art. 50-0 pour les BIC, 102 ter pour les BNC).
 *
 * L'abattement forfaitaire remplace toute déduction de charges réelles : un
 * micro-entrepreneur fortement chargé y perd. Les cotisations sont assises sur
 * le CA brut, pas sur le bénéfice — elles restent dues à perte.
 *
 * Hors modèle : versement libératoire de l'IR (option sous condition de RFR),
 * ACRE, TVA en franchise en base, et le maintien du régime l'année du
 * dépassement du seuil.
 */
export function calculateMicroEnterprise(
  revenue: number,
  category: MicroCategory,
): MicroEnterpriseResult {
  const bracket = MICRO_BRACKETS_2026[category];
  const safeRevenue = Math.max(0, revenue);
  const rawAllowance = safeRevenue * bracket.allowance;
  const allowance = roundMoney(
    Math.min(Math.max(rawAllowance, MICRO_ALLOWANCE_FLOOR_EUR.value), safeRevenue),
  );
  const socialContributions = roundMoney(safeRevenue * bracket.socialRate);

  return {
    category,
    revenue: roundMoney(safeRevenue),
    allowance,
    taxableProfit: roundMoney(Math.max(0, safeRevenue - allowance)),
    socialContributions,
    cashBeforeIr: roundMoney(safeRevenue - socialContributions),
    ceilingEur: bracket.ceilingEur,
    ceilingExceeded: safeRevenue > bracket.ceilingEur,
  };
}

export interface SciIrResult {
  /** Revenu foncier net = loyers − intérêts − charges. Pas d'amortissement. */
  taxableIncome: number;
  socialLevies: number;
  incomeTax: number;
  cashFlowNet: number;
}

/**
 * SCI à l'IR : la société est transparente, le résultat foncier est imposé
 * chez l'associé à sa TMI, majoré des prélèvements sociaux.
 *
 * L'écart décisif avec la SCI à l'IS : **le bâti ne s'amortit pas**. Le revenu
 * imposable est donc bien plus élevé à cash identique, ce qui inverse souvent
 * l'arbitrage IS/IR sur l'immobilier locatif.
 *
 * Hors modèle : micro-foncier (CGI art. 32), imputation des déficits fonciers
 * sur le revenu global (plafond 10 700 €), et la quote-part par associé — le
 * résultat est ici imputé en totalité au foyer considéré.
 */
export function calculateSciIrIncome(
  rentalIncomeHt: number,
  interestExpenses: number,
  otherCharges: number,
  marginalRate: number,
): SciIrResult {
  const taxableIncome = roundMoney(rentalIncomeHt - interestExpenses - otherCharges);
  const positiveIncome = Math.max(0, taxableIncome);
  const socialLevies = roundMoney(positiveIncome * PFU_PS_RATE.value);
  const incomeTax = roundMoney(positiveIncome * marginalRate);

  return {
    taxableIncome,
    socialLevies,
    incomeTax,
    cashFlowNet: roundMoney(taxableIncome - socialLevies - incomeTax),
  };
}

/* ------------------------------------------------------------------------ *
 * Exhaustivité des montages — P1 à P8.
 * Fonctions pures : aucune ne lit le graphe, toutes sont testables seules.
 * ------------------------------------------------------------------------ */

/** Barème progressif générique : `upTo` est la borne haute de la tranche. */
function progressive(base: number, brackets: readonly TaxBracket[], label: (rate: number) => string): { total: number; lines: TaxBreakdownLine[] } {
  let previous = 0;
  let total = 0;
  const lines: TaxBreakdownLine[] = [];
  for (const bracket of brackets) {
    const slice = Math.max(0, Math.min(base, bracket.upTo) - previous);
    if (slice > 0 && bracket.rate > 0) {
      const amount = roundMoney(slice * bracket.rate);
      total += amount;
      lines.push({ label: label(bracket.rate), amount, formula: `${roundMoney(slice)} € × ${bracket.rate * 100} %` });
    }
    previous = bracket.upTo;
    if (base <= bracket.upTo) break;
  }
  return { total: roundMoney(total), lines };
}

/* ---- P1 : report déficitaire (CGI art. 209, I) ---------------------------- */

export interface DeficitImputation {
  /** Déficit antérieur effectivement imputé sur l'exercice. */
  imputed: number;
  /** Résultat imposable après imputation (jamais négatif). */
  taxableAfter: number;
  /** Stock de déficit reporté à l'exercice suivant. */
  stockAfter: number;
  /** Fraction du stock bloquée par le plafond de l'exercice. */
  cappedBy: number;
}

/**
 * Impute un stock de déficit reportable sur le bénéfice d'un exercice.
 * Plafond de l'art. 209, I : 1 000 000 € + 50 % de la fraction du bénéfice
 * excédant ce montant. Un exercice déficitaire alimente le stock.
 */
export function imputeCarriedDeficit(taxableBefore: number, stockBefore: number): DeficitImputation {
  const stock = Math.max(0, stockBefore);
  if (taxableBefore <= 0) {
    return { imputed: 0, taxableAfter: 0, stockAfter: roundMoney(stock - taxableBefore), cappedBy: 0 };
  }
  const cap = DEFICIT_CARRYFORWARD_CAP_EUR.value
    + Math.max(0, taxableBefore - DEFICIT_CARRYFORWARD_CAP_EUR.value) * DEFICIT_CARRYFORWARD_MARGINAL_SHARE.value;
  const imputed = roundMoney(Math.min(stock, cap, taxableBefore));
  return {
    imputed,
    taxableAfter: roundMoney(taxableBefore - imputed),
    stockAfter: roundMoney(stock - imputed),
    cappedBy: roundMoney(Math.max(0, Math.min(stock, taxableBefore) - imputed)),
  };
}

/* ---- P2 : emprunt (échéancier) -------------------------------------------- */

export type LoanKind = 'amortissable' | 'in_fine';

export interface LoanTerms {
  principal: number;
  /** Taux annuel (0,03 = 3 %). */
  rate: number;
  years: number;
  type: LoanKind;
}

export interface LoanInstallment {
  /** Rang de l'échéance, 0 pour la première. */
  index: number;
  opening: number;
  payment: number;
  interest: number;
  principalRepaid: number;
  closing: number;
}

/** Annuité constante d'un prêt amortissable (formule standard). */
export function loanAnnuity(terms: LoanTerms): number {
  if (terms.years <= 0) return 0;
  if (terms.type === 'in_fine') return roundMoney(terms.principal * terms.rate);
  if (terms.rate === 0) return roundMoney(terms.principal / terms.years);
  const factor = terms.rate / (1 - (1 + terms.rate) ** -terms.years);
  return roundMoney(terms.principal * factor);
}

/**
 * Échéance d'un exercice à partir du capital restant dû à l'ouverture.
 * Seuls les intérêts sont déductibles ; le capital est un mouvement de trésorerie.
 */
export function loanInstallment(terms: LoanTerms, opening: number, index: number): LoanInstallment {
  const outstanding = Math.max(0, opening);
  if (outstanding === 0 || index >= terms.years) {
    return { index, opening: outstanding, payment: 0, interest: 0, principalRepaid: 0, closing: outstanding };
  }
  const interest = roundMoney(outstanding * terms.rate);
  const last = index === terms.years - 1;
  const principalRepaid = terms.type === 'in_fine'
    ? (last ? outstanding : 0)
    : roundMoney(Math.min(outstanding, last ? outstanding : loanAnnuity(terms) - interest));
  return {
    index,
    opening: outstanding,
    payment: roundMoney(interest + principalRepaid),
    interest,
    principalRepaid,
    closing: roundMoney(outstanding - principalRepaid),
  };
}

/** Tableau d'amortissement complet — capital restant dû nul au terme. */
export function loanSchedule(terms: LoanTerms): LoanInstallment[] {
  const rows: LoanInstallment[] = [];
  let outstanding = terms.principal;
  for (let index = 0; index < terms.years; index += 1) {
    const row = loanInstallment(terms, outstanding, index);
    rows.push(row);
    outstanding = row.closing;
  }
  return rows;
}

/* ---- P3 : cession de titres ----------------------------------------------- */

export interface ShareSaleTaxResult {
  salePrice: number;
  grossGain: number;
  /** Abattement fixe dirigeant partant à la retraite (art. 150-0 D ter). */
  fixedAllowance: number;
  /** Abattement pour durée de détention (art. 150-0 D), option barème seulement. */
  durationAllowance: number;
  taxableBase: number;
  irPart: number;
  psPart: number;
  totalTax: number;
  netProceeds: number;
  breakdown: TaxBreakdownLine[];
}

export interface ShareSalePersonOptions {
  mode: DividendTaxMode;
  marginalRate?: number;
  /** Durée de détention en années à la date de cession. */
  holdingYears?: number;
  /** Année d'acquisition : conditionne l'abattement pour durée de détention. */
  acquisitionYear?: number;
  /** Abattement fixe de 500 000 € (dirigeant partant à la retraite). */
  retirementAllowance?: boolean;
}

/**
 * Cession de titres par une personne physique (CGI art. 150-0 A).
 *
 * PFU 12,8 % + prélèvements sociaux, ou barème sur option globale. Les
 * abattements pour durée de détention (50 % / 65 %) ne s'appliquent qu'aux
 * titres **acquis avant le 1ᵉʳ janvier 2018** et à la seule option barème
 * (art. 150-0 D, 1 ter-B) : c'est le piège que l'app doit montrer, pas masquer.
 * Les prélèvements sociaux restent dus sur la plus-value avant abattement de durée.
 */
export function calculateShareSaleTaxPerson(
  salePrice: number,
  acquisitionPrice: number,
  options: ShareSalePersonOptions,
): ShareSaleTaxResult {
  const grossGain = roundMoney(Math.max(0, salePrice - acquisitionPrice));
  const fixedAllowance = options.retirementAllowance
    ? roundMoney(Math.min(grossGain, RETIREMENT_FIXED_ALLOWANCE_EUR.value))
    : 0;
  const afterFixed = roundMoney(grossGain - fixedAllowance);
  const eligibleForDuration = options.mode === 'bareme'
    && options.acquisitionYear !== undefined
    && options.acquisitionYear < SHARE_SALE_ALLOWANCE_ACQUISITION_CUTOFF_YEAR.value
    && (options.holdingYears ?? 0) >= 2;
  const durationRate = !eligibleForDuration
    ? 0
    : (options.holdingYears ?? 0) >= 8 ? SHARE_SALE_ALLOWANCE_OVER_8.value : SHARE_SALE_ALLOWANCE_2_TO_8.value;
  const durationAllowance = roundMoney(afterFixed * durationRate);
  const taxableBase = roundMoney(afterFixed - durationAllowance);
  const psPart = roundMoney(afterFixed * PFU_PS_RATE.value);
  const irPart = options.mode === 'pfu'
    ? roundMoney(afterFixed * PFU_IR_RATE.value)
    : roundMoney(taxableBase * (options.marginalRate ?? 0));
  const totalTax = roundMoney(irPart + psPart);
  const breakdown: TaxBreakdownLine[] = [
    { label: 'Plus-value brute', amount: grossGain, formula: 'prix de cession − prix d’acquisition' },
    ...(fixedAllowance ? [{ label: 'Abattement fixe dirigeant retraite', amount: -fixedAllowance, rate: RETIREMENT_FIXED_ALLOWANCE_EUR }] : []),
    ...(durationAllowance ? [{ label: `Abattement pour durée de détention ${durationRate * 100} %`, amount: -durationAllowance, rate: durationRate >= 0.65 ? SHARE_SALE_ALLOWANCE_OVER_8 : SHARE_SALE_ALLOWANCE_2_TO_8 }] : []),
    options.mode === 'pfu'
      ? { label: 'PFU IR 12,8 %', amount: irPart, rate: PFU_IR_RATE }
      : { label: `IR au barème (TMI ${Math.round((options.marginalRate ?? 0) * 100)} %)`, amount: irPart },
    { label: 'Prélèvements sociaux', amount: psPart, rate: PFU_PS_RATE },
  ];
  return {
    salePrice,
    grossGain,
    fixedAllowance,
    durationAllowance,
    taxableBase,
    irPart,
    psPart,
    totalTax,
    netProceeds: roundMoney(salePrice - totalTax),
    breakdown,
  };
}

export interface ShareSaleCompanyResult {
  salePrice: number;
  grossGain: number;
  /** `true` si le régime des titres de participation s'applique. */
  participationRegime: boolean;
  /** Quote-part de frais et charges de 12 % réintégrée au résultat. */
  qpfc: number;
  /** Montant ajouté au résultat imposable de l'exercice. */
  taxableAddition: number;
  breakdown: TaxBreakdownLine[];
}

/**
 * Cession de titres par une société à l'IS.
 *
 * Titres de participation détenus ≥ 2 ans et ≥ 5 % : taux de 0 %, seule une
 * quote-part de frais et charges de **12 % de la plus-value brute** entre dans
 * le résultat imposable (art. 219, I-a quinquies). Sinon, plus-value au taux normal.
 */
export function calculateShareSaleTaxCompany(
  salePrice: number,
  acquisitionPrice: number,
  options: { holdingYears?: number; stakePercent?: number } = {},
): ShareSaleCompanyResult {
  const grossGain = roundMoney(Math.max(0, salePrice - acquisitionPrice));
  const participationRegime = (options.holdingYears ?? 0) >= PARTICIPATION_MIN_HOLDING_YEARS.value
    && (options.stakePercent ?? 0) >= PARTICIPATION_MIN_HOLDING_PCT.value * 100;
  const qpfc = participationRegime ? roundMoney(grossGain * PARTICIPATION_QPFC_RATE.value) : 0;
  return {
    salePrice,
    grossGain,
    participationRegime,
    qpfc,
    taxableAddition: participationRegime ? qpfc : grossGain,
    breakdown: participationRegime
      ? [
          { label: 'Plus-value à long terme exonérée', amount: grossGain, formula: 'taux 0 % — CGI art. 219, I-a quinquies' },
          { label: 'Quote-part de frais et charges 12 %', amount: qpfc, rate: PARTICIPATION_QPFC_RATE },
        ]
      : [{ label: 'Plus-value au résultat imposable (taux normal)', amount: grossGain, formula: 'titres hors régime de participation' }],
  };
}

/* ---- P4 : apport-cession 150-0 B ter --------------------------------------- */

/** Intérêt de retard de l'art. 1727 sur `months` mois de report. */
export function lateInterest(amount: number, months: number): number {
  return roundMoney(Math.max(0, amount) * Math.max(0, months) * LATE_INTEREST_MONTHLY_RATE.value);
}

/* ---- P5 : démembrement (CGI art. 669) -------------------------------------- */

/**
 * Quotité d'usufruit (0 → 1). Usufruit à durée fixe : 23 % par période de dix
 * ans **entamée**, plafonné à la valeur de l'usufruit viager du même âge quand
 * l'âge est connu. Usufruit viager : barème par tranche d'âge.
 */
export function usufructShare(input: { durationYears?: number; age?: number }): number {
  const viager = input.age === undefined
    ? undefined
    : USUFRUIT_VIAGER_BAREME.value.find((bracket) => input.age! < bracket.upTo)?.rate ?? 0.1;
  if (input.durationYears === undefined || input.durationYears <= 0) return viager ?? 0;
  const temporaire = Math.min(1, Math.ceil(input.durationYears / 10) * USUFRUIT_TEMPORAIRE_SHARE_PER_DECADE.value);
  return viager === undefined ? temporaire : Math.min(temporaire, viager);
}

/** Quotité de nue-propriété, complément de `usufructShare`. */
export function bareOwnershipShare(input: { durationYears?: number; age?: number }): number {
  return roundMoney(1 - usufructShare(input));
}

/* ---- P6 : IFI (CGI art. 964 à 977) ----------------------------------------- */

export interface IfiResult {
  netTaxable: number;
  taxable: boolean;
  grossDuty: number;
  decote: number;
  due: number;
  breakdown: TaxBreakdownLine[];
}

/** IFI sur une assiette nette : seuil d'assujettissement 1 300 000 €, puis barème et décote. */
export function calculateIfi(netTaxable: number): IfiResult {
  const base = Math.max(0, netTaxable);
  if (base <= IFI_THRESHOLD_EUR.value) {
    return {
      netTaxable: roundMoney(base), taxable: false, grossDuty: 0, decote: 0, due: 0,
      breakdown: [{ label: 'Patrimoine immobilier net sous le seuil d’assujettissement', amount: roundMoney(base), rate: IFI_THRESHOLD_EUR }],
    };
  }
  const { total, lines } = progressive(base, IFI_BRACKETS.value, (rate) => `IFI ${(rate * 100).toLocaleString('fr-FR')} %`);
  const decote = base < 1_400_000
    ? roundMoney(Math.max(0, IFI_DECOTE_BASE_EUR.value - IFI_DECOTE_SLOPE.value * base))
    : 0;
  return {
    netTaxable: roundMoney(base),
    taxable: true,
    grossDuty: total,
    decote,
    due: roundMoney(Math.max(0, total - decote)),
    breakdown: [...lines, ...(decote ? [{ label: 'Décote', amount: -decote, rate: IFI_DECOTE_BASE_EUR }] : [])],
  };
}

/* ---- P7 : donation et pacte Dutreil ---------------------------------------- */

export interface GiftTaxResult {
  grossValue: number;
  /** Valeur retenue après réserve d'usufruit (assiette = nue-propriété). */
  transferredValue: number;
  dutreilExemption: number;
  abatement: number;
  taxableBase: number;
  duties: number;
  netTransferred: number;
  breakdown: TaxBreakdownLine[];
}

export interface GiftOptions {
  /** Exonération de 75 % (art. 787 B) : conditions à vérifier, jamais supposées. */
  dutreil?: boolean;
  /** Donation avec réserve d'usufruit : seule la nue-propriété est transmise. */
  reserveUsufruit?: { age?: number; durationYears?: number };
  /** Abattement déjà consommé sur les 15 dernières années (art. 784). */
  previousAbatementUsed?: number;
}

/**
 * Donation en ligne directe : réserve d'usufruit (art. 669) → exonération
 * Dutreil de 75 % (art. 787 B) → abattement de 100 000 € par parent et par
 * enfant, renouvelable 15 ans (art. 779, 784) → barème de l'art. 777, tableau I.
 * Chaque étape est traçable à son article dans le détail.
 */
export function calculateGiftTax(value: number, options: GiftOptions = {}): GiftTaxResult {
  const grossValue = roundMoney(Math.max(0, value));
  const bareShare = options.reserveUsufruit ? bareOwnershipShare(options.reserveUsufruit) : 1;
  const transferredValue = roundMoney(grossValue * bareShare);
  const dutreilExemption = options.dutreil ? roundMoney(transferredValue * DUTREIL_EXEMPTION_RATE.value) : 0;
  const afterDutreil = roundMoney(transferredValue - dutreilExemption);
  const abatement = roundMoney(Math.min(
    afterDutreil,
    Math.max(0, DMTG_DIRECT_LINE_ABATEMENT_EUR.value - Math.max(0, options.previousAbatementUsed ?? 0)),
  ));
  const taxableBase = roundMoney(afterDutreil - abatement);
  const { total, lines } = progressive(taxableBase, DMTG_DIRECT_LINE_BRACKETS.value, (rate) => `DMTG ${rate * 100} %`);
  return {
    grossValue,
    transferredValue,
    dutreilExemption,
    abatement,
    taxableBase,
    duties: total,
    netTransferred: roundMoney(transferredValue - total),
    breakdown: [
      { label: 'Valeur des titres donnés', amount: grossValue },
      ...(bareShare < 1 ? [{ label: `Réserve d’usufruit : assiette = nue-propriété (${Math.round(bareShare * 100)} %)`, amount: transferredValue, formula: 'CGI art. 669' }] : []),
      ...(dutreilExemption ? [{ label: 'Exonération Dutreil 75 %', amount: -dutreilExemption, rate: DUTREIL_EXEMPTION_RATE }] : []),
      { label: 'Abattement en ligne directe', amount: -abatement, rate: DMTG_DIRECT_LINE_ABATEMENT_EUR },
      ...lines,
    ],
  };
}

/* ---- P8 : location meublée au réel ----------------------------------------- */

export interface RentalAmortizationResult {
  /** Dotation effectivement déduite de l'exercice. */
  deducted: number;
  /** Fraction non déduite, reportée sans limite de temps (art. 39 C, II-3). */
  carriedForward: number;
  /** Plafond de l'exercice : loyers acquis − autres charges. */
  cap: number;
}

/**
 * Amortissement d'un bien loué meublé : non créateur de déficit. La dotation
 * est déduite dans la limite du loyer diminué des autres charges afférentes au
 * bien (CGI art. 39 C, II-2), l'excédent étant reporté (II-3).
 */
export function cappedRentalAmortization(
  amortization: number,
  rent: number,
  otherCharges: number,
  carriedIn = 0,
): RentalAmortizationResult {
  const cap = roundMoney(Math.max(0, rent - otherCharges));
  const available = roundMoney(Math.max(0, amortization) + Math.max(0, carriedIn));
  const deducted = roundMoney(Math.min(available, cap));
  return { deducted, carriedForward: roundMoney(available - deducted), cap };
}

/** Frontière LMNP / LMP : recettes > 23 000 € **et** supérieures aux autres revenus. */
export function isProfessionalFurnishedRental(receipts: number, otherProfessionalIncome: number): boolean {
  return receipts > LMP_RECEIPTS_THRESHOLD_EUR.value && receipts > otherProfessionalIncome;
}

/* ------------------------------------------------------------------------ *
 * Lot 2026 — fonctions pures : CDHR, taxe holdings, Charasse, PER, mécénat,
 * plus-value immobilière des particuliers.
 * ------------------------------------------------------------------------ */

/* ---- Contribution différentielle sur les hauts revenus (CGI art. 224) ----- */

export interface CdhrResult {
  /** Revenu retenu (assimilé au revenu fiscal de référence de l'art. 1417). */
  referenceIncome: number;
  liable: boolean;
  /** 20 % du revenu de référence, avant lissage. */
  floorTax: number;
  /** Atténuation de l'entrée dans la contribution (art. 224, V). */
  smoothing: number;
  /** Impositions déjà acquittées, majorées des abattements forfaitaires. */
  creditedTax: number;
  due: number;
  breakdown: TaxBreakdownLine[];
}

/**
 * Contribution différentielle des hauts revenus (CGI art. 224), applicable à
 * compter de l'imposition des revenus 2026.
 *
 * Elle garantit un taux d'imposition minimal de 20 % : on compare 20 % du
 * revenu de référence à l'impôt déjà dû, majoré de 1 500 € par personne à
 * charge et de 12 500 € pour un couple. La différence positive est due.
 * Un lissage atténue l'entrée dans le dispositif jusqu'à 330 000 € (660 000 €
 * pour un couple).
 */
export function calculateCdhr(
  referenceIncome: number,
  paidTax: number,
  options: { situation?: FiscalSituation; dependents?: number } = {},
): CdhrResult {
  const couple = options.situation === 'couple';
  const income = Math.max(0, referenceIncome);
  const threshold = couple ? CDHR_THRESHOLD_COUPLE_EUR.value : CDHR_THRESHOLD_SINGLE_EUR.value;
  const ceiling = couple ? CDHR_SMOOTHING_CEILING_COUPLE_EUR.value : CDHR_SMOOTHING_CEILING_SINGLE_EUR.value;
  if (income <= threshold) {
    return {
      referenceIncome: roundMoney(income), liable: false, floorTax: 0, smoothing: 0,
      creditedTax: roundMoney(paidTax), due: 0,
      breakdown: [{ label: 'Revenu sous le seuil de la contribution', amount: roundMoney(income), rate: couple ? CDHR_THRESHOLD_COUPLE_EUR : CDHR_THRESHOLD_SINGLE_EUR }],
    };
  }
  const floorTax = roundMoney(income * CDHR_RATE.value);
  // Art. 224, V : sous le plafond de lissage, on retranche l'excédent sur 82,5 % du dépassement.
  const smoothing = income <= ceiling
    ? roundMoney(Math.max(0, floorTax - CDHR_SMOOTHING_SLOPE.value * (income - threshold)))
    : 0;
  const creditedTax = roundMoney(Math.max(0, paidTax)
    + (options.dependents ?? 0) * CDHR_ALLOWANCE_PER_DEPENDENT_EUR.value
    + (couple ? CDHR_ALLOWANCE_COUPLE_EUR.value : 0));
  const due = roundMoney(Math.max(0, floorTax - smoothing - creditedTax));
  return {
    referenceIncome: roundMoney(income),
    liable: true,
    floorTax,
    smoothing,
    creditedTax,
    due,
    breakdown: [
      { label: 'Imposition minimale 20 % du revenu de référence', amount: floorTax, rate: CDHR_RATE },
      ...(smoothing ? [{ label: 'Lissage d’entrée dans la contribution', amount: -smoothing, rate: CDHR_SMOOTHING_SLOPE }] : []),
      { label: 'Impôt déjà dû et abattements forfaitaires', amount: -creditedTax },
      { label: 'Contribution différentielle due', amount: due, formula: 'CGI art. 224' },
    ],
  };
}

/* ---- Taxe sur les actifs non professionnels des holdings (art. 235 ter C) - */

export interface HoldingAssetTaxResult {
  /** Les trois conditions cumulatives de l'art. 235 ter C, I-A. */
  assetsOverThreshold: boolean;
  controlledByIndividual: boolean;
  passiveIncomeMajority: boolean;
  liable: boolean;
  /** Assiette : actifs non professionnels, nets des dettes retenues. */
  taxableAssets: number;
  due: number;
  breakdown: TaxBreakdownLine[];
}

/**
 * Taxe de 20 % sur les actifs non affectés à une activité opérationnelle des
 * holdings patrimoniales (CGI art. 235 ter C), due au titre des exercices clos
 * à compter du 31 décembre 2026.
 *
 * Trois conditions cumulatives : actifs ≥ 5 M€, une personne physique détenant
 * ≥ 50 % des droits, et des revenus passifs (dividendes, intérêts, loyers,
 * redevances) représentant plus de la moitié des produits de l'exercice.
 */
export function calculateHoldingAssetTax(input: {
  totalAssets: number;
  nonProfessionalAssets: number;
  /** Dettes d'acquisition retenues en déduction (art. 235 ter C, II-A-7°). */
  deductibleDebt?: number;
  individualControlPercent: number;
  passiveIncome: number;
  totalIncome: number;
}): HoldingAssetTaxResult {
  const assetsOverThreshold = input.totalAssets >= HOLDING_ASSET_TAX_THRESHOLD_EUR.value;
  const controlledByIndividual = input.individualControlPercent >= HOLDING_ASSET_TAX_CONTROL_PCT.value * 100;
  const passiveIncomeMajority = input.totalIncome > 0
    && input.passiveIncome / input.totalIncome > HOLDING_ASSET_TAX_PASSIVE_SHARE.value;
  const liable = assetsOverThreshold && controlledByIndividual && passiveIncomeMajority;
  const taxableAssets = roundMoney(Math.max(0, input.nonProfessionalAssets - Math.max(0, input.deductibleDebt ?? 0)));
  const due = liable ? roundMoney(taxableAssets * HOLDING_ASSET_TAX_RATE.value) : 0;
  return {
    assetsOverThreshold,
    controlledByIndividual,
    passiveIncomeMajority,
    liable,
    taxableAssets,
    due,
    breakdown: [
      { label: 'Actifs détenus', amount: roundMoney(input.totalAssets), rate: HOLDING_ASSET_TAX_THRESHOLD_EUR },
      { label: 'Actifs non professionnels taxables', amount: taxableAssets },
      { label: 'Part des revenus passifs', amount: roundMoney(input.totalIncome > 0 ? input.passiveIncome / input.totalIncome : 0), rate: HOLDING_ASSET_TAX_PASSIVE_SHARE },
      { label: liable ? 'Taxe 20 % due' : 'Conditions cumulatives non réunies : taxe non due', amount: due, rate: HOLDING_ASSET_TAX_RATE },
    ],
  };
}

/* ---- Amendement Charasse (CGI art. 223 B) --------------------------------- */

export interface CharasseResult {
  /** Fraction des charges financières réintégrée au résultat d'ensemble. */
  reintegrated: number;
  ratio: number;
  /** Rang de l'exercice dans la période de réintégration (0 = acquisition). */
  yearIndex: number;
  active: boolean;
  breakdown: TaxBreakdownLine[];
}

/**
 * Réintégration des charges financières d'un rachat à soi-même dans un groupe
 * intégré (CGI art. 223 B, al. 6) — « amendement Charasse ».
 *
 * Quand une société du groupe achète les titres d'une société qui y entre à des
 * personnes qui la contrôlent, les charges financières déduites sont réintégrées
 * à proportion du prix d'acquisition rapporté au montant moyen des dettes du
 * groupe, pendant l'exercice d'acquisition et les huit suivants.
 */
export function calculateCharasseReintegration(input: {
  acquisitionPrice: number;
  groupAverageDebt: number;
  financialCharges: number;
  yearIndex: number;
}): CharasseResult {
  const active = input.yearIndex >= 0 && input.yearIndex < CHARASSE_REINTEGRATION_YEARS.value;
  const ratio = input.groupAverageDebt > 0
    ? Math.min(1, Math.max(0, input.acquisitionPrice) / input.groupAverageDebt)
    : 0;
  const reintegrated = active ? roundMoney(Math.max(0, input.financialCharges) * ratio) : 0;
  return {
    reintegrated,
    ratio,
    yearIndex: input.yearIndex,
    active,
    breakdown: [
      { label: 'Prix d’acquisition des titres rachetés', amount: roundMoney(input.acquisitionPrice) },
      { label: 'Dettes moyennes du groupe', amount: roundMoney(input.groupAverageDebt) },
      { label: `Charges financières réintégrées (exercice ${input.yearIndex + 1} sur ${CHARASSE_REINTEGRATION_YEARS.value})`, amount: reintegrated, formula: 'CGI art. 223 B al. 6' },
    ],
  };
}

/* ---- Plan d'épargne retraite (CGI art. 163 quatervicies) ------------------ */

export interface PerDeductionResult {
  /** Plafond de l'année, report des années antérieures inclus. */
  ceiling: number;
  /** Plafond propre à l'année, hors report. */
  annualCeiling: number;
  deducted: number;
  /** Fraction du plafond non utilisée, reportable cinq ans. */
  unusedCeiling: number;
  breakdown: TaxBreakdownLine[];
}

/**
 * Déduction du revenu net global des versements sur un PER
 * (CGI art. 163 quatervicies). Plafond annuel : 10 % des revenus d'activité
 * retenus dans la limite de huit PASS, ou 10 % du PASS si c'est plus élevé.
 * La fraction inutilisée se reporte sur les cinq années suivantes.
 */
export function calculatePerDeduction(
  contribution: number,
  professionalIncome: number,
  options: { pass?: number; carriedCeiling?: number } = {},
): PerDeductionResult {
  const pass = options.pass ?? PASS_2026_EUR.value;
  const cappedIncome = Math.min(Math.max(0, professionalIncome), PER_INCOME_CAP_PASS.value * pass);
  const annualCeiling = roundMoney(Math.max(cappedIncome * PER_DEDUCTION_RATE.value, pass * PER_DEDUCTION_RATE.value));
  const ceiling = roundMoney(annualCeiling + Math.max(0, options.carriedCeiling ?? 0));
  const deducted = roundMoney(Math.min(Math.max(0, contribution), ceiling));
  return {
    ceiling,
    annualCeiling,
    deducted,
    unusedCeiling: roundMoney(ceiling - deducted),
    breakdown: [
      { label: 'Plafond de l’année', amount: annualCeiling, rate: PER_DEDUCTION_RATE },
      ...(ceiling > annualCeiling ? [{ label: 'Report des plafonds non utilisés', amount: roundMoney(ceiling - annualCeiling), rate: PER_CARRY_YEARS }] : []),
      { label: 'Versement déduit du revenu global', amount: -deducted, formula: 'CGI art. 163 quatervicies' },
    ],
  };
}

/* ---- Mécénat d'entreprise (CGI art. 238 bis) ------------------------------ */

export interface MecenatResult {
  /** Plafond de versements retenus : 20 000 € ou 5 ‰ du CA. */
  cap: number;
  retained: number;
  /** Versements au-delà du plafond, reportables cinq exercices. */
  carriedForward: number;
  reduction: number;
  breakdown: TaxBreakdownLine[];
}

/**
 * Réduction d'impôt au titre du mécénat (CGI art. 238 bis) : 60 % des
 * versements jusqu'à 2 M€, 40 % au-delà, dans la limite de 20 000 € ou 5 ‰ du
 * chiffre d'affaires si ce montant est plus élevé. L'excédent est reportable
 * sur les cinq exercices suivants. Les versements ne sont pas déductibles du
 * bénéfice imposable (art. 238 bis, 8).
 */
export function calculateMecenat(
  donations: number,
  revenue: number,
  carriedIn = 0,
): MecenatResult {
  const cap = roundMoney(Math.max(MECENAT_CAP_FLOOR_EUR.value, revenue * MECENAT_CAP_REVENUE_SHARE.value));
  const available = roundMoney(Math.max(0, donations) + Math.max(0, carriedIn));
  const retained = roundMoney(Math.min(available, cap));
  const atFullRate = Math.min(retained, MECENAT_RATE_THRESHOLD_EUR.value);
  const aboveThreshold = Math.max(0, retained - MECENAT_RATE_THRESHOLD_EUR.value);
  const reduction = roundMoney(atFullRate * MECENAT_RATE.value + aboveThreshold * MECENAT_RATE_ABOVE_THRESHOLD.value);
  return {
    cap,
    retained,
    carriedForward: roundMoney(available - retained),
    reduction,
    breakdown: [
      { label: 'Plafond des versements retenus', amount: cap, rate: MECENAT_CAP_REVENUE_SHARE },
      { label: 'Versements retenus', amount: retained },
      { label: 'Réduction d’impôt 60 %', amount: roundMoney(atFullRate * MECENAT_RATE.value), rate: MECENAT_RATE },
      ...(aboveThreshold ? [{ label: 'Réduction d’impôt 40 % au-delà de 2 M€', amount: roundMoney(aboveThreshold * MECENAT_RATE_ABOVE_THRESHOLD.value), rate: MECENAT_RATE_ABOVE_THRESHOLD }] : []),
    ],
  };
}

/* ---- Plus-value immobilière des particuliers ------------------------------ */

/** Abattement pour durée de détention, assiette d'impôt sur le revenu (art. 150 VC). */
export function propertyAllowanceIncomeTax(holdingYears: number): number {
  if (holdingYears <= 5) return 0;
  const upTo21 = Math.min(holdingYears, 21) - 5;
  let rate = upTo21 * PROPERTY_ALLOWANCE_IR_PER_YEAR.value;
  if (holdingYears >= 22) rate += PROPERTY_ALLOWANCE_IR_YEAR_22.value;
  return Math.min(1, rate);
}

/** Abattement pour durée de détention, assiette de prélèvements sociaux (CSS art. L136-7). */
export function propertyAllowanceSocialLevies(holdingYears: number): number {
  if (holdingYears <= 5) return 0;
  if (holdingYears >= 30) return 1;
  const upTo21 = Math.min(holdingYears, 21) - 5;
  let rate = upTo21 * PROPERTY_ALLOWANCE_PS_PER_YEAR.value;
  if (holdingYears >= 22) rate += PROPERTY_ALLOWANCE_PS_YEAR_22.value;
  if (holdingYears > 22) rate += (Math.min(holdingYears, 30) - 22) * PROPERTY_ALLOWANCE_PS_BEYOND_22.value;
  return Math.min(1, rate);
}

/** Surtaxe des plus-values immobilières supérieures à 50 000 € (art. 1609 nonies G). */
export function propertySurtax(taxableGain: number): number {
  const gain = Math.max(0, taxableGain);
  const bracket = PROPERTY_SURTAX_BRACKETS.value.find((candidate) => gain <= candidate.upTo)
    ?? PROPERTY_SURTAX_BRACKETS.value.at(-1)!;
  if (bracket.rate === 0) return 0;
  const smoothed = bracket.smoothing ? (bracket.upTo - gain) * bracket.smoothing : 0;
  return roundMoney(Math.max(0, gain * bracket.rate - smoothed));
}

export interface PropertyGainResult {
  salePrice: number;
  exempt: boolean;
  exemptionReason?: string;
  /** Prix d'acquisition majoré des frais et travaux, minoré des amortissements. */
  adjustedAcquisitionPrice: number;
  grossGain: number;
  allowanceIncomeTax: number;
  allowanceSocialLevies: number;
  taxableIncomeTax: number;
  taxableSocialLevies: number;
  incomeTax: number;
  socialLevies: number;
  surtax: number;
  totalTax: number;
  netProceeds: number;
  breakdown: TaxBreakdownLine[];
}

export interface PropertyGainOptions {
  holdingYears?: number;
  /** Résidence principale au jour de la cession : exonération (art. 150 U, II-1°). */
  principalResidence?: boolean;
  /** Travaux justifiés ; à défaut le forfait de 15 % s'applique au-delà de cinq ans. */
  worksAmount?: number;
  /** Amortissements déduits en meublé, réintégrés au prix d'acquisition (art. 150 VB, III). */
  deductedAmortization?: number;
}

/**
 * Plus-value immobilière d'un particulier : impôt sur le revenu à 19 %
 * (art. 200 B) et prélèvements sociaux, chacun avec son propre abattement pour
 * durée de détention — exonération d'IR à 22 ans, de prélèvements sociaux à
 * 30 ans — puis surtaxe au-delà de 50 000 € de plus-value imposable.
 *
 * Les amortissements déduits au titre d'une location meublée minorent le prix
 * d'acquisition depuis la loi du 14 février 2025 (art. 150 VB, III) : c'est ce
 * qui rattrape, à la sortie, l'économie faite pendant la détention.
 */
export function calculatePropertyGain(
  salePrice: number,
  acquisitionPrice: number,
  options: PropertyGainOptions = {},
): PropertyGainResult {
  const holdingYears = Math.max(0, options.holdingYears ?? 0);
  const exemptionReason = options.principalResidence
    ? 'Résidence principale du cédant au jour de la cession (CGI art. 150 U, II-1°).'
    : salePrice <= PROPERTY_SMALL_SALE_EXEMPTION_EUR.value
      ? `Prix de cession inférieur ou égal à ${PROPERTY_SMALL_SALE_EXEMPTION_EUR.value} € (CGI art. 150 U, II-6°).`
      : undefined;

  const acquisitionCosts = roundMoney(acquisitionPrice * PROPERTY_ACQUISITION_COSTS_FLAT.value);
  const works = options.worksAmount !== undefined
    ? Math.max(0, options.worksAmount)
    : holdingYears > PROPERTY_WORKS_FLAT_MIN_YEARS.value
      ? roundMoney(acquisitionPrice * PROPERTY_WORKS_FLAT.value)
      : 0;
  const amortization = Math.max(0, options.deductedAmortization ?? 0);
  const adjustedAcquisitionPrice = roundMoney(acquisitionPrice + acquisitionCosts + works - amortization);
  const grossGain = roundMoney(Math.max(0, salePrice - adjustedAcquisitionPrice));

  const allowanceIncomeTax = propertyAllowanceIncomeTax(holdingYears);
  const allowanceSocialLevies = propertyAllowanceSocialLevies(holdingYears);
  const taxableIncomeTax = exemptionReason ? 0 : roundMoney(grossGain * (1 - allowanceIncomeTax));
  const taxableSocialLevies = exemptionReason ? 0 : roundMoney(grossGain * (1 - allowanceSocialLevies));
  const incomeTax = roundMoney(taxableIncomeTax * PROPERTY_GAIN_IR_RATE.value);
  const socialLevies = roundMoney(taxableSocialLevies * PFU_PS_RATE.value);
  const surtax = exemptionReason ? 0 : propertySurtax(taxableIncomeTax);
  const totalTax = roundMoney(incomeTax + socialLevies + surtax);

  return {
    salePrice,
    exempt: !!exemptionReason,
    exemptionReason,
    adjustedAcquisitionPrice,
    grossGain,
    allowanceIncomeTax,
    allowanceSocialLevies,
    taxableIncomeTax,
    taxableSocialLevies,
    incomeTax,
    socialLevies,
    surtax,
    totalTax,
    netProceeds: roundMoney(salePrice - totalTax),
    breakdown: exemptionReason
      ? [{ label: 'Plus-value exonérée', amount: 0, formula: exemptionReason }]
      : [
          { label: 'Frais d’acquisition (forfait 7,5 %)', amount: acquisitionCosts, rate: PROPERTY_ACQUISITION_COSTS_FLAT },
          ...(works ? [{ label: 'Travaux', amount: works, rate: options.worksAmount === undefined ? PROPERTY_WORKS_FLAT : undefined }] : []),
          ...(amortization ? [{ label: 'Amortissements réintégrés au prix d’acquisition', amount: -amortization, formula: 'CGI art. 150 VB, III' }] : []),
          { label: 'Plus-value brute', amount: grossGain },
          { label: `Abattement pour durée de détention, IR (${Math.round(allowanceIncomeTax * 100)} %)`, amount: -roundMoney(grossGain * allowanceIncomeTax), rate: PROPERTY_ALLOWANCE_IR_PER_YEAR },
          { label: 'Impôt sur le revenu 19 %', amount: incomeTax, rate: PROPERTY_GAIN_IR_RATE },
          { label: `Prélèvements sociaux (abattement ${Math.round(allowanceSocialLevies * 100)} %)`, amount: socialLevies, rate: PFU_PS_RATE },
          ...(surtax ? [{ label: 'Surtaxe sur les plus-values élevées', amount: surtax, formula: 'CGI art. 1609 nonies G' }] : []),
        ],
  };
}
