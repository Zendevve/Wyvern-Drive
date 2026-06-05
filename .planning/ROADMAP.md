# Wyvern Drive — v3.0 Roadmap

**Generated:** 2026-06-05
**Milestone:** v3.0 — Ultimate Discord File Storage
**Status:** Planning
**Phases:** 7–12 (6 phases, 22 v3 requirements)

---

## Overview

v3.0 is a hard strategic cut from v2.0. The v2.0 design system (F-01..F-11) shipped in Phase 4; the v2.0 UI polish (F-12..F-17) is paused and explicitly deferred. v3.0 hardens the core before adding any new surface. The 22 active requirements cluster into five defensive engineering categories — Trust, Performance, Crypto, Reliability, Operations — sourced from a competitive analysis of 8 reference projects (`research/competitive-analysis.md`). Every reference project fails on at least one of (a) parallel downloads, (b) resumable uploads, (c) real auth, (d) signed share links, (e) multi-user. v3.0 closes all five gaps that apply to the single-user per-webhook model.

The phasing is goal-backward: each phase ends with an observable user capability, not a task list. Phase 7 (Trust Foundation) lands the audit log and activity feed that everything else writes into. Phase 8 (Performance Core) delivers the single biggest UX win — resumable parallel uploads — and pairs it with virtual scrolling and hover prefetch. Phase 9 (Encryption at Rest) ships AES-256-GCM with Argon2id-derived keys and a master-password-gated secret store. Phase 10 (Reliability & Recovery) turns the SPA into a local-first system with a crash-surviving persistent queue. Phase 11 (Disaster Recovery & Integrity) gives the user data sovereignty — background hash verification, operation receipts with rollback, full backup export/import. Phase 12 (Operations & Hardening) closes the milestone with observability (structured logger, OTLP telemetry, connection health, self-test) and the destructive-action consent gate that guards it all.

After all 6 phases ship, the user can run an end-to-end "hardened production system" smoke test: upload a 1 GB file with parallel resumable chunks, verify encrypted-at-rest chunks, view the audit trail, perform a destructive bulk delete behind the consent gate, simulate a tab crash mid-upload, and import the full backup into a fresh browser profile.

---

## Phases

### Phase 7: Trust Foundation (audit visibility)

**Goal:** The user can see a complete, queryable history of every action they have taken in Wyvern Drive, filterable by type, time, and target.
**Category:** Trust
**Requirements covered:** TRUST-01, TRUST-02
**Estimated effort:** M (1–1.5 weeks)
**Dependencies:** None (first phase; provides audit plumbing consumed by later phases)

**Key deliverables:**
- Append-only `audit_log` IndexedDB store with schema `(id, action, target_id, target_type, outcome, correlation_id, metadata_json, created_at)`.
- Audit middleware in the SPA that wraps every state-changing operation (upload, download, delete, rename, move, share, login, settings change) — wraps the existing v1.0 handlers with a `withAudit(correlationId, fn)` helper.
- Correlation ID propagation: every async operation generates a UUIDv4 at the start; the ID flows through all sub-operations and into error reports.
- `Activity` sidebar entry linking to the Activity page.
- `ActivityPage` React route: paginated, virtualized list of the last 100 events, filterable by action type, target, and time range (last 24h / 7d / 30d / all).
- Export-audit action: downloads the full audit log (or a filtered subset) as JSON or CSV.

**Success criteria:**
1. Every state-changing user action in the SPA writes exactly one row to `audit_log` with the correct `action`, `target_id`, `outcome`, `correlation_id`, and `created_at`.
2. The Activity page renders the last 100 events sorted newest-first and filters by action type and time range update the list within 200 ms.
3. Exporting the audit log produces a JSON file with every row from the filter range and a CSV that opens cleanly in a spreadsheet.
4. Failed operations (e.g. a delete that 429s) are recorded with `outcome='error'` and the error message in `metadata_json`.
5. Closing and reopening the tab preserves the audit log; IndexedDB persistence verified by hard refresh.

**Reference projects:** CloudCord (audit model), DDrive (logging), DisboxApp (no audit — gap closed).

---

### Phase 8: Performance Core (resumable parallel I/O + snappy browser)

