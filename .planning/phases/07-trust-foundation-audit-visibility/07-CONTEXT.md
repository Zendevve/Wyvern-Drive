# Phase 7: Trust Foundation (audit visibility) — Context

**Gathered:** 2026-06-05
**Status:** Ready for planning
**Mode:** Auto-generated (discuss skipped — ROADMAP phase goal is the spec, no user questions needed)

<domain>
## Phase Boundary

The user can see a complete, queryable history of every action they have taken in Wyvern Drive, filterable by type, time, and target. Provide a transparent, user-facing record of every state-changing operation (upload, download, delete, rename, move, share, login, settings change) for trust, debugging, and auditability.

This phase builds the audit plumbing. It does NOT do integrity verification (TRUST-03, Phase 11), operation receipts with rollback (TRUST-04, Phase 11), or destructive consent (TRUST-05, Phase 12). Audit consumers in later phases (queue, integrity, receipts) will subscribe to the events written here.

</domain>

<decisions>
## Implementation Decisions

### Locked (from PROJECT.md / REQUIREMENTS.md / ROADMAP.md)

- **TRUST-01**: Append-only `audit_log` IndexedDB store with schema `(id, action, target_id, target_type, outcome, correlation_id, metadata_json, created_at)`.
- **TRUST-02**: `Activity` sidebar entry → `ActivityPage` React route. Last 100 events. Filter by action type, time range (24h / 7d / 30d / all).
- **Audit middleware**: wraps every state-changing operation via `withAudit(correlationId, fn)`. Adds correlation ID propagation.
- **Export**: JSON + CSV download of the full log (or a filtered subset).
- **Error recording**: failed operations recorded with `outcome='error'` and error message in `metadata_json`.

### the agent's Discretion

- **Storage layer location**: This is a pure frontend system — the React SPA owns IndexedDB. The audit store lives in the same `wyvern-drive` IndexedDB database the VFS uses. No backend changes.
- **Correlation ID format**: UUIDv4 (matches ROADMAP).
- **Action taxonomy**: derive from existing action sites in the SPA (upload, download, delete, rename, move, share, login, settings change). Add a small constants file.
- **Middleware shape**: a single `withAudit()` helper that wraps an async operation. Open event written at start, close event (with outcome) written at end. This is cheaper than transaction-scoped logging.
- **Activity page virtualization**: not required for 100 events; use plain CSS scroll. If we exceed 1000 events we can add `react-window` in a follow-up.
- **Export format**: JSON pretty-printed; CSV with quoted strings; timestamp in ISO 8601.
- **Filtering UI**: top-bar with action-type dropdown + time-range buttons (24h/7d/30d/all). No search box in v1 (defer to follow-up).
- **Sidebar integration**: extend the existing v2.0 design system sidebar (Phase 4) with a new `Activity` nav item. No layout changes.
- **Tests**: vitest unit tests for the audit store; React Testing Library for the Activity page; a smoke test for export. Coverage target: 80% for the new code.

</decisions>

<code_context>
## Existing Code Insights

(Codebase context to be filled in by planner from the existing v1.0/v2.0 code.)

</code_context>

<specifics>
## Specific Ideas

None — discuss phase skipped. Use ROADMAP phase goal and success criteria as the spec.

</specifics>

<deferred>
## Deferred Ideas

- Audit log search (text search across `metadata_json`) — not in TRUST-02, defer to follow-up.
- Audit log retention policy (auto-prune after N days) — orthogonal to TRUST-01/02; defer.
- Per-user audit log partitioning (multi-user would be needed first) — out of product scope.
- Audit log export to remote syslog / SIEM — defer to OPS-02 (OTLP) in Phase 12.

</deferred>
