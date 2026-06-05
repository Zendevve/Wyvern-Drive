# Milestones

## v1.0 v1.0 (Shipped: 2026-06-04)

**Phases completed:** 3 phases, 9 plans, 38 tasks

**Key accomplishments:**

- Stateless storage engine API utilizing Discord Webhooks as storage backend, featuring JWT-based authentication, streaming upload chunking, and range-request-seekable download stream reassembly.
- Persistent virtual filesystem with account-isolated metadata, hierarchical folder CRUD, cascade delete, and JSON backup.
- Complete Vite + React + TypeScript SPA that talks to the Phase 2 Fastify backend. Webhook auth, drive shell, upload queue, delete confirmation, toasts, and detail panel.

---

## v2.0 v2.0 (Paused: 2026-06-05)

**Phases completed:** 1 of 3 (Phase 4 shipped; Phases 5–6 spec-captured, execution deferred)

**Shipped (Phase 4):**

- Design system tokens (color, spacing, typography, motion, elevation, focus, dot-pattern).
- Outfit typography across the app.
- 260px sidebar with storage arc gauge, category chip breakdown, and active-item indicator.

**Paused (Phases 5–6, specs preserved in `.planning/phases/`):**

- Phase 5: Directory browser grid/list view + right detail side-pane.
- Phase 6: Desktop-grade context menus + floating task queue overlay.

**Reason for pause:** Strategic hard-cut to v3.0. v2.0 UI polish (F-12..F-17) deferred to v3.1 quick-wins or v4. v3.0 prioritizes core hardening (audit, performance, encryption, reliability, observability) before adding UI surface.

---

## v3.0 v3.0 (Planned: 2026-06-05)

**Goal:** Harden the core before adding new surfaces. Take the React SPA + VFS engine from "working prototype" to "production-grade, observable, recoverable, secure system."

**Phases planned:** 6 (phases 7–12), 22 requirements across Trust, Performance, Crypto, Reliability, Operations.

- Phase 7: Trust Foundation (audit log + activity feed)
- Phase 8: Performance Core (TUS resumable + parallel chunks + virtual scroll + prefetch)
- Phase 9: Encryption at Rest (AES-256-GCM, Argon2id, secret store, key zeroization)
- Phase 10: Reliability & Recovery (local-first, persistent queue, idempotency)
- Phase 11: Disaster Recovery & Integrity (hash verify, operation receipts, backup export/import)
- Phase 12: Operations & Hardening (logger, OTLP, health, self-test, destructive consent)

**Roadmap:** `.planning/ROADMAP.md`
**Requirements:** `.planning/REQUIREMENTS.md`
**Research:** `.planning/research/competitive-analysis.md`
