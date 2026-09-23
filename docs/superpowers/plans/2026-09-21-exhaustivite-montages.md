# Plan : exhaustivité des montages (cession, report, démembrement, transmission)

> **Date :** 2026-09-21 · **Rôle :** CTO · **Statut :** implémenté le 2026-09-22 (P0 → P8)
> **Gate équipe AgentForge :** `team_compose` indisponible — le serveur `agentforge-pool`
> n'est pas enregistré dans cette session (aucun outil `mcp__agentforge-pool__*` chargeable).
> Repli prévu par `CLAUDE.md`, même précédent que le plan du 2026-09-20 : entrées locales
> `pool/` appliquées comme règles inline — `tax-lawyer-fr` (sourçage CGI/BOFiP systématique,
> MCP OpenLegi), `finance-expert` (provenance de chaque chiffre),
> `planning-and-task-breakdown` (découpage), `constraint-driven-development` (barre
> `CONSTRAINTS.md`). **À rejouer** : si le serveur revient, appeler `team_compose` et
> insérer la section `## AgentForge team` avant d'attaquer P1.

## 1. Le constat

Sept familles de montages publiés ne sont pas modélisables aujourd'hui. Vérifié par
recherche dans l'arbre : aucune occurrence de `plus-value`, `usufruit`, `démembr`,
`Dutreil`, `150-0 B ter`, `IFI` dans `src/core` ; `animatrice` apparaît une fois
(`conventions.ts:126`), `report déficitaire` une fois, comme limite assumée
(`structureComparator.ts:107`).

| # | Manque | Pourquoi ça bloque |
|---|---|---|
| M1 | **Exercices chaînés** | `FORECAST_BLIND_SPOTS` l'écrit : « chaque exercice est calculé isolément ». Tout ce qui se reporte est hors modèle |
| M2 | **Report déficitaire** | Un schéma en perte N est faux en N+1 |
| M3 | **Emprunt réel** | `loan_payment` est un flux plat : ni dette au bilan, ni split capital / intérêts dans le temps |
| M4 | **Cession de titres** | Catégorie de flux inexistante → ni LBO, ni OBO, ni apport-cession dessinables |
| M5 | **Apport-cession 150-0 B ter** | Aucun report d'imposition, aucun suivi de délai |
| M6 | **Démembrement** | `ownerships` est un pourcentage plat : pas de NP / US, pas d'usufruit temporaire |
| M7 | **Holding animatrice, TVA de holding, IFI** | Statut absent ; TVA des management fees « supposée neutre » |
| M8 | **Transmission (donation, Dutreil)** | Absente |
| M9 | **Location meublée au réel (LMNP / LMP)** | Seul le micro `meuble_tourisme` existe |

## 2. Le verrou d'architecture

M2, M3, M5, M6, M8, M9 sont tous **stateful et pluriannuels**. Le moteur est
mono-exercice : `resolveScenarioGraph` prend un `ScenarioState` et rend une année ;
`forecast.ts` le rappelle N fois **sans rien transporter d'une année à l'autre**.

Rien d'autre ne peut être fait proprement avant de casser ça. Tout empiler sur le
modèle annuel produirait six contournements ad hoc au lieu d'un mécanisme.

**P0 est donc le seul prérequis dur.** P1 et P2 l'exercent sur des cas simples avant
que P3+ ne s'appuient dessus.

## 3. Phases

Ordre = dépendances. Chaque phase est livrable et vérifiable seule.

| # | Phase | Dépend de | Manques couverts |
|---|---|---|---|
| P0 | Exercices chaînés + état reporté | — | M1 |
| P1 | Report déficitaire | P0 | M2 |
| P2 | Emprunt : dette et tableau d'amortissement | P0 | M3 |
| P3 | Cession de titres et plus-values | P0 | M4 |
| P4 | Apport-cession 150-0 B ter | P3 | M5 |
| P5 | Démembrement de propriété | P0 | M6 |
| P6 | Holding animatrice, TVA de holding, IFI | — | M7 |
| P7 | Transmission : donation et pacte Dutreil | P5 | M8 |
| P8 | Location meublée au réel | P0 | M9 |

---

### P0 — Exercices chaînés + état reporté

**Livrable.** `resolveScenarioGraph` devient une fonction d'un exercice **et d'un état
d'ouverture**, et rend un état de clôture. `forecast.ts` chaîne les exercices au lieu de
les répéter.

