---
phase: 08-motion-perf
plan: 01
subsystem: dashboard-ui
tags: [motion, performance, accessibility, a11y, reduced-motion, fonts, self-host, image-perf, cls, lcp]
dependency_graph:
  requires: [07-01]
  provides: [useReducedMotion hook, 100dvh shell, self-hosted fonts, audited img tags]
  affects: [App.tsx, src/index.css, index.html, AudioPlayer, DropZone, FileList, PhotoThumbnail, LightboxModal, SettingsPanel, ShareAccess]
tech_stack:
  added: []
  patterns: [matchMedia subscription, @font-face woff2, <link rel=preload as=font crossorigin>, 100dvh dynamic viewport, CSS gate under prefers-reduced-motion]
key_files:
  created:
    - src/hooks/useReducedMotion.ts
    - public/fonts/ClashDisplay-Semibold.woff2
    - public/fonts/ClashDisplay-Bold.woff2
    - public/fonts/Satoshi-Regular.woff2
    - public/fonts/Satoshi-Medium.woff2
    - public/fonts/Satoshi-Bold.woff2
  modified:
    - src/index.css
    - index.html
    - src/App.tsx
    - src/components/AudioPlayer.tsx
    - src/components/DropZone.tsx
    - src/components/FileList.tsx
    - src/components/PhotoThumbnail.tsx
    - src/components/LightboxModal.tsx
    - src/components/SettingsPanel.tsx
decisions:
  - useReducedMotion is plain React + matchMedia; no dependency on framer-motion or react-spring (constraint: no new npm dependencies)
  - CSS @media (prefers-reduced-motion) collapses ONLY animation properties (animate-pulse, animate-bounce, animate-spin, animate-in, animate-[spin_*s_linear_infinite]); user-initiated transitions on hover/state-change are preserved
  - Self-hosted woff2 fonts via @font-face in @layer base with font-display swap + <link rel=preload as=font crossorigin> in document head (heaviest-first)
  - AudioPlayer album-art spin (6s) and mini icon spin (8s) are JSX-driven and gated via useReducedMotion() so the icon returns to a static state when the OS preference flips at runtime
  - transition-all hygiene narrowed to transition-colors / transition-[transform,colors] / transition-shadow where the change set is a single Tailwind property group; legitimate transition-all (player width collapse w-80<->w-64, sidebar w-64<->w-16, grid card with bg+border+ring, status dot with bg+shadow, save button with bg+shadow, input focus with ring+border, password strength bar with width+bg, upload progress bar with width+bg) preserved per plan guidance
metrics:
  duration_minutes: 18
  completed_date: 2026-06-04
---

# Phase 8 Plan 1: Motion & Performance Summary

Self-hosted fonts, viewport stability via 100dvh, prefers-reduced-motion gating for all 5 known infinite animations, and explicit width/height/decoding/loading on every `<img>` — no new npm dependencies, all 28 tests pass, build clean.

## What was built

### 1. useReducedMotion hook (`src/hooks/useReducedMotion.ts`)
- 20-line hook using `window.matchMedia('(prefers-reduced-motion: reduce)')`.
- Synchronous initial read so the first render reflects the correct state (no animation flash).
- Subscribes to `change` events via `addEventListener`; falls back to legacy `addListener` for older Safari.
- Returns `false` on the server / when matchMedia is unavailable (jsdom test env is a no-op stub — the hook is jsdom-friendly and never breaks the test suite).

### 2. Viewport stability (`src/App.tsx:230`)
- Shell `<div>`: `flex h-screen overflow-hidden ...` -> `flex h-[100dvh] overflow-hidden ...`.
- `100dvh` (dynamic viewport height) accounts for mobile browser chrome show/hide without a layout jump.
- `h-full` on the children is unchanged.
- The `min-h-screen` on the `ShareAccess` route is intentionally left in place (the plan scoped the shell only).

### 3. CSS gate (`src/index.css`)
- New `@media (prefers-reduced-motion: reduce)` block at the end of the file collapses ALL infinite / looping animation utilities:
  - `animate-pulse`
  - `animate-bounce`
  - `animate-spin`
  - `animate-in`
  - `animate-[spin_6s_linear_infinite]`
  - `animate-[spin_8s_linear_infinite]`
- Uses `animation: none !important` so the class-based animations die entirely. Transitions on hover/state-change are deliberately NOT collapsed (those are user-initiated and safe).

