import { MetricBadge } from '@/components/common/MetricBadge';
import type { TaxBreakdownLine, TaxCalculationResult } from '@/core/types';
import {
  calculateCorporateTax,
  calculateExecutiveSalary,
  calculateFlatTax,
  calculateMotherDaughterDividend,
  calculateVAT,
  IS_STANDARD_RATE,
  MOTHER_DAUGHTER_QPFC_RATE,
  PFU_IR_RATE,
  PFU_PS_RATE,
  VAT_STANDARD,
} from '@/core/engine';
import type { FlowEdgeData } from '@/core/types';

export type BreakdownStep = {
  label: string;
  amount: number;
  formula?: string;
};

function fromTaxLines(lines: TaxBreakdownLine[]): BreakdownStep[] {
  return lines.map((line) => ({
    label: line.label,
    amount: line.amount,
    formula: line.formula,
  }));
}

/**
 * Build calculator steps for the inspector.
 * Prefer engine `taxResult.breakdown` when present; otherwise recompute
 * from pure calculator helpers for the selected flow category.
 */
export function buildStepsForFlow(
  flow: FlowEdgeData,
  taxResult?: TaxCalculationResult,
): BreakdownStep[] {
  if (taxResult?.breakdown?.length) {
    const steps = fromTaxLines(taxResult.breakdown);
    steps.unshift({
      label: 'Montant brut',
      amount: taxResult.grossAmount,
    });
    steps.push({
      label: 'Net après frottement / impôt',
      amount: taxResult.netAmount,
    });
    return steps;
  }

  const amount = flow.amount;

  switch (flow.category) {
    case 'dividend': {
      if (flow.legalNoteId === 'mere-fille-art-145') {
        const md = calculateMotherDaughterDividend(amount);
        return [
          { label: 'Dividendes bruts', amount },
          {
            label: 'QPFC 5 %',
            amount: md.qpfc,
            formula: `× ${MOTHER_DAUGHTER_QPFC_RATE.value * 100} % (Art. 216 CGI)`,
          },
          {
            label: 'IS holding sur QPFC',
            amount: md.holdingTax,
            formula: `QPFC × ${IS_STANDARD_RATE.value * 100} %`,
          },
          { label: 'Cash net holding', amount: md.netCashInHolding },
        ];
      }
      const pfu = calculateFlatTax(amount);
      return [
        { label: 'Dividendes bruts', amount },
        {
          label: 'PFU IR 12,8 %',
          amount: pfu.irPart,
          formula: `× ${PFU_IR_RATE.value * 100} %`,
        },
        {
          label: 'PFU PS',
          amount: pfu.psPart,
          formula: `× ${PFU_PS_RATE.value * 100} %`,
        },
        { label: 'Net perçu', amount: pfu.netIncome },
      ];
    }
    case 'vat': {
      const vat = calculateVAT(amount, 0, VAT_STANDARD.value);
      return [
        {
          label: 'TVA collectée (approx.)',
          amount: vat.vatCollected,
          formula: `base × ${VAT_STANDARD.value * 100} %`,
        },
        { label: 'TVA nette due', amount: vat.netVatDue },
      ];
    }
    case 'is_tax': {
      const is = calculateCorporateTax(amount);
      return [
        { label: 'Résultat fiscal (assiette)', amount },
        { label: 'IS 15 %', amount: is.bracket15 },
        { label: 'IS 25 %', amount: is.bracket25 },
        { label: 'IS total', amount: is.taxDue },
        { label: 'Bénéfice net', amount: is.netProfit },
      ];
    }
    case 'salary':
    case 'social_charges': {
      const sal = calculateExecutiveSalary(amount);
      return [
        { label: 'Net désiré / assiette', amount },
        { label: 'Brut estimé', amount: sal.grossSalary },
        { label: 'Charges salariales', amount: sal.employeeCharges },
        { label: 'Charges patronales', amount: sal.employerCharges },
        { label: 'Coût total société', amount: sal.totalCompanyCost },
      ];
    }
    default:
      return [{ label: flow.label, amount }];
  }
}

export type StepBreakdownProps = {
  flow: FlowEdgeData;
  taxResult?: TaxCalculationResult;
  className?: string;
};

export function StepBreakdown({
  flow,
  taxResult,
  className = '',
}: StepBreakdownProps) {
  const steps = buildStepsForFlow(flow, taxResult);

  return (
    <section
      className={`flex flex-col gap-2 ${className}`.trim()}
      data-testid="step-breakdown"
      aria-label="Décomposition du calcul"
    >
      <h3 className="panel-title">Calcul pas à pas</h3>
      <ol className="m-0 flex list-none flex-col divide-y divide-border p-0">
        {steps.map((step, index) => (
          <li
            key={`${step.label}-${index}`}
            className="flex flex-wrap items-baseline justify-between gap-2 py-2"
          >
            <div className="flex min-w-0 flex-1 items-baseline gap-2">
              <span className="step-no" aria-hidden>{index + 1}</span>
              <span className="min-w-0">
                <span className="block text-xs font-medium text-fg">{step.label}</span>
                {step.formula ? (
                  <span className="block font-mono text-[0.6875rem] text-fg-muted">
                    {step.formula}
                  </span>
                ) : null}
              </span>
            </div>
            <MetricBadge amount={step.amount} tone="neutral" />
          </li>
        ))}
      </ol>
    </section>
  );
}
