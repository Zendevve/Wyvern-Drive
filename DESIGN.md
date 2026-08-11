---
name: Wyvern Drive
description: A self-hosted Discord-backed personal cloud drive wearing Framer's dark-canvas world.
colors:
  canvas: "#0E0E10"
  surface-1: "#1A1A1D"
  surface-2: "#242428"
  ink: "#FFFFFF"
  ink-muted: "#999999"
  accent-blue: "#0099FF"
  focus-ring: "rgba(0,153,255,0.15)"
  hairline: "rgba(255,255,255,0.08)"
  hairline-soft: "rgba(255,255,255,0.06)"
  success: "#3AC36F"
  danger: "#FF5C5C"
  warning: "#F5A524"
  violet-base: "#7C3AED"
  magenta-base: "#DB2777"
  orange-base: "#F97316"
  coral-base: "#FB7185"
typography:
  display:
    fontFamily: "'Mona Sans Variable', 'Inter Variable', sans-serif"
    fontSize: "32px"
    fontWeight: 500
    lineHeight: 1.13
    letterSpacing: "-1.0px"
  display-hero:
    fontFamily: "'Mona Sans Variable', 'Inter Variable', sans-serif"
    fontSize: "62px"
    fontWeight: 500
    lineHeight: 1.0
    letterSpacing: "-3.1px"
  headline:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.8px"
  body:
    fontFamily: "'Inter Variable', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.3
    letterSpacing: "-0.15px"
    fontFeature: "'cv01' 1, 'cv05' 1, 'cv09' 1, 'cv11' 1, 'ss03' 1, 'ss07' 1, 'dlig' 1"
  body-sm:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "14px"
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: "-0.14px"
  label:
    fontFamily: "'Inter Variable', sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "-0.13px"
rounded:
  xs: "4px"
  sm: "6px"
  md: "10px"
  lg: "15px"
  xl: "20px"
  xxl: "30px"
  pill: "100px"
  full: "9999px"
spacing:
  hair: "1px"
  xxs: "4px"
  xs: "8px"
  sm: "12px"
  md: "15px"
  lg: "20px"
  xl: "30px"
  xxl: "40px"
  section: "96px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.canvas}"
    rounded: "{rounded.pill}"
    padding: "10px 15px"
  button-secondary:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 15px"
  button-danger:
    backgroundColor: "{colors.danger}"
    textColor: "#1A0A0A"
    rounded: "{rounded.pill}"
    padding: "10px 15px"
  button-translucent:
    backgroundColor: "rgba(255,255,255,0.14)"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "10px 15px"
  text-input:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "10px 14px"
  dialog:
    backgroundColor: "{colors.surface-2}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "24px"
  entry-card:
    backgroundColor: "{colors.surface-1}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "15px"
  spotlight-card:
    backgroundColor: "{colors.violet-base}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xxl}"
    padding: "40px"
---

# Design System: Wyvern Drive

## Overview

**Creative North Star: "The Dark Canvas"**

Wyvern Drive is a personal cloud drive backed by Discord — files split into chunks, AES-256-GCM encrypted at rest, served from a bot-managed private channel — and it wears the Framer dark-canvas marketing world the way Framer wears it: a near-black canvas with a faint warmth, oversized white display type with hard negative tracking, and one chromatic accent (blue) that is a signal, never a fill. The app is a poster at the edges (login, share links) and a quiet instrument in the middle (the drive itself): scanability, density, and the familiar cloud-drive idioms outrank expression once the user is inside.

