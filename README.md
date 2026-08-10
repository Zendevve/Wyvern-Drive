# Wyvern Drive

A self-hostable, Discord-backed personal cloud drive. Files are split into
chunks, encrypted at rest with AES-256-GCM, and stored as Discord attachments
in a bot-managed private channel per user. The server owns all Discord
credentials and metadata (SQLite); the browser never sees bot tokens, webhook
URLs, or raw Discord attachment URLs.

**License:** proprietary — see [LICENSE](LICENSE). Vendored references under
`refs/` retain their own licenses.

## Features (MVP)

- Discord OAuth2 sign-in with server-side sessions and CSRF protection
- One personal drive per user; configurable quota (default 10 GiB)
- Upload/download with per-file progress and retry; streaming multipart uploads
- Folders; rename, move, and permanent recursive delete
- Server-backed search and sort
- Anonymous read-only share links with optional expiry and revocation
- Responsive desktop (table) and mobile (cards) UI
- Rate limiting on OAuth, mutations, and public share downloads

## Architecture

| Path | What it is |
|---|---|
| `server/` | Node.js 20 + Express + discord.js 14 + SQLite. Config validation, numbered migrations, OAuth/session/authz, Discord storage adapter, transactional file service, REST API, rate limits. |
| `web/` | React 17 + MUI 5 (CRA). Talks only to same-origin `/api`; XHR uploads with progress; CSRF cookie + header injection. |
| `refs/` | Vendored reference projects (Disbox and similar Discord-cloud-storage projects). Read-only prior art; provenance in `refs/README.md`. |

Security model: server-side encryption, not end-to-end. Discord and the
browser never receive plaintext chunks, storage internals, or encryption keys;
the server decrypts only for authorized downloads and shares.

## Quick start (development)

Prerequisites: Node 20+, a Discord application (OAuth2 client ID/secret and a
redirect URI), a bot token with permission to manage channels, a private
storage guild with a category for drive channels, and a base64-encoded 32-byte
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

Open http://localhost:3000 and sign in with Discord.

## Configuration

Required environment variables (full list in `server/.env.example`):

| Variable | Purpose |
|---|---|
| `PORT` | HTTP port (default 8080) |
| `APP_ORIGIN` | Public origin of the web app; only origin allowed by CORS/CSRF |
| `DB_URL` | SQLite database path (e.g. `/data/wyvern.db`) |
| `DISCORD_CLIENT_ID` / `DISCORD_CLIENT_SECRET` / `DISCORD_REDIRECT_URI` | Discord OAuth2 application |
| `DISCORD_BOT_TOKEN` | Bot used for storage channels |
| `DISCORD_STORAGE_GUILD_ID` / `DISCORD_STORAGE_CATEGORY_ID` | Where per-user private channels are created |
| `WYVERN_ENCRYPTION_KEY` | Base64 of a 32-byte AES-256 key; never commit it |
| `DEFAULT_QUOTA_BYTES` | Per-user quota (default 10 GiB) |

Startup fails fast (exit 1) listing every missing or invalid variable.

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
cd server && npm test   # 85 tests: in-memory SQLite + fake Discord adapter
cd web && npm test      # 32 tests: mocked API client
```

Server tests never contact Discord: OAuth fetch is stubbed and the storage
adapter is an in-memory fake. The encrypted round-trip fixture (24 bytes in
three 8-byte chunks) is verified byte-for-byte against its SHA-256 digest.

## Manual smoke path (configured Discord)

A real end-to-end check (sign-in, >24 MiB upload, refresh, search, download
with SHA-256 comparison, rename/move, share in a private window, revoke, 404s)
is documented step by step in `server/README.md`.

## Repo layout notes

- `refs/` is read-only prior art; do not modify it.
- Commit history: the previous webhook-based v1 of this project is preserved
  on the `legacy-webhook-version` branch.
