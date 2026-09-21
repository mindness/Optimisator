/**
 * Comparateur de structures : à CA, charges et foyer constants, combien reste-t-il
 * net dans la poche du dirigeant selon la forme juridique et le régime retenus ?
 *
 * Module pur, volontairement séparé de `graphResolver` : ce dernier résout un
 * graphe SASU-centré à topologie donnée, là où le comparateur fait varier la
 * structure elle-même. Chaque structure est évaluée à son propre optimum de
 * partage rémunération / dividendes (balayage), donc les lignes se comparent
 * à armes égales et non à politique de distribution imposée.
 *
 * Toutes les limites du modèle sont listées dans `STRUCTURE_BLIND_SPOTS` : ce
 * classement est une simulation, jamais un conseil fiscal ou juridique.
 */
import {
  calculateCorporateTax,
  calculateDividendTax,
  calculateExecutiveSalary,
  calculateMicroEnterprise,
  calculateMotherDaughterDividend,
  calculatePersonalIncomeTax,
  calculateTnsContributions,
  calculateTnsDividendSurcharge,
  compareDividendTaxModes,
  roundMoney,
  type DividendTaxMode,
  type FiscalSituation,
} from './calculator';
import {
  IS_REDUCED_CA_CEILING_EUR,
  MICRO_BRACKETS_2026,
  URSSAF_EMPLOYEE_RATE_2026,
  URSSAF_EMPLOYER_RATE_2026,
  type MicroCategory,
} from './taxRules';

export type StructureId =
  | 'micro'
  | 'ei_ir'
  | 'eurl_is'
  | 'sasu'
  | 'sasu_holding';

export interface StructureComparisonInputs {
  caHt: number;
  /** Charges réelles déductibles, hors rémunération du dirigeant. */
  expensesHt?: number;
  parts?: number;
  situation?: FiscalSituation;
  /** Catégorie micro testée (défaut BNC). */
  microCategory?: MicroCategory;
  /** `auto` retient le régime de dividendes le moins coûteux, structure par structure. */
  dividendTaxMode?: DividendTaxMode | 'auto';
  /** Capital + primes + CCA, assiette de la franchise de 10 % des dividendes TNS. */
  capitalPrimesAndCca?: number;
  /** Revenus du foyer hors structure, déjà nets de leur abattement propre. */
  otherTaxableIncome?: number;
  /**
   * Coût annuel propre à chaque structure (expert-comptable, greffe, CFE…), saisi
   * par l'utilisateur : ajouté aux charges de la seule structure concernée.
   */
  structureCosts?: Partial<Record<StructureId, number>>;
}

export interface StructureOutcome {
  id: StructureId;
  label: string;
  /** Part du disponible versée en rémunération à l'optimum (0 → 1). */
  salaryRatio: number;
  /** CA − charges réelles : ce qu'il y a à répartir. */
  available: number;
  /** Cash encaissé par la personne au titre de la rémunération, avant IR. */
  salaryCash: number;
  /** Dividendes bruts distribués à la personne (après friction holding). */
  dividendGross: number;
  socialContributions: number;
  corporateTax: number;
  /** Prélèvements sociaux + IR portant sur les dividendes. */
  dividendTax: number;
  personalIncomeTax: number;
  marginalRate: number;
  dividendTaxMode: DividendTaxMode | 'none';
  netPersonal: number;
  /** Total des prélèvements / disponible. */
  effectiveRate: number;
  /** Faux si un seuil légal exclut la structure (plafond micro dépassé). */
  eligible: boolean;
  warnings: string[];
}

export interface StructureComparison {
  inputs: Required<Pick<StructureComparisonInputs, 'caHt' | 'expensesHt' | 'parts' | 'situation'>>;
  /** Structures éligibles d'abord, classées par net personnel décroissant. */
  outcomes: StructureOutcome[];
  best: StructureOutcome;
  /** Écart de net entre la meilleure et la deuxième structure éligible. */
  gainOverRunnerUp: number;
  blindSpots: string[];
}

export const STRUCTURE_BLIND_SPOTS: readonly string[] = [
  'Cotisations TNS modélisées par un taux plat : les branches SSI réelles ont des assiettes, plafonds et dégressivités distincts.',
  'Cotisations d’assimilé-salarié forfaitaires (pas de bulletin de paie, ni plafonds de sécurité sociale, ni allègements généraux).',
  'Coûts de structure (expert-comptable, greffe, CFE, assurances) : aucun barème légal, seuls les montants que vous saisissez par structure sont pris en compte ; frais de constitution hors modèle.',
  'Droits ouverts non valorisés : retraite, prévoyance et chômage diffèrent fortement entre assimilé-salarié et TNS.',
  'ACRE, versement libératoire de l’IR, exonérations de début d’activité et crédits d’impôt hors modèle.',
  'Holding évaluée en redistribution intégrale : sa valeur réelle tient au report d’imposition et au réinvestissement, non simulés ici.',
  'Année pleine unique, trésorerie initiale nulle, report déficitaire et lissage pluriannuel non pris en compte.',
  'TVA neutre pour le dirigeant, donc hors comparaison ; la franchise en base du micro ne l’est pas en pratique.',
];

