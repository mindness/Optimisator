import {
  Background,
  BackgroundVariant,
  Controls,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Node,
} from '@xyflow/react';
import dagre from '@dagrejs/dagre';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';

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

export const NODE_WIDTH = 208;
// ponytail: hauteurs estimées par type, pas mesurées — mesurer les cartes si leur contenu devient variable.
export const NODE_HEIGHT: Partial<Record<EntityNodeData['entityType'], number>> = {
  sasu: 160, holding_sas: 160, holding_sarl: 160, sci_is: 160, sci_ir: 160, bank: 108, person: 116,
};
export const DEFAULT_NODE_HEIGHT = 72;
// Le libellé d'un flux est posé au milieu de l'arête : dagre lui réserve la place comme à un nœud.
// Sa largeur doit tenir dans l'espacement entre deux rangs (`ranksep`), sinon il déborde sur les cartes.
const EDGE_LABEL = { width: 120, height: 84, labelpos: 'c' as const };

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
  rankdir: 'LR' | 'TB' = 'LR',
): EntityFlowNode[] {
  const graph = new dagre.graphlib.Graph({ multigraph: true });
  // Vertical sur écran étroit : une colonne de cartes lisibles plutôt qu'une frise miniature.
  graph.setGraph(rankdir === 'TB'
    ? { rankdir, nodesep: 24, ranksep: 72, marginx: 16, marginy: 16 }
    // ranksep > largeur du libellé : le libellé tient dans le couloir entre deux rangs.
    // nodesep serré : moins de hauteur à avaler, donc un zoom d'arrivée plus lisible.
    : { rankdir, nodesep: 44, ranksep: 96, marginx: 16, marginy: 16 });
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
      ...(rankdir === 'TB' ? { sourcePosition: Position.Bottom, targetPosition: Position.Top } : {}),
      // dagre renvoie le centre du nœud ; React Flow attend son coin supérieur gauche.
      position: { x: placed.x - placed.width / 2, y: placed.y - placed.height / 2 },
      data: asEntityPayload(entity),
    };
  });
}

/** Hauteur minimale entre deux libellés voisins avant qu'ils ne se recouvrent. */
const LABEL_MIN_GAP = 76;
/** Deux libellés dont les milieux sont dans la même bande verticale se gênent. */
const LABEL_COLUMN = 170;

/**
 * Décalage vertical de chaque libellé pour qu'aucun n'en recouvre un autre.
 * Le libellé est posé au milieu de l'arête ; les milieux sont approchés par le
 * segment centre à centre, donc les décalages suivent les cartes déplacées.
 * Sans positions connues (tests, premier rendu), on n'étage que les flux qui
 * partagent exactement le même tracé.
 */
export function labelOffsets(
  flows: Array<FlowEdgeData | ViewFlow>,
  centers?: Map<string, { x: number; y: number }>,
): Map<string, number> {
  const offsets = new Map<string, number>();
  if (!centers) {
    const seenPerPair = new Map<string, number>();
    for (const flow of flows) {
      const pair = `${flow.sourceId}→${flow.targetId}`;
      const rank = seenPerPair.get(pair) ?? 0;
      seenPerPair.set(pair, rank + 1);
      offsets.set(flow.id, rank * LABEL_MIN_GAP);
    }
    return offsets;
  }

  const placed = flows.flatMap((flow) => {
    const from = centers.get(flow.sourceId);
    const to = centers.get(flow.targetId);
    if (!from || !to) return [];
    return [{ id: flow.id, x: (from.x + to.x) / 2, y: (from.y + to.y) / 2 }];
  });

  const columns = new Map<number, typeof placed>();
  for (const label of placed) {
    const column = Math.round(label.x / LABEL_COLUMN);
    const bucket = columns.get(column);
    if (bucket) bucket.push(label);
    else columns.set(column, [label]);
  }

  for (const bucket of columns.values()) {
    bucket.sort((a, b) => a.y - b.y);
    let floor = -Infinity;
    for (const label of bucket) {
      const y = Math.max(label.y, floor);
      offsets.set(label.id, y - label.y);
      floor = y + LABEL_MIN_GAP;
    }
    // La pile pousse toujours vers le bas : on la recentre sur son milieu d'origine.
    const shift = (offsets.get(bucket[bucket.length - 1]!.id) ?? 0) / 2;
    for (const label of bucket) offsets.set(label.id, (offsets.get(label.id) ?? 0) - shift);
  }
  return offsets;
}

