# Plan d'Implémentation : Simulateur Visuel de Flux d'Entreprise (SASU / Holding / SCI)

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]` / `- [x]`) syntax for tracking.

**Goal:** Construire un SaaS de simulation visuelle et de modélisation dynamique des flux financiers et fiscaux d'entreprises en France (SASU, Holding, SCI, Dirigeant, Trésor Public, URSSAF) avec un canvas interactif de flux d'argent, une simulation pas-à-pas, des curseurs live et un partage d'URL persistant.

**Architecture:** Frontend Single Page Application en React 19 + TypeScript + `@xyflow/react` + Tailwind CSS suivant les standards du plugin Impeccable, couplé à une API Edge légère sous Hono et une base relationnelle Cloudflare D1 gérée via Drizzle ORM. Les calculs fiscaux tournent en local à 60 fps dans le navigateur et sont validés côté API lors de la sauvegarde.

**Tech Stack:** React 19, TypeScript, Vite, `@xyflow/react`, Tailwind CSS, Framer Motion, Lucide-react, lz-string, Vitest, Hono, Cloudflare D1, Drizzle ORM. Dev sourcing: OpenLegi (Légifrance/BOFiP) + data.gouv.fr (user-registered MCP).

**AgentForge team:** see spec § AgentForge team + `.agentforge/team/simulateur-flux.json`. Orchestrator: `orchestration-patterns`.

## Status (2026-09-07)

| Champ | Valeur |
|---|---|
| **Périmètre actuel** | **MVP perso local** (pas prod / SaaS public) |
| **Implémentation T1–T11** | **Done** (code + tests) |
| **Tests** | Front **106** · Backend **6** · `tsc -b && vite build` OK |
| **Git commits par tâche** | Remplacé par **1 commit agrégé** `87dfd5e` (init repo + MVP) |
| **Deploy Cloudflare** | Non — API locale / Miniflare uniquement |
| **Freeze fiscal** | PFU PS / total **verified** 18,6 % / 31,4 % (OpenLegi 2026-09-07) |

### Écarts acceptés vs plan initial

- Tailwind **v4** CSS-first (`@tailwindcss/vite`) — pas de `tailwind.config.ts`
- Header App inline (pas de composant `TopNav` séparé)
- Timeline : stop à la dernière étape (pas de boucle auto)
- Audit Impeccable : spot-check code + CONSTRAINTS — pas d’artefact `/impeccable audit` ni mesure DevTools 60 fps enregistrée
- Framer Motion / Lucide : non bloquants si absents du MVP
- **MR !4 corrigée (2026-09-16)** : type `Edge` des liens de détention corrigé (`default` vs `flow`), compilation restaurée. Le build et 106 + 6 tests passent.

## Global Constraints

- **Zéro cliché IA / Standard Impeccable :** Pas de dégradés violets génériques, pas de composants imbriqués inutiles, bordures 1px nettes, contrastes élevés (WCAG AA min / AAA textes finance). Pas Inter/Arial comme police défaut.
- **Typographie tabulaire :** `font-variant-numeric: tabular-nums` et police `JetBrains Mono` / `Geist Mono` pour tous les montants.
- **Provenance fiscale :** chaque taux dans `taxRules.ts` = `SourcedRate` (`source`, `asOf`, `status`) vérifié via OpenLegi/BOFiP sous `tax-lawyer-fr` + `finance-expert` — jamais de mémoire.
- **Réactivité 60 fps :** Découplage `src/core/engine/` ↔ `src/components/canvas/` ; gate `web-performance-auditor`.
- **Tests unitaires obligatoires (TDD) :** Couverture 100% des fonctions publiques du moteur fiscal (`testing-patterns`).
- **CONSTRAINTS.md** à la racine avant Task 4 (skill `constraint-driven-development`).

## Task → Team mapping

| Task | Primary entries | Status |
|---|---|---|
| T1 Types & scaffold | `solution-architect`, `git-workflow-and-versioning` | Done |
| T2 Moteur fiscal | `tax-lawyer-fr`, `finance-expert`, `testing-patterns` | Done |
| T3 Graphe + timeline | `finance-expert`, `solution-architect` | Done |
| T4 Design Impeccable | `frontend-ui-engineering`, Impeccable | Done |
| T5–T6 Canvas | `frontend-ui-engineering`, `web-performance-auditor` | Done |
| T7–T8 Timeline / What-If | `finance-expert`, `frontend-ui-engineering` | Done |
| T9 Inspecteur légal | `tax-lawyer-fr` (+ OpenLegi MCP) | Done |
| T10 API Hono/D1 | `solution-architect`, `cto-advisor` | Done (local) |
| T11 Assemblage + audit | `orchestration-patterns`, Impeccable, `accessibility-checklist`, `browser-testing-with-devtools` | Done (MVP) |

---

### Task 1 : Initialisation du Projet, Types TypeScript & Schémas de Données

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vite.config.ts`
- Create: `src/core/types/entity.ts`
- Create: `src/core/types/flow.ts`
- Create: `src/core/types/scenario.ts`
- Create: `src/core/types/layer.ts`
- Test: `src/core/types/__tests__/types.test.ts`

