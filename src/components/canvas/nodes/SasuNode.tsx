import type { NodeProps } from '@xyflow/react';

import { MetricBadge } from '@/components/common/MetricBadge';
import { calculateCorporateTax } from '@/core/engine/calculator';
import type { EntityNodeData } from '@/core/types';

import { EditableEntityInputs } from '../EditableEntityInputs';
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

export function SasuNode({ data, selected, sourcePosition, targetPosition }: NodeProps<EntityFlowNode>) {
  const { fiscalResult, corporateTax, caHt } = resolveSasuMetrics(data);
  const treasury = data.metrics?.treasury;

  // Atelier Architecture : édition directe des paramètres saisis, pas de résultat calculé sur le schéma de saisie.
  if (data.onPatchInput) {
    return (
      <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle="SASU">
        <EditableEntityInputs data={data} />
      </EntityNodeShell>
    );
  }

  return (
    <EntityNodeShell data={data} selected={selected} sourcePosition={sourcePosition} targetPosition={targetPosition} subtitle="SASU">
      {caHt > 0 ? (
        <MetricBadge amount={caHt} label="CA HT" tone="cash" />
      ) : null}
      {treasury != null ? (
        <MetricBadge amount={treasury} label="Trésorerie" tone="cash" />
      ) : null}
      <MetricBadge amount={fiscalResult} label="Résultat" tone="neutral" />
      <MetricBadge amount={corporateTax} label="IS" tone="is" />
    </EntityNodeShell>
  );
}
