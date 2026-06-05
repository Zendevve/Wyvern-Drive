# Competitive Analysis: 8 Discord File Storage Solutions

**Date:** 2026-06-05
**Source projects analyzed** (in `D:\COMPROG\Wyvern Drive\references\`):

| # | Project | Stack | Storage model | Mature? |
|---|---|---|---|---|
| 1 | **CloudCord** | Rust + axum + React | Bot + signed-URL `/attachments` | WIP, single-tenant |
| 2 | **DDrive** | Node + Fastify + vanilla JS | **Webhooks (round-robin)** | v4.3.0, single-tenant |
| 3 | **DisboxApp** (ext/server/web) | Node + Express + React + MV3 ext | Webhook + tiny metadata server | 3-year-old, abandoned |
| 4 | **discloud** | Node + Express | Bot, single channel | Small (~250 LOC backend) |
| 5 | **discord-cloud-storage** | Python + Flask | Webhook, single channel | Single 460-LOC `app.py` |
| 6 | **DiscordFileHost** | TypeScript + Express + EJS | Webhook + Realm DB | Working, single-tenant |

Plus 2 others on the same list (DisboxApp extension / server analyzed in the DisboxApp-web agent report).

This document is the **distilled design brief** for what should go into Wyvern Drive beyond v2.0.

---

## 1. The TL;DR competitive map

| Dimension | CloudCord | DDrive | DisboxApp | discloud | discord-cloud-storage | DiscordFileHost |
|---|---|---|---|---|---|---|
| Discord account | Bot | **Webhook** | **Webhook** | Bot | **Webhook** | **Webhook** |
| Chunk size | 20 MB | 24 MiB | 25 MB − 1 B | 8 MB | 23 MiB | 8 MiB |
| Parallel upload | ❌ | ✅ (3×) | ❌ | ❌ stagger | ✅ 4× | ❌ |
| Parallel download | ❌ | ❌ | ❌ | n/a (range) | ✅ 4× | ❌ |
| Range / resume | ❌ | ✅ | ❌ | ✅ range | ❌ | ❌ |
| Encryption | ❌ (broken) | AES-256-CTR | ❌ | ❌ | **AES-128-EAX** | AES-256-CTR + gzip |
| Per-chunk random nonce | ❌ (zero!) | ✅ | n/a | n/a | ✅ | ✅ |
| Folders | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Search / tags | ❌ | ❌ | client-side filter | ❌ | client-side | ❌ |
| Share links | ❌ | unsigned | **serverless hash** | 32-hex id | export `.db` | 20-hex id |
| Auth | ❌ | Basic Auth | `sha256(webhook)` | ❌ | ❌ | **Discord OAuth** ✅ |
| Rate limit | ❌ | ❌ | client-side 429 | Discord pacer | ❌ | express-rate-limit |
| CORS | `*` | n/a | `*` | `*` | n/a | disabled |
| CSRF | ❌ | n/a | n/a | ❌ | ❌ | ❌ |
| Delete from Discord | ❌ | ❌ | ✅ client-side | ❌ | ❌ | ✅ |
| Tests | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| CI | ❌ | lint only | ❌ | Docker | ❌ | ❌ |
| Health endpoint | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |

**Reading the matrix:** every project gets the *core upload/download* right. They all fail in the same five places: (1) **downloads are sequential**, (2) **no resumable uploads**, (3) **no real auth**, (4) **share links are un-signed and immortal**, (5) **no multi-user**. Those are the moats.

---

## 2. The "steal this" — proven patterns worth importing

### 2.1 From DDrive (closest architectural relative)
- **Webhook round-robin** (`src/DFs/index.js:44-51`) — getter that increments an index and rewrites the host so each parallel chunk lands in a different channel. Multiplies per-channel rate-limit budget for free. **Adopt verbatim.**
- **`AsyncStreamProcessorWithConcurrency` Transform** (`src/DFs/lib/...`) — back-pressured Transform with bounded concurrency. Right pattern for parallel uploads.
- **Per-chunk random IV in the DB row** (`block.iv` column) — the right place for crypto metadata, not in a separate manifest.
- **`ACCESS_TAGS` opt-in pattern** — declare which routes are public via route-level config; auth middleware checks the tag list. Cleaner than scattering `if (publicRead) return` everywhere.
- **Direct pipe of Discord CDN to HTTP response** — no temp file, no buffering, no double-copy on download.
- **Range requests forwarded per-chunk to Discord CDN** (`src/DFs/index.js:110`) — a Range request for bytes 100–200MB only pulls those slices from each affected chunk.
- **`webhook.txt` fallback for many URLs** (env vars have size limits; a file lets you scale to hundreds of webhooks).
- **v3 → v4 migration script** — they preserved one-way data migration across a major rewrite. **Adopt for any future schema break.**

### 2.2 From DiscordFileHost
- **`/f/:ident` shorthand URL with OpenGraph / Twitter embed templates** (`views/embed_*.ejs`) — image MIME → straight redirect; video/audio → meta-tag page with a 3-second JS redirect. Human visitors get the file, bots see the embed. **High-leverage UX win.**
- **Streaming pipeline `file → gzip → AES-CTR → 8 MiB chunks`** — no temp file on disk. Use AES-GCM instead of CTR.
- **Anonymity by default, anonymous → Discord migration on login** — let people try the product with zero friction, then upgrade.
- **`AbortController`-style upload cancel** — clean XHR abort, "Aborted" status row, 5 s auto-remove.
- **`busboy` for streaming multipart** — much better than buffering the whole file in RAM.

### 2.3 From DisboxApp
- **Server-less share links via pako-deflated URL hash** — server never sees what's shared. Extend with TTL + revocation list for a clean, decentralized share model. (`App.js:232-266`)
- **Dual-hostname fallback** (`disbox-file-manager.js:198-211`) — try both `discord.com` and `discordapp.com`, pick the one with more entries. Self-heals when Discord renames domains.
- **Rate-limit aware `fetchFromApi` wrapper** (`disbox-file-manager.js:79-105`) — reads `X-RateLimit-Remaining` + `X-RateLimit-Reset-After`, sleeps for the window, retries. The only correct way to talk to Discord at volume.
- **Webhook URL as password → `sha256` as user ID** — zero-friction auth. (Wyvern already does this with JWT.)
- **Discord filename convention `<fileId>_<chunkIndex>`** — a human inspecting the channel can reconstruct order without reading metadata. Cheap, useful.

### 2.4 From discord-cloud-storage (Python)
- **AEAD per chunk with `nonce ‖ tag ‖ ciphertext` on-disk layout** (`app.py:400-403`) — three prefixed fields, self-describing, fails closed on tamper. (They use EAX; we should use GCM for speed.)
- **Order-preserving parallel download** via pre-allocated list indexed by chunk number — avoids the "chunk 10 finished before chunk 2" reassembly bug without needing a heap.
- **Integer-aware chunk filename sort** (`app.py:60-63`) — three lines that fix `chunk_2 < chunk_10` lexicographic nonsense.
- **23 MiB chunk size** with margin under 25 MB — they tested the actual limit.

### 2.5 From discloud
- **Range-aware chunk fetching from Discord CDN** (`index.js:184-215`) — offload byte slicing to Discord. Video streaming works with ~50 LOC of code.
- **Backpressure-aware `AsyncStreamProcessor` Transform** (`utils/stream.js:4-15`) — `await res.write()` with `'drain'` listening. The right abstraction.
- **In-memory 8 MB chunker over the raw `req` stream** — no `multer`, no `busboy`; treat the request body as a raw byte pipe. (We've already adopted `@fastify/multipart` — fine, but consider raw streaming for >1 GB files.)
- **Kebab-case + strip-special-chars filename normalization** — 10 lines that dodge CRLF injection and Unicode shenanigans in `Content-Disposition`.

### 2.6 From CloudCord
- **The signed-URL Discord upload handshake** (`src/web/send_message.rs:123-188`) — `POST /channels/{id}/attachments` → PUT to signed URL → finalize via `/messages`. The right way to push bytes for a bot. (For webhooks we use the simpler `POST /webhooks/{id}/{token}` flow, but the pattern is the same: avoid `multipart/form-data` weirdness, get a CDN URL back.)
- **Split-or-skip chunking** — small files (≤ chunk size) skip the chunking code path entirely. Don't over-engineer the common case.
- **Single-binary, single-Cargo-crate, single-file-per-concern layout** — reads top-to-bottom, easy to fork. (We're using Fastify; similar effect with thin route modules.)

---

## 3. The "do not copy" — anti-patterns to design out from day one

### 3.1 Catastrophic security holes (every project has at least one)
- **Webhook URL in plaintext `localStorage`** (DisboxApp) — XSS = total account takeover.
- **Encryption key stored next to ciphertext** (discord-cloud-storage: `key_hex` in same SQLite row) — DB leak = data leak.
- **AES-256-CTR for content** (DDrive, DiscordFileHost) — unauthenticated; tampered ciphertext decrypts to tampered plaintext silently. **Use AES-256-GCM.**
- **Zero nonce in ChaCha20-Poly1305** (CloudCord `send_message.rs:25-26`) — nonce reuse is catastrophic for AEAD. **Always per-chunk random nonce.**
- **Auth = `sha256(webhookUrl)` in URL path** (DisboxApp server) — anyone with the hash has full CRUD. If hash is leakable, game over.
- **`SECRET` is `SHA-256(secret)` with no salt** (DDrive) — rainbow-table feasible for short secrets. **Argon2id or scrypt.**
- **AES-128-EAX** (discord-cloud-storage) — EAX is slower than GCM on modern CPUs (no AES-NI acceleration in many builds). GCM is free.
- **Encryption metadata encrypted with `METADATA_ENCRYPTION_SECRET` from a 32-char ASCII env** (DiscordFileHost) — fragile key handling; one bad config = undecryptable files.

### 3.2 Functional landmines
- **Sequential chunk downloads** (every single project) — the #1 perf cliff. A 1 GB file = 125 sequential HTTPS gets. **Parallelize from day one.**
- **No resumable uploads** (every project) — a 1 GB upload over a flaky link restarts from 0 every time. **Implement TUS.io or custom chunked resumable.**
- **Upload commit-on-last-chunk, not in a transaction** (DDrive) — DB insert fails after chunks already on Discord → orphaned storage leak.
- **`rangedParts` math assumes uniform chunk size** (DDrive) — last chunk is often smaller; `end % chunkSize` overflows → truncated download.
- **`uploadChunk` is redefined inside a loop scope** (discord-cloud-storage) — if the temp file is gone, the retry silently fails.
- **Orphaned chunks on tab crash** (DisboxApp) — message IDs are only written to DB at the end of upload. Crash mid-way = N × 24 MB leaked into Discord.
- **`#` in URL hash not stripped before `atob`** (DisboxApp-web) — recipient of a share link can fail to decode.
- **`Path.replace(file.name, newName)`** (DisboxApp-web) — string replace on a path; `cat` + `cat.png` collide.
- **Pre-existing `Object.keys(fileTrees).length` style checks** on plain objects (DisboxApp-web) — `.length` is undefined on `{}`, so the check is always false.
- **Sequential Discord uploads** (CloudCord) — 200 MB takes 10× the wall-clock time it could.

### 3.3 Anti-features (don't even consider)
- **`window.confirm` / `window.alert`** for every action (DisboxApp-web) — blocks the event loop, unstyleable, not accessible. Use a toast/dialog system.
- **`react-file-icon`** + `react-native-mime-types` in a web bundle (DisboxApp) — RN-targeted packages on the web are an audit nightmare.
- **Mixing MUI + Bootstrap + FontAwesome + react-icons** (DisboxApp-web) — pick one library. (Wyvern uses custom CSS — fine.)
- **CRUD: global state in `useState` in `App.js` + re-implement array diffs per handler** (DisboxApp-web) — use Zustand (already in our stack) or a normalized cache.
- **Inconsistent chunk filename patterns** (every project) — pick one (e.g. `<fileId>_<zero-padded-index>.bin`) and stick to it.
- **Hardcoded Chrome Web Store extension ID in 3 places** (DisboxApp) — if the listing is revoked, every install is broken. **If we add a browser extension, make it optional and detectable.**
- **`allorigins.win` as a third-party proxy for downloads** (DisboxApp-web) — the proxy sees every byte. Either stream through our own server with range support or don't ship a proxy.
- **Disable CORS instead of configuring it** (DiscordFileHost) — fine if same-origin only, but blocks any future mobile/native client.
- **Pinned EOL runtimes** (Node 16, Python 3.8) — Wyvern is already on Node 20 ✅.

### 3.4 Operational landmines
- **No graceful shutdown** (every project) — SIGTERM mid-upload = corrupted state. Handle `SIGTERM` + `SIGINT`, drain in-flight, close DB.
- **No health endpoint** (every project) — k8s/load balancers can't probe liveness.
- **No structured logging** (every project) — `console.log` only, no request IDs, no log levels. Adopt `pino` (Fastify's default).
- **No tests** (every project) — `vitest` is already in our `package.json:28` ✅ — use it.
- **Top-level `await` for required side-effects** (discloud `index.js:26`) — fragile if the file is refactored. Use a factory.
- **Recursion in retry logic** (discloud `services/discord.js:30-43`) — no max-depth guard, no jitter, OOM on sustained outage. Use `p-retry` with exponential backoff + jitter.
- **HTTPS termination assumed at a reverse proxy, but no security headers** (DiscordFileHost README) — `helmet` is one `import` away.
- **`min_machines_running = 0` + crash on DB error** (DisboxApp server) — cold-start = request rejection.

### 3.5 Discord ToS exposure (existential risk)
- **Single hardcoded channel + single bot** (CloudCord, discloud, DiscordFileHost) — one rate-limit hit or one ToS strike wipes everyone's data.
- **No warning to users that their data lives in a Discord channel readable by anyone with channel read permission**, including Discord staff.
- **No user controls the bot token** in any of the bot-based projects (CloudCord, discloud) — if the operator's token is banned, every user's files are lost.

**Wyvern's webhook-per-user model is the correct answer** — the user owns the webhook, can rotate it, and can self-host their own Discord server for full control.

---

## 4. The "ultimate" feature roadmap (what the competitive set collectively proves is expected)

### 4.1 Table stakes (every modern file manager has these)
- [x] Folder hierarchy (Wyvern v1)
- [x] Drag-and-drop upload (Wyvern v1)
- [x] Breadcrumb navigation (Wyvern v1)
- [x] Upload progress (Wyvern v1)
- [x] File type icons (Wyvern v1)
- [x] Database backup/restore (Wyvern v1)
- [ ] **Multi-file upload** (UI)
- [ ] **Folder upload** (zip the tree, then chunk)
- [ ] **Folder download** (zip the subtree on the fly)
- [ ] **Bulk delete / move / share** (checkbox + context menu)
- [ ] **Real search** — server-side `tsvector` on filename + content snippets for text/PDF
- [ ] **Tags** — free-form, filterable
- [ ] **Starring / pinning** for frequently accessed files
- [ ] **Version history** — keep last N revisions of a file
- [ ] **Trash** — soft delete with restore window (30 days)

### 4.2 The crypto + share layer (the biggest competitive gap)
- [ ] **AES-256-GCM at rest** with per-chunk random nonce (12 bytes) + auth tag (16 bytes) stored in the chunk row
- [ ] **Argon2id-derived user key** wrapping per-file DEKs
- [ ] **End-to-end encryption option** (the server never sees the plaintext key)
- [ ] **Signed share links** with HMAC-SHA256, TTL (1h / 24h / 7d / 30d / never), optional password (Argon2id), optional max-downloads
- [ ] **Share revocation** — server-side deny list, no need to rotate the underlying chunks
- [ ] **Watermarking option** for shared files
- [ ] **Per-share analytics** — view count, geo (coarse), last accessed

### 4.3 The performance layer (the user-visible "wow")
- [ ] **Parallel chunk upload** with bounded concurrency (start at 4, tune)
- [ ] **Parallel chunk download** with bounded concurrency
- [ ] **HTTP Range requests** forwarded to Discord CDN per chunk (discloud's trick)
- [ ] **Resumable uploads** — TUS.io protocol or custom `/api/files/:id/parts/:n` with offset persistence in IndexedDB
- [ ] **Direct-to-browser 302 redirects** to Discord CDN for unencrypted files (zero bandwidth on our server)
- [ ] **Image / video / audio / PDF previews** — server-side thumbnail generation with `sharp` (images) and `ffmpeg` (video), stored as small chunks
- [ ] **In-browser text/code preview** — fetch the first 1 MB, render with Monaco editor or syntax highlighter
- [ ] **CDN edge caching** — Cloudflare in front of the static SPA + API; Discord CDN as the blob edge

### 4.4 The trust layer (the legal / security / abuse side)
- [ ] **Real auth** — Discord OAuth2 (identify + guilds scope) with refresh token rotation, OR keep stateless JWT-with-webhook but add device-binding (refresh token in IndexedDB)
- [ ] **Per-user quota** — env-tunable; arc-gauge widget in v2.0 already plans this
- [ ] **Per-user rate limit** — token bucket per `accountId`
- [ ] **CSRF** — `SameSite=Strict` cookies + double-submit token on state-changing requests
- [ ] **CORS allowlist** — known client origins only
- [ ] **Helmet** — security headers (`CSP`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`, `HSTS`)
- [ ] **MIME sniffing on upload** (`file-type` npm package) — reject declared-vs-detected mismatches
- [ ] **Optional ClamAV scan** — `clamscan` in a sidecar container for high-risk deployments
- [ ] **Filename sanitization** at the route boundary — `sanitize-filename` (already in DiscordFileHost's deps) + extension blocklist
- [ ] **Audit log** — append-only `audit_log` table; every state change recorded with `(actor, action, target, ip, ua, timestamp)`

### 4.5 The reliability layer (the production-grade)
- [ ] **Migrations** — `better-sqlite3` + a hand-rolled `migrations/` table OR `node-pg-migrate` if we move to Postgres
- [ ] **Health + readiness endpoints** — `/healthz` (liveness, no deps), `/readyz` (DB + Discord connectivity)
- [ ] **Graceful shutdown** — drain in-flight uploads, close DB
- [ ] **Structured logging** — `pino`, request IDs, log levels
- [ ] **Metrics** — Prometheus `/metrics` (request count, latency histogram, upload MB/s, queue depth, Discord 429 count)
- [ ] **CI** — GitHub Actions: lint + typecheck + vitest + Docker build
- [ ] **E2E tests** — Playwright covering the critical paths (upload, download, share, delete)

### 4.6 The ecosystem layer (the leverage)
- [ ] **Official browser extension** — same CORS-bypass trick as DisboxApp's, but optional, manifest v3, signed and published, allowlist of `cdn.discordapp.com` only
- [ ] **CLI client** — `npm i -g wyvern-drive`; `wyvern push` / `wyvern pull` / `wyvern ls` / `wyvern share` (the rclone model)
- [ ] **WebDAV server** — expose a Wyvern Drive as a WebDAV mount point so it appears in Finder/Explorer (`wdfs` or `rclone mount`)
- [ ] **MCP server** — expose file operations as Model Context Protocol tools for AI agents
- [ ] **Public API** — versioned `/api/v1/*` with rate limits per key, OpenAPI 3.1 spec at `/api/docs`
- [ ] **Self-host deployment guide** — Docker Compose, Helm chart, one-click Railway/Fly/Render templates
- [ ] **PWA** — service worker for offline file list, install prompt

---

## 5. Architecture decisions to lock in for Wyvern Drive v3

### 5.1 Storage engine interface
Define a `StorageBackend` TypeScript interface with these methods (Wyvern already plans this per `PROJECT.md:78`):

```typescript
interface StorageBackend {
  // Identity
  readonly name: string;
  readonly maxChunkSize: number;            // 24 MiB for Discord
  readonly maxMessageSize: number;          // 25 MiB

  // Bulk operations
  uploadChunk(data: Buffer, meta: ChunkMeta): Promise<ChunkRef>;
  downloadChunk(ref: ChunkRef, range?: { start: number; end: number }): Promise<Readable>;
  deleteChunks(refs: ChunkRef[]): Promise<void>;
  resolveChunkUrl(ref: ChunkRef): Promise<string>;  // re-fetch fresh CDN URL

  // Quota
  getUsage(): Promise<{ used: number; limit: number }>;
}
```

**Backends to implement:** DiscordWebhook (current), DiscordBot (multi-channel sharded), S3 (premium tier), local-disk (dev/CI). Same interface, swappable.

### 5.2 Chunking strategy
- **24 MiB hard cap** (24 × 1024 × 1024 = 25,165,824 bytes — fits the 25 MB Discord webhook limit with margin for multipart overhead). The `1023` trick in DisboxApp is unnecessary because we're below the limit, not at it.
- **Pad chunk index to 6 digits** (`000000`, `000001`, …) so lexicographic sort = numeric sort.
- **Filename pattern**: `<fileId>_<6-digit-index>.bin` — sortable, prefixed with the file UUID, so a human scanning the Discord channel can reconstruct order.
- **Small files (≤ 24 MiB) skip the chunking code path entirely** (CloudCord's `split-or-skip` pattern).

### 5.3 Encryption (when enabled per-file)
- **Cipher:** AES-256-GCM (authenticated, hardware-accelerated on AES-NI, ~5 GB/s/core).
- **Key:** 32 bytes from `crypto.randomBytes(32)`.
- **Per-chunk nonce:** 12 bytes from `crypto.randomBytes(12)`.
- **Auth tag:** 16 bytes (GCM standard).
- **On-disk layout per chunk:** `nonce(12) ‖ tag(16) ‖ ciphertext`.
- **Per-file DEK wrapped with user KEK** (Argon2id of the user's password or a server-held KEK for non-E2EE mode).
- **Manifest stored in the first chunk's `content` field** (DiscordFileHost's trick) — encrypted, self-describing.

### 5.4 Database schema (SQLite, better-sqlite3)
Adopt DDrive's **single-table inheritance for files + directories** (it scales; DisboxApp's `parent_id` adjacency list has bugs). Extend with:

```sql
CREATE TABLE files (
  id            TEXT PRIMARY KEY,           -- UUID v4
  account_id    TEXT NOT NULL,              -- sha256(webhook)
  parent_id     TEXT REFERENCES files(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  type          TEXT NOT NULL CHECK(type IN ('file','directory')),
  mime_type     TEXT,
  size          INTEGER,                    -- bytes (uncompressed, plaintext)
  chunk_count   INTEGER,
  chunks        TEXT,                       -- JSON: [{index, url, iv, tag, size, msgId}]
  dek_wrapped   TEXT,                       -- base64 wrapped DEK (for E2EE)
  enc_nonce     TEXT,                       -- base64 nonce of manifest encryption
  is_encrypted  INTEGER NOT NULL DEFAULT 0, -- 0/1
  is_starred    INTEGER NOT NULL DEFAULT 0,
  views         INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  deleted_at    TEXT,                       -- soft delete (trash)
  UNIQUE(account_id, parent_id, name)
);

CREATE INDEX idx_files_account        ON files(account_id);
CREATE INDEX idx_files_parent         ON files(parent_id);
CREATE INDEX idx_files_name_search    ON files(account_id, name COLLATE NOCASE);
CREATE INDEX idx_files_type           ON files(account_id, type);
CREATE INDEX idx_files_deleted        ON files(deleted_at);

CREATE TABLE shares (
  id            TEXT PRIMARY KEY,
  file_id       TEXT NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  account_id    TEXT NOT NULL,
  token_hash    TEXT NOT NULL,              -- HMAC of the share token, never the token itself
  password_hash TEXT,                       -- Argon2id, nullable
  expires_at    TEXT,
  max_downloads INTEGER,
  downloads     INTEGER NOT NULL DEFAULT 0,
  revoked_at    TEXT,
  created_at    TEXT NOT NULL
);

CREATE TABLE audit_log (
  id            INTEGER PRIMARY KEY,
  account_id    TEXT,
  action        TEXT NOT NULL,
  target_id     TEXT,
  ip            TEXT,
  user_agent    TEXT,
  metadata      TEXT,                       -- JSON
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE sessions (
  id            TEXT PRIMARY KEY,
  account_id    TEXT NOT NULL,
  refresh_hash  TEXT NOT NULL,
  user_agent    TEXT,
  ip            TEXT,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### 5.5 API surface (v3 target)
Versioned under `/api/v1/*`. OpenAPI 3.1 spec served at `/api/docs`. Every route is JSON-schema validated via Fastify's built-in validator.

```
POST   /api/v1/auth/discord                  Discord OAuth start
GET    /api/v1/auth/discord/callback         OAuth callback
POST   /api/v1/auth/refresh                  Refresh access token
POST   /api/v1/auth/logout                   Invalidate session

GET    /api/v1/files?parent_id=&q=&type=&tag=&limit=&cursor=
POST   /api/v1/files                         Multipart upload (resumable)
GET    /api/v1/files/:id
PATCH  /api/v1/files/:id                     rename, move, star, tag
DELETE /api/v1/files/:id                     soft delete (move to trash)
POST   /api/v1/files/:id/restore             restore from trash

POST   /api/v1/files/:id/parts               TUS-compatible resumable upload
PATCH  /api/v1/files/:id/parts/:offset       append chunk
HEAD   /api/v1/files/:id/parts               get current offset

GET    /api/v1/files/:id/download            stream (range-aware, parallel)
GET    /api/v1/files/:id/preview             image/video/audio thumbnail

POST   /api/v1/files/:id/shares              create signed share link
GET    /api/v1/shares                        list my shares
DELETE /api/v1/shares/:id                    revoke share

GET    /api/v1/s/:shareToken                 public share landing page
POST   /api/v1/s/:shareToken/download        public download (password if required)

GET    /healthz                              liveness
GET    /readyz                               readiness (DB + Discord ping)
GET    /metrics                              Prometheus
```

### 5.6 Frontend (v2.0+ plans already cover most of this)
- **WebSocket / SSE** for real-time upload progress and file-list updates
- **IndexedDB queue** for resumable uploads (survives tab close)
- **Service worker** for offline file list + share-page caching
- **Web Workers** for client-side encryption (offload AES-GCM from the main thread)
- **TUS-js-client** for the resumable protocol (battle-tested)
- **Code splitting** — lazy-load the share-page route, the preview viewer, the trash page

---

## 6. Quick win priority list (in order)

| # | Win | Effort | Impact | Reference |
|---|---|---|---|---|
| 1 | **Parallel chunk download** with bounded concurrency (4–8) | Low | Massive | DDrive bottleneck |
| 2 | **HTTP Range passthrough to Discord CDN** for partial downloads | Low | Huge (video streaming) | discloud |
| 3 | **AES-256-GCM** at rest (replacing any current CTR/CTR-like scheme) | Medium | Critical for trust | discord-cloud-storage pattern, fixed |
| 4 | **Resumable uploads** via TUS.io | Medium-High | Critical for >1 GB | DDrive absence |
| 5 | **Signed share links** with HMAC + TTL + password + max-downloads | Medium | Killer feature | Every project lacks |
| 6 | **Delete chunks from Discord** in the same transaction as the metadata delete | Low | Correctness | CloudCord/discloud bug |
| 7 | **Real search** via SQLite FTS5 on filename + extracted text snippets | Medium | Daily-use win | DDrive absence |
| 8 | **Image / video thumbnails** generated server-side | Medium | UX win | All absences |
| 9 | **Discord OAuth** for cross-device identity (alongside webhook) | High | Multi-device | DiscordFileHost pattern |
| 10 | **Per-user quota + rate limit** with the arc-gauge widget v2.0 already plans | Medium | Production-grade | Every project lacks |
| 11 | **Pino structured logging + request IDs** | Low | Operability | Every project lacks |
| 12 | **Graceful shutdown** + `/healthz` + `/readyz` | Low | Operability | Every project lacks |
| 13 | **CI pipeline**: lint + typecheck + vitest + Docker build | Low | Quality gate | Every project lacks |
| 14 | **Browser extension** (optional) for direct CORS-bypass downloads | Medium | UX win | DisboxApp pattern |
| 15 | **Content-addressed dedup** (SHA-256 chunk hash → refcount) | High | Storage efficiency | Every project lacks |

---

## 7. What we're already doing better than the competition

For the record, Wyvern Drive's v1.0 already beats all 6 reference projects in these specific ways:

- ✅ **Webhook-based** (correct; CloudCord + discloud use bots, and bots + Discord ToS is a known risk)
- ✅ **Fastify + TypeScript** (faster, type-safe, JSON-schema validated; DiscordFileHost uses Express, all others use Express or Flask)
- ✅ **better-sqlite3** (synchronous, embedded, zero-config, production-grade; DisboxApp-server uses raw `sqlite3` and has dead `levelup`/`leveldown` deps; DiscordFileHost uses Realm which is dying)
- ✅ **JWT auth containing the webhook** (stateless, no DB user table; DDrive uses Basic Auth, DisboxApp uses `sha256(webhook)` in URL — both worse)
- ✅ **`@discordjs/rest 2.x`** (battle-tested, current; CloudCord hand-rolls `reqwest`, DDrive is on `1.0`, DisboxApp uses no library)
- ✅ **Dynamic CDN URL refresh** (solving Discord's late-2023 24-hour URL expiry — none of the references handle this)
- ✅ **`StorageBackend` interface** for swappable engines (per `PROJECT.md:78`) — none of the references are engine-agnostic
- ✅ **Vite + React 18 + TypeScript** with custom CSS (no MUI/Bootstrap/FA soup like DisboxApp)
- ✅ **Vitest** is already in `package.json:28` — none of the references have any tests

The v2.0 work on the premium UI (sidebar gauge, detail pane, context menus, task queue) is a strong UX bet that none of the references have. The roadmap is sound — these competitive findings should inform v3+.

---

*End of synthesis. Cross-references: PROJECT.md (v2.0 scope), REQUIREMENTS.md (validated + active), ROADMAP.md (to be updated after this research).*
