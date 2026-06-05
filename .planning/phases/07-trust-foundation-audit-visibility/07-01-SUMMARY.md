# Phase 7: Trust Foundation (audit visibility) — Summary

**Shipped:** 2026-06-05
**Status:** ✅ Complete (verification passed)
**Requirements:** TRUST-01, TRUST-02
**Commit:** `5175d7f`

## What shipped

A complete audit infrastructure for the React SPA:

- **Audit store**: `wyvern-drive-audit` IndexedDB database with `audit_log` object store (3 indexes: by-created_at, by-action, by-correlation).
- **Action taxonomy**: 10 actions × 3 outcomes defined as TypeScript types with label map.
- **Audit middleware**: `withAudit(ctx, options, fn)` wraps async operations with start/end events and error capture. `newCorrelationId()` generates UUIDv4 per operation.
- **Export**: JSON (pretty-printed with ISO timestamps) and CSV (RFC-4180 escaped).
- **Activity page**: Last 100 events, filter by action type (chips) and time range (24h/7d/30d/all), export buttons. Uses react-query.
- **Sidebar nav**: New "Activity" entry with active-state indicator (matches v2.0 design system).
- **Wired into**: auth (login/logout/session_restore), uploads (start/end/manifest/cancel), deletes (start/end with manifest).

## Key design decisions

- **Native IndexedDB** (no `idb` library) — keeps dependency footprint small, matches v1.0 SPA conventions.
- **Dedicated `wyvern-drive-audit` DB** — separate from any future VFS IndexedDB usage; clean isolation; easy to wipe without affecting app data.
- **Start + end events** for each action — gives full lifecycle visibility; start indicates intent, end indicates outcome. Trade-off: 2 rows per action (see Phase 7 VERIFICATION.md SC #4 note).
- **Sync hash for `target_id` on auth events** — keeps audit writes off the async critical path; canonical account id remains in the JWT/store.
- **No backend changes** — this phase is pure frontend. The backend already has structured logging (Fastify) but doesn't need to surface to the user-facing Activity feed.

## Test coverage

- 9 new tests in `web/tests/audit.test.ts`:
  - Record event with generated id/timestamp
  - List events newest-first
  - Filter by action
  - Filter by time range
  - Respect limit
  - Count events
  - JSON output is parseable with `created_at_iso`
  - CSV output has header + one row per event
  - CSV escapes commas, quotes, newlines in metadata
  - Download is safe to call with no events
- All 42 web tests pass (33 existing + 9 new).
- TypeScript clean, build clean.

## Files

- **Created (8):** `web/src/lib/auditActions.ts`, `web/src/lib/audit.ts`, `web/src/lib/auditMiddleware.ts`, `web/src/lib/auditExport.ts`, `web/src/hooks/useActivity.ts`, `web/src/pages/ActivityPage.tsx`, `web/src/styles/activity.css`, `web/tests/audit.test.ts`
- **Modified (7):** `web/src/App.tsx`, `web/src/components/Sidebar/Sidebar.tsx`, `web/src/main.tsx`, `web/src/store/auth.ts`, `web/src/hooks/useUploader.ts`, `web/src/pages/DrivePage.tsx`, `web/tests/setup.ts`
- **Deps:** added `fake-indexeddb` to `web/package.json` devDependencies
- **Docs:** `07-CONTEXT.md`, `07-01-PLAN.md`, `07-VERIFICATION.md`, this SUMMARY

## What's next (Phase 8)

Performance Core — TUS.io resumable uploads + parallel chunks + virtual scrolling + hover prefetch. Audit events are already wired for upload lifecycle, so PERF work can build on the same `withAudit` infrastructure. The rate-limit-aware backoff in Phase 8 will write additional audit events with `outcome: 'error'` and metadata capturing the 429 response — free observability win.
