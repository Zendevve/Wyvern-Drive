# Wyvern Drive — server

Self-hostable Discord-backed cloud drive backend. The server is the only component that talks to Discord: it signs users in via Discord OAuth2, provisions one private text channel per user in a configured storage guild, splits uploaded files into 24 MiB chunks, encrypts each chunk with AES-256-GCM (master key from `WYVERN_ENCRYPTION_KEY`), stores ciphertext as Discord attachments, and keeps all metadata in SQLite. The web client (see `../web`) only ever talks to this server's `/api` routes — no bot tokens, webhook URLs, Discord message IDs, or attachment URLs ever reach the browser.

## Requirements

- Node.js >= 20 (CommonJS project)
- A Discord application with OAuth2 credentials and a bot (see Setup)
- A Discord server ("guild") with a category where the bot can create channels

## Setup

1. Create a Discord application at <https://discord.com/developers/applications>.
2. In **OAuth2**, copy the Client ID and Client Secret; add your redirect URI (`APP_ORIGIN/api/auth/discord/callback`) to the redirect list.
3. In **Bot**, create the bot, copy the token, and invite it to your storage guild with at least `Manage Channels`, `Send Messages`, `Read Message History`, and `Manage Messages`. Note the guild ID and the ID of a category the bot may create channels in.
4. Generate an encryption key and create the environment file:

   ```powershell
   node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
   Copy-Item .env.example .env   # then fill in every value
   ```

5. Install and start:

   ```powershell
   npm install
   npm start
   ```

The server validates its configuration at startup and exits non-zero with a descriptive error if anything is missing or malformed (including a non-32-byte encryption key). Migrations run automatically before the server starts serving; a failed migration aborts startup. The SQLite file location is controlled by `DB_URL`.

## Environment variables

| Variable | Required | Default | Description |
| --- | --- | --- | --- |
| `NODE_ENV` | no | `development` | `production` turns on `Secure` cookies. |
| `PORT` | no | `8080` | TCP port; `0` picks an ephemeral port. |
| `APP_ORIGIN` | yes | — | Public web-client origin; used for OAuth redirects, CORS, CSRF `Origin` checks, and share URLs. |
| `DB_URL` | yes | — | SQLite database path; `:memory:` for tests. |
| `DISCORD_CLIENT_ID` | yes | — | Discord OAuth2 application client ID. |
| `DISCORD_CLIENT_SECRET` | yes | — | Discord OAuth2 application client secret. |
| `DISCORD_REDIRECT_URI` | yes | — | OAuth callback URL, must match the Discord application's registered redirect. |
| `DISCORD_BOT_TOKEN` | yes | — | Discord bot token used for channel/chunk operations. |
| `DISCORD_STORAGE_GUILD_ID` | yes | — | Storage guild where per-user channels are created. |
| `DISCORD_STORAGE_CATEGORY_ID` | yes | — | Category inside the guild where per-user channels are created. |
| `WYVERN_ENCRYPTION_KEY` | yes | — | Base64-encoded 32-byte AES-256-GCM master key. |
| `DEFAULT_QUOTA_BYTES` | no | `10737418240` (10 GiB) | Per-user storage quota in bytes. |
| `WYVERN_CHUNK_SIZE_BYTES` | test only | — | Chunk size override; honored only when `NODE_ENV=test` (tests use 8). |

## Scripts

| Script | Command | Purpose |
| --- | --- | --- |
| `start` | `node src/index.js` | Compose config → DB → migrations → services → HTTP, then listen. |
| `test` | `node --test` | Run the server test suite (in-memory SQLite, fake Discord adapter). |
| `check` | `node --check src/index.js` | Syntax-check the entry point. |

## Tests

The suite never contacts Discord: tests boot a full app on a random port with an in-memory SQLite database, a stubbed OAuth `fetch`, and an in-memory fake `DiscordStorage`, and exercise the HTTP API with real `fetch` requests (multipart uploads, cookies, CSRF). The 24-byte round-trip fixture is split into exactly three 8-byte chunks and verified byte-for-byte against the original SHA-256 digest.

```powershell
npm test
```

Coverage includes: config validation, migrations and schema invariants, OAuth state/session/CSRF, drive provisioning retry, folders/list/search/sort, rename/move rules, encrypted multi-chunk upload/download round-trip, quota rejection (413), cleanup after failed chunk uploads, retryable recursive delete, share metadata/expiry/revocation with identical 404s, ownership isolation, rate limits, and exact API JSON shapes.

## Manual smoke path (configured Discord)

Prerequisite: a real Discord application/bot and private storage guild as in Setup.

1. Start the server with a real `.env` and run the web client (`cd ../web && npm start`), or serve `../web/build` behind `APP_ORIGIN`.
2. Sign in with a real Discord account. You are redirected to `/drive`.
3. Create a folder.
4. Upload a file larger than 24 MiB (it must be split into multiple encrypted chunks).
5. Refresh — the file must survive; search for it by name.
6. Download it and compare the SHA-256 digest: `certutil -hashfile downloaded.bin SHA256` must equal the local file's.
7. Rename it, then move it into the folder.
8. Create a share URL; open it in a private browser window — the share page shows name/size/MIME and downloads via `/s/<token>`.
9. Revoke the share and confirm the share URL now returns 404.
10. In the storage guild, verify the user's private channel contains only encrypted chunk messages (no readable plaintext).
11. In the browser network log, confirm no bot token, webhook URL, raw Discord attachment URL, message ID, or encryption key ever appears.

## Layout

```
src/index.js                  composition/startup boundary (exit(1) on config failure)
src/config.js                 full env validation
src/errors.js                 error codes + { error: { code, message } } mapping
src/db/connection.js          promise-wrapped sqlite3
src/db/migrate.js             numbered SQL migrations (foreign_keys=ON)
src/db/migrations/            schema (users, drives, entries, file_chunks, shares, sessions)
src/db/repositories.js        ALL SQL lives here
src/auth/discord-oauth.js     Discord OAuth2 (fetch-injected, identify scope)
src/auth/session-store.js     sha256-hashed opaque session tokens, 30-day TTL
src/storage/discord-storage.js discord.js adapter (channel provisioning, chunk put/get/delete, 429 retry)
src/services/file-service.js  transactional file lifecycle + AES-256-GCM chunk crypto
src/http/                     app composition, middleware, and route modules
test/                         node:test suite with fake Discord adapter
```
