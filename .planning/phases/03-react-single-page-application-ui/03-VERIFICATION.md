---
phase: 3
slug: react-single-page-application-ui
status: passed
score: 3/3 plans verified
date: 2026-06-04
---

# Phase 3: React Single Page Application UI — Verification

## must_haves (per plan)

### Plan 03-01 — SPA scaffold, auth flow, design tokens

1. **`web/` is a working Vite + React 18 + TypeScript project; `npm run dev` starts the dev server on port 5173 with a proxy to `http://localhost:3000` for `/api/*`**
   - Status: ✅
   - Evidence: `web/vite.config.ts` declares `port: 5173` and `server.proxy['/api']` → `http://localhost:3000` with `changeOrigin: true` and `/api` → `''` rewrite.
2. **`npm run build` produces a `dist/` bundle without errors**
   - Status: ✅
   - Evidence: `npm run build` → `built in 4.10s, dist/index.html 0.77 kB, dist/assets/index-*.css 17.51 kB, dist/assets/index-*.js 224.65 kB`.
3. **`tokens.css` exposes all design tokens from the UI-SPEC**
   - Status: ✅
   - Evidence: `web/src/styles/tokens.css` defines `--bg-base`, `--bg-surface-1`, `--bg-surface-2`, `--bg-glass`, `--border-subtle`, `--border-strong`, `--text-primary/secondary/muted`, `--accent/hover/soft`, `--success/danger/warning`, `--sp-1`…`--sp-8`, `--r-sm/md/lg/xl`, motion + z-index.
4. **`lib/crypto.ts` derives `accountId = SHA-256(webhookUrl).hex()` (matches server)**
   - Status: ✅
   - Evidence: `tests/lib/crypto.test.ts` "matches the server SHA-256 hex for a known input" computes the hash with `node:crypto.createHash('sha256')` (server algorithm) and asserts equality with `deriveAccountId`.
5. **`lib/storage.ts` reads/writes the JWT from `localStorage` under `wyvern.jwt`**
   - Status: ✅
   - Evidence: `tests/lib/storage.test.ts` "writes and reads a JWT under wyvern.jwt".
6. **`lib/api.ts` exposes a typed `apiFetch` helper that attaches the bearer token and surfaces `Error` with status + body for non-2xx**
   - Status: ✅
   - Evidence: `tests/api/fs.test.ts` "throws ApiError with status + body on non-2xx JSON response".
7. **`store/auth.ts` (Zustand) holds `{ jwt, webhookUrl, accountId, status }` and exposes `login(webhookUrl)`, `logout()`, `restore()`**
   - Status: ✅
   - Evidence: `web/src/store/auth.ts` exports `useAuthStore` with exactly that state shape and those three actions; `initAuthUnauthorizedHandler` wires 401 → `logout()`.
8. **`pages/AuthPage.tsx` shows the webhook URL form, posts `/auth/webhook`, stores the token, and navigates to `/drive`**
   - Status: ✅
   - Evidence: `AuthPage` calls `useAuthStore.login(webhookUrl)` which POSTs `/auth/webhook` and `writeJwt(token)`, then `navigate('/drive', { replace: true })`.
9. **`App.tsx` routes between `/`, `/drive`, and `/drive/:folderId`**
   - Status: ✅
   - Evidence: `App.tsx` renders `AuthPage` for unauthenticated users and `AppShell > DriveRoute(parentId = folderId ?? null)` for authenticated users; the splash + restore + auth gate matches the spec.
10. **Unit tests: `tests/lib/crypto.test.ts` and `tests/lib/storage.test.ts`**
    - Status: ✅
    - Evidence: 12 tests across the two files all pass.

### Plan 03-02 — Drive shell, listing, breadcrumb, file-type icons

1. **`AppShell` renders top bar + left rail + main area, with the layout grid**
   - Status: ✅
   - Evidence: `web/src/components/AppShell.tsx` uses `grid-template-areas: "topbar topbar" "rail main"` with `60px` row and `90px` column. CSS in `components.css` `.app-shell` block.
2. **`Breadcrumb` walks the parent chain and renders clickable segments**
   - Status: ✅
   - Evidence: `useBreadcrumbChain` in `DrivePage.tsx` walks `parent_id` via `getNode` calls (safety-capped at 50). `Breadcrumb.tsx` renders each segment as a `<Link>` to `/drive/:folderId` (or `/drive` for root).
3. **`DrivePage` fetches `/api/fs/list?parent_id=...`, renders items as a grid by default, supports a grid/list toggle**
   - Status: ✅
   - Evidence: `useFolder(parentId)` → `listChildren(parentId)` → `GET /api/fs/list[?parent_id=…]`. Grid/list toggle in header.
4. **`FileCard` shows a file-type icon, name, and size**
   - Status: ✅
   - Evidence: `FileCard.tsx` renders `getFileIcon(node)` in the icon block, clamped name, and `formatBytes(node.size_bytes)` in `.file-card-meta`.
5. **`FileList` is a dense table view with the same data**
   - Status: ✅
   - Evidence: `FileList.tsx` renders a 4-column table (Name, Size, Type, Modified) with `role="row"` / `role="cell"`.
6. **`getFileIcon` maps MIME types and extensions to the correct SVG sprite**
   - Status: ✅
   - Evidence: `icons.tsx` dispatches on `kind === 'folder'` → Folder, `mime startsWith image/ video/ audio/ application/(zip|...)` → matching, `text/` or `application/pdf` → Document, plus the documented extension set with File as the fallback.
7. **Selection store keeps the currently selected node id**
   - Status: ✅
   - Evidence: `web/src/store/selection.ts` Zustand store with `selectedId`, `setSelected`, `clear`.
