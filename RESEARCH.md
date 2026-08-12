# Wyvern Drive — Reference Study (2026-08)

Research synthesis across 14 areas for Wyvern Drive, a self-hosted Discord-backed
personal cloud drive (Node 20 + Express + SQLite; React web client; per-user
Discord webhooks, no bot; 2 MiB chunks, zlib + AES-256-GCM, packed 10 per
message; content dedup by stored-bytes hash; multi-webhook round-robin).

Scope: 14 reference projects (8 already vendored in `refs/`, 6 newly cloned
2026-08-12). Each was studied by a read-only scout against its local clone or
vendored copy; the findings below are grounded in those sources, cited by
`refs/<dir>/...` paths. Provenance (upstream URLs + vendored SHAs) lives in
`refs/README.md`. This document is self-contained; follow-ups should treat the
`refs/` dirs as read-only prior art.

Layout convention: this file sits at the repo root next to `DESIGN.md` and
`PRODUCT.md`, the project's established design-doc location (no planning dir
exists in this repo).

---

## 1. Reference set

| Repo | Language | Status (2026-08-12) | Role in study |
|---|---|---|---|
| disbox-web / disbox-server / disbox-extension | JS/React, Node | unmaintained (2024-02-29) | primary prior art — webhook storage |
| D-Drive (jasonzli-DEV) | TS/Node | active (v3.0.0, 581 commits) | bot storage, Range, cleanup |
| discord-drive (expiracy) | Python | PoC, unmaintained | baseline of what-not-to-do |
| discord-cloud-storage (Sebastian-Webster) | TS/Node | active-ish (504 commits) | zombie-attachment recovery, retry budgets |
| DiscordFS-GiacoBot | Python FUSE | young, complete | on-Discord manifests, upload-then-swap, rebuild |
| DiscordFS-Ryokau | C# Dokan | prototype | Windows drive, adaptive throttle, CRC32 |
| ddrive (forscht) | **Node** (not Go) | unmaintained (2023-12-01) | large files, chunking, HTTP/API |
| dsfs (darenliang) | Go FUSE | pre-alpha (2023-07-30) | Discord filesystem, tx-log index, CDN reads |
| discord-cdn-proxy (useapi) | TS (Worker/GAE/Deno) | active (2026-02-28) | CDN URL expiry + refresh |
| gcsfuse | Go | active (2026-08-11) | FS architecture, caching, metadata |
| s3fs-fuse | C++ | active (v1.97, 2026-08-09) | object-store FS semantics |
| agent-fs (desplega-ai) | Bun/TS + Rust | active (2026-08-05) | sync, search/indexing |

Six new clones added to `refs/`: `ddrive`, `dsfs`, `discord-cdn-proxy`,
`gcsfuse`, `s3fs-fuse`, `agent-fs` (all shallow at HEAD; SHAs in
`refs/README.md`).

---

## 2. Findings by area

### 2.1 Discord storage — refs/ prior art + ddrive

**Disbox (primary prior art, all three repos).** The server
(`refs/disbox-server/disbox-server.js`, `disbox-file.js`) is a metadata-only
SQLite CRUD backend keyed by `sha256(webhookUrl)` — it never talks to Discord;
all Discord I/O runs in the browser (disbox-web). Webhook URL = the account,
kept in `localStorage`; the server never sees it. Chunks are `25*1024*1023` =
26,188,800 B (~24.98 MiB, leaving 25 KB under the then-25-MiB cap), one per
webhook message with `?wait=true` (returns the message ID synchronously),
posted sequentially, raw/unencrypted. Downloads are sequential
GET-message → CDN-fetch; Discord's missing CORS headers force a Chrome
extension (base64 handoff, +33% size) or the allOrigins third-party proxy.
Rate limits: per-request-type wait buckets reading `X-RateLimit-Remaining` /
`Reset-After`, exact `retry_after` sleep, infinite recursive retry, no
`X-RateLimit-Global` handling. Orphans leak on every interrupted
upload/delete (DB row first, Discord delete second). Wyvern is a direct
superset that fixes each structural weakness (server-owned credentials,
packing, parallelism, recycle bin); nothing here is worth porting back except
the `?wait=true` pattern and the near-limit headroom trick.

**The other five vendored refs are all bot-based, single channel, one message
per chunk** — Wyvern is the only webhook design in the group, and the only one
that avoids the shared-bot-account rate-limit bottleneck.

