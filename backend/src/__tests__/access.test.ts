import Database from 'better-sqlite3';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { drizzle } from 'drizzle-orm/better-sqlite3';
import { describe, expect, it } from 'vitest';

import * as schema from '../db/schema';
import { createTestApp } from '../index';

const __dirname = dirname(fileURLToPath(import.meta.url));
const MIGRATION_SQL = readFileSync(join(__dirname, '../../migrations/0001_init.sql'), 'utf8');

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
};

const post = (app: ReturnType<typeof createTestApp>, body: unknown) =>
  app.request('/api/scenarios', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

describe('confidentialité du lien', () => {
  it('un scénario non public répond 404, comme un slug inconnu', async () => {
    const app = createTestApp(createMemoryDb());
    const created = await (await post(app, { data: sampleScenario, isPublic: false })).json() as any;

    const res = await app.request(`/api/scenarios/${created.slug}`);
    expect(res.status).toBe(404);
    // Ne confirme pas l'existence du scénario.
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: `Scenario "${created.slug}" not found` },
    });
  });

  it('un scénario public reste lisible', async () => {
    const app = createTestApp(createMemoryDb());
    const created = await (await post(app, { data: sampleScenario })).json() as any;
    expect((await app.request(`/api/scenarios/${created.slug}`)).status).toBe(200);
  });
});

describe('quota d’écriture', () => {
  it('refuse en 429 au-delà du quota, et ne persiste rien', async () => {
    const db = createMemoryDb();
    let allowed = 2;
    const app = createTestApp(db, async () => allowed-- > 0);

    expect((await post(app, { data: sampleScenario })).status).toBe(201);
    expect((await post(app, { data: sampleScenario })).status).toBe(201);

    const res = await post(app, { data: sampleScenario });
    expect(res.status).toBe(429);
    expect(await db.select().from(schema.scenarios)).toHaveLength(2);
  });

  it('sans quota configuré, l’écriture passe (dev et tests)', async () => {
    const app = createTestApp(createMemoryDb());
    for (let i = 0; i < 3; i += 1) {
      expect((await post(app, { data: sampleScenario })).status).toBe(201);
    }
  });
});
