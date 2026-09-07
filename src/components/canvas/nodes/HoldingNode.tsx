import type { NodeProps } from '@xyflow/react';

import { MetricBadge } from '@/components/common/MetricBadge';

import { EntityNodeShell, type EntityFlowNode } from '../EntityNode';

export function HoldingNode({ data, selected }: NodeProps<EntityFlowNode>) {
  const ownership =
    data.ownershipPercent != null ? `${data.ownershipPercent} %` : null;

  return (
    <EntityNodeShell
      data={data}
      selected={selected}
      subtitle={ownership ? `Holding · ${ownership}` : 'Holding'}
    >
      {data.metrics?.treasury != null ? (
        <MetricBadge amount={data.metrics.treasury} label="Tréso" tone="cash" />
      ) : null}
      {data.metrics?.netProfit != null ? (
        <MetricBadge amount={data.metrics.netProfit} label="Net" tone="div" />
      ) : null}
      {data.metrics?.ccaBalance != null ? (
        <MetricBadge
          amount={data.metrics.ccaBalance}
          label="CCA"
          tone={data.metrics.ccaBalance < 0 ? 'alert' : 'neutral'}
        />
      ) : null}
    </EntityNodeShell>
  );
}