**Goal:** Uploading a 1 GB file survives browser refresh, tab close, and network drops; the directory browser stays at 60 fps with 10,000+ items; folder navigation feels instant.
**Category:** Performance
**Requirements covered:** PERF-01, PERF-02, PERF-03, PERF-04
**Estimated effort:** L (2 weeks — TUS integration is non-trivial)
**Dependencies:** None (parallel to Phase 7; does not need audit log to ship)

**Key deliverables:**
- TUS.io resumable upload protocol: server implements `POST /files` (create), `HEAD /files/:id` (offset query), `PATCH /files/:id` (append chunk). Client uses `tus-js-client` to drive.
- Adaptive chunk sizing: client probes bandwidth on the first chunk and picks 8 / 16 / 24 MiB chunks accordingly. Threshold: PERF-01 only kicks in for files >50 MB.
- Parallel chunk uploader with bounded concurrency (default 4, user-configurable 1–8 in Settings). Rate-limit aware: parses `X-RateLimit-Remaining` and `X-RateLimit-Reset-After` from Discord responses; auto-throttles on 429.
- Idempotency keys for every chunk upload (SHA-256 of `fileId:chunkIndex`) — same chunk retried after network drop does not create a duplicate Discord message. *(Idempotency in the operation queue lands in Phase 10; this phase covers only the per-chunk request idempotency.)*
- Virtual scrolling for the directory browser: `react-window` or equivalent; renders only visible rows; smooth scroll at 10,000 items.
- Background prefetch on folder hover/focus with a 200 ms debounce: fetches the folder's metadata (size, child count, top-level icons) into a small cache, so clicking feels instant.

**Success criteria:**
1. Starting an upload of a 1 GB file, then closing the tab, then reopening the tab within 24 hours, resumes the upload from the last completed chunk — verified by inspecting the resulting Discord channel and the IndexedDB upload state.
2. A simulated network drop mid-upload (DevTools "Offline" toggle for 10 seconds) does not produce duplicate Discord messages on reconnect.
3. Uploading 4 chunks in parallel completes in roughly ¼ the wall-clock time of a 4-chunk serial upload on the same connection.
4. Triggering a 429 from Discord (rate-limit test webhook) causes the uploader to back off and continue without losing progress or duplicating chunks.
5. Directory browser with 10,000 mock entries scrolls at ≥55 fps on a mid-range laptop; no DOM node count over ~80 visible items at any time.
6. Hovering over a folder for 250 ms populates the prefetch cache; clicking opens the folder with no spinner (sub-16 ms paint).

**Reference projects:** CloudCord (rate-limit aware), DDrive (parallel upload trick), discloud (range-aware chunk fetch — informs the prefetch design).

---

### Phase 9: Encryption at Rest (secrets never leak)

**Goal:** User files, share payloads, and webhook secrets are protected by AES-256-GCM with Argon2id-derived keys; no plaintext secret ever touches IndexedDB, DevTools, or a backup export.
**Category:** Crypto
**Requirements covered:** CRYPTO-01, CRYPTO-02, CRYPTO-03, CRYPTO-04
**Estimated effort:** L (2 weeks — crypto correctness requires real attention)
**Dependencies:** None for the encryption engine; benefits from Phase 8's chunking for end-to-end testing of encrypted uploads.

**Key deliverables:**
- `CryptoEngine` TypeScript module with three primitives: `encryptChunk(plaintext, key, aad) → {nonce, tag, ciphertext}`, `decryptChunk(...)`, `deriveKey(passphrase, salt, m, t, p) → key` (Argon2id `m=64MB, t=3, p=4`).
- Optional per-file encryption toggle in the upload dialog. When enabled, each chunk is encrypted with a per-file DEK; DEK is wrapped with a KEK derived from the user master password.
- AAD (additional authenticated data) for every chunk: `SHA-256(fileId || chunkIndex)` — prevents swap attacks where an attacker moves a chunk between files.
- On-chunk layout (per the competitive analysis recommendation): `nonce(12) ‖ tag(16) ‖ ciphertext` — self-describing, fails closed on tamper.
- `MasterPasswordGate` UI on first launch of a session: derives the KEK once, holds it in a `CryptoKey` in a `Worker` for the session lifetime.
- `SecretStore`: webhook URL and OAuth tokens are encrypted with the KEK before being written to IndexedDB. DevTools network tab and storage tab never show plaintext secrets.
- Shareable encrypted archive: user can mark files for "encrypted share"; the UI builds a `.wyvern-share.zip` containing the manifest + encrypted chunks + an Argon2id-derived key hint; recipient opens it in Wyvern Drive and supplies the passphrase out-of-band.
- Key zeroization: on logout, every `CryptoKey` reference is overwritten and the worker is terminated; the next session re-derives from scratch.

