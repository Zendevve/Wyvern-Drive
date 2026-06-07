# Roadmap: Disbox v2

## Overview

Disbox v2 is built in **11 ordered phases** (Phase 0 monorepo + 10 product phases). The journey: lock the toolchain → ship a shared protocol SDK → bring up the server with real Discord integration → build the web file manager on top → drop the deep-link extension → layer on client-side E2E encryption → expand to multi-account → server-side search → shortlink sharing → mobile PWA → polish (previews, zip, retry queue). Each phase ships a coherent, demoable capability; the product is usable (upload + download + delete) at the end of Phase 4, hardened through Phase 6, and feature-complete at Phase 11.

## Phases

- [ ] **Phase 0: Monorepo & Tooling Foundation** — pnpm workspaces, turborepo, TS, eslint/prettier, root scripts, CI skeleton
- [ ] **Phase 1: Shared Protocol SDK** — `@disbox/shared`: chunker, hasher, Merkle tree codec, types, esbuild bundle
- [ ] **Phase 2: Server v2 Core** — Hono app, Drizzle schema, JWT auth, account CRUD, Discord proxy client, chunked upload/download, rate-limit queue
- [ ] **Phase 3: Web v2 File Manager** — Next.js 14 shell, shadcn/ui, Zustand stores, drag-drop upload, list/grid, context menu, progress
- [ ] **Phase 4: Chrome Extension v2** — MV3, content script on discord.com, deep-link channel URLs to web app
- [ ] **Phase 5: Client-Side E2E Encryption** — master passphrase, Argon2id Web Worker, AES-256-GCM with AAD, secret store
- [ ] **Phase 6: Multi-Account Support** — account picker, per-account token storage, per-account chunk dedup
- [ ] **Phase 7: Server-Side Search & Metadata Indexing** — SQLite FTS5, indexed name/path/type/size/mtime, filter DSL
- [ ] **Phase 8: Sharing v2** — shortlinks, expiration, password protection, public download endpoint
- [ ] **Phase 9: Mobile PWA** — responsive layout, camera upload, touch gestures, manifest + service worker
- [ ] **Phase 10: Polish** — previews (image/video/audio/doc), zip download, persistent upload queue, auto-retry

## Phase Details

### Phase 0: Monorepo & Tooling Foundation

**Goal**: A working pnpm + turborepo monorepo with shared TS config, lint, format, and CI that builds `packages/shared` successfully.
**Depends on**: Nothing (first phase)
**Requirements**: (none — tooling only)
**Success Criteria** (what must be TRUE):

1. `pnpm install` at repo root completes without errors on a clean clone
2. `pnpm -r build` builds all packages and apps
3. `pnpm -r typecheck` passes across the monorepo
4. `pnpm -r lint` passes with a shared eslint config
5. `apps/web`, `apps/server`, `apps/ext`, `packages/shared` each have a `package.json` with correct workspace references
   **Plans**: 1 plan

- [ ] 00-01: Workspace skeleton, shared configs, CI workflow, root scripts

### Phase 1: Shared Protocol SDK

**Goal**: `@disbox/shared` is a browser-and-Node-safe library that chunks files deterministically, hashes content, encodes Merkle trees, and exports types used by every other package.
**Depends on**: Phase 0
**Requirements**: PROTO-01, PROTO-02, PROTO-03, PROTO-04
**Success Criteria** (what must be TRUE):

1. `chunkFile(buffer, { chunkSize })` returns an array of `{ index, hash, bytes }` with stable boundaries across runs
2. `hashChunk(bytes)` returns a 64-char hex SHA-256
3. `encodeTree(root)` produces a deterministic byte string; `decodeTree(bytes)` round-trips losslessly
4. SDK has zero React, Discord, or Node-API dependencies in core
5. Web app and server both import the SDK and share a single `FileManifest` type
   **Plans**: 1 plan

- [ ] 01-01: Chunker, hasher, tree codec, types, tests, esbuild dual export (ESM + CJS)

### Phase 2: Server v2 Core

**Goal**: Hono server with JWT auth, Drizzle/SQLite schema, account CRUD, and Discord proxy that chunks + uploads + downloads via `discord.js-selfbot-v13` with rate-limit awareness.
**Depends on**: Phase 1
**Requirements**: AUTH-01, AUTH-02, AUTH-03, ACCT-01, ACCT-02, ACCT-03, DISC-01, DISC-02, DISC-03, DISC-04, DISC-05
**Success Criteria** (what must be TRUE):

