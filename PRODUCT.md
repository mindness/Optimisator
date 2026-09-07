# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React 19 + Vite 8 + TypeScript + Tailwind CSS v4 + Vitest (existing scaffold; versions verified via Context7 / npm).

## Users

- **Entrepreneur / dirigeant / freelance** : visualiser et valider une structuration SASU / holding / SCI avant ou après un RDV conseil.
- **Associés / fondateurs** : aligner conventions de trésorerie, détention et distributions sur un support chiffré partagé.
- **Préparation cabinet** : arriver avec un scénario pédagogique clair (pas un conseil fiscal certifié).

## Product Purpose

Simulateur visuel de flux d'entreprise (France) : canvas Money Flow pour voir d'où vient l'argent, où il transite, et ce qui reste net d'impôts et de charges (IS, TVA, URSSAF, dividendes, SCI).

Succès = compréhension immédiate des arbitrages (rémunération vs dividendes, holding vs direct, SCI) via calques, timeline et What-If à 60 fps — sans se faire passer pour un avis d'expert.

## Positioning

Mécanisme différenciant : **flux animés sémantiquement colorés** sur un graphe d'entités juridiques, recalculés localement en temps réel, avec provenance fiscale figée (`source` + `asOf`) — pas un schéma PowerPoint figé ni un ERP.

## Operating Context

- Usage bureau / réunion (écran large privilégié ; responsive secondaire).
- Scène : éclairage mixte, lecture intensive de montants → contraste élevé, thème sombre par défaut, bascule claire disponible.
- Sorties : scénarios partageables (URL / API) pour préparation RDV.

## Capabilities and Constraints

- Simulation pédagogique uniquement — **≠ conseil fiscal / juridique / financier**.
- Moteur fiscal TypeScript isomorphe côté client ; taux sourcés (Légifrance / BOFiP) figés hors boucle What-If.
- V1 : pas d'auth multi-tenant, pas d'import liasse/OCR, pas de remplacement ERP.
- Terminologie : SASU, holding, SCI, CCA, mère-fille, Flat Tax, URSSAF, IS, TVA.

## Brand Commitments

- Nom produit : **Simulateur de Flux d'Entreprise** (espace Hermes `p5456d76d`).
- Voix : précise, pédagogique, sobre — chiffres avant slogans.
- Direction visuelle : Fintech / LegalTech premium (voir `DESIGN.md`) — pas de cliché SaaS violet / Inter.

## Evidence on Hand

- Spec : `docs/superpowers/specs/2026-09-06-simulateur-flux-design.md`
- Plan : `docs/superpowers/plans/2026-09-06-simulateur-flux.md`
- Master prompt : `prompt.md`
- Moteur / règles : `src/core/engine/` (calculs + `taxRules.ts`)

Ne pas inventer de témoignages clients, tarifs SaaS ou certifications non documentées.

## Product Principles

1. **Lisibilité monétaire** — montants FR tabulaires, contrastes finance AAA-cible.
2. **Sémantique des flux** — une couleur = un rôle fiscal (cash, TVA, IS, social, dividendes, alerte).
3. **Transparence légale** — chaque taux a une provenance ; disclaimer permanent.
4. **Simulation, pas prescription** — l'outil explique ; l'humain décide.
5. **Perf interactive** — What-If / timeline à 60 fps local.

## Accessibility & Inclusion

WCAG 2.1 AA minimum ; cible AAA pour textes et montants financiers. Contrôles clavier, focus visible, `lang="fr"`. Couleur jamais seule porteuse de sens (labels + tokens).
