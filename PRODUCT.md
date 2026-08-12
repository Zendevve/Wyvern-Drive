# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Self-hosters running a personal cloud drive on infrastructure they control; one
drive per user (default 10 GiB quota). The primary user is technical enough to
deploy a Node server and Discord bot and to accept a Discord OAuth2 sign-in.
[INFERENCE from README's self-hostable positioning and setup requirements; not
interviewed.]

## Product Purpose

A self-hostable personal cloud drive backed by Discord: files are split into
chunks, compressed and encrypted at rest with AES-256-GCM, and stored as
Discord attachments posted through the drive's Discord webhooks (Disbox-style;
a drive may register several webhooks and uploads round-robin across them).
Each user connects their own webhook once on the authenticated `/connect`
page; the server holds the OAuth2 client secret, validates and encrypts the
webhook URL at rest, and performs all webhook and Discord-CDN I/O server-side.
The browser never sees webhook URLs, raw attachment URLs, message IDs, or any
secret value. Success = the user trusts it with real files and finds the
cloud-drive flows (upload, browse, search, share) comfortable.

## Positioning

"Your files, encrypted, stored on Discord." The mechanism a neighboring product
could not truthfully copy: Discord's existing, familiar storage as the backing
store, with server-side encryption and credential isolation, self-hosted so no
third-party file host touches the data.

## Operating Context

Web app (React 17 + MUI 5, CRA) talking to same-origin `/api`; Node 20 +
Express + SQLite server; Discord OAuth2 sign-in; desktop list/grid views,
mobile cards; drag-and-drop upload; anonymous read-only share links; quota
(default 10 GiB). Server serves the built SPA in production.
First-run onboarding is operator-managed: with incomplete configuration the
server boots a setup mode serving `GET /api/setup/status`, the token-guarded
`POST /api/setup/credentials` write route, and a guided `/setup` page
(missing-variable names only, never values). On that page the operator can
enter the two Discord OAuth values; the server derives safe defaults
(`APP_ORIGIN`, `DISCORD_REDIRECT_URI`, `DB_URL`) and generates
`WYVERN_ENCRYPTION_KEY` when absent, writes the batch to `server/.env`, and
requires a restart. The browser may submit those values transiently over the
setup origin, but secrets are never returned, logged, or stored client-side;
non-loopback submissions need the one-time setup token from the server log
and must use HTTPS. The operator can equally fill `server/.env` by hand and
restart.

## Capabilities and Constraints

MVP (from README): OAuth2 sign-in with server-side sessions and CSRF; one drive
per user with multi-webhook scaling (uploads round-robin across up to
`WYVERN_MAX_WEBHOOKS_PER_DRIVE` webhooks); content dedup and per-chunk
compression; parallel packed and resumable uploads with per-file progress,
retry, server-side progress polling, and upload cancellation (abort + server-
side purge of the partial upload); HTTP Range downloads and inline previews;
folder ZIP archives; folders, rename, move, instant copy, folder upload, and a
recycle bin (soft delete, restore, delete-forever, retention sweep, plus a
boot-time sweep of expired trash); global search (queries span the whole
drive) and sort; drive stats (files, folders, logical and stored sizes,
compression ratio, webhooks); anonymous read-only share links with optional
expiry and revocation; rate limiting on OAuth, mutations, and public share
downloads; responsive cloud-service-style UI (desktop table/grid, mobile
cards, drag-drop upload, floating upload progress manager).

Constraints: encryption is server-side, not end-to-end (Discord and the browser
never receive plaintext chunks, storage internals, or keys); Discord rate
limits bound storage throughput; runtime must stay self-hostable — no external
font/CDN dependencies; `refs/` is read-only vendored prior art; storage is the
per-user webhook adapter (`src/storage/discord-webhook-storage.js`) — no bot —
and bot-era drives are preserved via `drives.legacy_discord_channel_id`,
never auto-migrated.

## Brand Commitments

- Name: **Wyvern Drive**. Tagline: "Your files, encrypted, stored on Discord."
- Visual world (locked Framer dark-canvas commitment): near-black canvas
  (#0E0E10) with surface-lift steps (#1A1A1D / #242428); binary ink hierarchy
  — white ink (#FFFFFF) and ink-muted text (#999999); accent blue (#0099FF)
  is reserved for links, focus, selection, and drop targets — never a fill; one violet gradient spotlight card (the drive empty state) as the
  system's only atmosphere device; Mona Sans Variable display at 500 with hard
  negative tracking (62px/-3.1px login hero), Inter Variable body with bespoke
  OpenType variants (cv01 cv05 cv09 cv11 ss03 ss07 dlig); 5px spacing base;
  radius scale from 10px inputs to 15px entry tiles, 20px cards, 30px
  spotlight, 100px pill CTAs; white pill primary CTA; light-edge elevation
  (inset white top edge over a deep drop shadow); dark-only — no light mode,
  no glass, no glow, no gradients beyond the one spotlight card.
- User-confirmed decisions: keep the cloud-drive left sidebar chrome (240px
  manifest rail); file-type icons are monochrome (folders ink, files ink-muted
  — type carried by glyph, not color).

## Evidence on Hand

- `README.md` — features, architecture, security model, config, testing.
- `server/README.md` — manual smoke path (136 server tests; encrypted
  round-trip fixture verified against SHA-256; setup-mode coverage).
- `web/` — 110 tests pinning accessible names, testids, quota/share text, trash
  and webhook surfaces, and the setup gate/page.
- `refs/` — vendored prior art (Disbox et al.), read-only.

## Product Principles

1. Privacy is the product: server-side encryption, credential isolation, no
   third-party file host ever sees plaintext.
2. Familiar cloud-drive flows over invention — users should feel at home in the
   Google Drive / Dropbox / Mega pattern.
3. The interface carries a premium, calm dark register (the locked Framer
   dark-canvas world — near-black canvas, white pill CTAs, accent blue
   reserved for links and focus, one violet gradient spotlight card);
   expression is saved for moments, never at the cost of the task.
4. Self-hostable: runtime depends on nothing external (fonts, assets self-
   hosted).
5. Security-sensitive: never leak server-held Discord credentials (OAuth2
   client secret, sealed webhook credentials), raw attachment URLs, message
   IDs, or encryption keys to the browser. The setup page may submit the two
   Discord OAuth values transiently over the setup origin, but secrets are
   never returned to the browser, logged, or kept client-side; safe defaults
   and the encryption key are generated server-side, and diagnostics render
   variable names only, never values.

## Accessibility & Inclusion

No product-specific requirement established beyond what the code implements:
aria-labels on icon controls, testids for automation, and a
`prefers-reduced-motion` guard in `web/src/index.css`. Dark-only interface
(no light mode) is a pinned brand commitment.
