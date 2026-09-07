# Contexte & Équipe Projet — Simulateur Visuel de Flux d'Entreprise

## Learned User Preferences

- Always use Context7 to verify up-to-date versions, APIs, and compatibility before choosing libraries or adding dependencies.
- Search the AgentForge pool (`mcp__agentforge-pool__pool_search`) at the start of any non-trivial task before invoking brainstorming or implementation skills.
- Use the Impeccable design plugin and conventions for UI styling and frontend design.
- Leverage OpenLegi MCP for exact legal and tax sourcing: Légifrance (`openlegi-legifrance`) and BOFiP (`openlegi-bofip`). Quota: **500 calls / month** — cache results in `src/core/legal/` / `taxRules.ts` (`source` + `asOf`); never call OpenLegi from the runtime What-If loop; batch verification once before freezing rates.

## Équipe AgentForge Composée (`team_compose` → simulateur-flux)

Orchestrateur : `orchestration-patterns`

| Lane | Entries |
|---|---|
| **domain** | `tax-lawyer-fr`, `finance-expert`, `solution-architect`, `cto-advisor` |
| **build** | `git-workflow-and-versioning`, `frontend-ui-engineering`, `browser-testing-with-devtools` |
| **design** | `context-engineering` |
| **review** | `testing-patterns`, `web-performance-auditor`, `accessibility-checklist` |

MCP suggérés (enregistrement utilisateur) : openlegi-legifrance, openlegi-bofip, datagouv / data-gouv-fr, recherche-entreprises.

## Learned Workspace Facts

- Workspace is for the "Simulateur visuel de flux d'entreprise (SASU / holding / SCI)" project, with specifications in `prompt.md`, architecture design in `docs/superpowers/specs/2026-09-06-simulateur-flux-design.md`, and plan in `docs/superpowers/plans/2026-09-06-simulateur-flux.md`.
- Tax constants in `taxRules.ts` must carry provenance (`source`, `asOf`, `status`) and be verified via OpenLegi/BOFiP before freeze.
- Upstream project concepts and Kanban tasks are hosted on a remote Hermes VPS accessible via `ssh hermes`.
- On this Windows host, PowerShell `npm`/`npx` may be wrapped by Safety CLI (`pkgs.safetycli.com`) and return 401. Use `"C:\Program Files\nodejs\npm.cmd"` / `npx.cmd` (or unset the Safety shim) for installs and Vitest.
