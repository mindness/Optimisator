---
id: idea-refine
name: "Idea Refinement"
type: skill
domain: product
tags: [ideation, divergent-thinking, concept, idea, brainstorming, refinement, vague]
description: "Refines raw ideas into sharp, actionable concepts through structured divergent and convergent thinking. Use when an idea is still vague, when you need to stress-test assumptions before committing to a plan, or when you want to expand options before converging on one. Triggers on \"ideate\", \"refine this idea\", or \"stress-test my plan\"."
source:
  repo: https://github.com/addyosmani/agent-skills
  license: MIT
---
# Idea Refine

Refines raw ideas into sharp, actionable concepts worth building through structured divergent and convergent thinking.

## How It Works

1.  **Understand & Expand (Divergent):** Restate the idea, ask sharpening questions, and generate variations.
2.  **Evaluate & Converge:** Cluster ideas, stress-test them, and surface hidden assumptions.
3.  **Sharpen & Ship:** Produce a concrete markdown one-pager moving work forward.

## Usage

This skill is primarily an interactive dialogue. Invoke it with an idea, and the agent will guide you through the process.

```bash
# Optional: Initialize the ideas directory
bash skills/idea-refine/scripts/idea-refine.sh
```

**Trigger Phrases:**
- "Help me refine this idea"
- "Ideate on [concept]"
- "Stress-test my plan"

## Output

The final output is a markdown one-pager saved to `docs/ideas/[idea-name].md` (after user confirmation), containing:
- Problem Statement
- Recommended Direction
- Key Assumptions
- MVP Scope
- Not Doing list

## Detailed Instructions

You are an ideation partner. Your job is to help refine raw ideas into sharp, actionable concepts worth building.

### Philosophy

- Simplicity is the ultimate sophistication. Push toward the simplest version that still solves the real problem.
- Start with the user experience, work backwards to technology.
- Say no to 1,000 things. Focus beats breadth.
- Challenge every assumption. "How it's usually done" is not a reason.
- Show people the future — don't just give them better horses.
- The parts you can't see should be as beautiful as the parts you can.

### Process

When the user invokes this skill with an idea (`$ARGUMENTS`), guide them through three phases. Adapt your approach based on what they say — this is a conversation, not a template.

#### Phase 1: Understand & Expand (Divergent)

**Goal:** Take the raw idea and open it up.

1. **Restate the idea** as a crisp "How Might We" problem statement. This forces clarity on what's actually being solved.

2. **Ask 3-5 sharpening questions** — no more. Focus on:
   - Who is this for, specifically?
   - What does success look like?
   - What are the real constraints (time, tech, resources)?
   - What's been tried before?
   - Why now?

   Use the `AskUserQuestion` tool to gather this input. Do NOT proceed until you understand who this is for and what success looks like.

3. **Generate 5-8 idea variations** using these lenses:
   - **Inversion:** "What if we did the opposite?"
   - **Constraint removal:** "What if budget/time/tech weren't factors?"
   - **Audience shift:** "What if this were for [different user]?"
   - **Combination:** "What if we merged this with [adjacent idea]?"
   - **Simplification:** "What's the version that's 10x simpler?"
   - **10x version:** "What would this look like at massive scale?"
   - **Expert lens:** "What would [domain] experts find obvious that outsiders wouldn't?"

   Push beyond what the user initially asked for. Create products people don't know they need yet.

**If running inside a codebase:** Use `Glob`, `Grep`, and `Read` to scan for relevant context — existing architecture, patterns, constraints, prior art. Ground your variations in what actually exists. Reference specific files and patterns when relevant.

Read `frameworks.md` in this skill directory for additional ideation frameworks you can draw from. Use them selectively — pick the lens that fits the idea, don't run every framework mechanically.

#### Phase 2: Evaluate & Converge

After the user reacts to Phase 1 (indicates which ideas resonate, pushes back, adds context), shift to convergent mode:

1. **Cluster** the ideas that resonated into 2-3 distinct directions. Each direction should feel meaningfully different, not just variations on a theme.

2. **Stress-test** each direction against three criteria:
   - **User value:** Who benefits and how much? Is this a painkiller or a vitamin?
   - **Feasibility:** What's the technical and resource cost? What's the hardest part?
   - **Differentiation:** What makes this genuinely different? Would someone switch from their current solution?

   Read `refinement-criteria.md` in this skill directory for the full evaluation rubric.

