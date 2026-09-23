# Gap analyse & plan : exhaustivité des structures (IS / IR) et TMI

> **Date :** 2026-09-20 · **Rôle :** CTO · **Statut :** plan + implémentation
> **Gate équipe AgentForge :** `team_compose` indisponible (serveur `agentforge-pool` non enregistré
> dans la session). Repli documenté par `CLAUDE.md` : entrées locales `pool/` —
> `tax-lawyer-fr` (conformité CGI/BOFiP, sourçage OpenLegi) et `finance-expert` (provenance des
> chiffres) appliquées comme règles inline. Équipe de la spec d'origine inchangée.

## 1. Où on en est (état réel du moteur)

| Brique | État | Preuve |
|---|---|---|
| IS (15 % / 25 %, plafond 42 500 €, CA ≤ 10 M€) | ✅ complet et sourcé | `calculateCorporateTax` |
| TVA collectée / déductible | ✅ | `calculateVAT` |
| Mère-fille QPFC 5 % | ✅ (taux plat holding) | `calculateMotherDaughterDividend` |
| PFU dividendes 31,4 % | ✅ | `calculateFlatTax` |
| Président SASU assimilé-salarié | ⚠️ approximation à taux plats | `URSSAF_BRANCHES_2026` |
| Barème IR + TMI | ⚠️ calculé, jamais affiché hors Optimiseur | `calculatePersonalIncomeTax` |
| SCI à l'IS | ✅ | `calculateSciTax` |
| EURL / SARL / SCI IR / holding SARL | ❌ **dessinables, non chiffrées** | warnings `graphResolver` |
| Micro-entreprise / EI | ❌ **type d'entité inexistant** | `ENTITY_TYPES` |

## 2. Les 9 écarts vs la cible

**G1 — Le régime fiscal n'est pas une dimension du modèle.** `sci_is` / `sci_ir` encodent le
régime dans le *type* d'entité. Une SASU ne peut pas être à l'IR (option 5 ans, CGI art. 239 bis AB),
une EURL ne peut pas être à l'IS. Bloquant pour tout le reste.

**G2 — La TMI n'est pas affichée.** Elle existe (`PersonalIncomeTaxResult.marginalRate`) et
n'apparaît que dans le panneau Optimisation. Demande explicite.

**G3 — Base IR fausse.** `graphResolver` appelle `calculatePersonalIncomeTax(salaryNet)` : l'IR est
assis sur le **net à payer**, alors que l'assiette est le **net imposable** (brut − cotisations
déductibles, CSG/CRDS non déductible réintégrée). L'IR est donc sous-estimé. Bug de fond, un seul
site d'appel.

**G4 — Pas de quotient familial.** `parts` est câblé à 1, sans plafonnement (CGI art. 197 I-2,
1 807 €/demi-part) ni décote (CGI art. 197 I-4, 897 € / 1 483 €). Sans ça l'arbitrage IS/IR est faux
pour tout foyer non célibataire.

**G5 — Pas d'option barème sur dividendes.** Seul le PFU existe. L'option globale au barème
(abattement 40 %, CGI art. 158 3-2° ; CSG déductible 6,8 pts, CGI art. 154 quinquies II) gagne sous
TMI 11 % et se discute à 30 %. C'est *le* levier IS/IR côté associé.

**G6 — TNS absent.** Gérant majoritaire de SARL/EURL : cotisations SSI, et surtout dividendes
> 10 % du capital + primes + CCA assujettis aux cotisations (CSS art. L131-6). Change radicalement
l'arbitrage vs SASU.

**G7 — Micro-entreprise / EI absents.** Le régime le plus répandu en France n'est pas modélisable.
Abattements 71 % / 50 % / 34 % / 30 %, seuils 203 100 / 83 600 / 15 000 € (CGI art. 50-0, 102 ter).

**G8 — SCI à l'IR fausse.** Calculée comme une SCI à l'IS (warning assumé dans le code). La vraie
mécanique : transparence, revenus fonciers imposés chez l'associé à sa TMI + prélèvements sociaux,
pas d'amortissement du bâti.

**G9 — Aucun comparateur.** L'app simule *une* structure à la fois. La cible — « quelle structure
choisir ? » — demande de voir les structures côte à côte à CA et foyer constants.

## 3. Plan — 6 phases

| # | Phase | Livrable | Écarts couverts |
|---|---|---|---|
| P1 | Régime fiscal first-class | `taxRegime` / `socialRegime` / `microCategory` sur l'entité | G1 |
| P2 | IR correct + TMI affichée | net imposable, parts, plafonnement QF, décote, badge TMI | G2 G3 G4 |
| P3 | PFU vs barème | `calculateDividendTax` + arbitrage automatique affiché | G5 |
| P4 | TNS | cotisations SSI + règle des 10 % | G6 |
| P5 | Micro / EI + SCI IR | abattements, versement libératoire, revenus fonciers | G7 G8 |
| P6 | Comparateur de structures | onglet « Structures » : net perso par structure, classé | G9 |