/** Pas du balayage rémunération / dividendes. */
const SALARY_RATIO_STEP = 0.05;

const LABELS: Record<StructureId, string> = {
  micro: 'Micro-entreprise',
  ei_ir: 'EI ou EURL à l’IR (réel)',
  eurl_is: 'EURL / SARL à l’IS (gérant TNS)',
  sasu: 'SASU / SAS à l’IS (assimilé salarié)',
  sasu_holding: 'SASU + holding (mère-fille, redistribution intégrale)',
};

interface DividendOutcome {
  mode: DividendTaxMode | 'none';
  tax: number;
  /** Assiette ajoutée au revenu global si l'option barème est retenue. */
  baremeBase: number;
}

/** Impose un dividende personnel selon le mode demandé, ou l'optimum à TMI donnée. */
function taxDividend(
  gross: number,
  marginalRate: number,
  requested: DividendTaxMode | 'auto',
): DividendOutcome {
  if (gross <= 0) return { mode: 'none', tax: 0, baremeBase: 0 };

  const mode = requested === 'auto'
    ? compareDividendTaxModes(gross, marginalRate).best.mode
    : requested;
  const taxed = calculateDividendTax(gross, mode, marginalRate);

  return {
    mode,
    tax: taxed.totalTax,
    baremeBase: mode === 'bareme' ? taxed.taxableBase : 0,
  };
}

/**
 * Structure à l'IS : la rémunération est déductible, le solde subit l'IS puis
 * la fiscalité des dividendes. `socialKind` commande l'écart décisif entre
 * l'assimilé-salarié (cotisations lourdes, dividendes hors SSI) et le gérant
 * majoritaire TNS (cotisations plus légères, mais règle des 10 %).
 */
