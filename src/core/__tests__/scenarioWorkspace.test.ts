import { describe, expect, it } from 'vitest';
import { FREELANCE_SASU_PRESET, SASU_HOLDING_PRESET } from '../presets';
import { adviseFlow, completeScenario, loadDraft, saveDraft, ENGINE_COVERED_TYPES, exportScenarioFile, loadWorkspace, parseScenarioFile, removeEntity, saveWorkspace, scenarioFileName, simulationIssues, snapshotScenario } from '../scenarioWorkspace';

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
  it('permits both covered presets, management fees included', () => {
    expect(simulationIssues(FREELANCE_SASU_PRESET)).toEqual([]);
    expect(simulationIssues(SASU_HOLDING_PRESET)).toEqual([]);
  });
  it('accepts several companies and monthly flows, rejects unknown routes', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.entities.push({ id: 'opco-2', label: 'Autre SASU', entityType: 'sasu' });
    draft.flows[0]!.periodicity = 'monthly';
    expect(simulationIssues(draft)).toEqual([]);
    draft.flows.push({ id: 'odd', sourceId: 'client-1', targetId: 'person-1', category: 'revenue', label: 'Bizarre', amount: 1, periodicity: 'annual', layer: 'treasury' });
    expect(simulationIssues(draft).some((issue) => issue.includes('non calculable'))).toBe(true);
  });
  it('proposes the mère-fille regime on a SASU → holding link and flags a missing stake', () => {
    const draft = snapshotScenario(SASU_HOLDING_PRESET);
    const advice = adviseFlow(draft, { sourceId: 'sasu-1', targetId: 'holding-1', amount: 50_000 });
    expect(advice).toMatchObject({ category: 'dividend', legalNoteId: 'mere-fille-art-145' });
    expect(advice!.rate).toBeCloseTo(0.0125, 6);
    expect(advice!.tax).toBe(625);
    expect(advice!.warning).toBeUndefined();

    const orphan = { ...draft, ownerships: [], entities: draft.entities.map((e) => ({ ...e, ownershipPercent: undefined })) };
    expect(adviseFlow(orphan, { sourceId: 'sasu-1', targetId: 'holding-1' })!.warning).toContain('5 %');
    expect(adviseFlow(draft, { sourceId: 'holding-1', targetId: 'person-1' })!.regime).toContain('PFU');
  });
  it('covers every legal form on the canvas', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.entities.push({ id: 'eurl-1', label: 'EURL', entityType: 'eurl' });
    expect(simulationIssues(draft)).toEqual([]);
    for (const type of ['eurl', 'sarl', 'holding_sarl', 'sci_ir', 'micro_entreprise', 'entreprise_individuelle', 'bank'] as const) expect(ENGINE_COVERED_TYPES.has(type)).toBe(true);
    expect(ENGINE_COVERED_TYPES.has('sasu')).toBe(true);
  });
  it('blocks orphaned and negative flows', () => {
    const draft = snapshotScenario(FREELANCE_SASU_PRESET);
    draft.flows[0]!.targetId = 'missing';
    draft.flows[0]!.amount = -1;
    expect(simulationIssues(draft).length).toBeGreaterThan(1);
  });

  it('round trips a scenario through the export file and accepts bare or shared JSON', () => {
    const draft = snapshotScenario(SASU_HOLDING_PRESET, { caHt: 150_000 });
    const parsed = parseScenarioFile(exportScenarioFile(draft, { parts: 2 }));
    expect(parsed.scenario).toEqual(draft);
    expect(parsed.whatIf).toEqual({ parts: 2 });
    expect(parseScenarioFile(JSON.stringify(draft)).scenario).toEqual(draft);
    expect(parseScenarioFile(JSON.stringify({ scenario: draft, whatIf: { parts: 1 } })).whatIf).toEqual({ parts: 1 });
    expect(() => parseScenarioFile('{"format":"optimisator.scenario","version":1}')).toThrow();
    expect(scenarioFileName({ ...draft, name: 'Holding & SCI été' })).toBe('holding-sci-ete.optimisator.json');
  });
  it('completes an empty draft into a computable scenario without touching what exists', () => {
    const empty = { ...snapshotScenario(FREELANCE_SASU_PRESET), entities: [{ id: 'p', label: 'Moi', entityType: 'person' as const }, { id: 'h', label: 'Ma holding', entityType: 'holding_sas' as const }], flows: [] };
    const done = completeScenario(empty);
    expect(simulationIssues(done)).toEqual([]);
    expect(done.entities.find((entity) => entity.id === 'h')?.label).toBe('Ma holding');
    expect(done.entities.some((entity) => entity.entityType === 'sasu')).toBe(true);
    expect(done.flows.some((flow) => flow.category === 'is_tax' && flow.sourceId === 'h')).toBe(true);
    expect(simulationIssues({ ...empty, entities: [empty.entities[0]!] })).toContain('Ajoutez au moins une société.');
    expect(completeScenario(FREELANCE_SASU_PRESET)).toEqual(FREELANCE_SASU_PRESET);
  });
  it('advises the management fees convention on a SASU → holding link', () => {
    const advice = adviseFlow(snapshotScenario(SASU_HOLDING_PRESET), { sourceId: 'sasu-1', targetId: 'holding-1', category: 'management_fees', amount: 12_000 });
    expect(advice).toMatchObject({ legalNoteId: 'management-fees', tax: 1_800 });
    expect(advice!.warning).toContain('acte anormal');
  });

  it('restores a session draft only for the scenario it was started from', () => {
    const storage = memory();
    const draft = { ...snapshotScenario(FREELANCE_SASU_PRESET), name: 'En cours' };
    saveDraft(storage, FREELANCE_SASU_PRESET.id, draft);
    expect(loadDraft(storage, FREELANCE_SASU_PRESET.id)?.name).toBe('En cours');
    expect(loadDraft(storage, SASU_HOLDING_PRESET.id)).toBeNull();
    expect(loadDraft({ getItem: () => '{bad' }, FREELANCE_SASU_PRESET.id)).toBeNull();
  });
});