## 4. Taux sourcés ajoutés (campagne OpenLegi du 2026-09-20)

| Paramètre | Valeur | Source |
|---|---|---|
| Abattement dividendes (option barème) | 40 % | CGI art. 158, 3-2° — LEGIARTI000054373673 |
| CSG déductible sur revenus du patrimoine | 6,8 pts | CGI art. 154 quinquies II — LEGIARTI000054336634 |
| Plafonnement quotient familial | 1 807 €/demi-part | CGI art. 197, I-2 — LEGIARTI000053542636 |
| Décote IR | 897 € seul / 1 483 € couple, −45,25 % | CGI art. 197, I-4-a — LEGIARTI000053542636 |
| Micro-BIC vente/hébergement | 71 %, seuil 203 100 € | CGI art. 50-0, 1-1° — LEGIARTI000054373853 |
| Micro-BIC services | 50 %, seuil 83 600 € | CGI art. 50-0, 1-2° — LEGIARTI000054373853 |
| Micro meublé tourisme non classé | 30 %, seuil 15 000 € | CGI art. 50-0, 1-1° bis — LEGIARTI000054373853 |
| Micro-BNC | 34 %, seuil 83 600 € | CGI art. 102 ter, 1 — LEGIARTI000054373747 |
| Abattement micro plancher | 305 € | CGI art. 50-0 / 102 ter |
| Dividendes TNS assujettis > 10 % capital | 10 % | CSS art. L131-6 — LEGIARTI000048683707 |

Cotisations SSI (TNS) et cotisations micro : **aucun taux statutaire unique** — paramètres modèle
`status: 'placeholder'`, au même titre que l'AT/MP déjà présent.

## 5. Angles morts assumés (non couverts, documentés dans l'UI)

- Option IR de la SAS/SASU (CGI 239 bis AB) : limitée à 5 ans, non modélisée.
- ACRE, ARE, exonérations ZFU/JEI, CIR/CII.
- Plus-values de cession (art. 150-0 D, apport-cession 150-0 B ter).
- IFI, droits de donation/succession sur les titres.
- Plafond de sécurité sociale, réduction générale, tranche 2 AGIRC-ARRCO (déjà signalé).
- Détermination du bénéfice distribuable et décision d'assemblée.

## 6. Exécution — état au 2026-09-20

| # | Phase | État | Où |
|---|---|---|---|
| P1 | Régime fiscal first-class | fait | `src/core/types/entity.ts` (`TaxRegime`, `SocialRegime`, `MicroCategoryId`, défauts par type) |
| P2 | IR correct + TMI affichée | fait | `calculatePersonalIncomeTax` (net imposable, parts, plafonnement QF, décote) ; badges TMI / taux moyen dans `src/App.tsx` ; profil foyer dans `WhatIfSliders` |
| P3 | PFU vs barème | fait | `calculateDividendTax` / `compareDividendTaxModes` ; arbitrage câblé dans `graphResolver` (`dividendTaxMode`, mode `auto` par défaut) |
| P4 | TNS | fait | `calculateTnsContributions`, `calculateTnsDividendSurcharge` (règle des 10 %), consommés par le comparateur |
| P5 | Micro / EI + SCI IR | fait côté moteur | `calculateMicroEnterprise`, `calculateSciIrIncome` ; micro et EI comparés, SCI IR encore hors résolution de graphe |
| P6 | Comparateur de structures | fait | `src/core/engine/structureComparator.ts` + onglet « Structures » (`StructureComparator.tsx`) |

**Correctif de fond livré avec P2 (G3).** L'IR était assis sur le net versé ;
il l'est désormais sur `ExecutiveSalaryResult.netImposable` (net + CSG/CRDS non
déductibles), corrigé à la source pour tous les appelants.

**Décision d'architecture.** Le comparateur est un module pur distinct plutôt
qu'une réécriture de `graphResolver`, qui reste structurellement mono-SASU.
Répondre à « quelle structure choisir ? » ne nécessite pas de rendre le graphe
multi-régime, et cette réécriture reste le chantier ouvert le plus lourd.

**Reste ouvert (revu le 2026-09-21).** Livrés depuis : SCI IR et sociétés
transparentes dans `graphResolver`, versement libératoire et ACRE du micro.
Encore ouverts : option IR de la SAS (CGI 239 bis AB), valorisation des droits
sociaux (retraite, prévoyance) et des coûts de structure dans le classement du
comparateur — tous deux signalés à l'utilisateur dans les limites du modèle.

**UI (2026-09-21).** Les trois maquettes à données fictives (Kbis, Liasse,
Ticket) sont remplacées par un document réel, `SynthesePreview` : tableau des
montants de la simulation en cours + limites du modèle, imprimable.

**Vérification.** `npm run check` — lint, `tsc -b --noEmit`, 21 fichiers de
tests / 180 tests au vert, dont `structureComparator.test.ts` (12 cas) et
`regimes.test.ts`.