function evaluateIsStructure(
  id: 'eurl_is' | 'sasu' | 'sasu_holding',
  salaryRatio: number,
  inputs: Required<Pick<StructureComparisonInputs, 'caHt' | 'expensesHt' | 'parts' | 'situation' | 'capitalPrimesAndCca' | 'otherTaxableIncome'>> & { dividendTaxMode: DividendTaxMode | 'auto' },
): StructureOutcome {
  const available = roundMoney(Math.max(0, inputs.caHt - inputs.expensesHt));
  const budget = roundMoney(available * salaryRatio);
  const isTns = id === 'eurl_is';
  const warnings: string[] = [];

  let salaryCash: number;
  let salaryTaxableBeforeAllowance: number;
  let socialContributions: number;
  let salaryCompanyCost: number;

  if (isTns) {
    // Le coût pour la société est la rémunération elle-même ; les cotisations
    // s'imputent sur le revenu du gérant (déductibles de son imposable).
    const tns = calculateTnsContributions(budget);
    socialContributions = tns.contributions;
    salaryCash = tns.netAfterContributions;
    salaryTaxableBeforeAllowance = tns.netAfterContributions;
    salaryCompanyCost = budget;
  } else {
    const gross = roundMoney(budget / (1 + URSSAF_EMPLOYER_RATE_2026.value));
    const net = roundMoney(gross * (1 - URSSAF_EMPLOYEE_RATE_2026.value));
    const salary = calculateExecutiveSalary(net);
    socialContributions = roundMoney(salary.employerCharges + salary.employeeCharges);
    salaryCash = net;
    salaryTaxableBeforeAllowance = salary.netImposable;
    salaryCompanyCost = salary.totalCompanyCost;
  }

  const taxableIncome = roundMoney(available - salaryCompanyCost);
  const corporate = calculateCorporateTax(taxableIncome, inputs.caHt <= IS_REDUCED_CA_CEILING_EUR.value);
  const distributable = roundMoney(Math.max(0, corporate.netProfit));

  // Une holding intercalée acquitte l'IS sur la quote-part de frais et charges
  // avant de redistribuer (CGI art. 145 / 216).
  const holdingFriction = id === 'sasu_holding'
    ? roundMoney(distributable - calculateMotherDaughterDividend(distributable).netCashInHolding)
    : 0;
  const dividendGross = roundMoney(distributable - holdingFriction);

  // Règle des 10 % (CSS art. L131-6) : la fraction excédentaire quitte la
  // fiscalité du capital pour l'assiette sociale et le barème de l'IR.
  const surcharge = isTns
    ? calculateTnsDividendSurcharge(dividendGross, inputs.capitalPrimesAndCca)
    : { exemptThreshold: 0, subjectToContributions: 0, contributions: 0 };
  const capitalDividend = roundMoney(dividendGross - surcharge.subjectToContributions);
  const socialisedDividendTaxable = roundMoney(
    surcharge.subjectToContributions - surcharge.contributions,
  );

  // TMI de référence : revenus hors dividendes de capitaux mobiliers.
  const baseIncomeTax = calculatePersonalIncomeTax(salaryTaxableBeforeAllowance, inputs.parts, {
    situation: inputs.situation,
    otherTaxableIncome: roundMoney(inputs.otherTaxableIncome + socialisedDividendTaxable),
  });
  const dividend = taxDividend(capitalDividend, baseIncomeTax.marginalRate, inputs.dividendTaxMode);
  const incomeTax = dividend.baremeBase > 0
    ? calculatePersonalIncomeTax(salaryTaxableBeforeAllowance, inputs.parts, {
        situation: inputs.situation,
        otherTaxableIncome: roundMoney(
          inputs.otherTaxableIncome + socialisedDividendTaxable + dividend.baremeBase,
        ),
      })
    : baseIncomeTax;

  if (isTns && surcharge.subjectToContributions > 0) {
    warnings.push(
      `Dividendes assujettis aux cotisations SSI au-delà de 10 % du capital (CSS art. L131-6) : ${roundMoney(surcharge.subjectToContributions)} €.`,
    );
  }
  if (taxableIncome < 0) {
    warnings.push('Rémunération supérieure au résultat disponible : déficit non reportable dans ce modèle annuel.');
  }
  if (id === 'sasu_holding') {
    warnings.push('Redistribution intégrale simulée : la holding n’a d’intérêt que si le cash y est réinvesti ou capitalisé.');
  }

  const netPersonal = roundMoney(
    salaryCash + dividendGross - surcharge.contributions - dividend.tax - incomeTax.taxDue,
  );

  return {
    id,
    label: LABELS[id],
    salaryRatio,
    available,
    salaryCash,
    dividendGross,
    socialContributions: roundMoney(socialContributions + surcharge.contributions),
    corporateTax: roundMoney(corporate.taxDue + holdingFriction),
    dividendTax: dividend.tax,
    personalIncomeTax: incomeTax.taxDue,
    marginalRate: incomeTax.marginalRate,
    dividendTaxMode: dividend.mode,
    netPersonal,
    effectiveRate: available > 0 ? roundMoney((available - netPersonal) / available * 10_000) / 10_000 : 0,
    eligible: true,
    warnings,
  };
}

/** Meilleur partage rémunération / dividendes pour une structure à l'IS. */
function optimiseIsStructure(
  id: 'eurl_is' | 'sasu' | 'sasu_holding',
  inputs: Parameters<typeof evaluateIsStructure>[2],
): StructureOutcome {
  let best = evaluateIsStructure(id, 0, inputs);
  for (let ratio = SALARY_RATIO_STEP; ratio <= 1 + 1e-9; ratio += SALARY_RATIO_STEP) {
    const candidate = evaluateIsStructure(id, roundMoney(ratio), inputs);
    if (candidate.netPersonal > best.netPersonal) best = candidate;
  }
  return best;
}

function evaluateMicro(
  category: MicroCategory,
  inputs: Required<Pick<StructureComparisonInputs, 'caHt' | 'expensesHt' | 'parts' | 'situation' | 'otherTaxableIncome'>>,
): StructureOutcome {
  const micro = calculateMicroEnterprise(inputs.caHt, category);
  const incomeTax = calculatePersonalIncomeTax(0, inputs.parts, {
    situation: inputs.situation,
    otherTaxableIncome: roundMoney(inputs.otherTaxableIncome + micro.taxableProfit),
  });
  const available = roundMoney(Math.max(0, inputs.caHt - inputs.expensesHt));
  const netPersonal = roundMoney(micro.cashBeforeIr - inputs.expensesHt - incomeTax.taxDue);
  const warnings: string[] = [
    `Abattement forfaitaire de ${Math.round(MICRO_BRACKETS_2026[category].allowance * 100)} % au lieu des charges réelles ; les cotisations portent sur le CA brut, dues même à perte.`,
  ];
  if (micro.ceilingExceeded) {
    warnings.push(`Plafond de ${micro.ceilingEur} € dépassé : le régime micro n’est pas applicable à ce CA.`);
  }
  if (inputs.expensesHt > 0) {
    warnings.push('Charges réelles retranchées du cash mais non déductibles fiscalement : c’est précisément le point de bascule du micro.');
  }

  return {
    id: 'micro',
    label: `${LABELS.micro} — ${MICRO_BRACKETS_2026[category].label}`,
    salaryRatio: 1,
    available,
    salaryCash: micro.cashBeforeIr,
    dividendGross: 0,
    socialContributions: micro.socialContributions,
    corporateTax: 0,
    dividendTax: 0,
    personalIncomeTax: incomeTax.taxDue,
    marginalRate: incomeTax.marginalRate,
    dividendTaxMode: 'none',
    netPersonal,
    effectiveRate: available > 0 ? roundMoney((available - netPersonal) / available * 10_000) / 10_000 : 0,
    eligible: !micro.ceilingExceeded,
    warnings,
  };
}

