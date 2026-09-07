# Design Document : Simulateur Visuel de Flux d'Entreprise (SASU / Holding / SCI)

> **Date :** 2026-09-06 · **Révision :** 2026-09-07 (équipe AgentForge + OpenLegi + statut MVP)  
> **Statut :** **MVP perso implémenté localement** (plan T1–T11 code+tests) — *pas* prod/SaaS public ; auth/billing restent V2 (§1.3)  
> **Type de produit :** SaaS Web Application (SPA Edge-first) — cible long terme ; usage actuel = MVP perso  
> **Norme UI/UX :** Plugin **Impeccable** (`PRODUCT.md`, `DESIGN.md`, `/impeccable` craft/audit/polish)  
> **Périmètre fiscal :** France (CGI, BOFiP, Code de commerce, URSSAF, DGFiP)  
> **Équipe AgentForge :** `team_compose` → `.agentforge/team/simulateur-flux.json`  
> **Suivi d’implémentation :** [plan](../plans/2026-09-06-simulateur-flux.md) (checkboxes + écarts) · tests front 76 / API 6

---

## AgentForge team

Composed via `team_compose` → `C:\Users\Mindness\.agentforge\team\simulateur-flux.json` (also `.agentforge/team.json`).

### Org (who orchestrates / delegates)

- **Orchestrator:** `orchestration-patterns`
- **Design / Spec — process guidance:** `context-engineering`
- **Domain specialists — personas:** `tax-lawyer-fr`, `finance-expert`, `solution-architect`, `cto-advisor`
- **Build — implementation craft:** `git-workflow-and-versioning`, `frontend-ui-engineering`, `browser-testing-with-devtools`
- **Review / Gates — checklists & critics:** `testing-patterns`, `web-performance-auditor`, `accessibility-checklist`

### Agents

| Id | Lane | Role |
|---|---|---|
| `tax-lawyer-fr` | domain | Conformité CGI / BOFiP / Code de commerce ; sourçage OpenLegi |
| `finance-expert` | domain | Modèle cash-flow, provenance des chiffres, seuils paramétrés |
| `solution-architect` | domain | Frontières modules, graphe de flux, contrats d'interfaces |
| `cto-advisor` | domain | Stack Edge, coût 3 ans, réversibilité (D1 vs Postgres, auth V2) |
| `web-performance-auditor` | review | 60 fps canvas, Core Web Vitals, budget particules |

### Skills

| Id | Lane | Role |
|---|---|---|
| `git-workflow-and-versioning` | build | Commits atomiques par tâche TDD |
| `frontend-ui-engineering` | build | UI production + a11y + Impeccable |
| `context-engineering` | design | Context agents / MCP / AGENTS.md |
| `browser-testing-with-devtools` | build | Vérification visuelle canvas & timeline |

### Rules

| Id | Lane | Role |
|---|---|---|
| `orchestration-patterns` | orchestrate | Délégation, parallélisme, anti-patterns multi-agents |
| `testing-patterns` | review | AAA Vitest, mocks aux frontières |
| `accessibility-checklist` | review | Clavier, contrastes, ARIA sur contrôles canvas |

### MCP servers (OpenLegi = Légifrance + BOFiP)

Enregistrés dans `~/.cursor/mcp.json` (via `mcp-remote` + `?token=`) :

| Id Cursor | URL | Usage |
|---|---|---|
| `openlegi-legifrance` | `https://mcp.openlegi.fr/legifrance/mcp` | Codes (CGI, C. com.), JORF, LODA, jurisprudence |
| `openlegi-bofip` | `https://mcp.openlegi.fr/bofip/mcp` | Doctrine fiscale BOFiP (mère-fille, IS, TVA…) |
| `datagouv` | `https://mcp.data.gouv.fr/mcp` | Open data FR / INSEE (déjà présent) |

**Quota OpenLegi : 500 appels / mois.** Règles d'usage :
1. Appels **dev-time uniquement** (jamais dans le canvas / What-If runtime).
2. Une campagne de sourçage par barème → figer dans `taxRules.ts` + `legalNotes.json` avec `asOf`.
3. Réutiliser le cache local ; ne re-vérifier via MCP qu'en cas de changement de loi / doute.
4. Préférer data.gouv pour stats / référentiels non juridiques (économiser le quota OpenLegi).

