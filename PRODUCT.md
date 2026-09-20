# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

delegated: React 19 + Vite 8 + TypeScript + Tailwind CSS v4 + Vitest (existing scaffold; versions verified via Context7 / npm). API locale optionnelle : Hono + Cloudflare Wrangler/D1.

## Users

- **Utilisateur principal** : créateur ou dirigeant qui construit son montage (SASU, EURL, SARL, holding, SCI, micro) from scratch, compare les régimes et prépare un rendez-vous conseil.
- **Usage** : site statique public, sans compte ni base de données ; les schémas vivent dans le navigateur, dans l'URL de partage et dans des fichiers `.optimisator.json` exportés.

## Product Purpose

Simulateur visuel de flux d'entreprise (France) : canvas Money Flow pour voir d'où vient l'argent, où il transite, et ce qui reste net d'impôts et de charges (IS, TVA, URSSAF, dividendes, SCI).

Succès MVP = pouvoir jouer localement des arbitrages (rémunération vs dividendes, holding vs direct, SCI) via calques, timeline et What-If — sans se faire passer pour un avis d'expert.

## Positioning

Mécanisme différenciant : **flux animés sémantiquement colorés** sur un graphe d'entités juridiques, recalculés localement en temps réel, avec provenance fiscale figée (`source` + `asOf`) — pas un schéma PowerPoint figé ni un ERP.

## Operating Context

- **Déploiement** : site statique (build Vite) ; aucune donnée utilisateur côté serveur. L'API Wrangler/D1 de `backend/` reste optionnelle (liens courts) et n'est pas requise.
- Usage typique : écran bureau, lecture intensive de montants → contraste élevé, thème sombre par défaut, bascule claire disponible.
- Partage URL / API courte : disponible en local pour tests ; **pas** positionné comme offre SaaS publique pour l’instant.

## Capabilities and Constraints

- Simulation pédagogique uniquement — **≠ conseil fiscal / juridique / financier**.
- Moteur fiscal TypeScript côté client ; taux sourcés (Légifrance / BOFiP) figés hors boucle What-If (PFU modèle 2026 : IR 12,8 % + PS 18,6 % = 31,4 %).
- **Périmètre** : simulation annuelle par entité ; conventions intra-groupe documentées et sourcées ; taux fiscaux et sociaux sourcés Légifrance / BOFiP avec statut (`verified` / `assumed`).
- Hors scope MVP : auth multi-tenant, facturation, deploy Cloudflare public, import liasse/OCR, remplacement ERP.
- Terminologie : SASU, holding, SCI, CCA, mère-fille, PFU / Flat Tax, URSSAF, IS, TVA.

## Brand Commitments

- Nom produit : **Simulateur de Flux d'Entreprise** (espace Hermes `p5456d76d`).
- Voix : précise, pédagogique, sobre — chiffres avant slogans.
- Direction visuelle binding : Fintech / LegalTech premium (voir `DESIGN.md`) — pas de cliché SaaS violet / Inter.

## Evidence on Hand

- Spec : `docs/superpowers/specs/2026-09-06-simulateur-flux-design.md`
- Plan : `docs/superpowers/plans/2026-09-06-simulateur-flux.md`
- Master prompt : `prompt.md`
- Moteur / règles : `src/core/engine/` (calculs + `taxRules.ts`)
- Lancement local : `README.md`

Ne pas inventer de témoignages clients, tarifs SaaS, certifications ou claims de disponibilité publique.

## Product Principles

1. **Lisibilité monétaire** — montants FR tabulaires, contrastes finance AAA-cible.
2. **Sémantique des flux** — une couleur = un rôle fiscal (cash, TVA, IS, social, dividendes, alerte).
3. **Transparence légale** — chaque taux a une provenance ; disclaimer permanent.
4. **Simulation, pas prescription** — l'outil explique ; l'humain décide.
5. **Perf interactive** — What-If / timeline à 60 fps local.

## Accessibility & Inclusion

WCAG 2.1 AA minimum ; cible AAA pour textes et montants financiers. Contrôles clavier, focus visible, `lang="fr"`. Couleur jamais seule porteuse de sens (labels + tokens).
