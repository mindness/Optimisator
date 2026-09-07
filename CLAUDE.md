<!-- AgentForge pool orchestrator — begin -->
# AgentForge pool

At the start of any non-trivial task — before invoking any skill, and before
settling on an approach — call `mcp__agentforge-pool__pool_search` with a short
query describing the task, and read the ranked candidates.

Use the fully-qualified tool names: `mcp__agentforge-pool__pool_search`,
`mcp__agentforge-pool__pool_get`, `mcp__agentforge-pool__pool_create`,
`mcp__agentforge-pool__team_compose`, `mcp__agentforge-pool__team_get`,
`mcp__agentforge-pool__skill_find`, `mcp__agentforge-pool__skill_pull`,
`mcp__agentforge-pool__mcp_find`, `mcp__agentforge-pool__api_find`,
`mcp__agentforge-pool__topic_find`. In harnesses that defer MCP tool schemas
(Claude Code), a tool may not appear in your available tools until you load
it with `ToolSearch` using a query such as
`select:mcp__agentforge-pool__pool_search`. Do that first, then call it. Not
seeing the tool listed is never evidence that the server is down.

This is a retrieval step, not a competing skill. Pool entries and installed
skills are both candidates: consulting the pool never replaces invoking the
process skill a task calls for, and invoking a skill never excuses skipping the
pool. When both apply, the pool search runs first, then the skill.

- A relevant hit → `mcp__agentforge-pool__pool_get` its `id` and apply the
  content as an inline skill/rule/agent for the rest of the task.
- Miss or weak match → `mcp__agentforge-pool__skill_find`, then
  `mcp__agentforge-pool__skill_pull` for a specific candidate if needed.
  Pulls count against the project pull budget; on a budget error, stop pulling
  and compose with local entries instead.
- Integrations (MCP servers or public APIs) → `mcp__agentforge-pool__mcp_find`
  / `mcp__agentforge-pool__api_find` before inventing a client or stack.
  An `agent` entry carrying `suggested_mcp_servers`, or an `mcp_find` hit →
  mention the suggestion. Never register the server yourself; that is the
  user's decision.
- Topic orientation (“what resources exist on X?”) →
  `mcp__agentforge-pool__topic_find` (sindresorhus/awesome meta-index). One hop
  only: use the list to choose a registry or the web; never import awesome
  lists into the pool.
- Nothing relevant after find/pull, and the task needs guidance that future
  tasks would reuse → author the entry and `mcp__agentforge-pool__pool_create`
  it so the gap is filled next time.
- Never bulk `curate_scan` (or `npm run curate`) as part of a normal feature
  task. That path is maintenance-only, not the default way to fill the pool.
- Choosing, installing or using a library, framework or external API → verify
  current versions and practices against a live source (Context7, official
  docs, web search) before deciding. Never rely on trained knowledge for
  anything version- or API-shape-sensitive. This holds whatever the search
  returned.
- The server counts as unavailable only when the call itself fails after the
  tool was loaded. Then carry on without pool content: a missing pool never
  stops a task and is never something to ask the user to fix mid-task.
- Skip entirely for trivial requests: clarifying questions, simple lookups.

## Design-spec team gate (mandatory)

When brainstorming / designing a feature that will produce a design spec
(`docs/superpowers/specs/…`) or an implementation plan:

1. After the user approves the design direction, and **before writing the
   design-doc file**, call `mcp__agentforge-pool__team_compose` with the goal
   (and optional domains).
2. Paste the returned `specSectionMarkdown` into the spec as
   `## AgentForge team` (or equivalent). Do not invent ids — use the composed set.
3. `pool_get` design-relevant entries while writing the spec.
4. Do **not** start `writing-plans` / SDD until `team_compose` has succeeded and
   the spec contains that section. If unsure, call `team_get`.
5. In the implementation plan, map tasks to team entry ids (refine roles; do not
   silently drop the team).
<!-- AgentForge pool orchestrator — end -->
