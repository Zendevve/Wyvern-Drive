# Roadmap: Wyvern Drive

**Phases:** 10 | **Requirements:** 28 | **Coverage:** 100% ✓

## Overview

| # | Phase | Goal | Requirements | Plans |
|---|-------|------|--------------|-------|
| 1 | Core Storage Engine | File upload/download with encryption works end-to-end | Complete    | 2026-06-03 |
| 2 | File Management | Folder system, versioning, search, virtual scrolling | Complete    | 2026-06-03 |
| 3 | Media & Sharing | In-browser streaming, persistent player, secure sharing, photo timeline | Complete | 2026-06-03 |
| 4 | Polish & Ship | Production UI, accessibility, PWA, test coverage | Complete | 2026-06-03 |
| 5 | Professional UI Redesign | 5/5 | Complete    | 2026-06-04 |
| 6 | Theme Unifier | Migrate orphan Discord-purple classes onto theme tokens; add light+dark semantic surfaces; fix banned em-dash | Complete | 1 plan |
| 7 | Iconography | Replace every emoji-as-icon with @phosphor-icons/react; centralise file-type resolver | Complete | 1 plan |
| 8 | Motion & Performance | 100dvh shell, prefers-reduced-motion gate, self-hosted fonts, image perf, transition-all hygiene | Complete | 1 plan |
| 9 | Visual Discipline | Document shape scale, z-index scale, semantic colors; replace neon glows and hardcoded color literals | Complete | 1 plan |
| 10 | AGENTS.md | Durable design discipline rule set for the repo | Planned | 1 plan |

## Phase Details

### Phase 1: Core Storage Engine

**Goal:** User can upload, encrypt, chunk, and download files via Discord webhooks — the entire storage pipeline works end-to-end.

**Requirements:**

- STRG-01: Client-side AES-256-GCM encryption (PBKDF2 600K iterations)
- STRG-02: Unlimited file storage via Discord CDN webhooks
- STRG-03: Smart chunking (8MB default) with parallel uploads
- INFRA-01: Self-hosted deployment (static files)
- INFRA-02: Environment-based webhook configuration
- INFRA-03: Discord API rate limit handling with backoff
- INFRA-04: CDN URL refresh via stored message IDs

**Success Criteria:**

1. User can configure Discord webhook URL and validate it works
2. User can upload any file size — it chunks, encrypts, and sends to Discord
3. Files are encrypted with AES-256-GCM before leaving the browser
4. Large files (>8MB) split into chunks and upload in parallel with progress indicator
5. User can download files — chunks are fetched, decrypted, and reassembled
6. Rate limit errors (429) trigger automatic backoff and retry
7. App deployed as static files with no backend server

**Plans:** 1/1 plans complete

---

### Phase 2: File Management

**Goal:** Organize files in folders, track versions, search effectively, and handle 10K+ files smoothly.

**Requirements:**

- FILE-01: Full folder system (create, rename, delete, move, nested)
- FILE-02: Drag & drop file/folder organization
- FILE-03: File versioning with history
- FILE-04: Advanced search (name, type, date, folder)
- STRG-04: Virtual scrolling for 10K+ files

**Success Criteria:**

1. User can create, rename, delete, and move folders (including nested)
2. User can drag files and folders to reorganize them
3. File versions are tracked — user can view and restore previous versions
4. Search filters files by name, type, date, and current folder
5. File browser renders 10K+ items smoothly via virtual scrolling (no jank)

**Plans:** 1/1 plans complete

---

### Phase 3: Media & Sharing

**Goal:** Preview media in-browser, play audio continuously across navigation, share files securely, and browse photos chronologically.

**Requirements:**

- MEDIA-01: In-browser media streaming (images, video, audio)
- MEDIA-02: Persistent audio player across navigation
- SHAR-01: Password-protected, time-limited share links
- SHAR-02: Photo timeline (Google Photos-style gallery)

**Success Criteria:**

1. Images display inline, videos play in-browser, audio plays with custom player
2. Audio player persists and continues playing when navigating to other pages
3. Share links can be generated with password protection and expiration time
4. Photo timeline shows images in chronological grid layout

**Plans:** 1 (media & sharing features implementation)

---

### Phase 4: Polish & Ship

**Goal:** Production-ready dark theme UI, full accessibility, PWA installability, and comprehensive test coverage.

**Requirements:**

- UI-01: Discord-inspired dark theme, fully responsive
- UI-02: WCAG AA accessible, keyboard navigable
- UI-03: PWA ready (service worker, manifest, installable)
- TEST-01: Integration tests with mocked Discord API
- TEST-02: E2E tests with Playwright

