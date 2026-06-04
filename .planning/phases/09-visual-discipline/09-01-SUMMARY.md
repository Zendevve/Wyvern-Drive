---
phase: 09-visual-discipline
plan: 01
subsystem: design-system
tags: [shape-scale, z-index, color-tokens, neon-glow, no-rewrite]
dependency_graph:
  requires: [08-01]
  provides: [src-constants-tokens, shape-scale, z-index-scale, semantic-colors]
  affects: [src/App.tsx, src/index.css, all dashboard components in src/components/]
tech-stack:
  added: []
  patterns: [token-migration, single-source-of-truth, semantic-color-mapping]
key-files:
  created:
    - src/constants/tokens.ts
  modified:
    - src/index.css
    - src/App.tsx
    - src/components/AudioPlayer.tsx
    - src/components/DropZone.tsx
    - src/components/FileBrowser.tsx
    - src/components/FileDetailsDrawer.tsx
    - src/components/FileList.tsx
    - src/components/LightboxModal.tsx
    - src/components/MediaPreviewModal.tsx
    - src/components/PhotoThumbnail.tsx
    - src/components/SettingsPanel.tsx
    - src/components/ShareModal.tsx
    - src/components/Toast.tsx
decisions:
  - "tokens.ts exports Tailwind CLASS STRINGS, not raw CSS, so callers compose className={...SHAPE_SCALE.card}"
  - "Status dot readability preserved after glow removal by adding a 2px ring in card color (so the dot 'sits on' the surface)"
  - "Audio files tile collapses to bg-primary/10 text-primary per the plan's unification move (8 tile colors -> 1)"
  - "Archive (zip/tar/rar/gzip) tiles use bg-warning/10 text-warning because orange ~ warning token"
  - "Z_INDEX.toast (z-[60]) sits above Z_INDEX.modal (z-50) so toasts can announce errors when a modal is open"
metrics:
  duration: ~12min
  completed_date: 2026-06-04
---

# Phase 9 Plan 1: Visual Discipline Summary

Centralised shape, z-index, and color tokens; removed the two neon status-dot glows; migrated all hardcoded Tailwind color literals to theme tokens.

## What changed

**New file**
- `src/constants/tokens.ts` — exports `SHAPE_SCALE` (input / card / pill), `Z_INDEX` (base / raised / dropdown / sticky / overlay / modal / toast / skipLink), and `SEMANTIC_COLORS` (success / error / warning / info with bg / text / soft class strings).

**Doc comment in `src/index.css`** — a header block above the `@theme` rule describing the three scales and the corresponding CSS variable names.

**Neon-glow removal**
- `App.tsx` sidebar webhook dot and `SettingsPanel.tsx` settings dot: `bg-emerald-500 shadow-[0_0_8px_rgba(...)]` / `bg-rose-500 shadow-[0_0_8px_rgba(...)]` → `SEMANTIC_COLORS.success.bg` / `SEMANTIC_COLORS.error.bg`, no shadow, plus a `ring-2 ring-card` so the dot still reads cleanly against the card surface.

**Shape scale**
- All `rounded-2xl` in `src/components/` and `App.tsx` → `rounded-xl` (10 occurrences: share-access card, settings card, file grid items, list container, empty-state dashed card, file browser header, audio player container, file-type icon background, dropzone container).
- `DropZone.tsx` drag-overlay `rounded-3xl` → `rounded-xl`.
- `PhotoThumbnail.tsx` thumbnail button `rounded` → `rounded-xl`.
- All `rounded-full` (status dots, pills, play/pause button, theme toggle, encrypted pill, file-type badge) preserved.
- `rounded-lg` on form controls / small buttons preserved.

