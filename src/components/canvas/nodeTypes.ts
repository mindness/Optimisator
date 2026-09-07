import type { NodeTypes } from '@xyflow/react';

import { EntityNode } from './EntityNode';
import { AuthorityNode } from './nodes/AuthorityNode';
import { HoldingNode } from './nodes/HoldingNode';
import { PersonNode } from './nodes/PersonNode';
import { SasuNode } from './nodes/SasuNode';
import { SciNode } from './nodes/SciNode';
import type { EntityType } from '@/core/types';

/**
 * React Flow `nodeTypes` map.
 * Keys are used as `node.type` when converting presets.
 */
export const nodeTypes = {
  sasu: SasuNode,
  holding: HoldingNode,
  sci: SciNode,
  person: PersonNode,
  authority: AuthorityNode,
  entity: EntityNode,
} satisfies NodeTypes;

export type CanvasNodeType = keyof typeof nodeTypes;

/** Map domain EntityType → React Flow node type key. */
export function entityTypeToNodeType(entityType: EntityType): CanvasNodeType {
  switch (entityType) {
    case 'sasu':
      return 'sasu';
    case 'holding_sas':
    case 'holding_sarl':
      return 'holding';
    case 'sci_is':
    case 'sci_ir':
      return 'sci';
    case 'person':
      return 'person';
    case 'tax_authority':
    case 'urssaf':
      return 'authority';
    default:
      return 'entity';
  }
}