function evaluateEiIr(
  inputs: Required<Pick<StructureComparisonInputs, 'caHt' | 'expensesHt' | 'parts' | 'situation' | 'otherTaxableIncome'>>,
): StructureOutcome {
  const available = roundMoney(Math.max(0, inputs.caHt - inputs.expensesHt));
  const tns = calculateTnsContributions(available);
  const incomeTax = calculatePersonalIncomeTax(0, inputs.parts, {
    situation: inputs.situation,
    otherTaxableIncome: roundMoney(inputs.otherTaxableIncome + Math.max(0, tns.netAfterContributions)),
  });

  const netPersonal = roundMoney(tns.netAfterContributions - incomeTax.taxDue);

  return {
    id: 'ei_ir',
    label: LABELS.ei_ir,
    salaryRatio: 1,
    available,
    salaryCash: tns.netAfterContributions,
    dividendGross: 0,
    socialContributions: tns.contributions,
    corporateTax: 0,
    dividendTax: 0,
    personalIncomeTax: incomeTax.taxDue,
    marginalRate: incomeTax.marginalRate,
    dividendTaxMode: 'none',
    netPersonal,
    effectiveRate: available > 0 ? roundMoney((available - netPersonal) / available * 10_000) / 10_000 : 0,
    eligible: true,
    warnings: [
      'Intégralité du bénéfice imposée à l’IR, qu’elle soit prélevée ou laissée dans l’entreprise : aucun pilotage du revenu imposable.',
      'Pas d’abattement de 10 % ni de déduction pour frais réels au-delà des charges saisies.',
    ],
  };
}

/**
 * Classe les structures par net personnel décroissant, chacune évaluée à son
 * propre optimum de partage rémunération / dividendes.
 */
export function compareStructures(inputs: StructureComparisonInputs): StructureComparison {
  const resolved = {
    caHt: Math.max(0, inputs.caHt),
    expensesHt: Math.max(0, inputs.expensesHt ?? 0),
    parts: Math.max(1, inputs.parts ?? 1),
    situation: inputs.situation ?? ('single' as FiscalSituation),
    capitalPrimesAndCca: Math.max(0, inputs.capitalPrimesAndCca ?? 0),
    otherTaxableIncome: Math.max(0, inputs.otherTaxableIncome ?? 0),
    dividendTaxMode: inputs.dividendTaxMode ?? ('auto' as const),
  };

  const withCost = (id: StructureId) => ({
    ...resolved,
    expensesHt: resolved.expensesHt + Math.max(0, inputs.structureCosts?.[id] ?? 0),
  });

  const outcomes: StructureOutcome[] = [
    evaluateMicro(inputs.microCategory ?? 'bnc', withCost('micro')),
    evaluateEiIr(withCost('ei_ir')),
    optimiseIsStructure('eurl_is', withCost('eurl_is')),
    optimiseIsStructure('sasu', withCost('sasu')),
    optimiseIsStructure('sasu_holding', withCost('sasu_holding')),
  ].sort((a, b) => {
    if (a.eligible !== b.eligible) return a.eligible ? -1 : 1;
    return b.netPersonal - a.netPersonal;
  });

  const eligible = outcomes.filter((outcome) => outcome.eligible);
  const best = eligible[0] ?? outcomes[0]!;
  const runnerUp = eligible[1];

  return {
    inputs: {
      caHt: resolved.caHt,
      expensesHt: resolved.expensesHt,
      parts: resolved.parts,
      situation: resolved.situation,
    },
    outcomes,
    best,
    gainOverRunnerUp: runnerUp ? roundMoney(best.netPersonal - runnerUp.netPersonal) : 0,
    blindSpots: [...STRUCTURE_BLIND_SPOTS],
  };
}
