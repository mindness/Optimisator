import type { EdgeTypes } from '@xyflow/react';

import { FlowEdge } from './FlowEdge';

export const edgeTypes = {
  flow: FlowEdge,
} satisfies EdgeTypes;

export type CanvasEdgeType = keyof typeof edgeTypes;
