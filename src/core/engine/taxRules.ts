/**
 * Sourced fiscal rates for the deterministic engine.
 * Values copied from `src/core/legal/sourced-rates.draft.json` (tax-lawyer-fr batch).
 * Never call OpenLegi from the What-If / runtime path — refresh the draft offline.
 */
import type { SourcedRate, SourcedRateStatus, TaxBracket } from '../types';

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

/** One social-contribution branch of the SASU président payslip. */
export interface UrssafBranch {
  label: string;
  /** Employee share, as a ratio of gross salary. */
  employee: number;
  /** Employer share, as a ratio of gross salary. */
  employer: number;
  source: string;
  status: SourcedRateStatus;
  /** Why the flat ratio above is an approximation, when it is. */
  note?: string;
}

/**
 * Branch-by-branch build-up for a président de SASU (assimilé-salarié), 2026.
 *
 * Each line carries its own source. The aggregate below is still an
 * approximation, not a payslip: every rate is applied flat to the whole gross
 * salary, so the plafond de la sécurité sociale (tranche 1 / tranche 2), the
 * réduction générale de cotisations patronales, and the CSG/CRDS abattement
 * cap at 4 PASS are all ignored. A président is not affiliated to
 * l'assurance chômage, so no unemployment contribution appears here.
 */
export const URSSAF_BRANCHES_2026: readonly UrssafBranch[] = [
  {
    label: 'Maladie, maternité, invalidité, décès',
    employee: 0,
    employer: 0.13,
    source:
      'CSS art. D242-3 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036679615',
    status: 'verified',
    note: 'Taux réduit à 7 % pour les rémunérations ≤ 2,5 SMIC (CSS art. L241-2-1), non modélisé.',
  },
  {
    label: 'Vieillesse plafonnée',
    employee: 0.069,
    employer: 0.0855,
    source:
      'CSS art. D242-4 (décret n° 2025-1446 du 31/12/2025) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053302465',
    status: 'verified',
    note: 'Due seulement sur la part du brut sous le plafond de la sécurité sociale ; appliquée ici à la totalité.',
  },
  {
    label: 'Vieillesse déplafonnée',
    employee: 0.004,
    employer: 0.0211,
    source:
      'CSS art. D242-4 (décret n° 2025-1446 du 31/12/2025) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053302465',
    status: 'verified',
  },
  {
    label: 'Allocations familiales',
    employee: 0,
    employer: 0.0525,
    source:
      'CSS art. D241-3-1 (décret n° 2025-887 du 04/09/2025) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052196883',
    status: 'verified',
    note: 'Taux réduit à 3,45 % sous 3,5 SMIC (CSS art. L241-6), non modélisé.',
  },
  {
    label: 'CSG + CRDS (sur 98,25 % du brut)',
    // 9,20 % + 0,50 % appliqués après abattement de 1,75 % pour frais professionnels.
    employee: (0.092 + 0.005) * 0.9825,
    employer: 0,
    source:
      'CSS art. L136-8 I-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054336623 ; CRDS : ordonnance n° 96-50 du 24/01/1996 art. 19',
    status: 'verified',
    note: "L'abattement d'assiette cesse au-delà de 4 plafonds ; non modélisé.",
  },
  {
    label: 'Retraite complémentaire AGIRC-ARRCO + CEG (tranche 1)',
    employee: 0.0315 + 0.0086,
    employer: 0.0472 + 0.0129,
    source:
      'ANI du 17/11/2017 (barème AGIRC-ARRCO) — accord conventionnel, hors Légifrance',
    status: 'assumed',
    note: 'Barème tranche 1 uniquement ; la tranche 2 (au-delà du plafond) est plus chère.',
  },
  {
    label: 'FNAL + contribution solidarité autonomie',
    employee: 0,
    employer: 0.001 + 0.003,
    source:
      'CSS art. L834-1 (FNAL, 0,10 % < 50 salariés) ; CASF art. L14-10-4 (CSA 0,30 %)',
    status: 'assumed',
  },
  {
    label: 'Accidents du travail / maladies professionnelles',
    employee: 0,
    employer: 0.02,
    source:
      'Taux notifié par la CARSAT selon le code risque de l’entreprise (CSS art. D242-6-2) — aucun taux universel',
    status: 'placeholder',
    note: 'Valeur de substitution : le taux réel dépend de l’activité et de la sinistralité.',
  },
];

const sumBranches = (side: 'employee' | 'employer'): number =>
  Number(URSSAF_BRANCHES_2026.reduce((total, b) => total + b[side], 0).toFixed(4));

const BRANCH_SOURCE =
  'Somme de URSSAF_BRANCHES_2026 (voir chaque branche pour sa source) — approximation à taux plats : ni plafond, ni réduction générale, ni tranche 2.';

/**
 * Aggregated contribution rates on the gross salary, derived from the branch
 * table so the figure can be traced line by line. `assumed`, not `verified`:
 * the individual rates are sourced but their flat summation is a model choice.
 */
export const URSSAF_EMPLOYEE_RATE_2026: SourcedRate = {
  value: sumBranches('employee'),
  unit: 'ratio',
  source: BRANCH_SOURCE,
  asOf: '2026-09-19',
  status: 'assumed',
};

export const URSSAF_EMPLOYER_RATE_2026: SourcedRate = {
  value: sumBranches('employer'),
  unit: 'ratio',
  source: BRANCH_SOURCE,
  asOf: '2026-09-19',
  status: 'assumed',
};

/**
 * Implicit employee contribution rate used only to decompose
 * `EXECUTIVE_COST_FACTOR_APPROX` into gross / employer / employee
 * (gross = net / (1 - rate); employer = cost − gross).
 * Not a SourcedRate — model scaffold until URSSAF bars are frozen.
 */
export const EXECUTIVE_EMPLOYEE_RATE_APPROX = 0.22;
