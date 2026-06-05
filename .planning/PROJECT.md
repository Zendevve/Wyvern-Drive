# Wyvern Drive

## What This Is

Wyvern Drive is a browser-based personal cloud storage application that uses Discord as a free, unlimited blob storage backend. Files are split into chunks of up to 24MB, uploaded via Discord webhooks, and indexed in a metadata database — providing a Google Drive–like experience with zero server-side storage costs. The v3.0 milestone transforms the working v1.0/v2.0 product into a production-grade platform: trustworthy (OAuth, CSRF, audit), high-performance (parallel I/O, range passthrough, resumable uploads), encrypted at rest with signed share links, operationally reliable (health checks, structured logs, graceful shutdown), and productive (search, tags, bulk ops, previews).

## Core Value

Users get free, unlimited personal cloud storage with the security, performance, and reliability expected of a commercial cloud drive — all backed by their own Discord webhooks.

## Requirements

### Validated

- **F-01**: Webhook-based account setup and stateless JWT authentication (v1.0)
- **F-02**: File upload with automatic chunking (24MB limit per chunk) (v1.0)
- **F-03**: File download with chunk reassembly and dynamic CDN URL refresh (v1.0)
- **F-04**: Folder creation and directory hierarchy management (v1.0)
- **F-05**: File/folder virtual filesystem listing scoped by hashed webhook (v1.0)
- **F-06**: Delete file (cascade delete in metadata and associated Discord messages) (v1.0)
- **F-07**: Upload progress indicator (per-chunk progress) (v1.0)
- **F-08**: Drag-and-drop file upload (v1.0)
- **F-09**: Breadcrumb navigation (v1.0)
- **F-10**: File type icon mapping (v1.0)
- **F-11**: Database backup & restore (export/import virtual drive metadata JSON) (v1.0)

### Active (v3.0 — Ultimate Discord File Storage)

#### Trust & Security (TRUST)

- [ ] **TRUST-01**: User can authenticate with Discord OAuth (identify + email scopes) with refresh-token rotation
- [ ] **TRUST-02**: Per-account storage quota enforced server-side (configurable; arc-gauge widget already in v2.0 reads this)
- [ ] **TRUST-03**: Per-account API rate limiting (token bucket; per-IP and per-account)
- [ ] **TRUST-04**: State-changing requests require a CSRF token (double-submit or SameSite=Strict cookies)
- [ ] **TRUST-05**: HTTP responses include security headers (CSP, X-Content-Type-Options, HSTS, Referrer-Policy)

#### Performance (PERF)

- [ ] **PERF-01**: Files upload with parallel chunk concurrency (configurable, default 4)
- [ ] **PERF-02**: Files download with parallel chunk concurrency (configurable, default 4)
- [ ] **PERF-03**: HTTP Range requests are forwarded per-chunk to Discord CDN (no server buffering)
- [ ] **PERF-04**: Failed uploads can resume from last successful byte via TUS.io protocol

#### Encryption & Sharing (CRYPTO)

- [ ] **CRYPTO-01**: Files can be encrypted at rest with AES-256-GCM (per-chunk random 12-byte nonce + 16-byte auth tag)
- [ ] **CRYPTO-02**: User can create a signed share link with HMAC-SHA256 token, optional TTL (1h / 24h / 7d / 30d / never)
- [ ] **CRYPTO-03**: Share links support optional password protection (Argon2id verified on recipient side)
- [ ] **CRYPTO-04**: Share links can be revoked without rotating the underlying chunks (server-side deny list)

#### Reliability (REL)

- [ ] **REL-01**: Database schema is versioned with forward+backward migrations (better-sqlite3 + hand-rolled `migrations/` table)
- [ ] **REL-02**: Server exposes `/healthz` (liveness, no external deps) and `/readyz` (DB + Discord connectivity) endpoints
- [ ] **REL-03**: Structured logging via pino with request IDs and configurable log levels
- [ ] **REL-04**: Server handles SIGTERM/SIGINT gracefully — drain in-flight uploads, close DB cleanly
- [ ] **REL-05**: File deletion is atomic: DB row + all associated Discord messages deleted in a single transaction (no orphaned chunks on partial failure)

#### Productivity (OPS)

- [ ] **OPS-01**: User can search files by filename (case-insensitive substring, server-side via SQLite FTS5 or indexed LIKE)
- [ ] **OPS-02**: User can tag files with free-form labels and filter the file list by tag
- [ ] **OPS-03**: User can perform bulk operations (delete, move, tag, share) on multi-selected files
- [ ] **OPS-04**: User sees image and video previews (server-side thumbnail generation with `sharp` and `ffmpeg`)

