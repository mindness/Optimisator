import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Node,
} from '@xyflow/react';
import { useEffect, useMemo } from 'react';

import type { EntityNodeData, FlowEdgeData, ScenarioState } from '@/core/types';
import { FREELANCE_SASU_PRESET } from '@/core/presets';
import type { ViewFlow } from '@/hooks/useSimulation';

import { edgeTypes } from './edgeTypes';
import {
  type EntityFlowNode,
  type EntityNodePayload,
} from './EntityNode';
import { type CanvasFlowEdge, type FlowEdgePayload, flowDataFromPayload } from './FlowEdge';
import { entityTypeToNodeType, nodeTypes } from './nodeTypes';

import '@xyflow/react/dist/style.css';

const COLUMN_X = [40, 280, 560] as const;
const ROW_GAP = 110;

function asEntityPayload(entity: EntityNodeData): EntityNodePayload {
  return entity as EntityNodePayload;
}

function asFlowPayload(flow: FlowEdgeData | ViewFlow): FlowEdgePayload {
  return flow as FlowEdgePayload;
}

/** Simple left-to-right layout by role (clients → companies → sinks). */
export function layoutPresetNodes(entities: EntityNodeData[]): EntityFlowNode[] {
  const columns: EntityNodeData[][] = [[], [], []];

  for (const entity of entities) {
    switch (entity.entityType) {
      case 'client':
      case 'vendor':
        columns[0].push(entity);
        break;
      case 'sasu':
      case 'holding_sas':
      case 'holding_sarl':
      case 'sci_is':
      case 'sci_ir':
      case 'bank':
        columns[1].push(entity);
        break;
      default:
        columns[2].push(entity);
        break;
    }
  }

  const orderCol1 = (e: EntityNodeData) => {
    if (e.entityType === 'sasu') return 0;
    if (e.entityType.startsWith('holding')) return 1;
    if (e.entityType.startsWith('sci')) return 2;
    return 3;
  };
  columns[1].sort((a, b) => orderCol1(a) - orderCol1(b));

  const nodes: EntityFlowNode[] = [];
  columns.forEach((col, colIndex) => {
    col.forEach((entity, rowIndex) => {
      nodes.push({
        id: entity.id,
        type: entityTypeToNodeType(entity.entityType),
        position: {
          x: COLUMN_X[colIndex] ?? 40,
          y: 40 + rowIndex * ROW_GAP,
        },
        data: asEntityPayload(entity),
      });
    });
  });

  return nodes;
}

export function flowsToEdges(
  flows: Array<FlowEdgeData | ViewFlow>,
  onFlowSelect?: (flow: FlowEdgeData) => void,
  selectedFlowId?: string | null,
): CanvasFlowEdge[] {
  return flows
    .filter((flow) => !('hidden' in flow && flow.hidden))
    .map((flow) => {
      const highlighted =
        'traceHighlight' in flow ? Boolean(flow.traceHighlight) : false;
      const isSelected = Boolean(selectedFlowId && flow.id === selectedFlowId);
      const payload = asFlowPayload(flow);
      if (onFlowSelect) {
        payload.onSelect = onFlowSelect;
      }
      if (highlighted) {
        payload.traceHighlight = true;
      }
      return {
        id: flow.id,
        source: flow.sourceId,
        target: flow.targetId,
        type: 'flow' as const,
        data: payload,
        selected: isSelected,
        style:
          isSelected || highlighted
            ? { strokeWidth: 3, opacity: 1 }
            : undefined,
      };
    });
}

/**
 * Merge new layout/data with previous node positions so What-If / metric
 * updates do not reset user drag placements. Full re-layout only when the
 * entity id set changes (preset switch).
 */
export function mergeNodePositions(
  nextLayout: EntityFlowNode[],
  previous: Node[],
): EntityFlowNode[] {
  const prevIds = new Set(previous.map((n) => n.id));
  const nextIds = new Set(nextLayout.map((n) => n.id));
  const sameTopology =
    prevIds.size === nextIds.size && [...nextIds].every((id) => prevIds.has(id));

  if (!sameTopology || previous.length === 0) {
    return nextLayout;
  }

  const posMap = new Map(previous.map((n) => [n.id, n.position]));
  return nextLayout.map((node) => ({
    ...node,
    position: posMap.get(node.id) ?? node.position,
  }));
}

export type FlowCanvasProps = {
  scenario?: ScenarioState;
  /** Override entities (e.g. resolved metrics). Defaults to scenario.entities. */
  entities?: EntityNodeData[];
  /** Override flows (filtered / highlighted ViewFlow). Defaults to scenario.flows. */
  flows?: Array<FlowEdgeData | ViewFlow>;
  /** Currently inspected flow — drives edge `selected` visual. */
  selectedFlowId?: string | null;
  className?: string;
  onFlowSelect?: (flow: FlowEdgeData) => void;
};

function FlowCanvasInner({
  scenario = FREELANCE_SASU_PRESET,
  entities: entitiesProp,
  flows: flowsProp,
  selectedFlowId = null,
  className = '',
  onFlowSelect,
}: FlowCanvasProps) {
  const entities = entitiesProp ?? scenario.entities;
  const flows = flowsProp ?? scenario.flows;

  const initialNodes = useMemo(() => layoutPresetNodes(entities), [entities]);
  const initialEdges = useMemo(
    () => flowsToEdges(flows, onFlowSelect, selectedFlowId),
    [flows, onFlowSelect, selectedFlowId],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasFlowEdge>(initialEdges);

  useEffect(() => {
    const layouted = layoutPresetNodes(entities);
    setNodes((prev) => mergeNodePositions(layouted, prev));
    setEdges(flowsToEdges(flows, onFlowSelect, selectedFlowId));
  }, [entities, flows, onFlowSelect, selectedFlowId, setNodes, setEdges]);

  return (
    <div
      className={`flow-canvas h-full min-h-[28rem] w-full bg-canvas ${className}`.trim()}
      data-testid="flow-canvas"
      data-preset={scenario.presetId ?? scenario.id}
      aria-label={`Canvas de flux — ${scenario.name}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.75}
        panOnScroll
        zoomOnScroll
        proOptions={{ hideAttribution: true }}
        onEdgeClick={(_event, edge) => {
          if (edge.data && onFlowSelect) {
            onFlowSelect(flowDataFromPayload(edge.data));
          }
        }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={18}
          size={1}
          color="var(--border)"
        />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeStrokeWidth={2}
          maskColor="color-mix(in srgb, var(--fg) 12%, transparent)"
          className="!bg-surface !border !border-border"
        />
      </ReactFlow>
    </div>
  );
}

/** Money-flow canvas: provider + zoom/pan + MiniMap + structure preset. */
export function FlowCanvas(props: FlowCanvasProps) {
  return (
    <ReactFlowProvider>
      <FlowCanvasInner {...props} />
    </ReactFlowProvider>
  );
}
