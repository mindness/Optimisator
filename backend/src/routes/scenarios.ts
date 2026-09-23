import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import type { DrizzleD1Database } from 'drizzle-orm/d1';
import { Hono } from 'hono';
import { z } from 'zod';

import * as schema from '../db/schema';
import { scenarios, scenarioVersions } from '../db/schema';

/** Drizzle DB usable from D1 (Workers) or better-sqlite3 (Vitest). */
export type ScenarioDb =
  | DrizzleD1Database<typeof schema>
  | BetterSQLite3Database<typeof schema>;

/**
 * Forme minimale d'un scénario partageable : un payload `{ scenario }` ou un
 * ScenarioState nu. La SPA revalide le contenu complet à la lecture (Zod).
 */
const scenarioShape = z.object({
  id: z.string().min(1).max(200),
  name: z.string().min(1).max(200),
  entities: z.array(z.object({ id: z.string().min(1), label: z.string().min(1) }).passthrough()).min(1).max(200),
  flows: z.array(z.object({ id: z.string().min(1) }).passthrough()).max(2_000),
}).passthrough();
const shareShape = z.union([
  z.object({ scenario: scenarioShape }).passthrough(),
  scenarioShape,
]);
const createBodySchema = z.object({
  data: shareShape,
  isPublic: z.boolean().optional().default(true),
});

/** Un schéma compressé tient en quelques ko ; au-delà, ce n'est pas un scénario. */
export const MAX_BODY_BYTES = 256 * 1024;

const SLUG_ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz';

export function createSlug(length = 8): string {
  // 256 n'est pas un multiple de 36 : un `% 36` nu rendrait les 4 premiers
  // caractères plus probables que les autres. On rejette la queue non divisible.
  const limit = 256 - (256 % SLUG_ALPHABET.length);
  let out = '';
  while (out.length < length) {
    for (const b of crypto.getRandomValues(new Uint8Array(length))) {
      if (b >= limit) continue;
      out += SLUG_ALPHABET[b % SLUG_ALPHABET.length];
      if (out.length === length) break;
    }
  }
  return out;
}

function apiError(code: string, message: string, details?: unknown) {
  return {
    error: {
      code,
      message,
      ...(details !== undefined ? { details } : {}),
    },
  };
}

function nowIso(): string {
  return new Date().toISOString();
}

export type ScenariosRouterOptions = {
  /**
   * Autorise (ou non) une écriture pour une clé d'appelant. Absent = aucune
   * limite : c'est le cas des tests et du `wrangler dev` sans binding.
   */
  rateLimit?: (key: string) => Promise<boolean>;
};

export function createScenariosRouter(
  getDb: () => ScenarioDb,
  options: ScenariosRouterOptions = {},
) {
  const routes = new Hono();

  routes.post('/', async (c) => {
    if (options.rateLimit) {
      // Écriture ouverte : sans quota par appelant, n'importe qui peut remplir
      // la base. L'IP Cloudflare est la seule identité disponible ici.
      const caller = c.req.header('cf-connecting-ip') ?? 'unknown';
      if (!(await options.rateLimit(caller))) {
        return c.json(apiError('RATE_LIMITED', 'Too many scenarios created, retry in a minute'), 429);
      }
    }

    const declared = Number(c.req.header('content-length') ?? 0);
    if (declared > MAX_BODY_BYTES) {
      return c.json(apiError('PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`), 413);
    }
    let json: unknown;
    try {
      const text = await c.req.text();
      if (text.length > MAX_BODY_BYTES) {
        return c.json(apiError('PAYLOAD_TOO_LARGE', `Body exceeds ${MAX_BODY_BYTES} bytes`), 413);
      }
      json = JSON.parse(text);
    } catch {
      return c.json(apiError('INVALID_JSON', 'Request body must be JSON'), 400);
    }

    const parsed = createBodySchema.safeParse(json);
    if (!parsed.success) {
      return c.json(
        apiError('VALIDATION_ERROR', 'Invalid scenario payload', parsed.error.flatten()),
        422,
      );
    }

    const db = getDb();
    const slug = createSlug();
    const stamp = nowIso();
    const dataJson = JSON.stringify(parsed.data.data);

    const inserted = await db
      .insert(scenarios)
      .values({
        slug,
        dataJson,
        isPublic: parsed.data.isPublic,
        createdAt: stamp,
        updatedAt: stamp,
      })
      // `.returning()` sans projection : la surcharge à un argument n'existe pas
      // sur les deux pilotes (D1 et better-sqlite3) à la fois.
      .returning();

    const row = inserted[0];
    if (!row) {
      return c.json(apiError('PERSIST_FAILED', 'Failed to store scenario'), 500);
    }

    await db.insert(scenarioVersions).values({
      scenarioId: row.id,
      version: 1,
      dataJson,
      createdAt: stamp,
    });

    return c.json(
      {
        short_id: row.slug,
        slug: row.slug,
        url: `/s/${row.slug}`,
      },
      201,
    );
  });

  routes.get('/:slug', async (c) => {
    const slug = c.req.param('slug');
    if (!slug || slug.length < 4) {
      return c.json(apiError('VALIDATION_ERROR', 'Invalid slug'), 422);
    }

    const db = getDb();
    const rows = await db
      .select()
      .from(scenarios)
      .where(eq(scenarios.slug, slug))
      .limit(1);

    const row = rows[0];
    // `isPublic: false` doit fermer le lien, sinon le champ promet une
    // confidentialité qu'il n'applique pas. Même réponse qu'un slug inconnu :
    // l'existence d'un scénario privé n'a pas à être confirmée.
    if (!row || !row.isPublic) {
      return c.json(apiError('NOT_FOUND', `Scenario "${slug}" not found`), 404);
    }

    let data: unknown;
    try {
      data = JSON.parse(row.dataJson);
    } catch {
      return c.json(apiError('CORRUPT_DATA', 'Stored scenario JSON is invalid'), 500);
    }

    return c.json({
      short_id: row.slug,
      slug: row.slug,
      isPublic: row.isPublic,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
      data,
    });
  });

  return routes;
}
