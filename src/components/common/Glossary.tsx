import type { ReactNode } from 'react';

import { formatEuro, formatPercent } from './MetricBadge';
import {
  IS_REDUCED_RATE,
  IS_REDUCED_THRESHOLD_EUR,
  IS_STANDARD_RATE,
  MOTHER_DAUGHTER_QPFC_RATE,
  PFU_IR_RATE,
  PFU_PS_RATE,
  PFU_TOTAL_RATE,
} from '@/core/engine';

const pct = (rate: { value: number }) => formatPercent(rate.value, 1);

/** Taux lus dans le moteur : le lexique ne peut pas annoncer un autre chiffre que celui calculé. */
const TERMS: ReadonlyArray<[term: string, definition: string]> = [
  ['HT', 'Hors taxes : le montant facturé avant TVA. La TVA collectée est reversée à l’État, elle n’est jamais un revenu.'],
  ['IS', `Impôt sur les sociétés, payé par la société sur son bénéfice : ${pct(IS_REDUCED_RATE)} jusqu’à ${formatEuro(IS_REDUCED_THRESHOLD_EUR.value)} (PME), ${pct(IS_STANDARD_RATE)} au-delà.`],
  ['IR et TMI', 'Impôt sur le revenu du foyer, calculé par tranches. La tranche marginale (TMI) est le taux de la dernière tranche atteinte : c’est le taux payé sur le prochain euro gagné, toujours plus haut que le taux moyen.'],
  ['PFU', `Prélèvement forfaitaire unique (« flat tax ») sur les dividendes : ${pct(PFU_IR_RATE)} d’impôt + ${pct(PFU_PS_RATE)} de prélèvements sociaux = ${pct(PFU_TOTAL_RATE)}. On peut lui préférer le barème de l’IR, avec un abattement de 40 %.`],
  ['URSSAF', 'Organisme qui collecte les cotisations sociales (retraite, maladie…) dues sur la rémunération du dirigeant.'],
  ['Assimilé salarié', 'Statut social du président de SAS / SASU : cotisations proches d’un salarié (sans assurance chômage), mais aucune sur les dividendes.'],
  ['TNS', 'Travailleur non salarié : statut du gérant majoritaire d’EURL / SARL. Cotisations plus légères, mais les dividendes au-delà de 10 % du capital y sont aussi soumis.'],
  ['CCA', 'Compte courant d’associé : argent que l’associé prête à sa société. Son remboursement n’est pas un revenu, donc pas imposé.'],
  ['Holding et mère-fille', `Société qui détient d’autres sociétés. Avec au moins 5 % du capital, les dividendes remontés sont exonérés d’IS sauf une quote-part de ${pct(MOTHER_DAUGHTER_QPFC_RATE)}.`],
  ['SCI', 'Société civile immobilière : porte un bien et encaisse les loyers. À l’IS elle amortit le bien ; à l’IR ses résultats sont imposés directement chez les associés.'],
];

/** Sigle → définition du lexique. IR et TMI partagent la même entrée. */
const SIGLES: Record<string, string> = Object.fromEntries(
  TERMS.flatMap(([term, definition]) => term.split(/ et | \/ /).map((sigle) => [sigle, definition] as const))
    .filter(([sigle]) => /^[A-Z]{2,}$/.test(sigle)),
);
const SIGLE_PATTERN = new RegExp(`\\b(${Object.keys(SIGLES).join('|')})\\b`, 'g');

/**
 * Enveloppe chaque sigle connu d'un libellé dans un `<abbr>` portant sa définition.
 * ponytail: infobulle native `title` — invisible au clavier et au tactile, où le Lexique
 * (même source) reste l'accès ; passer à un popover si ces usages comptent.
 */
export function annotate(text: string): ReactNode {
  const parts = text.split(SIGLE_PATTERN);
  if (parts.length === 1) return text;
  return parts.map((part, index) => (
    index % 2 === 1
      ? <abbr key={index} title={SIGLES[part]} className="cursor-help underline decoration-dotted underline-offset-2">{part}</abbr>
      : part
  ));
}

export function Glossary({ className = '' }: { className?: string }) {
  return (
    <details className={`disclosure text-xs text-fg-muted ${className}`.trim()}>
      <summary className="cursor-pointer text-xs font-medium text-fg-muted">Lexique ({TERMS.length} termes)</summary>
      <dl className="m-0 mt-2 space-y-2 leading-relaxed">
        {TERMS.map(([term, definition]) => (
          <div key={term}>
            <dt className="font-semibold text-fg">{term}</dt>
            <dd className="m-0">{definition}</dd>
          </div>
        ))}
      </dl>
    </details>
  );
}
