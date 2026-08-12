# Wyvern Drive

A self-hostable, Discord-backed personal cloud drive. Files are split into
chunks, compressed and encrypted at rest with AES-256-GCM, and stored as
Discord attachments posted through the drive's Discord webhooks (Disbox-style;
a drive can register several webhooks and uploads round-robin across them).
Each user connects their own webhook once on the `/connect` page; the server
validates it, encrypts it at rest under the master key, and performs all
Discord I/O. The server owns all credentials and metadata (SQLite); the
browser never sees webhook URLs, Discord message IDs, or raw attachment URLs.

**No Discord bot is used.** Identity is Discord OAuth2 and storage is a
per-user webhook; files are encrypted server-side before upload. The bot-era
implementation (one private channel per user) is preserved as migration
history in `drives.legacy_discord_channel_id` and is not auto-migrated.
The `refs/` directories remain read-only prior art, not runtime behavior.

**License:** proprietary — see [LICENSE](LICENSE). Vendored references under
`refs/` retain their own licenses.

## Features

- Discord OAuth2 sign-in with server-side sessions and CSRF protection
- One personal drive per user; configurable quota (default 10 GiB)
- **Multi-webhook scaling**: a drive registers up to `WYVERN_MAX_WEBHOOKS_PER_DRIVE`
  (default 8) Discord webhooks and uploads round-robin across them, raising
  parallel upload throughput; webhooks that still store content cannot be removed
- **Content dedup**: identical content within a drive is stored once — later
  uploads of the same bytes reference the existing block with no Discord I/O
- **Per-chunk compression**: each chunk is zlib-deflated before AES-GCM
  encryption (`WYVERN_COMPRESS_CHUNKS`, default on), shrinking stored bytes;
  the content hash covers the stored form so dedup survives compression
- Parallel packed uploads: files are cut into plaintext chunks, each compressed
  and encrypted with AES-256-GCM (fresh 12-byte nonce + auth tag), and up to 10
  chunks are posted per Discord message as attachments, with concurrent batches
  in flight
- Resumable uploads: a client upload token reuses the entry after an
  interruption and skips already-posted chunks; server-side progress polling
- HTTP Range downloads (206 partial content) and inline file previews
- Folder ZIP download: any subtree streams as an archive
- Folders; rename, move, and **instant copy** (copies share blocks — no
  Discord I/O); **folder upload** (picker and drag-and-drop both preserve the
  folder tree)
- **Recycle bin**: delete moves entries to trash (no Discord I/O); restore,
  delete-forever, and a lazy retention sweep (`WYVERN_TRASH_RETENTION_DAYS`,
  default 30) purge expired trash automatically (also run once at boot)
- **Global search**: a query searches the whole drive, not just the open
  folder — the folder scope is skipped for searches, so results come from
  every folder and a stale parent cannot 404 a search; empty queries stay
  folder-scoped
- **Upload cancellation**: in-flight uploads can be cancelled from the
  floating queue — the XHR aborts and the partial upload (entry + posted
  chunks + now-dead Discord messages) is hard-purged server-side, so nothing
  leaks into quota or trash
- **Drive stats**: a usage dashboard in Settings (files, folders, logical
  size, stored-on-Discord size, compression ratio, webhooks)
- Server-backed search and sort
- Anonymous read-only share links with optional expiry and revocation
- Cloud-service-style UI (Google Drive / Dropbox / Mega flow): desktop list + grid views, row/card selection with bulk actions, hover-revealed actions, drag-and-drop upload, floating upload progress manager; responsive (desktop table/grid, mobile cards)
- Friendly first-run onboarding: a guided `/setup` page (Discord app link, copyable redirect-URI chip, a form that saves the Discord Client ID/Secret plus safe derived defaults, restart-and-recheck, "What's left" diagnostics showing variable names only) and a step-by-step `/connect` page walk users through connecting their own storage in about a minute
- Rate limiting on OAuth, mutations, and public share downloads

## Architecture

| Path | What it is |
|---|---|
| `server/` | Node.js 20 + Express + SQLite. Config validation, numbered migrations, OAuth/session/authz, per-user webhook storage adapter, transactional file service, REST API, rate limits. |
| `web/` | React 17 + MUI 5 (CRA). Talks only to same-origin `/api`; XHR uploads with progress; CSRF cookie + header injection. |
| `refs/` | Vendored reference projects (Disbox and similar Discord-cloud-storage projects). Read-only prior art; provenance in `refs/README.md`. |

Security model: server-side encryption, not end-to-end. Discord and the
browser never receive plaintext chunks, storage internals, or encryption keys;
the server decrypts only for authorized downloads and shares. Chunks are
deflated (optional) and encrypted per chunk, then packed up to
`WYVERN_CHUNKS_PER_MESSAGE` (default 10) per Discord message; uploads run
`WYVERN_UPLOAD_CONCURRENCY` batches in parallel and downloads prefetch
`WYVERN_DOWNLOAD_CONCURRENCY` chunks ahead. Each unique chunk is stored once
per drive (`content_blocks`, keyed by the hash of its stored bytes), so
identical files and copies share Discord messages instead of duplicating them.

## Quick start (development)

Prerequisites: Node 20+, a Discord application (OAuth2 client ID/secret and a
redirect URI — no bot), and a base64-encoded 32-byte
`WYVERN_ENCRYPTION_KEY` (generate one with `node -e
"console.log(require('crypto').randomBytes(32).toString('base64'))"`).