1. `POST /auth/login` accepts a Discord user token, validates it against Discord `/users/@me`, returns a JWT
2. `POST /auth/logout` invalidates the JWT (or strips the cookie)
3. `GET /accounts` lists the logged-in user's Discord accounts
4. `POST /files/upload` accepts a multipart file, chunks it, uploads each chunk to a private Discord server channel, persists the manifest in SQLite
5. `GET /files/download/:id` streams the file back, fetching chunks in parallel from Discord
6. Server respects Discord rate limits (waits between messages, retries on 429)
7. Uploading the same file twice produces a single set of Discord messages (chunk dedup)
   **Plans**: 3 plans

- [ ] 02-01: Hono scaffold, Drizzle schema, JWT auth, account endpoints
- [ ] 02-02: Discord proxy client with rate-limit queue + chunked upload/download
- [ ] 02-03: Integration tests against a mocked Discord API (msw or nock)

### Phase 3: Web v2 File Manager

**Goal**: A working Next.js 14 SPA where the user can log in, browse their Discord-backed file tree, upload (drag-drop), download, rename, move, and delete.
**Depends on**: Phase 2
**Requirements**: FS-01, FS-02, FS-03, FS-04, FS-05, FS-06, FS-07, FS-08, WEB-01, WEB-02, WEB-03, WEB-04, WEB-05, WEB-06, WEB-07
**Success Criteria** (what must be TRUE):

1. User can paste a Discord user token, log in, and see their account info
2. User can drag-drop a file onto the window and watch progress (per-chunk + total)
3. User can right-click any file/folder for rename, move, delete, download
4. User can drag a file onto a folder to move it
5. User can navigate folders via breadcrumb or double-click
6. File list shows name, type icon, size, modified date; sortable by clicking headers
7. Refresh: reloading the page restores the user's session and the last folder
   **Plans**: 4 plans

- [ ] 03-01: Next.js 14 scaffold, shadcn/ui, Tailwind, auth pages, account picker
- [ ] 03-02: Zustand stores, file list/grid components, context menu
- [ ] 03-03: Drag-drop upload, download, progress, queue manager
- [ ] 03-04: Rename, move, delete, recursive delete, folder upload

### Phase 4: Chrome Extension v2

**Goal**: A lightweight MV3 extension that detects Discord message/channel links on the web and offers to open them in the Disbox web app.
**Depends on**: Phase 3
**Requirements**: EXT-01, EXT-02, EXT-03
**Success Criteria** (what must be TRUE):

1. Extension loads as MV3 with a service worker and a content script
2. Content script detects `discord.com/channels/...` URLs on any page
3. Clicking the extension icon on a Discord tab offers "Open in Disbox" and routes to the web app
4. Extension works on both `discord.com` and `discordapp.com`
5. Web app is fully usable with the extension uninstalled
   **Plans**: 1 plan

- [ ] 04-01: MV3 manifest, content script, deep-link handler, Chrome Web Store packaging

### Phase 5: Client-Side E2E Encryption

**Goal**: Optional zero-knowledge mode where the user sets a master passphrase, all chunks are encrypted with AES-256-GCM before upload, and the server only sees ciphertext.
**Depends on**: Phase 3
**Requirements**: E2EE-01, E2EE-02, E2EE-03, E2EE-04
**Success Criteria** (what must be TRUE):

1. User can enable E2E mode on first login by setting a master passphrase
2. Master key is derived via Argon2id in a Web Worker; the passphrase never leaves the browser
3. Uploads in E2E mode produce ciphertext chunks (server cannot decrypt)
4. Downloads in E2E mode decrypt on the fly; wrong passphrase fails fast
5. User can disable E2E per-account; switching accounts prompts for the new account's passphrase
6. Toggling E2E on for an existing account migrates unencrypted files (or warns if not)
   **Plans**: 3 plans

- [ ] 05-01: Argon2id Web Worker, master-key derivation, secret store
- [ ] 05-02: AES-256-GCM encrypt/decrypt wrappers in SDK with AAD
- [ ] 05-03: UI contract: passphrase gate, E2E toggle, migration flow

### Phase 6: Multi-Account Support

**Goal**: A user can connect multiple Discord accounts, switch between them, and have per-account storage, dedup, and crypto state.
**Depends on**: Phase 5
**Requirements**: AUTH-04
**Success Criteria** (what must be TRUE):

1. User can add a second Discord account from the account picker
2. User can switch the active account; the file tree reloads for that account
3. Chunk dedup is per-account (no cross-account leakage)
4. Per-account E2E passphrase (each account has its own master key)
5. Account removal wipes local caches and revokes the JWT
   **Plans**: 1 plan

