# Wyvern Drive — server

Self-hostable Discord-backed cloud drive backend. The server is the only component that talks to Discord: it signs users in via Discord OAuth2, and each user connects their own Discord webhook on the authenticated `/connect` page. The webhook URL is validated against Discord, encrypted with AES-256-GCM under `WYVERN_ENCRYPTION_KEY`, and stored only as ciphertext. A drive may register up to `WYVERN_MAX_WEBHOOKS_PER_DRIVE` webhooks; uploads round-robin across them. Files are split into configurable plaintext chunks (default 2 MiB, `WYVERN_CHUNK_SIZE_BYTES`), each optionally zlib-deflated (`WYVERN_COMPRESS_CHUNKS`, default on) and encrypted with AES-256-GCM (fresh 12-byte nonce + auth tag); up to `WYVERN_CHUNKS_PER_MESSAGE` (default 10) encrypted chunks are packed into one Discord message as attachments. Identical content is stored once per drive (`content_blocks`), so dedup, copies, and trash purges reuse or reclaim shared Discord messages. Metadata stays in SQLite. The web client (see `../web`) only ever talks to this server's `/api` routes — no webhook URLs, Discord message IDs, or raw attachment URLs are ever exposed.

**No Discord bot is used.** Identity is Discord OAuth2 and storage is one per-user webhook (Disbox-style). Pre-migration bot-era data is preserved in `drives.legacy_discord_channel_id` and is not auto-migrated; the pre-migration bot implementation is the operator's export path before cutover.

## Requirements

- Node.js >= 20 (CommonJS project)
- A Discord application with OAuth2 credentials (see Setup)

## Setup

1. Create a Discord application at <https://discord.com/developers/applications>.
2. In **OAuth2**, copy the Client ID and Client Secret; add your redirect URI (`APP_ORIGIN/api/auth/discord/callback`) to the redirect list. The registered URI must match `DISCORD_REDIRECT_URI` exactly. No bot is needed.
3. Create the environment file, optionally leaving values for the setup page:

   ```powershell
   Copy-Item .env.example .env
   ```

   You can fill in every value by hand (generate a 32-byte base64 key with
   `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`),
   or leave them for the guided `/setup` page: it saves the Discord Client ID
   and Client Secret, derives safe defaults (`APP_ORIGIN`,
   `DISCORD_REDIRECT_URI`, `DB_URL`), and generates `WYVERN_ENCRYPTION_KEY`
   server-side when it is absent — the key is written to `.env` and never sent
   to the browser.

4. Install and start:

   ```powershell
   npm install
   npm start
   ```

`npm start` loads `server/.env` via dotenv before validating anything, so the
`Copy-Item .env.example .env` flow works as documented. With an incomplete or
invalid configuration the server boots into **setup mode**: it serves
`GET /api/setup/status` (JSON: `setupRequired`, `usesWebhooks: true`,
`storageMode: "discord-webhooks-per-user"`, and the `missing`/`invalid`
variable names — never secret values), the authenticated
`POST /api/setup/credentials` write route, and the production SPA's guided
`/setup` page, and hides every other route behind the standard JSON 404. On
the page you can enter the Discord Client ID and Client Secret; the server
derives safe defaults for `APP_ORIGIN`, `DISCORD_REDIRECT_URI`, and `DB_URL`
and generates a fresh `WYVERN_ENCRYPTION_KEY` when none is set, writing the
batch atomically to `server/.env`. The client secret is submitted over the
setup origin and is never returned, logged, or kept in the browser;
non-loopback submissions require the one-time setup token printed once in the
setup-mode log (`Wyvern server setup token: …`) and must use HTTPS. A restart
is required for the written file to take effect. No database, migrations, or
OAuth client are initialized in setup mode. An invalid `PORT` is the only
fatal config error, since the process cannot pick a listening port. A
file-backed `DB_URL`'s parent directory is created automatically before
SQLite opens. Once every variable validates, the full composition runs
(SQLite → migrations → services → HTTP) and `/api/setup/status` reports
`setupRequired: false`.

