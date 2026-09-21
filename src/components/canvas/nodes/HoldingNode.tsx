import type { NodeProps } from '@xyflow/react';

import { MetricBadge } from '@/components/common/MetricBadge';

import { EditableEntityInputs } from '../EditableEntityInputs';
import { EntityNodeShell, type EntityFlowNode } from '../EntityNode';

export function HoldingNode({ data, selected, sourcePosition, targetPosition }: NodeProps<EntityFlowNode>) {
  const ownership =
    data.ownershipPercent != null ? `${data.ownershipPercent} %` : null;
  const subtitle = ownership ? `Holding · ${ownership}` : 'Holding';

  if (data.onPatchInput) {
    return (
      <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle={subtitle}>
        <EditableEntityInputs data={data} />
      </EntityNodeShell>
    );
  }

  return (
    <EntityNodeShell
      data={data}
      selected={selected}
      sourcePosition={sourcePosition}
      targetPosition={targetPosition}
      subtitle={subtitle}
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
