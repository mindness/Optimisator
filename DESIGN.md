---
name: Simulateur de Flux d'Entreprise
description: Cabinet en ligne — daylight office tool for French corporate cash-flow simulation
colors:
  canvas: "#f4f6f9"
  surface: "#ffffff"
  surface-sunken: "#f8fafc"
  border: "#e3e8ef"
  border-strong: "#c6cfdb"
  fg: "#111827"
  fg-muted: "#5b6573"
  accent: "#2563eb"
  accent-strong: "#1d4ed8"
  accent-fg: "#ffffff"
  accent-soft: "#e8f0fe"
  focus-ring: "#2563eb"
  positive: "#15803d"
  positive-soft: "#ecfdf3"
  negative: "#b91c1c"
  negative-soft: "#fef2f2"
  flow-cash: "#047857"
  flow-vat: "#0e7490"
  flow-is: "#b45309"
  flow-social: "#4338ca"
  flow-div: "#a16207"
  flow-alert: "#be123c"
  disclaimer-bg: "#fffbeb"
  disclaimer-border: "#fcd34d"
  disclaimer-fg: "#92400e"
  canvas-dark: "#0e1320"
  surface-dark: "#151b2b"
  surface-sunken-dark: "#111725"
  border-dark: "#253044"
  border-strong-dark: "#3b4860"
  fg-dark: "#f1f5f9"
  fg-muted-dark: "#9aa5b8"
  accent-dark: "#5b8def"
  accent-strong-dark: "#7aa3f5"
  accent-fg-dark: "#0b1220"
  accent-soft-dark: "#1b2a4a"
  positive-dark: "#4ade80"
  negative-dark: "#f87171"
  flow-cash-dark: "#34d399"
  flow-vat-dark: "#22d3ee"
  flow-is-dark: "#fbbf24"
  flow-social-dark: "#a5b4fc"
  flow-div-dark: "#facc15"
  flow-alert-dark: "#fb7185"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
  body:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.9375rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "Plus Jakarta Sans, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.5
  amount:
    fontFamily: "JetBrains Mono, ui-monospace, Cascadia Code, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    fontFeature: "tnum"
  amount-hero:
    fontFamily: "JetBrains Mono, ui-monospace, Cascadia Code, monospace"
    fontSize: "1.5rem"
    fontWeight: 600
    fontFeature: "tnum"
rounded:
  sm: "0.375rem"
  md: "0.5rem"
  full: "999px"
spacing:
  xs: "0.25rem"
  sm: "0.5rem"
  md: "0.75rem"
  lg: "1rem"
  xl: "1.25rem"
  2xl: "1.5rem"
components:
  button:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-hover:
    backgroundColor: "{colors.surface-sunken}"
    textColor: "{colors.fg}"
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-fg}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-primary-hover:
    backgroundColor: "{colors.accent-strong}"
    textColor: "{colors.accent-fg}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.md}"
    padding: "0 12px"
    height: "36px"
  button-sm:
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  button-pressed:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.fg}"
  chip:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "32px"
  chip-pressed:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.fg}"
  field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
  kpi-tile:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "12px 14px"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.fg-muted}"
    rounded: "{rounded.md}"
    padding: "0 10px"
    height: "36px"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
  step-no:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent}"
    rounded: "{rounded.full}"
    size: "20px"
  disclaimer:
    backgroundColor: "{colors.disclaimer-bg}"
    textColor: "{colors.disclaimer-fg}"
    rounded: "{rounded.md}"
    padding: "8px 12px"
  entity-node:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.fg}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
---

# Design System: Simulateur de Flux d'Entreprise

## Overview

**Creative North Star: "Cabinet en ligne"**

The simulator is the pro management tool a dirigeant opens every week next to the accountant's own software, in the grammar of Pennylane, Qonto or Indy: a cool gray-white canvas, white cards on a 1px hairline with a whisper shadow, 8px corners, one blue for every action. It is read in daylight. Depth is structural (border + surface vs canvas), never atmospheric; the only saturated colours on a screen are the fiscal roles on the flow diagram and the green/red of an écart against the point de départ.

Density is office-tool compact: 15px body, 36px controls, 12px gutters, a 232px sidebar and a 320px Hypothèses panel around a full-bleed schéma. Every panel opens with a title plus one help sentence, the four numbered steps sit above the KPI row, and each tuile shows the écart (▲▼ + montant) before the value. The dark theme stays an option (`.dark` on `<html>`), tuned as the same system under low light, not a different product.

Confirmed rejections: the neon dark fintech dashboard, purple SaaS gradients, cream + terracotta, stacked multi-shadow cards, marketing chrome.

