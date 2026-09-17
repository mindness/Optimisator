/**
 * Sourced fiscal rates for the deterministic engine.
 * Values copied from `src/core/legal/sourced-rates.draft.json` (tax-lawyer-fr batch).
 * Never call OpenLegi from the What-If / runtime path — refresh the draft offline.
 */
import type { SourcedRate, TaxBracket } from '../types';

export const VAT_STANDARD: SourcedRate = {
  value: 0.2,
  unit: 'ratio',
  source:
    'CGI art. 278 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000026950057',
  asOf: '2026-09-07',
  status: 'verified',
};

export const IS_STANDARD_RATE: SourcedRate = {
  value: 0.25,
  unit: 'ratio',
  source:
    'CGI art. 219, I al. 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-07',
  status: 'verified',
};

export const IS_REDUCED_RATE: SourcedRate = {
  value: 0.15,
  unit: 'ratio',
  source:
    'CGI art. 219, I-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-07',
  status: 'verified',
};

/** PME reduced-rate ceiling (€ / 12 months). */
export const IS_REDUCED_THRESHOLD_EUR: SourcedRate = {
  value: 42_500,
  unit: 'eur',
  source:
    'CGI art. 219, I-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-07',
  status: 'verified',
};

/**
 * CGI art. 219 I-b — CA ceiling (€) for reduced IS eligibility (PME).
 * Must be combined with: capital fully paid-up and held ≥75% by individuals.
 */
export const IS_REDUCED_CA_CEILING_EUR: SourcedRate = {
  value: 10_000_000,
  unit: 'eur',
  source:
    'CGI art. 219, I-b al. 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-16',
  status: 'verified',
};

export const MOTHER_DAUGHTER_MIN_HOLDING_PCT: SourcedRate = {
  value: 0.05,
  unit: 'ratio',
  source:
    'CGI art. 145, 1-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051203497',
  asOf: '2026-09-07',
  status: 'verified',
};

export const MOTHER_DAUGHTER_QPFC_RATE: SourcedRate = {
  value: 0.05,
  unit: 'ratio',
  source:
    'CGI art. 216, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048831340',
  asOf: '2026-09-07',
  status: 'verified',
};

export const PFU_IR_RATE: SourcedRate = {
  value: 0.128,
  unit: 'ratio',
  source:
    'CGI art. 200 A, 1-B-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053546896',
  asOf: '2026-09-07',
  status: 'verified',
};

/**
 * Social levies package on capital income for PFU modelling (revenus 2026+).
 * Composition verified OpenLegi 2026-09-07:
 * CSG 10,6 % (CSS L. 136-8 I-2° on L. 136-6 / L. 136-7; dividends L. 136-7 I-1° not in IV 9,2 % derogation)
 * + solidarité 7,5 % (CGI 235 ter III)
 * + CRDS 0,5 % (ord. n° 96-50 art. 19)
 * = 18,6 %.
 */
export const PFU_PS_RATE: SourcedRate = {
  value: 0.186,
  unit: 'ratio',
  source:
    'CSS L. 136-8 I-2° (CSG 10,6 %) https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054336623 + CGI 235 ter III (solidarité 7,5 %) https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000037949145 + ord. n° 96-50 art. 19 (CRDS 0,5 %) https://www.legifrance.gouv.fr/loda/article_lc/LEGIARTI000041466982',
  asOf: '2026-09-07',
  status: 'verified',
};

/** Derived PFU total = verified IR 12.8% + verified PS 18.6% = 31.4%. */
export const PFU_TOTAL_RATE: SourcedRate = {
  value: 0.314,
  unit: 'ratio',
  source:
    'Derived: CGI art. 200 A (12,8 % verified) + package PS 18,6 % verified — voir PFU_IR_RATE / PFU_PS_RATE',
  asOf: '2026-09-07',
  status: 'verified',
};

