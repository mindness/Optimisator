---
name: Simulateur de Flux d'Entreprise
description: Ledger night desk — Operate tool for French corporate cash-flow simulation
colors:
  canvas: "#0B0F17"
  surface: "#111827"
  border: "#1F2937"
  border-strong: "#374151"
  fg: "#F8FAFC"
  fg-muted: "#94A3B8"
  focus-ring: "#06B6D4"
  flow-cash: "#10B981"
  flow-vat: "#06B6D4"
  flow-is: "#F59E0B"
  flow-social: "#6366F1"
  flow-div: "#EAB308"
  flow-alert: "#F43F5E"
  disclaimer-bg: "#1C1917"
  disclaimer-border: "#78350F"
  disclaimer-fg: "#FDBA74"
  canvas-light: "#F8FAFC"
  surface-light: "#FFFFFF"
  border-light: "#E2E8F0"
  fg-light: "#0F172A"
typography:
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
  amount:
    fontFamily: "JetBrains Mono, ui-monospace, Cascadia Code, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    fontFeature: "tnum"
rounded:
  none: "0px"
  sm: "0.25rem"
  md: "0.5rem"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.5rem"
components:
  button-chrome:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "0 12px"
    height: "44px"
  button-chrome-hover:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
  metric-badge:
    backgroundColor: "transparent"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "2px 8px"
  disclaimer:
    backgroundColor: "{colors.disclaimer-bg}"
    textColor: "{colors.disclaimer-fg}"
    rounded: "{rounded.none}"
    padding: "8px 12px"
  entity-node:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.none}"
    padding: "10px 12px"
---

# Design System: Simulateur de Flux d'Entreprise

## Overview

**Creative North Star: "Ledger night desk"**

Back-office ledger under cool desk light: a dark, dense Operate surface where money is the hero. Depth comes from 1px hairlines and semantic flow color — not purple SaaS gradients or stacked card chrome. Light mode is cold slate mist (`#F8FAFC`), never cream terracotta.

Tone for the **MVP perso local**: quiet instrument, not a marketed SaaS. No growth chrome, no empty-state hype — just presets, canvas, sliders, and a permanent legal note. Scan amounts fast; trust fiscal roles by color; stay humble.

**Key Characteristics:**
- Semantic flow palette (cash / TVA / IS / social / dividends / alert)
- Plus Jakarta Sans + JetBrains Mono tabular amounts
- Flat chrome, 1px borders, near-zero radius
- Dark default; `.dark` class toggle on `<html>`
- Particles respect `prefers-reduced-motion`
- Solo desk tool: header + rail + canvas + inspector, nothing more

## Colors

Semantic finance palette: neutrals for structure, saturated flow roles for meaning. Frontmatter values are the **dark** defaults (canonical desk scene). Light counterparts live as `*-light` tokens and CSS `:root` overrides.

### Primary
- **Vault Emerald** (`#10B981` / light `#059669`): Trésorerie / CA — primary positive cash voice (`flow-cash`).
- **Ledger Cyan** (`#06B6D4` / light `#0891B2`): TVA + focus rings (`flow-vat`, `focus-ring`).

### Secondary
- **Fiscal Amber** (`#F59E0B` / light `#D97706`): IS / tax authority (`flow-is`).
- **URSSAF Indigo** (`#6366F1` / light `#4F46E5`): Social role only — never full-UI purple theme (`flow-social`).
- **Dividend Gold** (`#EAB308` / light `#CA8A04`): Net / dividends / holding accent (`flow-div`).

### Tertiary
- **Debtor Rose** (`#F43F5E` / light `#E11D48`): Dettes, CCA, anomalies (`flow-alert`).
- **Counsel Warning** (bg `#1C1917`, border `#78350F`, fg `#FDBA74`): Permanent disclaimer strip (light: `#FFF7ED` / `#FDBA74` / `#9A3412`).

### Neutral
- **Night Canvas** (`#0B0F17` / light `#F8FAFC`): App background / dotted flow plane.
- **Desk Surface** (`#111827` / light `#FFFFFF`): Nodes, rails, header, inspector.
- **Hairline** (`#1F2937` / light `#E2E8F0`) and **Strong Rule** (`#374151` / light `#CBD5E1`): Borders.
- **Paper Ink** (`#F8FAFC` / light `#0F172A`) and **Quiet Label** (`#94A3B8` / light `#64748B`): Text.

### Named Rules
**The Role Color Rule.** A flow hue means one fiscal job. Never retheme the whole chrome in indigo/violet.

**The No Cream Rule.** Light backgrounds stay cold slate; never `#F4F1EA` + terracotta.

## Typography

**Display/Body Font:** Plus Jakarta Sans (system-ui fallback)  
**Amount Font:** JetBrains Mono (Cascadia Code / ui-monospace fallback)

**Character:** Precise LegalTech — UI sans for structure; mono only for money so columns align under What-If.