### Out of Scope (deferred to future milestones)

- **F-12 through F-17** (v2.0 UI polish: premium design system, sidebar gauge, detail pane, context menus, task queue) — Paused in v2.0; resume in v3.1 quick wins or v4. The competitive analysis work takes priority. *Reason: v3 addresses the more critical backend gaps first; the UI polish is a fast follower once the foundation is hardened.*
- **Browser extension (MV3)** — *Reason: leverage feature that depends on a hardened core; defer to v4.*
- **CLI client (`npm i -g wyvern-drive`)** — *Reason: same as above.*
- **WebDAV server (rclone mount compatibility)** — *Reason: same as above.*
- **MCP server (AI agent integration)** — *Reason: niche; defer until user demand.*
- **Public versioned REST API with OpenAPI 3.1 spec** — *Reason: leverage feature; defer to v4.*
- **Content-addressed dedup (SHA-256 chunk hashing)** — *Reason: high complexity, low immediate value; defer to v4 or v5.*
- **End-to-end encryption (server never sees plaintext key)** — *Reason: needs careful UX work; defer to v4 after CRYPTO is validated.*
- **Multi-tenant / team shared folders** — *Reason: high complexity, conflicts with personal-storage positioning (see PROJECT.md history).*
- **Native mobile/desktop app wrappers** — *Reason: web-first; mobile later.*

## Context

### Technical Environment
- **Frontend**: React 18, Vite, TypeScript, Zustand, Vanilla CSS (premium custom aesthetics)
- **Backend**: Node.js 20+, Fastify 5, better-sqlite3, @discordjs/rest 2.x, jsonwebtoken
- **Blob Engine**: Discord Webhook API (per-user webhook, dynamic CDN URL refresh)
- **Tests**: vitest (already in package.json; not yet exercised)
- **CI/CD**: GitHub Actions (planned in REL phase)

### Ecosystem Limitations
- **Discord CDN Expiration**: Late 2023 forced CDN attachment URLs to expire after 24 hours. Wyvern dynamically refreshes URLs via `GET /webhooks/{id}/{token}/messages/{msgId}`.
- **Discord Rate Limits**: 30 requests/minute per webhook. Handled via `X-RateLimit-*` headers and backoff (will be hardened in PERF-04).
- **Discord ToS**: Storing arbitrary user data in Discord channels is a ToS grey area. Wyvern's per-user-webhook model mitigates this — the user owns and can rotate their webhook.

### Competitive Context
See `.planning/research/competitive-analysis.md` for the full 8-project analysis. Key takeaway: every reference project fails on at least one of (a) parallel downloads, (b) resumable uploads, (c) real auth, (d) signed share links, (e) multi-user. v3.0 closes all five.

## Constraints

- **Storage Limit**: Chunks must be under 25MB (set to 24MB to allow margin)
- **Zero Cost**: Architecture must run locally or on free VPS tiers with no database hosting fees
- **Stateless Backend**: Server must not store webhook URLs persistently as credentials; auth is via JWT or OAuth
- **No Selfbot**: Use only official bot/webhook OAuth flows (Discord ToS compliance)
- **No Bot Token Required**: v3 keeps the per-user-webhook model (no operator bot token), so a single user's data loss doesn't cascade to all users

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Webhook URL Message Fetching | Dynamic CDN URL refresh via `GET /webhooks/{id}/{token}/messages/{msgId}` for fresh attachment links | ✓ Validated v1.0 |
| Stateless JWT Auth (webhook in token) | Hashing webhook provides `accountId` to isolate file nodes in SQLite | ✓ Validated v1.0 |
| JSON Metadata Import/Export | Backup/recovery of virtual drive metadata without secondary DB servers | ✓ Validated v1.0 |
| Swappable Storage Interface | `StorageBackend` allows future swap from Discord to other engines | ✓ Validated v1.0 |
| AES-256-GCM (not CTR) at rest | CTR is unauthenticated (silent tampering); GCM is HW-accelerated and AEAD | — Pending (v3 CRYPTO-01) |
| Argon2id for share-link passwords | Rainbow-table feasible for short secrets under SHA-256 | — Pending (v3 CRYPTO-03) |
| TUS.io for resumable uploads | Battle-tested protocol; avoids custom chunked-upload bugs | — Pending (v3 PERF-04) |
| Skip Ecosystem (ext/CLI/MCP/API) in v3 | These are leverage that depend on a hardened core; defer to v4 | — Pending |
| Pause v2.0 Phases 5-6 UI polish | v3's backend work is higher priority for "be the best" than UI polish | — Pending |

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
*Last updated: 2026-06-05 for milestone v3.0 (Ultimate Discord File Storage)*
