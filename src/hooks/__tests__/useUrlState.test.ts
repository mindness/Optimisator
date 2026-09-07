import { describe, expect, it } from 'vitest';

import { FREELANCE_SASU_PRESET } from '@/core/presets';
import {
  buildHashShareUrl,
  buildShortSharePath,
  buildShortShareUrl,
  decodeUrlState,
  encodeUrlState,
  parseShareBootIntent,
  parseSharePayload,
} from '@/hooks/useUrlState';

describe('useUrlState encode/decode', () => {
  it('round-trips a scenario-like payload', () => {
    const payload = {
      scenario: { id: 's1', name: 'Test' },
      whatIf: { caHt: 120_000 },
    };
    const encoded = encodeUrlState(payload);
    expect(encoded.length).toBeGreaterThan(0);
    expect(decodeUrlState(encoded)).toEqual(payload);
  });

  it('returns null for corrupt input', () => {
    expect(decodeUrlState('!!!not-valid!!!')).toBeNull();
    expect(decodeUrlState('')).toBeNull();
  });

  it('builds a hash share URL', () => {
    const url = buildHashShareUrl({ a: 1 }, 'https://example.test/app');
    expect(url.startsWith('https://example.test/app#s=')).toBe(true);
    const encoded = url.split('#s=')[1]!;
    expect(decodeUrlState(encoded)).toEqual({ a: 1 });
  });

  it('builds short share URLs aligned with API /s/:slug', () => {
    expect(buildShortSharePath('abcd1234')).toBe('/s/abcd1234');
    expect(buildShortShareUrl('abcd1234', 'https://example.test')).toBe(
      'https://example.test/s/abcd1234',
    );
  });
});

describe('parseShareBootIntent', () => {
  it('reads /s/:slug path', () => {
    expect(
      parseShareBootIntent({
        pathname: '/s/abcd1234',
        search: '',
        hash: '',
      }),
    ).toEqual({ kind: 'slug', slug: 'abcd1234' });
  });

  it('reads ?s= slug query', () => {
    expect(
      parseShareBootIntent({
        pathname: '/',
        search: '?s=abcd1234',
        hash: '',
      }),
    ).toEqual({ kind: 'slug', slug: 'abcd1234' });
  });

  it('reads #s= hash payload', () => {
    const encoded = encodeUrlState({ a: 1 });
    expect(
      parseShareBootIntent({
        pathname: '/',
        search: '',
        hash: `#s=${encoded}`,
      }),
    ).toEqual({ kind: 'hash', encoded });
  });
});

describe('parseSharePayload', () => {
  it('accepts SharePayload with scenario', () => {
    const parsed = parseSharePayload({
      scenario: FREELANCE_SASU_PRESET,
      whatIf: { caHt: 99_000 },
      activeLayers: ['treasury'],
    });
    expect(parsed?.scenario.id).toBe(FREELANCE_SASU_PRESET.id);
    expect(parsed?.whatIf?.caHt).toBe(99_000);
    expect(parsed?.activeLayers).toEqual(['treasury']);
  });

  it('accepts bare ScenarioState', () => {
    const parsed = parseSharePayload(FREELANCE_SASU_PRESET);
    expect(parsed?.scenario.id).toBe(FREELANCE_SASU_PRESET.id);
  });
});
