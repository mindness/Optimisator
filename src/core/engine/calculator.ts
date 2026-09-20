/**
 * Pure deterministic French tax math for the simulateur.
 * Money amounts (EUR) are rounded to cents: Math.round(x * 100) / 100.
 */
import type { TaxBreakdownLine } from '../types';
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
  TNS_SOCIAL_RATE_APPROX,
  URSSAF_EMPLOYEE_RATE_2026,
  URSSAF_EMPLOYER_RATE_2026,
  VAT_STANDARD,
  type MicroCategory,
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
 * `reducedRateEligible` defaults to true (preset PME assumption); when false,
 * the 25% standard rate applies to the whole taxable income.
 */
export function calculateCorporateTax(
  taxableIncome: number,
  reducedRateEligible: boolean = true,
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
 * Renvoie `Infinity` pour la dernière tranche, qui n'a pas de sommet.
 */
export function findMaxGrossSalaryForTargetTMI(
  targetMarginalRate: number,
  parts: number = 1,
): number {
  const target = IR_2026_BRACKETS.value.find((b) => b.rate === targetMarginalRate);
  if (!target || target.upTo === Infinity) return Infinity;

  const safeParts = Math.max(0.5, parts);
  const maxTaxable = target.upTo * safeParts;
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
  /** Revenu professionnel servant d'assiette (€). */
  base: number;
  contributions: number;
  netAfterContributions: number;
}

/**
 * Cotisations SSI d'un gérant majoritaire de SARL/EURL ou d'un entrepreneur
 * individuel au réel, en ratio plat du revenu professionnel.
 *
 * `TNS_SOCIAL_RATE_APPROX` est un paramètre de modèle, pas un barème : les
 * cotisations SSI réelles sont la somme de branches à assiettes et plafonds
 * distincts, dont la maladie dégressive et la CSG-CRDS sur assiette majorée.
 */
export function calculateTnsContributions(revenuProfessionnel: number): TnsContributionsResult {
  const base = roundMoney(Math.max(0, revenuProfessionnel));
  const contributions = roundMoney(base * TNS_SOCIAL_RATE_APPROX.value);
  return {
    base,
    contributions,
    netAfterContributions: roundMoney(revenuProfessionnel - contributions),
  };
}

export interface TnsDividendSurchargeResult {
  /** Fraction exonérée = 10 % du capital, primes et CCA. */
  exemptThreshold: number;
  /** Part du dividende assujettie aux cotisations SSI. */
  subjectToContributions: number;
  contributions: number;
}

/**
 * Règle des 10 % (CSS art. L131-6, III) : pour un gérant majoritaire, la part
 * des dividendes excédant 10 % du capital social, des primes d'émission et des
 * sommes versées en compte courant d'associé entre dans l'assiette des
 * cotisations sociales. C'est l'écart structurant entre SARL/EURL et SASU,
 * dont le président assimilé-salarié n'y est pas soumis.
 */
export function calculateTnsDividendSurcharge(
  grossDividend: number,
  capitalPrimesAndCca: number,
): TnsDividendSurchargeResult {
  const exemptThreshold = roundMoney(
    Math.max(0, capitalPrimesAndCca) * TNS_DIVIDEND_EXEMPT_CAPITAL_SHARE.value,
  );
  const subjectToContributions = roundMoney(
    Math.max(0, grossDividend - exemptThreshold),
  );
  return {
    exemptThreshold,
    subjectToContributions,
    contributions: roundMoney(subjectToContributions * TNS_SOCIAL_RATE_APPROX.value),
  };
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
