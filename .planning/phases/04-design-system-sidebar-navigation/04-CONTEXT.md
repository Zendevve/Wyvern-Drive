# Phase 4: Design System & Sidebar Navigation - Context

**Gathered:** 2026-06-05
**Status:** Ready for planning

<domain>
## Phase Boundary

This phase delivers the core visual design system tokens (palette, outfit typography, CSS micro-animations) and the left-hand navigation sidebar with storage gauge indicators. Specifically:
1. Palette tokens in CSS matching the Artano black-and-white theme.
2. Google Font integration (Outfit) and custom letter-spacing styles.
3. Left-hand vertical navigation sidebar incorporating the SVG semi-circular storage progress gauge and the category storage breakdown widget.
4. CSS transition utilities for hardware-accelerated animations.

</domain>

<decisions>
## Implementation Decisions

### Design Tokens & Palette Colors
- **Canvas Background:** Sleek dark charcoal/black (`#0D0E12`).
- **Cards & Containers:** Dark charcoal (`#16171F`) with thin crisp borders (`#262933`) and subtle white dot pattern fills.
- **Brand Accents:** High-contrast pure white (`#FFFFFF`), silver/light-gray, and claw/wyvern logo marks.
- **Corner Roundness:** 12px for cards (`--r-lg`), but sharp 4px/8px corners for buttons/icons to match the sharp claws.

### Typography & Typography Scales
- **Font Family:** "Outfit" (Google Fonts - matches the circular, geometric sans-serif shapes of the logo).
- **Typography Weights:** 400 (Regular), 500 (Medium), 600 (Semi-Bold), 700 (Bold).
- **Letter Spacing:** Tight spacing (`-0.03em`) on large headings.
- **Dot Pattern & Headers:** Keep typography clean; use dot pattern grids in card headers and background panels.

### Sidebar Navigation & Category Breakdowns
- **Sidebar Branding Header:** White claw logo mark + "Artano" text at the top, with "Wyvern Drive" as subtext.
- **Storage Progress Gauge:** SVG Semi-circular progress arc with a deep gray track (`#262933`) and a glowing white fill (`#FFFFFF`), displaying "XX% Used" in the center.
- **Category Breakdown list:** Clean monochrome list (Documents, Images, Videos, Audio, Others) with simple white line icons and light-gray subtext, using thin white horizontal bars for proportion.
- **Navigation Active Highlights:** Active items get a vertical white indicator line on the far left and a subtle white dot prefix, with text turning pure white.

### the agent's Discretion
- Micro-animations: Exact cubic-bezier values for hover states and transition delays are at the agent's discretion, provided they are hardware-accelerated.
- Dot Matrix generation: Exact SVG code or CSS mask implementation of the dot-matrix halftone pattern is left to the agent.

</decisions>

<code_context>
## Existing Code Insights

### Reusable Assets
- `web/src/styles/tokens.css` - Needs update to replace dark-blue colors with Artano black-and-white theme tokens.
- `web/src/components/AppShell.tsx` - AppShell container where sidebar is/will be integrated.
- `web/src/components/icons.tsx` - File category icons.

### Established Patterns
- Styling uses Vanilla CSS variables in `tokens.css` and imports them in `global.css` and `components.css`.
- App is written in React + TSX, using Vite.

### Integration Points
- `web/src/components/AppShell.tsx` will host the new left-hand sidebar navigation.
- `web/src/styles/tokens.css` will host the new color and typography tokens.

</code_context>

<specifics>
## Specific Ideas
- The claw/wyvern mark from brand guidelines (three sharp vertical claws) should be rendered as a clean SVG icon and placed at the top of the sidebar.
- Halftone/dot-matrix pattern will be rendered as a repeating background SVG or a pattern grid.

</specifics>

<deferred>
## Deferred Ideas
- Interactive category filtering is deferred to Phase 5.
- Collapsible sidebar drawer toggle is deferred to Phase 5.

</deferred>
