/**
 * Sourced fiscal rates for the deterministic engine.
 * Values copied from `src/core/legal/sourced-rates.draft.json` (tax-lawyer-fr batch).
 * Never call OpenLegi from the What-If / runtime path — refresh the draft offline.
 */
import type { SourcedRate } from '../types';

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
 * Implicit employee contribution rate used only to decompose
 * `EXECUTIVE_COST_FACTOR_APPROX` into gross / employer / employee
 * (gross = net / (1 - rate); employer = cost − gross).
 * Not a SourcedRate — model scaffold until URSSAF bars are frozen.
 */
export const EXECUTIVE_EMPLOYEE_RATE_APPROX = 0.22;