**Success Criteria:**

1. Dark theme responsive across all viewports (mobile to desktop)
2. All interactive elements keyboard accessible, screen reader compatible
3. PWA installs on mobile and desktop via service worker + manifest
4. Integration tests pass for upload/download/encryption with mocked Discord API
5. E2E tests cover core user journeys via Playwright

**Plans:** 1 (UI polish, accessibility, PWA, and testing)

---

## Dependency Graph

All phases are sequential — each builds on the previous.

```
Phase 1: Core Storage Engine
    ↓
Phase 2: File Management
    ↓
Phase 3: Media & Sharing
    ↓
Phase 4: Polish & Ship
    ↓
Phase 5: Professional UI Redesign
    ↓
Phase 6: Theme Unifier
    ↓
Phase 7: Iconography
    ↓
Phase 8: Motion & Performance
    ↓
Phase 9: Visual Discipline
    ↓
Phase 10: AGENTS.md
```

### Phase 5: Professional UI Redesign

**Goal:** Redesign the user interface to elevate it from a basic hobby project to a premium, professional product on par with Google Drive, MEGA, and Dropbox.
**Requirements:**

- UI-04: Collapsible left sidebar navigation dashboard layout
- UI-05: Dual light and dark theme styling using modern slate/zinc CSS variable tokens and glassmorphism
- UI-06: Toggleable Grid and List views in FileBrowser with inline folder pills
- UI-07: Right-side collapsible details drawer panel for file metadata, inline versions list, and inline sharing config
- UI-08: Persistent audio player floating dock with mini and expanded modes
- UI-09: Window-level global drag-and-drop upload overlay

**Depends on:** Phase 4
**Plans:** 5/5 plans complete

Plans:

- [ ] Plan 01: Theme System & App Grid Shell
- [ ] Plan 02: Fullscreen Upload DropZone Overlay
- [ ] Plan 03: File Browser Grid/List Toggle & Folder Card View
- [ ] Plan 04: Floating Glassmorphic Audio Player
- [ ] Plan 05: Collapsible Right-Side Details Drawer

---

### Phase 6: Theme Unifier

**Goal:** Every modal, toast, progress card, and timeline surfaces through the --card / --primary / --text-muted theme tokens; light AND dark mode render correctly; the banned em-dash in PasswordModal is removed.

**Requirements:** UI-01, UI-02

**Success Criteria:**

1. Zero references to orphan Discord classes (bg-blurple, bg-darker-bg, bg-dark-bg, text-discord-muted, text-discord-text, border-gray-600/700, accent-blurple) in the 6 scoped component files
2. Toast variants render correctly in BOTH light and dark mode (success, error, default)
3. Toast color uses --error / --success tokens via the new --surface-error / --surface-success soft-tint tokens
4. PasswordModal strength meter uses theme tokens (--destructive / --warning / --success) instead of bg-red-500/yellow-500/green-500
5. PasswordModal strength label is the ASCII word "None" (banned em-dash U+2014 removed)
6. `npm run test` and `npm run build` both exit 0

**Depends on:** Phase 5
**Plans:** 1 plan

Plans:

- [x] 06-01-PLAN.md — Theme token migration + new semantic surface tokens

---

### Phase 7: Iconography

**Goal:** Zero emoji-as-icon in the app; a single icon resolver for file types; accessible names on every icon-only button.

**Requirements:** UI-02

**Success Criteria:**

1. `@phosphor-icons/react@^2.1.7` installed; the package is [VERIFIED] legitimacy (Phosphor Icons team, MIT, used by Vercel/Linear/Cal.com)
2. `src/components/icon-map.ts` exists with `getFileIcon(mimeType)` covering all 8 mime-type branches
3. Zero emoji characters render as icons in any .tsx file under src/components/
4. Phosphor icons render at weight="regular" (strokeWidth=1.5) with aria-hidden="true"; every icon-only button keeps its aria-label
5. All 28 unit/integration tests pass; `npm run build` exits 0

**Depends on:** Phase 6
**Plans:** 1 plan

Plans:

- [x] 07-01-PLAN.md — Install Phosphor + replace emoji-as-icon across 9 components

### Phase 8: Motion & Performance

**Goal:** Viewport stability, prefers-reduced-motion compliance, self-hosted fonts, and audited image dimensions — no third-party render-blocking requests, no infinite animations under reduced motion.

**Requirements:** UI-01, UI-02

**Success Criteria:**

