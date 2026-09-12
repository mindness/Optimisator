import { describe, expect, it } from 'vitest';
import { FREELANCE_SASU_PRESET } from '../presets';
import { ownershipIssues, removeEntity, simulationIssues, snapshotScenario, updateWorkspaceEntity, updateWorkspaceFlow } from '../scenarioWorkspace';

describe('ownership and financial input integrity', () => {
  it('keeps legal links separate from cash flows', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.ownerships = [{ id: 'o1', ownerId: 'person-1', companyId: 'sasu-1', percent: 100 }];
    expect(ownershipIssues(draft)).toEqual([]);
    expect(draft.flows).toEqual(FREELANCE_SASU_PRESET.flows);
    expect(removeEntity(draft, 'person-1').ownerships).toEqual([]);
  });
  it('rejects self ownership, duplicate pairs and aggregate ownership above 100%', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.ownerships = [
      { id: 'o1', ownerId: 'person-1', companyId: 'sasu-1', percent: 60 },
      { id: 'o2', ownerId: 'person-1', companyId: 'sasu-1', percent: 60 },
      { id: 'o3', ownerId: 'sasu-1', companyId: 'sasu-1', percent: 1 },
    ];
    expect(ownershipIssues(draft).length).toBe(3);
  });
  it('allows incomplete capital without inventing owners', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.ownerships = [{ id: 'o1', ownerId: 'person-1', companyId: 'sasu-1', percent: 25 }];
    expect(ownershipIssues(draft)).toEqual([]);
    expect(draft.ownerships).toHaveLength(1);
  });
  it('updates financial inputs when a flow amount changes', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    const next = updateWorkspaceFlow(draft, 'flow-revenue', { amount: 200_000 });
    expect(next.entities.find((entity) => entity.id === 'sasu-1')?.inputs?.caHt).toBe(200_000);
    expect(simulationIssues(next)).toEqual([]);
    expect(draft.flows.find((flow) => flow.id === 'flow-revenue')?.amount).toBe(120_000);
  });
  it('updates a displayed flow when a company parameter changes', () => {
    const next = updateWorkspaceEntity(snapshotScenario(FREELANCE_SASU_PRESET), 'sasu-1', { inputs: { caHt: 150_000, expensesHt: 30_000 } });
    expect(next.flows.find((flow) => flow.category === 'revenue')?.amount).toBe(150_000);
    expect(next.flows.find((flow) => flow.category === 'expense')?.amount).toBe(30_000);
    expect(simulationIssues(next)).toEqual([]);
  });
  it('rejects inconsistent imported amounts instead of comparing misleading results', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.flows[0]!.amount = 1;
    expect(simulationIssues(draft).some((issue) => issue.includes('incohérents'))).toBe(true);
  });
});