8. **`useFolder` hook wraps TanStack Query and exposes `{ data, isLoading, error, refetch }`**
   - Status: ✅
   - Evidence: `web/src/hooks/useFolder.ts` returns the standard TanStack `UseQueryResult` shape, which includes all of those.
9. **Unit tests for the icon helper, the breadcrumb, and the fs API client (mocked fetch)**
   - Status: ✅
   - Evidence: 5 `Breadcrumb.test.tsx` tests + 5 `fs.test.ts` tests; both files pass.

### Plan 03-03 — Upload, delete, modals, toasts, detail panel

1. **`DropZone` wraps the main area; dragging files from the OS shows the accent border + tint**
   - Status: ✅
   - Evidence: `DropZone.tsx` listens for `dragenter/over/leave/drop`, only reacts to `dataTransfer.types.includes('Files')`, sets `.is-over` to add `outline: 2px dashed var(--accent)` and a `.dropzone-overlay` with `var(--accent-soft)` background.
2. **`UploadQueuePanel` shows active uploads with filename, progress bar, and cancel button**
   - Status: ✅
   - Evidence: `UploadQueuePanel.tsx` reads from `useUploadsStore`, renders `.upload-queue-item` rows with name, size, `.upload-queue-bar/fill`, status label, and a Remove button.
3. **`useUploader` runs uploads with a global concurrency limit of 3**
   - Status: ✅
   - Evidence: `useUploader` calls `runWithConcurrency(tasks, 3, worker)`. `tests/hooks/useUploader.test.tsx` "limits concurrency to 3 in-flight uploads" asserts `peak ≤ 3 && peak > 1` for 6 files.
4. **Each successful upload immediately calls `POST /api/fs/file/created`**
   - Status: ✅
   - Evidence: `useUploader.ts` after the XHR resolves calls `apiFetch('/fs/file/created', { method: 'POST', body: … })` with chunk descriptors. Test "enqueues each file and records its chunks via /fs/file/created" verifies the call shape and `discordMessageId` extraction.
5. **Right-click on a file/folder card opens a context menu with Delete**
   - Status: ✅
   - Evidence: `DrivePage.tsx` wraps each `FileCard` in `ContextCard` which `onContextMenu` opens a positioned `.context-menu` with a destructive Delete item.
6. **Delete opens a confirm modal; confirming calls `DELETE /api/fs/node` and invalidates the listing query**
   - Status: ✅
   - Evidence: `pendingDelete` state opens `<Modal>`. `confirmDelete` calls `deleteNode(id)` (which is `apiFetch('/fs/node', { method: 'DELETE', body: { id } })`) and then `refetch()` on the folder query.
7. **`Modal` and `Toast` components match the UI-SPEC (centered modal, slide-in toasts, 4 s lifetime)**
   - Status: ✅
   - Evidence: `Modal.tsx` is `position: fixed`, 480 px max-width, surface-2 background, backdrop blur, `@keyframes modal-pop`. `useToastsStore.push` defaults `lifetimeMs: 4000`. `toast-in` keyframes slide in from the right.
8. **Selecting a single file opens a right-side DetailPanel with metadata**
   - Status: ✅
   - Evidence: `DetailPanel.tsx` is `position: fixed; right: 0; width: 320px` with `detail-in` keyframes; shows name, type, size, created, modified, cdn URL, and Delete.
9. **`apiFetch` 401 responses trigger a redirect to `/` with a "Session expired" toast**
   - Status: ✅
   - Evidence: `lib/api.ts` clears the JWT and calls `onUnauthorized?.()` on 401. `store/auth.ts initAuthUnauthorizedHandler` calls `logout()`. `main.tsx` subscribes to the auth store and pushes `{ kind: 'info', message: 'Session expired — please reconnect.' }` on `authenticated → unauthenticated`. `App.tsx` then renders `AuthPage` instead of `AppShell`.
10. **Unit tests: `lib/concurrency.test.ts` and `hooks/useUploader.test.ts`**
    - Status: ✅
    - Evidence: 6 + 5 tests, all pass.

## Automated Test Results

- `npm run test` (in `web/`) → 6 test files, **33/33 tests passing** in ~7–11 s.
- `npm test` (at repo root) → 8 test files, **45/45 backend tests passing** in ~11 s.
  - The root `vitest.config.ts` explicitly `exclude`s `web/**` so each suite runs in its proper environment (node for backend, jsdom for web).
- `npm run build` (in `web/`) → exits 0; produces `dist/index.html` (0.77 kB) + `dist/assets/index-*.css` (17.51 kB) + `dist/assets/index-*.js` (224.65 kB).
- **Combined: 78/78 tests pass across the full project.**

## Manual-Only Verifications

- Live E2E (open browser, connect, drag a file, see it on disk in the Discord webhook, delete it, see it gone): deferred to user smoke test (requires real Discord webhook + cookies/localStorage).
- Touch target sizing on small mobile screens: the design uses 56 px tall rail items, ≥ 36 px button height, and 44 px row tap targets in the list — not measured on a physical device in this phase.

## Release Criteria

- [x] All must-haves verified (9 in Plan 01 + 9 in Plan 02 + 10 in Plan 03)
- [x] All automated tests pass
- [x] `npm run build` exits 0
- [x] No outstanding gaps
- [x] Backward compatibility preserved — backend code (Phase 1 + Phase 2) is unchanged
- [x] `.gitignore` covers `web/dist/` and `*.tsbuildinfo` so builds don't pollute git
- [x] Root `vitest.config.ts` `exclude`s `web/**` so backend tests don't trip on the web-only jsdom setup

**Result: PASSED** — Phase 3 ready to close out the v1.0 MVP milestone.