Optionnels OpenLegi (pas encore branchés) : RNE, BODACC.

> **Gate :** avant de figer `taxRules.ts`, `pool_get` `tax-lawyer-fr` + `finance-expert` et vérifier chaque taux via **OpenLegi Légifrance + BOFiP** (batch unique), sinon placeholder daté.

### Matrice d'ownership (spec → agents)

| Domaine de la spec | Owner principal | Gate review |
|---|---|---|
| Formules fiscales & alertes légales | `tax-lawyer-fr` | OpenLegi + BOFiP |
| Cash-flows, métriques nœuds, What-If | `finance-expert` | Provenance Given/Derived/External |
| Architecture Edge + découpage modules | `solution-architect` + `cto-advisor` | Coût 3 ans, one-way doors |
| Canvas, calques, timeline, tokens UI | `frontend-ui-engineering` + Impeccable | `accessibility-checklist`, `web-performance-auditor` |
| Tests moteur & API | `testing-patterns` (+ `test-engineer` si besoin) | Couverture 100% moteur fiscal |
| Orchestration du build | `orchestration-patterns` | Plan tâche-par-tâche |

---

## 1. Vue d'Ensemble & Objectif Produit

### 1.1 Contexte & Problématique
Structurer une activité en France (SASU d'exploitation, holding animatrice/passive, SCI locative) reste opaque pour le dirigeant :
- Schémas cabinets = PDF / slides statiques.
- Mécanismes fiscaux cloisonnés (mère-fille QPFC 5 %, TVA intra-groupe, loyers SCI, salaire vs dividendes).
- Impossible de tester en direct : *« +50 k€ de CA et 20 k€ de loyer SCI → combien d'impôt à chaque niveau, combien de cash holding vs perso ? »*

### 1.2 Solution SaaS
Canvas **Money Flow** interactif qui permet de :
1. Visualiser les flux avec particules vectorielles (débit ∝ montant).
2. Rejouer un exercice en **Timeline Replay** (6 étapes).
3. Simuler en live (**What-If** + **Money Tracer**) à 60 fps.
4. Filtrer par **calques** (Trésorerie, TVA, IS/IR, Social, Juridique).
5. **Persister / partager** des scénarios (liens courts D1 + fallback hash lz-string).

### 1.3 Non-objectifs (V1)
- Conseil fiscal personnalisé certifié (disclaimer permanent).
- Auth multi-tenant complète / facturation SaaS (prévu V2 — `cto-advisor`).
- Import liasse / OCR bilans (V2 — `finance-expert`).
- Remplacer un ERP ou une liasse fiscale.

### 1.4 Barre qualité (`constraint-driven-development`)
À créer en racine : `CONSTRAINTS.md` avec au minimum :
- Couverture Vitest moteur fiscal = 100 % des fonctions publiques.
- 60 fps What-If / Timeline (mesure DevTools Performance).
- Contrastes WCAG AA minimum (cible AAA textes finance).
- Aucun taux fiscal sans `source` + `asOf` dans `taxRules.ts`.
- Pas de `@ts-ignore` / `eslint-disable` sans ticket.

---

## 2. Architecture Globale & Choix Technologiques

Owners : `cto-advisor` + `solution-architect`. Stack Edge TypeScript — latence minimale, coût ~0 € au démarrage, moteur isomorphique.

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│ CLIENT (SPA) — React 19 + Vite + TypeScript                                      │
│  @xyflow/react · Tailwind (Impeccable) · src/core/engine (60 fps local)          │
│  Zustand + lz-string · Framer Motion (UI) · SVG particules (flux)                │
└────────────────────────────────────────┬─────────────────────────────────────────┘
                                         │ HTTPS REST / JSON
                                         ▼
┌──────────────────────────────────────────────────────────────────────────────────┐
│ Cloudflare Worker — Hono + Zod                                                   │
│  POST/GET/PUT /api/scenarios · short slug · versioning                           │
│  Drizzle ORM → Cloudflare D1 (scenarios, scenario_versions)                      │
└──────────────────────────────────────────────────────────────────────────────────┘
```

### Décisions CTO (one-way vs two-way)

| Décision | Type | Choix | Signal de réversion |
|---|---|---|---|
| Canvas lib | two-way | `@xyflow/react` (vérifier version via Context7) | Perf < 30 fps sur preset groupe |
| Backend | two-way | Hono sur Workers | Besoin SSR SEO landing → Astro/Pages séparé |
| DB | one-way (données) | D1 SQLite | Besoin Postgres RLS multi-tenant → migrer V2 |
| Calculs fiscaux | one-way (contrat produit) | Moteur TS pur côté client | Divergence légale → patch `taxRules` + tests |

### Dépendances & MCP (dev-time, pas runtime produit)

- Runtime app : React 19, Vite, `@xyflow/react`, Tailwind, Hono, Drizzle, D1, lz-string, Vitest — **versions via Context7** avant install.
- **Dev / agents uniquement :** OpenLegi (Légifrance + BOFiP), data.gouv.fr, recherche-entreprises — pour sourcer `taxRules` et fiches légales UI, **pas** pour calculer en prod à chaque slider.

---

## 3. Modèle Métier & Formules Fiscales (France)

Owners : `tax-lawyer-fr` (légalité) + `finance-expert` (modèle & provenance).

### 3.0 Contrat de provenance (obligatoire)

Tout paramètre externe dans `src/core/engine/taxRules.ts` suit :

```typescript
type SourcedRate = {
  value: number;
  unit: 'ratio' | 'eur' | 'pct_points';
  source: string;       // ex: "CGI art. 219" | "BOFiP-IS-BASE-…" | "OpenLegi:…"
  asOf: string;         // ISO date de vérification
  status: 'verified' | 'assumed' | 'placeholder';
};
```

- **Given** : saisie utilisateur (CA, salaires, loyers) — jamais « corrigée » silencieusement.
- **Derived** : calcul moteur — formule exposée dans l'inspecteur.
- **External** : taux / seuils — **fetch ou refuse** (`finance-expert`). Placeholder daté uniquement si MCP indisponible.

### 3.1 Règles par entité (indicatives jusqu'à vérification OpenLegi)

#### A. SASU / SAS OpCo
- TVA défaut 20 % (catégorie standard) → vérifier OpenLegi/CGI.
- TVA nette = max(0, collectée − déductible).
- Coût président assimilé-salarié ≈ Net × facteur charges (paramètre sourcé URSSAF, pas magique 1.78).
- Résultat fiscal = CA_HT − charges − management fees − loyers SCI − masse salariale − intérêts CCA.
- IS : tranche PME 15 % jusqu'à seuil légal, 25 % au-delà — **seuil et taux = SourcedRate**.
- Bénéfice net = résultat fiscal − IS.

#### B. Holding — régime mère-fille (Art. 145 & 216 CGI / BOFiP)
- Conditions : ≥ 5 % détention, conservation 2 ans (ou engagement).
- Exonération 95 % ; QPFC 5 % réintégrée ; frottement ≈ 1,25 % si IS holding 25 %.
- Cash holding ≈ 98,75 % des dividendes (après IS sur QPFC).
- Management fees : réalité économique + valeur de marché + TVA 20 % — alerte `tax-lawyer-fr` si forfait sans convention.

#### C. SCI
- **IS :** loyers HT, intérêts, TF, amortissement bâti, IS sur résultat, CF pour remboursement capital.
- **IR :** transparence foncière (TMI + PS) — pas d'amortissement bâti.

#### D. Personne physique
- Rémunération nette → IR barème (abattement 10 % — SourcedRate).
- Dividendes directs → PFU 30 % (12,8 % IR + 17,2 % PS) ou option barème + abattement 40 %.
- Remboursement CCA → non imposable ; **CCA débiteur PP interdit** (C. com.) → alerte rouge.

### 3.2 Alertes conformité (produit)

| Alerte | Fondement (à lier OpenLegi) | Comportement UI |
|---|---|---|
| CCA débiteur (PP) | C. com. L. 225-43 / L. 227-12 | Badge rose + blocage soft |
| Management fees sans substance | Acte anormal de gestion | Warning inspecteur |
| Loyer SCI hors marché | Acte anormal de gestion | Warning + note |
| Dirigeant 0 rémunération (hors ARE) | Protection sociale / retraite | Info amber |

### 3.3 Contenu inspecteur légal
`LegalReference.tsx` affiche : article CGI/BOFiP, résumé plain FR, lien Légifrance si disponible, statut `verified|assumed`. Les textes longs ne sont **pas** inventés : ils viennent d'un catalogue `legalNotes.json` rempli sous revue `tax-lawyer-fr`.

---

## 4. Interface & Design System Impeccable

Owners : `frontend-ui-engineering` + plugin Impeccable · Gates : `accessibility-checklist`, `web-performance-auditor`.

### 4.1 Workflow Impeccable
1. `/impeccable init` → `PRODUCT.md`
2. `/impeccable shape` puis `/impeccable craft` pour le canvas
3. `/impeccable typeset` · `colorize` · `animate` · `harden` · `audit` · `polish`

### 4.2 Tokens sémantiques des flux

| Flux | Dark | Light | Sens |
|---|---|---|---|
| Fond canvas | `#0B0F17` | `#F8FAFC` | Grille dots 1px |
| Cartes nœuds | `#111827` | `#FFFFFF` | Bordure 1px |
| Trésorerie / CA | `#10B981` | `#059669` | Cash brut |
| TVA | `#06B6D4` | `#0891B2` | Collectée / nette |
| IS | `#F59E0B` | `#D97706` | Impôt sociétés |
| Social / URSSAF | `#6366F1` | `#4F46E5` | Cotisations |
| Dividendes / net perso | `#EAB308` | `#CA8A04` | Enrichissement |
| Dettes / alertes | `#F43F5E` | `#E11D48` | Risque |

### 4.3 Typographie (anti-slop Impeccable)
- UI : `Plus Jakarta Sans` ou `Geist Sans` — **pas** Inter/Arial comme défaut générique.
- Montants : `JetBrains Mono` / `Geist Mono` + `font-variant-numeric: tabular-nums`.
- Format FR : `124 500 €` (espace insécable).

### 4.4 Particules
Vitesse cycle \(v = \mathrm{clamp}(1.5,\ \log_{10}(\mathrm{montant}+1),\ 6)\) s — budget GPU validé par `web-performance-auditor` (désactiver particules si `prefers-reduced-motion`).

---

## 5. Fonctionnalités Interactives & Simulation

Owners : `finance-expert` (modèle) + `frontend-ui-engineering` (UX).

```
┌ TOP: Logo | Presets | Vues 1-clic | Partager ──────────────────────────────────────┐
├ Calques + What-If ── Canvas Money Flow ────────────────── Inspecteur flux ─────────┤
├ Timeline Replay [⏮ ◀ ▶ ▶] Étape n/6 ───────────────────────────────────────────────┤
└ Synthèse: CA | IS | URSSAF | Cash groupe | Disclaimer ─────────────────────────────┘
```

### 5.1 Timeline Replay (6 étapes)
1. Facturation / encaissement Clients → SASU  
2. Charges + TVA déductible SASU → Fournisseurs  
3. Rémunération + URSSAF SASU → Dirigeant / URSSAF  
4. Intra-groupe (loyer SCI, management fees)  
5. Clôture fiscale TVA nette + IS → DGFiP  
6. Dividendes / réserves (mère-fille ou Flat Tax)

### 5.2 Money Tracer
Injection d'un montant test → onde colorée + friction fiscale à chaque nœud (étiqueté Given/Derived).

### 5.3 Calques
Trésorerie · TVA · IS/IR · Social · Juridique (% détention) · Temporalité (option) · Rôles (option).

### 5.4 Presets structures
1. Freelance SASU seule  
2. SASU + Holding (mère-fille)  
3. Groupe SASU + Holding + SCI  

### 5.5 Mode édition hybride
Presets + ajout d'entités/flux custom (pas sandbox totale V1).

---

## 6. Données & Persistance

Owner : `solution-architect`.

### 6.1 Types client (extrait)

```typescript
export type EntityType =
  | 'sasu' | 'holding_sas' | 'holding_sarl'
  | 'sci_is' | 'sci_ir' | 'person'
  | 'client' | 'vendor' | 'tax_authority' | 'urssaf' | 'bank';

export type FlowCategory =
  | 'revenue' | 'expense' | 'management_fees' | 'dividend'
  | 'salary' | 'social_charges' | 'rent' | 'is_tax' | 'vat'
  | 'cca_advance' | 'cca_reimbursement' | 'loan_payment';

export interface FlowEdgeData {
  id: string;
  sourceId: string;
  targetId: string;
  category: FlowCategory;
  label: string;
  amount: number;
  periodicity: 'monthly' | 'quarterly' | 'annual' | 'one_off';
  layer: 'treasury' | 'vat' | 'tax' | 'social' | 'legal';
  taxRate?: number;
  legalNoteId?: string; // → legalNotes.json (sourcé)
  warning?: string;
}
```

### 6.2 D1 (Drizzle)
Tables `scenarios` (slug unique, `data_json`, public flag) et `scenario_versions` (snapshots).

### 6.3 Partage
- Primaire : `POST /api/scenarios` → URL `/s/:slug`
- Fallback offline : hash lz-string

---

## 7. Structure de Fichiers

```
/
├── PRODUCT.md · DESIGN.md · CONSTRAINTS.md · AGENTS.md · prompt.md
├── docs/superpowers/specs/2026-09-06-simulateur-flux-design.md
├── docs/superpowers/plans/2026-09-06-simulateur-flux.md
├── .agentforge/team/simulateur-flux.json
├── src/core/engine/     # calculator, taxRules (SourcedRate), timeline, graph
├── src/core/legal/      # legalNotes.json (catalogue sourcé tax-lawyer-fr)
├── src/core/presets/
├── src/components/canvas|controls|inspector|common/
├── src/hooks/
└── backend/src/         # Hono + Drizzle D1
```

---

## 8. Tests & Validation

Owners : `testing-patterns` · Skills : TDD rouge-vert-refactor · Browser : `browser-testing-with-devtools`.

### 8.1 Unitaire (moteur)
- IS avec tranche réduite + normale (seuils **lus** depuis `taxRules`, pas hardcodés magiques dans le test sans commentaire `asOf`).
- Mère-fille : QPFC, IS holding, cash net.
- PFU 30 % sur dividende direct.
- Alerte CCA débiteur.
- Timeline : 6 étapes produisent les bons flux actifs.

### 8.2 Intégration API
Création / lecture scénario par slug.

### 8.3 Browser
Preset groupe chargé, What-If CA, Play timeline, contrastes focus clavier.

---

## 9. Critères d'Acceptation

- [ ] 60 fps What-If / Timeline (`web-performance-auditor`)
- [ ] Chaque `SourcedRate` a `source` + `asOf` ; aucun taux « de mémoire » mergé
- [ ] Alertes CCA / management fees / loyer affichées
- [ ] Impeccable polish + a11y checklist OK
- [ ] Disclaimer permanent : simulation pédagogique, pas un avis fiscal
- [ ] Partage slug D1 + fallback URL hash
- [ ] Couverture 100 % fonctions publiques du moteur

---

## 10. Mapping plan d'implémentation ↔ équipe

À refléter dans `docs/superpowers/plans/2026-09-06-simulateur-flux.md` :

| Task plan | Agents / skills |
|---|---|
| T1 Types & scaffold | `solution-architect`, `git-workflow-and-versioning` |
| T2 Moteur fiscal TDD | `tax-lawyer-fr`, `finance-expert`, `testing-patterns` |
| T3 Graphe + timeline | `finance-expert`, `solution-architect` |
| T4 Design system Impeccable | `frontend-ui-engineering`, Impeccable |
| T5–T6 Canvas nodes/edges | `frontend-ui-engineering`, `web-performance-auditor` |
| T7–T8 Timeline / What-If / calques | `finance-expert`, `frontend-ui-engineering` |
| T9 Inspecteur légal | `tax-lawyer-fr` + OpenLegi (dev) |
| T10 API Hono/D1 | `solution-architect`, `cto-advisor` |
| T11 Assemblage + audit | `orchestration-patterns`, Impeccable, `accessibility-checklist`, `browser-testing-with-devtools` |
