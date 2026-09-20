/**
 * Cotisations des travailleurs indépendants (gérant majoritaire, EI au réel) —
 * méthode 2026 : assiette unique après abattement de 26 % (LFSS 2024, art. 18),
 * puis barème par branche. Sourcé sur Légifrance le 2026-09-20.
 */
import type { SourcedRate } from '../types';

/** Plafond annuel de la sécurité sociale 2026 : 4 005 € × 12. */
export const PASS_2026_EUR: SourcedRate = {
  value: 48_060,
  unit: 'eur',
  source:
    'Arrêté du 22 décembre 2025 portant fixation du plafond de la sécurité sociale pour 2026 (CSS art. D242-17) — https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000053143451',
  asOf: '2025-12-23',
  status: 'verified',
};

/** Abattement forfaitaire sur l'assiette des cotisations et de la CSG des indépendants. */
export const TNS_ASSIETTE_ABATTEMENT: SourcedRate = {
  value: 0.26,
  unit: 'ratio',
  source:
    'CSS art. L136-3, III (loi n° 2023-1250 art. 18, applicable aux cotisations 2025+) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000051284498',
  asOf: '2026-09-20',
  status: 'verified',
};

/**
 * Bornes de l'abattement : la loi renvoie à un décret (plancher ≤ assiette minimale
 * retraite, plafond ≥ PASS). Le décret n° 2025-708 n'a pas pu être lu sur Légifrance
 * via l'outil : valeurs usuelles retenues, à confirmer.
 */
export const TNS_ABATTEMENT_FLOOR_EUR: SourcedRate = {
  value: Math.round(PASS_2026_EUR.value * 0.0176),
  unit: 'eur',
  source: 'Décret n° 2025-708 du 25 juillet 2025 (plancher = 1,76 % du PASS) — non relu, valeur usuelle',
  asOf: '2026-09-20',
  status: 'assumed',
};
export const TNS_ABATTEMENT_CEILING_EUR: SourcedRate = {
  value: Math.round(PASS_2026_EUR.value * 1.3),
  unit: 'eur',
  source: 'Décret n° 2025-708 du 25 juillet 2025 (plafond = 130 % du PASS) — non relu, valeur usuelle',
  asOf: '2026-09-20',
  status: 'assumed',
};

/** Point du barème dégressif maladie : à `atPass` × PASS d'assiette, le taux vaut `rate`. */
export interface RateStep { atPass: number; rate: number }

/**
 * Maladie-maternité : taux nul sous 20 % du PASS, croissant par paliers linéaires
 * jusqu'à 8,5 % à 3 PASS ; 6,5 % sur la part au-delà de 3 PASS.
 */
export const TNS_MALADIE_STEPS: SourcedRate<RateStep[]> = {
  value: [
    { atPass: 0.2, rate: 0 },
    { atPass: 0.4, rate: 0.015 },
    { atPass: 0.6, rate: 0.04 },
    { atPass: 1.1, rate: 0.065 },
    { atPass: 2, rate: 0.077 },
    { atPass: 3, rate: 0.085 },
  ],
  unit: 'ratio',
  source:
    'CSS art. D621-1 et D621-2 (décret n° 2024-688) — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904610 ; https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904592',
  asOf: '2026-09-20',
  status: 'verified',
};
export const TNS_MALADIE_ABOVE_3_PASS: SourcedRate = {
  value: 0.065,
  unit: 'ratio',
  source: 'CSS art. D621-1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904610',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Indemnités journalières : 0,50 % jusqu'à 5 PASS (artisans-commerçants). */
export const TNS_IJ_RATE: SourcedRate = {
  value: 0.005,
  unit: 'ratio',
  source: 'CSS art. D621-3, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904537',
  asOf: '2026-09-20',
  status: 'verified',
};
export const TNS_IJ_CEILING_PASS = 5;

/** Retraite de base : 17,15 % sous le PASS, 0,72 % sur la totalité. */
export const TNS_RETRAITE_BASE_PLAFONNEE: SourcedRate = {
  value: 0.1715,
  unit: 'ratio',
  source: 'CSS art. D633-3, I — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904636',
  asOf: '2026-09-20',
  status: 'verified',
};
export const TNS_RETRAITE_BASE_DEPLAFONNEE: SourcedRate = {
  value: 0.0072,
  unit: 'ratio',
  source: 'CSS art. D633-3, II — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000049904636',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Retraite complémentaire des indépendants (RCI) : 7 % sous le PASS, 8 % de 1 à 4 PASS. Taux fixés par arrêté. */
export const TNS_RCI_T1: SourcedRate = {
  value: 0.07,
  unit: 'ratio',
  source: 'Règlement du RCI, taux fixé par arrêté (CSS art. L635-1 / D635-9) — non relu, valeur usuelle',
  asOf: '2026-09-20',
  status: 'assumed',
};
export const TNS_RCI_T2: SourcedRate = {
  value: 0.08,
  unit: 'ratio',
  source: 'Règlement du RCI, taux fixé par arrêté (CSS art. L635-1 / D635-9) — non relu, valeur usuelle',
  asOf: '2026-09-20',
  status: 'assumed',
};
export const TNS_RCI_CEILING_PASS = 4;

/** Invalidité-décès : 1,3 % sous le PASS, assiette minimale 11,5 % du PASS. */
export const TNS_INVALIDITE_DECES_RATE: SourcedRate = {
  value: 0.013,
  unit: 'ratio',
  source: 'Taux fixé par arrêté (CSS art. L632-1) — non relu, valeur usuelle ; assiette : CSS art. D632-1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041966755',
  asOf: '2026-09-20',
  status: 'assumed',
};
export const TNS_INVALIDITE_DECES_FLOOR_PASS: SourcedRate = {
  value: 0.115,
  unit: 'ratio',
  source: 'CSS art. D632-1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041966755',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Allocations familiales : 0 % jusqu'à 1,1 PASS, linéaire jusqu'à 3,1 % à 1,4 PASS. */
export const TNS_AF_MAX_RATE: SourcedRate = {
  value: 0.031,
  unit: 'ratio',
  source: 'CSS art. D613-1 — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000041966324',
  asOf: '2026-09-20',
  status: 'verified',
};
export const TNS_AF_START_PASS = 1.1;
export const TNS_AF_FULL_PASS = 1.4;

/** CSG 9,2 % + CRDS 0,5 % sur l'assiette abattue (pas d'abattement de 1,75 % pour les indépendants). */
export const TNS_CSG_CRDS_RATE: SourcedRate = {
  value: 0.092 + 0.005,
  unit: 'ratio',
  source:
    'CSS art. L136-8, I-1° — https://www.legifrance.gouv.fr/codes/article_lc/LEGIARTI000054336623 ; CRDS : ordonnance n° 96-50 art. 14 et 19',
  asOf: '2026-09-20',
  status: 'verified',
};

/** Contribution à la formation professionnelle : 0,25 % du PASS, forfaitaire. */
export const TNS_FORMATION_RATE_OF_PASS: SourcedRate = {
  value: 0.0025,
  unit: 'ratio',
  source: 'Code du travail art. L6331-48 (0,25 % du PASS commerçants) — non relu, valeur usuelle',
  asOf: '2026-09-20',
  status: 'assumed',
};
