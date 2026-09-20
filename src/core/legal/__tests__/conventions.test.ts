import { describe, expect, it } from 'vitest';
import { FULL_GROUP_PRESET, SASU_HOLDING_PRESET } from '../../presets';
import { snapshotScenario } from '../../scenarioWorkspace';
import { CONVENTIONS, conventionFlowExists, conventionsBetween, listConventionMatches, stakeOf } from '../conventions';
import { getLegalNote } from '../legalNotes';

describe('conventions catalogue', () => {
  it('every convention points to a cached legal note', () => {
    for (const convention of CONVENTIONS) expect(getLegalNote(convention.legalNoteId)?.id).toBe(convention.legalNoteId);
  });

  it('reads the stake from explicit links, then from the legacy preset field', () => {
    const preset = snapshotScenario(SASU_HOLDING_PRESET);
    expect(stakeOf(preset, 'holding-1', 'sasu-1')).toBe(100);
    const linked = { ...preset, ownerships: [{ id: 'o', ownerId: 'holding-1', companyId: 'sasu-1', percent: 4 }] };
    expect(stakeOf(linked, 'holding-1', 'sasu-1')).toBe(4);
    expect(stakeOf(preset, 'person-1', 'sasu-1')).toBeUndefined();
  });

  it('matches mère-fille, intégration and management fees between a SASU and its holding', () => {
    const preset = snapshotScenario(SASU_HOLDING_PRESET);
    const matches = conventionsBetween(preset, 'sasu-1', 'holding-1');
    const ids = matches.map((m) => m.convention.id);
    expect(ids).toEqual(expect.arrayContaining(['mere-fille', 'integration-fiscale', 'management-fees', 'convention-tresorerie']));
    expect(ids).not.toContain('bail-sci');
    const mereFille = matches.find((m) => m.convention.id === 'mere-fille')!;
    expect(mereFille.from.id).toBe('sasu-1');
    expect(mereFille.conditions[0]).toMatchObject({ status: 'met' });
    expect(conventionFlowExists(preset, mereFille)).toBe(true);
    const fees = matches.find((m) => m.convention.id === 'management-fees')!;
    expect(fees.flow).toMatchObject({ category: 'management_fees', sourceId: 'sasu-1', targetId: 'holding-1' });
  });

  it('flags an insufficient stake instead of hiding the convention', () => {
    const low = { ...snapshotScenario(SASU_HOLDING_PRESET), ownerships: [{ id: 'o', ownerId: 'holding-1', companyId: 'sasu-1', percent: 4 }] };
    const mereFille = conventionsBetween(low, 'sasu-1', 'holding-1').find((m) => m.convention.id === 'mere-fille')!;
    expect(mereFille.conditions[0]!.status).toBe('unmet');
  });

  it('lists the SCI lease and the personal distribution across a full group', () => {
    const ids = new Set(listConventionMatches(FULL_GROUP_PRESET).map((m) => m.convention.id));
    expect(ids.has('bail-sci')).toBe(true);
    expect(ids.has('distribution-personne')).toBe(true);
    expect(ids.has('cca-associe')).toBe(true);
  });
});