**Interfaces:**
- Produces: `EntityType`, `FlowCategory`, `FlowEdgeData`, `EntityNodeData`, `ScenarioState`, `TaxCalculationResult`

- [x] **Step 1: Écrire le test de validation des types et schémas TypeScript**
- [x] **Step 2: Exécuter `npx vitest run src/core/types/__tests__/types.test.ts` pour confirmer l'échec initial**
- [x] **Step 3: Implémenter les interfaces et types TypeScript complets**
- [x] **Step 4: Exécuter les tests et s'assurer qu'ils passent**
- [ ] **Step 5: Git commit : `feat(core): setup project types and data contracts`** — *reporté (pas de commit sans demande)*

---

### Task 2 : Moteur de Calcul Fiscal Déterministe (TDD)

**Files:**
- Create: `src/core/engine/taxRules.ts`
- Create: `src/core/engine/calculator.ts`
- Test: `src/core/engine/__tests__/calculator.test.ts`

**Interfaces:**
- Consumes: `src/core/types/`
- Produces:
  - `calculateVAT(caHt: number, expensesHt: number, vatRate?: number): { vatCollected, vatDeductible, netVatDue }`
  - `calculateCorporateTax(taxableIncome: number): { bracket15, bracket25, taxDue, netProfit }`
  - `calculateMotherDaughterDividend(dividendAmount: number, holdingTaxRate?: number): { qpfc, holdingTax, netCashInHolding }`
  - `calculateFlatTax(grossDividend: number): { irPart, psPart, totalTax, netIncome }`
  - `calculateExecutiveSalary(netDesired: number): { grossSalary, employerCharges, employeeCharges, totalCompanyCost }`
  - `calculateSciTax(rentalIncomeHt: number, interestExpenses: number, buildingAmortization: number, otherCharges: number): { taxableIncome, taxDue, cashFlowNet }`

- [x] **Step 1: Écrire les tests unitaires pour chaque formule fiscale française (TVA, IS 15/25%, QPFC 5%, PFU, Amortissement SCI)**
- [x] **Step 2: Exécuter `npx vitest run src/core/engine/__tests__/calculator.test.ts` (échec attendu)**
- [x] **Step 3: Implémenter le moteur de calcul dans `calculator.ts` et les constantes légales dans `taxRules.ts`**
- [x] **Step 4: Exécuter les tests et vérifier 100% de succès**
- [x] **Step 5: Git commit : `feat(engine): implement IR tax, eligibility checks and UI updates`** — *Done*

---

### Task 3 : Moteur de Résolution de Graphe et Timeline Pas-à-Pas (TDD)

**Files:**
- Create: `src/core/engine/timelineEngine.ts`
- Create: `src/core/engine/graphResolver.ts`
- Create: `src/core/presets/structurePresets.ts`
- Create: `src/core/presets/viewPresets.ts`
- Test: `src/core/engine/__tests__/timelineEngine.test.ts`

