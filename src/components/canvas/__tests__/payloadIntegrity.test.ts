import { describe, expect, it } from 'vitest';
import { flowsToEdges, ownershipEdges } from '../FlowCanvas';
import { FREELANCE_SASU_PRESET } from '@/core/presets';

it('does not write callbacks into a financial scenario', () => {
  const flow = structuredClone(FREELANCE_SASU_PRESET.flows[0]!);
  Object.freeze(flow);
  const onSelect = () => {};
  const edges = flowsToEdges([flow], onSelect);
  expect(edges[0]?.data?.onSelect).toBe(onSelect);
  expect('onSelect' in flow).toBe(false);
  expect(() => structuredClone(flow)).not.toThrow();
});

describe('legal edges', () => {
  it('labels ownership in percent rather than euros and has no financial payload', () => {
    const edges = ownershipEdges([{ id: 'o1', ownerId: 'person-1', companyId: 'sasu-1', percent: 75 }]);
    expect(edges[0]?.label).toBe('Détention 75 %');
    expect(edges[0]?.data).toBeUndefined();
    expect(edges[0]?.style?.strokeDasharray).toBeDefined();
  });
});