After sign-in, each user is redirected to `/connect`, where four numbered
steps walk them through creating a webhook in a private Discord server
(Server Settings → Integrations → Webhooks) and pasting the URL. The server
validates it, seals it, and stores only the ciphertext; the URL is never kept
in the browser.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `production` turns on `Secure` cookies. |
| `PORT` | no | `8080` | TCP port; `0` picks an ephemeral port. |
| `APP_ORIGIN` | yes | — | Public web-client origin; used for OAuth redirects, CORS, CSRF `Origin` checks, and share URLs. |
| `DB_URL` | yes | — | SQLite database path; `:memory:` for tests. Parent directory is created automatically. |
| `DISCORD_CLIENT_ID` | yes | — | Discord OAuth2 application client ID. |
| `DISCORD_CLIENT_SECRET` | yes | — | Discord OAuth2 application client secret. |
| `DISCORD_REDIRECT_URI` | yes | — | OAuth callback URL, must be an absolute http(s) URL and match the Discord application's registered redirect exactly. |
| `WYVERN_ENCRYPTION_KEY` | yes | — | Base64-encoded 32-byte AES-256-GCM master key; encrypts file chunks and per-user webhook credentials. On first GUI setup the server generates one and writes it to `.env` if absent; it never leaves the server. |
| `DEFAULT_QUOTA_BYTES` | no | `10737418240` (10 GiB) | Per-user storage quota in bytes. |
| `WYVERN_CHUNK_SIZE_BYTES` | no | `2097152` (2 MiB) | Plaintext chunk size in bytes; valid `65536`..`8388608`. Honored in every environment. |
| `WYVERN_CHUNKS_PER_MESSAGE` | no | `10` | Max encrypted chunks packed per Discord message (one attachment per chunk); valid `1`..`10`. The effective batch also caps at how many chunks fit under Discord's 25 MiB upload limit. |
| `WYVERN_UPLOAD_CONCURRENCY` | no | `4` | Max chunk batches uploaded concurrently per file; valid `1`..`16`. |
| `WYVERN_DOWNLOAD_CONCURRENCY` | no | `6` | Max chunks fetched concurrently while streaming a download; valid `1`..`16`. |
| `WYVERN_COMPRESS_CHUNKS` | no | `1` (on) | zlib-deflate each chunk before AES-GCM encryption; `0`/`false` stores raw plaintext. Default on; dedup still works because deflate is deterministic. |
| `WYVERN_TRASH_RETENTION_DAYS` | no | `30` | Days a trashed entry stays in the recycle bin before the lazy sweep (on trash list) purges it for real; valid `1`..`365`. |
| `WYVERN_MAX_WEBHOOKS_PER_DRIVE` | no | `8` | Max Discord webhooks a single drive may register; uploads round-robin across them; valid `1`..`32`. |

There is no global webhook environment variable: a webhook is a credential
owned by each authenticated user.

## Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `start` | `node src/index.js` | Load `.env` via dotenv, run setup diagnostics, then either boot the full app (config → DB → migrations → services → HTTP) or the limited setup app when configuration is incomplete. |
| `test` | `node --test` | Run the server test suite (in-memory SQLite, fake Discord adapters). |
| `check` | `node --check src/index.js` | Syntax-check the entry point. |

## Tests

The suite never contacts Discord: tests boot a full app on a random port with an in-memory SQLite database, a stubbed OAuth `fetch`, and fake Discord storage adapters, and exercise the HTTP API with real `fetch` requests (multipart uploads, cookies, CSRF). One integration file runs the real webhook adapter against an injected fake Discord REST surface, covering validation, 429 retry, CDN fetch, packed multi-attachment posts, and cleanup. The encrypted round-trip fixture is verified byte-for-byte against the original SHA-256 digest, including multi-chunk files packed 10-per-message.

```powershell
npm test   # 136 tests
```

