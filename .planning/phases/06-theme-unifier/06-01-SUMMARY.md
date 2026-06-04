---
phase: 06-theme-unifier
plan: 01
subsystem: theming
tags: [tokens, migration, a11y, light-mode, dark-mode, em-dash]
dependency_graph:
  requires: [phase-05-01, phase-05-05]
  provides: [theme-unified-modals, semantic-surface-tokens, em-dash-free-password-modal]
  affects: [PasswordModal, ShareModal, Toast, UploadProgress, PhotoTimeline, PhotoThumbnail]
tech_stack:
  added: []
  patterns: [css-variables, token-driven-surfaces, alpha-tinted-status-bgs]
key_files:
  created: []
  modified:
    - src/index.css
    - src/components/PasswordModal.tsx
    - src/components/ShareModal.tsx
    - src/components/Toast.tsx
    - src/components/UploadProgress.tsx
    - src/components/PhotoTimeline.tsx
    - src/components/PhotoThumbnail.tsx
decisions:
  - Use rgba alpha-tinted surface tokens (0.10 light / 0.18 dark) rather than separate hardcoded hex per state, so token names stay semantic and the underlying hue stays consistent with --error/--success/--warning.
  - Expose --surface-* through @theme as --color-surface-* so Tailwind utility classes (bg-surface-error) resolve, mirroring the existing --color-primary / --color-card pattern.
  - Keep Toast.test.tsx contract intact: no JSX, state, handler, ref, or import changes — class string substitution only.
  - Strength bar "None" state uses bg-border (the existing --border token) rather than introducing a new neutral token; bg-border is already the "track" color elsewhere.
metrics:
  duration_minutes: 7
  completed_date: 2026-06-04
---

# Phase 6 Plan 1: Theme Unifier Summary

Unified 6 components onto the --card / --primary / --background / --border / --text-muted / --destructive / --success / --warning token system, added light+dark semantic surface tokens (--surface-error / --surface-success / --surface-warning) so Toast variants and strength meters render correctly in both themes, and removed the banned em-dash (U+2014) from the PasswordModal strength label.

## What Was Built

### Task 1 — Semantic surface tokens (`src/index.css`)

Added three new CSS variables on both `:root` and `.dark`, and exposed them through `@theme` so Tailwind utilities resolve:

| Token | Light | Dark | Purpose |
|-------|-------|------|---------|
| `--surface-error` | `rgba(239, 68, 68, 0.10)` | `rgba(239, 68, 68, 0.18)` | Soft red tint for error Toast / destructive surfaces |
| `--surface-success` | `rgba(16, 185, 129, 0.10)` | `rgba(16, 185, 129, 0.18)` | Soft green tint for success Toast / strength "Strong" |
| `--surface-warning` | `rgba(245, 158, 11, 0.10)` | `rgba(245, 158, 11, 0.18)` | Soft amber tint for strength "Medium" |

Dark theme uses 0.18 alpha so the soft tints stay visible against the `#1C1C21` card surface. Light theme uses 0.10 alpha to avoid overwhelming the near-white background.

The underlying hue values are the existing `#ef4444` / `#10b981` / `#f59e0b` from `@theme` — no new hexes were introduced; only alpha-tinted wrappers.

### Task 2 — Component migrations

| File | Class migrations |
|------|------------------|
| `PasswordModal.tsx` | `bg-darker-bg`→`bg-card`, `bg-dark-bg`→`bg-background`, `border-gray-600`→`border-border`, `text-discord-text`→`text-foreground`, `text-discord-muted`→`text-text-muted`, strength bar `bg-gray-600`→`bg-border` / `bg-red-500`→`bg-destructive` / `bg-yellow-500`→`bg-warning` / `bg-green-500`→`bg-success`, track `bg-gray-700`→`bg-border`, `text-red-400`→`text-destructive`, `bg-blurple`/`hover:bg-blurple/80`→`bg-primary`/`hover:bg-primary-hover`, em-dash `—`→ASCII `None` |
| `ShareModal.tsx` | `bg-darker-bg`→`bg-card`, `bg-dark-bg`→`bg-background`, `border-gray-700`→`border-border`, `text-discord-muted`→`text-text-muted`, `bg-blurple`/`hover:bg-blurple/80`→`bg-primary`/`hover:bg-primary-hover`, `accent-blurple`→`accent-primary`, `text-red-400`→`text-destructive` |
| `Toast.tsx` | `variantStyles.default`→`bg-card border-border`; `variantStyles.success`→`bg-surface-success border-success text-foreground`; `variantStyles.error`→`bg-surface-error border-error text-foreground`; description `text-discord-muted`→`text-text-muted` |
| `UploadProgress.tsx` | `bg-dark-bg`→`bg-card`, `text-discord-muted`→`text-text-muted`, track `bg-gray-700`→`bg-border`, fill `bg-blurple`→`bg-primary`, failed `bg-red-500`→`bg-destructive` |
| `PhotoTimeline.tsx` | 2× `text-discord-muted`→`text-text-muted` |
| `PhotoThumbnail.tsx` | `bg-dark-bg`→`bg-card`, `text-discord-muted`→`text-text-muted`, `ring-blurple`→`ring-primary` |

**No JSX structure, state, handler, ref, or import changes** — pure class-string substitution. Toast.test.tsx contract preserved (5/5 cases still passing on first run).

## Verification

```
npm run test   →  6 test files, 28 tests, all passing (Toast.test.tsx 5/5)
npm run build  →  exit 0, 147 modules transformed, dist emitted
rg orphan check →  0 matches in 6 scoped files (bg-blurple, bg-darker-bg, bg-dark-bg,
                   text-discord-muted, text-discord-text, border-gray-600, border-gray-700,
                   accent-blurple, ring-blurple)
em-dash check  →  0 matches in PasswordModal.tsx
```

Build emits one pre-existing warning about the `@import url('https://api.fontshare.com/...')` rule being moved during CSS optimization. This is owned by **Phase 8 — self-hosted fonts** and is explicitly out of scope for Phase 6.

## Deviations from Plan

None — plan executed exactly as written.

## Scope Guard Compliance

- No hero / bento / marquee / eyebrow caps / zigzag cap / "trusted by" wall / scroll cue / premium-consumer-palette work.
- No new dependencies added.
- No rewrites of working logic — class strings only.
- No new UI elements, layout changes, or icons introduced.
- Emoji-as-icon in ShareModal (🔒) left untouched — Phase 7 owns icon replacement.

## Out of Scope (deferred to later phases)

- `ShareModal.tsx` 🔒 emoji-as-icon and `✕` close glyph → Phase 7 (Iconography, `@phosphor-icons/react`)
- `bg-text-muted` placeholder text in PhotoThumbnail Loading state → not flagged as orphan (uses the same token as the rest of the muted text in the app)
- Self-hosted font migration (current `@import url('https://api.fontshare.com/...')`) → Phase 8 (Motion & Performance)