**Key Characteristics:**
- Light default; cool gray-white canvas, white 1px cards, 1–2px shadow
- One action colour (blue); green/red reserved for deltas vs baseline
- Fiscal role colours (cash / TVA / IS / social / dividendes / alerte) live only on the flow diagram, its node dots and the inspector amount
- Plus Jakarta Sans for UI, JetBrains Mono tabular for every euro
- 8px radius everywhere, 6px on nothing yet, pills only for step numbers and slider thumbs
- Motion follows an action (140ms feedback); no page-load choreography; flux dashes stop under reduced motion

## Colors

A neutral gray-blue scaffold, a single action blue, two delta colours, six role hues that speak only on the schéma; every token switches under `.dark`.

### Primary
- **Action Blue** (`accent`, hover `accent-strong`, on-blue `accent-fg`): the only colour that says "do this": Partager, primary buttons, slider track fill and thumb ring, input caret, links, active nav text, selected node/edge border. It also is the focus ring.
- **Blue Tint** (`accent-soft`): resting fill for pressed/selected chrome (active `nav-item`, `aria-pressed` buttons and chips, step numbers). Never a background for content.

### Secondary
- **Écart Green** (`positive`, tint `positive-soft`) and **Écart Red** (`negative`, tint `negative-soft`): reserved for a delta against the point de départ (KPI ▲▼ line) and for the negative-treasury / flow warning notes. A favourable delta is green whether the number went up or down; `direction="cost"` inverts it.

### Tertiary
- **Flow roles**: `flow-cash` (trésorerie / CA, deep green), `flow-vat` (TVA, teal), `flow-is` (IS / DGFiP, amber-brown), `flow-social` (URSSAF / salaire, indigo), `flow-div` (dividendes / holding / personne, gold), `flow-alert` (CCA, anomalies, rose). They colour edge strokes, the animated flux dash, the amount on an edge label, the 8px dot on an entity node, `MetricBadge` toned amounts and the hero amount in the inspector. Nothing else.
- **Counsel Warning** (`disclaimer-bg` / `disclaimer-border` / `disclaimer-fg`): the permanent legal note in the footer (the Synthèse document carries no extra strip: it shows live simulation figures).

### Neutral
- **Canvas** (`canvas`): app background and React Flow plane.
- **Surface** (`surface`): sidebar, header, footer, cards, buttons, fields, nodes, edge labels.
- **Sunken** (`surface-sunken`): hover fill on buttons and canvas controls, the inspector amount well, the foyer fiscal block.
- **Hairline** (`border`) and **Strong Rule** (`border-strong`): resting and hover borders, panel dividers, scrollbar thumb, node handles.
- **Ink** (`fg`) and **Quiet** (`fg-muted`): text; neutral edge stroke is `fg-muted`.

### Named Rules
**The One Action Colour Rule.** Blue is the only chrome accent. If a control, tab, or link is not blue-tinted it is not interactive-primary; no second accent is ever introduced for chrome.

**The Diagram-Only Roles Rule.** A `flow-*` hue means one fiscal job and appears only on the schéma (edges, dash, label amount, node dot) and the inspector's amount. KPI tiles, buttons, chips and nav never wear a role colour.

**The Écart Colour Rule.** Green and red are spent on comparisons against the point de départ and on funding warnings. They do not mark entity types, categories, or success toasts.

## Typography

**UI Font:** Plus Jakarta Sans (weights 400/500/600/700, Google Fonts) with system-ui fallback
**Amount Font:** JetBrains Mono (400/500/600) with ui-monospace / Cascadia Code fallback

**Character:** a working grotesque for labels and help sentences, a tabular mono so euro columns align under What-If. Amounts are always `formatEuro` (fr-FR, narrow no-break spaces, €) inside `.font-amount`; percentages use `formatPercent`. No display face, no uppercase tracking.

### Hierarchy
- **Headline** (600, 1.125rem, tracking -0.025em): page `h2` in the header (scenario or view name), view titles (Optimisation, Projection, Comparateur), ShareModal title.
- **Title** (600, 0.875rem): `panel-title` for every panel section (Hypothèses, Calques, Traceur), entity node names, app `h1` in the sidebar (tracking-tight). Inspector flow title steps up to 1rem.
- **Body** (400, 0.9375rem, 1.5): base size on `body`; buttons and fields drop to 0.875rem.
- **Label** (500, 0.75rem): KPI labels, `panel-help` sentences (400, leading-relaxed), node subtitles, chips, `btn-sm`, nav section headings (600, 0.6875rem "Piloter", "Documents"), step help.
- **Amount** (500, 0.875rem, tnum): `MetricBadge`, node metrics, edge labels (0.75rem), KPI écart line (0.75rem).
- **Amount hero** (600, 1.125rem KPI value; 1.5rem inspector "Montant du flux"): the two places a figure is read first.

### Named Rules
**The Tabular Money Rule.** Every euro and percentage goes through `formatEuro` / `formatPercent` and sits in `.font-amount`. Sans digits never carry money.

