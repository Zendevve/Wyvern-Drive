# Wyvern Drive

## What This Is

Wyvern Drive is a browser-based personal cloud storage application that utilizes Discord as a free, unlimited blob storage backend. Files are split into chunks of up to 24MB, uploaded via Discord webhooks, and indexed in a metadata database, providing a Google Drive-like user experience with zero server-side storage costs.

## Core Value

Users get free, unlimited personal cloud storage with standard file manager features (folders, uploads, downloads) using their own Discord webhooks as the backend.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] **F-01**: Webhook-based account setup and stateless JWT authentication
- [ ] **F-02**: File upload with automatic chunking (24MB limit per chunk)
- [ ] **F-03**: File download with chunk reassembly and dynamic CDN URL refresh
- [ ] **F-04**: Folder creation and directory hierarchy management
- [ ] **F-05**: File/folder virtual filesystem listing scoped by hashed webhook
- [ ] **F-06**: Delete file (cascade delete in metadata and associated Discord messages)
- [ ] **F-07**: Upload progress indicator (per-chunk progress)
- [ ] **F-08**: Drag-and-drop file upload
- [ ] **F-09**: Breadcrumb navigation
- [ ] **F-10**: File type icon mapping
- [ ] **F-11**: Database backup & restore (export/import virtual drive metadata JSON)

### Out of Scope

- Multi-user / team shared folders — High complexity, not aligned with personal storage focus.
- Native mobile/desktop application wrappers — Deferred to future milestones, focusing on web SPA first.
- Bot account integration — Avoided to keep setup bot-less and minimize complexity.

## Context

### Technical Environment
- **Frontend**: React 18, Vite, TypeScript, Zustand, Vanilla CSS (rich/premium custom aesthetics).
- **Backend**: Node.js 20+, Fastify, better-sqlite3.
- **Blob Engine**: Discord Webhook API.

### Ecosystem Limitations
- **Discord CDN Expiration**: In late 2023, Discord forced CDN attachment URLs to expire after 24 hours. The app must dynamically refresh URLs.
- **Discord Rate Limits**: 30 requests/minute per webhook. Rate limiting must be gracefully handled via queue, backoff, and jitter.

## Constraints

- **Storage Limit**: Chunks must be under 25MB (limit is set to 24MB to allow margin).
- **Zero Cost**: Architecture must run locally or on free VPS tiers with no database hosting fees.
- **Stateless Backend**: The server must not store webhook URLs persistently as credentials; authentication is handled via JWTs containing the webhook URL.

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Webhook URL Message Fetching | Dynamic CDN URL refresh is achieved via `GET /webhooks/{id}/{token}/messages/{msgId}` to get fresh attachment links. | — Pending |
| Stateless JWT Auth | JWT contains the webhook URL. Hashing the URL provides a unique `accountId` to isolate file nodes in SQLite. | — Pending |
| JSON Metadata Import/Export | Enables backup and recovery of the SQLite virtual drive metadata without running secondary database servers. | — Pending |
| Swappable Storage Interface | Abstracing operations into `StorageBackend` allows switching from Discord to other engines in the future. | — Pending |

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
*Last updated: 2026-06-04 after initialization*
