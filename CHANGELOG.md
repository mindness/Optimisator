# Changelog

Format [Keep a Changelog](https://keepachangelog.com/fr/1.1.0/), versions [SemVer](https://semver.org/lang/fr/).

## [Non publié]

### Ajouté
- **Exercices chaînés** : `resolveScenarioGraph` prend un état d'ouverture et rend un état de clôture (`CarryOver`) ; `forecastScenario` enchaîne les exercices au lieu de les répéter. Trésorerie, comptes courants, déficits, emprunts, amortissements et reports d'imposition se transmettent d'un exercice à l'autre.
- **Report déficitaire** (CGI art. 209, I) : imputation plafonnée à 1 M€ + 50 % de la fraction au-delà ; déficit foncier imputé sur le revenu global dans la limite de 10 700 € (art. 156, I-3°).
- **Emprunt réel** : capital restant dû, taux, durée, amortissable ou in fine ; partage capital / intérêts calculé par échéance, seuls les intérêts étant déductibles.
- **Cession de titres** (`share_sale`) : PFU ou barème pour une personne physique, abattement fixe dirigeant retraite (art. 150-0 D ter), abattements pour durée de détention réservés aux titres acquis avant 2018 et à l'option barème ; régime des titres de participation avec quote-part de 12 % pour un cédant à l'IS (art. 219, I-a quinquies).
- **Apport-cession** (`share_contribution`) : report d'imposition suivi dans le temps, obligation de remploi de 70 % sous 3 ans, conservation 5 ans, déchéance avec intérêt de retard (art. 1727), purge par donation à 6 ans (11 ans via fonds). L'immobilier patrimonial est refusé comme remploi éligible.
- **Démembrement** : une détention porte une nature (pleine propriété, usufruit, nue-propriété), une durée et un prix ; valorisation art. 669, amortissement de l'usufruit temporaire chez l'usufruitier à l'IS, fruits attribués à l'usufruitier.
- **Holding animatrice, TVA de holding, IFI** : statut revendiqué avec sa checklist de preuves, coefficient de déduction de TVA nul pour une holding pure, assiette et barème IFI (art. 964 à 977) avec exonération des biens professionnels.
- **Transmission** (`donation`) : droits de mutation en ligne directe (art. 777), abattement de 100 000 € renouvelable 15 ans, exonération Dutreil de 75 % (engagement individuel porté à 6 ans), donation avec réserve d'usufruit.
- **Location meublée au réel** : amortissement plafonné au loyer diminué des autres charges (art. 39 C, II) avec report de l'excédent, frontière LMNP / LMP (art. 155, IV), bascule à l'IS signalée pour une SCI à l'IR.
- Axe des exercices dans la Projection, distinct de la timeline intra-annuelle ; colonnes déficit reporté et dette restante.

### Ajouté — lot 2026 (règles vérifiées sur Légifrance le 22/09/2026)
- **Contribution différentielle sur les hauts revenus** (CGI art. 224, revenus 2026) : imposition minimale de 20 % au-delà de 250 000 € de revenu de référence (500 000 € en couple), lissage jusqu'à 330 000 / 660 000 €, abattements de 1 500 € par personne à charge et 12 500 € pour un couple.
- **Taxe sur les actifs non professionnels des holdings patrimoniales** (CGI art. 235 ter C, exercices clos ≥ 31/12/2026) : 20 % sur les actifs somptuaires et les logements de jouissance, sous trois conditions cumulatives (actifs ≥ 5 M€, personne physique détenant ≥ 50 %, revenus passifs > 50 % des produits), dettes d'acquisition déduites.
- **Amendement Charasse** (CGI art. 223 B, al. 6) : réintégration des charges financières d'un rachat à soi-même dans un groupe intégré, au prorata du prix sur les dettes du groupe, pendant neuf exercices.
- **PER** (CGI art. 163 quatervicies) : déduction du revenu global plafonnée à 10 % des revenus d'activité retenus dans la limite de huit PASS, avec report du plafond inutilisé sur cinq ans.
- **Mécénat d'entreprise** (CGI art. 238 bis) : réduction d'impôt de 60 % jusqu'à 2 M€ puis 40 %, plafond de 20 000 € ou 5 ‰ du CA, excédent reporté cinq exercices, versements non déductibles du bénéfice.
- **Plus-value immobilière des particuliers** (CGI art. 150 U à 150 VH, 200 B, 1609 nonies G) : exonération de résidence principale et des cessions ≤ 15 000 €, frais et travaux au forfait, abattements distincts pour l'impôt sur le revenu (22 ans) et les prélèvements sociaux (30 ans), surtaxe au-delà de 50 000 €, et **réintégration des amortissements de location meublée** au prix d'acquisition (art. 150 VB, III).

### Corrigé
- **Exercice écourté** : le plafond de 42 500 € du taux réduit d'IS est proratisé sur la durée de l'exercice et le chiffre d'affaires annualisé pour le test des 10 M€ (CGI art. 219, I-b, « par période de douze mois »). Un premier exercice de création était jusque-là imposé en totalité à 15 %. Durée saisissable dans l'atelier ; seul le premier exercice d'une projection peut être écourté.

### Modifié
- Timeline : septième étape « Patrimoine » pour les cessions, apports et donations.

## [0.1.0] - 2026-09-21

### Ajouté
- Refonte UI « Cabinet en ligne » : montants éditables sur le canvas, tuiles KPI avec écart, lexique, synthèse.
- Pages légales `/legal` (mentions, CGU, confidentialité) et date de vérification des barèmes en pied de page.
- En-têtes de sécurité (`public/_headers`, CSP sans script inline).
- Suivi d'erreurs Sentry et audience Plausible, optionnels, sans fuite du scénario (hash d'URL retiré).
- Test E2E Playwright sur le build de prod ; CI étendue au backend et à l'E2E.
- Garde-fou de fraîcheur des barèmes (400 jours).