```sh
# server (port 8080)
cd server
cp .env.example .env   # fill in the required values
npm install
npm start

# web (port 3000, proxies /api to :8080)
cd ../web
npm install
npm start
```

On first run the server loads `.env` (dotenv), validates the configuration, and
— if anything is missing or invalid — starts in **setup mode**: a server that
serves `GET /api/setup/status`, the authenticated `/api/setup/credentials`
write route, and a friendly guided `/setup` page. The page links to the Discord
developer portal, shows a copyable chip with your redirect URI, and lists
exactly which variables are missing or invalid (names only, never values). On
it you can enter the Discord Client ID and Client Secret directly: the server
derives safe defaults for `APP_ORIGIN`, `DISCORD_REDIRECT_URI`, and `DB_URL`,
and generates a fresh `WYVERN_ENCRYPTION_KEY` when none is set, writing the
batch atomically to `server/.env`. Requests from outside the machine require
the one-time setup token printed in the server log (`Wyvern server setup
token: …`) and must use HTTPS. Values are never returned to the browser,
logged, or kept by the web client. Restart the server for the written file to
take effect, then hit Recheck, and `/setup` redirects to the normal sign-in
flow. A file-backed `DB_URL` parent directory is created automatically. The
OAuth callback URI on your Discord application must match
`DISCORD_REDIRECT_URI` exactly (`<APP_ORIGIN>/api/auth/discord/callback`).

Open http://localhost:3000 and sign in with Discord.

## Configuration

Required environment variables (full list in `server/.env.example`):

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 8080) |
| `APP_ORIGIN` | Public origin of the web app; only origin allowed by CORS/CSRF |
| `DB_URL` | SQLite database path (e.g. `/data/wyvern.db`) |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_REDIRECT_URI` | Discord OAuth2 application (no bot) |
| `WYVERN_ENCRYPTION_KEY` | Base64 of a 32-byte AES-256 key; never commit it |
| `DEFAULT_QUOTA_BYTES` | Per-user quota (default 10 GiB) |
| `WYVERN_CHUNK_SIZE_BYTES` | Plaintext chunk size (default 2 MiB; valid 64 KiB..8 MiB) |
| `WYVERN_CHUNKS_PER_MESSAGE` | Max encrypted chunks packed per Discord message (default 10; 1..10) |
| `WYVERN_UPLOAD_CONCURRENCY` | Max chunk batches uploaded concurrently (default 4; 1..16) |
| `WYVERN_DOWNLOAD_CONCURRENCY` | Max chunks fetched concurrently when downloading (default 6; 1..16) |
| `WYVERN_COMPRESS_CHUNKS` | zlib-deflate each chunk before encryption (default `1`/on; `0`/`false` stores raw plaintext) |
| `WYVERN_TRASH_RETENTION_DAYS` | Days a trashed entry stays before the lazy sweep purges it (default 30; 1..365) |
| `WYVERN_MAX_WEBHOOKS_PER_DRIVE` | Max webhooks a drive may register (default 8; 1..32) |

There is no global webhook variable: each authenticated user connects their
own Discord webhook on `/connect`, and the server seals it with
`WYVERN_ENCRYPTION_KEY`.

With an incomplete or invalid configuration the server boots into setup mode
(see Quick start) instead of failing; the `/setup` page can write the two
Discord OAuth values plus safe derived/default values to `server/.env`, but
the process must be restarted for them to take effect. An invalid `PORT` is
the one fatal case, because the process cannot choose a listening port. Once
every required variable validates, the server runs the full app (SQLite →
migrations → OAuth/storage → HTTP) and `GET /api/setup/status` reports
`setupRequired: false`.

## Production

```sh
cd web && npm run build   # outputs web/build
cd ../server && NODE_ENV=production npm start
```

The server serves `web/build` (SPA fallback; `/api` and `/s` are never
shadowed). Set `NODE_ENV=production` for Secure session cookies; put the
server behind your reverse proxy with HTTPS.

## Testing

```sh
cd server && npm test   # 136 tests: in-memory SQLite + fake Discord adapters
cd web && npm test      # 110 tests: mocked API client
```

Server tests never contact Discord: OAuth fetch is stubbed and the storage
adapters are in-memory fakes (one integration file drives the real webhook
adapter against an injected fake Discord REST surface). Coverage includes the
encrypted round-trip fixture verified byte-for-byte against its SHA-256
digest, 10-per-message chunk packing, content dedup, instant copy, multi-webhook
round-robin, per-chunk compression, the full trash lifecycle (delete, restore,
retention sweep, purge with block refcounting), resumable uploads, HTTP Range
slicing, upload progress, folder ZIP archives, webhook cap enforcement,
setup-mode diagnostics (status contract, no-secret-leak assertions, hidden
protected routes, file-backed `DB_URL` parent creation), global drive search,
upload cancellation, drive stats, and the boot-time trash retention sweep.

## Manual smoke path (configured Discord)

A real end-to-end check (sign-in, `/connect` webhook setup, multi-chunk
upload, refresh, search, download with SHA-256 comparison, rename/move, share
in a private window, revoke, 404s) is documented step by step in
`server/README.md`.

## Repo layout notes

- `refs/` is read-only prior art; do not modify it.
- Bot-era drives (pre-webhook) are preserved via
  `drives.legacy_discord_channel_id` and require an operator export with the
  pre-migration bot implementation before cutover; they are never
  auto-migrated.