Coverage includes: config validation and setup diagnostics (missing variables, malformed redirect URI, non-32-byte key, no secret leakage, fatal `PORT`, compression/retention/webhook-cap bounds), setup-mode process behavior (status contract, hidden protected routes, DB parent directory creation), migrations (the 002 drives rebuild preserving legacy channels, 003 upload-resume columns, and 004 block store + trash: webhook/content-block tables, backfills, and the live-only partial unique index), OAuth state/session/CSRF, per-user webhook configuration (first-time 201, append 200, invalid and legacy drives, cap 409 `WEBHOOK_LIMIT`), folders/list/search/sort, rename/move/copy rules, content dedup (identical uploads share block rows with no Discord I/O), instant file and folder copy, multi-webhook round-robin fan-out with in-use removal blocked (409 `WEBHOOK_IN_USE`), the trash lifecycle (soft delete, restore, retention sweep, purge with block refcounting), per-chunk compression (deflate ciphertext smaller than plaintext, `none` when disabled), encrypted multi-chunk upload/download round-trip, chunk packing (10/10/5 batches), resumable uploads (token reuse, partial-batch retention, no duplicate messages), HTTP Range downloads (206 slicing, suffix/open-ended ranges, unsatisfiable fallback), upload progress endpoints, folder ZIP archives, quota rejection (413), kept failed uploads and `usedBytes` accounting, orphan-upload purge (24h TTL), share metadata/expiry/revocation with identical 404s, ownership isolation, rate limits, and exact API JSON shapes.

## API notes (polish-wave surface)

- **Global search**: `GET /api/entries?query=…` searches the whole drive.
  When `query` is a non-empty string the parent scope is dropped entirely
  (the parent is not resolved, so a stale/unknown `parentId` cannot 404 a
  search); an empty query keeps the folder scope and its 404-on-unknown-
  parent behavior.
- **Upload cancellation**: `POST /api/uploads/:uploadToken/cancel` (CSRF +
  auth) hard-purges the partial upload — entry, posted chunks, and the now
  dead Discord messages — and responds 204. Entries whose status is
  `uploading` or `failed` can be cancelled; a ready entry's token (upload
  already committed) or an unknown token is 404 `NOT_FOUND`.
- **Drive stats**: `GET /api/drive/stats` (auth) returns
  `{ files, folders, sizeBytes, storedBytes, blocks, messages, webhooks,
  compressionRatio }`. `sizeBytes` is the logical byte count over file
  entries (ready/uploading/failed, trashed included); `files`/`folders` are
  live (non-trashed) counts; `storedBytes` is the real Discord footprint
  over `content_blocks`; `compressionRatio` is null on an empty drive, 0
  when no blocks are stored, else `sizeBytes / storedBytes`.
- **Boot retention sweep**: after the server starts listening, expired trash
  (`deleted_at` older than `WYVERN_TRASH_RETENTION_DAYS`) is purged for every
  drive, fire-and-forget with per-drive guards so a storage outage never
  delays boot.
- **Expired-session sweep**: at boot and every 6 hours, session rows whose
  30-day TTL has passed are deleted (`sessions.expires_at <= now`),
  fire-and-forget so maintenance never blocks requests. Lookup semantics are
  unchanged: `findByToken` already treats an expired row as absent, so
  expired cookies still get `401 AUTH_REQUIRED`.
- **Security headers**: every response (API, SPA, downloads, redirects,
  errors) carries `X-Content-Type-Options: nosniff`,
  `Referrer-Policy: strict-origin-when-cross-origin`, and
  `X-Frame-Options: SAMEORIGIN`. No HSTS (dev runs plain HTTP) and no CSP
  (the CRA runtime relies on inline scripts).

## Manual smoke path (configured Discord)

Prerequisite: a real Discord application (OAuth2 only) as in Setup.

