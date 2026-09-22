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
  asOf: '2026-09-19',
  status: 'verified',
};

export const IS_REDUCED_RATE: SourcedRate = {
  value: 0.15,
  unit: 'ratio',
  source:
    'CGI art. 219, I-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-19',
  status: 'verified',
};

/** PME reduced-rate ceiling (€ / 12 months). */
export const IS_REDUCED_THRESHOLD_EUR: SourcedRate = {
  value: 42_500,
  unit: 'eur',
  source:
    'CGI art. 219, I-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-19',
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
  asOf: '2026-09-19',
  status: 'verified',
};

export const MOTHER_DAUGHTER_MIN_HOLDING_PCT: SourcedRate = {
  value: 0.05,
  unit: 'ratio',
  source:
    'CGI art. 145, 1-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051203497',
  asOf: '2026-09-19',
  status: 'verified',
};

export const MOTHER_DAUGHTER_QPFC_RATE: SourcedRate = {
  value: 0.05,
  unit: 'ratio',
  source:
    'CGI art. 216, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048831340',
  asOf: '2026-09-19',
  status: 'verified',
};

/** Intégration fiscale : produits de participation intra-groupe retranchés à 99 % → QPFC 1 %. */
export const INTEGRATED_GROUP_QPFC_RATE: SourcedRate = {
  value: 0.01,
  unit: 'ratio',
  source:
    'CGI art. 223 B, al. 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048831317',
  asOf: '2026-09-20',
  status: 'verified',
};

export const INTEGRATED_GROUP_MIN_HOLDING_PCT: SourcedRate = {
  value: 0.95,
  unit: 'ratio',
  source:
    'CGI art. 223 A, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048834056',
  asOf: '2026-09-20',
  status: 'verified',
};

/**
 * Plafond de déductibilité des intérêts de comptes courants d'associés : taux de
 * référence pour un exercice de 12 mois clos entre le 30 juin et le 29 septembre 2026.
 */
export const CCA_INTEREST_CAP_RATE: SourcedRate = {
  value: 0.0433,
  unit: 'ratio',
  source:
    'BOI-BIC-CHG-50-50-30 § 40 (CGI art. 39, 1-3°) — https://bofip.impots.gouv.fr/bofip/5505-PGP.html/identifiant=BOI-BIC-CHG-50-50-30-20260805',
  asOf: '2026-08-05',
  status: 'verified',
};

/** Versement libératoire de l'IR des micro-entrepreneurs, en % du CA HT (CGI art. 151-0, II). */
export const MICRO_VERSEMENT_LIBERATOIRE_RATES: Record<MicroCategory, SourcedRate> = {
  bic_vente: { value: 0.01, unit: 'ratio', source: 'CGI art. 151-0, II-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051765182', asOf: '2026-09-20', status: 'verified' },
  bic_services: { value: 0.017, unit: 'ratio', source: 'CGI art. 151-0, II-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051765182', asOf: '2026-09-20', status: 'verified' },
  bnc: { value: 0.022, unit: 'ratio', source: 'CGI art. 151-0, II-3° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051765182', asOf: '2026-09-20', status: 'verified' },
  meuble_tourisme: { value: 0.017, unit: 'ratio', source: 'CGI art. 151-0, II-2° (seuil du 2° de l’art. 50-0) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051765182', asOf: '2026-09-20', status: 'verified' },
};

/** Franchise en base de TVA, plafonds de l'année en cours (CGI art. 293 B, I). */
export const VAT_FRANCHISE_CEILING_GOODS_EUR: SourcedRate = {
  value: 93_500,
  unit: 'eur',
  source: 'CGI art. 293 B, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052488142',
  asOf: '2026-09-20',
  status: 'verified',
};
export const VAT_FRANCHISE_CEILING_SERVICES_EUR: SourcedRate = {
  value: 41_250,
  unit: 'eur',
  source: 'CGI art. 293 B, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052488142',
  asOf: '2026-09-20',
  status: 'verified',
};

