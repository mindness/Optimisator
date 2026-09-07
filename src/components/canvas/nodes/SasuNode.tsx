import type { NodeProps } from '@xyflow/react';

import { MetricBadge } from '@/components/common/MetricBadge';
import { calculateCorporateTax } from '@/core/engine/calculator';
import type { EntityNodeData } from '@/core/types';

import { EntityNodeShell, type EntityFlowNode } from '../EntityNode';

function resolveSasuMetrics(data: EntityNodeData) {
  const caHt = data.inputs?.caHt ?? 0;
  const expensesHt = data.inputs?.expensesHt ?? 0;
  const fiscalResult = data.metrics?.fiscalResult ?? caHt - expensesHt;

  if (
    data.metrics?.corporateTax != null &&
    data.metrics?.netProfit != null
  ) {
    return {
      fiscalResult,
      corporateTax: data.metrics.corporateTax,
      netProfit: data.metrics.netProfit,
      caHt,
    };
  }

  const computed = calculateCorporateTax(fiscalResult);
  return {
    fiscalResult,
    corporateTax: data.metrics?.corporateTax ?? computed.taxDue,
    netProfit: data.metrics?.netProfit ?? computed.netProfit,
    caHt,
  };
}

export function SasuNode({ data, selected }: NodeProps<EntityFlowNode>) {
  const { fiscalResult, corporateTax, caHt } = resolveSasuMetrics(data);

  return (
    <EntityNodeShell data={data} selected={selected} subtitle="SASU">
      {caHt > 0 || data.metrics?.treasury != null ? (
        <MetricBadge
          amount={data.metrics?.treasury ?? caHt}
          label="CA"
          tone="cash"
        />
      ) : null}
      <MetricBadge amount={fiscalResult} label="Résultat" tone="neutral" />
      <MetricBadge amount={corporateTax} label="IS" tone="is" />
    </EntityNodeShell>
  );
}
