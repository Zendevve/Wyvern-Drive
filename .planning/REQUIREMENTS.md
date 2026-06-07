# v1 Requirements: Disbox v2

> All v1 requirements are **hypotheses** until shipped and validated.

## v1 Requirements

### Authentication (AUTH)

- [ ] **AUTH-01**: User can log in by pasting a Discord user token (validated by fetching `/api/v9/users/@me` via the server)
- [ ] **AUTH-02**: After login, user's session persists across browser restarts (JWT in httpOnly cookie + refresh)
- [ ] **AUTH-03**: User can log out from any page, which clears the JWT cookie and wipes the locally cached encryption key
- [ ] **AUTH-04**: User can switch the active Discord account from an account picker (multi-account enabled in Phase 7)

### Account Identity (ACCT)

- [ ] **ACCT-01**: Server stores one row per Discord account keyed by Discord snowflake user ID
- [ ] **ACCT-02**: The Discord user token is never persisted by the server in plaintext (held in-memory only during the request, never logged)
- [ ] **ACCT-03**: Server can detect whether a token has Nitro by inspecting `/users/@me` and cache this for chunk-size selection

### File System Operations (FS)

- [ ] **FS-01**: User can create folders (directories) at any path
- [ ] **FS-02**: User can upload files of any size (chunked automatically; resumable on failure)
- [ ] **FS-03**: User can download files (streamed; never loads the full file into browser memory)
- [ ] **FS-04**: User can rename files and folders
- [ ] **FS-05**: User can move files and folders (drag-drop in UI)
- [ ] **FS-06**: User can delete files (chunks are removed from Discord)
- [ ] **FS-07**: User can delete non-empty folders recursively (with confirmation)
- [ ] **FS-08**: User can upload a folder and preserve its structure
- [ ] **FS-09**: User can download a folder as a zip

### Discord Storage (DISC)

- [ ] **DISC-01**: Files are split into 50 MB chunks when the account has Nitro, 25 MB otherwise
- [ ] **DISC-02**: Each chunk is uploaded as a Discord message attachment (filename = content hash, message body = chunk index)
- [ ] **DISC-03**: Server proxies all chunk upload/download — browser never talks to Discord directly
- [ ] **DISC-04**: Chunks are deduplicated by SHA-256 content hash; identical chunks across files reference the same Discord message
- [ ] **DISC-05**: Failed Discord uploads are retried with exponential backoff (max 5 attempts, 1/2/4/8/16 s)

### Shared Protocol SDK (PROTO)

