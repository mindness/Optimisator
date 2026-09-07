/**
 * @vitest-environment jsdom
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { FlowCanvas, flowsToEdges, layoutPresetNodes, mergeNodePositions } from '../FlowCanvas';
import { FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET } from '@/core/presets';
import { particleDurationSeconds } from '../FlowEdge';

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

describe('particleDurationSeconds', () => {
  it('clamps cycle duration between 1.5s and 6s from log10(amount)', () => {
    expect(particleDurationSeconds(0)).toBe(1.5);
    // log10(10)=1 → clamped to floor 1.5
    expect(particleDurationSeconds(9)).toBe(1.5);
    expect(particleDurationSeconds(99)).toBeCloseTo(Math.log10(100), 5);
    expect(particleDurationSeconds(1_000_000)).toBe(6);
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
