import type { NodeProps } from '@xyflow/react';

import { MetricBadge } from '@/components/common/MetricBadge';

import { EntityNodeShell, type EntityFlowNode } from '../EntityNode';

export function PersonNode({ data, selected, sourcePosition, targetPosition }: NodeProps<EntityFlowNode>) {
  return (
    <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle="Personne">
      {data.metrics?.netPersonalCash != null ? (
        <MetricBadge
          amount={data.metrics.netPersonalCash}
          label="Net perso"
          tone="div"
        />
      ) : null}
      {data.metrics?.treasury != null ? (
        <MetricBadge amount={data.metrics.treasury} label="Cash" tone="cash" />
      ) : null}
    </EntityNodeShell>
  );
}