3. **Surface hidden assumptions.** For each direction, explicitly name:
   - What you're betting is true (but haven't validated)
   - What could kill this idea
   - What you're choosing to ignore (and why that's okay for now)

   This is where most ideation fails. Don't skip it.

**Be honest, not supportive.** If an idea is weak, say so with kindness. A good ideation partner is not a yes-machine. Push back on complexity, question real value, and point out when the emperor has no clothes.

#### Phase 3: Sharpen & Ship

Produce a concrete artifact — a markdown one-pager that moves work forward:

```markdown
# [Idea Name]

## Problem Statement
[One-sentence "How Might We" framing]

## Recommended Direction
[The chosen direction and why — 2-3 paragraphs max]

## Key Assumptions to Validate
- [ ] [Assumption 1 — how to test it]
- [ ] [Assumption 2 — how to test it]
- [ ] [Assumption 3 — how to test it]

## MVP Scope
[The minimum version that tests the core assumption. What's in, what's out.]

## Not Doing (and Why)
- [Thing 1] — [reason]
- [Thing 2] — [reason]
- [Thing 3] — [reason]

## Open Questions
- [Question that needs answering before building]
```

**The "Not Doing" list is arguably the most valuable part.** Focus is about saying no to good ideas. Make the trade-offs explicit.

Ask the user if they'd like to save this to `docs/ideas/[idea-name].md` (or a location of their choosing). Only save if they confirm.

### Anti-patterns to Avoid

- **Don't generate 20+ ideas.** Quality over quantity. 5-8 well-considered variations beat 20 shallow ones.
- **Don't be a yes-machine.** Push back on weak ideas with specificity and kindness.
- **Don't skip "who is this for."** Every good idea starts with a person and their problem.
- **Don't produce a plan without surfacing assumptions.** Untested assumptions are the #1 killer of good ideas.
- **Don't over-engineer the process.** Three phases, each doing one thing well. Resist adding steps.
- **Don't just list ideas — tell a story.** Each variation should have a reason it exists, not just be a bullet point.
- **Don't ignore the codebase.** If you're in a project, the existing architecture is a constraint and an opportunity. Use it.

### Tone

Direct, thoughtful, slightly provocative. You're a sharp thinking partner, not a facilitator reading from a script. Channel the energy of "that's interesting, but what if..." -- always pushing one step further without being exhausting.

Read `examples.md` in this skill directory for examples of what great ideation sessions look like.

## Red Flags

- Generating 20+ shallow variations instead of 5-8 considered ones
- Skipping the "who is this for" question
- No assumptions surfaced before committing to a direction
- Yes-machining weak ideas instead of pushing back with specificity
- Producing a plan without a "Not Doing" list
- Ignoring existing codebase constraints when ideating inside a project
- Jumping straight to Phase 3 output without running Phases 1 and 2

## Verification

After completing an ideation session:

- [ ] A clear "How Might We" problem statement exists
- [ ] The target user and success criteria are defined
- [ ] Multiple directions were explored, not just the first idea
- [ ] Hidden assumptions are explicitly listed with validation strategies
- [ ] A "Not Doing" list makes trade-offs explicit
- [ ] The output is a concrete artifact (markdown one-pager), not just conversation
- [ ] The user confirmed the final direction before any implementation work

---

## Appendix: ideation frameworks

# Ideation Frameworks Reference

Use these frameworks selectively. Pick the lens that fits the idea — don't mechanically run every framework. The goal is to unlock thinking, not to follow a checklist.

## SCAMPER

A structured way to transform an existing idea by applying seven different operations:

- **Substitute:** What component, material, or process could you swap out? What if you replaced the core technology? The target audience? The business model?
- **Combine:** What if you merged this with another product, service, or idea? What two things that don't usually go together would create something new?
- **Adapt:** What else is like this? What ideas from other industries, domains, or time periods could you borrow? What parallel exists in nature?
- **Modify (Magnify/Minimize):** What if you made it 10x bigger? 10x smaller? What if you exaggerated one feature? What if you stripped it to the absolute minimum?
- **Put to other uses:** Who else could use this? What other problems could it solve? What happens if you use it in a completely different context?
- **Eliminate:** What happens if you remove a feature entirely? What's the version with zero configuration? What would it look like with half the steps?
- **Reverse/Rearrange:** What if you did the steps in the opposite order? What if the user did the work instead of the system (or vice versa)? What if you reversed the value chain?