/**
 * ACRE micro-entrepreneur : taux de cotisations ramené à 75 % du taux normal pendant
 * 12 mois (décret 2026-69, en vigueur au 1er juillet 2026 ; plafond légal de 25 %
 * depuis la LFSS 2026). Dégressivité entre ¾ PASS et PASS non modélisée.
 */
export const ACRE_MICRO_REDUCTION: SourcedRate = {
  value: 0.25,
  unit: 'ratio',
  source:
    'CSS art. D131-6-3, I (75 % des taux D613-4) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053451326 ; CSS art. L131-6-4, II — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053282569',
  asOf: '2026-09-20',
  status: 'verified',
};

export const PFU_IR_RATE: SourcedRate = {
  value: 0.128,
  unit: 'ratio',
  source:
    'CGI art. 200 A, 1-B-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053546896',
  asOf: '2026-09-19',
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

/* ------------------------------------------------------------------------ *
 * Campagne de sourçage OpenLegi du 2026-09-20 — structures IS / IR, TMI.
 * Voir docs/superpowers/plans/2026-09-20-gap-structures-is-ir-tmi.md §4.
 * ------------------------------------------------------------------------ */

/** Abattement de 40 % sur les dividendes imposés au barème (option globale). */
export const DIVIDEND_BAREME_ALLOWANCE: SourcedRate = {
  value: 0.4,
  unit: 'ratio',
  source:
    'CGI art. 158, 3-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373673',
  asOf: '2026-09-20',
  status: 'verified',
};

/**
 * Part de CSG déductible du revenu imposable de l'année suivante, pour les
 * revenus du patrimoine imposés au barème. Sans objet sous PFU.
 */
export const CSG_DEDUCTIBLE_POINTS: SourcedRate = {
  value: 0.068,
  unit: 'ratio',
  source:
    'CGI art. 154 quinquies, II — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054336634',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Plafond de l'avantage en impôt procuré par chaque demi-part excédentaire. */
export const QUOTIENT_FAMILIAL_CAP_PER_HALF_PART_EUR: SourcedRate = {
  value: 1_807,
  unit: 'eur',
  source:
    'CGI art. 197, I-2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542636',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Décote : seuil célibataire (CGI art. 197, I-4-a). */
export const IR_DECOTE_SINGLE_EUR: SourcedRate = {
  value: 897,
  unit: 'eur',
  source:
    'CGI art. 197, I-4-a — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542636',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Décote : seuil imposition commune (CGI art. 197, I-4-a). */
export const IR_DECOTE_COUPLE_EUR: SourcedRate = {
  value: 1_483,
  unit: 'eur',
  source:
    'CGI art. 197, I-4-a — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542636',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Décote : taux de dégressivité appliqué à l'impôt brut. */
export const IR_DECOTE_SLOPE: SourcedRate = {
  value: 0.4525,
  unit: 'ratio',
  source:
    'CGI art. 197, I-4-a — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542636',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Catégories du régime micro : abattement forfaitaire et seuil de CA. */
export type MicroCategory = 'bic_vente' | 'bic_services' | 'bnc' | 'meuble_tourisme';

export interface MicroBracket {
  label: string;
  /** Abattement forfaitaire pour frais, appliqué au CA HT. */
  allowance: number;
  /** Seuil de CA HT au-delà duquel le régime micro cesse de s'appliquer. */
  ceilingEur: number;
  /** Taux global de cotisations sur le CA (CSS art. D613-4, décret n° 2025-943, périodes 2026+). */
  socialRate: number;
  source: string;
  status: SourcedRateStatus;
}

/**
 * CGI art. 50-0 (BIC) et 102 ter (BNC), seuils 2026 ; taux de cotisations micro
 * CSS art. D613-4 (décret n° 2025-943, en vigueur 2026) :
 * https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000052218738
 */
export const MICRO_BRACKETS_2026: Record<MicroCategory, MicroBracket> = {
  bic_vente: {
    label: 'Micro-BIC — vente de marchandises / hébergement',
    allowance: 0.71,
    ceilingEur: 203_100,
    socialRate: 0.123,
    source:
      'CGI art. 50-0, 1-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373853',
    status: 'verified',
  },
  bic_services: {
    label: 'Micro-BIC — prestations de services',
    allowance: 0.5,
    ceilingEur: 83_600,
    socialRate: 0.212,
    source:
      'CGI art. 50-0, 1-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373853',
    status: 'verified',
  },
  bnc: {
    label: 'Micro-BNC — professions libérales',
    allowance: 0.34,
    ceilingEur: 83_600,
    socialRate: 0.256,
    source:
      'CGI art. 102 ter, 1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373747 ; taux 25,6 % : CSS art. D613-4, e)',
    status: 'verified',
  },
  meuble_tourisme: {
    label: 'Micro-BIC — meublé de tourisme non classé',
    allowance: 0.3,
    ceilingEur: 15_000,
    socialRate: 0.06,
    source:
      'CGI art. 50-0, 1-1° bis — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373853 ; taux 6 % : CSS art. D613-4, c)',
    status: 'verified',
  },
};

/** Plancher de l'abattement micro, toutes catégories (CGI art. 50-0 / 102 ter). */
export const MICRO_ALLOWANCE_FLOOR_EUR: SourcedRate = {
  value: 305,
  unit: 'eur',
  source:
    'CGI art. 50-0, 1 et art. 102 ter, 1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373853',
  asOf: '2026-09-20',
  status: 'verified',
};

/**
 * Fraction des dividendes non assujettie aux cotisations sociales pour un
 * gérant majoritaire : 10 % du capital social, des primes d'émission et des
 * sommes versées en compte courant d'associé. Au-delà, les dividendes entrent
 * dans l'assiette des cotisations SSI.
 */
export const TNS_DIVIDEND_EXEMPT_CAPITAL_SHARE: SourcedRate = {
  value: 0.1,
  unit: 'ratio',
  source:
    'CSS art. L136-3, II-2° (renvoi de L131-6) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051284498',
  asOf: '2026-09-20',
  status: 'verified',
};

/**
 * Part des cotisations salariales déductible du revenu imposable.
 * Le net imposable = brut − cotisations déductibles ; la CSG non déductible
 * (2,4 pts) et la CRDS (0,5 pt) restent dans l'assiette de l'IR.
 */
export const SALARY_NON_DEDUCTIBLE_CSG_CRDS: SourcedRate = {
  value: (0.024 + 0.005) * 0.9825,
  unit: 'ratio',
  source:
    'CGI art. 154 quinquies, I (CSG déductible 6,8 des 9,2 pts) + CRDS non déductible : ordonnance n° 96-50 art. 19',
  asOf: '2026-09-20',
  status: 'verified',
};

/* ------------------------------------------------------------------------ *
 * Exhaustivité des montages (plan 2026-09-21, phases P1 → P8).
 * Chaque valeur relevée sur Légifrance le 2026-09-22, version en vigueur.
 * ------------------------------------------------------------------------ */

/** Report en avant : 1 M€ + 50 % de la fraction du bénéfice au-delà. */
export const DEFICIT_CARRYFORWARD_CAP_EUR: SourcedRate = {
  value: 1_000_000,
  unit: 'eur',
  source: 'CGI art. 209, I al. 3 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048847486',
  asOf: '2026-09-22',
  status: 'verified',
};

export const DEFICIT_CARRYFORWARD_MARGINAL_SHARE: SourcedRate = {
  value: 0.5,
  unit: 'ratio',
  source: 'CGI art. 209, I al. 3 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048847486',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Déficit foncier imputable sur le revenu global (hors intérêts d'emprunt). */
export const DEFICIT_FONCIER_GLOBAL_CAP_EUR: SourcedRate = {
  value: 10_700,
  unit: 'eur',
  source: 'CGI art. 156, I-3° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373682',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Report des déficits non imputés sur le revenu global : 6 ans (art. 156, I al. 1). */
export const DEFICIT_GLOBAL_CARRY_YEARS: SourcedRate = {
  value: 6,
  unit: 'years',
  source: 'CGI art. 156, I al. 1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373682',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- P3 : cession de titres ---------------------------------------------- */

/** Quote-part de frais et charges sur les plus-values de titres de participation. */
export const PARTICIPATION_QPFC_RATE: SourcedRate = {
  value: 0.12,
  unit: 'ratio',
  source: 'CGI art. 219, I-a quinquies — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-22',
  status: 'verified',
};

export const PARTICIPATION_MIN_HOLDING_PCT: SourcedRate = {
  value: 0.05,
  unit: 'ratio',
  source: 'CGI art. 219, I-a quinquies al. 3 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-22',
  status: 'verified',
};

export const PARTICIPATION_MIN_HOLDING_YEARS: SourcedRate = {
  value: 2,
  unit: 'years',
  source: 'CGI art. 219, I-a septies — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542939',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Abattement fixe du dirigeant partant à la retraite. */
export const RETIREMENT_FIXED_ALLOWANCE_EUR: SourcedRate = {
  value: 500_000,
  unit: 'eur',
  source: 'CGI art. 150-0 D ter, I-1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542877',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Abattement de droit commun, détention ≥ 2 ans et < 8 ans. */
export const SHARE_SALE_ALLOWANCE_2_TO_8: SourcedRate = {
  value: 0.5,
  unit: 'ratio',
  source: 'CGI art. 150-0 D, 1 ter-A-a — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053543011',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Abattement de droit commun, détention ≥ 8 ans. */
export const SHARE_SALE_ALLOWANCE_OVER_8: SourcedRate = {
  value: 0.65,
  unit: 'ratio',
  source: 'CGI art. 150-0 D, 1 ter-A-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053543011',
  asOf: '2026-09-22',
  status: 'verified',
};

/**
 * Le piège : les abattements pour durée de détention ne visent que les titres
 * acquis **avant** cette année, et seulement sur option barème (art. 150-0 D, 1 ter-B).
 */
export const SHARE_SALE_ALLOWANCE_ACQUISITION_CUTOFF_YEAR: SourcedRate = {
  value: 2018,
  unit: 'year',
  source: 'CGI art. 150-0 D, 1 ter-B-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053543011',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- P4 : apport-cession 150-0 B ter -------------------------------------- */

/** Cession des titres apportés dans ce délai → obligation de remploi. */
export const REPORT_SALE_WINDOW_YEARS: SourcedRate = {
  value: 3,
  unit: 'years',
  source: 'CGI art. 150-0 B ter, I-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542872',
  asOf: '2026-09-21',
  status: 'verified',
};

export const REPORT_REINVESTMENT_QUOTA: SourcedRate = {
  value: 0.7,
  unit: 'ratio',
  source: 'CGI art. 150-0 B ter, I-2° (loi n° 2026-103 du 19 février 2026, art. 11) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542872',
  asOf: '2026-09-21',
  status: 'verified',
};

export const REPORT_REINVESTMENT_WINDOW_YEARS: SourcedRate = {
  value: 3,
  unit: 'years',
  source: 'CGI art. 150-0 B ter, I-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542872',
  asOf: '2026-09-21',
  status: 'verified',
};

export const REPORT_REINVESTMENT_HOLDING_YEARS: SourcedRate = {
  value: 5,
  unit: 'years',
  source: 'CGI art. 150-0 B ter, I-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542872',
  asOf: '2026-09-21',
  status: 'verified',
};

/** Présomption de contrôle de la société bénéficiaire de l'apport. */
export const REPORT_CONTROL_PRESUMPTION_PCT: SourcedRate = {
  value: 0.3333,
  unit: 'ratio',
  source: 'CGI art. 150-0 B ter, III — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542872',
  asOf: '2026-09-21',
  status: 'verified',
};

/** Donation des titres reçus : purge du report après ce délai de conservation. */
export const REPORT_DONATION_PURGE_YEARS: SourcedRate = {
  value: 6,
  unit: 'years',
  source: 'CGI art. 150-0 B ter, II — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542872',
  asOf: '2026-09-21',
  status: 'verified',
};

/** Porté à 11 ans lorsque le remploi a transité par un fonds (d du 2°). */
export const REPORT_DONATION_PURGE_YEARS_FUND: SourcedRate = {
  value: 11,
  unit: 'years',
  source: 'CGI art. 150-0 B ter, II et I-2°-d — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542872',
  asOf: '2026-09-21',
  status: 'verified',
};

/** Intérêt de retard dû en cas de déchéance du report. */
export const LATE_INTEREST_MONTHLY_RATE: SourcedRate = {
  value: 0.002,
  unit: 'ratio',
  source: 'CGI art. 1727, III (abrogation différée au 01/01/2027) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051213330',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- P5 : démembrement ---------------------------------------------------- */

/** Usufruit à durée fixe : 23 % par période de dix ans entamée, sans égard à l'âge. */
export const USUFRUIT_TEMPORAIRE_SHARE_PER_DECADE: SourcedRate = {
  value: 0.23,
  unit: 'ratio',
  source: 'CGI art. 669, II — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006310173',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Barème viager : `upTo` = âge révolu de l'usufruitier, `rate` = quotité d'usufruit. */
export const USUFRUIT_VIAGER_BAREME: SourcedRate<TaxBracket[]> = {
  value: [
    { upTo: 21, rate: 0.9 },
    { upTo: 31, rate: 0.8 },
    { upTo: 41, rate: 0.7 },
    { upTo: 51, rate: 0.6 },
    { upTo: 61, rate: 0.5 },
    { upTo: 71, rate: 0.4 },
    { upTo: 81, rate: 0.3 },
    { upTo: 91, rate: 0.2 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.1 },
  ],
  unit: 'ratio',
  source: 'CGI art. 669, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000006310173',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- P7 : transmission ---------------------------------------------------- */

export const DUTREIL_EXEMPTION_RATE: SourcedRate = {
  value: 0.75,
  unit: 'ratio',
  source: 'CGI art. 787 B al. 1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542700',
  asOf: '2026-09-22',
  status: 'verified',
};

export const DUTREIL_COLLECTIVE_YEARS: SourcedRate = {
  value: 2,
  unit: 'years',
  source: 'CGI art. 787 B, a — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542700',
  asOf: '2026-09-22',
  status: 'verified',
};

/**
 * Engagement individuel : **six** ans depuis la version en vigueur au 21/02/2026
 * (et non quatre comme dans les versions antérieures).
 */
export const DUTREIL_INDIVIDUAL_YEARS: SourcedRate = {
  value: 6,
  unit: 'years',
  source: 'CGI art. 787 B, c — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542700',
  asOf: '2026-09-22',
  status: 'verified',
};

export const DMTG_DIRECT_LINE_ABATEMENT_EUR: SourcedRate = {
  value: 100_000,
  unit: 'eur',
  source: 'CGI art. 779, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000026292566',
  asOf: '2026-09-22',
  status: 'verified',
};

export const DMTG_ABATEMENT_RENEWAL_YEARS: SourcedRate = {
  value: 15,
  unit: 'years',
  source: 'CGI art. 784 al. 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000033809289',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Tarif des droits de mutation à titre gratuit en ligne directe (tableau I). */
export const DMTG_DIRECT_LINE_BRACKETS: SourcedRate<TaxBracket[]> = {
  value: [
    { upTo: 8_072, rate: 0.05 },
    { upTo: 12_109, rate: 0.1 },
    { upTo: 15_932, rate: 0.15 },
    { upTo: 552_324, rate: 0.2 },
    { upTo: 902_838, rate: 0.3 },
    { upTo: 1_805_677, rate: 0.4 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.45 },
  ],
  unit: 'ratio',
  source: 'CGI art. 777, tableau I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030061736',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- P6 : IFI ------------------------------------------------------------- */

export const IFI_THRESHOLD_EUR: SourcedRate = {
  value: 1_300_000,
  unit: 'eur',
  source: 'CGI art. 964 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036384999',
  asOf: '2026-09-22',
  status: 'verified',
};

export const IFI_BRACKETS: SourcedRate<TaxBracket[]> = {
  value: [
    { upTo: 800_000, rate: 0 },
    { upTo: 1_300_000, rate: 0.005 },
    { upTo: 2_570_000, rate: 0.007 },
    { upTo: 5_000_000, rate: 0.01 },
    { upTo: 10_000_000, rate: 0.0125 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.015 },
  ],
  unit: 'ratio',
  source: 'CGI art. 977, 1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036385041',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Décote : 17 500 € − 1,25 % P, entre 1 300 000 € et 1 400 000 €. */
export const IFI_DECOTE_BASE_EUR: SourcedRate = {
  value: 17_500,
  unit: 'eur',
  source: 'CGI art. 977, 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036385041',
  asOf: '2026-09-22',
  status: 'verified',
};

export const IFI_DECOTE_SLOPE: SourcedRate = {
  value: 0.0125,
  unit: 'ratio',
  source: 'CGI art. 977, 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000036385041',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- P8 : location meublée ------------------------------------------------ */

/** Seuil de recettes du meublé professionnel, cumulatif avec la prépondérance. */
export const LMP_RECEIPTS_THRESHOLD_EUR: SourcedRate = {
  value: 23_000,
  unit: 'eur',
  source: 'CGI art. 155, IV-2-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053544949',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Déficit du meublé non professionnel : imputable 10 ans sur la même catégorie. */
export const LMNP_DEFICIT_CARRY_YEARS: SourcedRate = {
  value: 10,
  unit: 'years',
  source: 'CGI art. 156, I-1° ter — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054373682',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Preuves attendues d'une holding animatrice — liste affichée, jamais présumée. */
export const ANIMATRICE_EVIDENCE: readonly string[] = [
  'Convention d’animation écrite, datée et signée avec chaque filiale.',
  'Participation effective à la conduite de la politique du groupe (procès-verbaux, comités).',
  'Prestations administratives, juridiques, comptables ou financières réellement rendues et facturées.',
  'Moyens humains et matériels propres à la holding (personnel, locaux).',
  'Contrôle des filiales : détention et droits de vote documentés.',
] as const;

/* ------------------------------------------------------------------------ *
 * Lot 2026 : contribution différentielle, taxe sur les holdings, amendement
 * Charasse, PER, mécénat, plus-value immobilière des particuliers.
 * Valeurs relevées sur Légifrance le 2026-09-22, version en vigueur.
 * ------------------------------------------------------------------------ */

/* ---- Contribution différentielle sur les hauts revenus (CGI art. 224) ----- */

export const CDHR_RATE: SourcedRate = {
  value: 0.2,
  unit: 'ratio',
  source: 'CGI art. 224, III-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

export const CDHR_THRESHOLD_SINGLE_EUR: SourcedRate = {
  value: 250_000,
  unit: 'eur',
  source: 'CGI art. 224, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

export const CDHR_THRESHOLD_COUPLE_EUR: SourcedRate = {
  value: 500_000,
  unit: 'eur',
  source: 'CGI art. 224, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Lissage : la contribution est atténuée jusqu'à ce plafond de revenu. */
export const CDHR_SMOOTHING_CEILING_SINGLE_EUR: SourcedRate = {
  value: 330_000,
  unit: 'eur',
  source: 'CGI art. 224, V — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

export const CDHR_SMOOTHING_CEILING_COUPLE_EUR: SourcedRate = {
  value: 660_000,
  unit: 'eur',
  source: 'CGI art. 224, V — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

export const CDHR_SMOOTHING_SLOPE: SourcedRate = {
  value: 0.825,
  unit: 'ratio',
  source: 'CGI art. 224, V — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

export const CDHR_ALLOWANCE_PER_DEPENDENT_EUR: SourcedRate = {
  value: 1_500,
  unit: 'eur',
  source: 'CGI art. 224, III-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

export const CDHR_ALLOWANCE_COUPLE_EUR: SourcedRate = {
  value: 12_500,
  unit: 'eur',
  source: 'CGI art. 224, III-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053561826',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- Taxe sur les actifs non professionnels des holdings (art. 235 ter C) - */

export const HOLDING_ASSET_TAX_RATE: SourcedRate = {
  value: 0.2,
  unit: 'ratio',
  source: 'CGI art. 235 ter C, IV — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542687',
  asOf: '2026-09-22',
  status: 'verified',
};

export const HOLDING_ASSET_TAX_THRESHOLD_EUR: SourcedRate = {
  value: 5_000_000,
  unit: 'eur',
  source: 'CGI art. 235 ter C, I-A-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542687',
  asOf: '2026-09-22',
  status: 'verified',
};

export const HOLDING_ASSET_TAX_CONTROL_PCT: SourcedRate = {
  value: 0.5,
  unit: 'ratio',
  source: 'CGI art. 235 ter C, I-A-2° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542687',
  asOf: '2026-09-22',
  status: 'verified',
};

export const HOLDING_ASSET_TAX_PASSIVE_SHARE: SourcedRate = {
  value: 0.5,
  unit: 'ratio',
  source: 'CGI art. 235 ter C, I-A-3° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542687',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- Amendement Charasse (CGI art. 223 B) --------------------------------- */

/** Exercice d'acquisition des titres + huit exercices suivants. */
export const CHARASSE_REINTEGRATION_YEARS: SourcedRate = {
  value: 9,
  unit: 'years',
  source: 'CGI art. 223 B al. 6 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048831317',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- Plan d'épargne retraite (CGI art. 163 quatervicies) ------------------ */

export const PER_DEDUCTION_RATE: SourcedRate = {
  value: 0.1,
  unit: 'ratio',
  source: 'CGI art. 163 quatervicies, I-2-a-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542827',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Les revenus d'activité sont retenus dans la limite de huit PASS. */
export const PER_INCOME_CAP_PASS: SourcedRate = {
  value: 8,
  unit: 'ratio',
  source: 'CGI art. 163 quatervicies, I-2-a-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542827',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Fraction non utilisée du plafond, reportable sur les cinq années suivantes. */
export const PER_CARRY_YEARS: SourcedRate = {
  value: 5,
  unit: 'years',
  source: 'CGI art. 163 quatervicies, I-2-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053542827',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- Mécénat d'entreprise (CGI art. 238 bis) ------------------------------ */

export const MECENAT_RATE: SourcedRate = {
  value: 0.6,
  unit: 'ratio',
  source: 'CGI art. 238 bis, 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054402913',
  asOf: '2026-09-22',
  status: 'verified',
};

export const MECENAT_RATE_ABOVE_THRESHOLD: SourcedRate = {
  value: 0.4,
  unit: 'ratio',
  source: 'CGI art. 238 bis, 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054402913',
  asOf: '2026-09-22',
  status: 'verified',
};

export const MECENAT_RATE_THRESHOLD_EUR: SourcedRate = {
  value: 2_000_000,
  unit: 'eur',
  source: 'CGI art. 238 bis, 2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054402913',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Plafond des versements retenus : 20 000 € ou 5 ‰ du CA si plus élevé. */
export const MECENAT_CAP_FLOOR_EUR: SourcedRate = {
  value: 20_000,
  unit: 'eur',
  source: 'CGI art. 238 bis, 3 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054402913',
  asOf: '2026-09-22',
  status: 'verified',
};

export const MECENAT_CAP_REVENUE_SHARE: SourcedRate = {
  value: 0.005,
  unit: 'ratio',
  source: 'CGI art. 238 bis, 3 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054402913',
  asOf: '2026-09-22',
  status: 'verified',
};

export const MECENAT_CARRY_YEARS: SourcedRate = {
  value: 5,
  unit: 'years',
  source: 'CGI art. 238 bis, 3 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054402913',
  asOf: '2026-09-22',
  status: 'verified',
};

/* ---- Plus-value immobilière des particuliers ------------------------------ */

export const PROPERTY_GAIN_IR_RATE: SourcedRate = {
  value: 0.19,
  unit: 'ratio',
  source: 'CGI art. 200 B — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000030061684',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Frais d'acquisition, forfait applicable aux immeubles. */
export const PROPERTY_ACQUISITION_COSTS_FLAT: SourcedRate = {
  value: 0.075,
  unit: 'ratio',
  source: 'CGI art. 150 VB, II-3° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053544785',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Forfait travaux, ouvert au-delà de cinq ans de détention, à défaut de justificatifs. */
export const PROPERTY_WORKS_FLAT: SourcedRate = {
  value: 0.15,
  unit: 'ratio',
  source: 'CGI art. 150 VB, II-4° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053544785',
  asOf: '2026-09-22',
  status: 'verified',
};

export const PROPERTY_WORKS_FLAT_MIN_YEARS: SourcedRate = {
  value: 5,
  unit: 'years',
  source: 'CGI art. 150 VB, II-4° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053544785',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Cession d'un prix inférieur ou égal à ce montant : exonérée. */
export const PROPERTY_SMALL_SALE_EXEMPTION_EUR: SourcedRate = {
  value: 15_000,
  unit: 'eur',
  source: 'CGI art. 150 U, II-6° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053544910',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Abattement d'impôt sur le revenu : 6 %/an au-delà de la 5e, 4 % la 22e → exonéré à 22 ans. */
export const PROPERTY_ALLOWANCE_IR_PER_YEAR: SourcedRate = {
  value: 0.06,
  unit: 'ratio',
  source: 'CGI art. 150 VC, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047970756',
  asOf: '2026-09-22',
  status: 'verified',
};

export const PROPERTY_ALLOWANCE_IR_YEAR_22: SourcedRate = {
  value: 0.04,
  unit: 'ratio',
  source: 'CGI art. 150 VC, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000047970756',
  asOf: '2026-09-22',
  status: 'verified',
};

/** Abattement de prélèvements sociaux : 1,65 %, puis 1,60 % la 22e, puis 9 % → exonéré à 30 ans. */
export const PROPERTY_ALLOWANCE_PS_PER_YEAR: SourcedRate = {
  value: 0.0165,
  unit: 'ratio',
  source: 'CSS art. L136-7, VI-2 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053584839',
  asOf: '2026-09-22',
  status: 'verified',
};

export const PROPERTY_ALLOWANCE_PS_YEAR_22: SourcedRate = {
  value: 0.016,
  unit: 'ratio',
  source: 'CSS art. L136-7, VI-2-b — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053584839',
  asOf: '2026-09-22',
  status: 'verified',
};

export const PROPERTY_ALLOWANCE_PS_BEYOND_22: SourcedRate = {
  value: 0.09,
  unit: 'ratio',
  source: 'CSS art. L136-7, VI-2-c — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000053584839',
  asOf: '2026-09-22',
  status: 'verified',
};

/**
 * Surtaxe sur les plus-values immobilières supérieures à 50 000 €.
 * `rate` s'applique à la plus-value entière ; `smoothing` lisse l'entrée de
 * tranche en retranchant `(upTo − PV) × smoothing`.
 */
export interface PropertySurtaxBracket {
  upTo: number;
  rate: number;
  smoothing?: number;
}

export const PROPERTY_SURTAX_BRACKETS: SourcedRate<PropertySurtaxBracket[]> = {
  value: [
    { upTo: 50_000, rate: 0 },
    { upTo: 60_000, rate: 0.02, smoothing: 1 / 20 },
    { upTo: 100_000, rate: 0.02 },
    { upTo: 110_000, rate: 0.03, smoothing: 1 / 10 },
    { upTo: 150_000, rate: 0.03 },
    { upTo: 160_000, rate: 0.04, smoothing: 15 / 100 },
    { upTo: 200_000, rate: 0.04 },
    { upTo: 210_000, rate: 0.05, smoothing: 20 / 100 },
    { upTo: 250_000, rate: 0.05 },
    { upTo: 260_000, rate: 0.06, smoothing: 25 / 100 },
    { upTo: Number.POSITIVE_INFINITY, rate: 0.06 },
  ],
  unit: 'ratio',
  source: 'CGI art. 1609 nonies G, III — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000048806252',
  asOf: '2026-09-22',
  status: 'verified',
};
