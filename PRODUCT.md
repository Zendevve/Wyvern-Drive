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
chunks, encrypted at rest with AES-256-GCM, and stored as Discord attachments
posted through one per-user Discord webhook (Disbox-style). Each user connects
their own webhook once on the authenticated `/connect` page; the server holds
the OAuth2 client secret, validates and encrypts the webhook URL at rest, and
performs all webhook and Discord-CDN I/O server-side. The browser never sees
webhook URLs, raw attachment URLs, message IDs, or any secret value. Success
= the user trusts it with real files and finds the cloud-drive flows (upload,
browse, search, share) comfortable.

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
server boots a read-only setup mode serving `GET /api/setup/status` and a
guided `/setup` page (missing-variable names only, never values); the operator
fills `server/.env` and restarts. No browser form writes secrets.

## Capabilities and Constraints

MVP (from README): OAuth2 sign-in with server-side sessions and CSRF; one drive
per user; parallel packed and resumable uploads with per-file progress, retry,
and server-side progress polling; HTTP Range downloads and inline previews;
folder ZIP archives; folders, rename, move, permanent recursive delete;
server-backed search and sort; anonymous read-only share links with optional
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
- Visual world (user-pinned brief, Framer dark-canvas marketing system, adapted
  to an Operate surface): near-black canvas everywhere; white pill primary
  CTAs; charcoal secondary pills; binary ink / ink-muted text hierarchy;
  accent blue reserved for hyperlinks, focus rings, and selection only — never
  a fill; gradient spotlight cards scarce (one per long view, currently the
  drive empty state); Mona Sans Variable display with hard negative tracking;
  Inter Variable body with OpenType variants cv01/cv05/cv09/cv11/ss03/ss07/dlig;
  5px spacing base; pill / 20px / 30px radius scale; surface lift
  (canvas → surface-1 → surface-2) marks hierarchy; light-edge elevation.
- User-confirmed decisions: keep the cloud-drive left sidebar chrome (not
  Framer's marketing top nav); file-type icons are monochrome (folders ink,
  files ink-muted — type carried by glyph, not color).

## Evidence on Hand

- `README.md` — features, architecture, security model, config, testing.
- `server/README.md` — manual smoke path (116 server tests; encrypted
  round-trip fixture verified against SHA-256; setup-mode coverage).
- `web/` — 75 tests pinning accessible names, testids, quota/share text, and
  the setup gate/page.
- `refs/` — vendored prior art (Disbox et al.), read-only.

## Product Principles

1. Privacy is the product: server-side encryption, credential isolation, no
   third-party file host ever sees plaintext.
2. Familiar cloud-drive flows over invention — users should feel at home in the
   Google Drive / Dropbox / Mega pattern.
3. The interface carries a premium, calm dark register (the pinned Framer
   world); expression is saved for moments, never at the cost of the task.
4. Self-hostable: runtime depends on nothing external (fonts, assets self-
   hosted).
5. Security-sensitive: never leak server-held Discord credentials (OAuth2
   client secret, sealed webhook credentials), raw attachment URLs, message
   IDs, or encryption keys to the browser. Setup surfaces render variable
   names only, never values.

## Accessibility & Inclusion

No product-specific requirement established beyond what the code implements:
aria-labels on icon controls, testids for automation, and a
`prefers-reduced-motion` guard in `web/src/index.css`. Dark-only interface
(no light mode) is a pinned brand commitment.
