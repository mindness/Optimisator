import { annotate } from '@/components/common/Glossary';
import { formatEuro, formatPercent } from '@/components/common/MetricBadge';
import type { ResolvedScenario } from '@/core/engine/graphResolver';

const DIVIDEND_MODE_LABEL = { pfu: 'PFU (flat tax)', bareme: 'Barème progressif' } as const;

/** Document à emporter en rendez-vous : les chiffres de la simulation en cours, et ses limites. */
export const SynthesePreview = ({ name, resolved }: { name: string; resolved: ResolvedScenario }) => {
  const { summary, warnings } = resolved;
  const salary = summary.executiveSalary;
  const ir = summary.personalIncomeTax;
  const rows: ReadonlyArray<[label: string, value: string, strong?: boolean]> = [
    ['Chiffre d’affaires HT', formatEuro(summary.caHt)],
    ['Charges HT', formatEuro(-summary.expensesHt)],
    ['Coût total de la rémunération du dirigeant', formatEuro(-salary.totalCompanyCost)],
    ['dont cotisations sociales', formatEuro(salary.employerCharges + salary.employeeCharges)],
    ['Impôt sur les sociétés', formatEuro(-summary.corporateTax.taxDue)],
    ['TVA nette à reverser', formatEuro(summary.vat.netVatDue)],
    ['Cash groupe après impôts', formatEuro(summary.netGroupCash), true],
    ['Impôt sur le revenu du foyer', formatEuro(-ir.taxDue)],
    ['Tranche marginale · taux moyen', `${formatPercent(ir.marginalRate)} · ${formatPercent(ir.averageRate, 1)}`],
    ['Imposition des dividendes', DIVIDEND_MODE_LABEL[summary.dividendTaxMode]],
    ['Net perçu par le dirigeant', formatEuro(summary.netPersonalCash), true],
  ];

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 p-4 lg:p-6">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="panel-title m-0">{name}</h3>
            <p className="panel-help m-0">Montants annuels issus de la simulation en cours, hypothèses du panneau comprises.</p>
          </div>
          <button type="button" className="btn btn-sm print:hidden" onClick={() => window.print()}>Imprimer / PDF</button>
        </div>
        <table className="mt-4 w-full border-collapse text-sm">
          <tbody>
            {rows.map(([label, value, strong]) => (
              <tr key={label} className={`border-t border-border ${strong ? 'font-semibold text-fg' : 'text-fg-muted'}`}>
                <th scope="row" className={`py-2 pr-4 text-left font-[inherit] ${label.startsWith('dont') ? 'pl-4' : ''}`}>{annotate(label)}</th>
                <td className="py-2 text-right font-mono tabular-nums text-fg">{value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      <section className="card p-5">
        <h3 className="panel-title m-0">Limites du modèle à discuter avec votre conseil</h3>
        <ul className="m-0 mt-3 flex list-disc flex-col gap-1.5 pl-5 text-sm leading-relaxed text-fg-muted">
          {warnings.map((warning) => <li key={warning}>{warning}</li>)}
        </ul>
      </section>
    </div>
  );
};
