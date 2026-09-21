import type { NodeProps } from '@xyflow/react';

import { MetricBadge } from '@/components/common/MetricBadge';

import { EntityNodeShell, type EntityFlowNode } from '../EntityNode';

export function AuthorityNode({ data, selected, sourcePosition, targetPosition }: NodeProps<EntityFlowNode>) {
  const isUrssaf = data.entityType === 'urssaf';
  const subtitle = isUrssaf ? 'URSSAF' : 'Trésor public';

  return (
    <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle={subtitle}>
      {data.metrics?.corporateTax != null ? (
        <MetricBadge
          amount={data.metrics.corporateTax}
          label={isUrssaf ? 'Cotis.' : 'IS'}
          tone={isUrssaf ? 'social' : 'is'}
        />
      ) : null}
      {data.metrics?.treasury != null ? (
        <MetricBadge
          amount={data.metrics.treasury}
          label="Encaissé"
          tone={isUrssaf ? 'social' : 'vat'}
        />
      ) : null}
    </EntityNodeShell>
  );
}