**Interfaces:**
- Consumes: `src/core/engine/calculator.ts`, `src/core/types/`
- Produces:
  - `resolveScenarioGraph(scenario: ScenarioState, inputs: WhatIfInputs): ResolvedScenario`
  - `getTimelineSteps(scenario: ScenarioState): TimelineStep[]`
  - `FREELANCE_SASU_PRESET`, `SASU_HOLDING_PRESET`, `FULL_GROUP_PRESET`

- [x] **Step 1: Écrire les tests pour la résolution ordonnée du graphe et les 6 étapes de la timeline (Facturation → Charges → Rémunération → Intra-groupe → Impôts → Dividendes)**
- [x] **Step 2: Exécuter `npx vitest run src/core/engine/__tests__/timelineEngine.test.ts` (échec attendu)**
- [x] **Step 3: Implémenter le résolveur de graphe, la progression de timeline et les presets de structures types**
- [x] **Step 4: Exécuter les tests et valider le passage au vert**
- [ ] **Step 5: Git commit : `feat(engine): add graph resolver, timeline steps and presets`** — *reporté*

---

### Task 4 : Design System Impeccable & Configuration UI

**Files:**
- Create: `tailwind.config.ts` → *remplacé par Tailwind v4 CSS-first dans `src/styles/globals.css`*
- Create: `src/styles/globals.css`
- Create: `PRODUCT.md`
- Create: `DESIGN.md`
- Create: `CONSTRAINTS.md`
- Create: `src/components/common/MetricBadge.tsx`
- Create: `src/components/common/DisclaimerBanner.tsx`
- Create: `src/components/common/ThemeToggle.tsx`
- Test: `src/components/common/__tests__/MetricBadge.test.tsx`

**Interfaces:**
- Produces: Tokens CSS (Emerald, Cyan, Amber, Indigo, Gold, Rose), composants de base formatant les montants avec `JetBrains Mono` et `tabular-nums`.

- [x] **Step 1: Rédiger `PRODUCT.md` et `DESIGN.md` conformes au standard Impeccable**
- [x] **Step 2: Configurer Tailwind CSS et les variables globales Dark/Light**
- [x] **Step 3: Développer les composants d'interface de base (MetricBadge, DisclaimerBanner, ThemeToggle)**
- [x] **Step 4: Écrire et exécuter le test de rendu pour `MetricBadge` avec formatage monétaire (espace insécable et €)**
- [ ] **Step 5: Git commit : `feat(ui): initialize Impeccable design system and common components`** — *reporté*

---

### Task 5 : Composants Nœuds Spécialisés du Canvas React Flow

**Files:**
- Create: `src/components/canvas/EntityNode.tsx`
- Create: `src/components/canvas/nodes/SasuNode.tsx`
- Create: `src/components/canvas/nodes/HoldingNode.tsx`
- Create: `src/components/canvas/nodes/SciNode.tsx`
- Create: `src/components/canvas/nodes/PersonNode.tsx`
- Create: `src/components/canvas/nodes/AuthorityNode.tsx`
- Test: `src/components/canvas/nodes/__tests__/SasuNode.test.tsx`

**Interfaces:**
- Consumes: `@xyflow/react`, `src/core/types/entity.ts`
- Produces: Map `nodeTypes` pour React Flow avec métriques financières en direct et bordures colorées sémantiques.

- [x] **Step 1: Écrire le test de rendu pour le nœud SASU avec calcul live du résultat fiscal et de l'IS**
- [x] **Step 2: Implémenter le conteneur `EntityNode` générique avec support de la sélection et du zoom**
- [x] **Step 3: Implémenter les 5 nœuds spécialisés (SASU, Holding, SCI, Dirigeant, Trésor Public / URSSAF)**
- [x] **Step 4: Exécuter les tests de rendu**
- [ ] **Step 5: Git commit : `feat(canvas): implement custom financial entity nodes`** — *reporté*

---

