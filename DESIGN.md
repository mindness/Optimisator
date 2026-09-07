# Design System — Simulateur de Flux

<!-- impeccable:design-schema 1 -->

## Mode

**Operate** — outil de simulation fiscalo-juridique. Scanabilité, contraste, affordances natives ; l'identité vit dans la précision typographique et la sémantique des couleurs de flux.

## Visual world

**Ledger night desk** — surface sombre type terminal de back-office + grille dots, accents emerald/cyan/amber (pas violet SaaS). Clair = brume froide `#F8FAFC`, jamais crème terracotta.

## Color strategy

**Full palette sémantique** (rôles de flux) sur neutres high-contrast. Dark par défaut (scène bureau) ; light via `ThemeToggle` (classe `.dark` sur `<html>`).

### Surfaces

| Token | Dark | Light |
|---|---|---|
| `--canvas` | `#0B0F17` | `#F8FAFC` |
| `--surface` | `#111827` | `#FFFFFF` |
| `--border` | `#1F2937` | `#E2E8F0` |
| `--border-strong` | `#374151` | `#CBD5E1` |
| `--fg` | `#F8FAFC` | `#0F172A` |
| `--fg-muted` | `#94A3B8` | `#64748B` |

### Flux (sémantique)

| Rôle | Dark | Light | Utilitaire |
|---|---|---|---|
| Trésorerie / CA | `#10B981` | `#059669` | `flow-cash` |
| TVA | `#06B6D4` | `#0891B2` | `flow-vat` |
| IS | `#F59E0B` | `#D97706` | `flow-is` |
| Social / URSSAF | `#6366F1` | `#4F46E5` | `flow-social` |
| Dividendes / net | `#EAB308` | `#CA8A04` | `flow-div` |
| Dettes / alertes | `#F43F5E` | `#E11D48` | `flow-alert` |

Source d'autorité : `prompt.md` §3.1 / spec design §4.2.

## Typography

| Rôle | Police | Notes |
|---|---|---|
| UI | **Plus Jakarta Sans** | Spec produit — pas Inter/Arial |
| Montants | **JetBrains Mono** | `tabular-nums` + `font-variant-numeric: tabular-nums` |
| Format FR | `124 500 €` | espaces insécables + symbole € |

## Layout & chrome

- Bordures **1px** nettes ; pas d'ombres empilées ni de cards-in-cards.
- Radius discret (`0.25rem`–`0.5rem`) — hiérarchie, pas `rounded-2xl` partout.
- Atomes communs : `MetricBadge`, `DisclaimerBanner`, `ThemeToggle` — pas de dashboard clutter.

## Motion

Réservé aux particules de flux (vélocité ∝ montant) ; respect `prefers-reduced-motion`. UI chrome : transitions courtes opacity/couleur uniquement.

## Anti-patterns (hard ban)

- Purple-on-white / dégradés indigo-magenta génériques
- Inter / Roboto / Arial comme police d'identité
- Cream `#F4F1EA` + terracotta
- Eyebrows / kickers au-dessus des titres
- Emoji comme système d'icônes

## Implementation

Tokens et thèmes : `src/styles/globals.css` (Tailwind CSS **v4**, `@theme` + variables `:root` / `.dark`). Plugin Vite `@tailwindcss/vite` — pas de `tailwind.config.js` PostCSS v3.
