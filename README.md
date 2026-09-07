# Simulateur de flux (SASU / Holding / SCI)

MVP perso local — canvas Money Flow, moteur fiscal déterministe, share hash / API courte.

## Prérequis

- Node.js 22+
- Sur Windows, si `npm` échoue en **401** (shim Safety CLI), utilisez les binaires Node :

```powershell
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npx.cmd" vitest run
```

## Lancer en local (2 terminaux)

### 1 — SPA (Vite)

```powershell
cd c:\Users\Mindness\Optimisator
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run dev
```

→ http://localhost:5173 (proxy `/api` → `http://127.0.0.1:8787`)

### 2 — API (Wrangler + D1 local)

```powershell
cd c:\Users\Mindness\Optimisator\backend
& "C:\Program Files\nodejs\npm.cmd" install
& "C:\Program Files\nodejs\npm.cmd" run db:migrate:local
& "C:\Program Files\nodejs\npm.cmd" run dev
```

→ http://127.0.0.1:8787 (`GET /health`, `POST/GET /api/scenarios`)

Détails API : [backend/README.md](backend/README.md). Variables optionnelles : [.env.example](.env.example).

## Tests

```powershell
# Front
& "C:\Program Files\nodejs\npx.cmd" vitest run

# API
cd backend
& "C:\Program Files\nodejs\npm.cmd" test
```

## Docs produit

- Spec : [docs/superpowers/specs/2026-09-06-simulateur-flux-design.md](docs/superpowers/specs/2026-09-06-simulateur-flux-design.md)
- Plan : [docs/superpowers/plans/2026-09-06-simulateur-flux.md](docs/superpowers/plans/2026-09-06-simulateur-flux.md)
- Design : [DESIGN.md](DESIGN.md) · Contraintes : [CONSTRAINTS.md](CONSTRAINTS.md)
- Perf 60 fps : [docs/performance-60fps.md](docs/performance-60fps.md)

## Avertissement

Simulation pédagogique — **pas** un conseil fiscal / juridique / financier.