### Task 6 : Arêtes Animées & Particules de Flux Vectorielles

**Files:**
- Create: `src/components/canvas/FlowEdge.tsx`
- Create: `src/components/canvas/FlowCanvas.tsx`
- Test: `src/components/canvas/__tests__/FlowCanvas.test.tsx`

**Interfaces:**
- Consumes: `@xyflow/react`, `src/core/types/flow.ts`
- Produces: `edgeTypes` avec rendu SVG de particules animées dont la vitesse dépend du montant financier, et conteneur principal `FlowCanvas`.

- [x] **Step 1: Écrire le test pour `FlowCanvas` avec chargement d'un preset**
- [x] **Step 2: Développer `FlowEdge.tsx` avec particules SVG circulaires animées et labels de montants cliquables**
- [x] **Step 3: Assembler `FlowCanvas.tsx` avec les contrôles de zoom, pan et mini-carte**
- [x] **Step 4: Valider le rendu interactif**
- [ ] **Step 5: Git commit : `feat(canvas): add animated flow edges and main canvas container`** — *reporté*

---

### Task 7 : Contrôleur de Timeline & Simulation Pas-à-Pas

**Files:**
- Create: `src/hooks/useTimeline.ts`
- Create: `src/components/controls/TimelineBar.tsx`
- Test: `src/hooks/__tests__/useTimeline.test.ts`