1. App shell uses `h-[100dvh]` (not `h-screen`); no mobile viewport jump
2. `src/hooks/useReducedMotion.ts` exists with a 20-line `useReducedMotion(): boolean` hook
3. `src/index.css` contains a `@media (prefers-reduced-motion: reduce)` block that collapses `animate-pulse`, `animate-bounce`, `animate-spin`, `animate-in`, and `animate-[spin_*s_linear_infinite]`
4. All 4 known JSX-driven infinite animations (AudioPlayer album art spin, AudioPlayer mini icon spin, DropZone drag overlay bounce, ShareAccess/FileList loading pulse) are gated behind `useReducedMotion()`
5. `transition-all` is replaced with a narrower property list where the change set is actually narrow (audit results recorded in the SUMMARY); legitimate `transition-all` cases (audio player width collapse, sidebar width collapse) are preserved
6. 5 woff2 files committed under `public/fonts/` (ClashDisplay-Semibold, ClashDisplay-Bold, Satoshi-Regular, Satoshi-Medium, Satoshi-Bold)
7. `src/index.css` declares 5 `@font-face` blocks and no longer imports from `api.fontshare.com`
8. `index.html` has 5 `<link rel="preload" as="font" crossorigin>` entries
9. Every `<img>` tag (LightboxModal, PhotoThumbnail) has explicit `width`, `height`, `decoding="async"`, `loading="lazy"`
10. `npm run test` and `npm run build` both exit 0

**Depends on:** Phase 7
**Plans:** 1 plan

Plans:

- [x] 08-01-PLAN.md — Viewport + motion gate + transition-all hygiene + self-hosted fonts + image perf

---

### Phase 9: Visual Discipline

**Goal:** Three documented scales (shape, z-index, semantic color) and the elimination of every neon outer glow and hardcoded color literal.

**Requirements:** UI-01, UI-02

**Success Criteria:**

1. `src/constants/tokens.ts` exports `SHAPE_SCALE`, `Z_INDEX`, `SEMANTIC_COLORS` — all Tailwind class strings, all referencing declared `@theme` tokens
2. `src/index.css` has a documentation comment block describing the scales
3. All `rounded-2xl` and `rounded-3xl` in components are converted to `rounded-xl`; `rounded-lg` / `rounded-xl` / `rounded-full` are the only border-radius values used
4. The two neon-glow webhook status dots (App.tsx, SettingsPanel.tsx) are replaced with a saturated solid + 2px ring (no `shadow-[0_0_8px_rgba(...)]`)
5. Zero `text-emerald-500` / `text-rose-500` / `text-amber-500` / `bg-blue-500/10` / `bg-purple-500/10` / `bg-orange-500/10` / `bg-rose-500/10` literals in src/components/ — all replaced with theme tokens
6. Zero raw `z-0` / `z-10` / `z-40` / `z-50` / `z-[N]` in src/components/, src/App.tsx, index.html — all replaced with `Z_INDEX.*` constants
7. `npm run test` and `npm run build` both exit 0

**Depends on:** Phase 8
**Plans:** 1 plan

Plans:

- [x] 09-01-PLAN.md — Create tokens.ts, replace neon glows, enforce shape/z-index/colors

---

### Phase 10: AGENTS.md

**Goal:** A durable, scannable rule set at the repo root that future agents and humans can read to learn the dial values, the token sources, the icon library, the motion rules, the a11y rules, the perf rules, the anti-patterns, and the explicit out-of-scope marketing-page rules.

**Requirements:** UI-01, UI-02

**Success Criteria:**

1. `AGENTS.md` exists at the repo root, is < 400 lines
2. 11 sections present: Project Snapshot, Design Dials, Tokens, Icons, Motion, Accessibility, Performance, Anti-Patterns, Out of Scope, Working with this repo, When in Doubt
3. Cross-references point to LIVE source files (`src/constants/tokens.ts`, `src/index.css`, `src/components/icon-map.ts`, `src/hooks/useReducedMotion.ts`) — not duplicated content
4. Marketing-page vocabulary (hero, bento, marquee, eyebrow caps, zigzag cap, trusted-by wall, scroll cue, premium consumer palette, Marrow) appears ONLY in section 9 (Out of Scope) — never in active guidance
5. `npm run test` and `npm run build` both exit 0

**Depends on:** Phase 9
**Plans:** 1 plan

Plans:

- [ ] 10-01-PLAN.md — Write AGENTS.md

---
*Roadmap created: 2026-06-03*
*Last updated: 2026-06-04 (phases 6-10 added: design discipline pass — theme unifier, iconography, motion & perf, visual discipline, AGENTS.md)*
