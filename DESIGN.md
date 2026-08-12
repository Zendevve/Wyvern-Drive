---
name: Wyvern Drive
description: A self-hosted Discord-backed personal cloud drive wearing the Signal Deck split-flap operations world.
colors:
  canvas: "#0A0E10"
  surface-1: "#11181B"
  surface-2: "#1A2428"
  surface-3: "#233036"
  ink: "#F4F1E8"
  ink-muted: "#9BA7A7"
  hairline: "rgba(193,211,205,0.18)"
  hairline-soft: "rgba(193,211,205,0.10)"
  signal: "#D9A441"
  focus-ring: "rgba(217,164,65,0.18)"
  signal-soft: "rgba(217,164,65,0.18)"
  danger-soft: "rgba(229,117,105,0.14)"
  success-soft: "rgba(121,196,154,0.14)"
  success: "#79C49A"
  danger: "#E57569"
  warning: "#D9A441"
  info: "#84B7C4"
  steel: "#8A9795"
typography:
  display-hero:
    fontFamily: "'Mona Sans Variable', 'Inter Variable', sans-serif"
    fontSize: "40px"
    fontWeight: 500
    lineHeight: 1.05
    letterSpacing: "-1.2px"
  display:
    fontFamily: "'Mona Sans Variable', 'Inter Variable', sans-serif"
    fontSize: "28px"
    fontWeight: 500
    lineHeight: 1.15
    letterSpacing: "-0.6px"
  headline:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "20px"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "-0.3px"
  body:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "-0.1px"
  label:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.3
    letterSpacing: "0.02em"
  overline:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "0.08em"
    textTransform: "uppercase"
  mono:
    fontFamily: "ui-monospace, SFMono-Regular, Consolas, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "0.02em"
rounded:
  cell: "6px"
  control: "8px"
  icon-action: "8px"
  panel: "12px"
spacing:
  hair: "1px"
  xxs: "5px"
  xs: "10px"
  sm: "15px"
  md: "20px"
  lg: "30px"
  xl: "40px"
  rail: "240px"
components:
  button-primary:
    backgroundColor: "{colors.signal}"
    textColor: "#1B1408"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-secondary:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    border: "{colors.hairline}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  button-danger:
    backgroundColor: "transparent"
    textColor: "{colors.danger}"
    border: "1px solid {colors.danger}"
    rounded: "{rounded.control}"
    padding: "10px 15px"
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    border: "{colors.hairline}"
    rounded: "{rounded.control}"
    padding: "10px 14px"
  dialog:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "20px"
  entry-table:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink}"
    rowHover: "{colors.surface-1}"
    rowSelected: "{colors.surface-2}"
    rounded: "0"
  entry-grid-tile:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.cell}"
    padding: "10px"
  entry-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "15px"
  quota-readout:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.ink-muted}"
    rounded: "{rounded.cell}"
  transfer-console:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
  drop-zone:
    border: "2px dashed {colors.signal}"
    backgroundColor: "{colors.signal-soft}"
    rounded: "{rounded.panel}"
  empty-state-panel:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.panel}"
    padding: "40px"
---

# Design System: Wyvern Drive

## Overview

**Creative North Star: "Signal Deck" — a split-flap operations board.**

Wyvern Drive is a private file system whose encrypted payloads move through
Discord attachments. The UI is the trustworthy live manifest of that mechanism:
a fixed-grid instrument surface that makes storage state legible — what is
stored, what is moving, what is healthy — for a technical self-hosting operator
at a dim desk.

The category rut refused: the centered SaaS dashboard of equal cards. This
system refuses it by letting the shell, the ruled rows, the state changes, and
the task hierarchy carry the identity instead of uniform card tiles. The
atmosphere is fixed-grid instrument grammar — ruled headers, fixed character
cells, small status lamps, restrained steel inset edges — never decoration laid
over a generic dark card skin.

**Key Characteristics:**
- Matte graphite canvas everywhere; no light mode, no white cards.
- One amber signal (`#D9A441`) for primary actions, selection, focus, and drop
  targets; every other color is semantic, never decorative.
