# Constraints — Simulateur de Flux

Barre qualité (`constraint-driven-development`). Toute livraison qui viole une contrainte ci-dessous n'est pas Done.

## Fiscalité & légal

- [ ] Aucun taux fiscal sans `source` + `asOf` (+ `status`) dans `taxRules.ts`.
- [ ] Pas d'appel OpenLegi / BOFiP dans la boucle runtime What-If — batch de vérification hors hot path uniquement.
- [ ] Disclaimer permanent : simulation ≠ conseil fiscal / juridique / financier.
- [ ] Montants affichés en format FR (espace insécable + `€`).

## Tests & typage

- [ ] Couverture Vitest du moteur fiscal = **100 % des fonctions publiques** (`src/core/engine`).
- [ ] Pas de `@ts-ignore` / `eslint-disable` sans ticket lié.
- [ ] Tests composants sous `src/**/__tests__/**/*.test.tsx` (jsdom) ; moteur en `node`.

## Performance

- [ ] What-If / Timeline : cible **60 fps** (mesure DevTools Performance).
- [ ] Particules désactivées si `prefers-reduced-motion: reduce`.

## Accessibilité & UI

- [ ] Contrastes **WCAG AA** minimum ; **AAA** cible pour textes et montants finance.
- [ ] Focus visible sur tous les contrôles ; cibles tactiles ≥ 44×44 px mobile.
- [ ] Couleur jamais seule porteuse de sens (labels + rôles sémantiques).
- [ ] Standard Impeccable : pas de cliché violet/Inter/cream-terracotta ; bordures 1px ; `tabular-nums` sur montants.

## Stack

- [ ] Versions librairies vérifiées (Context7 / docs officielles) avant ajout de dépendance.
- [ ] Sur Windows : installer via `"C:\Program Files\nodejs\npm.cmd"` (éviter le shim Safety CLI).