export function flowsToEdges(
  flows: Array<FlowEdgeData | ViewFlow>,
  onFlowSelect?: (flow: FlowEdgeData) => void,
  selectedFlowId?: string | null,
  centers?: Map<string, { x: number; y: number }>,
): CanvasFlowEdge[] {
  const visible = flows.filter((flow) => !('hidden' in flow && flow.hidden));
  const offsets = labelOffsets(visible, centers);
  return visible
    .map((flow) => {
      const highlighted =
        'traceHighlight' in flow ? Boolean(flow.traceHighlight) : false;
      const isSelected = Boolean(selectedFlowId && flow.id === selectedFlowId);
      const payload = asFlowPayload(flow);
      payload.labelOffset = offsets.get(flow.id) ?? 0;
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

/** Centre de chaque carte, d'après sa position courante et sa taille estimée. */
function nodeCenters(placed: EntityFlowNode[]): Map<string, { x: number; y: number }> {
  return new Map(placed.map((node) => [node.id, {
    x: node.position.x + NODE_WIDTH / 2,
    y: node.position.y + (NODE_HEIGHT[node.data.entityType] ?? DEFAULT_NODE_HEIGHT) / 2,
  }]));
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
  /** Raccourci de suppression sur les cartes (bouton × + touche Suppr) — atelier Architecture uniquement. */
  onDeleteEntity?: (id: string) => void;
  /** Édition directe des paramètres saisis sur les cartes — atelier Architecture uniquement. */
  onPatchEntityInputs?: (id: string, key: string, value: number) => void;
  /** Renommage au double-clic sur le titre d'une carte — atelier Architecture uniquement. */
  onRenameEntity?: (id: string, label: string) => void;
  showOwnership?: boolean;
  /** Élément à passer en plein écran — par défaut le canvas seul. L'atelier y met la grille
   *  palette + schéma pour garder les briques à portée de main une fois en grand. */
  fullscreenTarget?: React.RefObject<HTMLElement | null>;
};

// Plancher de zoom au recadrage : en dessous, les montants des cartes ne se lisent
// plus. Un grand schéma déborde alors du cadre — il se déplace à la molette, au
// glissé, ou passe en plein écran.
const FIT_VIEW = { padding: 0.02, minZoom: 0.75 } as const;

/** Type MIME du glisser-déposer palette → canvas. */
export const ENTITY_DRAG_TYPE = 'application/x-optimisator-entity';

const NARROW_QUERY = '(max-width: 63.99rem)';
// jsdom (tests) n'expose pas matchMedia : on y reste en frise.
const narrowQuery = () => (typeof window.matchMedia === 'function' ? window.matchMedia(NARROW_QUERY) : null);
const subscribeNarrow = (cb: () => void) => {
  const mq = narrowQuery();
  mq?.addEventListener('change', cb);
  return () => mq?.removeEventListener('change', cb);
};
const useNarrowViewport = () =>
  useSyncExternalStore(subscribeNarrow, () => narrowQuery()?.matches ?? false, () => false);

// Classes écrites en clair : Tailwind ne génère pas les noms construits dynamiquement.
const ROLE_LEGEND = [
  ['bg-flow-cash', 'Trésorerie / CA'],
  ['bg-flow-vat', 'TVA'],
  ['bg-flow-is', 'IS'],
  ['bg-flow-social', 'Social'],
  ['bg-flow-div', 'Dividendes'],
  ['bg-flow-alert', 'Dette / CCA'],
] as const;

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
  onDeleteEntity,
  onPatchEntityInputs,
  onRenameEntity,
  showOwnership = true,
  fullscreenTarget,
}: FlowCanvasProps) {
  const { screenToFlowPosition, fitView } = useReactFlow();
  const entities = entitiesProp ?? scenario.entities;
  const flows = flowsProp ?? scenario.flows;
  const narrow = useNarrowViewport();
  const rankdir = narrow ? 'TB' : 'LR';
  const shell = useRef<HTMLDivElement>(null);
  const [fullscreen, setFullscreen] = useState(false);

  useEffect(() => {
    const target = () => fullscreenTarget?.current ?? shell.current;
    const sync = () => setFullscreen(document.fullscreenElement === target());
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, [fullscreenTarget]);

  const initialNodes = useMemo(() => layoutPresetNodes(entities, scenario.flows, rankdir), [entities, scenario.flows, rankdir]);
  const initialEdges = useMemo(
    () => [...flowsToEdges(flows, onFlowSelect, selectedFlowId, nodeCenters(initialNodes)), ...(showOwnership ? ownershipEdges(scenario.ownerships) : [])],
    [flows, onFlowSelect, selectedFlowId, scenario.ownerships, showOwnership, initialNodes],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<EntityFlowNode>(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<CanvasEdge>(initialEdges);

  // Callbacks injectés dans `data` : les nœuds custom ne reçoivent que `data`, pas les props du canevas.
  const decoratedNodes = useMemo(() => nodes.map((node) => ({
    ...node,
    data: {
      ...node.data,
      onDelete: onDeleteEntity ? () => onDeleteEntity(node.id) : undefined,
      onPatchInput: onPatchEntityInputs ? (key: string, value: number) => onPatchEntityInputs(node.id, key, value) : undefined,
      onRename: onRenameEntity ? (label: string) => onRenameEntity(node.id, label) : undefined,
    },
  })), [nodes, onDeleteEntity, onPatchEntityInputs, onRenameEntity]);

  // Échap désélectionne (et ne supprime jamais) : Suppr sur une carte encore sélectionnée par mégarde coûte cher.
  useEffect(() => {
    if (!onDeleteEntity) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setNodes((current) => current.map((node) => (node.selected ? { ...node, selected: false } : node)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onDeleteEntity, setNodes]);

  useEffect(() => {
    const layouted = layoutPresetNodes(entities, scenario.flows, rankdir);
    // En vertical, les positions enregistrées (pensées pour la frise) ne s'appliquent pas.
    setNodes((prev) => mergeNodePositions(layouted, prev).map((node) => ({
      ...node, position: (rankdir === 'LR' && scenario.nodePositions?.[node.id]) || node.position,
    })));
  }, [entities, scenario.flows, scenario.nodePositions, setNodes, rankdir]);

  // Les arêtes suivent les cartes : le calage des libellés se fait d'après leurs
  // centres courants, donc il se refait aussi après un déplacement à la souris.
  useEffect(() => {
    setEdges([...flowsToEdges(flows, onFlowSelect, selectedFlowId, nodeCenters(nodes)), ...(showOwnership ? ownershipEdges(scenario.ownerships) : [])]);
  }, [nodes, flows, scenario.ownerships, showOwnership, onFlowSelect, selectedFlowId, setEdges]);

  // Recadre au changement de scénario, une fois les nœuds mesurés : le fitView initial part de tailles estimées.
  useEffect(() => {
    const id = requestAnimationFrame(() => void fitView(FIT_VIEW));
    return () => cancelAnimationFrame(id);
  }, [scenario.id, rankdir, fullscreen, fitView]);

  return (
    // Hauteur explicite en mobile : sur une colonne sans hauteur définie, un h-full se résout à 0 et React Flow disparaît.
    <div
      ref={shell}
      className={`flow-canvas relative h-[32rem] w-full bg-surface-sunken lg:h-full ${className}`.trim()}
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
        nodes={decoratedNodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        deleteKeyCode={onDeleteEntity ? ['Backspace', 'Delete'] : null}
        onNodesDelete={onDeleteEntity ? (deleted) => deleted.forEach((node) => onDeleteEntity(node.id)) : undefined}
        nodesConnectable={Boolean(onConnectEntities)}
        onConnect={({ source, target }) => { if (source && target && source !== target) onConnectEntities?.(source, target); }}
        onNodeDragStop={(_event, moved) => onPositionsChange?.(Object.fromEntries(
          nodes.map((node) => [node.id, node.id === moved.id ? moved.position : node.position]),
        ))}
        nodeTypes={nodeTypes}
        edgeTypes={edgeTypes}
        fitView
        fitViewOptions={FIT_VIEW}
        minZoom={narrow ? 0.6 : 0.3}
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
          gap={16}
          size={1.2}
          color="var(--border-strong)"
        />
        <Controls showInteractive={false} />
      </ReactFlow>
      {typeof document !== 'undefined' && document.fullscreenEnabled ? (
        <button
          type="button"
          className="btn btn-sm absolute right-2 top-2 z-10 px-2"
          aria-label={fullscreen ? 'Quitter le plein écran' : 'Afficher le schéma en plein écran'}
          title={fullscreen ? 'Quitter le plein écran' : 'Plein écran'}
          onClick={() => {
            if (fullscreen) void document.exitFullscreen();
            else void (fullscreenTarget?.current ?? shell.current)?.requestFullscreen();
          }}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            {fullscreen
              ? <path d="M8 3v5H3M16 3v5h5M8 21v-5H3M16 21v-5h5" />
              : <path d="M3 8V3h5M21 8V3h-5M3 16v5h5M21 16v5h-5" />}
          </svg>
        </button>
      ) : null}
      {flowsProp && flowsProp.length === 0 && entities.length > 0 ? (
        <p role="status" className="card absolute left-1/2 top-1/2 z-10 m-0 max-w-xs -translate-x-1/2 -translate-y-1/2 px-4 py-3 text-center text-sm text-fg-muted">
          Aucun flux visible avec ces calques et cette étape. Activez un calque ou avancez la timeline.
        </p>
      ) : null}
      <ul className="absolute left-2 top-2 z-10 m-0 hidden list-none flex-wrap gap-x-3 gap-y-1 rounded-md bg-surface/85 px-2.5 py-1.5 text-[0.6875rem] text-fg-muted backdrop-blur-sm sm:flex" aria-label="Légende des couleurs de flux">
        {ROLE_LEGEND.map(([swatch, label]) => (
          <li key={swatch} className="flex items-center gap-1.5">
            <span className={`h-0.5 w-3 rounded-full ${swatch}`} aria-hidden />
            {label}
          </li>
        ))}
      </ul>
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
