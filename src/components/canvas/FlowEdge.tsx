import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type Edge,
  type EdgeProps,
} from '@xyflow/react';
import { useId, useSyncExternalStore } from 'react';

import { formatEuro, type FlowTone } from '@/components/common/MetricBadge';
import type { FlowCategory, FlowEdgeData } from '@/core/types';

/** xyflow requires edge `data` to extend Record<string, unknown>. */
export type FlowEdgePayload = FlowEdgeData & {
  /** Injected by FlowCanvas — label click selects the flow. */
  onSelect?: (flow: FlowEdgeData) => void;
  traceHighlight?: boolean;
} & Record<string, unknown>;

export type CanvasFlowEdge = Edge<FlowEdgePayload, 'flow'>;

/**
 * Legal link (ownership %) — never a monetary flow.
 * Renders with the built-in bezier edge, no financial payload.
 */
export type OwnershipEdge = Edge<Record<string, never>, 'default'>;

export function flowDataFromPayload(data: FlowEdgePayload): FlowEdgeData {
  return {
    id: data.id,
    sourceId: data.sourceId,
    targetId: data.targetId,
    category: data.category,
    label: data.label,
    amount: data.amount,
    periodicity: data.periodicity,
    layer: data.layer,
    ...(data.taxRate !== undefined ? { taxRate: data.taxRate } : {}),
    ...(data.legalNoteId !== undefined ? { legalNoteId: data.legalNoteId } : {}),
    ...(data.warning !== undefined ? { warning: data.warning } : {}),
  };
}

/** Cycle duration (s): clamp(1.5, log10(amount+1), 6) — design §4.4. */
export function particleDurationSeconds(amount: number): number {
  const raw = Math.log10(Math.abs(amount) + 1);
  return Math.min(6, Math.max(1.5, raw));
}

function categoryTone(category: FlowCategory): FlowTone {
  switch (category) {
    case 'revenue':
    case 'expense':
    case 'management_fees':
    case 'rent':
    case 'cca_advance':
    case 'cca_reimbursement':
    case 'loan_payment':
      return 'cash';
    case 'vat':
      return 'vat';
    case 'is_tax':
      return 'is';
    case 'salary':
    case 'social_charges':
      return 'social';
    case 'dividend':
      return 'div';
    default:
      return 'neutral';
  }
}

function strokeForTone(tone: FlowTone): string {
  switch (tone) {
    case 'cash':
      return 'var(--flow-cash)';
    case 'vat':
      return 'var(--flow-vat)';
    case 'is':
      return 'var(--flow-is)';
    case 'social':
      return 'var(--flow-social)';
    case 'div':
      return 'var(--flow-div)';
    case 'alert':
      return 'var(--flow-alert)';
    default:
      return 'var(--fg-muted)';
  }
}

function subscribeReducedMotion(onStoreChange: () => void): () => void {
  const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
  mq.addEventListener('change', onStoreChange);
  return () => mq.removeEventListener('change', onStoreChange);
}

function getReducedMotionSnapshot(): boolean {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function getReducedMotionServerSnapshot(): boolean {
  return true;
}

export function FlowEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
}: EdgeProps<CanvasFlowEdge>) {
  const reactId = useId();
  const pathId = `flow-path-${id}-${reactId.replace(/:/g, '')}`;
  const reducedMotion = useSyncExternalStore(
    subscribeReducedMotion,
    getReducedMotionSnapshot,
    getReducedMotionServerSnapshot,
  );

  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const amount = data?.amount ?? 0;
  const category = data?.category ?? 'revenue';
  const tone = categoryTone(category);
  const stroke = strokeForTone(tone);
  const duration = particleDurationSeconds(amount);
  const showParticles = !reducedMotion && Math.abs(amount) > 0;
  const traceHighlight = Boolean(
    data && 'traceHighlight' in data && data.traceHighlight,
  );
  const emphasize = selected || traceHighlight;

  return (
    <>
      <path id={pathId} d={edgePath} fill="none" stroke="none" aria-hidden />
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={{
          ...style,
          stroke,
          strokeWidth: emphasize ? 2.75 : 1.75,
          opacity: emphasize ? 1 : 0.85,
          filter: traceHighlight
            ? 'drop-shadow(0 0 3px color-mix(in srgb, var(--flow-cash) 55%, transparent))'
            : undefined,
        }}
      />
      {showParticles
        ? [0, 1, 2].map((i) => (
            <circle
              key={`${pathId}-p-${i}`}
              r={2.75}
              fill={stroke}
              className="flow-edge-particle"
              opacity={0.9}
            >
              <animateMotion
                dur={`${duration}s`}
                begin={`${(i * duration) / 3}s`}
                repeatCount="indefinite"
                rotate="auto"
              >
                <mpath href={`#${pathId}`} />
              </animateMotion>
            </circle>
          ))
        : null}
      <EdgeLabelRenderer>
        <button
          type="button"
          className="nodrag nopan absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer border border-border bg-surface px-1.5 py-0.5 text-left shadow-sm hover:border-border-strong"
          style={{
            transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
            pointerEvents: 'all',
          }}
          title={data?.label ?? 'Flux'}
          aria-label={`${data?.label ?? 'Flux'} : ${formatEuro(amount)}`}
          data-testid={`flow-edge-label-${id}`}
          onClick={(event) => {
            event.stopPropagation();
            if (!data?.onSelect) return;
            data.onSelect(flowDataFromPayload(data));
          }}
        >
          <span className="block text-xs font-medium uppercase tracking-wide text-fg-muted">
            {data?.label ?? 'Flux'}
          </span>
          <span className="font-amount text-xs" style={{ color: stroke }}>
            {formatEuro(amount)}
          </span>
        </button>
      </EdgeLabelRenderer>
    </>
  );
}