1. Start the server with a real `.env` and run the web client (`cd ../web && npm start`), or serve `../web/build` behind `APP_ORIGIN`.
2. Sign in with a real Discord account. You are redirected to `/connect`.
3. Create a private Discord server; in Server Settings → Integrations, create a webhook and paste its URL into the connect page. Repeat the webhook setup from Settings → Storage to add a second webhook; uploads now round-robin across both.
4. Create a folder.
5. Upload a file larger than `WYVERN_CHUNK_SIZE_BYTES` (default 2 MiB) so it splits into multiple encrypted chunks. Upload the same file again under a different name and confirm it lands instantly (content dedup). Copy a file or folder and confirm the copy is instant (shared blocks).
6. Refresh — the file must survive; search for it by name from the root and
   from inside a different folder: a query searches the whole drive.
7. Download it and compare the SHA-256 digest: `certutil -hashfile downloaded.bin SHA256` must equal the local file's.
8. Rename it, then move it into the folder.
9. Create a share URL; open it in a private browser window — the share page shows name/size/MIME and downloads via `/s/<token>`.
10. Revoke the share and confirm the share URL now returns 404.
11. Delete a file: it moves to Trash (no Discord I/O — the encrypted message stays in the webhook's channel). Restore it from the Trash page, delete it again, then "Delete forever" and confirm the encrypted message disappears from the Discord channel. Expired trash is swept automatically after `WYVERN_TRASH_RETENTION_DAYS` (default 30).
12. Open Settings → Drive stats: files, folders, logical size, stored-on-Discord size, compression ratio, and webhooks reflect the drive's usage.
13. In Discord, open the webhook's channel: it contains only encrypted chunk messages (no readable plaintext).
14. In the browser network log, confirm no webhook URL, raw Discord attachment URL, message ID, or encryption key ever appears. No extension installation is required.

## Layout

```
src/index.js                  composition/startup boundary (dotenv, diagnostics, setup-mode branch, DB parent creation)
src/config.js                 strict env validation + setup diagnostics (diagnoseConfig)
src/errors.js                 error codes + { error: { code, message } } mapping
src/db/connection.js          promise-wrapped sqlite3
src/db/migrate.js             numbered SQL migrations (foreign_keys=ON, disabled per-batch for rebuilds)
src/db/migrations/            schema (users, drives, webhooks, content_blocks, entries with deleted_at, file_chunks as block joins, shares, sessions)
src/db/repositories.js        ALL SQL lives here (block store, webhooks, trash, subtree queries, upload-token lookup)
src/auth/discord-oauth.js     Discord OAuth2 (fetch-injected, identify scope)
src/auth/session-store.js     sha256-hashed opaque session tokens, 30-day TTL
src/storage/discord-webhook-storage.js webhook credential adapter (validate/seal, packed chunk put/get/delete, 429/5xx retry, rate-limit aware)
src/services/file-service.js  transactional file lifecycle + AES-256-GCM chunk crypto (dedup block store, compression, packed uploads, resume, Range streams, trash, copy)
src/http/                     app composition, middleware, and route modules
src/http/storage-routes.js    POST /api/storage/webhook (create drive on first use, append), GET /api/storage/webhooks, DELETE /api/storage/webhooks/:id
src/http/drive-routes.js      GET /api/drive (quota summary), GET /api/drive/stats (usage dashboard)
src/http/trash-routes.js      GET /api/trash (lazy retention sweep), POST /api/trash/:id/restore, DELETE /api/trash/:id (purge)
src/http/file-routes.js       POST /api/files/upload (uploadToken/fileSize), GET /api/files/:id/download (Range + ?inline=1), POST /api/uploads/:uploadToken/cancel (abort purge), GET /api/uploads/:uploadToken (progress), shares
src/http/entry-routes.js      GET /api/entries (list; `query` searches the whole drive), PATCH/DELETE (soft) /api/entries/:id, POST /api/entries/:id/copy, GET /api/entries/:id/archive (ZIP)
src/http/setup-status.js      read-only first-run status contract (mounted in full and setup apps)
src/http/setup-config.js      setup-only routes: GET /api/setup/meta + POST /api/setup/credentials (token/origin-checked; writes validated values + safe defaults)
src/http/setup-app.js         limited setup-mode app (status, /api/setup/* credential routes, SPA only)
test/                         node:test suite with fake Discord adapters
```