- Local monospace stack reserved for measurement: IDs, sizes, dates, status,
  progress, byte values.
- Rectangular controls (6–12px corners by role) — no pill-button system, no
  circular icon buttons.
- Ruled tables, fixed-cell tiles, and a fixed 240px manifest rail.
- Split-flap state vocabulary: 140–220ms transitions and one-character-style
  flips when state changes; no choreographed page-load sequences.
- Cross-surface story: every route is a named instrument (boot screen, live
  manifest, control room, recovery ledger, guided check-in, transfer manifest).
- Cloud-drive side rail (user-confirmed) and monochrome file-type glyphs
  (folders ink, files ink-muted — the glyph carries the type, never color).

## Colors

The world is matte graphite plus one amber signal. Text is binary: `ink` or
`ink-muted`. No violet, no gradients, no glass.

### Surface & Ink
- **Canvas** (#0A0E10): Page, rail, app-bar, dialog backdrop, table surface.
- **Surface 1** (#11181B): One step up — panels, inputs, tiles, empty-state panel.
- **Surface 2** (#1A2428): Two steps up — selected rows, dialogs, command strip,
  transfer console, secondary controls.
- **Surface 3** (#233036): Elevated detail — raised cells and popovers.
- **Ink** (#F4F1E8): All headline and emphasized type.
- **Ink Muted** (#9BA7A7): Secondary type — meta, breadcrumbs, disabled text,
  file-type glyphs, mono readouts.
- **Steel** (#8A9795): Restrained steel edges and secondary control text.

### Lines
- **Hairline** (rgba(193,211,205,0.18)): Borders, dividers, ruled headers.
- **Hairline Soft** (rgba(193,211,205,0.10)): Table row dividers, subtle edges.

### Signal & Semantic
- **Signal** (#D9A441): The SINGLE primary signal — primary buttons, selection
  markers, focus rings, drop-target rings, active route marker. Also `warning`
  (same amber): the amber warns as well as it acts, because amber is the only
  chromatic voice the system has.
- **Focus Ring** (rgba(217,164,65,0.18)): Focus and selection treatment, `signal-soft`.
- **Success** (#79C49A): Completion only (upload-done, healthy signals).
- **Danger** (#E57569): Destructive actions and error states (`danger-soft`
  rgba(229,117,105,0.14) for destructive hovers).
- **Info** (#84B7C4): Informational states.

### Named Rules
**The One Signal Rule.** Amber is the single primary signal: primary actions,
selection, focus, drop targets. Never a second amber, never amber as a
decorative fill, never a different primary color.
**Semantic Colors Are Not Decorative.** Success, danger, and info mean states.
They never appear as brand accents, background washes, or gradients.
**The No-Gradient Rule.** No gradients anywhere — no full-surface decorative
gradients, no violet family, no glass-everywhere treatment, no neon glow.

## Typography

**Display / Brand:** Mona Sans Variable (`'Mona Sans Variable', sans-serif`).
Page titles, panel titles, boot-screen headline. **Body / UI:** Inter Variable.
**Measurement / data roles:** local mono stack
`ui-monospace, SFMono-Regular, Consolas, monospace` — reserved for IDs, sizes,
dates, status labels, progress readouts, webhook numbers, byte values. NEVER
body copy or buttons.

### Hierarchy
- **Display Hero** (Mona Sans Variable 500, 40px, lh 1.05, -1.2px): Boot-screen
  headline — "Your files, encrypted."
- **Display** (Mona Sans Variable 500, 28px, lh 1.15, -0.6px): Page and panel
  titles, empty-state heading.
- **Headline** (Inter Variable 600, 20px, lh 1.25, -0.3px): Dialog titles,
  section leads.
- **Body** (Inter Variable 400, 15px, lh 1.45, -0.1px): Default body, file
  names, descriptions.
- **Label** (Inter Variable 500, 12px, lh 1.3, 0.02em): Table headers, quota
  readouts, captions.
- **Overline** (Inter Variable 600, 11px, lh 1.2, 0.08em, uppercase): Ruled
  manifest headers — the column-band labels of the instrument.
- **Mono Data** (12px mono, 0.02em): IDs, sizes, dates, status, progress,
  byte values.

### Named Rules
**The Instrument Face Rule.** Display/brand face is Mona Sans Variable and it
never appears on labels, buttons, or body copy. Hierarchy on data is Inter
weight/size plus the mono register — never the display face.
**The Mono Measurement Rule.** Anything that is a measurement or an identity —
sizes, dates, status labels, webhook numbers, byte values, progress readouts —
is set in the mono stack. Text that reads as prose is never mono.

## Layout

- **Spacing base: 5px** (5/10/15/20/30/40). Numeric MUI `sx` spacing values use
  this base — `p: 2` is 10px. Hairlines are 1px.
- **Chrome:** Fixed **240px manifest rail** on canvas with a hairline right
  border — ruled manifest header, grouped nav rows with a signal marker on the
  active route, bottom identity/logout zone. **Route-header band** above the
  page content (AppShell renders the route title). Skip link to `#main-content`.
- **Command deck** (drive toolbar): search spans the primary column; amber
  `Upload` contained action; grouped `Upload folder` / `New folder` secondary
  controls; view-toggle segment (`aria-pressed`); QuotaMeter in a separate
  utility cell.
- **Ruled tables** are the data surface: ruled manifest header, fixed column
  rhythm, mono measurement cells, signal-marked selected row.
- **Breakpoints:**
  - **768px** — rail collapses to an app bar + temporary drawer; table/grid
    collapse to full-width cards with all actions always visible. CONTRACTUAL,
    never moved.
  - **900px** — asymmetric public surfaces (login, share): brand/statement on
    the left, control panel on the right; stacked below.
  - **412px** — narrow rule: the transfer console must never cover the viewport
    edge (`maxWidth: calc(100vw - 16px)`, `left: 8` fallback, safe-area-aware
    bottom padding).

## Shapes

- **Radius by role:** panels 12px · data cells 6px · controls 8px · icon
  actions 8px. Base MUI shape is 8px (the control radius).
- **No pill-button system.** Every button is a rectangle in its radius class;
  icon actions are squares (8px), never circles.
- **Primary action:** amber rectangular control — signal fill, dark text
  (`#1B1408`), `variant="contained"`.
- **Secondary:** graphite — surface-2 fill with a hairline border,
  `variant="outlined"`.
- **Danger:** error variants with `danger-soft` hover.
- **Grammar:** grid lines, ruled headers, fixed character cells, small status
  lamps, and restrained steel inset edges are the physical language.

## Elevation & Depth

Depth is **matte surfaces plus a restrained steel top edge** — never glow,
never ambient bloom.

### Shadow Vocabulary
- **Panel Edge** (`inset 0 1px 0 rgba(193,211,205,0.10), 0 10px 30px
  rgba(0,0,0,0.35)`): Floating panels, menu popovers, hovered tiles.
- **Command Strip** (`inset 0 1px 0 rgba(193,211,205,0.12), 0 16px 40px
  rgba(0,0,0,0.4)`): Selection bar / command strip, transfer console.
- **Dialog** (`inset 0 1px 0 rgba(193,211,205,0.12), 0 24px 64px
  rgba(0,0,0,0.55)`): Dialogs, elevated panels.
- **Focus Ring** (`0 0 0 1px` signal + signal-soft fill): Focused inputs,
  selected cells — no surface change, amber marks it.

### Named Rules
**The Flat-Graphite Rule.** Surfaces are flat, matte graphite at rest. Steel
inset edges and shadows mark floating; nothing glows. If a surface looks lit
from inside, the system is drifting.

## Motion

Motion is **state feedback, not choreography**.

- **Duration:** 140–220ms for cell/row/control state transitions (hover,
  focus, selection, reveal).
- **Split-flap state changes:** one-character-style flips when state changes —
  a status lamp, a count, a byte readout flips; nothing sweeps.
- **Springs:** use the existing spring system in `web/src/motion/springs.js`;
  `DialogTransition` API unchanged. No new motion library.
- **Reduced motion:** honor `prefers-reduced-motion` — state changes become
  opacity-only, no transforms, no flips.
- No page-load choreography, no staggered entrances, no parallax.

## Components

- **Buttons:** Primary = amber rectangle (signal fill, dark text). Secondary =
  graphite rectangle (surface-2, hairline border). Danger = error variants
  (`danger-soft` hover). All 8px corners, 10px/15px padding.
- **Icon actions:** 8px square icon buttons; destructive hover via the shared
  `EntryActions` treatment (error color + `danger-soft` background).
- **Panels / dialogs:** matte panels (12px), ruled headers, 8px controls,
  dialog shadow, hairline borders. Mono for URLs/IDs inside.
- **Entry views:** table = ruled manifest surface (canvas rows, surface-1 hover,
  surface-2 + signal marker selected, keyboard-visible action reveal); grid =
  fixed-cell tiles (icon cell, name, mono metadata, signal border + signal-soft
  selected, action shelf); cards = same cell grammar stacked for touch, all
  actions always visible below 768px.
- **Quota readout:** compact signal readout — mono values, segmented/ruled
  track, exact "X of Y used" copy.
- **Transfer console:** fixed bottom-right console (not a floating card) — ruled
  "Uploads" header with active count, segmented progress, abort/retry/remove,
  safe-area-aware below 412px.
- **Drop zone:** signal amber dashed ring (2px dashed `signal`) with signal-soft
  fill; both active and confirmed phases; pointer-inert.
- **Empty state:** "NO FILES / CHANNEL READY" panel — surface-1, fixed-grid
  atmosphere, amber upload marker, one primary CTA. Exact strings: `Your space
  is ready` / `Your files are encrypted before they're stored — only you can
  see them.` / `Upload your first file`.
- **Breadcrumbs:** clipped/collapsible route trail (ellipsis on long names,
  "My drive" first), `aria-current="page"` on the last crumb.
- **Selection bar:** raised command strip — mono count readout, primary
  download/share, edit actions, explicit danger delete, clear selection.

## Surface Stories

Every route is a named instrument in the same deck:
- **`/login` — boot screen:** asymmetric — brand + security statement left,
  sign-in control panel right; the ready state is the proof, not a centered
  text stack.
- **`/drive` — live file manifest:** command deck, ruled table / fixed-cell
  grid / cards, selection strip, transfer console, drop zone.
- **`/settings` — storage control room:** identity/health band, ruled number
  band (drive stats), connection ledger (webhooks), danger zone (logout).
- **`/trash` — recovery ledger:** ruled entry lines with mono deletion
  metadata, separate restore / delete-forever actions, quiet "no recoveries"
  panel.
- **`/setup` and `/connect` — guided check-in:** ordered spine at desktop,
  single column below 768px; diagnostics as a compact status ledger.
- **`/share/:token` — recipient transfer manifest:** file-type signal tile +
  name/meta on one side, Download action panel on the other (stacked on
  mobile).

The first viewport must show the task and the primary action immediately on
every route.

## Do's and Don'ts

### Do:
- **Do** keep canvas and ink as the two anchor surfaces; every band chooses
  one or the other, with surface-1/2/3 as measured steps.
- **Do** reserve amber for the primary signal — actions, selection, focus,
  drop targets, the active route marker.
- **Do** set measurements and identities (IDs, sizes, dates, status, byte
  values) in the mono register.
- **Do** compose every control as a rectangle in its radius class; keep the
  no-pill, no-circle discipline.
- **Do** mark floating with steel inset edges and the panel-edge shadows; keep
  everything else matte.
- **Do** keep state feedback at 140–220ms with split-flap flips, and honor
  reduced motion with opacity-only changes.

### Don't:
- **Don't** ship a light surface anywhere, or any white pill CTA. The world is
  graphite; the CTA is amber.
- **Don't** introduce gradients, violet, glass, or glow — the fixed-grid
  atmosphere is texture, not illumination.
- **Don't** use semantic colors as decoration: success/danger/info mean states.
- **Don't** reach for a second primary color or a second amber.
- **Don't** set labels or buttons in the display face, or body copy in mono.
- **Don't** color-code file types; the glyph carries the type, folders are ink
  and files are ink-muted.