- [ ] 06-01: Multi-account store, account CRUD UI, per-account crypto/key isolation

### Phase 7: Server-Side Search & Metadata Indexing

**Goal**: Fast, server-side search over file metadata (name, path, type, size, mtime) with a query DSL.
**Depends on**: Phase 3
**Requirements**: SRCH-01, SRCH-02, SRCH-03
**Success Criteria** (what must be TRUE):

1. Server maintains a SQLite FTS5 virtual table over file metadata
2. `GET /search?q=foo` returns matching files for the active account
3. User can filter with `ext:png`, `size>10mb`, `mtime:2024` DSL
4. Client-side fuzzy search remains instant for the loaded folder
5. Search results respect per-account isolation
   **Plans**: 2 plans

- [ ] 07-01: FTS5 schema, server-side search endpoint, DSL parser
- [ ] 07-02: Search bar in web app, results UI, filter chip UI

### Phase 8: Sharing v2

**Goal**: Shortlinks for any file with optional expiration and password protection, accessible without login.
**Depends on**: Phase 3
**Requirements**: SHARE-01, SHARE-02, SHARE-03, SHARE-04
**Success Criteria** (what must be TRUE):

1. User can generate a shortlink for any file (`/s/:slug`)
2. Shortlink supports expiration: 1h, 24h, 7d, 30d, never
3. Shortlink supports optional password (additional prompt on open)
4. Anyone with a valid shortlink can download without logging in
5. User can revoke a shortlink immediately
6. E2E-encrypted files: shortlink includes a wrapped key (recipient needs the password to unwrap)
   **Plans**: 2 plans

- [ ] 08-01: Shortlink schema, share creation/revocation, public download endpoint
- [ ] 08-02: E2E shortlink wrapping, password prompt UI, share menu in web app

### Phase 9: Mobile PWA

**Goal**: A responsive PWA that works on phones, supports camera capture, touch gestures, and installs to home screen.
**Depends on**: Phase 3
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04
**Success Criteria** (what must be TRUE):

1. Web app is fully responsive at 320 px width
2. Mobile file picker exposes camera; user can take a photo and upload it
3. Swipe-back navigates to parent folder; pull-to-refresh reloads the listing
4. App can be installed to iOS/Android home screen (manifest, service worker, icons)
5. Offline shell loads when network is down; uploads resume on reconnect
   **Plans**: 2 plans

- [ ] 09-01: Responsive layout, mobile navigation, touch gestures
- [ ] 09-02: PWA manifest, service worker, install flow, offline queue resume

### Phase 10: Polish

**Goal**: Previews, multi-file zip download, persistent upload queue, and auto-retry.
**Depends on**: Phase 3 (and gains richness from Phases 6, 8)
**Requirements**: FS-09, WEB-08, POL-01, POL-02, POL-03, POL-04
**Success Criteria** (what must be TRUE):

1. User sees thumbnails (200×200) for images, first-frame for video, icon for docs
2. User can click a file to preview (image, video, audio, PDF, text) in a side panel
3. User can multi-select files and download as a single zip (streamed, no server-side materialization)
4. Closing the browser mid-upload and reopening resumes from the persisted queue
5. Failed uploads auto-retry up to 5 times; permanent failures are surfaced with a manual retry button
   **Plans**: 3 plans

- [ ] 10-01: Thumbnail/preview service (server-side thumb generation) + preview panel UI
- [ ] 10-02: Client-side zip streaming for multi-download
- [ ] 10-03: IndexedDB-backed upload queue with auto-retry

## Progress

| Phase                  | Plans Complete | Status      | Completed |
| ---------------------- | -------------- | ----------- | --------- |
| 0. Monorepo & Tooling  | 0/1            | Not started | -         |
| 1. Shared Protocol SDK | 0/1            | Not started | -         |
| 2. Server v2 Core      | 0/3            | Not started | -         |
| 3. Web v2 File Manager | 0/4            | Not started | -         |
| 4. Chrome Extension v2 | 0/1            | Not started | -         |
| 5. E2E Encryption      | 0/3            | Not started | -         |
| 6. Multi-Account       | 0/1            | Not started | -         |
| 7. Server-Side Search  | 0/2            | Not started | -         |
| 8. Sharing v2          | 0/2            | Not started | -         |
| 9. Mobile PWA          | 0/2            | Not started | -         |
| 10. Polish             | 0/3            | Not started | -         |

**Coverage**: 55/55 v1 requirements mapped ✓ | **11 phases** | **23 plans** total