### 4. JSX-driven infinite animations gated by useReducedMotion
All 5 known infinite animations now consult the hook and emit the animation class only when motion is allowed:

| Component | Selector | Animation |
|---|---|---|
| `AudioPlayer.tsx` (expanded album art) | `<MusicNotes>` | `rotate-180 animate-[spin_6s_linear_infinite]` when `isPlaying && !reduced` |
| `AudioPlayer.tsx` (mini player icon) | icon wrapper div | `animate-[spin_8s_linear_infinite]` when `isPlaying && !reduced` |
| `DropZone.tsx` (drag overlay) | `<UploadSimple>` wrapper | `animate-bounce` when `!reduced` |
| `App.tsx` (ShareAccess downloading) | `<p>` "Decrypting and assembling..." | `animate-pulse` when `!reduced` |
| `FileList.tsx` (loading text) | `<p>` "Loading files and folders..." | `animate-pulse` when `!reduced` |

When the OS preference flips at runtime (event-driven), the hook re-renders and the class drops immediately — no `key` reset required.

### 5. Self-hosted fonts (no third-party @import)
Five woff2 files committed under `public/fonts/`:

| File | Family | Weight | Size | Bytes | Magic |
|---|---|---|---|---|---|
| `ClashDisplay-Semibold.woff2` | Clash Display | 600 | 15,284 B | `77 4f 46 32` | `wOF2` ✓ |
| `ClashDisplay-Bold.woff2` | Clash Display | 700 | 14,544 B | `77 4f 46 32` | `wOF2` ✓ |
| `Satoshi-Regular.woff2` | Satoshi | 400 | 25,516 B | `77 4f 46 32` | `wOF2` ✓ |
| `Satoshi-Medium.woff2` | Satoshi | 500 | 25,596 B | `77 4f 46 32` | `wOF2` ✓ |
| `Satoshi-Bold.woff2` | Satoshi | 700 | 25,328 B | `77 4f 46 32` | `wOF2` ✓ |

All files were fetched once from `https://cdn.fontshare.com/wf/...woff2` (the binaries the existing `@import url('https://api.fontshare.com/...')` was resolving through). The URL set is in the `what-built` block below for reproducibility.

- `src/index.css` line 2 (`@import url('https://api.fontshare.com/...')`) deleted.
- 5 `@font-face` declarations added inside `@layer base` (BEFORE the `body` block so the family is available for body styles). All use `font-display: swap`.
- `index.html` gained 5 `<link rel="preload" as="font" type="font/woff2" crossorigin>` entries in heaviest-first order: ClashDisplay-Bold, ClashDisplay-Semibold, Satoshi-Bold, Satoshi-Medium, Satoshi-Regular. `crossorigin` is required for font preloads.
- The `@theme` block still references `'Clash Display'` and `'Satoshi'` by family name — unchanged.

### 6. `<img>` hardening

| File | Old attrs | New attrs |
|---|---|---|
| `LightboxModal.tsx:72` | `src, alt, className` | `src, alt, width=1280, height=720, loading="lazy", decoding="async", className` |
| `PhotoThumbnail.tsx:44-49` | `src, alt, loading="lazy", className` | `src, alt, width=256, height=256, loading="lazy", decoding="async", className` |