- [ ] **PROTO-01**: Chunker produces deterministic, content-addressed chunks (same input → same chunk boundaries + hashes)
- [ ] **PROTO-02**: Tree codec encodes folder structure as a compact Merkle-style tree (each node's hash covers its children)
- [ ] **PROTO-03**: Shared SDK is used by web, server, and extension (one source of truth for chunking, hashing, tree encoding, types)
- [ ] **PROTO-04**: SDK is framework-agnostic — no React, no Discord, no Node-specific APIs in the core (browser-safe)

### End-to-End Encryption (E2EE)

- [ ] **E2EE-01**: User can set a master passphrase on first login; the passphrase derives a master key via Argon2id (in a Web Worker)
- [ ] **E2EE-02**: Files are encrypted client-side with AES-256-GCM (per-file random IV, content hash used as AAD) before upload
- [ ] **E2EE-03**: Server only ever sees ciphertext; it cannot decrypt file contents even if database is leaked
- [ ] **E2EE-04**: User can download and decrypt files with the correct passphrase; wrong passphrase fails fast and wipes the in-memory key

### Web UI (WEB)

- [ ] **WEB-01**: User sees a file manager UI: sidebar (storage stats, account picker), breadcrumb, list/grid toggle
- [ ] **WEB-02**: User can drag-drop files and folders anywhere in the window to upload
- [ ] **WEB-03**: User can right-click any file/folder for a context menu (rename, move, delete, share, copy link, download)
- [ ] **WEB-04**: User sees per-file upload/download progress (percentage + bytes + speed)
- [ ] **WEB-05**: User sees file icons by MIME type (image, video, audio, archive, code, doc, generic)
- [ ] **WEB-06**: User can sort the file list by name, size, modified date, type
- [ ] **WEB-07**: User can filter the file list by name substring and type
- [ ] **WEB-08**: User can preview images, videos, audio, PDFs, and text/code files in a side panel

### Chrome Extension (EXT)

- [ ] **EXT-01**: Extension injects a content script on `discord.com` channel/message URLs
- [ ] **EXT-02**: When a user clicks a Discord message link on the web, the extension opens that channel in the Disbox web app (if logged in)
- [ ] **EXT-03**: Extension works on both `discord.com` and legacy `discordapp.com` domains

### Search (SRCH)

- [ ] **SRCH-01**: User can search by file name with substring + fuzzy match (client-side, instant)
- [ ] **SRCH-02**: Server indexes file metadata (name, path, type, size, mtime, tags) in a FTS5 virtual table for server-side queries
- [ ] **SRCH-03**: User can filter by extension (`ext:png`), size range (`size>10mb`), and date range (`mtime:2024`)

### Sharing (SHARE)

- [ ] **SHARE-01**: User can generate a shortlink for any file (e.g. `https://disbox.app/s/abc123`)
- [ ] **SHARE-02**: User can set an expiration on a shared link (1h, 24h, 7d, 30d, never)
- [ ] **SHARE-03**: User can password-protect a shared link (additional passphrase prompt on open)
- [ ] **SHARE-04**: Anyone with a valid (non-expired, password-less or correct-password) shortlink can download the file without logging in

### Mobile PWA (MOB)

- [ ] **MOB-01**: Web app is fully responsive (≥ 320 px wide) and works in mobile browsers
- [ ] **MOB-02**: User can upload photos and videos directly from the device camera via the mobile file picker
- [ ] **MOB-03**: User can navigate folders with touch gestures (swipe-back, pull-to-refresh)
- [ ] **MOB-04**: PWA can be installed to the device home screen (manifest, service worker, offline shell)

### Polish (POL)

- [ ] **POL-01**: User sees rich file previews: thumbnail for images (200×200), first-frame for video, waveform for audio, icon for documents
- [ ] **POL-02**: User can multi-select files and download them as a single zip
- [ ] **POL-03**: Upload queue persists across page reloads (queued uploads resume from local IndexedDB state)
- [ ] **POL-04**: Failed uploads retry automatically with user-visible status (retrying, failed-permanently)

## v2 Requirements (deferred)

- Real-time multi-user collaboration on a shared drive
- Mobile native apps (iOS/Android shells)
- Server-side full-text content search (would require decryption; architecture doesn't allow)
- Self-service multi-tenant hosted server with billing
- Encrypted folder sharing (E2EE folders where each recipient has a wrapped key)
- File version history
- Trash / soft-delete with restore window
- Server-side virus scanning (would require plaintext access)
- Cross-account deduplication (currently per-account)

## Out of Scope

See `.planning/PROJECT.md` "Out of Scope" section for project-level exclusions (v1 migration, official bot mode, etc.).

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 3 | Pending |
| AUTH-02 | Phase 3 | Pending |
| AUTH-03 | Phase 3 | Pending |
| AUTH-04 | Phase 7 | Pending |
| ACCT-01 | Phase 3 | Pending |
| ACCT-02 | Phase 3 | Pending |
| ACCT-03 | Phase 3 | Pending |
| FS-01 | Phase 4 | Pending |
| FS-02 | Phase 4 | Pending |
| FS-03 | Phase 4 | Pending |
| FS-04 | Phase 4 | Pending |
| FS-05 | Phase 4 | Pending |
| FS-06 | Phase 4 | Pending |
| FS-07 | Phase 4 | Pending |
| FS-08 | Phase 4 | Pending |
| FS-09 | Phase 11 | Pending |
| DISC-01 | Phase 3 | Pending |
| DISC-02 | Phase 3 | Pending |
| DISC-03 | Phase 3 | Pending |
| DISC-04 | Phase 3 | Pending |
| DISC-05 | Phase 3 | Pending |
| PROTO-01 | Phase 2 | Pending |
| PROTO-02 | Phase 2 | Pending |
| PROTO-03 | Phase 2 | Pending |
| PROTO-04 | Phase 2 | Pending |
| E2EE-01 | Phase 6 | Pending |
| E2EE-02 | Phase 6 | Pending |
| E2EE-03 | Phase 6 | Pending |
| E2EE-04 | Phase 6 | Pending |
| WEB-01 | Phase 4 | Pending |
| WEB-02 | Phase 4 | Pending |
| WEB-03 | Phase 4 | Pending |
| WEB-04 | Phase 4 | Pending |
| WEB-05 | Phase 4 | Pending |
| WEB-06 | Phase 4 | Pending |
| WEB-07 | Phase 4 | Pending |
| WEB-08 | Phase 11 | Pending |
| EXT-01 | Phase 5 | Pending |
| EXT-02 | Phase 5 | Pending |
| EXT-03 | Phase 5 | Pending |
| SRCH-01 | Phase 8 | Pending |
| SRCH-02 | Phase 8 | Pending |
| SRCH-03 | Phase 8 | Pending |
| SHARE-01 | Phase 9 | Pending |
| SHARE-02 | Phase 9 | Pending |
| SHARE-03 | Phase 9 | Pending |
| SHARE-04 | Phase 9 | Pending |
| MOB-01 | Phase 10 | Pending |
| MOB-02 | Phase 10 | Pending |
| MOB-03 | Phase 10 | Pending |
| MOB-04 | Phase 10 | Pending |
| POL-01 | Phase 11 | Pending |
| POL-02 | Phase 11 | Pending |
| POL-03 | Phase 11 | Pending |
| POL-04 | Phase 11 | Pending |

**Coverage: 55/55 v1 requirements mapped ✓**