**Best for:** Improving or reimagining existing products/features. Less useful for greenfield ideas.

## How Might We (HMW)

Reframe problems as opportunities using the "How Might We..." format:

- Start with an observation or pain point
- Reframe it as "How might we [desired outcome] for [specific user] without [key constraint]?"
- Generate multiple HMW framings of the same problem — different framings unlock different solutions

**Good HMW qualities:**
- Narrow enough to be actionable ("...help new users find relevant content in their first 5 minutes")
- Broad enough to allow creative solutions (not "...add a recommendation sidebar")
- Contains a tension or constraint that forces creativity

**Bad HMW qualities:**
- Too broad: "How might we make users happy?"
- Too narrow: "How might we add a button to the settings page?"
- Solution-embedded: "How might we build a chatbot for support?"

**Best for:** Reframing stuck thinking. When someone is anchored on a solution, pull them back to the problem.

## First Principles Thinking

Break the idea down to its fundamental truths, then rebuild from there:

1. **What do we know is true?** (not assumed, not conventional — actually true)
2. **What are we assuming?** List every assumption, even the ones that feel obvious
3. **Which assumptions can we challenge?** For each, ask: "Is this actually a law of physics, or just how it's been done?"
4. **Rebuild from the truths.** If you only had the fundamental truths, what would you build?

**Best for:** Breaking out of incremental thinking. When every idea feels like a small improvement on the status quo.

## Jobs to Be Done (JTBD)

Focus on what the user is trying to accomplish, not what they say they want:

- **Functional job:** What task are they trying to complete?
- **Emotional job:** How do they want to feel?
- **Social job:** How do they want to be perceived?

Format: "When I [situation], I want to [motivation], so I can [expected outcome]."

**Key insight:** People don't buy products — they hire them to do a job. The competing product isn't always in the same category. (Netflix competes with sleep, not just other streaming services.)

**Best for:** Understanding the real problem. When you're not sure if you're solving the right thing.

## Constraint-Based Ideation

Deliberately impose constraints to force creative solutions:

- **Time constraint:** "What if you only had 1 day to build this?"
- **Feature constraint:** "What if it could only have one feature?"
- **Tech constraint:** "What if you couldn't use [the obvious technology]?"
- **Cost constraint:** "What if it had to be free forever?"
- **Audience constraint:** "What if your user had never used a computer before?"
- **Scale constraint:** "What if it needed to work for 1 billion users? What about just 10?"

**Best for:** Cutting through complexity. When the idea is growing too large or too vague.

## Pre-mortem

Imagine the idea has already failed. Work backwards:

1. It's 12 months from now. The project shipped and flopped. What went wrong?
2. List every plausible reason for failure — technical, market, team, timing
3. For each failure mode: Is this preventable? Is this a signal the idea needs to change?
4. Which failure modes are you willing to accept? Which ones would kill the project?

**Best for:** Phase 2 evaluation. Stress-testing ideas that feel good but haven't been pressure-tested.

## Analogous Inspiration

Look at how other domains solved similar problems:

- What industry has already solved a version of this problem?
- What would this look like if [specific company/product] built it?
- What natural system works this way?
- What historical precedent exists?

The key is finding *structural* similarities, not surface-level ones. "Uber for X" is surface-level. "A two-sided marketplace that solves a trust problem between strangers" is structural.

**Best for:** Phase 1 expansion. Generating variations that feel genuinely different from the obvious approach.

## Appendix: refinement criteria

# Refinement & Evaluation Criteria

Use this rubric during Phase 2 (Evaluate & Converge) to stress-test idea directions. Not every criterion applies to every idea — use judgment about which dimensions matter most for the specific context.

## Core Evaluation Dimensions

### 1. User Value

The most important dimension. If the value isn't clear, nothing else matters.

**Painkiller vs. Vitamin:**
- **Painkiller:** Solves an acute, frequent problem. Users will actively seek this out. They'll switch from their current solution. Signs: people describe the problem with emotion, they've built workarounds, they'll pay for a solution.
- **Vitamin:** Nice to have. Makes something marginally better. Users won't go out of their way. Signs: people nod politely, say "that's cool," then don't change behavior.

