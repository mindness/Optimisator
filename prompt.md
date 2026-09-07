# Spécification & Master Prompt d'Implémentation IA
# Simulateur Visuel de Flux d'Entreprise (SASU / Holding / SCI)

> **ID Projet Hermes :** `p5456d76d`  
> **Rôle de l'IA :** Lead Architect & Full-Stack Creative Engineer (React, React Flow, TypeScript, Fiscalité FR)  
> **Framework Design & UI :** **Plugin Impeccable** (`/impeccable` — standard de craft UI, `PRODUCT.md`, `DESIGN.md`, anti-patterns detectors)  
> **Périmètre métier :** France (Régime fiscal des sociétés, mère-fille, TVA, IS, URSSAF, Flat Tax, SCI IS/IR, conventions de trésorerie)

---

## 1. Instructions pour l'Agent IA & Intégration du Plugin Impeccable

Ce document est le **Master Prompt de réalisation**. En tant qu'IA chargée de développer ce projet, tu dois suivre rigoureusement le workflow et les conventions du **Plugin Impeccable** :

```bash
# 1. Initialisation de la vérité produit durable avec le plugin Impeccable
/impeccable init

# 2. Phase de conception UX/UI et cadrage des composants
/impeccable shape

# 3. Réalisation des vues et composants avec itération visuelle
/impeccable craft

# 4. Vérification et durcissement des cas limites (responsive, a11y, erreurs)
/impeccable audit
/impeccable harden
/impeccable polish
```

### 1.1 Artefacts Impeccable Obligatoires
1. **`PRODUCT.md`** : Doit être initialisé à la racine et consigner la vérité produit durable (utilisateurs cibles, contexte d'exploitation, contraintes fiscales strictes, voix et terminologie métier, critères de succès).
2. **`DESIGN.md`** : Doit définir le système visuel, la palette de tokens sémantiques, les règles typographiques tabulaires pour les devises, la hiérarchie spatiale et les règles d'interactions du canvas Money Flow.
3. **Respect des 61 règles de détection Impeccable (Anti-AI-Slop)** :
   - 🚫 **Interdit :** Fonts génériques par défaut (Inter partout, Arial). Utiliser une typographie identitaire et une police Mono dédiée aux flux financiers (`JetBrains Mono`, `Geist Mono` avec `tabular-nums`).
   - 🚫 **Interdit :** Dégradés violets / magentas génériques style SaaS IA.
   - 🚫 **Interdit :** Cartes imbriquées dans des cartes (*cards in cards*), ombres floues géantes, bordures épaisses ou arrondis uniformes sans hiérarchie.
   - 🚫 **Interdit :** Transitions et rebonds sans signification fonctionnelle. Le mouvement est réservé aux **particules de flux financiers** (qui encodent la vélocité et le volume du cash).

---

## 2. Vérité Produit Durable (`PRODUCT.md`)

### 2.1 Le Problème Métier
La structuration juridique et financière d'une activité en France (SASU opérationnelle, holding de gestion/patrimoniale, SCI locative à l'IS/IR, convention de trésorerie, remontée de dividendes) est complexe, abstraite et source de frictions :
- Les schémas traditionnels sont statiques (PowerPoint, PDF, mémos de cabinets comptables figés).
- Il est difficile de visualiser concrètement **d'où vient l'argent, par où il transite et où il reste net d'impôts et de charges**.
- Les réunions avec l'expert-comptable, les juristes ou les associés manquent d'un support dynamique partagé pour simuler instantanément des arbitrages (rémunération vs dividendes, holding vs direct, acquisition immo via SCI).

### 2.2 La Solution & Vision Produit
Une application web moderne, visuelle et hautement interactive basée sur un **canvas de flux financiers animés (*Money Flow Canvas*)**.  
L'outil permet de modéliser, manipuler et comprendre en un coup d'œil l'ensemble des interactions juridiques, financières et fiscales entre plusieurs entités d'un groupe et la sphère personnelle, avec un système de **calques thématiques**, des **scénarios pas-à-pas** et des **simulations "What-if" en temps réel**.

