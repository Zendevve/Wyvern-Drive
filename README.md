# Wyvern Drive

A self-hostable, Discord-backed personal cloud drive. Files are split into
chunks, encrypted at rest with AES-256-GCM, and stored as Discord attachments
posted through one per-user Discord webhook (Disbox-style). Each user connects
their own webhook once on the `/connect` page; the server validates it,
encrypts it at rest under the master key, and performs all Discord I/O. The
server owns all credentials and metadata (SQLite); the browser never sees
webhook URLs, Discord message IDs, or raw attachment URLs.

**No Discord bot is used.** Identity is Discord OAuth2 and storage is a
per-user webhook; files are encrypted server-side before upload. The bot-era
implementation (one private channel per user) is preserved as migration
history in `drives.legacy_discord_channel_id` and is not auto-migrated.
The `refs/` directories remain read-only prior art, not runtime behavior.

**License:** proprietary — see [LICENSE](LICENSE). Vendored references under
`refs/` retain their own licenses.

## Features (MVP)

- Discord OAuth2 sign-in with server-side sessions and CSRF protection
- One personal drive per user; configurable quota (default 10 GiB)
- Upload/download with per-file progress and retry; streaming multipart uploads
- Folders; rename, move, and permanent recursive delete
- Server-backed search and sort
- Anonymous read-only share links with optional expiry and revocation
- Cloud-service-style UI (Google Drive / Dropbox / Mega flow): desktop list + grid views, row/card selection with bulk actions, hover-revealed actions, drag-and-drop upload, floating upload progress manager; responsive (desktop table/grid, mobile cards)
- Rate limiting on OAuth, mutations, and public share downloads

## Architecture

| Path | What it is |
|---|---|
| `server/` | Node.js 20 + Express + SQLite. Config validation, numbered migrations, OAuth/session/authz, per-user webhook storage adapter, transactional file service, REST API, rate limits. |
| `web/` | React 17 + MUI 5 (CRA). Talks only to same-origin `/api`; XHR uploads with progress; CSRF cookie + header injection. |
| `refs/` | Vendored reference projects (Disbox and similar Discord-cloud-storage projects). Read-only prior art; provenance in `refs/README.md`. |

Security model: server-side encryption, not end-to-end. Discord and the
browser never receive plaintext chunks, storage internals, or encryption keys;
the server decrypts only for authorized downloads and shares.

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

On first run the server loads `.env` (dotenv), validates the configuration,
and — if anything is missing or invalid — starts in **setup mode**: a
read-only server that serves `GET /api/setup/status` and the guided `/setup`
page listing exactly which variables are missing (never their values). Fill in
the remaining secrets, restart the server, and `/setup` redirects to the
normal sign-in flow. A file-backed `DB_URL` parent directory is created
automatically. The OAuth callback URI on your Discord application must match
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

There is no global webhook variable: each authenticated user connects their
own Discord webhook on `/connect`, and the server seals it with
`WYVERN_ENCRYPTION_KEY`.

With an incomplete or invalid configuration the server boots into read-only
setup mode (see Quick start) instead of failing; an invalid `PORT` is the one
fatal case, because the process cannot choose a listening port. Once every
required variable validates, the server runs the full app (SQLite → migrations
→ OAuth/storage → HTTP) and `GET /api/setup/status` reports
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
cd server && npm test   # 107 tests: in-memory SQLite + fake Discord adapters
cd web && npm test      # 62 tests: mocked API client
```

Server tests never contact Discord: OAuth fetch is stubbed and the storage
adapters are in-memory fakes (one integration file drives the real webhook
adapter against an injected fake Discord REST surface). The encrypted
round-trip fixture (24 bytes in three 8-byte chunks) is verified byte-for-byte
against its SHA-256 digest. Setup-mode coverage includes the status contract,
missing/malformed-variable diagnostics (with a no-secret-leak assertion),
hidden protected routes, and file-backed `DB_URL` parent creation.

## Manual smoke path (configured Discord)

A real end-to-end check (sign-in, `/connect` webhook setup, >24 MiB upload,
refresh, search, download with SHA-256 comparison, rename/move, share in a
private window, revoke, 404s) is documented step by step in
`server/README.md`.

## Repo layout notes

- `refs/` is read-only prior art; do not modify it.
- Bot-era drives (pre-webhook) are preserved via
  `drives.legacy_discord_channel_id` and require an operator export with the
  pre-migration bot implementation before cutover; they are never
  auto-migrated.
