import { describe, expect, it } from 'vitest';

import type { FlowEdgeData } from '@/core/types';
import { labelOffsets } from '../FlowCanvas';

const flow = (id: string, sourceId: string, targetId: string): FlowEdgeData => ({
  id, sourceId, targetId, category: 'revenue', label: id, amount: 1, periodicity: 'annual', layer: 'treasury',
});

describe('labelOffsets', () => {
  it('écarte les libellés dont les milieux se recouvrent', () => {
    // Trois flux partant de la même carte : leurs milieux tombent dans la même
    // bande verticale, à 10 px l'un de l'autre — donc l'un sur l'autre.
    const centers = new Map([
      ['src', { x: 0, y: 100 }],
      ['a', { x: 400, y: 100 }],
      ['b', { x: 400, y: 120 }],
      ['c', { x: 400, y: 140 }],
    ]);
    const flows = [flow('fa', 'src', 'a'), flow('fb', 'src', 'b'), flow('fc', 'src', 'c')];
    const midY = (id: string, targetY: number) => (100 + targetY) / 2 + offsets.get(id)!;
    const offsets = labelOffsets(flows, centers);

    const ys = [midY('fa', 100), midY('fb', 120), midY('fc', 140)].sort((x, y) => x - y);
    for (let i = 1; i < ys.length; i += 1) {
      expect(ys[i]! - ys[i - 1]!).toBeGreaterThanOrEqual(60);
    }
  });

  it('sans positions connues, n’étage que les flux du même tracé', () => {
    const offsets = labelOffsets([flow('f1', 'a', 'b'), flow('f2', 'a', 'b'), flow('f3', 'a', 'c')]);
    expect(offsets.get('f1')).toBe(0);
    expect(offsets.get('f2')).toBeGreaterThan(0);
    expect(offsets.get('f3')).toBe(0);
  });
});