**Success criteria:**
1. Uploading a file with encryption enabled produces Discord messages whose payloads, when downloaded directly from the CDN, do not contain the original file bytes (verified by inspecting the raw bytes).
2. Round-trip: encrypt → upload → download → decrypt produces a byte-identical file (SHA-256 match).
3. Tampering with one byte of an encrypted chunk (in transit or at rest) causes decryption to fail with an authentication error, not silently produce garbage.
4. Setting a master password, logging out, and inspecting IndexedDB shows the webhook URL stored as ciphertext only — no plaintext secret is findable via DevTools.
5. Argon2id derivation on a low-end laptop (Argon2id m=64MB, t=3) completes in 1–3 seconds — fast enough to not feel like a hang, slow enough to defeat brute force.
6. Re-ordering an encrypted chunk (swapping chunk 2 and chunk 3) causes decryption to fail because the AAD includes the chunk index.
7. Logout + login with the same master password recovers the same files; logout + login with a wrong master password fails to decrypt anything (verifies the zeroization actually wipes state).

**Reference projects:** discord-cloud-storage (AEAD per-chunk pattern, fixed to GCM), DiscordFileHost (manifest-in-first-chunk trick — rejected, we use a sidecar manifest for clarity), DDrive (AES-CTR — anti-pattern, do not copy).

---

### Phase 10: Reliability & Recovery (local-first, crash-surviving)

**Goal:** Every user action is durable: it persists locally first, survives tab crashes, browser restarts, and network outages, and replays automatically when connectivity returns.
**Category:** Reliability
**Requirements covered:** REL-01, REL-02, REL-03
**Estimated effort:** L (2 weeks)
**Dependencies:** Phase 7 (audit log captures replay events); benefits from Phase 8 (TUS is the natural carrier for the persistent queue), but ships independently.

**Key deliverables:**
- `OperationQueue` IndexedDB store with schema `(id, type, payload_json, idempotency_key, status, attempts, last_error, created_at, updated_at)`. Status state machine: `pending → in_flight → succeeded | failed | cancelled`.
- Every user-initiated state-changing operation goes through `enqueue()` before it touches the network. Local state updates immediately; the queue worker drains in the background.
- Queue worker: drains in insertion order, respects a configurable concurrency cap (default 2 to leave headroom for the user), and uses the operation's `idempotency_key` (SHA-256 of `(accountId, operationType, targetId, intentHash)`) to deduplicate retries.
- Replay logic: on app start, the queue reads all `pending` and `in_flight` rows, attempts to resume or restart each one. `in_flight` rows are treated as crashed and restarted from the last checkpoint.
- `IntegrityGuard` in the queue: a TUS upload of 100 chunks, after a tab crash, resumes from chunk 47 by reading the server-reported offset — does not re-upload chunks 1–46.
- `OperationQueue` UI in the diagnostic panel (Ctrl+Shift+D): shows queued, in-flight, succeeded, and failed operations with timestamps and retry buttons.
- Crash recovery test harness: a "Simulate crash" button in the diagnostic panel that throws mid-operation; on next page load, the queue resumes.

**Success criteria:**
1. Initiating an upload, then triggering a tab crash mid-upload, then reopening the tab within 24 hours, resumes the upload from the last completed chunk — verified by chunk count in the Discord channel.
2. Adding the same file to the upload queue twice (e.g. double-click) produces exactly one Discord upload, not two — verified by idempotency_key uniqueness.
3. With the browser offline, the user can browse the full VFS, queue new uploads, rename files, and create folders; turning connectivity back on drains the queue within 30 seconds.
4. Closing the laptop lid (suspend), reopening an hour later, the queue resumes from where it left off — no operations are lost, no duplicates are created.
5. The diagnostic panel shows the live state of the queue and allows manual retry of failed operations.

**Reference projects:** DDrive (transactional commit-on-last-chunk — anti-pattern, do not copy), CloudCord (no queue — gap closed), DisboxApp (orphaned chunks on crash — gap closed).

---

### Phase 11: Disaster Recovery & Integrity (user data sovereignty)

