# Contexte & Équipe Projet — Simulateur Visuel de Flux d'Entreprise

## Learned User Preferences

- Always use Context7 to verify up-to-date versions, APIs, and compatibility before choosing libraries or adding dependencies. **Note:** Context7 MCP is currently broken in this environment — fall back to built-in knowledge when calls fail.
- Search the AgentForge pool (`mcp__agentforge-pool__pool_search`) at the start of any non-trivial task before invoking brainstorming or implementation skills.
- Use the Impeccable design plugin and conventions for UI styling and frontend design. Always read the full Impeccable SKILL.md before running any Impeccable command; `serve-question`/`concept-seed` fail on this Windows host — use static `.tsx` previews under `src/previews/` as fallback.
- Leverage OpenLegi MCP for exact legal and tax sourcing: Légifrance (`openlegi-legifrance`) and BOFiP (`openlegi-bofip`). Quota: **500 calls / month** — cache results in `src/core/legal/` / `taxRules.ts` (`source` + `asOf`); never call OpenLegi from the runtime What-If loop; batch verification once before freezing rates.
- Compose/validate the AgentForge team before locking any implementation plan; prefer multi-agent dispatch via the orchestrator (`orchestration-patterns` / `cto-advisor`).
- Target MVP perso (local, personal) quality for now — not SaaS/prod scale. Do not raise multi-tenant auth or billing unless the user explicitly asks to switch target.

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

- Workspace is for the "Simulateur visuel de flux d'entreprise (SASU / holding / SCI)" project — personal local MVP. Spec: `prompt.md`; architecture: `docs/superpowers/specs/2026-09-06-simulateur-flux-design.md`; plan: `docs/superpowers/plans/2026-09-06-simulateur-flux.md`.
- Tax constants in `taxRules.ts` must carry provenance (`source`, `asOf`, `status`) and be verified via OpenLegi/BOFiP before freeze.
- Upstream project concepts and Kanban tasks are hosted on a remote Hermes VPS accessible via `ssh hermes`.
- On this Windows host, PowerShell `npm`/`npx` may be wrapped by Safety CLI (`pkgs.safetycli.com`) and return 401. Use `"C:\Program Files\nodejs\npm.cmd"` / `npx.cmd` (or unset the Safety shim) for installs and Vitest.
- Tech stack: Vite 8 + React 19 + TypeScript + Vitest; Tailwind v4 (`@tailwindcss/vite`); `@xyflow/react`, Zustand, Zod.
- Design documents at root: `PRODUCT.md`, `DESIGN.md`, `CONSTRAINTS.md`; design tokens in `globals.css`.
- Design North Star: "Ledger night desk" — dark dense Operate mode (`#0B0F17`), semantic flow colors (cash/IS/URSSAF), Plus Jakarta + JetBrains Mono, flat hairlines, no purple SaaS chrome.
- Impeccable `serve-question` and `concept-seed` scripts fail on this Windows host (temp `.json` write issues). Generate static `.tsx` preview components under `src/previews/` as visual alternatives instead.