- **D-Drive** (`refs/D-Drive/backend/src/services/discord.ts`): 8 MiB chunks,
  Postgres/Prisma metadata (`FileChunk { messageId, attachmentUrl, size }`),
  per-chunk AES-256-GCM with PBKDF2(100k)/chunk (avoid), upload retries 3 with
  500 ms doubling backoff, delete retries 5 with exp backoff + jitter and
  `Unknown Message 10008` treated as success (idempotent deletes), 413
  pre-check before upload, HTTP Range mapped to chunks via cumulative sizes,
  copy = re-upload (Wyvern's block-sharing instant copy wins), channel-scan
  cleanup honoring `retry_after`.
- **expiracy** (`refs/discord-drive/`): 8 MB exact chunks (no margin), no
  retries/backoff, whole-file-in-memory reassembly, delete removes only DB
  rows — orphans everything. What-not-to-do baseline.
- **discord-cloud-storage** (`refs/discord-cloud-storage/`): 9 MiB chunks via
  the modern 3-step attachment-URL flow (POST /channels/{id}/attachments →
  PUT upload_url → POST message), **zombie-attachment recovery** (if the
  message POST fails after the PUT, the uploaded attachment refs are reused on
  retry instead of re-uploading the bytes), retry budgets proportional to work
  (`chunks×20` upload / `×3` download / `×5` delete), `retry_after × 1.1`
  sleep, real E2E test vs a mock Discord server (1 GiB round-trip).
- **DiscordFS-GiacoBot** (`refs/DiscordFS-GiacoBot/`): FUSE (Python, Linux).
  Most structured design: three message kinds (`[DFS]` chunk,
  `[DFS:meta]` encrypted manifest attachment, `[DFS:delete]` tombstone),
  metadata **both** in local SQLite (WAL, `BEGIN IMMEDIATE`) and in on-Discord
  encrypted manifests enabling `discordfs rebuild` channel-scan recovery;
  5-phase upload-then-swap (upload chunks → upload manifest → read old IDs →
  DB transaction → delete old messages **after** commit); 429 sleeps don't
  consume the retry budget; 401/403/404 fail fast; sync cursor rollback for
  orphaned chunks; `purge --dry-run` classifies and bulk-deletes.
- **DiscordFS-Ryokau** (`refs/DiscordFS-Ryokau/`): Windows Dokan drive (C#).
  Whole-file AES-256-GCM then 9 MiB fragments with per-chunk CRC32; CRC32
  verified on every download (corruption detection); **SmartThrottler**:
  random 1.5–4.2 s pre-request delay, multiplier ×3 on 429 (cap 20×) with a
  60 s pause, ×0.9 decay on success; UA rotation + fake image filenames
  (avoid — reads as ToS-bait). Delete is DB+cache only — leaks messages.

**ddrive** (`refs/ddrive/src/DFs/index.js`): Node + Fastify, webhook-only
(round-robin via `lastWbIdx`), Discord I/O through `@discordjs/rest` 1.0.0.
24 MiB chunks (25,165,824 B; hard max 26,109,542 < 25 MiB), 3 concurrent, one
attachment per message, filename = uuid. Metadata in Postgres (knex):
`directory` + `block { url, size, iv }`; rows inserted only after all chunks
succeed (no half-files, but failed uploads orphan Discord messages — no
cleanup). Downloads: sequential `https.get` of stored CDN URLs with optional
per-part Range; part order from `jsonb_agg` **without ORDER BY** (formally
unordered — Wyvern's explicit chunk ordinal is mandatory). **Zero app-level
429/retry/backoff code** — survival delegated to @discordjs/rest buckets plus
webhook count. AES-256-CTR (unauthenticated — avoid). Delete is DB-only,
leaking stored bytes forever (deliberate). Claims 5 GB / 85 s and 4000 GB
tested — near-25-MiB chunks are production-proven. Env guidance: ≥5 webhooks,
1 per channel — same ballpark as Wyvern's 8-cap.

### 2.2 Discord filesystem — dsfs

`refs/dsfs` (Go, cgofuse FUSE, bot or user token): two fixed channels —
`#tx` = append-only JSON transaction log (the entire index: `{tx, type, path,
ids[], sums[], size, mtim, ctim}`) packed several per attachment; `#data` =
chunks, 8,388,119 B (~8 MiB) each, up to 10 attachments/message. Index is an
in-memory radix tree **replayed from the log at every startup** (compaction
via a pinned message); no local persistence, no xattrs. Writes buffer in
memory until close, then whole-file flush with per-chunk SHA1 skip; reads
prefetch the whole file from the **CDN directly** (first + last chunk first,
torrent-style) with a sparse-range tracker blocking reads ≤5 s. Rate limiting
= one serialized writer queue batching ≤10 items / 25 MiB / 5 s → ≤1
message/5 s per channel; **no 429 detection anywhere**. Pre-alpha, author
flags sync bugs. Restart replay only pages messages older than the pin
[INFERENCE from `setupDB` paging]. Lessons: CDN-direct reads cost zero API
rate limit; per-chunk checksums enable skip-unchanged rewrites; a serialized
per-webhook batch window is a belt-and-braces throttle; the `#tx` log is a
free change-feed for multi-client sync (an oplog, not an index).

### 2.3 Discord CDN — discord-cdn-proxy

`refs/discord-cdn-proxy` is **not** a content proxy: it is a URL re-signing
redirector. Since Dec 2023, CDN attachment URLs carry signed `ex`/`is`/`hm`
query params and 404 after expiry. The proxy 302-redirects to a freshly
re-signed URL obtained from `POST /api/v9/attachments/refresh-urls`
(authorized by a **raw user token**), with an in-memory Map + optional R2/Deno
KV cache, zero rate limiting or auth on the proxy itself. Relevance for
Wyvern: **it already sidesteps this by design** — `content_blocks` stores
`message_id` + `webhook_id` (never CDN URLs), and `getChunk`
(`server/src/storage/discord-webhook-storage.js`) re-fetches the message via
the webhook GET endpoint each time, so attachment URLs are always freshly
signed. The only exposure is if a cached message/CDN URL is ever introduced:
handle 404 by re-fetching the message. ddrive's stored-URL model is the
cautionary counterexample (relies on URLs never expiring).

### 2.4 Filesystem architecture — gcsfuse

`refs/gcsfuse` (Go, Apache-2.0, active): layered stack — kernel FUSE boundary
(`jacobsa/fuse`) → `internal/fs` inode tree (inode identity keyed to GCS
generation; remote overwrite ⇒ new generation ⇒ new inode) → `internal/gcsx`
(`SyncerBucket` write-through; `BucketManager` owns a shared LRU stat cache)
→ every bucket wrapped by `internal/storage/caching/fast_stat_bucket.go`
(the metadata decorator) → storage clients. Data path and metadata path are
fully separated. The metadata decorator is the load-bearing idea: `stat`/
`readdir`/`lookup` are served from the stat cache, invalidated synchronously
on every local mutation (write-through, including prefix erase on folder
rename), and **readdir pre-fills the stat cache** so a following per-file
`stat` storm costs zero backend calls. Wyvern's SQLite already is its stat
cache; the missing pieces are the in-memory folder-listing LRU, short-TTL
negative entries, synchronous invalidation, and a per-file revision.

### 2.5 Object storage filesystem — s3fs-fuse

`refs/s3fs-fuse` (C++, GPLv2, active): **the bucket is the filesystem** — no
index service; metadata lives in `x-amz-meta-*` object headers; directories
are zero-byte `dir/` objects; rename = server-side copy + delete (non-atomic,
rejects RENAME_NOREPLACE/EXCHANGE); truncate = local resize + flush. Writes
buffer to a local cache file with a `PageList` dirty-range tracker, flushed on
close — single PUT, full multipart (10 MB parts, 25 MB threshold, 10,000-part
cap), "mix" multipart that copy-parts unmodified ranges server-side, or
streaming. Metadata caching is an in-memory TTL stat cache (100k entries,
900 s, negative entries) plus cached readdir listings. Retries: 5, exponential
`(2<<n) + rand()` jitter, 429/503 → EAGAIN. Two cautionary artifacts: (a)
the metadata-in-headers design forced "avoid HEAD-per-op" cache work
(ChangeLog 1.96) — the exact failure mode Wyvern's SQLite index avoids; (b)
PR #2912 documents a real silent-data-loss bug class (stream-upload flush
failure cleared the in-flight list, then a retried flush marked pages clean
without uploading them; fix = abort MPU + rebuild from modified pages).
`s3fs -u` (mpu_util) is an incomplete-multipart-upload GC utility — the
analogue of a Discord orphan reconciliation job.

### 2.6 FUSE abstraction

No dedicated FUSE-abstraction repo was in the clarified scope; the FUSE
projects studied cover the space (cgofuse in dsfs, jacobsa/fuse in gcsfuse,
libfuse in s3fs, WinFsp/Dokan for Windows). Cross-cutting lesson (dsfs §2.2,
s3fs §2.5): synchronous random-access FUSE read semantics are hostile to a
rate-limited remote backend — dsfs had to prefetch whole files and block reads
up to 5 s; s3fs lives with stale metadata and non-atomic ops. A HTTP + Range
surface (Wyvern's model) is the friendlier interface; if a FUSE/WinFsp layer
is ever added it must sit on a local cache with async sync, never synchronous
backend calls per read.

### 2.7 Caching — gcsfuse / s3fs-fuse

gcsfuse has four caches: stat cache (default 34 MB LRU, TTL 60 s, negative
entries TTL 5 s, generation-rule on insert, byte-budgeted), type cache
(per-directory 4 MB, being deprecated — lookups unified through the stat
cache), file cache (disk, off by default, validates cached data against object
generation on TTL expiry; unencrypted on disk), and kernel list/attr caches
(TTL-driven; list cache off by default). s3fs adds: stat cache 100k entries /
900 s TTL, cached readdir `S3ObjList` per directory, dirty-range `PageList`
with `max_dirty_data` early flush + punch-hole. Transferable to Wyvern:
folder-listing LRU seeded by `readdir` (the readdir-prefills-stat pattern),
negative entries with a short TTL, synchronous invalidation on local
mutation, and a disk blob cache keyed by stored-bytes hash with re-hash
validation on read (stronger than gcsfuse's generation check) — keeping
encryption at rest in any such cache.

### 2.8 Sync architecture — agent-fs (negative finding)

`refs/agent-fs` (Bun/TS monorepo, "persistent, searchable filesystem for AI
agents", MIT, active) does **not** contain a sync/reconciliation engine:
"sync" in its README means S3 as the byte-store backend plus optional bucket
versioning. The genuinely transferable architecture is the storage split:
a `StorageAdapter` contract (10-method dumb keyed blob store with a
`capabilities { versioning, presignedUrls }` flag — "all filesystem semantics
in SQLite"), SHA-256 content-addressable dedup with **blob-first write
ordering** (object PUT before version-row commit), and optimistic concurrency
closed by a SQLite UNIQUE index (`file_versions(path, drive, version)` →
`EditConflictError`). The only real sync mechanism among all 14 refs is
dsfs's `#tx` append-only log (§2.2) — a change feed, not a reconciler.

### 2.9 Large-file handling — ddrive

ddrive's answer: 24 MiB chunks, 3 concurrent uploads, webhook round-robin,
streaming chunker with exact-size buffers + residue carry, per-part Range
download. Claims 4000 GB tested and 5 GB / 85 s. The 25 MiB attachment cap is
the hard ceiling; throughput is fundamentally message-count × per-message
size, so the levers are chunk size (fewer messages) and webhook count (more
parallel buckets). Wyvern's 10×2 MiB ≈ 20 MiB per message is the same
message-count economics with finer Range granularity and cheaper per-message
failure blast radius.

### 2.10 Chunking — all refs

| Repo | Chunk | Per message | Crypto |
|---|---|---|---|
| disbox | 26,188,800 B | 1 | none |
| ddrive | 24 MiB | 1 | AES-256-CTR (avoid) |
| D-Drive | 8 MiB (−44 B) | 1 | AES-256-GCM, PBKDF2/chunk (avoid) |
| expiracy | 8 MB exact | 1 | none |
| Sebastian-Webster | 9 MiB | 1 | AES-GCM, sha512-derived key (avoid) |
| GiacoBot | 8 MiB ciphertext | 1 (+manifest) | pyzipper AES+DEFLATE (avoid) |
| Ryokau | 9 MiB | 1 | whole-file GCM then chunk (avoid) |
| dsfs | 8,388,119 B | ~3 | none (SHA1 sums) |
| **Wyvern** | **2 MiB plaintext** | **10** | **AES-256-GCM fresh nonce, zlib** |

Wyvern is the only packed design. Every other project pays 1 message per
chunk (rate-limit cost) for simplicity; the near-limit chunk sizes prove the
25 MiB ceiling is safe to approach with headroom (disbox leaves 25 KB; ddrive
caps at 26,109,542; dsfs at 26,214,400). Wyvern's 10×~2 MiB + zlib + GCM tag
+ multipart framing must stay under ~21 MiB to absorb overhead and future
tightening.

### 2.11 HTTP/API — ddrive

Fastify REST: `GET/POST/PUT/DELETE /api/directories[/:id]`, file CRUD,
multipart upload with `fileSize: Infinity` streamed straight to Discord
(memory-bounded), streaming download with 206 Range mapped to per-part CDN
Ranges, Basic auth with `ACCESS_TAGS` and `PUBLIC_ACCESS` = `READ_ONLY_FILE`
(download-only) vs `READ_ONLY_PANEL` (browse-only), error handler returning
`{id, message}`. The read-only access tiers are a clean model for Wyvern's
anonymous share links; Range-per-part download matches Wyvern's existing 206
slicing.

### 2.12 Metadata — gcsfuse / object stores / agent-fs

Three patterns: (a) gcsfuse — stat-cache decorator + generation-keyed inodes +
synchronous write-through invalidation + readdir-prefills-stat + mtime in
custom metadata; (b) s3fs — metadata in object headers + HEAD-per-op + TTL
stat cache (the cautionary baseline: they spent releases avoiding HEAD calls);
(c) agent-fs — SQLite as sole authority, version rows, content-addressed
blobs. Consensus across all: **an index the backend can serve without extra
calls is the win; never rebuild the index from the store's state**. Wyvern's
SQLite index is already the right pole; the additions worth making are a
per-file revision/generation (gcsfuse ESTALE equivalent, agent-fs
`expectedVersion`) and keeping chunk ordinals explicit (ddrive's missing
ORDER BY).

### 2.13 Search / indexing — agent-fs

agent-fs is the strongest search reference: SQLite FTS5 virtual table
(`files_fts`: path, content, drive_id unindexed) with an upsert pattern and
`snippet()`, plus sqlite-vec `vec0` embeddings with a
`pending/indexed/failed` status column and a reindex op (batch 3), hybrid
fusion via RRF (k=60) of keyword + vector scores, indexability gate by MIME +
strict UTF-8. For Wyvern's server-side global search, FTS5-over-SQLite is a
concrete upgrade path (tokenized, ranked, incremental) over LIKE-based
matching, with the status-column + reindex pattern for any future extraction
pipeline.

### 2.14 Remote filesystem semantics — s3fs-fuse / gcsfuse

- Consistency: gcsfuse = close-to-open / fsync-to-open; generations give
  ESTALE on clobbered files (first flush wins, losers get ESTALE, never silent
  loss). s3fs = no atomic rename, no multi-client coordination, TTL-stale
  metadata, eventual consistency on non-AWS stores.
- Partial-upload visibility: S3 single-PUT is atomic per object; Wyvern's
  chunk-per-message is **not** — a file's chunks land over multiple messages,
  so readers must never see an entry whose chunks aren't all posted (commit
  index last or gate reads on a `complete` flag).
- Crash windows: s3fs's data-loss window is flush-on-close; Wyvern must define
  its own (un-posted chunks vs committed index) and drive Discord POSTs from a
  resumable outbox over a WAL + transactional index. Unlink-while-open:
  s3fs suppresses the final upload for unlinked files; Wyvern's recycle bin +
  block refcounting already covers the deletion side.
- Retry shape: gcsfuse — exponential ×2, 30 s cap, jitter, unlimited 429
  attempts, per-chunk retry deadline (~120 s), optional token bucket
  (`limit-ops-per-sec`); s3fs — `(2<<n) + rand()` jitter, terminal EAGAIN.

---

## 3. Consolidated recommendations (ranked)

P0 — correctness, durability, rate-limit survival:

1. **Gate reads on upload completion; commit the index last.** A Wyvern file
   becomes visible as soon as its entry rows exist, but its chunks arrive
   across multiple Discord messages. Mirror s3fs's single-PUT atomicity:
   either keep entries invisible until all chunks are posted, or add a
   `complete` flag the download path refuses without. (s3fs-fuse semantics
   §2.14; GiacoBot 5-phase order §2.1.)
2. **Drive Discord POSTs from a resumable outbox over a WAL + transactional
   index.** Current resumable-upload reuse covers client retries; the crash
   window (POST succeeded, DB not updated) needs a durable pending-chunk
   record so a restart resumes, not duplicates. Never clear an in-flight list
   on failure — s3fs #2912 proved that silent-loss class is real. (s3fs-fuse
   §2.5; gcsfuse finalize-on-close §2.4.)
3. **Orphan reconciliation job.** Ship a `purge`-style diff of Discord
   messages vs `content_blocks` (by webhook + message_id) that finds and
   deletes orphaned chunks — the s3fs `-u` / GiacoBot `purge --dry-run`
   pattern. The trash sweep cleans SQLite; nothing today cleans Discord
   orphans from failed POSTs. (s3fs §2.5; GiacoBot §2.1; ddrive §2.1.)
4. **Harden 429 handling:** honor `retry_after × 1.1`; never let a 429
   consume the retry budget; fail fast (no retry) on 401/403/404; add jitter
   to backoff so 8 webhooks hitting limits together don't thunder-herd; watch
   `X-RateLimit-Global` (currently ignored, as in disbox); size retry budgets
   to work (`chunks×k`); consider a per-webhook adaptive multiplier that
   decays on success (Ryokau SmartThrottler) or a token bucket sized to
   Discord's per-hour webhook budget (gcsfuse) instead of reacting only to
   429s. (All refs; strongest: GiacoBot, Sebastian, Ryokau, gcsfuse.)
5. **Verify chunk integrity on download.** The dedup hash of stored bytes
   already exists in `content_blocks.content_hash`; assert it again after the
   CDN fetch in the prefetch path to catch silent CDN corruption. (Ryokau
   CRC32, GiacoBot sha256 sums, s3fs ETag.)

P1 — performance:

6. **Metadata caching, gcsfuse-style:** keep a byte-budgeted in-memory LRU of
   folder row-sets (readdir pre-fills stat for the follow-up per-file stat
   storm), short-TTL negative entries, and synchronous invalidation on every
   local mutation (including prefix erase on rename/copy). (gcsfuse §2.4.)
7. **Per-file revision/generation** bumped on every write; stale/conflicting
   client writes rejected (gcsfuse ESTALE, agent-fs `expectedVersion`).
8. **First + last chunk prefetch** on open for fast previews, then the rest
   in order. (dsfs §2.2.)
9. **Reconsider chunk size.** ddrive's 24 MiB single-chunk design is
   production-proven and halves the per-file message count; Wyvern's 2 MiB×10
   packing gets the same economics with better Range granularity and a smaller
   per-message blast radius. Only change if a measurement shows message-count
   rate limits binding; keep 10/message and <21 MiB packed.
10. **Optional CDN-URL caching with expiry-aware refresh:** cache message
    fetches keyed by `message_id` to skip the webhook GET per download; on CDN
    404, re-fetch the message (fresh signatures). Not required for
    correctness — Wyvern never persists URLs — purely a latency/rate-limit
    optimization. (discord-cdn-proxy §2.3.)

P2 — features:

11. **FTS5 search upgrade** for global search, with the agent-fs
    status-column + reindex pattern. (agent-fs §2.13.)
12. **Formalize the storage adapter contract** (capabilities flags like
    agent-fs's `{versioning, presignedUrls}`) so the in-memory fake and the
    webhook adapter stay interchangeable — the test suite already treats them
    as such. (agent-fs §2.8.)
13. **Read-only access tiers for share links** (download-only vs browse-only),
    ddrive's `PUBLIC_ACCESS` model. (§2.11.)
14. **Richer attachment breadcrumbs**: embed chunk index + block hash in
    attachment filenames (disbox's `{file_id}_{index}` seed) so a lost
    SQLite file is partially recoverable by channel inspection. (§2.1.)
15. **Optional oplog** (SQLite or append-only) as a change feed for future
    multi-client sync — the dsfs `#tx` idea, kept as a sync channel, never as
    the primary index. (§2.2/§2.8.)
16. **Optional channel-scan rebuild escape hatch** (GiacoBot `rebuild`) only
    if SQLite backup discipline is weak; otherwise the trade (1 manifest
    message per file, existence leak via message headers) is not worth it.

---

## 4. Do not adopt

- **Persisting CDN URLs as the block reference** (ddrive) — they expire since
  Dec 2023; Wyvern's message_id + fresh-resolve design is correct.
- **AES-256-CTR without authentication** (ddrive), **PBKDF2-per-chunk**
  (D-Drive), **sha512-derived single key** (Sebastian), **whole-file-then-
  chunk encryption** (Ryokau), **pyzipper AES** (GiacoBot).
- **Browser-side Discord I/O / CORS workarounds** (disbox extension, allOrigins
  proxy, base64 handoff) — server-side proxying already eliminates this class.
- **UA rotation / fake image filenames / evasion** (Ryokau) — ToS-bait,
  pointless for a self-hosted personal drive.
- **Replay-index-at-startup** (dsfs) — SQLite stays authoritative.
- **Implicit-dir prefix probing** (gcsfuse) — extra requests per lookup.
- **Metadata in object headers / HEAD-per-op** (s3fs) — the SQLite index
  exists precisely to avoid this.
- **Non-atomic copy-then-delete rename** (s3fs) — Wyvern's SQLite rename is
  atomic; keep it that way.
- **DB-only deletion without reclaim** (ddrive, expiracy, Ryokau) — Wyvern's
  recycle bin + block refcounting is the correct counter; just ensure delete
  actually deletes Discord messages at purge time.
- **Unbounded in-memory caches / open CORS redirect endpoints**
  (discord-cdn-proxy).
- **FUSE as the primary access surface** on a rate-limited backend (dsfs
  blocking reads, s3fs staleness) — HTTP + Range stays primary; any future
  WinFsp/Dokan layer must cache locally and sync async.

---

## 5. Inherent Discord constraints (watch list)

- 25 MiB per-message attachment cap; 10 attachments per message; message-edit
  limits (10 edits / 10 min) irrelevant for append-only designs.
- Rate limits are dynamic and unpublished; ~5 messages / 5 s per channel-class
  for bots; webhooks are separate buckets — throughput = message count × size,
  and webhook count multiplies capacity (ddrive: ≥5, 1 per channel; Wyvern:
  8 cap).
- CDN attachment URLs expire (signed `ex`/`is`/`hm`); message objects returned
  by the API carry fresh signatures — Wyvern's fetch-message-then-CDN path is
  the correct pattern.
- Orphaned chunk GC on Discord is not reliably possible (CDN copies linger);
  plan for unbounded channel growth or periodic archival.
- Webhook-only credentials cannot read channels back (no bot / Message Content
  Intent); the SQLite index must stay authoritative — no channel-scan recovery
  without a bot.
- No ref solves the multi-webhook global-rate-limit-bucket interplay (all
  other projects are single-channel bots); Wyvern's round-robin is the right
  lever but the exact per-account vs per-webhook budget split is unverified.

---

## 6. Open questions

- Whether Wyvern's 2 MiB × 10 packing is actually message-count-bound in
  practice (measure 429 frequency before changing chunk size — §3.9).
- Whether a `complete`-flag or outbox change is needed today: the resumable
  upload token reuses entries and skips posted chunks, but the crash window
  between Discord POST and SQLite commit deserves an explicit audit
  (§3.1/§3.2).
- Multi-webhook budget interplay (§5) — needs live observation, not theory.

---

## 7. Sources

- 8 scout research briefs produced 2026-08-12 against the local clones; key
  files per repo are listed in each section above.
- `refs/README.md` — vendored provenance table (upstream URLs + SHAs) for all
  14 repos, updated 2026-08-12 with the six new clones.
- Wyvern Drive ground truth read during synthesis:
  `server/src/storage/discord-webhook-storage.js` (getChunk: webhook GET
  message → `attachments[index].url` → CDN fetch; 404-as-delete-success),
  `server/src/db/repositories.js` (content_blocks keyed by `message_id` +
  `webhook_id`, per-message attachment indexing in `file-service.js`),
  `server/src/db/migrations/004_block_store_trash.sql`.
- Discord API behavior claims (signed CDN URL expiry; message objects carrying
  fresh attachment signatures; refresh-urls requiring a user token) are
  grounded in the discord-cdn-proxy study; the message-fetch-refresh path is
  what Wyvern's adapter already exercises in production.
