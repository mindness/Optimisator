# Simulateur Flux — Edge API (Hono + Cloudflare D1)

## Local development (no deploy)

```bash
cd backend
npm install
npm run db:migrate:local   # apply migrations/0001_init.sql to local D1
npm run dev                # wrangler dev → http://127.0.0.1:8787
```

Endpoints:

- `POST /api/scenarios` — body `{ "data": { ...scenario }, "isPublic"?: true }` → `{ short_id, slug, url }`
- `GET /api/scenarios/:slug` — load saved scenario JSON
- `GET /health`

## Tests (CI-friendly, no Cloudflare account)

Uses in-memory `better-sqlite3` + Hono `app.request`:

```bash
cd backend
npm test
```

## Production note

Replace `database_id` in `wrangler.toml` after `npx wrangler d1 create simulateur-flux`, then apply migrations with `--remote` when you intentionally deploy (not part of Task 10).