Hierarchy is carried by **surface lift** — canvas → surface-1 → surface-2 — never by color ramps or opacity tricks on white type. The text scale is binary: `ink` or `ink-muted`. The only chromatic depth in the whole system is the scarce gradient spotlight card (the drive's empty state), which sits in an otherwise monochrome grid like a Framer showcase tile.

**Key Characteristics:**
- Near-black canvas everywhere; no light mode, no white cards, no light interludes.
- Massive negative letter-spacing on display sizes (Mona Sans at 500, -3.1px at 62px, -1.0px at 32px) for a poster-grade headline cadence.
- White pill is the only primary CTA; charcoal pills and text links cover everything else.
- One gradient spotlight card (violet, 30px radius) as the system's only atmosphere device — the drive empty state.
- Inter Variable body with bespoke OpenType character variants (`cv01`, `cv05`, `cv09`, `cv11`, `ss03`, `ss07`, `dlig`) — the typographic voice is unmistakable.
- 5px spacing base (5/10/15/20/30), radius scale from 4px chips to 100px pills, 15–20px cards, 30px spotlight.
- Cloud-drive side rail (user-confirmed over a marketing top nav); monochrome file-type glyphs (folders ink, files ink-muted).
- Light-edge elevation: a 0.5px white top edge over a deep drop shadow — the only shadow language.

## Colors

The palette is monochrome plus one blue, plus the gradient family. Warm near-black ground, binary text hierarchy, hairline dividers.

### Primary
- **Ink** (#FFFFFF): All headline and emphasized body type; the white pill primary CTA fill.

### Secondary
- **Accent Blue** (#0099FF): The single chromatic accent. Hyperlinks, focused-input rings, checked checkboxes, selection indicators, drop-target rings. Never a button fill, never a background tint, never the brand mark.

### Neutral
- **Canvas** (#0E0E10): Page, rail, app-bar, and dialog-backdrop ground — near-black with a faint warmth.
- **Surface 1** (#1A1A1D): One step up — cards, table container, secondary pills, inputs, alerts.
- **Surface 2** (#242428): Two steps up — selected nav pill, selected rows/cards, dialogs, menu popovers, selection bar, floating upload queue.
- **Ink Muted** (#999999): All secondary type — meta, breadcrumb links, disabled text, file-type glyphs.
- **Hairline** (rgba(255,255,255,0.08)) / **Hairline Soft** (rgba(255,255,255,0.06)): 1px borders and dividers.

### Semantic
- **Success** (#3AC36F): Completion glyphs only (upload-done check). Glyph fill, not surface.
- **Danger** (#FF5C5C): Destructive actions — delete pills, error text/glyphs.
- **Warning** (#F5A524): Warning alerts (storage-unavailable).
- **Violet / Magenta / Orange / Coral bases** (#7C3AED / #DB2777 / #F97316 / #FB7185): Gradient spotlight family anchors; the built app ships the violet variant.

### Named Rules
**The One Blue Rule.** Accent blue is reserved for links, focus, and selection. If you reach for a second blue — or a blue button fill — the brand is drifting.
**The Binary Ink Rule.** Secondary type is `ink-muted` (#999999) or it is `ink`. No mid-tone grays, no opacity gradients on white type.
**The Lift Rule.** Hierarchy on dark is marked by surface lift (canvas → surface-1 → surface-2), never by color or brightness of type.

## Typography

**Display Font:** Mona Sans Variable (GT Walsheim substitute — open-source, closest obtainable face)
**Body Font:** Inter Variable
**Label Font:** Inter Variable (same as body; weight + size carry the label role)

**Character:** Geometric, slightly humanist display over a workhorse body. The pairing reads "designed product, not template": hard negative tracking at display sizes, and a body voice tuned by OpenType variants rather than by a custom face.

### Hierarchy
- **Display Hero** (Mona Sans Variable 500, 62px, lh 1.0, -3.1px): The login poster headline — "Your files, encrypted."
- **Display** (Mona Sans Variable 500, 32px, lh 1.13, -1.0px): Page titles ("Settings"), shared-file names, the empty-state heading.
- **Headline** (Inter Variable 700, 22px, lh 1.2, -0.8px): Dialog titles, the share not-available heading.
- **Title** (Inter Variable 600, 16px, lh 1.25, -0.16px): Wordmark-scale in-app titles.
- **Body** (Inter Variable 400, 15px, lh 1.3, -0.15px): Default body, file names, descriptions. Carries `cv01/cv05/cv09/cv11/ss03/ss07/dlig`.
- **Body Sm** (Inter Variable 500, 14px, lh 1.4, -0.14px): Dense data, table meta, dialog descriptions.
- **Label / Caption** (Inter Variable 500, 13px, lh 1.2, -0.13px): Table headers, quota readouts, footer links, eyebrows.
- **Button** (Inter Variable 500, 14px, lh 1.0, -0.14px): Pill CTAs.

### Named Rules
**The Tracking Rule.** Letter-spacing scales with size, hard: display pulls ~5% negative, body sticks to ~1%. Reduce size before reducing the percentage.
**The Variant Rule.** The Inter OpenType variants (`cv01 cv05 cv09 cv11 ss03 ss07 dlig`) are the body voice. Switching them off visibly changes the brand.
**The Weight Band Rule.** Display sits at 500, body at 400, labels at 500. Hierarchy comes from size + tracking, never from a 700/900 ramp.

## Layout

- **Spacing base: 5px** (5/10/15/20/30/40; sections at 96). Numeric MUI `sx` spacing values use this base — `p: 2` is 10px.
- **Chrome:** Fixed 240px side rail on canvas with a hairline right border; wordmark top, Drive/Settings nav, user chip + logout at the bottom. Mobile collapses to a 56px canvas app bar with a temporary drawer.
- **Content column:** max 560px for centered public surfaces (login, share); the drive page runs full-width inside the rail with a 20px gutter.
- **Toolbar:** search field (flex-grow) → white Upload pill → charcoal New folder pill → circular view toggles → compact quota readout (desktop only, right-aligned, 200px).
- **Entry views:** desktop table (canvas rows, surface-1 hover, surface-2 selected, hairline-soft dividers) or grid (surface-1 cards, 15px radius, hover lifts to surface-2 + light-edge); mobile stacks full-width cards.
- **Breakpoints:** 768px flips rail ↔ app bar + table ↔ cards. Grid collapses below 810px. Display hero scales by choosing the next token down (62 → 32), never by fluid type.
- **Whitespace philosophy:** the dark canvas IS the whitespace; sections separate by surface-mode change, like cuts in a dark film.

## Elevation & Depth

Depth is **layered surfaces + a single light-edge shadow vocabulary**, not ambient drop shadows everywhere. Flat at rest; light-edge appears on floating/hovering surfaces.

### Shadow Vocabulary
- **Light Edge** (`inset 0 1px 0 rgba(255,255,255,0.10), 0 10px 30px rgba(0,0,0,0.25)`): Floating cards, upload queue, menus, hovered grid cards.
- **Light Edge Strong** (`inset 0 1px 0 rgba(255,255,255,0.12), 0 16px 40px rgba(0,0,0,0.35)`): Selection bar, dialogs, elevated panels.
- **Focus Ring** (`0 0 0 1px rgba(0,153,255,0.15)`): Focused inputs — same surface, blue ring, no surface change.
- **Drop Target** (`2px dashed #0099FF` + `rgba(0,153,255,0.06)` fill): Drag-over ring on the file area.

### Named Rules
**The Flat-By-Default Rule.** Surfaces are flat until they float (hover, selection, dialog). Shadows mark floating, never resting.

## Shapes

- **Radius scale:** 4px utility chips, 6px tags, 10px inputs/list rows, 15px entry cards, 20px cards/dialogs/menus, 30px spotlight cards, 100px pill buttons, 9999px circular icon buttons.
- **Pills are the only CTA shape.** Every primary/secondary button is a pill; icon actions are full circles. Never square off a CTA.
- **Borders:** hairline (white 8%) on cards and inputs; hairline-soft (white 6%) for table dividers; no colored left borders.
- **Spotlight cards** keep 30px corners at every viewport — they are atmospheric panels, not UI tiles.

## Components

### Buttons
- **Shape:** pill (100px). Pressed = `scale(0.97)` shrink, never a darkened fill.
- **Primary:** white fill, canvas text, 10px/15px padding. The only primary CTA shape. Disabled at 25% white fill / 40% text.
- **Secondary:** surface-1 fill, ink text, hairline border; hover lifts to surface-2.
- **Danger:** danger fill, near-black text (confirm-delete); outlined-danger for row-level destructive.
- **Translucent:** rgba(255,255,255,0.14) fill on the spotlight card — the CTA that lives on busy backgrounds.
- **Hover / Focus:** 150ms ease; blue focus ring via the global `:focus-visible` outline; pressed scale.

### Chips / Icon Buttons
- Circular 40px icon buttons, ink-muted glyphs → ink + 6% white hover. Touch surfaces grow to 40px (mobile card actions).

### Cards / Containers
- **Entry cards:** surface-1, 15px, hairline border, 15px padding; hover → surface-2 + light-edge.
- **Dialogs:** surface-2, 20px radius, light-edge-strong, 24px padding, rgba(0,0,0,0.72) backdrop.
- **Selection bar:** floating surface-2 bar, 20px radius, light-edge-strong; count in caption/ink, actions as small charcoal pills.
- **Upload queue:** floating bottom-right surface-2 panel, 20px radius, light-edge; jobs show a 6px white progress bar on a white-10% track; done = success-green check glyph.

### Inputs / Fields
- **Style:** surface-1 fill, 10px radius, hairline border, 10px/14px padding, ink text, ink-muted placeholder.
- **Focus:** same surface + `0 0 0 1px` blue ring (focus-ring); the notch border goes transparent.
- **Disabled:** 3% white fill; error states render as tinted translucent alerts (red 10% fill, ink text, red icon).

### Navigation
- **Side rail:** canvas, hairline right border. Wordmark = folder glyph in a surface-2 circle + Mona Sans 500. Nav links ink-muted → selected surface-2 pill (lift, not color); hover surface-1. `aria-current="page"` on the active item.
- **Mobile:** 56px canvas app bar (no elevation), hamburger + wordmark; drawer on canvas.
- **Breadcrumbs:** ink-muted links → ink on hover; current folder ink 500 with `aria-current="page"`.

### Spotlight Card (signature)
- The single gradient card: violet (`linear-gradient(140deg, #5B21B6, #7C3AED 48%, #A78BFA)`), 30px radius, 40px padding, centered content, white display heading, white-85% caption, frosted translucent pill CTA. Appears exactly once — the drive's empty state.

## Do's and Don'ts

### Do:
- **Do** keep canvas and ink as the system's two anchor surfaces; every band chooses one or the other.
- **Do** push display tracking hard negative and keep the Inter OpenType variants on.
- **Do** use blue only for links, focus, selection — and the drop-target ring.
- **Do** mark hierarchy with surface lift; selected = one step up, never a tint.
- **Do** compose every CTA as a pill and every icon action as a circle.
- **Do** keep the gradient scarce — one spotlight card, ever.

### Don't:
- **Don't** ship a light surface anywhere. The brand is dark.
- **Don't** introduce mid-tone grays outside ink-muted.
- **Don't** make the blue a brand fill — no blue pills, no blue logo tiles.
- **Don't** square off CTAs or use bordered ghost buttons with transparent fills.
- **Don't** reduce display negative tracking "for accessibility" — reduce size, keep the percentage.
- **Don't** apply gradients to whole sections; gradients are cards.
- **Don't** color-code file types; the glyph carries the type, folders are ink and files are ink-muted.
