import type { NodeProps } from '@xyflow/react';

import { MetricBadge } from '@/components/common/MetricBadge';
import { calculateSciTax } from '@/core/engine/calculator';
import type { EntityNodeData } from '@/core/types';

import { EditableEntityInputs } from '../EditableEntityInputs';
import { EntityNodeShell, type EntityFlowNode } from '../EntityNode';

function resolveSciMetrics(data: EntityNodeData) {
  const rental = data.inputs?.rentalIncomeHt;
  if (
    rental != null &&
    data.metrics?.fiscalResult == null &&
    data.metrics?.corporateTax == null
  ) {
    const result = calculateSciTax(
      rental,
      data.inputs?.interestExpenses ?? 0,
      data.inputs?.buildingAmortization ?? 0,
      data.inputs?.otherCharges ?? 0,
    );
    return {
      fiscalResult: result.taxableIncome,
      corporateTax: result.taxDue,
      cashFlow: result.cashFlowNet,
    };
  }

  return {
    fiscalResult: data.metrics?.fiscalResult,
    corporateTax: data.metrics?.corporateTax,
    cashFlow: data.metrics?.treasury,
  };
}

export function SciNode({ data, selected, sourcePosition, targetPosition }: NodeProps<EntityFlowNode>) {
  const { fiscalResult, corporateTax, cashFlow } = resolveSciMetrics(data);
  const kind = data.entityType === 'sci_ir' ? 'SCI IR' : 'SCI IS';

  if (data.onPatchInput) {
    return (
      <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle={kind}>
        <EditableEntityInputs data={data} />
      </EntityNodeShell>
    );
  }

  return (
    <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle={kind}>
      {cashFlow != null ? (
        <MetricBadge amount={cashFlow} label="Cash" tone="cash" />
      ) : null}
      {fiscalResult != null ? (
        <MetricBadge amount={fiscalResult} label="Résultat" tone="neutral" />
      ) : null}
      {corporateTax != null ? (
        <MetricBadge amount={corporateTax} label="IS" tone="is" />
      ) : null}
    </EntityNodeShell>
  );
}
