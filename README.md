# Simulateur de flux (SASU / Holding / SCI)

Site statique, sans compte ni base de données — canvas Money Flow, moteur fiscal déterministe par entité, conventions intra-groupe sourcées, export / import de schémas.

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

## Déployer

### Site statique seul (aucun serveur)

```powershell
& "C:\Program Files\nodejs\npm.cmd" run build   # → dist/
```

Servez `dist/` (Cloudflare Pages, Netlify, GitHub Pages…). `public/_redirects` réécrit `/s/*`
vers `index.html` (Pages / Netlify). Sans `VITE_API_URL`, le partage passe par le lien hash
(schéma compressé dans l'URL) et le bouton « lien court » n'apparaît pas.

### Avec les liens courts (Worker Cloudflare + D1, offre gratuite)

```powershell
cd backend
& "C:\Program Files\nodejs\npx.cmd" wrangler login
& "C:\Program Files\nodejs\npx.cmd" wrangler d1 create simulateur-flux      # copier database_id dans wrangler.toml
& "C:\Program Files\nodejs\npx.cmd" wrangler d1 migrations apply simulateur-flux --remote
& "C:\Program Files\nodejs\npx.cmd" wrangler deploy
```

Puis côté SPA : `VITE_API_URL=https://simulateur-flux-api.<compte>.workers.dev` au build, et
`ALLOWED_ORIGINS = "https://votre-domaine"` dans `wrangler.toml` (`[vars]`). Si le Worker est
routé sur `/api/*` du même domaine que la SPA, laissez `VITE_API_URL=` vide (même origine).

Garde-fous en place : forme de scénario validée (Zod), corps ≤ 256 ko, CORS restreint. **Le
rate limiting se règle dans Cloudflare** (Security → WAF → Rate limiting rules, ex. 10 POST /
minute / IP sur `/api/scenarios`) — pas dans le code. Les scénarios stockés sont publics par
construction : ne pas y mettre de données nominatives.

### Mise en ligne : sécurité, légal, mesure

- **En-têtes** : `public/_headers` (Cloudflare Pages / Netlify) pose la CSP, HSTS, `X-Frame-Options`…
  Si l'API des liens courts ou Sentry vit sur un autre domaine que `*.workers.dev` / `*.sentry.io`,
  ajoutez-le à `connect-src`.
- **Previews par PR** : branchez le dépôt dans Cloudflare Pages (build `npm run build`, sortie `dist`) —
  chaque PR obtient son URL de preview, sans workflow à maintenir.
- **Pages légales** : `/legal` (mentions, CGU, confidentialité). **Renseignez `LEGAL_IDENTITY` dans
  `src/components/common/LegalPage.tsx` avant toute mise en ligne** (obligation LCEN art. 6 III).
- **Observabilité** (optionnelle, voir `.env.example`) : `VITE_SENTRY_DSN` charge Sentry à la demande,
  `VITE_PLAUSIBLE_SRC` injecte Plausible (sans cookie, donc sans bandeau). Le hash d'URL, qui contient le
  scénario, est retiré avant tout envoi.

## Revue annuelle des barèmes

Chaque taux porte `source`, `asOf` et `status`. Le pied de page affiche la dernière vérification, et
`ratesFreshness.test.ts` **casse la CI dès qu'un barème n'a pas été revu depuis 400 jours**. À chaque loi de
finances / LFSS (fin décembre) : relire chaque source Légifrance / BOFiP / URSSAF de `taxRules.ts` et
`tnsRules.ts`, corriger la valeur si besoin, mettre `asOf` à la date de relecture, consigner dans `CHANGELOG.md`.

## Tests

`npm run check` (lint, types, unitaires) · `npm run test:e2e` (Playwright sur le build de prod ; première
fois : `npx playwright install chromium`) · `cd backend && npm test`.

## Construire un schéma et lire les régimes

La palette dépose une entité, un glisser-déposer entre deux entités crée le flux. Le tracé
se qualifie tout seul : **SASU → Holding** devient un dividende en **régime mère-fille**
(CGI art. 145 / 216, quote-part de frais 5 % → ~1,25 % de friction), **Holding/SASU → personne**
devient un dividende au **PFU**. Le taux et le montant d'impôt s'affichent sur l'arête du canvas
et dans le panneau du flux, avec le lien Légifrance ; une détention < 5 % déclenche une alerte.

Les **presets de vue** (Dirigeant / Comptable / Associé / Pédagogique) règlent les calques en un clic
au-dessus du sélecteur de calques.

### Construire from scratch

Onglet **Architecture** : « Repartir de zéro », puis déposez les briques. Dès qu'une SASU et une
holding (ou une SCI, ou le dirigeant) sont posées, la section **Conventions possibles** liste, par
paire de parties, les conventions envisageables — mère-fille, intégration fiscale, management fees,
convention de trésorerie, compte courant d'associé, bail SCI, distribution — avec pour chacune :
dans quel cas (conditions lues sur les détentions saisies : ✓ / ✗ / ? à vérifier), ce que ça
apporte, les points d'attention, et les articles sourcés (`src/core/legal/legalNotes.json`).
Le bouton « Ajouter le flux » pose le flux correspondant sur le schéma.

**Annuler / Rétablir** couvrent chaque modification ; le brouillon survit au changement d'onglet
(session du navigateur). Si le schéma n'est pas calculable, **« Compléter pour le calcul »** ajoute la SASU, les tiers
(client, fournisseur, URSSAF, Trésor) et les flux obligatoires manquants, à zéro. « Partir d'un
modèle » charge un preset comme brouillon éditable.

### Exporter / importer un schéma

« Exporter (.json) » (en-tête et atelier) télécharge `<nom>.optimisator.json` : schéma, réglages
What-If et calques. « Importer (.json) » recharge ce fichier — ou un `ScenarioState` nu, ou un
payload de partage `{ scenario }`. Validation Zod : un fichier invalide est refusé sans toucher
au schéma courant. Aucun compte ni base de données.

### Management fees, CCA, emprunts, intégration fiscale

- **Management fees** SASU → Holding : déduits du résultat de la SASU (CGI art. 39, 1-1°), imposés
  à l'IS chez la holding (barème 15 % / 25 %), TVA supposée neutre. L'alerte « acte anormal de
  gestion » reste sur le flux : convention écrite, prestations réelles et prix de marché ne sont
  pas vérifiés.
- **CCA / avances intra-groupe / échéances d'emprunt** : mouvements de trésorerie intégrés aux
  soldes (source −, cible +), sans effet sur le résultat ; `ccaBalance` = CCA d'ouverture + avances
  reçues − remboursements versés. Le champ **Intérêts annuels** du flux est déduit chez l'emprunteur
  (CGI art. 39, 1-3°), imposé chez le prêteur (IS, ou PFU pour un associé personne physique) ; le
  plafond de taux n'est pas contrôlé. Une avance société → personne physique est marquée **CCA
  débiteur** (interdit, C. com. L. 225-43 / L. 227-12).
- **Intégration fiscale** (case à cocher sur la carte de convention, `scenario.options.integrationFiscale`) :
  si une holding détient ≥ 95 % de la SASU, QPFC ramenée à 1 % (CGI art. 223 B) et IS unique sur
  le résultat d'ensemble (CGI art. 223 A). Convention d'intégration neutre : la fille supporte
  l'IS qu'elle aurait payé seule, la holding porte l'écart. Le comparatif est honnête : avec une
  seule fille bénéficiaire, la tranche à 15 % n'est utilisée qu'une fois pour le groupe, ce qui
  peut coûter plus cher qu'en régime séparé — l'intérêt vient des déficits à imputer.

## Limites du modèle

- **Onglet Structures** : le comparateur (`src/core/engine/structureComparator.ts`) chiffre micro,
  EI / EURL à l'IR, EURL-SARL à l'IS (gérant TNS, règle des 10 % du capital), SASU et SASU + holding
  à CA, charges et foyer constants, chacune à son propre optimum rémunération / dividendes. Le
  classement porte sur le cash : ni droits sociaux (retraite, chômage, prévoyance), ni coûts de
  structure, ni report d'imposition d'une holding n'y sont valorisés — voir « Limites du comparatif ».
- **Canvas résolu par entité** (`src/core/engine/graphResolver.ts`) : chaque société porte son
  régime (IS ou IR), le statut social de son dirigeant (assimilé salarié ou TNS), son capital libéré
  et ses soldes d'ouverture (trésorerie, compte courant). SASU, EURL, SARL, holdings SAS/SARL,
  SCI IS/IR, micro et EI sont chiffrées en place, en nombre libre. Les sociétés à l'IR, la micro et
  la SCI IR remontent leur bénéfice dans l'IR du dirigeant (transparence, quote-parts non gérées).
  Le gérant majoritaire TNS voit ses dividendes > 10 % (capital + CCA) soumis aux cotisations SSI.
  Les flux mensuels / trimestriels sont annualisés. La « société principale » (première SASU, sinon
  première société opérationnelle) reçoit les curseurs What-If et alimente la barre de synthèse.
- **Rémunération portée par la holding** : un flux salaire holding → dirigeant est déduit du
  résultat de la holding, au statut social de celle-ci.
- **Plusieurs associés** : les bénéfices transparents (IR, SCI IR) sont répartis au prorata des
  détentions saisies entre personnes physiques, chaque associé ayant son propre IR (foyer des
  curseurs pour le premier dirigeant, 1 part pour les autres). Sans détention saisie, tout va au
  premier dirigeant.
- **Micro-entreprise** : options *versement libératoire* (CGI 151-0 : 1 % / 1,7 % / 2,2 % du CA,
  seuil de RFR N-2 non contrôlé), *ACRE* (cotisations à 75 % du taux normal pendant 12 mois, CSS D131-6-3 / L131-6-4 — dégressivité ¾ PASS → PASS non modélisée) et *franchise
  en base de TVA* (CGI 293 B, plafonds 93 500 € / 41 250 €, alerte au dépassement — franchise
  activée par défaut pour la micro, disponible pour toute société opérationnelle).
- **Plafond des intérêts de CCA** : 4,33 % (BOI-BIC-CHG-50-50-30, exercices clos du 30 juin au
  29 septembre 2026), appliqué compte par compte sur l'avance de l'exercice ; l'excédent est
  réintégré au résultat et signalé sur le flux.
- **Apport en capital** (`capital_contribution`, personne ou holding → société) : entre en
  trésorerie, compte dans la base des 10 % de la règle TNS. Le capital d'ouverture se saisit dans
  le champ « Capital libéré ».
- **Cotisations TNS (gérant majoritaire, EI, EURL au réel)** — méthode 2026
  (`src/core/engine/tnsRules.ts`) : assiette unique = revenu super-brut − 26 % (CSS L136-3 III,
  LFSS 2024), puis barème par branche sur cette assiette : maladie dégressive 0 → 8,5 % (D621-1/2),
  IJ 0,5 % (D621-3), retraite de base 17,15 % sous PASS + 0,72 % (D633-3), RCI 7 % / 8 %,
  invalidité-décès 1,3 % (assiette D632-1), allocations familiales 0 → 3,1 % (D613-1), CSG-CRDS
  9,7 %, formation. PASS 2026 = 48 060 € (arrêté du 22/12/2025). Le brut d'une rémunération nette
  est retrouvé par bissection. Statut `assumed` restant : plancher/plafond de l'abattement (décret
  2025-708 non relu), taux RCI et invalidité-décès (arrêtés), formation.
- **Micro** : taux de cotisations 12,3 % / 21,2 % / 25,6 % (BNC) / 6 % (meublé de tourisme)
  sourcés sur CSS D613-4 (décret 2025-943, 2026).
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