**Modèle.**
```ts
/** Ce qu'un exercice lègue au suivant. Toute règle à report s'y branche. */
interface CarryOver {
  deficits: Record<EntityId, DeficitStock>;      // P1
  loans: Record<FlowId, LoanState>;              // P2
  reports150_0Bter: DeferredGain[];              // P4
  amortizations: Record<EntityId, AssetSchedule>; // P5, P8
  treasury: Record<EntityId, number>;            // remplace openingTreasury
  cca: Record<EntityId, number>;                 // remplace openingCca
}
```
`openingTreasury` / `openingCca` deviennent l'état initial de l'exercice 1 — pas de
rupture pour les scénarios existants.

**Moteur.** `resolveScenarioGraph(scenario, inputs, carryIn?) → { …, carryOut }`. Signature
rétrocompatible : sans `carryIn`, comportement actuel à l'identique.

**UI.** L'axe temps existe (`TimelineBar` = étapes **dans** l'année). Ajouter un sélecteur
d'exercice distinct ; ne pas surcharger la timeline existante, les deux axes sont orthogonaux.

**Test de sortie.** Un scénario sur 3 exercices où la trésorerie de clôture N est bien
l'ouverture de N+1 ; `FORECAST_BLIND_SPOTS` perd sa ligne « chaque exercice est calculé
isolément ».

**Risque.** Le plus gros diff du plan. `graphResolver.ts` fait ~700 lignes et beaucoup de
closures capturent l'exercice courant. Passer l'état en paramètre explicite, jamais en
module-level.

---

### P1 — Report déficitaire

**Livrable.** Un déficit d'exercice s'impute sur les bénéfices suivants.

**Règles à sourcer** (CGI art. 209 I) : report en avant illimité, plafonné à
**1 000 000 € + 50 % de la fraction du bénéfice excédant ce montant** ; report en arrière
(carry-back, art. 220 quinquies) sur le seul exercice précédent, plafonné, créance sur
le Trésor. Côté IR : déficits BIC/BNC imputables sur le revenu global, déficits fonciers
sur le revenu global dans la limite de 10 700 € (art. 156).

**Test de sortie.** Déficit 300 k€ en N, bénéfice 200 k€ en N+1 → IS nul en N+1, stock
résiduel 100 k€. Cas au-delà du plafond 1 M€.

---

### P2 — Emprunt : dette et tableau d'amortissement

**Livrable.** `loan_payment` porte un capital restant dû, un taux, une durée ; le split
capital / intérêts est calculé par échéance, pas saisi.