/**
 * IR 2026 progressive brackets (CGI art. 197 I-1, loi n° 2026-103 du 19/02/2026).
 * Applied to one share of income; thresholds in € / part.
 * The 0% first bracket (≤ 11 600 €) keeps `parseFloat`-friendly provenance.
 */
export const IR_2026_BRACKETS: SourcedRate<TaxBracket[]> = {
  value: [
    { upTo: 11_600, rate: 0 },
    { upTo: 29_579, rate: 0.11 },
    { upTo: 84_577, rate: 0.3 },
    { upTo: 181_917, rate: 0.41 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.45 },
  ],
  unit: 'eur',
  source:
    'CGI art. 197, I-1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542636 (loi n° 2026-103 du 19/02/2026, applicable revenus 2025+)',
  asOf: '2026-09-16',
  status: 'verified',
};

/** Flat-rate professional expenses allowance on salaries (CGI art. 83-3°). */
export const IR_EXPENSE_FLAT_10_PCT: SourcedRate = {
  value: 0.1,
  unit: 'ratio',
  source:
    'CGI art. 83, 3° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373766 (10 %, plafond 14 555 €/an, minimum 509 €)',
  asOf: '2026-09-16',
  status: 'verified',
};

/** CGI art. 83-3° cap (€) for the 10% allowance — revenus 2025. */
export const IR_EXPENSE_ALLOWANCE_CAP_EUR: SourcedRate = {
  value: 14_555,
  unit: 'eur',
  source:
    'CGI art. 83, 3° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373766',
  asOf: '2026-09-16',
  status: 'verified',
};

/** CGI art. 83-3° floor (€) for the 10% allowance. */
export const IR_EXPENSE_ALLOWANCE_FLOOR_EUR: SourcedRate = {
  value: 509,
  unit: 'eur',
  source:
    'CGI art. 83, 3° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373766',
  asOf: '2026-09-16',
  status: 'verified',
};

/**
 * Approximate employer cost / net for SASU président assimilé-salarié.
 * Placeholder — not a statutory rate; replace with sourced URSSAF bars later.
 */
export const EXECUTIVE_COST_FACTOR_APPROX: SourcedRate = {
  value: 1.8,
  unit: 'ratio',
  source: 'Non fixé par le CGI — paramètre modèle (URSSAF / coût employeur assimilé-salarié)',
  asOf: '2026-09-07',
  status: 'placeholder',
};

/**
 * Hypothèses forfaitaires du modèle pour le président SASU assimilé-salarié.
 * Salariales 21 % du brut, patronales 39 % du brut : coût = 1,39 × brut,
 * soit environ 1,76 × net. Ces agrégats ne sont pas des taux légaux vérifiés ;
 * ils ne modélisent pas les assiettes, plafonds et tranches d'une fiche de paie.
 */
export const URSSAF_EMPLOYEE_RATE_2026: SourcedRate = {
  value: 0.21,
  unit: 'ratio',
  source:
    'Hypothèse de simulation : cotisations salariales agrégées à 21 % du brut, non vérifiées ; ne remplace pas un calcul de paie URSSAF.',
  asOf: '2026-09-17',
  status: 'placeholder',
};

export const URSSAF_EMPLOYER_RATE_2026: SourcedRate = {
  value: 0.39,
  unit: 'ratio',
  source:
    'Hypothèse de simulation : cotisations patronales agrégées à 39 % du brut, non vérifiées ; ne remplace pas un calcul de paie URSSAF.',
  asOf: '2026-09-17',
  status: 'placeholder',
};

/**
 * Implicit employee contribution rate used only to decompose
 * `EXECUTIVE_COST_FACTOR_APPROX` into gross / employer / employee
 * (gross = net / (1 - rate); employer = cost − gross).
 * Not a SourcedRate — model scaffold until URSSAF bars are frozen.
 */
export const EXECUTIVE_EMPLOYEE_RATE_APPROX = 0.22;