**The Title + Help Rule.** Every panel section opens with a `panel-title` and one `panel-help` sentence. No eyebrow, no kicker, no uppercase label above a title.

## Layout

Desktop (`lg` ≥ 64rem) is a fixed-height two-column shell: a 232px sidebar (brand tile 32px blue square + name, "Piloter" nav, "Documents" nav (Synthèse: printable summary table + model limits, chrome hidden via `print:hidden`), theme toggle pinned at the bottom) and a main column of header → content → footer disclaimer. The Simulation view stacks, with 12px gaps and 16px page padding: the 1→4 step guide (inline help at `xl` ≥ 80rem, a disclosure below), a 6-tile KPI grid (2 / 3 / 6 columns at base / `sm` / `xl`), then the schéma card plus TimelineBar on the left and a 320px right card holding Hypothèses → Calques → Traceur → Limites, separated by hairlines with 20px gaps. Selecting a flow swaps the right card's content for the FlowInspector (slides in 12px); nothing overlays the canvas.

Below `lg` the sidebar becomes a top strip whose nav scrolls horizontally with a fading right edge, the main column scrolls, and the right panel stacks under the timeline at full width. Padding drops to 12px.

Spacing rhythm is 4/8/12/16/20/24px: 4px inside tiles, 8px between a label and its control, 12px between cards, 16px card padding, 20px between panel sections, 24px only inside the share dialog.

## Elevation & Depth

Hybrid, structural first. Every raised surface (card, button, field, KPI, node, edge label) is white on the gray canvas with a 1px hairline and the whisper `shadow-card`; that pairing is the whole vocabulary at rest. Hover raises nothing: it darkens the border to `border-strong` or fills with `surface-sunken`. Selection is a blue border plus a 2px 25% blue ring. The only floating shadow is the ShareModal dialog.

### Shadow Vocabulary
- **Card** (`box-shadow: 0 1px 2px rgb(16 24 40 / 0.05)`; dark `0 1px 2px rgb(0 0 0 / 0.4)`): all resting cards, buttons, fields, KPI tiles, React Flow controls, slider thumb.
- **Float** (`box-shadow: 0 12px 32px -8px rgb(16 24 40 / 0.18), 0 2px 6px rgb(16 24 40 / 0.06)`): the share dialog only.

### Named Rules
**The Hairline Depth Rule.** Hierarchy is 1px `border` + `surface` on `canvas`. A shadow beyond `shadow-card` means the element floats above the workspace (dialog), and nothing else earns it.

**The No Nested Card Rule.** Panels never nest cards. Inside a card, sub-blocks use `surface-sunken` fill or a `border-t` hairline, not another bordered card.

## Shapes

Gently rounded, 8px (`rounded-md`) on every rectangle: cards, buttons, fields, nodes, edge labels, KPI tiles, nav items, warning notes, the brand tile, React Flow controls. Pills (999px) are reserved for the step-number badge (20px circle), the 8px node dot, the slider track and its 20px thumb. Borders are always 1px; the selected node adds a 2px ring rather than a thicker stroke. Edges are cubic beziers 1.75px at rest and 2.75px when selected or traced, with a round-capped 9/23 dash gliding over them. No square corners, no `rounded-2xl`, no clipped or angled silhouettes.

## Components

### Buttons
- **Shape:** 8px radius, 36px tall, 12px horizontal padding, 0.875rem/500, inline icon 16px at 6px gap.
- **Default (`btn`):** white on hairline with `shadow-card`; hover fills `surface-sunken` and darkens the border. Used for Importer / Exporter, timeline transport, workspace actions.
- **Primary (`btn-primary`):** blue fill, white text, blue border; hover `accent-strong`. One per header (Partager) or one per panel (Appliquer).
- **Ghost (`btn-ghost`):** transparent, muted text, no shadow; hover 6% ink wash and full ink text. Used for Réinitialiser, "Retour aux hypothèses", dialog close.
- **Small (`btn-sm`):** 32px, 10px padding, 0.75rem.
- **Pressed:** `aria-pressed="true"` gives `accent-soft` fill and a 45% blue border (timeline transport, layer toggles).
- **Focus:** global 2px `focus-ring` outline at 2px offset. **Disabled:** 45% opacity, not-allowed cursor.

### Chips
- **Style:** 32px, 8px radius, hairline, white, muted 0.75rem/500 text; hover darkens border and text.
- **State:** `aria-pressed="true"` = `accent-soft` fill, blue-mixed border, ink text. Timeline step chips (numbered) and LayerSwitcher toggles; the last active layer cannot be turned off.

