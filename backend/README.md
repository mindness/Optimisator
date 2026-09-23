# Simulateur Flux — Edge API (Hono + Cloudflare D1)

## Local development (no deploy)

```bash
cd backend
npm install
npm run db:migrate:local   # apply migrations/0001_init.sql to local D1
npm run dev                # wrangler dev → http://127.0.0.1:8787
```

Endpoints:

- `POST /api/scenarios` — body `{ "data": { ...scenario }, "isPublic"?: true }` → `{ short_id, slug, url }`.
  Limité à 10 écritures par minute et par IP via le binding `WRITE_LIMIT` ; sans
  ce binding (dev, tests) l'endpoint n'a aucun quota. Dépassement → `429`.
- `GET /api/scenarios/:slug` — load saved scenario JSON. `isPublic: false` répond
  `404`, comme un slug inconnu : le lien est refermé sans confirmer l'existence.
- `GET /health`

## Tests (CI-friendly, no Cloudflare account)

Uses in-memory `better-sqlite3` + Hono `app.request`:

```bash
cd backend
npm test
```

## Production note

Replace `database_id` in `wrangler.toml` after `npx wrangler d1 create simulateur-flux`, then apply migrations with `--remote` when you intentionally deploy (not part of Task 10).

Avant d'exposer le Worker, vérifier deux valeurs dans `wrangler.toml` :

- `ALLOWED_ORIGINS` — vide signifie « toutes origines ». À renseigner avec le
  domaine de la SPA.
- `[[ratelimits]]` `WRITE_LIMIT` — c'est le seul garde-fou sur une écriture
  ouverte. Le retirer rouvre la base à des insertions illimitées de 256 ko.
  Le compteur est local au datacentre Cloudflare qui exécute le Worker, donc
  permissif : le quota réel est « 10 par minute et par IP *et par colo* ». Il
  arrête un script isolé, pas une source répartie — prévoir une purge par âge
  si le volume devient un sujet.