**Goal:** The user can prove their data is intact, roll back destructive mistakes, and reconstruct the entire VFS from a portable backup — on the same browser, a different browser, or a different machine.
**Category:** Trust + Reliability
**Requirements covered:** TRUST-03, TRUST-04, REL-04, REL-05
**Estimated effort:** L (2 weeks)
**Dependencies:** Phase 7 (audit log for operation receipts), Phase 10 (local-first persistence for export snapshot), REL-05 builds on the existing delete path.

**Key deliverables:**
- Background `IntegrityVerifier` worker: rolling SHA-256 recomputation of chunks, comparing against the manifest's stored hash. Runs on a low-priority queue (yields to user actions). Flags any chunk whose hash no longer matches.
- `IntegrityDashboard` page: shows last-verified timestamp, number of chunks verified, and any flagged chunks with a "Re-download and re-verify" action.
- `OperationReceipts`: every destructive action (delete, move, bulk delete) creates a `receipt` record containing the affected file IDs, their pre-state (manifest hashes, parent paths), the operation type, the correlation ID, the timestamp, and the user. Receipts are kept for a configurable retention window (default 30 days).
- `ReceiptsPage` React route: lists recent destructive actions, each with a "View affected set" and a "Rollback" action. Rollback re-creates the deleted files in their original folders (or moves them back), pulling chunks from the existing receipt's chunk references.
- `Export` action in the sidebar: per-file export (decrypted) to local disk, per-folder export (zips the subtree on the fly), and full-account export. Exports preserve the VFS structure as a `.wyvern-backup` archive.
- `.wyvern-backup` archive format: a zip containing `manifest.json` (the VFS tree, file metadata, chunk references, encryption metadata), `chunks/` directory (the raw chunk bytes), `audit_log.jsonl` (the full audit log), and `receipts.json` (the receipts). Versioned (v1) for future-compat.
- `Import` action: drag a `.wyvern-backup` onto the import zone, the user is shown a preview of what will be restored, and on confirmation the VFS is reconstructed — files appear in their original folders, audit log merges, receipts merge.

**Success criteria:**
1. Manually corrupting one byte of a chunk in a Discord message (simulated via a test fixture) causes the IntegrityVerifier to flag it within one verification cycle; the IntegrityDashboard shows the flagged chunk with a re-verify action.
2. Performing a delete on 5 files creates one receipt containing all 5 file IDs and their pre-state; opening the receipt shows the affected set; clicking Rollback restores all 5 files to their original folders.
3. Exporting a single file produces a downloaded file that is byte-identical to the original (SHA-256 match) — encryption is transparent on export when the user is authenticated.
4. Exporting a full account produces a `.wyvern-backup` whose `manifest.json` lists every file and folder, `chunks/` contains every chunk, and `audit_log.jsonl` contains every audit event.
5. Importing the backup into a fresh browser profile (clear IndexedDB, then import) reconstructs the full VFS — every file, folder, and audit event reappears; the resulting Discord-side chunk count is identical to the pre-export count.
6. A receipt older than the retention window is pruned automatically; user can configure the window in Settings (7d / 30d / 90d / forever).

**Reference projects:** CloudCord (operation receipts), DDrive (per-file export), DisboxApp (export/import — gap closed with a real format).

---

### Phase 12: Operations & Hardening (observability + safety nets)

**Goal:** The user (and any support contact) can diagnose what is happening inside Wyvern Drive, the destructive operations are guarded by explicit consent, and the entire system is observable end-to-end.
**Category:** Operations + Trust
**Requirements covered:** OPS-01, OPS-02, OPS-03, OPS-04, TRUST-05
**Estimated effort:** M (1.5 weeks)
**Dependencies:** All prior phases (this phase observes and gates them); requires the audit log (Phase 7), the persistent queue (Phase 10), and the destructive operations (REL-05 from Phase 11) to be in place.