### Cards / Containers
- **Corner Style:** 8px.
- **Background:** `surface` on `canvas`.
- **Shadow Strategy:** `shadow-card` (see Elevation).
- **Border:** 1px `border`.
- **Internal Padding:** 16px for panels; KPI 12px × 14px; node 10px × 12px; edge label 4px × 8px.
- **KPI tile (`kpi`):** label (0.75rem muted) → écart line (mono 0.75rem, ▲ or ▼ chevron 12px, green/red/muted, "inchangé" when flat) → value (mono 1.125rem/600). Écart before value, always.

### Inputs / Fields
- **Style:** `field` = 36px, 8px radius, hairline, white, `shadow-card`, 0.875rem; `field-sm` 32px/0.75rem. Selects strip native chrome and paint a 12px muted chevron at right 0.6rem.
- **Hover:** border to `border-strong`. **Focus:** global blue outline; caret is blue.
- **Range sliders:** 4px pill track in `border`, blue fill up to `--fill`, 20px white thumb with a 2px blue ring and `shadow-card`; label left, mono value right, 8px gap to the track.
- **Error:** inline note `negative-soft` fill + `negative` 0.75rem text with `role="alert"`, 8px radius, no border.

### Navigation
- **Sidebar nav (`nav-item`):** 36px, 8px radius, 10px padding, 16px stroke icon at 10px gap, 0.875rem/500 muted; hover 5% ink wash; active (`aria-pressed`) `accent-soft` fill with blue text. Section headings are 0.6875rem/600 muted sentence-case. Theme toggle is a `nav-item` at the bottom. Below `lg` the same items form a horizontally scrolling strip with a masked right edge.
- **Page header:** headline `h2` + one-line muted help; right cluster = preset select (`field`), Importer / Exporter (`btn`), Partager (`btn-primary`).
- **Step guide:** `<details class="disclosure steps-guide">`: four `step-no` circles with bold label and (at `xl`) inline help; below `xl` a "Comment ça marche ?" disclosure listing the help.

### Signature — Entity node
White card 184–240px wide with a left/right 10px handle, an 8px role-coloured dot beside the 0.875rem/600 name and 0.75rem muted type, then a hairline-separated list of `MetricBadge` lines. Selected: blue border + 25% blue 2px ring. The role colour never fills or frames the node.

### Signature — Flow edge and label
Bezier stroke in the role colour (1.75px, 85% opacity; 2.75px, 100% when selected or traced; traced adds a 3px cash-green drop glow). A round-capped 9/23 dash animates source→target, cycle 0.6–2.4s shortened by `log10(amount)`, hidden under reduced motion. The label is a `card` button: muted 0.75rem name, role-coloured mono amount, optional "dont x % d'impôt" line; hover darkens border, selected turns it blue.

### Signature — FlowInspector
Replaces the right panel content: ghost "Retour aux hypothèses" button, 1rem/600 title, muted route line "Source → Cible · périodicité", then a `surface-sunken` well with the 1.5rem/600 role-coloured amount, an optional red warning note, StepBreakdown and LegalReference. Arrives with a 220ms 12px slide.

### Signature — DisclaimerBanner
`role="note"` in Counsel Warning tokens (amber-cream fill, amber border, brown text, 0.875rem). In the footer it drops its border and fill and runs as a single 0.75rem line across the main column; never dismissible.

### ShareModal
Backdrop fade 160ms, dialog 240ms rise; `max-w-md` card with `shadow-float`, 20px padding, headline title, ghost close, mono URL.

### Motion
All chrome transitions colour/border/shadow over 140ms `cubic-bezier(0.16, 1, 0.3, 1)`; disclosures animate `::details-content` height/opacity with the same duration. Every animation follows a user action (inspector, dialog, tracer confirm); nothing plays on load. `prefers-reduced-motion` zeroes the feedback duration, removes the arrivals, and hides the flux dash.

## Do's and Don'ts

### Do:
- **Do** keep light as the default and build every surface as `surface` + 1px `border` + `shadow-card` on `canvas`, 8px radius.
- **Do** route every euro through `formatEuro` inside `.font-amount`, and show the écart (▲▼ + montant, green/red) before the value on any KPI.
- **Do** use blue (`accent` / `accent-soft`) for the one primary action, pressed state and selection; use `btn` / `btn-ghost` for everything else.
- **Do** open every panel section with `panel-title` + `panel-help`, and number sequential guidance with `step-no`.
- **Do** keep role colours on the schéma: edge stroke, dash, label amount, node dot, inspector amount.

### Don't:
- **Don't** apply a `flow-*` hue to buttons, chips, KPI tiles, nav or page chrome.
- **Don't** spend green/red on anything other than a delta vs point de départ or a funding warning.
- **Don't** stack shadows, nest cards, or use `shadow-float` outside a dialog.
- **Don't** use uppercase tracked labels, eyebrows or kickers above titles; a muted sentence-case help line is the house device.
- **Don't** use Inter, Roboto, Arial or a system display face; don't set money in the sans.
- **Don't** add page-load choreography or animate anything that did not follow an action.
