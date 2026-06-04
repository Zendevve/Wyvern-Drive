# Phase 3: React Single Page Application UI - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (yolo)

<domain>
## Phase Boundary

Interactive React + Vite + TypeScript single-page application that provides the file-manager experience for Wyvern Drive: webhook setup → JWT login → browse/upload/download/delete via the existing backend APIs. No backend changes in this phase.

</domain>

<decisions>
## Implementation Decisions

### Stack
- **D-01:** React 18 + Vite + TypeScript, port 5173 in dev. Reverse-proxied behind the Fastify backend in production (out of scope for this phase — Vite dev server is used standalone).
- **D-02:** State management via Zustand (small global store for auth, current folder, upload queue, selection). React Router for routing. TanStack Query for server state and caching.
- **D-03:** Styling: vanilla CSS modules + a `tokens.css` design-token file (no Tailwind, no styled-components). Matches the UI-SPEC token set.

### Auth Flow
- **D-04:** First-run wizard collects the webhook URL, POSTs `/auth/webhook`, receives a JWT, stores it in `localStorage` under `wyvern.jwt`, and the accountId is derived client-side as `SHA-256(webhookUrl).hex()` (matches server).
- **D-05:** Logout clears `localStorage` and routes back to `/`.
- **D-06:** On app boot, if `wyvern.jwt` exists, the app hydrates `accountId` and validates by calling a lightweight endpoint (e.g., `GET /fs/list` with the bearer token). 401 → force re-auth.

### Routing
- **D-07:** Routes: `/` (auth/setup), `/drive` (root), `/drive/:folderId` (subfolder). A 404 page renders the empty-state copy.
- **D-08:** Breadcrumb segments are derived from the folder-id chain by walking the parent tree once per route change (cached in TanStack Query).

### Folder / File Listing
- **D-09:** `GET /fs/list?parent_id=...` drives the listing. Items are rendered as a card grid by default; a list/grid toggle swaps to a dense table view.
- **D-10:** Selecting a folder navigates into it; selecting a file opens a side detail panel.
- **D-11:** File-type icons come from a `getFileIcon(mimeType | extension)` helper that maps to the SVG sprite defined in `src/components/icons`.

### Upload
- **D-12:** Drag-and-drop on the main area accepts files and queues them. Click-to-upload via a hidden `<input type="file" multiple>` triggered by a "Upload" button.
- **D-13:** Per-file upload uses `POST /upload` (multipart) and serializes with a global concurrency limit of 3. The upload queue panel shows filename, percentage, and a cancel button (AbortController).
- **D-14:** After upload completes, the client calls `POST /fs/file/created` with the returned chunk descriptors and the chosen folder + filename. Only after that call returns 201 is the file shown in the listing (optimistic insert with rollback on failure).

### Download / Delete
- **D-15:** Download uses the existing `GET /download` endpoint (the SPA passes the metadata to the backend, which streams back the file via a `Content-Disposition: attachment` header). A hidden `<iframe>` or `window.open` initiates the download.
- **D-16:** Delete uses `DELETE /fs/node` with confirm modal; on success, the cached listing is invalidated.

### Drag-and-Drop UX
- **D-17:** Files dragged from the OS into the main area trigger upload. A dashed accent border appears on the entire main area. Dropping outside the main area is a no-op.
- **D-18:** Drag within the app (file → folder) is out of scope; placeholder for a future phase.

### Error Handling
- **D-19:** All API errors surface as a toast with a human-readable message. 401 errors force a redirect to `/` with a "Session expired" toast.
- **D-20:** The app degrades gracefully if the backend is unreachable: a top banner reads "Backend offline — retrying" and listing calls retry with exponential backoff (TanStack Query handles this).

### Layout (per UI-SPEC)
- **D-21:** Three regions: top bar, left rail, main area. The layout uses CSS grid (rows: 60 px 1fr; cols: 90 px 1fr).
- **D-22:** Detail panel slides in from the right (320 px) when a single file is selected.

### Testing
- **D-23:** Vitest + React Testing Library for unit tests on hooks and helpers. Playwright is *not* added in this phase; manual smoke tests cover the SPA.
- **D-24:** A mock API client (`src/api/mock.ts`) is used in tests; production uses the real `fetch`-based client.

### the agent's Discretion
- Exact CSS variable names within the tokens file.
- Number of skeleton cards on initial load.
- Whether to use the existing backend in dev (yes, via Vite proxy to localhost:3000).
- Sort order in the listing (default: folders first, then name asc — matches the server's ORDER BY).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications
- `.planning/PROJECT.md` — Core value, frontend stack declaration.
- `.planning/REQUIREMENTS.md` — Functional specifications for `UI-01` … `UI-06`.
- `.planning/ROADMAP.md` — Phase 3 success criteria and mapped requirements.
- `.planning/phases/02-virtual-filesystem-metadata-layer/02-SUMMARY.md` — Backend API surface and accountId derivation.

### Backend API
- `src/routes/auth.ts` — `POST /auth/webhook` returns `{ token }`.
- `src/routes/upload.ts` — `POST /upload` multipart, returns chunk descriptors.
- `src/routes/download.ts` — `GET /download` streams the file with attachment headers.
- `src/routes/delete.ts` — `DELETE /delete` bulk message delete.
- `src/routes/fs.ts` — folder/file/list/node/file-created/backup/restore.
- `src/plugins/auth.ts` — `request.accountId` decoration (SHA-256 hex).

### Design
- `.planning/phases/03-react-single-page-application-ui/03-UI-SPEC.md` — Visual contract, components, motion, accessibility.

</canonical_refs>

<code_context>

The frontend is greenfield — the `references/`, `node_modules/`, and `src/` directories belong to the backend. The SPA will live in a new `web/` directory at the repo root (or in a sibling repo). Decision: the SPA lives in `web/` so backend and frontend share the same repo, simplifying E2E later.

</code_context>

<specifics>
## Specific Ideas

- The `web/` Vite project should be created with `npm create vite@latest web -- --template react-ts` (or the pnpm/yarn equivalent). The agent picks the package manager based on what is already in use (npm, based on `package-lock.json` at the repo root).
- Vite dev server proxies `/api` → `http://localhost:3000` so the SPA can use relative paths.
- Use `inter` and `jetbrains-mono` from Google Fonts (no local font files).
- The drag-and-drop area should give immediate visual feedback (border + tint) before the file is actually dropped.

</specifics>

<deferred>
## Deferred Ideas

- File preview (image, video, audio) — placeholder icon only in this phase.
- Drag-within-app to move/rename — placeholder only.
- Search and tag-based listing — out of scope.
- Real-time sync via websocket — out of scope.
- Trash / soft-delete — out of scope; deletes are immediate.
- Sharing / public links — explicitly out of scope per PROJECT.md.
- Client-side encryption — explicitly out of scope per PROJECT.md.

</deferred>

---

*Phase: 03-react-single-page-application-ui*
*Context gathered: 2026-06-04 (autonomous)*
