import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it, beforeEach } from 'vitest';

import * as schema from '../db/schema';
import { createTestApp } from '../index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(
  join(__dirname, '../../migrations/0001_init.sql'),
  'utf8',
);

function createMemoryDb() {
  const sqlite = new Database(':memory:');
  sqlite.exec(MIGRATION_SQL);
  return drizzle(sqlite, { schema });
}

const sampleScenario = {
  id: 'test-scenario',
  name: 'SASU solo',
  entities: [{ id: 'sasu-1', label: 'SASU' }],
  flows: [],
  activeLayers: ['treasury'],
  version: 1,
  createdAt: '2026-09-07T00:00:00.000Z',
  updatedAt: '2026-09-07T00:00:00.000Z',
};

describe('POST /api/scenarios', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp(createMemoryDb());
  });

  it('creates a scenario and returns short_id / slug', async () => {
    const res = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: sampleScenario }),
    });

    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.slug).toMatch(/^[0-9a-z]{8}$/);
    expect(body.short_id).toBe(body.slug);
    expect(body.url).toBe(`/s/${body.slug}`);
  });

  it('returns 422 when data is not an object', async () => {
    const res = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: 'not-an-object' }),
    });

    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for invalid JSON body', async () => {
    const res = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{',
    });

    expect(res.status).toBe(400);
  });
});

describe('GET /api/scenarios/:slug', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeEach(() => {
    app = createTestApp(createMemoryDb());
  });

  it('round-trips a scenario by short_id', async () => {
    const createRes = await app.request('/api/scenarios', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: sampleScenario, isPublic: true }),
    });
    const created = await createRes.json();

    const getRes = await app.request(`/api/scenarios/${created.slug}`);
    expect(getRes.status).toBe(200);

    const loaded = await getRes.json();
    expect(loaded.short_id).toBe(created.short_id);
    expect(loaded.slug).toBe(created.slug);
    expect(loaded.data).toEqual(sampleScenario);
    expect(loaded.isPublic).toBe(true);
  });

  it('returns 404 for unknown slug', async () => {
    const res = await app.request('/api/scenarios/zzzzzzzz');
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
  });
});

describe('GET /health', () => {
  it('returns ok', async () => {
    const app = createTestApp(createMemoryDb());
    const res = await app.request('/health');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
