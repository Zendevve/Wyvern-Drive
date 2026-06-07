# Project: Disbox v2

## What This Is

Disbox is **Discord-as-cloud-storage**: a self-hostable web app that turns a user's own Discord account into unlimited personal cloud storage. The user authenticates with a Discord user token, then uploads, organizes, previews, shares, and downloads files backed by Discord message attachments — wrapped in a virtual file system with a modern web UI, optional client-side E2E encryption, and a companion Chrome extension.

v2 is a **full rewrite** of the original Disbox (React 17 + Express + webhook-based, archived at https://github.com/DisboxApp). v1 used Discord webhooks as the storage medium; v2 uses **self-bot / user-token mode** via `discord.js-selfbot-v13`, which means each user account's own private servers/channels hold their data. The server becomes a real proxy that chunks, encrypts (if enabled), uploads to Discord, and indexes metadata in SQLite. The web app is a real Next.js 14 SPA. The Chrome extension is no longer load-bearing (CORS is solved via the server proxy) but is retained to deep-link `discord.com` channel URLs into Disbox.

This is **not** an official Discord integration. It uses a self-bot library, which is a ToS-grey area. The product positions itself for personal/experimental use by users who own the accounts.

## Core Value

> **"I can store anything I want in Discord, see it like a normal cloud drive, and trust that nobody else can read it."**

The ONE thing that must work end-to-end: log in with a Discord user token → upload a file → see it in the UI → download it back bit-perfect. Everything else (encryption, sharing, mobile, search) is layered on top of that.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Full rewrite (not modernization) | v1 webhook architecture is incompatible with v2 user-token model; data model, auth, and chunking all change | — Pending Phase 0 |
| Self-bot / user-token mode | Webhook URL != identity; user tokens enable a single signed-in session that owns the storage server | ToS-grey, documented in README |
| Next.js 14 + TS + Tailwind + shadcn/ui + Zustand (web) | Modern SSR-ready React stack; shadcn gives a coherent component vocabulary; Zustand is lighter than Redux for client state | — Pending Phase 4 |
| Hono + discord.js-selfbot-v13 + Drizzle + better-sqlite3 (server) | Hono is the fastest edge-portable Node framework; Drizzle is typesafe SQL without ORM heaviness; better-sqlite3 is synchronous-fast for a single-process server | — Pending Phase 3 |
| MV3 Chrome extension | v1 was load-bearing for CORS bypass; v2 is a convenience deep-linker, not a dependency | — Pending Phase 5 |
| Monorepo: pnpm workspaces + turborepo, packages layout | Three apps + one shared SDK share types, chunker, and crypto code without publishing | — Pending Phase 1 |
| 50 MB chunks (Nitro) / 25 MB (free) | v1 used 25 MB always; v2 opportunistically uses Nitro boost when token reports Nitro | Discord ToS still bans automated accounts; chunk size is the user's choice |
| AES-GCM client-side encryption (Phase 6) | "Zero-knowledge server" is the differentiator vs Google Drive/Dropbox; Argon2 master-passport KDF; per-file keys wrapped by master key | — Pending Phase 6 |
| 10 phases (your sketch) | Fine granularity matches the v2 pivot; lets us ship a working v0.5 at Phase 4 and harden from there | — Pending roadmap approval |
| Branding: keep "Disbox" | v1 product name carries recognition; internal codename "Wyvern Drive" stays in repo path | Confirmed by assumption (flag if wrong) |
| Deployment: self-hostable Docker, cloud-portable | Hono runs on Fly.io, Railway, Render, bare Node, Docker. Default to Docker image; document one cloud recipe | Confirmed by assumption (flag if wrong) |
| UI direction: dark-first modern SaaS, shadcn defaults, Discord blurple accent (#5865F2) | Cohesive with shadcn/ui library; matches storage-medium aesthetic | Confirmed by assumption (flag if wrong) |
| YOLO mode + Vertical MVP | Solo dev + GSD; each phase delivers a working vertical slice | — |
| v1 data migration: out of scope | v1 keyed by sha256(webhookUrl); v2 keys by user_id. Schema and auth are incompatible | Documented in README |

## Requirements

### Validated

(None yet — greenfield rewrite; ship to validate.)

### Active

See `.planning/REQUIREMENTS.md` for the full v1 requirement list grouped by category. Summary by count:

| Category | Reqs | Owner Phase |
|----------|------|-------------|
| AUTH (authentication) | 4 | 3, 7 |
| ACCT (account identity) | 3 | 3 |
| FS (file system operations) | 9 | 4 |
| DISC (Discord storage) | 5 | 3 |
| PROTO (shared protocol SDK) | 4 | 2 |
| E2EE (end-to-end encryption) | 4 | 6 |
| WEB (web UI) | 8 | 4, 11 |
| EXT (Chrome extension) | 3 | 5 |
| SRCH (search) | 3 | 8 |
| SHARE (sharing) | 4 | 9 |
| MOB (mobile PWA) | 4 | 10 |
| POL (polish) | 4 | 11 |
| **Total** | **55** | |

### Out of Scope

- **v1 data migration** — webhook-keyed sqlite is incompatible with v2 user-token-keyed sqlite. Clean break.
- **Official Discord bot integration** — explicitly self-bot only; official bot path requires a different architecture and a different product.
- **Real-time collaboration / multi-user shared drives** — single-user model for v1. Multi-account is per-user (one user, many Discord accounts) not multi-user (many users, one drive).
- **Mobile native apps (iOS/Android)** — PWA only for v1. Native shells deferred to v3.
- **Server-side rendering of file previews** — previews are client-side (browser plays video/audio, renders image, syntax-highlights text). Server never reads plaintext.
- **End-to-end tests for all flows** — E2E for critical user flows only (login, upload, download, encrypt/decrypt). Unit + integration tests for the rest.
- **Self-service hosted server multi-tenancy** — single-user self-hosted server. Adding auth and multi-tenant billing is a v3 problem.

## Constraints

- **Platform**: Windows dev (current), Linux deploy target
- **Node**: ≥ 20.x LTS (Hono, Next.js 14, better-sqlite3 prebuilds)
- **Package manager**: pnpm ≥ 9 (workspaces)
- **Discord client lib**: `discord.js-selfbot-v13` (ToS-grey; documented in README)
- **Single-process server**: better-sqlite3 is sync; one Node process; cluster mode is out of scope for v1
- **No external cloud dependencies** (no S3, no Redis, no managed Postgres) — server is fully self-contained
- **Browser support**: evergreen Chrome/Edge/Firefox/Safari (MV3 extension is Chrome-only for v1)

## Context

- v1 reference repos (untracked) live in `extension/`, `server/`, `web/` for protocol & UX inspiration. Will be removed once v2 ships.
- Prior v2 attempt (Vite + Hono + Argon2) is staged for deletion in the index; do not restore.
- A `competitive-analysis.md` research file was deleted from the prior v2; not restored. Current research notes in `.planning/research/SUMMARY.md` are lean by design — the user pre-decided the stack.

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-06-07 after initialization*
