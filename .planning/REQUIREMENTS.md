# Wyvern Drive — Requirements

**Defined:** 2026-06-05
**Core Value:** Users get free, unlimited personal cloud storage with standard file manager features using their own Discord webhooks.

---

## v1.0 — MVP (Validated, Shipped 2026-06-04)

All 11 v1 requirements validated and shipped. See `.planning/MILESTONES.md`.

---

## v2.0 — Professional Cloud Storage UX (Validated specs, execution PAUSED 2026-06-05)

The v2.0 design system, storage arc gauge sidebar, and category chip breakdown (F-01..F-11) shipped in Phase 4. Phases 5–6 (Directory Browser & Detail Side-Pane, Context Menus & Task Queue Overlay) reached planning/spec capture with full UI-SPEC, CONTEXT, PLAN, and UAT documents written, but execution was deferred to v3.1 to prioritize core-hardening work in v3.0.

**Paused Requirements** — to be picked up in v3.1 quick-wins or v4:
- **F-12** Directory browser grid/list view with breadcrumbs and multi-select (Phase 5)
- **F-13** Right detail side-pane with file metadata and preview (Phase 5)
- **F-14** Custom right-click context menus matching desktop OS conventions (Phase 6)
- **F-15** Floating task queue overlay for upload/download progress (Phase 6)
- **F-16** Drag-and-drop file reorganization across folders (Phase 5/6)
- **F-17** Keyboard shortcut layer (Phase 6)

Specs preserved at `.planning/phases/05-directory-browser-detail-pane/` and `.planning/phases/06-desktop-context-menus-task-queue/` (not yet created).

---

## v3.0 — Ultimate Discord File Storage (Active)

The core must be hardened before adding new surfaces. v3.0 takes a defensive engineering approach: turn the React SPA + VFS engine into a production-grade, observable, recoverable, secure system that can survive Discord rate limits, partial uploads, and a hostile or unreliable network.

**Scope:** All five hard-categories from the competitive analysis (`.planning/research/competitive-analysis.md`) — Trust, Performance, Crypto, Reliability, Operations. Ecosystem features (browser extension, CLI, WebDAV, MCP, public API) are explicitly out of scope for v3.0; they will be evaluated in v4 after the core is hardened.

### TRUST — Audit & User Trust (5 requirements)

- **TRUST-01** Structured audit log of every user-initiated action (upload, download, delete, rename, move, share, login, settings change) with timestamp, actor, target, outcome, and correlation ID. Persisted to IndexedDB; queryable and exportable as JSON/CSV.
- **TRUST-02** In-app activity feed surfacing the last 100 audit events with filter by action type, time range, and target. Accessible from sidebar.
- **TRUST-03** Storage integrity verification: background SHA-256 hash recomputation on a rolling basis; flag any chunk whose hash no longer matches the manifest. Surface warnings in UI.
- **TRUST-04** Operation receipts: after destructive actions (delete, move, bulk delete), the user can view/rollback the affected set within a configurable retention window (default 30 days).
- **TRUST-05** Explicit user consent and confirmation flow for destructive bulk operations, with a typed-confirmation gate for deletes >100 files or >1 GB.

### PERF — Performance & Scale (4 requirements)

- **PERF-01** TUS.io-based resumable uploads for files >50 MB. Survives browser refresh, tab close, network drop. Chunk size adaptive to measured bandwidth.
- **PERF-02** Parallel chunk uploads with bounded concurrency (default 4, user-configurable 1–8). Discord rate-limit aware: auto-throttle on 429 responses.
- **PERF-03** Virtual scrolling for the directory browser. Smooth 60fps with 10,000+ items in a single folder.
- **PERF-04** Background prefetch and warm-cache for folder metadata on hover/focus (200ms debounce), so navigating into a folder feels instant.

### CRYPTO — Encryption at Rest (4 requirements)

- **CRYPTO-01** Optional AES-256-GCM encryption-at-rest for chunk payloads, key derived from a user-supplied passphrase via Argon2id (m=64MB, t=3, p=4). Per-file IV. Authenticated additional data includes file path and chunk index to prevent swap attacks.
- **CRYPTO-02** Share-link encryption: encrypted ZIPs/archives with a separate per-share key. Passphrase-derived via Argon2id; shareable via the standard share-link format with the passphrase delivered out-of-band.
- **CRYPTO-03** Webhook URL and token material encrypted at rest in IndexedDB using a key derived from a user-set app master password. Webhook secrets never appear in plaintext in DevTools, exports, or backups.
- **CRYPTO-04** Key zeroization: on logout, master keys and derived keys are wiped from memory. Re-derivation required after each session start.

