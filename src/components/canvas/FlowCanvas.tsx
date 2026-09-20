import {
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { useEffect, useMemo } from 'react';

import type { EntityNodeData, EntityType, FlowEdgeData, ScenarioState } from '@/core/types';
import { FREELANCE_SASU_PRESET } from '@/core/presets';
import type { ViewFlow } from '@/hooks/useSimulation';

import { edgeTypes } from './edgeTypes';
import {
  type EntityFlowNode,
  type EntityNodePayload,
} from './EntityNode';
import { type OwnershipEdge, type CanvasFlowEdge, type FlowEdgePayload, flowDataFromPayload } from './FlowEdge';
import { entityTypeToNodeType, nodeTypes } from './nodeTypes';

import '@xyflow/react/dist/style.css';

export const NODE_WIDTH = 176;
// ponytail: hauteurs estimées par type, pas mesurées — mesurer les cartes si leur contenu devient variable.
export const NODE_HEIGHT: Partial<Record<EntityNodeData['entityType'], number>> = {
  sasu: 200, holding_sas: 200, holding_sarl: 200, sci_is: 200, sci_ir: 200, bank: 120, person: 140,
};
export const DEFAULT_NODE_HEIGHT = 80;
// Le libellé d'un flux est posé au milieu de l'arête : dagre lui réserve la place comme à un nœud.
const EDGE_LABEL = { width: 190, height: 56, labelpos: 'c' as const };
const LABEL_STACK_GAP = 52;

function asEntityPayload(entity: EntityNodeData): EntityNodePayload {
  return entity as EntityNodePayload;
}

function asFlowPayload(flow: FlowEdgeData | ViewFlow): FlowEdgePayload {
  // Callbacks belong to the view; never attach them to persisted scenario objects.
  return { ...flow } as FlowEdgePayload;
}

// React Flow state holds both kinds of edges; node/edge interaction props
// still accept them natively. `CanvasFlowEdge` stays the precise financial type.
type CanvasEdge = CanvasFlowEdge | OwnershipEdge;
export const ownershipEdges = (ownerships: ScenarioState['ownerships'] = []): OwnershipEdge[] => {
  return ownerships.map((link) => ({
    id: `ownership:${link.id}`, source: link.ownerId, target: link.companyId,
    type: 'default', label: `Détention ${link.percent} %`,
    style: { stroke: 'var(--fg-muted)', strokeDasharray: '6 4' },
    labelStyle: { fill: 'var(--fg)' }, labelBgStyle: { fill: 'var(--surface)' },
  }));
};

/**
 * Layout gauche→droite calculé par dagre à partir des flux : les rangs suivent
 * l'argent, et la place du libellé de chaque arête est réservée dans l'espacement.
 */
export function layoutPresetNodes(
  entities: EntityNodeData[],
  flows: Array<{ sourceId: string; targetId: string; id: string }> = [],
): EntityFlowNode[] {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  graph.setGraph({ rankdir: 'LR', nodesep: 72, ranksep: 160, marginx: 40, marginy: 40 });
  graph.setDefaultEdgeLabel(() => ({}));

  const known = new Set(entities.map((entity) => entity.id));
  for (const entity of entities) {
    graph.setNode(entity.id, {
      width: NODE_WIDTH,
      height: NODE_HEIGHT[entity.entityType] ?? DEFAULT_NODE_HEIGHT,
    });
  }
  for (const flow of flows) {
    if (known.has(flow.sourceId) && known.has(flow.targetId) && flow.sourceId !== flow.targetId) {
      graph.setEdge(flow.sourceId, flow.targetId, { ...EDGE_LABEL }, flow.id);
    }
  }

  dagre.layout(graph);

  return entities.map((entity) => {
    const placed = graph.node(entity.id);
    return {
      id: entity.id,
      type: entityTypeToNodeType(entity.entityType),
      // dagre renvoie le centre du nœud ; React Flow attend son coin supérieur gauche.
      position: { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 },
      data: asEntityPayload(entity),
    };
  });
}

export function flowsToEdges(
  flows: Array<FlowEdgeData | ViewFlow>,
  onFlowSelect?: (flow: FlowEdgeData) => void,
  selectedFlowId?: string | null,
): CanvasFlowEdge[] {
  // Deux flux entre les mêmes entités suivent le même tracé : on étage leurs libellés.
  const seenPerPair = new Map<string, number>();

  return flows
    .filter((flow) => !('hidden' in flow && flow.hidden))
    .map((flow) => {
      const highlighted =
        'traceHighlight' in flow ? Boolean(flow.traceHighlight) : false;
      const isSelected = Boolean(selectedFlowId && flow.id === selectedFlowId);
      const payload = asFlowPayload(flow);
      const pair = `${flow.sourceId}→${flow.targetId}`;
      const rank = seenPerPair.get(pair) ?? 0;
      seenPerPair.set(pair, rank + 1);
      payload.labelOffset = rank * LABEL_STACK_GAP;
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
  onPositionsChange?: (positions: NonNullable<ScenarioState['nodePositions']>) => void;
  onConnectEntities?: (sourceId: string, targetId: string) => void;
  /** Dépôt d'un type d'entité depuis la palette, aux coordonnées du canvas. */
  onDropEntityType?: (entityType: EntityType, position: { x: number; y: number }) => void;
  showOwnership?: boolean;
};

/** Type MIME du glisser-déposer palette → canvas. */
export const ENTITY_DRAG_TYPE = 'application/x-optimisator-entity';

function FlowCanvasInner({
  scenario = FREELANCE_SASU_PRESET,
  entities: entitiesProp,
  flows: flowsProp,
  selectedFlowId = null,
  className = '',
  onFlowSelect,
  onPositionsChange,
  onConnectEntities,
  onDropEntityType,
  showOwnership = true,
}: FlowCanvasProps) {
  const { screenToFlowPosition } = useReactFlow();
  const entities = entitiesProp ?? scenario.entities;
  const flows = flowsProp ?? scenario.flows;

  const initialNodes = useMemo(() => layoutPresetNodes(entities, scenario.flows), [entities, scenario.flows]);
  const initialEdges = useMemo(
    () => [...flowsToEdges(flows, onFlowSelect, selectedFlowId), ...(showOwnership ? ownershipEdges(scenario.ownerships) : [])],
    [flows, onFlowSelect, selectedFlowId, scenario.ownerships, showOwnership],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(initialEdges);

  useEffect(() => {
    const layouted = layoutPresetNodes(entities, scenario.flows);
    setNodes((prev) => mergeNodePositions(layouted, prev).map((node) => ({
      ...node, position: scenario.nodePositions?.[node.id] ?? node.position,
    })));
    setEdges([...flowsToEdges(flows, onFlowSelect, selectedFlowId), ...(showOwnership ? ownershipEdges(scenario.ownerships) : [])]);
  }, [entities, flows, scenario.flows, scenario.nodePositions, scenario.ownerships, showOwnership, onFlowSelect, selectedFlowId, setNodes, setEdges]);

  return (
    // Hauteur explicite en mobile : sur une colonne sans hauteur définie, un h-full se résout à 0 et React Flow disparaît.
    <div
      className={`flow-canvas h-[28rem] w-full bg-canvas lg:h-full ${className}`.trim()}
      data-testid="flow-canvas"
      onDragOver={onDropEntityType ? (event) => {
        if (!event.dataTransfer.types.includes(ENTITY_DRAG_TYPE)) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = 'copy';
      } : undefined}
      onDrop={onDropEntityType ? (event) => {
        const entityType = event.dataTransfer.getData(ENTITY_DRAG_TYPE);
        if (!entityType) return;
        event.preventDefault();
        onDropEntityType(entityType as EntityType, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
      } : undefined}
      data-preset={scenario.presetId ?? scenario.id}
      aria-label={`Canvas de flux — ${scenario.name}`}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        deleteKeyCode={null}
        nodesConnectable={Boolean(onConnectEntities)}
        onConnect={({ source, target }) => { if (source && target && source !== target) onConnectEntities?.(source, target); }}
        onNodeDragStop={(_event, moved) => onPositionsChange?.(Object.fromEntries(
          nodes.map((node) => [node.id, node.id === moved.id ? moved.position : node.position]),
        ))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.35}
        maxZoom={1.75}
        panOnScroll
        zoomOnScroll
        onEdgeClick={(_event, edge) => {
          // Ownership links are legal markers, not selectable monetary flows.
          if (edge.type === 'flow' && edge.data && onFlowSelect) {
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
          className="!hidden !bg-surface !border !border-border sm:!block"
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