**Color literals → tokens**
- `text-rose-500` (App.tsx expired/error, lock button, SettingsPanel error message) → `text-destructive`.
- `text-emerald-500` (App.tsx download complete, SettingsPanel success) → `text-success`.
- `text-red-400` (MediaPreviewModal error) → `text-destructive`.
- `bg-blue-500/10 text-blue-500` (image tile) → `bg-primary/10 text-primary`.
- `bg-amber-500/10 text-amber-500` (video tile) → `bg-warning/10 text-warning`.
- `bg-purple-500/10 text-purple-500` (audio tile) → `bg-primary/10 text-primary` (collapsed to primary per the plan's "unification move").
- `bg-rose-500/10 text-rose-500` (pdf tile) → `bg-destructive/10 text-destructive`.
- `bg-orange-500/10 text-orange-500` (archive tile) → `bg-warning/10 text-warning`.
- `bg-rose-500/10` on lock-button hover → `bg-destructive/10`.
- `bg-amber-500` / `bg-emerald-500` / `bg-rose-500` on status dots → `bg-warning` / `bg-success` / `bg-destructive` (handled together with the glow removal above).

**Z-index scale**
- `App.tsx` skip-link `focus:z-[100]` → `focus:${Z_INDEX.skipLink}` (template-literal composition).
- `App.tsx` right-drawer aside: no explicit z was present (plan assumed `z-50`; nothing to replace — see Deviations).
- `Toast.tsx` toast container `z-50` → `${Z_INDEX.toast}` (z-[60], above modals so toasts can announce errors when a modal is open).
- `ShareModal.tsx` overlay + content `z-50` → `Z_INDEX.modal` (both).
- `LightboxModal.tsx` overlay + content `z-50` → `Z_INDEX.modal`; close button `z-10` → `Z_INDEX.raised`.
- `DropZone.tsx` drag overlay `z-50` → `Z_INDEX.overlay`.
- `AudioPlayer.tsx` floating player `z-40` → `Z_INDEX.overlay`.
- `MediaPreviewModal.tsx` overlay + content `z-50` → `Z_INDEX.modal`.

## Deviations from Plan

### Auto-fixed issues (verification gate would have failed otherwise)

**1. [Rule 3 - Verification gate blocker] Fixed `MediaPreviewModal.tsx` color + z-index literals**
- **Found during:** Task 1 verification
- **Issue:** `src/components/MediaPreviewModal.tsx` (not in plan's `files_modified` list) contained `text-red-400` and two `z-50` literals. The plan's verification gate (`rg -n "text-(emerald|rose|amber|blue|purple|green|red|yellow)-[0-9]+" src/components/` and `rg -n "z-(0|10|20|30|40|50|\[)" src/components/ src/App.tsx index.html`) would have returned non-zero, failing the gate.
- **Fix:** Added `Z_INDEX.modal` to the two Dialog slots, replaced `text-red-400` with `text-destructive`. No logic change; class-token migration only, consistent with the rest of the phase.
- **Files modified:** `src/components/MediaPreviewModal.tsx`
- **Commit:** `8d3af04`

### Stale assumptions in the plan

**2. [Plan reference] `App.tsx` right-drawer `<aside>` had no `z-50`**
- **Found during:** Task 1
- **Issue:** Plan step 5 listed "App.tsx line ~378: `z-50` on the right-drawer `<aside>` → `Z_INDEX.raised`", but the current `<aside>` had no z-index class. The plan was written from an older snapshot.
- **Resolution:** No change needed — nothing to replace. The drawer remains in the natural stacking order (raised above main content by virtue of being a sibling, but no explicit z).

## Verification

All six verification gates pass:
1. `rg -n "shadow-\[0_0_8px" src/` → zero matches.
2. `rg -n "text-(emerald|rose|amber|blue|purple|green|red|yellow)-[0-9]+" src/components/` → zero matches.
3. `rg -n "bg-(emerald|rose|amber|blue|purple|green|red|yellow)-[0-9]+" src/components/` → zero matches.
4. `rg -n "z-(0|10|20|30|40|50|\[)" src/components/ src/App.tsx index.html` → zero matches.
5. `rg -n "rounded-(2xl|3xl)" src/components/` → zero matches.
6. `rg -n "orange-[0-9]+" src/components/` → zero matches (orange archive tile collapsed to warning token).

Tests: 28/28 pass (`npm run test`). Build: clean (`npm run build` exits 0).

## Scope-guard compliance

No marketing-page work introduced: no hero, no bento, no marquee, no zigzag cap, no "trusted-by" wall, no scroll cue, no premium-consumer palette, no Marrow-style spec sheets. No new dependencies. No working-logic rewrites; all changes are class-string migrations or import additions.
