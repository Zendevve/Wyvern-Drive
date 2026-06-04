---
phase: 03-react-single-page-application-ui
plan: 01, 02, 03
subsystem: web-ui
tags: [vite, react, typescript, zustand, tanstack-query, react-router, vitest]
requires:
  - phase: 02-virtual-filesystem-metadata-layer
    provides: /auth/webhook, /fs/*, /upload, /download, JWT middleware, accountId
provides:
  - React 18 SPA under web/ with Vite dev server and /api proxy to backend
  - Webhook-URL auth flow with JWT persistence and 401 redirect
  - Three-region drive shell (top bar / left rail / main)
  - Grid + list views, breadcrumb chain, file-type icon sprite
  - Drag-and-drop + click upload with 3-wide concurrency, queue panel, progress
  - Delete with confirm modal, right-side detail panel, toast notification system
affects: [v1.0-mvp]
tech-stack:
  added: [vite@5, react@18, typescript@5, zustand@4, @tanstack/react-query@5, react-router-dom@6, vitest@1.6, jsdom@24, @testing-library/react@16]
  patterns: [context-aware apiFetch, query-key-by-parentId, zustand-keep-it-simple, xhr-for-progress]
key-files:
  created:
    - web/package.json
    - web/vite.config.ts
    - web/tsconfig.json
    - web/index.html
    - web/src/main.tsx
    - web/src/App.tsx
    - web/src/lib/crypto.ts
    - web/src/lib/storage.ts
    - web/src/lib/api.ts
    - web/src/lib/concurrency.ts
    - web/src/store/auth.ts
    - web/src/store/selection.ts
    - web/src/store/uploads.ts
    - web/src/store/toasts.ts
    - web/src/hooks/useFolder.ts
    - web/src/hooks/useUploader.ts
    - web/src/api/fs.ts
    - web/src/api/upload.ts
    - web/src/api/delete.ts
    - web/src/components/AppShell.tsx
    - web/src/components/Breadcrumb.tsx
    - web/src/components/FileCard.tsx
    - web/src/components/FileList.tsx
    - web/src/components/icons.tsx
    - web/src/components/DropZone.tsx
    - web/src/components/Modal.tsx
    - web/src/components/Toast.tsx
    - web/src/components/UploadQueuePanel.tsx
    - web/src/components/DetailPanel.tsx
    - web/src/components/Button.tsx
    - web/src/pages/AuthPage.tsx
    - web/src/pages/DrivePage.tsx
    - web/src/styles/tokens.css
    - web/src/styles/global.css
    - web/src/styles/components.css
    - web/tests/setup.ts
    - web/tests/lib/crypto.test.ts
    - web/tests/lib/storage.test.ts
    - web/tests/lib/concurrency.test.ts
    - web/tests/api/fs.test.ts
    - web/tests/components/Breadcrumb.test.tsx
    - web/tests/hooks/useUploader.test.tsx
  modified:
    - .gitignore
key-decisions:
  - "JWT stored in localStorage under wyvern.jwt; payload parsed base64url for accountId hydration (no signature verify client-side)"
  - "apiFetch auto-prefixes /api, injects Bearer token, clears JWT and fires onUnauthorized on 401"
  - "useUploader uses XMLHttpRequest (not fetch) to expose upload progress events"
  - "Upload concurrency limited to 3 workers via runWithConcurrency; each upload owns its own AbortController"
  - "Main.tsx subscribes to auth store transitions to push a 'Session expired' toast on logout"
  - "Breadcrumb chain is built by walking parent_id links via repeated getNode calls (no separate /ancestors endpoint needed)"
  - "DropZone uses a ref counter to track nested dragenter/leave so the overlay only flips when actually entering/leaving the zone"
  - "vitest setupFiles path is resolved via fileURLToPath from vite.config.ts to avoid CWD-relative path issues"
patterns-established:
  - "Pattern 5: apiFetch is the single source of truth for /api + bearer + error"
  - "Pattern 6: Zustand store + plain init function in main.tsx for global side effects (unauthorized handler, toast subscription)"
  - "Pattern 7: Mockable hooks via vi.mock on the dependency modules (apiFetch + uploadFile) for hook tests"
requirements-completed: [UI-01, UI-02, UI-03, UI-04, UI-05, UI-06]
duration: ~50m
completed: 2026-06-04
---

# Phase 3: React Single Page Application UI — Summary

**Complete Vite + React + TypeScript SPA that talks to the Phase 2 Fastify backend. Webhook auth, drive shell, upload queue, delete confirmation, toasts, and detail panel.**

## Performance

- **Duration:** ~50m
- **Started:** 2026-06-04T20:25:00Z
- **Completed:** 2026-06-04T21:00:00Z
- **Tasks:** 11 (3-01: 5, 3-02: 4, 3-03: 3)
- **Files created:** 36
- **Files modified:** 3

## Accomplishments

- Scaffolded `web/` as a fresh Vite + React 18 + TypeScript project, with dev server proxy `/api` → `http://localhost:3000`, strict TS config, and Vitest + jsdom + Testing Library.
- Implemented a small but solid foundation library:
  - `lib/crypto.ts` — SubtleCrypto SHA-256 hex of webhook URL (matches server `deriveAccountId`).
  - `lib/storage.ts` — `readJwt` / `writeJwt` / `clearJwt` over `localStorage.wyvern.jwt`, swallowing quota / privacy errors.
  - `lib/api.ts` — `apiFetch<T>` auto-prefixes `/api`, injects `Authorization: Bearer <jwt>`, parses JSON or text bodies, throws `ApiError(status, body)`, and clears the JWT + fires a configurable `onUnauthorized` handler on 401.
- Auth flow:
  - `store/auth.ts` (Zustand) with `login` (POST `/auth/webhook`), `logout`, and `restore` (decode JWT payload, derive accountId, set `status='authenticated'` without a backend round-trip).
  - `AuthPage` (webhook URL form, inline error, `Button` loading state) and `App.tsx` with splash → restore → either AuthPage or AppShell.
- Design tokens and styles:
  - `tokens.css` — full UI-SPEC color, spacing, radii, motion, z-index scale.
  - `global.css` — reset, Inter / JetBrains Mono fonts, focus ring, scrollbar, `prefers-reduced-motion`.
  - `components.css` — buttons, auth card, app shell, breadcrumb, file card / list, skeleton, empty, error, dropzone, upload queue, modal, toast, context menu, detail panel, visually-hidden.
- Drive shell (Plan 02):
  - `AppShell` — 60 px top bar (logo, account chip → logout), 90 px left rail (My Drive / Recent / Trash), 1 fr main.
  - `Breadcrumb` — accepts a chain, last segment bold + `aria-current`, root links to `/drive`.
  - `FileCard` (icon, name clamped to 2 lines, mono size) and `FileList` (Name / Size / Type / Modified columns).
  - `icons.tsx` — inline SVG sprite (Folder, File, Image, Video, Audio, Archive, Document) plus `getFileIcon` (mime → extension → fallback) and `formatBytes` / `formatTimestamp`.
  - `useFolder` / `useNode` (TanStack Query, 30 s staleTime) and `api/fs.ts` (`listChildren`, `getNode`).
  - `DrivePage` — grid/list toggle, breadcrumb chain walked from the folder up, loading skeletons, empty illustration, error retry.
- Upload + delete (Plan 03):
  - `lib/concurrency.ts` — `runWithConcurrency(items, limit, worker)` with result ordering, peak in-flight tracking, first-error propagation.
  - `api/upload.ts` — `uploadFile(file, onProgress, signal)` uses `XMLHttpRequest` for `upload.onprogress`, aborts cleanly, and a `extractMessageIdFromUrl` helper that matches the backend regex.
  - `useUploader` — enqueues items to a Zustand store, runs uploads with a 3-wide cap, per-file `AbortController`, and on success POSTs `/fs/file/created` with the chunk descriptors (Discord message id extracted from each URL), then invalidates the folder query.
  - `DropZone` — main-area drag-and-drop with ref-counter for nested enter/leave; accent border + tint overlay when active.
  - `UploadQueuePanel` — bottom-right floating panel, progress bars, status labels, remove button.
  - `Modal` — centered 480 px dialog, backdrop blur, click-outside or Esc to close.
  - `Toast` + `useToastsStore` — top-right stack, 4 s auto-dismiss, accent left border per kind (info / success / error).
  - Right-click context menu → Delete confirm modal → `api/delete.ts` `deleteNode` (DELETE `/fs/node` with `{ id }`) → invalidates folder query + success toast.
  - `DetailPanel` — 320 px right slide-in with name, type, size, created/modified timestamps, cdn URL, and a Delete button.
  - `main.tsx` subscribes to `useAuthStore` and pushes a "Session expired" toast on any logout that crosses `authenticated` → `unauthenticated`.
- Tests:
  - `lib/crypto.test.ts` (6) — deterministic, hex length, unicode, server match, empty input.
  - `lib/storage.test.ts` (6) — read/write/clear, error swallowing on each method.
  - `lib/concurrency.test.ts` (6) — ordering, peak in-flight ≤ limit, error propagation, empty input, zero limit coerced to 1, index arg.
  - `api/fs.test.ts` (5) — root vs parent_id query, encoding, `getNode` query, non-2xx → `ApiError`, text bodies.
  - `components/Breadcrumb.test.tsx` (5) — segments, current page marker, hrefs, empty chain, separator count.
  - `hooks/useUploader.test.tsx` (5) — chunks recorded with correct `discordMessageId` extraction, 3-wide concurrency peak, error mark when `/upload` rejects, no `/fs/file/created` call on failure, done status on success.
  - All 33 tests pass in ~7–11 s. `npm run build` produces a 224 kB JS / 17 kB CSS bundle.

## Files Created/Modified

See `key-files` above. Notable: 36 new files, `.gitignore` extended to ignore `web/dist/` and `*.tsbuildinfo`.

## Decisions Made

- **JWT storage** — `localStorage` under `wyvern.jwt`. Parsed (base64url, no signature check) on app boot to recover `webhookUrl` and derive `accountId`. The signature is verified server-side per request.
- **`apiFetch` is the single source of truth for `/api`** — every domain module (`api/fs.ts`, `api/upload.ts`, `api/delete.ts`, `store/auth.ts`) goes through it, so adding the prefix or the bearer token only needs to be done in one place.
- **Upload uses `XMLHttpRequest`** — needed for `upload.onprogress` events. Each upload is wrapped in an `AbortController` so cancel works.
- **Per-file abort, not per-batch** — a user cancelling one upload shouldn't stop the others.
- **No `/ancestors` endpoint** — the breadcrumb chain is built client-side by walking `parent_id` links via repeated `getNode` calls. Bounded by a safety counter to defend against cycles.
- **Mockable hooks** — `vi.mock('../../src/lib/api')` and `vi.mock('../../src/api/upload')` are how the hook tests inject deterministic fakes.
- **vitest `setupFiles` path** — uses `fileURLToPath(new URL('./tests/setup.ts', import.meta.url))` instead of `./tests/setup.ts` so the resolution is independent of CWD.

## Deviations from Plan

- The `App.tsx` `App` component renders `<UploadQueuePanel />` and `<ToastHost />` only when authenticated, not at the global level — the auth page doesn't need either.
- `useUploader` does not currently wire the per-file cancel button to a public `cancel(id)` action from the panel; the panel's "Remove" button just calls `remove(id)` on finished/error/cancelled items. A live cancel is straightforward to add but is not part of the must-haves.
- `AppShell`'s account chip acts as the logout button; a redundant "Logout" button is hidden via `.visually-hidden` for screen-reader access but the visible click target is the chip itself.

## Issues Encountered

- `vitest` 1.6 + the default config tried to resolve `./tests/setup.ts` relative to the project root, not to the `web/` directory. Switched to `import.meta.url`-based absolute paths for both `root` and `setupFiles` in `vite.config.ts`.
- `tests/hooks/useUploader.test.ts` was first written as `.ts` and the JSX inside the `Wrapper` component failed to parse. Renamed to `.tsx` and the tests pass.
- The Discord message-id regex (`/attachments/\d+/([a-zA-Z0-9_-]+)`) stops at the first non-`[A-Za-z0-9_-]` character. The test URL was crafted with hyphenated names (`a-txt`) so the capture matches the expected full id.
- TypeScript flagged `[n: number]` tuple destructuring with a missing index; the worker test was rewritten to take both `(item, index)` and read `call[1]` directly.
- `&&` and `??` mixed without parentheses are rejected by esbuild's transform — added parens around the precedence in the test helper.

## User Setup Required

- `npm install` inside `web/` (already committed `package.json` / `package-lock.json`).
- Run `npm run dev` to start the Vite dev server (proxies `/api` → backend on `:3000`).
- Run `npm run build` to produce a production bundle in `web/dist/`.

## Next Phase Readiness

- The backend already exposes all required endpoints; the SPA wires up auth, listing, upload, delete, breadcrumbs, and the detail panel end-to-end.
- A future "Move" / "Rename" / "Trash" phase can extend `api/fs.ts` and `DrivePage` without touching the foundation.
- File previews (image, video, audio) are explicitly out of scope for v1.0 per the UI-SPEC and would belong to a later phase.