### REL — Reliability & Recovery (5 requirements)

- **REL-01** Local-first architecture: every user action is persisted to IndexedDB before being attempted remotely. The UI is fully usable offline; queued operations replay automatically when connectivity returns.
- **REL-02** Persistent operation queue (separate from in-memory task queue) with crash recovery. After a tab crash, refresh, or cold start, the queue is restored and operations continue from the last checkpoint.
- **REL-03** Idempotent uploads/downloads: every operation has a deterministic idempotency key (hash of intent). Re-running a partially-failed operation does not create duplicates on the Discord side.
- **REL-04** Per-file backup export: user can export any file (decrypted) to local disk at any time, bypassing Discord entirely. Per-folder and full-account export also available.
- **REL-05** Disaster recovery import: a `.wyvern-backup` archive (manifest + chunks + audit log) can be re-imported into a fresh browser profile, reconstructing the full VFS state.

### OPS — Operations & Observability (4 requirements)

- **OPS-01** Structured in-app logger with configurable level (error/warn/info/debug). Exposed via a hidden diagnostic panel (Ctrl+Shift+D) for support and self-debugging.
- **OPS-02** Optional OpenTelemetry-compatible telemetry export (OTLP/HTTP) for users who self-host a collector. Strictly opt-in, off by default, with a clear consent banner.
- **OPS-03** Connection health dashboard: live view of Discord API latency, rate-limit headroom (X-RateLimit-Remaining), per-webhook quota state, and last-success timestamp.
- **OPS-04** Self-test diagnostic command that exercises every storage subsystem (write/read/delete, hash verify, encrypt/decrypt, queue replay) and reports a pass/fail matrix.

---

## Out of Scope for v3.0

| Item | Reason | Target |
|------|--------|--------|
| Browser extension (Chrome/Firefox) | Requires hardened core; needs signed manifest, store review | v4 |
| CLI client | Requires hardened core; low demand for self-hosted | v4 |
| WebDAV server | Requires hardened core; server-side complexity | v4 |
| MCP server | Requires hardened core; AI agent surfaces | v4 |
| Public REST API | Requires hardened core; auth/Rate-limit design | v4 |
| F-12..F-17 (v2.0 UI polish) | Strategic deferral; core hardening prioritized | v3.1 / v4 |
| Multi-user / shared accounts | Out of product vision (per-user webhook model) | Not planned |
| End-to-end encryption (E2EE) | Conflicts with Discord's server-side processing; per-share encryption is the compromise | Not planned |

---

## Traceability Matrix

| v3 Requirement | Maps to Quick-Win | Source Reference |
|----------------|-------------------|------------------|
| TRUST-01 | QW-1, QW-2 | CloudCord audit, DDrive logging |
| TRUST-02 | QW-3 | CloudCord, DisboxApp |
| TRUST-03 | QW-4 | DDrive, DisboxApp |
| TRUST-04 | QW-5 | CloudCord |
| TRUST-05 | QW-6 | DDrive |
| PERF-01 | QW-7 | CloudCord, DDrive |
| PERF-02 | QW-8 | CloudCord (rate-limit aware) |
| PERF-03 | QW-9 | DDrive, DisboxApp |
| PERF-04 | QW-10 | DisboxApp |
| CRYPTO-01 | QW-11 | discord-cloud-storage (rare), most skip |
| CRYPTO-02 | QW-12 | discord-cloud-storage |
| CRYPTO-03 | QW-13 | discloud-style hardening |
| CRYPTO-04 | QW-14 | discord-cloud-storage |
| REL-01 | QW-15 | All (universal gap) |
| REL-02 | Implied by REL-01 | DDrive |
| REL-03 | Implied by REL-01 | CloudCord |
| REL-04 | Implied by REL-05 | DDrive |
| REL-05 | Implied by REL-04 | CloudCord |
| OPS-01 | Universal gap | None |
| OPS-02 | Universal gap | None |
| OPS-03 | Universal gap | DDrive (rate-limit UI) |
| OPS-04 | Universal gap | None |

---

*Last updated: 2026-06-05 — v3.0 requirements defined, 22 REQ-IDs across 5 categories*