### Hierarchy
- **Title** (600, 1.25rem, tight tracking): App `h1`, inspector headers.
- **Body** (400, 1rem, 1.5): Controls, disclaimer, prose.
- **Label** (500, 0.75rem, wide tracking, uppercase): MetricBadge labels, node subtitles, layer chips.
- **Amount** (500, ~0.875rem, `tabular-nums` / `tnum`): All euros via `.font-amount` + `formatEuro` (fr-FR, NBSP + €).

### Named Rules
**The Tabular Money Rule.** Every euro uses JetBrains Mono + tabular nums. Inter/Arial never carry identity or amounts.

## Layout

Operate shell: full-height `bg-canvas` column — header (title + preset + share/theme) → main grid (sidebar controls | canvas + timeline + summary metrics | inspector on `lg+`) → disclaimer. Density is compact; padding steps `0.25–1.5rem`. Canvas is the primary plane; controls stay a narrow rail. Responsive: inspector stacks below on small screens; desktop meeting screens preferred (PRODUCT).

## Elevation & Depth

**Flat-by-default.** No multi-layer shadows on chrome. React Flow controls: `box-shadow: none`. Entity nodes may use a whisper `shadow-sm` only as a resting edge against the dotted canvas — not a card stack. Selection uses `ring-focus-ring`, not drop shadow.

### Named Rules
**The Hairline Depth Rule.** Hierarchy = 1px borders + surface vs canvas, not elevation theatre.

## Shapes

Near-rectilinear: radius `0` on chrome buttons/controls/minimap; optional `0.25–0.5rem` only when hierarchy needs a soft inset. Borders are always 1px (nodes use `border-2` for semantic color weight). No `rounded-2xl` / pill clusters.

## Components

### Buttons
- **Shape:** Square corners (`0`), min height 44px for primary chrome.
- **Chrome (ThemeToggle / Share):** `bg-surface`, `border-border`, hover `border-border-strong`.
- **Focus:** Global `:focus-visible` 2px `focus-ring` + 2px offset.

### Chips / MetricBadge
- Inline flex, 1px `border-border`, uppercase muted label + toned `.font-amount`.
- Tone maps to `flow-*` text colors (cash/vat/is/social/div/alert/neutral).

### Cards / Containers
- **Entity nodes:** `bg-surface`, semantic `border-2` by entity type, selection ring.
- **Panels:** Flat; no nested card-in-card.

### Inputs / Fields
- What-If sliders and layer toggles: native controls on surface, pressed state via `aria-pressed` / border emphasis — restrained, not playful.

### Navigation
- App header is the only top nav: title + muted subtitle + action cluster. No marketing eyebrow.

### Signature — Money Flow edge
- Bezier `BaseEdge` + amount label button; stroke from category → flow tone; SVG particles speed ∝ `log10(amount)`; hidden under reduced motion; selected/trace = thicker glow via `flow-*`.

### Signature — DisclaimerBanner
- Permanent `role="note"` strip with Counsel Warning tokens; never dismissible in MVP.

### TimelineBar
- Surface rail under canvas: Prev / Play|Pause / Next + step chips + progress bar (`role="progressbar"`).
- Transport buttons: `bg-canvas`, 1px border, compact padding (not full 44px — secondary density; primary chrome stays 44px).
- Active step: `aria-current` + stronger border / cash or vat accent sparingly.

### What-If rail + LayerSwitcher + MoneyTracer
- Sidebar stack: uppercase section labels, muted; sliders with live `MetricBadge` readout.
- Layer chips: `aria-pressed`; last active layer cannot turn off (empty canvas guard).
- Money Tracer: inject amount → highlight path on edges (`traceHighlight`); instrument feel, not gamification.

### FlowInspector
- Right column (`lg+`) or bottom sheet: uppercase “Inspecteur”, flow title, close chrome button.
- Body: MetricBadge amount, StepBreakdown lines, LegalReference articles + alert badges (CCA / acte anormal).
- No modal overlay — stays docked so the canvas remains visible.

### ShareModal
- Dialog for local share tests (hash + optional short API link). Same square chrome buttons; mono for URLs.
- Failure → hash fallback message; never marketing “invite your team” copy.

## Do's and Don'ts

### Do:
- **Do** keep dark as the default desk scene and map every euro through `formatEuro` + `.font-amount`.
- **Do** encode fiscal meaning in `flow-*` colors and pair with text labels.
- **Do** keep borders at 1px and motion limited to flow particles / short opacity.

### Don't:
- **Don't** use Inter, Roboto, or Arial as brand UI fonts.
- **Don't** purple-wash the product UI or use cream+terracotta Anthropic-default looks.
- **Don't** stack multi-shadow cards, emoji icon systems, or eyebrow kickers above titles.
- **Don't** invent SaaS marketing chrome — this is an Operate MVP perso local.
