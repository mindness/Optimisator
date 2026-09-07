# AgentForge

Ce projet est câblé avec AgentForge (`forge init`). Le pool n’est **pas**
copié ici : l’assistant charge uniquement ce dont la tâche a besoin.

## Commandes (dans ce dossier)

```bash
forge ui          # control plane → http://127.0.0.1:4317
forge update      # rafraîchir rule / CLAUDE.md / ce fichier depuis le clone AgentForge
forge init --force   # idem, avec options explicites (--pack, --no-claude, …)
```

| Page UI | Contenu |
|---|---|
| Runs | Runs live, DAG, gates, approve / retry / cancel |
| Pool | Entrées indexées + provenance |
| Team | Dernière équipe composée (`team_compose` → `.agentforge/team.json`) |
| Discover | Candidats A, rejets, derniers finds, budget de pull |

L’UI lit `.agentforge/runs`, `.agentforge/curate` et `.agentforge/team.json`
**de ce projet** (cwd). Localhost uniquement — ne pas exposer hors machine.

## Gate équipe (spec obligatoire)

Avant d’écrire une design spec / un plan d’implémentation, l’agent doit appeler
`team_compose`, coller la section `## AgentForge team` dans la spec, puis
seulement enchaîner sur `writing-plans`. Voir aussi `team_get` / l’onglet Team.

## Prérequis (une fois par machine)

1. Build + MCP enregistré (Cursor Settings → MCP, ou `claude mcp add --scope user …`)
2. `cd …/agentFork/mcp-server && npm run build && npm link` pour exposer `forge`

Sans la rule Cursor / le bloc `CLAUDE.md`, le MCP tourne mais n’est jamais consulté.

## Usage agent

Tâche réelle → `pool_search` → `pool_get` (hit) ou `skill_find` / `skill_pull` (miss).
Design / spec → `team_compose` (obligatoire) puis `pool_get` des entrées retenues.
Jamais de `curate_scan` bulk dans une tâche normale.