### 2.3 Utilisateurs Cibles & Cas d'Usage
| Profil | Cas d'usage principal |
|---|---|
| **Entrepreneur / Freelance / Dirigeant** | Valider et comprendre sa structuration (création de holding, passage en SASU, arbitrage trésorerie / investissement immo). |
| **Associés / Fondateurs** | Aligner les parties prenantes sur les conventions de trésorerie, la détention de capital et la distribution de dividendes. |
| **Préparation de RDV Cabinet Comptable** | Arriver avec un scénario clair, chiffré et partagé pour poser les bonnes questions fiscales sans perdre de temps. |

---

## 3. Système Visuel & Tokens Sémantiques (`DESIGN.md`)

L'interface applique la direction artistique **Fintech / LegalTech Premium** gérée via le plugin Impeccable.

### 3.1 Palette Sémantique des Flux Financiers
Chaque couleur de flux porte un sens financier univoque :

| Rôle & Flux | Token CSS (Dark) | Token CSS (Light) | Signification & Règle Métier |
|---|---|---|---|
| **Fond Canvas** | `#0B0F17` (Deep Slate) | `#F8FAFC` (Pure Mist) | Espace de travail avec grille subtile (dots 1px) |
| **Fond Cartes Nœuds** | `#111827` (Card Dark) | `#FFFFFF` (Card Light) | Surface des entités avec bordure fine 1px |
| **Bordures & Lignes** | `#1F2937` / `#374151` | `#E2E8F0` / `#CBD5E1` | Séparateurs nets sans flou |
| **Trésorerie & Cash Brut** | `#10B981` (Emerald 500) | `#059669` (Emerald 600) | Chiffre d'affaires, flux de revenus, cash disponible |
| **TVA** | `#06B6D4` (Cyan 500) | `#0891B2` (Cyan 600) | Flux de TVA collectée, déductible et nette |
| **Impôt sur les Sociétés (IS)** | `#F59E0B` (Amber 500) | `#D97706` (Amber 600) | Prélèvements fiscaux société, IS 15%/25%, CFE |
| **Social / URSSAF** | `#6366F1` (Indigo 500) | `#4F46E5` (Indigo 600) | Cotisations sociales, charges patronales et salariales |
| **Dividendes & Cash Perso Net** | `#EAB308` (Gold 500) | `#CA8A04` (Gold 600) | Dividendes mère-fille (quote-part 5%), net dirigeant |
| **Dettes / CCA / Alertes** | `#F43F5E` (Rose 500) | `#E11D48` (Rose 600) | Prêts bancaires, compte courant d'associé, alertes légales |

### 3.2 Typographie & Affichage des Nombres
- **Corps & UI :** `font-sans` géométrique (`Plus Jakarta Sans`, `Geist Sans` ou `Inter`).
- **Nombres & Montants :** `font-mono` avec alignement tabulaire obligatoire :  
  `font-family: 'JetBrains Mono', 'Geist Mono', monospace; font-variant-numeric: tabular-nums;`
- **Formatage monétaire systématique :** Séparateur de milliers avec espace insécable et symbole euro (`124 500 €`).

---

## 4. Modèle Métier & Formules Fiscales Déterministes (France)

### 4.1 Formules Exactes par Entité