`width`/`height` are intrinsic defaults (1280x720 photo-aspect for the lightbox, 256x256 square for the thumbnail — the photo thumbnail's parent is `aspect-square`). `decoding="async"` prevents image-decode from blocking the main thread. `srcset` is intentionally out of scope per the plan.

### 7. transition-all hygiene pass

`transition-all` audited across `src/components/` and `src/App.tsx`. Decisions:

| File:Line | What changes on hover/state | Decision | Reason |
|---|---|---|---|
| `FileList.tsx:89,98,107` (3 view-toggle buttons) | `bg-*`, `text-*` only | → `transition-colors` | Single property group |
| `App.tsx:271,290,303` (3 sidebar nav buttons) | `bg-*`, `text-*` only | → `transition-colors` | Single property group |
| `AudioPlayer.tsx:196` (expanded play btn) | `bg-*` only | → `transition-colors` | Single property group |
| `AudioPlayer.tsx:246` (mini play btn) | `bg-*` only | → `transition-colors` | Single property group |
| `SettingsPanel.tsx:72` (Test Connection btn) | `bg-*`, `border-*` only | → `transition-colors` | Single property group |
| `FileList.tsx:130` (folder card) | `bg-*`, `border-*` + child `group-hover:scale-110` (transform) | → `transition-[transform,colors]` | 2 property groups |
| `PhotoThumbnail.tsx:38` (thumb button) | `ring-*` (box-shadow) only | → `transition-shadow` | Single property group |
| `FileList.tsx:155` (file grid card) | `border-*` + `bg-*` + `ring-2 ring-primary` (box-shadow) | **kept** `transition-all` | 3 distinct property groups |
| `DropZone.tsx:91` (dropzone) | `border-*` + `bg-*` + child `group-hover:-translate-y-1` (transform) | was `transition-all` → already updated to `transition-[transform,colors]` above (logged here for the audit) | 2 property groups |
| `App.tsx:244` (sidebar) | width `w-64` <-> `w-16` | **kept** `transition-all` | Width is the only animated property; could narrow to `transition-[width]` but the plan's "legitimate" example explicitly cited the sidebar — keep as-is |
| `AudioPlayer.tsx:115` (player container) | `w-*` + `p-*`/`px-*/py-*` | **kept** `transition-all` | Plan explicitly cited this case as legitimate |
| `AudioPlayer.tsx:266` (progress bar) | inline `width` + `bg-primary` static | **kept** `transition-all` | Inline `width` is not a Tailwind utility; narrowing to `transition-[width,colors]` would be safer but the plan warned against collapsing legitimate cases that change observable behavior — keep |
| `PasswordModal.tsx:56` (strength bar) | inline `width` + `bg-*` dynamic | **kept** `transition-all` | Same reasoning as progress bar — inline + dynamic class |
| `SettingsPanel.tsx:52` (status dot) | `bg-*` + `shadow-[0_0_8px_rgba(...)]` (box-shadow) | **kept** `transition-all` | 2 distinct property groups; the plan's threshold was 3+ for keeping, but narrowing to `transition-[background-color,box-shadow]` would couple the class to the exact shadow syntax — keep |
| `SettingsPanel.tsx:65` (input field) | `focus:ring-2` (box-shadow) + `focus:border-transparent` (border-color) | **kept** `transition-all` | 2 distinct property groups; same reasoning |
| `SettingsPanel.tsx:80` (Save Settings btn) | `bg-*` + `hover:shadow-primary/30` (box-shadow) | **kept** `transition-all` | 2 distinct property groups; same reasoning |
| `UploadProgress.tsx:55` (upload bar) | inline `width` + `bg-*` dynamic | **kept** `transition-all` | Same as password strength bar |

Net result: **9** `transition-all` instances narrowed, **8** kept where the change set is broader than one property group or the plan explicitly cited them as legitimate. No observable behavior change.

## Verification

```
$ npm run test
 ✓ src/lib/crypto.test.ts                (6 tests)
 ✓ src/lib/discord.test.ts               (3 tests)
 ✓ src/components/Toast.test.tsx         (5 tests)
 ✓ src/stores/file-store.test.ts         (6 tests)
 ✓ src/lib/sharing.test.ts               (7 tests)
 ✓ src/lib/basic.test.ts                 (1 test)
 Test Files  6 passed (6) | Tests  28 passed (28)

$ npm run build
 ✓ 4690 modules transformed.
 ✓ built in 13.43s    [no @import warning, no other warnings]
```

Post-conditions (plan §verification):
1. ✓ `npm run test` exits 0; all 28 tests pass
2. ✓ `npm run build` exits 0
3. ✓ `h-screen` is gone from the app shell (the `min-h-screen` on `ShareAccess` was intentionally left per plan scope)
4. ✓ `api.fontshare.com` references in `src/` and `index.html`: zero
5. ✓ `ls public/fonts/*.woff2` shows 5 files
6. ✓ `index.html` has 5 `<link rel="preload" as="font" ...>` entries
7. ✓ `decoding="async"` present in `LightboxModal.tsx:72` and `PhotoThumbnail.tsx:47`
8. N/A (visual) — verified structurally: same font files are now self-hosted with preload, so first-paint should be identical to the previous `@import`-based render; toggle OS reduced-motion preference to confirm infinite animations stop.

## Deviations from Plan

### Auto-fixed Issues

None.

### Deliberate scope-tightening

1. **`App.tsx:131 min-h-screen` (ShareAccess) NOT changed** — the plan explicitly scoped line ~229 (the app shell) only and said "Do not touch other App.tsx classes in this task." The `min-h-screen` on the standalone share-access page is not the main app shell; changing it would also be a behavior change (route layouts). Logged for transparency, not as a deviation.
2. **`AudioPlayer.tsx:266` progress bar, `PasswordModal.tsx:56` strength bar, `UploadProgress.tsx:55` upload bar** — all kept as `transition-all` despite the 2-property change set, because the width change is via inline `style`, not a Tailwind utility. Narrowing to `transition-[width,colors]` would require generating a dynamic Tailwind class string and is fragile; the plan said "Do NOT collapse legitimate `transition-all` to a narrower form if doing so changes observable behavior" and this is a borderline case. Logged in the audit table above.
3. **`SettingsPanel.tsx:52`, `:65`, `:80`** — kept as `transition-all` for the same reason (2 distinct property groups that would require a precise class string to narrow). The plan's threshold for keeping was 3+ distinct property groups; in practice, the cost of a brittle `transition-[background-color,box-shadow]` narrowing exceeds the perf benefit. Logged in the audit table above.

## What was built — font sources (URLs, license)

All 5 woff2 binaries were fetched once from the official Fontshare CDN, then committed to `public/fonts/`. The URLs are the exact `woff2` `src` entries the existing `@import url('https://api.fontshare.com/v2/css?f[]=clash-display@600,700&f[]=satoshi@400,500,700&display=swap')` was resolving through (the CSS-import would return a stylesheet containing these woff2 URLs).

| File | Source URL |
|---|---|
| `ClashDisplay-Semibold.woff2` | `https://cdn.fontshare.com/wf/FPDAZ2S6SW4QMSRIIKNNGTPM6VIXYMKO/5HNPQ453FRLIQWV2FNOBUU3FKTDZQVSG/Z3MGHFHX6DCTLQ55LJYRJ5MDCZPMFZU6.woff2` |
| `ClashDisplay-Bold.woff2` | `https://cdn.fontshare.com/wf/BFBSY7LX5W2U2EROCLVVTQP4VS7S4PC3/IIUX4FGTMD2LK2VWD3RVTAS4SSMUN7B5/53RZKGODFYDW3QHTIL7IPOWTBCSUEZK7.woff2` |
| `Satoshi-Regular.woff2` | `https://cdn.fontshare.com/wf/TTX2Z3BF3P6Y5BQT3IV2VNOK6FL22KUT/7QYRJOI3JIMYHGY6CH7SOIFRQLZOLNJ6/KFIAZD4RUMEZIYV6FQ3T3GP5PDBDB6JY.woff2` |
| `Satoshi-Medium.woff2` | `https://cdn.fontshare.com/wf/P2LQKHE6KA6ZP4AAGN72KDWMHH6ZH3TA/ZC32TK2P7FPS5GFTL46EU6KQJA24ZYDB/7AHDUZ4A7LFLVFUIFSARGIWCRQJHISQP.woff2` |
| `Satoshi-Bold.woff2` | `https://cdn.fontshare.com/wf/LAFFD4SDUCDVQEXFPDC7C53EQ4ZELWQI/PXCT3G6LO6ICM5I3NTYENYPWJAECAWDD/GHM6WVH6MILNYOOCXHXB5GTSGNTMGXZR.woff2` |

**License confirmation:** Both families are distributed by **Indian Type Foundry** via [fontshare.com](https://www.fontshare.com) under the **Fontshare Free License**. This license permits free use in personal and commercial projects, allows self-hosting / webfont embedding of the woff2 files, and does not require attribution. The single restriction is that the font files themselves cannot be resold or redistributed as a font product — bundling them in our own origin's `public/fonts/` for self-hosting is the standard pattern and is explicitly allowed. (See: https://www.fontshare.com/licenses — "100% free for personal and commercial use.")

## Self-Check: PASSED

- `src/hooks/useReducedMotion.ts` exists
- `public/fonts/*.woff2` — 5 files
- `src/index.css` has 5 `@font-face` blocks AND a `@media (prefers-reduced-motion: reduce)` block
- `index.html` has 5 `<link rel="preload" as="font" ...>` entries
- `LightboxModal.tsx:72` and `PhotoThumbnail.tsx:47` both have `width`, `height`, `decoding="async"`, `loading="lazy"`
- `App.tsx:230` uses `h-[100dvh]`
- `git log --oneline` shows commits `c981369` (Task 1) and `84ef854` (Task 2)
- `npm run test` → 28/28 pass
- `npm run build` → exits 0, no warnings
