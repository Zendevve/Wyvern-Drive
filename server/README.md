# Wyvern Drive — server

Self-hostable Discord-backed cloud drive backend. The server is the only component that talks to Discord: it signs users in via Discord OAuth2, and each user connects their own Discord webhook on the authenticated `/connect` page. The webhook URL is validated against Discord, encrypted with AES-256-GCM under `WYVERN_ENCRYPTION_KEY`, and stored only as ciphertext. Files are split into configurable plaintext chunks (default 2 MiB, `WYVERN_CHUNK_SIZE_BYTES`), each encrypted with AES-256-GCM (fresh 12-byte nonce + auth tag); up to `WYVERN_CHUNKS_PER_MESSAGE` (default 10) encrypted chunks are packed into one Discord message as attachments. Metadata stays in SQLite. The web client (see `../web`) only ever talks to this server's `/api` routes — no webhook URLs, Discord message IDs, or attachment URLs ever reach the browser.

**No Discord bot is used.** Identity is Discord OAuth2 and storage is one per-user webhook (Disbox-style). Pre-migration bot-era data is preserved in `drives.legacy_discord_channel_id` and is not auto-migrated; the pre-migration bot implementation is the operator's export path before cutover.

## Requirements

- Node.js >= 20 (CommonJS project)
- A Discord application with OAuth2 credentials (see Setup)

## Setup

1. Create a Discord application at <https://discord.com/developers/applications>.
2. In **OAuth2**, copy the Client ID and Client Secret; add your redirect URI (`APP_ORIGIN/api/auth/discord/callback`) to the redirect list. The registered URI must match `DISCORD_REDIRECT_URI` exactly. No bot is needed.
3. Generate an encryption key and create the environment file:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   Copy-Item .env.example .env   # then fill in every value
   ```

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
variable names — never secret values) plus the production SPA's guided `/setup`
page, and hides every other route behind the standard JSON 404. No database,
migrations, or OAuth client are initialized in setup mode. An invalid `PORT`
is the only fatal config error, since the process cannot pick a listening
port. A file-backed `DB_URL`'s parent directory is created automatically
before SQLite opens. Once every variable validates, the full composition runs
(SQLite → migrations → services → HTTP) and `/api/setup/status` reports
`setupRequired: false`.

After sign-in, each user is redirected to `/connect`, where they paste their
own Discord webhook URL (Server Settings → Integrations → Create Webhook in a
private server). The server validates it, seals it, and stores only the
ciphertext; the URL is never kept in the browser.

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
| `WYVERN_ENCRYPTION_KEY` | yes | — | Base64-encoded 32-byte AES-256-GCM master key; encrypts file chunks and per-user webhook credentials. |
| `DEFAULT_QUOTA_BYTES` | no | `10737418240` (10 GiB) | Per-user storage quota in bytes. |
| `WYVERN_CHUNK_SIZE_BYTES` | no | `2097152` (2 MiB) | Plaintext chunk size in bytes; valid `65536`..`8388608`. Honored in every environment. |
| `WYVERN_CHUNKS_PER_MESSAGE` | no | `10` | Max encrypted chunks packed per Discord message (one attachment per chunk); valid `1`..`10`. The effective batch also caps at how many chunks fit under Discord's 25 MiB upload limit. |
| `WYVERN_UPLOAD_CONCURRENCY` | no | `4` | Max chunk batches uploaded concurrently per file; valid `1`..`16`. |
| `WYVERN_DOWNLOAD_CONCURRENCY` | no | `6` | Max chunks fetched concurrently while streaming a download; valid `1`..`16`. |

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
npm test
```

Coverage includes: config validation and setup diagnostics (missing variables, malformed redirect URI, non-32-byte key, no secret leakage, fatal `PORT`), setup-mode process behavior (status contract, hidden protected routes, DB parent directory creation), migrations (including the 002 drives rebuild preserving legacy channels and 003 upload-resume columns), OAuth state/session/CSRF, per-user webhook configuration (201/200/409 flows, invalid and legacy drives), folders/list/search/sort, rename/move rules, encrypted multi-chunk upload/download round-trip, chunk packing (10/10/5 batches), resumable uploads (token reuse, partial-batch retention, no duplicate messages), HTTP Range downloads (206 slicing, suffix/open-ended ranges, unsatisfiable fallback), upload progress endpoints, folder ZIP archives, quota rejection (413), kept failed uploads and `usedBytes` accounting, retryable recursive delete, share metadata/expiry/revocation with identical 404s, ownership isolation, rate limits, and exact API JSON shapes.

## Manual smoke path (configured Discord)

Prerequisite: a real Discord application (OAuth2 only) as in Setup.

1. Start the server with a real `.env` and run the web client (`cd ../web && npm start`), or serve `../web/build` behind `APP_ORIGIN`.
2. Sign in with a real Discord account. You are redirected to `/connect`.
3. Create a private Discord server; in Server Settings → Integrations, create a webhook and paste its URL into the connect page.
4. Create a folder.
5. Upload a file larger than `WYVERN_CHUNK_SIZE_BYTES` (default 2 MiB) so it splits into multiple encrypted chunks.
6. Refresh — the file must survive; search for it by name.
7. Download it and compare the SHA-256 digest: `certutil -hashfile downloaded.bin SHA256` must equal the local file's.
8. Rename it, then move it into the folder.
9. Create a share URL; open it in a private browser window — the share page shows name/size/MIME and downloads via `/s/<token>`.
10. Revoke the share and confirm the share URL now returns 404.
11. In Discord, open the webhook's channel: it contains only encrypted chunk messages (no readable plaintext).
12. In the browser network log, confirm no webhook URL, raw Discord attachment URL, message ID, or encryption key ever appears. No extension installation is required.

## Layout

```
src/index.js                  composition/startup boundary (dotenv, diagnostics, setup-mode branch, DB parent creation)
src/config.js                 strict env validation + setup diagnostics (diagnoseConfig)
src/errors.js                 error codes + { error: { code, message } } mapping
src/db/connection.js          promise-wrapped sqlite3
src/db/migrate.js             numbered SQL migrations (foreign_keys=ON, disabled per-batch for rebuilds)
src/db/migrations/            schema (users, drives with webhook credential columns, entries, file_chunks, shares, sessions)
src/db/repositories.js        ALL SQL lives here (sumUsedBytes, upload-token lookup, subtree queries)
src/auth/discord-oauth.js     Discord OAuth2 (fetch-injected, identify scope)
src/auth/session-store.js     sha256-hashed opaque session tokens, 30-day TTL
src/storage/discord-webhook-storage.js per-user webhook adapter (validate/seal, packed chunk put/get/delete, 429/5xx retry, rate-limit aware)
src/services/file-service.js  transactional file lifecycle + AES-256-GCM chunk crypto (packed uploads, resume, Range streams)
src/http/                     app composition, middleware, and route modules
src/http/storage-routes.js    POST /api/storage/webhook (validate, seal, insert/update drive)
src/http/file-routes.js       POST /api/files/upload (uploadToken/fileSize), GET /api/files/:id/download (Range + ?inline=1), shares
src/http/entry-routes.js      GET/PATCH/DELETE /api/entries/:id, GET /api/entries/:id/archive (ZIP)
src/http/setup-status.js      read-only first-run status contract (mounted in full and setup apps)
src/http/setup-app.js         limited setup-mode app (status + SPA only)
test/                         node:test suite with fake Discord adapters
```