#### A. SASU / SAS d'Exploitation (OpCo)
- **Chiffre d'Affaires TTC :** $\text{CA}_{\text{TTC}} = \text{CA}_{\text{HT}} \times (1 + \tau_{\text{TVA}})$ avec $\tau_{\text{TVA}} = 20\%$.
- **TVA Collectée :** $\text{TVA}_{\text{coll}} = \text{CA}_{\text{HT}} \times \tau_{\text{TVA}}$.
- **Charges d'exploitation déductibles :** $\text{Charges}_{\text{HT}} + \text{TVA}_{\text{déd}}$.
- **TVA Nette due à la DGFiP :** $\text{TVA}_{\text{nette}} = \max(0, \text{TVA}_{\text{coll}} - \text{TVA}_{\text{déd}})$.
- **Rémunération Président SASU :**
  - $\text{Coût Total SASU} = \text{Salaire Brut} + \text{Charges Patronales} \approx \text{Net} \times 1.78$.
  - Cotisations sociales globales URSSAF $\approx 75\%$ à $80\%$ du net versé.
- **Résultat Fiscal avant IS :**  
  $$\text{Résultat Fiscal} = \text{CA}_{\text{HT}} - \text{Charges}_{\text{HT}} - \text{Management Fees}_{\text{HT}} - \text{Loyers SCI}_{\text{HT}} - \text{Rémunération Brute} - \text{Charges Patronales} - \text{Intérêts CCA}$$
- **Impôt sur les Sociétés (IS) :**
  - Tranche réduite (PME, CA < 10M€) : $15\%$ jusqu'à $42\,500\text{ €}$.
  - Tranche normale : $25\%$ au-delà de $42\,500\text{ €}$.
  $$\text{IS} = \begin{cases} 
  \text{Résultat Fiscal} \times 0.15 & \text{si } \text{Résultat Fiscal} \le 42\,500 \\
  (42\,500 \times 0.15) + ((\text{Résultat Fiscal} - 42\,500) \times 0.25) & \text{si } \text{Résultat Fiscal} > 42\,500
  \end{cases}$$
- **Bénéfice Net Distribuable :** $\text{Bénéfice Net} = \text{Résultat Fiscal} - \text{IS}$.

#### B. Holding (SAS / SARL / EURL) & Régime Mère-Fille
- **Exonération d'IS :** $95\%$ des dividendes distribués par l'OpCo sont exonérés d'IS (Art. 145 et 216 du CGI).
- **Quote-part de frais et charges (QPFC) réintégrée :** $\text{QPFC} = 5\% \times \text{Dividendes}$.
- **IS dû par la Holding :** $\text{IS}_{\text{holding}} = \text{QPFC} \times 25\% = 1.25\% \times \text{Dividendes}$.
- **Trésorerie nette conservée par la Holding :** $\text{Cash}_{\text{holding}} = 98.75\% \times \text{Dividendes}$.

#### C. SCI Locative (Immobilier d'Entreprise)
- **Option IS :**
  - Encaissement des loyers HT versés par l'OpCo.
  - Déduction des intérêts d'emprunt, taxe foncière, assurance, et **amortissement comptable** (~2.5% à 3% / an).
  - Résultat soumis à l'IS (15% / 25%).
  - Cash-flow net utilisé pour rembourser le capital du prêt bancaire.
- **Option IR (Transparence fiscale) :**
  - Revenus fonciers imposés directement entre les mains des associés (IR au TMI + 17.2% de prélèvements sociaux) sans amortissement du bâti.

#### D. Personne Physique (Dirigeant / Actionnaire)
- **Rémunération nette perçue :** Soumise à l'IR au barème progressif (après abattement forfaitaire 10%).
- **Dividendes directs (sans Holding) :** Soumis au **Prélèvement Forfaitaire Unique (PFU / Flat Tax)** de $30\%$ ($12.8\%$ IR + $17.2\%$ Prélèvements Sociaux).
- **Remboursement de Compte Courant d'Associé (CCA) :** $\text{Net d'impôt et de charges}$.

---

## 5. Fonctionnalités Cœurs de l'Application

