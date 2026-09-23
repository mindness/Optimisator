# Mesure 60 fps (What-If / Timeline)

Cible produit ([CONSTRAINTS.md](../CONSTRAINTS.md)) : curseurs What-If et lecture timeline à **~60 fps** sans bloquer le main thread (moteur dans `src/core/engine/`, UI dans `src/components/`).

## Procédure Chrome DevTools

1. Lancer SPA + API (voir [README.md](../README.md)).
2. Ouvrir http://localhost:5173 → DevTools → **Performance**.
3. Cocher *Screenshots* ; démarrer l’enregistrement.
4. Scénarios à rejouer (~5–10 s chacun) :
   - **What-If** : déplacer le curseur CA en continu.
   - **Timeline** : Play sur les 6 étapes.
   - **Money Tracer** : injecter un montant puis balayer le canvas.
5. Arrêter l’enregistrement ; vérifier :
   - FPS proche de 60 (bandeau FPS / frames).
   - Pas de longues tâches jaunes/rouges (>50 ms) pendant le drag.
   - Avec `prefers-reduced-motion: reduce`, les particules d’arêtes sont absentes (CSS + gate JS).

## Résultat MVP (2026-09-07, complété 2026-09-16)

| Scénario | Statut |
|---|---|
| Procédure documentée | Done |
| Mesure instrumentée enregistrée (trace .json) | Non — à faire manuellement avant claim « 60 fps verified » |
| Architecture découplée engine ↔ canvas | Done (revue T5–T8) |
| Build + tests après MR !4 | Done (2026-09-16) — `tsc -b && vite build` OK, tests front 106 / back 6 |

Tant qu’aucune trace DevTools n’est jointe, la contrainte 60 fps reste **cible / non mesurée**, pas une régression connue.