**Interfaces:**
- Consumes: `src/core/engine/timelineEngine.ts`
- Produces: `useTimeline` hook et barre de contrôle de lecture (Play, Pause, Précédent, Suivant, Saut d'étape).

- [x] **Step 1: Écrire les tests pour le hook `useTimeline` (changement d'étape, lecture automatique)** — *boucle non implémentée (stop fin)*
- [x] **Step 2: Implémenter le hook `useTimeline` avec timers fluides**
- [x] **Step 3: Développer le composant UI `TimelineBar.tsx` avec barre de progression et description textuelle de l'étape active**
- [x] **Step 4: Valider les tests du hook**
- [ ] **Step 5: Git commit : `feat(simulation): add timeline controller and step-by-step playback`** — *reporté*

---

### Task 8 : Calques Thématiques, Curseurs What-If & Money Tracer

**Files:**
- Create: `src/hooks/useSimulation.ts`
- Create: `src/components/controls/LayerSwitcher.tsx`
- Create: `src/components/controls/WhatIfSliders.tsx`
- Create: `src/components/controls/MoneyTracer.tsx`
- Test: `src/hooks/__tests__/useSimulation.test.ts`

**Interfaces:**
- Consumes: `src/core/engine/graphResolver.ts`
- Produces: Filtrage des flux par calques (Trésorerie, TVA, IS, Social, Juridique) et recalcul temps réel lors du déplacement des curseurs.

- [x] **Step 1: Écrire les tests pour le filtrage par calques et l'injection d'un montant test via Money Tracer**
- [x] **Step 2: Implémenter `useSimulation.ts` reliant Zustand, les presets et les recalculs**
- [x] **Step 3: Développer `LayerSwitcher.tsx`, `WhatIfSliders.tsx` et le bouton d'injection `MoneyTracer.tsx`**
- [x] **Step 4: Exécuter les tests**
- [ ] **Step 5: Git commit : `feat(controls): implement layer switcher, what-if sliders and money tracer`** — *reporté*

---

### Task 9 : Inspecteur de Flux, Références Légales (OpenLegi/BOFiP) & Décomposition

**Files:**
- Create: `src/components/inspector/FlowInspector.tsx`
- Create: `src/components/inspector/LegalReference.tsx`
- Create: `src/components/inspector/StepBreakdown.tsx`
- Create: `src/core/legal/legalNotes.json` (+ loader)
- Test: `src/components/inspector/__tests__/FlowInspector.test.tsx`

**Interfaces:**
- Consumes: `src/core/types/flow.ts`
- Produces: Panneau latéral de détails au clic sur un flux avec articles du CGI, BOFiP et calcul pas-à-pas.

- [x] **Step 1: Écrire le test d'affichage des détails d'un flux de dividendes mère-fille (Art. 145 CGI)**
- [x] **Step 2: Développer `LegalReference.tsx` avec badges d'alertes légales (CCA débiteur, acte anormal de gestion)**
- [x] **Step 3: Développer `StepBreakdown.tsx` et le tiroir principal `FlowInspector.tsx`**
- [x] **Step 4: Valider les tests**
- [ ] **Step 5: Git commit : `feat(inspector): add flow inspector drawer and legal reference viewer`** — *reporté*

---

### Task 10 : Backend API Edge (Hono + Cloudflare D1) & Persistance

**Files:**
- Create: `backend/src/index.ts`
- Create: `backend/src/db/schema.ts`
- Create: `backend/src/routes/scenarios.ts`
- Create: `src/hooks/useUrlState.ts`
- Create: `src/components/controls/ShareModal.tsx`
- Test: `backend/src/__tests__/scenarios.test.ts`

**Interfaces:**
- Produces: Routes API `POST /api/scenarios`, `GET /api/scenarios/:slug`, encodage/décodage lz-string en URL et modal de partage.

- [x] **Step 1: Écrire les tests d'intégration API pour la création et récupération d'un scénario via son short_id**
- [x] **Step 2: Configurer le schéma Drizzle SQLite et les routes Hono**
- [x] **Step 3: Implémenter le hook `useUrlState.ts` pour la synchronisation URL/Hash et le composant `ShareModal.tsx`**
- [x] **Step 4: Exécuter les tests API**
- [ ] **Step 5: Git commit : `feat(backend): add Hono API, D1 schema and share modal`** — *reporté*

---

### Task 11 : Assemblage Final de la SPA & Audit Qualité Impeccable

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`
- Modify: `src/styles/globals.css`
- Test: `src/__tests__/App.test.tsx`

**Interfaces:**
- Consumes: Tous les composants et hooks précédents.
- Produces: Application web complète et fonctionnelle prête pour le déploiement.

- [x] **Step 1: Assembler l'application principale dans `App.tsx` avec header, `FlowCanvas`, `TimelineBar`, `WhatIfSliders` et `FlowInspector`**
- [x] **Step 2: Écrire le test d'intégration simulant le changement de preset et la lecture de la timeline**
- [x] **Step 3: Audit Impeccable (spot-check tokens / tabular-nums / disclaimer)** — *pas d’artefact audit formel ni mesure 60 fps*
- [x] **Step 4: Exécuter l'ensemble de la suite de tests (`npx vitest run`)**
- [ ] **Step 5: Git commit : `feat(app): assemble complete SaaS application and finalize Impeccable audit`** — *reporté*

---

## Backlog MVP perso (hors plan T1–T11)

- [x] **Task 12 : Implémentation TMI (Tranche Marginale d'Imposition) dans le moteur fiscal** — *Done*

## Future work / Missing features
- [ ] **Optimiseur automatique** (Générer des structures selon objectif)
- [ ] **Multi-année (Forecast)** (Simulation dans le temps, calendrier financier)
- [ ] **Social précis (URSSAF)** (Approximation actuelle, à baser sur barèmes réels)

- [x] Premier commit git agrégé (quand demandé)
- [x] Lancer local documenté : SPA + `backend` wrangler ([README.md](../../README.md))
- [x] Freeze PFU PS via OpenLegi/BOFiP (sortir du statut `assumed`) → **verified** 18,6 % / total 31,4 %
- [x] Atelier d’architecture (éditeur sociétés/flux), détention, sauvegarde locale, comparaison A/B — MR !4 (`5fe190a`)
- [x] Mesure 60 fps DevTools (optionnel) → procédure [docs/performance-60fps.md](../performance-60fps.md)
- [x] Compilation restaurée après MR !4 (type `Edge` détention)
- [ ] Deploy Cloudflare / SaaS public → plus tard, hors MVP perso
- [ ] Trace DevTools 60 fps jointe (mesure réelle instrumentée)