**Modèle.** `FlowEdgeData` gagne `loan?: { principal, rate, years, type: 'amortissable' | 'in_fine' }`.
`interestAmount` saisi à la main reste accepté en repli (ne pas casser l'existant).

**Moteur.** Échéancier standard ; seuls les intérêts sont déductibles, le capital est un
mouvement de trésorerie. Contrôle du plafond de l'art. 39, 1-3° déjà présent pour les CCA
— l'étendre ici.

**Test de sortie.** Emprunt 200 k€ / 20 ans / 3 % : somme des intérêts sur la durée, capital
restant dû nul au terme, IS de chaque exercice cohérent.

---

### P3 — Cession de titres et plus-values

**Livrable.** Nouvelle catégorie de flux `share_sale`. Débloque à elle seule trois familles
de montages (LBO, OBO, apport-cession).

**Modèle.**
- `FlowCategory` += `'share_sale'` ; charge utile : `{ soldPercent, acquisitionPrice, acquisitionDate }`.
- Routes : `person → person|company`, `company → person|company`.

**Règles à sourcer.**
- Cédant personne physique : art. 150-0 A ; imposition PFU 12,8 % + PS 17,2 %, ou barème
  sur option globale (déjà modélisée pour les dividendes — **réutiliser** `compareDividendTaxModes`).
- Abattement fixe dirigeant partant à la retraite : art. 150-0 D ter, 500 000 €, conditions
  et fenêtre temporelle.
- Abattements pour durée de détention : art. 150-0 D, **titres acquis avant le 1ᵉʳ janvier 2018**
  uniquement, et seulement sur option barème. Piège classique, à afficher explicitement.
- Cédant société à l'IS : régime des titres de participation, art. 219 I-a quinquies —
  exonération sous réserve d'une quote-part de frais et charges de **12 % du résultat brut**,
  détention ≥ 2 ans.

**Test de sortie.** Cession par une personne physique et par une holding du même bloc de
titres : les deux traitements divergent bien (PFU vs QPFC 12 %).

---

### P4 — Apport-cession 150-0 B ter

**Livrable.** `share_contribution` (apport de titres à une société contrôlée) met la
plus-value en report ; le report est suivi dans le `CarryOver` et purgé ou déchu selon
les délais.

**Règles — vérifiées le 2026-09-21 sur Légifrance** (art. 150-0 B ter, version 9.0,
`LEGIARTI000053542872`, en vigueur depuis le 21/02/2026, issue de l'art. 11 de la
**loi n° 2026-103 du 19 février 2026**, applicable aux cessions de titres apportés
réalisées à compter du lendemain de sa publication) :

| Paramètre | Valeur en vigueur |
|---|---|
| Cession déclenchant l'obligation de remploi | dans les **3 ans** de l'apport |
| Quota de réinvestissement | **≥ 70 %** du produit de cession |
| Délai pour réinvestir | **3 ans** à compter de la cession |
| Conservation des biens ou titres réinvestis | **≥ 5 ans** |
| Contrôle de l'apporteur | présomption à **33,33 %** (III) |
| Donation : purge | **6 ans**, portés à **11 ans** si remploi via fonds (d du 2°) |
| Sanction du non-respect | fin du report + intérêt de retard art. 1727 |

**Exclusion majeure à modéliser.** Le texte exclut du remploi éligible la gestion de son
propre patrimoine immobilier et les activités visées au 3° du C du I de l'art. 199 terdecies-0 A.
Un **OBO immobilier adossé au report ne tient plus** au-delà de la poche libre de 30 %.
L'app doit le dire au moment où l'utilisateur trace le montage, pas dans une note de bas de page.

**Doctrine.** BOI-RPPM-PVBMI-30-10-60-10 (mise à jour 2026-08-10) et -60-20 (2026-08-27).

**Test de sortie.** Apport puis cession à 2 ans avec remploi de 65 % → déchéance et intérêt
de retard. À 70 % dans les 3 ans, conservation 5 ans → report maintenu. Remploi immobilier →
refus d'éligibilité au-delà de 30 %.

---

### P5 — Démembrement de propriété

**Livrable.** Une détention n'est plus un pourcentage plat.

**Modèle.** `ownerships[].nature: 'pleine_propriete' | 'usufruit' | 'nue_propriete'`
(+ `dureeAnnees` pour l'usufruit temporaire). Défaut `pleine_propriete` : aucun scénario
existant ne change.

**Règles à sourcer.**
- Valorisation de l'usufruit temporaire : **art. 669-II CGI — 23 % de la pleine propriété
  par période de 10 ans entamée**, sans considération d'âge.
- Usufruit viager par âge : art. 669-I (barème par tranche).
- Cession d'usufruit temporaire par une personne physique : **art. 13, 5° CGI** — le prix est
  imposé au barème dans la catégorie du revenu procuré, **pas** en plus-value. C'est le piège
  qui motive de démembrer les *parts* plutôt que l'immeuble : à modéliser, pas à masquer.
- Amortissement de l'usufruit acquis chez l'usufruitier à l'IS (CE 2019) → alimente
  `CarryOver.amortizations`.
- Répartition du résultat : l'usufruitier perçoit les fruits, le nu-propriétaire le boni de
  liquidation et la plus-value.

**Avertissement obligatoire.** Abus de droit à but principalement fiscal (LPF L. 64 A) et
prix à valider par expert indépendant. L'app affiche, elle ne conseille pas.

**Test de sortie.** Usufruit temporaire 10 ans cédé à une SCI à l'IS : amortissement annuel
= prix / 10, revenus fonciers basculés chez l'usufruitier, extinction au terme.

---

### P6 — Holding animatrice, TVA de holding, IFI

Indépendant de P0 — peut être pris en parallèle.

**Livrable.**
- `EntityNodeData.options.animatrice?: boolean`, avec la liste des preuves attendues
  (convention d'animation, prestations réelles, moyens) affichée comme checklist.
- **TVA de holding** : une holding pure n'ouvre pas droit à déduction ; une holding animatrice
  qui facture ses filiales est assujettie. Remplace le « TVA supposée neutre » actuel des
  management fees par un coefficient de déduction.
- **IFI** : art. 965 à 976 CGI, exonération des biens professionnels et sort des titres de
  holding animatrice.

**Test de sortie.** Le même groupe, animatrice ou non : la TVA déductible de la holding et
l'assiette IFI diffèrent, et la raison est affichée.

---

### P7 — Transmission : donation et pacte Dutreil

**Livrable.** Catégorie `donation` et engagement Dutreil.

**Règles à sourcer.**
- **Art. 787 B** : exonération de **75 %** de la valeur des titres ; engagement collectif
  (2 ans) puis individuel (**6 ans** — vérifié le 2026-09-22 sur la version en vigueur au
  21/02/2026, `LEGIARTI000053542700` ; le plan disait 4 ans, la durée a été allongée) ;
  fonction de direction. Conditions à vérifier, pas à supposer.
- Abattement en ligne directe : **100 000 € par parent et par enfant, renouvelable 15 ans**
  (art. 779 I, art. 784).
- Barème des droits de mutation à titre gratuit (art. 777).
- Donation avec réserve d'usufruit : assiette = valeur de la nue-propriété, art. 669-I → **P5**.
- Articulation avec P4 : la donation des titres reçus en échange purge le report à 6 ans (11 ans).

**Test de sortie.** Transmission d'une holding animatrice avec Dutreil + réserve d'usufruit +
abattement : droits calculés pas à pas, chaque étape traçable à son article.

---

### P8 — Location meublée au réel (LMNP / LMP)

**Livrable.** Type d'entité ou régime portant l'activité meublée au réel.

**Règles à sourcer.**
- Meublé = activité **commerciale** par nature : loger l'activité dans une SCI à l'IR la fait
  basculer à l'IS. Contrôle à ajouter dans `simulationIssues`.
- Amortissement par composants, plafonné par l'art. 39 C II (non créateur de déficit) →
  `CarryOver.amortizations`.
- Frontière LMNP / LMP : art. 155 IV (seuils de recettes et de prépondérance).
- **Réintégration des amortissements dans la plus-value** de cession — vérifier l'état du
  droit en vigueur avant de coder, la règle a bougé récemment.

---

## 4. Socle transverse — non négociable à chaque phase

Reprise de `CONSTRAINTS.md`, qui s'applique déjà et n'est pas rouvert ici :

1. **Aucun taux sans source.** Chaque paramètre introduit passe par `taxRules.ts` avec
   `source` + `asOf` + `status`, vérifié via OpenLegi/BOFiP, jamais de mémoire. `ratesFreshness`
   couvre déjà la péremption.
2. **Aucun appel OpenLegi/BOFiP dans la boucle What-If.** Vérification hors hot path.
3. **100 % des fonctions publiques du moteur testées** (`src/core/engine`).
4. **Chaque règle non modélisée est affichée**, pas tue. Le modèle actuel le fait bien
   (`warnings` de `graphResolver`) — tenir le niveau.
5. `npm run check` vert à chaque fin de phase. E2E Playwright sur les phases qui touchent l'UI.

## 5. Angles morts qui resteront ouverts

À écrire dans l'UI, pas à découvrir après coup.

- Valorisation d'entreprise : l'app ne dit pas ce que valent des titres, elle prend un prix saisi.
- Abus de droit : signalé, jamais arbitré. LPF L. 64 / L. 64 A.
- Conventions fiscales internationales, non-résidents, exit tax (art. 167 bis).
- Droit des sociétés : agrément, préemption, pacte d'associés, clauses statutaires.
- Financement bancaire réel : covenants, caution, hypothèque, nantissement.
- Comptabilité : bénéfice distribuable, réserve légale, décision d'assemblée.
- Prélèvement à la source, acomptes, trésorerie infra-annuelle.

## 6. Estimation

| Phase | Poids | Note |
|---|---|---|
| P0 | ■■■■□ | refonte de `graphResolver` + `forecast` |
| P1 | ■□□□□ | petit, valide P0 |
| P2 | ■■□□□ | échéancier standard |
| P3 | ■■■□□ | nouvelle catégorie + 4 régimes |
| P4 | ■■■□□ | machine à états et délais |
| P5 | ■■■■□ | touche le modèle de détention, donc tout l'aval |
| P6 | ■■□□□ | parallélisable, indépendant |
| P7 | ■■■□□ | dépend de P5 |
| P8 | ■■□□□ | droit en mouvement, à vérifier avant de coder |

**Chemin critique : P0 → P3 → P4.** P6 peut partir en parallèle dès maintenant.
