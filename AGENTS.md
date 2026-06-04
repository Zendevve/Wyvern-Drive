# AGENTS.md

> Durable rule set for the Wyvern Drive codebase. Every agent and human must read this before editing UI, theme, icons, motion, or accessibility. Source of truth files are linked, not copied.

## 1. Project Snapshot

- **Product:** Wyvern Drive — self-hosted encrypted PWA file-storage.
- **Stack:** Vite 6 + React 19 + TypeScript 5.7 + Tailwind v4 (via @tailwindcss/vite) + Zustand 5 + Radix UI + idb + vitest 4 + Playwright 1.60.
- **Path:** repo root.
- **Aesthetic:** Signal Orange (#FF5A00) + Clash Display (display font) + Satoshi (body font) + brutalist-glass surfaces. Dashboard / product UI class — NOT a marketing site.

## 2. Design Dials

| Dial | Value | Notes |
|------|-------|-------|
| DESIGN_VARIANCE | 4 | One shape scale, one z-index scale, one color palette. |
| MOTION_INTENSITY | 3 | Subtle state transitions; infinite animations gated. |
| VISUAL_DENSITY | 6 | High info density; cards/tables; minimal whitespace bloat. |

## 3. Tokens (Authoritative Source)

- **Theme tokens:** [src/index.css](file:///d:/COMPROG/Wyvern%20Drive/src/index.css) (`@theme` block + `:root` + `.dark`).
  - Foreground: `--color-foreground`, `--color-text-muted`, `--color-border`
  - Surfaces: `--color-background`, `--color-card`, `--color-card-hover`
  - Brand: `--color-primary` (Signal Orange), `--color-primary-hover`
  - Semantic: `--color-success`, `--color-warning`, `--color-error`, `--color-destructive`
  - Soft tints: `--color-surface-success`, `--color-surface-warning`, `--color-surface-error`
- **Shape scale:** [src/constants/tokens.ts](file:///d:/COMPROG/Wyvern%20Drive/src/constants/tokens.ts) → `SHAPE_SCALE`.
  - `SHAPE_SCALE.input` → `rounded-lg` (form controls, small buttons)
  - `SHAPE_SCALE.card` → `rounded-xl` (cards, modals, panels)
  - `SHAPE_SCALE.pill` → `rounded-full` (chips, status dots, round buttons)
- **Z-index scale:** [src/constants/tokens.ts](file:///d:/COMPROG/Wyvern%20Drive/src/constants/tokens.ts) → `Z_INDEX`.
  - `base` (z-0) → `raised` (z-10) → `dropdown` (z-20) → `sticky` (z-30) → `overlay` (z-40) → `modal` (z-50) → `toast` (z-[60]) → `skipLink` (z-[100]).
- **Semantic colors:** [src/constants/tokens.ts](file:///d:/COMPROG/Wyvern%20Drive/src/constants/tokens.ts) → `SEMANTIC_COLORS` (use `{bg, text, soft}` keys).

## 4. Icons

- **Library:** `@phosphor-icons/react` at `^2.1.10` (MIT, Phosphor Icons team).
- **Weight:** always `weight="regular"` (= strokeWidth 1.5).
- **Sizing:** 14px for inline labels, 18px for sidebar nav, 20px for action buttons, 28-48px for larger controls (audio album art, drop overlay icon).
- **File-type icon resolver:** [src/components/icon-map.ts](file:///d:/COMPROG/Wyvern%20Drive/src/components/icon-map.ts) → `getFileIcon(mimeType)`. Use this for every file-type glyph — never inline an emoji.
- **A11y:** every icon-only button must have an `aria-label` on the parent button. Icons themselves should carry `aria-hidden="true"`.

## 5. Motion

- **Source of truth:** [src/hooks/useReducedMotion.ts](file:///d:/COMPROG/Wyvern%20Drive/src/hooks/useReducedMotion.ts) → `useReducedMotion(): boolean`.
- **CSS gate:** [src/index.css](file:///d:/COMPROG/Wyvern%20Drive/src/index.css) contains a `@media (prefers-reduced-motion: reduce)` block that collapses `animate-pulse`, `animate-bounce`, `animate-spin`, `animate-in`, and `animate-[spin_*s_linear_infinite]`. Do not delete this block.
- **Rule:** ALL infinite / looping animations MUST be gated behind `useReducedMotion()`. Hover / state-change transitions (transition-colors, transition-[transform,opacity]) are exempt.
- **Banned:** neon outer glow (`shadow-[0_0_*_rgba(...)]`), parallax, scroll-triggered animations, staggered list reveals.
- **Allowed:** `transition-colors`, `transition-[transform,opacity]`, `transition-[transform,colors]`, `transition-all` (only when the change set actually spans 3+ properties — the audio player container width collapse and sidebar width collapse are the two legitimate cases).
- **Viewport:** always `h-[100dvh]`, never `h-screen`.

## 6. Accessibility

- WCAG AA contrast in BOTH light and dark themes.
- Every icon-only button has an `aria-label`.
- Skeleton / loading text uses `aria-live="polite"` where appropriate (Toast container already does).
- Keyboard: every interactive element is reachable via Tab; focus-visible outline uses `--color-primary` (already declared globally in `src/index.css`).
- No `useState` for scroll position. No `window.addEventListener('scroll', ...)` for visual effects.
- Skip-to-content link is rendered in `App.tsx` with `Z_INDEX.skipLink`.

## 7. Performance

- **Fonts:** self-hosted in `public/fonts/*.woff2`. Preloaded in `index.html` with `crossorigin`. Do NOT re-introduce `@import` from any third-party font CDN.
- **Images:** every `<img>` MUST have explicit `width`, `height`, `decoding="async"`, and `loading="lazy"`.
- **Viewport:** `h-[100dvh]`, not `h-screen`.

## 8. Anti-Patterns (Banned)

- Emoji as UI icon (anywhere in JSX). Use Phosphor via `getFileIcon` or direct import.
- Hardcoded Tailwind color literals (`text-emerald-500`, `bg-blue-500/10`, etc.). Use the tokens.
- Raw `z-N` or `z-[N]` classes. Use `Z_INDEX.*`.
- `rounded-2xl`, `rounded-3xl`. Use the `SHAPE_SCALE`.
- `shadow-[0_0_*]` (outer glow / neon). Use ring + saturated bg instead.
- `transition-all` on elements where only 1-2 properties change.
- `h-screen`. Use `h-[100dvh]`.
- The em-dash character `—` (U+2014) in user-facing strings. ASCII en-dash `-` or words like "to"/"and" are fine.
- New third-party dependencies without a written justification in the SUMMARY.

## 9. Out of Scope (Explicitly)

This is a dashboard / product UI. The following marketing-page patterns are NOT in scope and must NEVER be added:

- Hero sections, hero CTAs, hero animations
- Bento grids
- Marquees / scrollers / tickers
- Eyebrow caps (small uppercase text above section titles)
- Zigzag / alternating layout caps
- Trusted-by walls / logo strips / "as seen in"
- Scroll-cue chevrons / "scroll to explore"
- Premium consumer palette checks (Inter + neutral grays)
- Marrow-style spec sheet rewrites
- Holographic / iridescent / glassmorphic-on-glass backgrounds
- Carousel sections, "infinite" loops of content

If a request resembles any of the above, decline with a one-sentence reason and propose a dashboard-appropriate alternative.

## 10. Working with this repo

- Tests: `npm run test` (vitest unit + integration), `npm run test:e2e` (Playwright).
- Build: `npm run build` (tsc + vite build).
- Dev: `npm run dev`.
- Phase plans: `.planning/phases/{NN-name}/NN-NN-PLAN.md` → execute via `/gsd-execute-phase {NN}`.
- After every phase, run `npm run test && npm run build` to verify no regression.

## 11. When in Doubt

- Read the source files linked above before guessing.
- If a rule seems to conflict with a new request, the tokens file wins. Refactor the request, not the tokens.
- If you find yourself wanting to introduce a new dependency, write the justification in the phase SUMMARY first and stop.