**Key deliverables:**
- `Logger` TypeScript module wrapping `pino` with configurable levels (error / warn / info / debug) and a per-session in-memory ring buffer (last 10,000 entries).
- Hidden diagnostic panel (`Ctrl+Shift+D`): live tail of the log buffer, filterable by level and component; "Copy to clipboard" for support; "Download full log" for offline analysis.
- Optional OTLP/HTTP telemetry export: user configures an OTLP endpoint in Settings (off by default). On enable, a clear consent banner explains what is sent (counts, latencies, error rates — never chunk bytes or secrets). A collector-side filter is documented.
- `ConnectionHealth` panel in Settings: live readouts of Discord API latency (ms), `X-RateLimit-Remaining` per webhook, per-webhook quota state, last-success timestamp. Updates every 5 seconds; color-coded green/yellow/red.
- `SelfTest` command: triggered from the diagnostic panel or `?selftest` URL param. Exercises every storage subsystem — write a test chunk, read it back, delete it, hash-verify, encrypt-decrypt round-trip, queue replay — and reports a pass/fail matrix with timings.
- `DestructiveConsentGate` component: wraps every destructive action (delete, move, bulk delete, account reset, full export). For deletes >100 files or >1 GB, requires the user to type the word `DELETE` to confirm. Modal is modal-only (no escape, no back-click), keyboard-accessible, and records the consent event in the audit log.
- Settings UI for the new options: master password change, telemetry opt-in, log level, destructive threshold tuning, receipt retention window.

**Success criteria:**
1. Pressing `Ctrl+Shift+D` opens the diagnostic panel; the live log tail updates within 200 ms of a new event; filtering by level reduces the visible list correctly.
2. Configuring an OTLP endpoint in Settings and triggering an upload causes the configured collector to receive a span for the upload operation (verified with a test collector); the consent banner is shown the first time telemetry is enabled.
3. The ConnectionHealth panel shows a non-zero `X-RateLimit-Remaining` for the user's webhooks, updates every 5 seconds, and turns red when remaining approaches zero.
4. Running SelfTest reports 8/8 pass on a clean install; intentionally breaking one subsystem (e.g. revoking webhook access mid-test) causes that row to report fail with a clear error message.
5. Attempting to delete 150 files in a bulk operation triggers the DestructiveConsentGate; typing `delete` (lowercase) does not unlock the confirm button; typing `DELETE` does unlock it; cancelling preserves all files; confirming deletes them and the audit log records the consent event with the typed phrase.
6. Logout and re-login: log level, telemetry preference, and destructive threshold are preserved (persisted to IndexedDB, encrypted with the master password if set).

**Reference projects:** None of the 8 reference projects ship any of these — this is a clean greenfield for Wyvern. The patterns are standard (pino, OTLP, Argon2id, DoubleSubmit CSRF, etc.).

---

## Coverage Matrix

| REQ-ID  | Phase | Title                                              |
|---------|-------|----------------------------------------------------|
| TRUST-01 | 7     | Structured audit log of every user action         |
| TRUST-02 | 7     | In-app activity feed (last 100, filterable)       |
| PERF-01  | 8     | TUS.io resumable uploads for files >50 MB         |
| PERF-02  | 8     | Parallel chunk uploads, rate-limit aware          |
| PERF-03  | 8     | Virtual scrolling for 10,000+ item directories    |
| PERF-04  | 8     | Background prefetch on folder hover (200ms debounce) |
| CRYPTO-01| 9     | AES-256-GCM encryption at rest with Argon2id KEK  |
| CRYPTO-02| 9     | Shareable encrypted archive with Argon2id passphrase |
| CRYPTO-03| 9     | Webhook URL + token encrypted at rest in IndexedDB |
| CRYPTO-04| 9     | Key zeroization on logout, re-derive on next login |
| REL-01   | 10    | Local-first: every action persists to IndexedDB first |
| REL-02   | 10    | Persistent operation queue with crash recovery    |
| REL-03   | 11    | Idempotent uploads/downloads via deterministic keys |
| REL-04   | 11    | Per-file / per-folder / full-account backup export |
| REL-05   | 11    | Disaster recovery import: `.wyvern-backup` archive |
| TRUST-03 | 11    | Background SHA-256 integrity verification         |
| TRUST-04 | 11    | Operation receipts with rollback within retention window |
| TRUST-05 | 12    | Destructive consent gate (typed confirmation)     |
| OPS-01   | 12    | Structured in-app logger with diagnostic panel    |
| OPS-02   | 12    | Optional OTLP/HTTP telemetry export (opt-in)      |
| OPS-03   | 12    | Connection health dashboard                       |
| OPS-04   | 12    | Self-test diagnostic command                      |

**Coverage:** 22 / 22 v3 requirements mapped to a phase. ✓ No orphans. No duplicates.

