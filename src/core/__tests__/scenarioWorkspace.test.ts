import { describe, expect, it } from 'vitest';
import { FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET } from '../presets';
import { loadWorkspace, removeEntity, saveWorkspace, simulationIssues, snapshotScenario } from '../scenarioWorkspace';

function memory() {
  const data = new Map<string, string>();
  return { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
}

describe('scenario workspace', () => {
  it('copies live overrides without mutating a preset', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET, { caHt: 180_000, executiveNetSalary: 12_000 });
    expect(draft.entities.find((entity) => entity.entityType === 'sasu')?.inputs?.caHt).toBe(180_000);
    expect(draft.flows.find((flow) => flow.category === 'salary')?.amount).toBe(12_000);
    expect(FREELANCE_SASU_PRESET.entities.find((entity) => entity.entityType === 'sasu')?.inputs?.caHt).toBe(120_000);
  });
  it('removes incident flows and positions with an entity', () => {
    const draft = { ...snapshotScenario(FREELANCE_SASU_PRESET), nodePositions: { 'person-1': { x: 1, y: 2 } } };
    const next = removeEntity(draft, 'person-1');
    expect(next.flows.some((flow) => flow.targetId === 'person-1')).toBe(false);
    expect(next.nodePositions?.['person-1']).toBeUndefined();
  });
  it('round trips the draft, baseline and layout', () => {
    const storage = memory();
    const draft = { ...snapshotScenario(FREELANCE_SASU_PRESET), nodePositions: { 'sasu-1': { x: 222, y: 333 } } };
    saveWorkspace(storage, { version: 1, draft, baseline: FREELANCE_SASU_PRESET });
    expect(loadWorkspace(storage)).toEqual({ version: 1, draft, baseline: FREELANCE_SASU_PRESET });
  });
  it('returns null for empty storage and rejects corrupt data', () => {
    expect(loadWorkspace(memory())).toBeNull();
    expect(() => loadWorkspace({ getItem: () => '{broken' })).toThrow();
    expect(() => loadWorkspace({ getItem: () => '{"version":99}' })).toThrow();
  });
  it('permits the covered preset but blocks unimplemented management fees', () => {
    expect(simulationIssues(FREELANCE_SASU_PRESET)).toEqual([]);
    expect(simulationIssues(SASU_HOLDING_PRESET).some((issue) => issue.includes('management_fees'))).toBe(true);
  });
  it('blocks unsupported topology and non-annual amounts', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.entities.push({ id: 'opco-2', label: 'Autre SASU', entityType: 'sasu' });
    draft.flows[0]!.periodicity = 'monthly';
    expect(simulationIssues(draft).length).toBeGreaterThan(1);
  });
  it('blocks orphaned and negative flows', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.flows[0]!.targetId = 'missing';
    draft.flows[0]!.amount = -1;
    expect(simulationIssues(draft).length).toBeGreaterThan(1);
  });
});