### 5.1 Canvas Interactif & Flux Dynamiques (Money Flow)
- **Rendu graphique nodal :** Nœuds représentant les entités avec indicateurs financiers intégrés (Trésorerie disponible, Résultat d'exercice, IS prévisionnel, Cash perso net).
- **Flux animés type particules / fluides :** Visualisation de la vitesse et de la densité du flux selon le montant financier.
- **Inspecteur de flux cliquable :**
  - Détail du calcul pas-à-pas.
  - Référence légale vulgarisée (ex : *Art. 145 et 216 du CGI - Régime mère-fille*).
  - Risques et points de vigilance associés (ex : *Absence de substance économique des management fees, CCA débiteur*).

---

### 5.2 Système de Calques (Layers) — Filtrage de la Complexité
L'utilisateur peut activer/désactiver des calques superposés sur le même schéma sans changer de scénario :

```
[ ] Calque Trésorerie      (Flux cash inter-comptes, conventions de trésorerie, CCA)
[ ] Calque TVA              (TVA collectée, TVA déductible, flux reversé à la DGFiP)
[ ] Calque IS / IR          (Résultats fiscaux, quote-parts, retenues et acomptes)
[ ] Calque Social / URSSAF  (Rémunérations, charges patronales et salariales)
[ ] Calque Juridique        (Liens de détention du capital %, pactes d'associés, mandats)
[ ] Calque Temporalité      (Jalons d'échéances : mensuel, déclarations trimestrielles, AG)
[ ] Calque Rôles & Acteurs  (Acteurs intervenants : Expert-comptable, Banque, Gérant, Salarié)
```

#### Presets de vue 1-Clic :
- **Vue Dirigeant :** Focus Trésorerie disponible par entité + Cash personnel net après impôts.
- **Vue Comptable :** TVA, échéancier déclaratif, assiettes de cotisations et calculs d'IS.
- **Vue Associé / Investisseur :** Conventions de trésorerie, flux de dividendes, CCA, valorisation du groupe.
- **Vue Pédagogique (Vulgarisation) :** Affichage épuré, gros flux lisibles, termes simplifiés.

---

### 5.3 Presets de Structures Types Embarqués

1. **Freelance SASU Seule :** Clients $\rightarrow$ SASU $\rightarrow$ Personne Physique, DGFiP, URSSAF (Arbitrage Salaire vs Dividendes directs).
2. **SASU + Holding Active (Régime Mère-Fille) :** SASU fille opérationnelle + Holding mère avec convention de prestations et remontée mère-fille.
3. **Groupe Complet (SASU + Holding + SCI) :** SASU pour l'activité opérationnelle + Holding détenant 100% de la SASU et 99% de la SCI + SCI détenant l'immobilier d'exploitation (loyers versés par la SASU).

---

### 5.4 Simulateur "What-If" & Timeline Replay
- Sliders ajustables en direct dans un panneau latéral :
  - Variation du CA (+10%, +25%, −15%)
  - Montant de la rémunération mensuelle du président
  - Montant des dividendes distribués vs mis en réserve
  - Montant du loyer de la SCI
- Recalcul instantané de tous les nœuds et flux sur le canvas à 60 fps.
- Contrôleur de timeline (T0 à T4) pour animer la vie de la société au fil de l'exercice comptable.

---

### 5.5 Comparateur A/B & Partage d'URL
- Mode split-view ou superposition pour comparer deux stratégies (ex: Sortie directe Flat Tax vs Réinvestissement Holding).
- Sérialisation d'état dans l'URL (hash compressé) permettant le partage en lecture seule sans base de données.

---

## 6. Architecture Technique & Structure du Code

```
src/
├── core/
│   ├── engine/
│   │   ├── calculator.ts          # Moteur de calcul financier pur (déterministe)
│   │   ├── taxRules.ts            # Taux et barèmes fiscaux français (TVA, IS, PFU, Cotisations)
│   │   ├── graphEngine.ts         # Résolution ordonnée du graphe de flux
│   │   └── __tests__/
│   │       ├── calculator.test.ts # Tests unitaires exhaustifs des calculs
│   │       └── scenarios.test.ts  # Validation des 3 structures types
│   ├── types/
│   │   ├── entity.ts              # Types des nœuds d'entités
│   │   ├── flow.ts                # Types des flux (arêtes) et catégories
│   │   ├── layer.ts               # Définition des calques et presets
│   │   └── scenario.ts            # Schéma JSON complet d'un scénario
│   └── presets/
│       ├── defaultPresets.ts      # Freelance SASU, SASU + Holding, Groupe SASU+Holding+SCI
│       └── viewPresets.ts         # Vues Dirigeant, Comptable, Associé, Pédagogique
├── components/
│   ├── canvas/
│   │   ├── FlowCanvas.tsx         # Wrapper React Flow / Custom Canvas
│   │   ├── FlowEdge.tsx           # Arête animée avec particules vectorielles
│   │   ├── EntityNode.tsx         # Carte de nœud générique stylisée Impeccable
│   │   └── nodes/
│   │       ├── SasuNode.tsx       # Nœud spécifique SASU (CA, charges, IS, cash)
│   │       ├── HoldingNode.tsx    # Nœud spécifique Holding (Trésorerie, participations)
│   │       ├── SciNode.tsx        # Nœud spécifique SCI (Loyers, emprunt, cash-flow)
│   │       ├── PersonNode.tsx     # Nœud Personne Physique (Net perso, impôts)
│   │       └── AuthorityNode.tsx  # Nœud DGFiP / URSSAF (Total collecté)
│   ├── controls/
│   │   ├── TopNav.tsx             # Barre supérieure avec sélecteurs et export
│   │   ├── LayerSwitcher.tsx      # Sélecteur de calques thématiques (badges toggle)
│   │   ├── WhatIfSliders.tsx      # Curseurs de simulation en temps réel
│   │   ├── TimelineReplay.tsx     # Contrôle pas-à-pas de l'exercice (T0 -> T4)
│   │   └── ScenarioComparer.tsx   # Modal / Split-view comparateur A/B
│   ├── inspector/
│   │   ├── FlowInspector.tsx      # Tiroir latéral de détail du flux cliqué
│   │   ├── LegalNotes.tsx         # Encadré juridique (Articles CGI, alertes)
│   │   └── StepCalculation.tsx    # Décomposition mathématique pas-à-pas
│   └── common/
│       ├── MetricBadge.tsx        # Affichage d'un montant avec token de couleur
│       ├── DisclaimerBanner.tsx   # Mention légale permanente
│       └── ThemeToggle.tsx        # Bascule Dark / Light
├── hooks/
│   ├── useSimulation.ts           # Hook central de gestion d'état et de recalcul
│   ├── useUrlState.ts             # Sérialisation et partage d'état dans l'URL
│   └── useLayers.ts               # Filtrage des nœuds et arêtes selon calques actifs
├── styles/
│   └── globals.css                # Tokens CSS Impeccable, variables et styles React Flow
└── App.tsx                        # Assemblage principal de la SPA
```

---

## 7. Commandes Impeccable à exécuter durant le développement

Pour garantir une finition d'exception sans défauts visuels ou d'accessibilité, l'IA doit valider chaque étape avec le plugin Impeccable :

1. `/impeccable init` : Initialise `PRODUCT.md` et `DESIGN.md`.
2. `/impeccable typeset` : Vérifie la rigueur de la hiérarchie typographique et des chiffres tabulaires.
3. `/impeccable colorize` : Ajuste les contrastes des flux selon la palette de tokens sémantiques.
4. `/impeccable animate` : Ajuste la vitesse et la fluidité des particules de flux sans surcharger le GPU.
5. `/impeccable harden` : Gère le responsive, les valeurs extrêmes (0€, montants > 10M€), les erreurs d'arrondi.
6. `/impeccable audit` : Vérifie la conformité a11y (WCAG AAA contrastes, navigation clavier, tooltips).
7. `/impeccable polish` : Passe finale avant livraison.
