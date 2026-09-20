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

## Qualité (lint, types, tests)

```powershell
& "C:\Program Files\nodejs\npm.cmd" run check   # lint + typecheck + tests
& "C:\Program Files\nodejs\npm.cmd" run lint    # ESLint (flat config, react-hooks + jsx-a11y)
& "C:\Program Files\nodejs\npm.cmd" run typecheck
& "C:\Program Files\nodejs\npm.cmd" test        # vitest run

# API
cd backend
& "C:\Program Files\nodejs\npm.cmd" test
```

La CI GitHub ([.github/workflows/ci.yml](.github/workflows/ci.yml)) rejoue `lint → typecheck → test → build`
sur chaque push `master` et chaque PR.

## Construire un schéma et lire les régimes

La palette dépose une entité, un glisser-déposer entre deux entités crée le flux. Le tracé
se qualifie tout seul : **SASU → Holding** devient un dividende en **régime mère-fille**
(CGI art. 145 / 216, quote-part de frais 5 % → ~1,25 % de friction), **Holding/SASU → personne**
devient un dividende au **PFU**. Le taux et le montant d'impôt s'affichent sur l'arête du canvas
et dans le panneau du flux, avec le lien Légifrance ; une détention < 5 % déclenche une alerte.

Les **presets de vue** (Dirigeant / Comptable / Associé / Pédagogique) règlent les calques en un clic
au-dessus du sélecteur de calques.

## Limites du modèle

- **Onglet Structures** : le comparateur (`src/core/engine/structureComparator.ts`) chiffre micro,
  EI / EURL à l'IR, EURL-SARL à l'IS (gérant TNS, règle des 10 % du capital), SASU et SASU + holding
  à CA, charges et foyer constants, chacune à son propre optimum rémunération / dividendes. Le
  classement porte sur le cash : ni droits sociaux (retraite, chômage, prévoyance), ni coûts de
  structure, ni report d'imposition d'une holding n'y sont valorisés — voir « Limites du comparatif ».
- **EURL / SARL / SCI à l'IR / holding SARL / banque** restent marquées « schéma seul » **sur le
  canvas** : le graphe de flux est résolu autour d'une SASU et ne chiffre pas ces structures en place.
  Leur arbitrage se lit dans l'onglet Structures. Le motif exact s'affiche en infobulle de palette.
- **IR et TMI** : le barème 2026 est appliqué au **net imposable** (net + CSG/CRDS non déductibles),
  avec parts de quotient familial, plafonnement (1 807 € par demi-part) et décote. La TMI et le taux
  moyen s'affichent dans la barre de synthèse ; le foyer se règle dans le panneau What-If.
  Réductions et crédits d'impôt, frais réels et revenus étrangers restent hors modèle.
- **Dividendes** : PFU ou option barème (abattement 40 %, CSG déductible 6,8 pts), au choix ou en
  mode automatique qui retient le moins coûteux à TMI constatée. L'option barème est globale sur
  tous les revenus de capitaux mobiliers du foyer : ceux hors simulation ne sont pas modélisés.
- Les taux portés par [src/core/engine/taxRules.ts](src/core/engine/taxRules.ts) sont sourcés
  (`source` / `asOf` / `status`) et vérifiés sur Légifrance. Le PFU y vaut **31,4 %** (12,8 % IR
  + 18,6 % de prélèvements sociaux : CSG 10,6 % + solidarité 7,5 % + CRDS 0,5 %) et non les 30 %
  arrondis du cahier des charges initial.
- Pas d'authentification ni de base de données côté SPA : les scénarios vivent en `localStorage`
  et dans le hash d'URL ; l'API D1 de `backend/` ne sert qu'aux liens courts.

## Docs produit

- Spec : [docs/superpowers/specs/2026-09-06-simulateur-flux-design.md](docs/superpowers/specs/2026-09-06-simulateur-flux-design.md)
- Plan : [docs/superpowers/plans/2026-09-06-simulateur-flux.md](docs/superpowers/plans/2026-09-06-simulateur-flux.md)
- Design : [DESIGN.md](DESIGN.md) · Contraintes : [CONSTRAINTS.md](CONSTRAINTS.md)
- Perf 60 fps : [docs/performance-60fps.md](docs/performance-60fps.md)

## Avertissement

Simulation pédagogique — **pas** un conseil fiscal / juridique / financier.
