/**
 * Simulateur Flux API — Hono on Cloudflare Workers + D1.
 *
 * Local run (no deploy required):
 *   cd backend
 *   npm install
 *   npm run db:migrate:local
 *   npm run dev
 * Then: GET/POST http://127.0.0.1:8787/api/scenarios
 *
 * Tests use in-memory better-sqlite3 (CI-friendly, no CF account).
 */
import { drizzle as drizzleD1 } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Context } from 'hono';

import * as schema from './db/schema';
import {
  createScenariosRouter,
  type ScenarioDb,
} from './routes/scenarios';

export type AppBindings = {
  DB: D1Database;
  /** Origines autorisées, séparées par des virgules ; vide = toutes (dev). */
  ALLOWED_ORIGINS?: string;
};

function applyCors(app: Hono<{ Bindings: AppBindings }>) {
  app.use('*', (c, next) => {
    const allowed = (c.env?.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean);
    return cors({
      origin: allowed.length === 0 ? '*' : (origin) => (allowed.includes(origin) ? origin : null),
      allowMethods: ['GET', 'POST', 'OPTIONS'],
      allowHeaders: ['Content-Type'],
    })(c, next);
  });
}

/** Vitest / local factory with an injected Drizzle database (better-sqlite3). */
export function createApp(options: { db: ScenarioDb }) {
  const app = new Hono<{ Bindings: AppBindings }>();
  applyCors(app);
  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/api/scenarios', createScenariosRouter(() => options.db));
  return app;
}

export function createTestApp(db: ScenarioDb) {
  return createApp({ db });
}

async function handleScenarios(
  c: Context<{ Bindings: AppBindings }>,
): Promise<Response> {
  if (!c.env?.DB) {
    return c.json(
      { error: { code: 'NO_DB', message: 'D1 binding DB is missing' } },
      500,
    );
  }
  const db = drizzleD1(c.env.DB, { schema });
  const router = createScenariosRouter(() => db);
  const url = new URL(c.req.url);
  const stripped = url.pathname.replace(/^\/api\/scenarios/, '') || '/';
  const req = new Request(new URL(stripped + url.search, url.origin), c.req.raw);
  return router.fetch(req);
}

/** Worker entry: resolves D1 per request then delegates to scenario routes. */
export function createWorkerApp() {
  const app = new Hono<{ Bindings: AppBindings }>();
  applyCors(app);
  app.get('/health', (c) => c.json({ ok: true }));
  app.all('/api/scenarios', (c) => handleScenarios(c));
  app.all('/api/scenarios/*', (c) => handleScenarios(c));
  return app;
}

const app = createWorkerApp();

export default app;