> **Note on REL-03 mapping:** Idempotency in the per-chunk request sense is delivered in Phase 8 (PERF-01, the TUS request idempotency). The REL-03 requirement — "every operation has a deterministic idempotency key (hash of intent)" — describes the *queue-level* idempotency contract that the persistent operation queue depends on. The full REL-03 capability (queue-level dedup of retried operations, replay safety) ships in Phase 10 alongside the queue itself. Final placement: **Phase 10**.

---

## Out of Scope Reminder

These items are explicitly deferred and not part of v3.0:

- **F-12..F-17** (v2.0 UI polish: directory browser grid/list toggle, detail side-pane, context menus, task queue, drag-reorg, keyboard shortcuts) — paused in v2.0; resume in v3.1 quick-wins or v4. Strategic reason: v3 hardens the backend core first; UI polish is a fast follower.
- **Browser extension (MV3)** — leverage feature; depends on a hardened core. v4.
- **CLI client (`npm i -g wyvern-drive`)** — same rationale. v4.
- **WebDAV server (rclone mount compatibility)** — same. v4.
- **MCP server (AI agent integration)** — niche; defer until user demand. v4+.
- **Public REST API with OpenAPI 3.1 spec** — leverage feature; defer to v4.
- **Content-addressed dedup (SHA-256 chunk hashing with refcount)** — high complexity, low immediate value. v4 or v5.
- **End-to-end encryption (server never sees plaintext key)** — conflicts with Discord's server-side processing and the per-share encryption model. Not planned.
- **Multi-tenant / team shared folders** — out of product vision (per-user webhook model). Not planned.
- **Native mobile/desktop wrappers** — web-first. Post-v4.

---

## Risk & Dependencies

- **Phase 9 (Encryption) timing risk.** Argon2id is intentionally slow (1–3 s per derivation). It must run on a Web Worker so the main thread stays responsive. If a user's hardware is too slow to hit the 3 s target, the UX suffers. Mitigation: tunable parameters in Settings; a "use faster KDF" advanced option that downgrades to scrypt or PBKDF2 with a clear warning.
- **Phase 8 (TUS) integration risk.** TUS protocol over the existing Fastify backend requires careful PATCH semantics, offset bookkeeping, and CORS handling. If the integration ships with off-by-one bugs, resumability breaks. Mitigation: extensive vitest coverage of the upload state machine; manual long-running upload + crash test before declaring the phase done.
- **Phase 11 (.wyvern-backup) format risk.** Once shipped, the format is a de-facto contract — users will have real backups. Changing v1 later is expensive. Mitigation: include a `format_version: 1` field in the manifest from day one; design the loader to refuse unknown versions with a clear error.
- **Phase 10 (persistent queue) → Phase 8 (TUS) coupling risk.** TUS is the natural carrier of a resumable upload, but the persistent queue in Phase 10 also has to know how to drive TUS. To keep the phases independently shippable, the TUS state is owned by a `TusUpload` class (Phase 8) and the queue (Phase 10) stores a `TusUpload` checkpoint in its payload, resuming by reconstructing the class from the checkpoint.
- **Phase 12 (OTLP) opt-in risk.** Telemetry is opt-in but the consent banner and Settings UI must be clear about exactly what is and isn't sent. A user who reads "telemetry" and sees chunk bytes being sent will leave and not return. Mitigation: the OTLP exporter is implemented to be a no-op until the user explicitly configures an endpoint; the consent banner shows a concrete example payload; chunk bytes and secrets are never serialized into any log or span.
- **Cross-phase regression risk.** Six phases of hardening touching the same upload/delete paths is a lot of churn on critical code. Mitigation: the v1.0 upload and delete code paths are wrapped (not rewritten) at each phase — `withAudit()` in Phase 7, `enqueue()` in Phase 10, `DestructiveConsentGate()` in Phase 12. The core path is testable in isolation at every phase boundary.
- **Discord ToS exposure (existential, not a v3 deliverable but a constant backdrop).** Storing arbitrary user data in Discord channels is a ToS grey area. The v3 work (encryption at rest, per-user webhook model, no operator bot token) reduces this exposure but does not eliminate it. The product onboarding and the README should make this trade-off explicit.

---

*Last updated: 2026-06-05 — v3.0 roadmap defined, phases 7–12 covering 22 v3 requirements across Trust / Performance / Crypto / Reliability / Operations.*
