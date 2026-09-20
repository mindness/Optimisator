/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { DEFAULT_NODE_HEIGHT, FlowCanvas, NODE_HEIGHT, NODE_WIDTH, flowsToEdges, layoutPresetNodes, mergeNodePositions } from '../FlowCanvas';
import { STRUCTURE_PRESETS } from '@/core/presets';
import { FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET } from '@/core/presets';
import { flowCycleSeconds } from '../FlowEdge';

beforeAll(() => {
  class ResizeObserverStub {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  globalThis.ResizeObserver = ResizeObserverStub as unknown as typeof ResizeObserver;

  if (!HTMLElement.prototype.scrollIntoView) {
    HTMLElement.prototype.scrollIntoView = () => {};
  }
});

afterEach(() => {
  cleanup();
});

describe('flowCycleSeconds', () => {
  it('speeds the dash up with the amount, with a 0.6s floor', () => {
    expect(flowCycleSeconds(0)).toBe(2.4);
    // log10(100)=2 → 2.4 - 0.6
    expect(flowCycleSeconds(99)).toBeCloseTo(1.8, 5);
    expect(flowCycleSeconds(1_000_000)).toBe(0.6);
    expect(flowCycleSeconds(-1_000_000_000)).toBe(0.6);
  });
});

describe('flowsToEdges selection', () => {
  it('marks the selected flow id on the edge', () => {
    const edges = flowsToEdges(FREELANCE_SASU_PRESET.flows, undefined, 'flow-salary');
    const salary = edges.find((e) => e.id === 'flow-salary');
    const revenue = edges.find((e) => e.id === 'flow-revenue');
    expect(salary?.selected).toBe(true);
    expect(revenue?.selected).toBe(false);
  });
});

describe('FlowCanvas', () => {
  it('loads FREELANCE_SASU_PRESET without crashing', () => {
    render(<FlowCanvas scenario={FREELANCE_SASU_PRESET} />);

    const canvas = screen.getByTestId('flow-canvas');
    expect(canvas).toBeInTheDocument();
    expect(canvas).toHaveAttribute('data-preset', 'freelance-sasu');
    expect(canvas).toHaveAttribute(
      'aria-label',
      expect.stringContaining('Freelance SASU'),
    );
  });

  it('loads SASU_HOLDING_PRESET without crashing', () => {
    render(<FlowCanvas scenario={SASU_HOLDING_PRESET} />);

    const canvas = screen.getByTestId('flow-canvas');
    expect(canvas).toHaveAttribute('data-preset', 'sasu-holding');
  });
});

describe('mergeNodePositions', () => {
  it('preserves drag positions when entity ids are unchanged', () => {
    const layout = layoutPresetNodes(FREELANCE_SASU_PRESET.entities);
    const dragged = layout.map((n, i) =>
      i === 0 ? { ...n, position: { x: 999, y: 888 } } : n,
    );
    const merged = mergeNodePositions(layout, dragged);
    expect(merged[0]?.position).toEqual({ x: 999, y: 888 });
  });

  it('resets layout when topology (entity ids) changes', () => {
    const layoutA = layoutPresetNodes(FREELANCE_SASU_PRESET.entities);
    const layoutB = layoutPresetNodes(SASU_HOLDING_PRESET.entities);
    const dragged = layoutA.map((n) => ({
      ...n,
      position: { x: 1, y: 2 },
    }));
    const merged = mergeNodePositions(layoutB, dragged);
    expect(merged.map((n) => n.id)).toEqual(layoutB.map((n) => n.id));
    expect(merged[0]?.position).toEqual(layoutB[0]?.position);
  });
});

describe('layoutPresetNodes', () => {
  it('never overlaps two cards, on every preset', () => {
    for (const preset of STRUCTURE_PRESETS) {
      const boxes = layoutPresetNodes(preset.entities, preset.flows).map((node, index) => ({
        id: node.id,
        x: node.position.x,
        y: node.position.y,
        w: NODE_WIDTH,
        h: NODE_HEIGHT[preset.entities[index]!.entityType] ?? DEFAULT_NODE_HEIGHT,
      }));
      for (let i = 0; i < boxes.length; i += 1) {
        for (let j = i + 1; j < boxes.length; j += 1) {
          const a = boxes[i]!;
          const b = boxes[j]!;
          const overlap = a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
          expect(`${preset.id} ${a.id}/${b.id}: ${overlap}`).toBe(`${preset.id} ${a.id}/${b.id}: false`);
        }
      }
    }
  });
});
