---
spec_version: 1
phase: 03-react-single-page-application-ui
generated_by: gsd-ui-phase (autonomous, yolo mode)
---

# Phase 3: UI-SPEC — React Single Page Application

## Design Direction

**Aesthetic:** Premium dark file manager. Glassy surfaces, generous spacing, soft motion. Refined rather than maximalist — single accent color (Discord blurple) on a deep slate canvas. Inspired by Linear, Vercel dashboards, and Apple Finder dark mode. No emoji, no neon.

**Tone:** Quiet, confident, fast. The interface should feel like a tool built for power users, not a toy.

**Typography:** Inter (UI) and JetBrains Mono (file sizes, IDs). Strict scale: 12 / 14 / 16 / 20 / 28 / 40 px.

## Layout

- **App shell:** Three regions — fixed top bar (logo, breadcrumb, user menu), left rail (90 px, navigation: My Drive, Recent, Trash placeholder, Storage usage), main content area.
- **Top bar (60 px):** Logo on the left, breadcrumb in the center, account chip on the right.
- **Left rail:** Vertical icon-only nav. Active item has a 4 px left accent stripe.
- **Main area:** Switchable between grid and list views (toggle in top-right). A 16-column flex grid for cards. List view is a dense table with columns: Name, Size, Type, Modified.
- **Detail panel:** Slides in from the right (320 px) when a file/folder is single-selected.

## Color Tokens

```
--bg-base:        #0B0D12
--bg-surface-1:   #14171F
--bg-surface-2:   #1C2030
--bg-glass:       rgba(28, 32, 48, 0.72) with backdrop-blur(20px)
--border-subtle:  #262A38
--text-primary:   #E6E9F2
--text-secondary: #9099B0
--text-muted:     #5A6178
--accent:         #5865F2   (Discord blurple, primary action)
--accent-hover:   #4752C4
--success:        #3BA55D
--danger:         #ED4245
--warning:        #FAA61A
```

## Components

- **Button** — primary, secondary, ghost, destructive. 36 px height. 8 px radius.
- **Card (file/folder)** — surface-1 background, 1 px subtle border, 12 px radius. Hover lifts 2 px and brightens border. Selected state has accent border and a thin glow.
- **Icon system** — Custom SVG icons (no icon font): folder, file, image, video, audio, archive, document. Per-extension mapping table.
- **Breadcrumb** — Path segments separated by `/` with hover backgrounds. Each segment is clickable. Last segment is bold.
- **Drop zone** — When dragging files anywhere in main area, a 2 px dashed accent border appears and the background tints to a 4 % accent overlay.
- **Upload queue panel** — Bottom-right floating panel, 360 × auto. Lists active uploads with filename, progress bar, and cancel button. Auto-collapses when empty.
- **Modal** — Centered, 480 px max width, surface-2 background, 16 px radius, with a backdrop blur. Used for: delete confirm, rename, new folder, webhook setup.
- **Toast** — Top-right, 4 s lifetime, surface-2 with accent left border. Stacks up to 3.
- **Progress bar** — 4 px height, indeterminate pulse for unknown size, determinate fill otherwise.

## Motion

- Page transitions: 200 ms ease-out fade + 8 px upward translate.
- Card hover: 120 ms ease-out for both transform and border-color.
- Modal open/close: 160 ms scale 0.96 → 1 with fade.
- Drop zone activation: 100 ms border and background tint.
- Toast slide-in: 200 ms from the right with a 60 ms stagger between toasts.
- Reduced-motion (`prefers-reduced-motion`): all motion disabled, instant state changes.

## Interaction Patterns

- **Single click on a file/folder card:** selects it; selection ring appears.
- **Double click:** navigates into the folder / opens file preview.
- **Right click (or long press on touch):** context menu — Rename, Delete, Move (placeholder for now), Download.
- **Drag from OS desktop into the app:** triggers file upload to the current folder; concurrent uploads limited to 3 (matches backend).
- **Drag a file/folder within the app:** re-parent (move) — Phase 4.
- **Esc key:** clears current selection.
- **Cmd/Ctrl + A:** select all visible items.
- **Delete key (or trash icon):** opens confirm modal before deleting.

## Empty / Error / Loading States

- **Empty folder:** centered illustration (line drawing of a folder) + "Nothing here yet" + "Drop files to upload" CTA.
- **Loading:** skeleton cards (3 placeholder cards with shimmer animation) in the grid.
- **Error boundary:** full-area banner with a "Retry" button.
- **Auth required:** centered card with the webhook URL input and a "Connect" button. Includes helper text and a "What is a Discord webhook?" link.

## Files / Routing

- **Routes:**
  - `/` — Auth (webhook input) when not logged in; redirects to `/drive` when logged in.
  - `/drive` — Current folder (root by default).
  - `/drive/:folderId` — Specific folder.
  - `/setup` — First-run wizard (alias of `/` when not logged in).
- **Persistence:** JWT in `localStorage` (key: `wyvern.jwt`). On app boot, read JWT, verify with a lightweight `/status` round-trip, hydrate account ID from the decoded token.

## Visual Quality Bar

- All hover/focus states must be visible against the background.
- Color contrast ≥ 4.5:1 for body text and ≥ 3:1 for large text (WCAG 2.2 AA).
- Touch targets ≥ 44 × 44 px on mobile breakpoint.
- No layout shift on first paint.
- Skeleton screens must match the shape of the final content.

## What This Spec Does NOT Cover (Out of Scope)

- File preview rendering (images, video, audio) — placeholder icon only.
- Search and tag-based listing.
- Move-between-folders (drag within app).
- Real-time updates (no websocket sync).
- Trash / soft-delete.
- Sharing / public links.
- Client-side encryption.

These belong to a future phase.