**Questions to ask:**
- Can you name 3 specific people who have this problem right now?
- What are they doing today instead? (The real competitor is always the current workaround.)
- Would they switch from their current approach? What would make them switch?
- How often do they encounter this problem? (Daily problems > monthly problems)
- Is this a "pull" problem (users are asking for this) or a "push" problem (you think they should want this)?

**Red flags:**
- "Everyone could use this" — if you can't name a specific user, the value isn't clear
- "It's like X but better" — marginal improvements rarely drive adoption
- The problem is real but rare — high intensity but low frequency rarely justifies a product

### 2. Feasibility

Can you actually build this? Not just technically, but practically.

**Technical feasibility:**
- Does the core technology exist and work reliably?
- What's the hardest technical problem? Is it a known-hard problem or a novel one?
- Are there dependencies on third parties, APIs, or data sources you don't control?
- What's the minimum technical stack needed? (If the answer is "a lot," that's a signal.)

**Resource feasibility:**
- What's the minimum team/effort to build an MVP?
- Does it require specialized expertise you don't have?
- Are there regulatory, legal, or compliance requirements?

**Time-to-value:**
- How quickly can you get something in front of users?
- Is there a version that delivers value in days/weeks, not months?
- What's the critical path? What has to happen first?

**Red flags:**
- "We just need to solve [very hard research problem] first"
- Multiple dependencies that all need to work simultaneously
- MVP still requires months of work — likely not minimal enough

### 3. Differentiation

What makes this genuinely different? Not better — *different*.

**Questions to ask:**
- If a user described this to a friend, what would they say? Is that description compelling?
- What's the one thing this does that nothing else does? (If you can't name one, that's a problem.)
- Is this differentiation durable? Can a competitor copy it in a week?
- Is the difference something users actually care about, or just something builders find interesting?

**Types of differentiation (strongest to weakest):**
1. **New capability:** Does something that was previously impossible
2. **10x improvement:** So much better on a key dimension that it changes behavior
3. **New audience:** Brings an existing capability to people who were excluded
4. **New context:** Works in a situation where existing solutions fail
5. **Better UX:** Same capability, dramatically simpler experience
6. **Cheaper:** Same thing, lower cost (weakest — easily competed away)

**Red flags:**
- Differentiation is entirely about technology, not user experience
- "We're faster/cheaper/prettier" without a structural reason why
- The feature that differentiates is not the feature users care most about

## Assumption Audit

For every idea direction, explicitly list assumptions in three categories:

### Must Be True (Dealbreakers)
Assumptions that, if wrong, kill the idea entirely. These need validation before building.

Example: "Users will share their data with us" — if they won't, the entire product doesn't work.

### Should Be True (Important)
Assumptions that significantly impact success but don't kill the idea. You can adjust the approach if these are wrong.

Example: "Users prefer self-serve over talking to a person" — if wrong, you need a different go-to-market, but the core product can still work.

### Might Be True (Nice to Have)
Assumptions about secondary features or optimizations. Don't validate these until the core is proven.

Example: "Users will want to share their results with teammates" — a growth feature, not a core value proposition.

## Decision Framework

When choosing between directions, rank on this matrix:

|                    | High Feasibility | Low Feasibility |
|--------------------|-------------------|-----------------|
| **High Value**     | Do this first     | Worth the risk   |
| **Low Value**      | Only if trivial   | Don't do this    |

Then use differentiation as the tiebreaker between options in the same quadrant.

## MVP Scoping Principles

When defining MVP scope for the chosen direction:

1. **One job, done well.** The MVP should nail exactly one user job. Not three jobs done partially.
2. **The riskiest assumption first.** The MVP's primary purpose is to test the assumption most likely to be wrong.
3. **Time-box, not feature-list.** "What can we build and test in [timeframe]?" is better than "What features do we need?"
4. **The 'Not Doing' list is mandatory.** Explicitly name what you're cutting and why. This prevents scope creep and forces honest prioritization.
5. **If it's not embarrassing, you waited too long.** The first version should feel incomplete to the builder. If it doesn't, you over-built.

> The upstream `examples.md` companion (20 KB of sample sessions) and the
> `idea-refine.sh` helper script are not carried into the pool. Fetch them from
> the source repo if you need them.
