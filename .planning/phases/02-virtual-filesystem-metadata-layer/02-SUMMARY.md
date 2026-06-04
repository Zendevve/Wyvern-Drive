---
phase: 02-virtual-filesystem-metadata-layer
plan: 01, 02, 03
subsystem: metadata
tags: [better-sqlite3, fastify, jwt, recursive-cte, cascade]
requires:
  - phase: 01-core-storage-engine
    provides: jwt middleware, Discord REST service, Fastify app shell
provides:
  - persistent virtual filesystem metadata layer with account isolation
  - /fs routes for folder/file CRUD, listing, chunk recording, cascade delete
  - JSON backup export and restore endpoints
affects: [03-react-spa-ui]
tech-stack:
  added: [better-sqlite3]
  patterns: [recursive-cte cascade, sibling-uniqueness with IFNULL, in-memory test db]
key-files:
  created:
    - src/db/schema.ts
    - src/db/database.ts
    - src/services/fs-repo.ts
    - src/services/cascade.ts
    - src/services/backup.ts
    - src/routes/fs.ts
    - tests/fs-repo.test.ts
    - tests/fs.test.ts
    - tests/backup.test.ts
  modified:
    - src/plugins/auth.ts
    - src/app.ts
    - .gitignore
key-decisions:
  - "accountId decoration added to FastifyRequest in plugins/auth.ts (SHA-256 of webhook URL)"
  - "Recursive CTE for descendant collection (account-scoped) supports arbitrary depth"
  - "ON DELETE CASCADE on chunks.node_id and nodes.parent_id keeps delete simple"
  - "Cascade delete calls DiscordService.deleteMessage first, then DB delete; transaction wraps DB only"
  - "Sibling uniqueness via unique index on (account_id, IFNULL(parent_id,''), name COLLATE NOCASE)"
  - "INSERT OR IGNORE for restore → idempotent re-import, duplicate IDs are skipped"
patterns-established:
  - "Pattern 3: Per-test in-memory DB passed to buildApp({db}) for fast, isolated tests"
  - "Pattern 4: app.decorate('db', instance) exposes DB to routes via app.db"
requirements-completed: [FS-01, FS-02, FS-03, FS-04, FS-05]
duration: ~25m
completed: 2026-06-04
---

# Phase 2: Virtual Filesystem Metadata Layer — Summary

**Persistent virtual filesystem with account-isolated metadata, hierarchical folder CRUD, cascade delete, and JSON backup.**

## Performance

- **Duration:** ~25m
- **Started:** 2026-06-04T19:55:00Z
- **Completed:** 2026-06-04T20:20:00Z
- **Tasks:** 12
- **Files modified:** 13

## Accomplishments

- Wired `better-sqlite3` with WAL journaling, foreign keys ON, and a single `SCHEMA_SQL` initializer.
- Defined `nodes` and `chunks` tables with proper indexes (account+parent lookup, sibling-name uniqueness with case-insensitive collation and NULL-root handling via `IFNULL`).
- Built `fs-repo` with the full CRUD surface: `createNode`, `getNode`, `listChildren`, `renameNode`, `deleteNode`, plus `recordChunks`, `getChunks`, `collectDescendantIds` (recursive CTE), `collectChunkMessageIds`, and `deleteNodes`.
- Implemented `cascadeDelete` (orchestrates Discord bulk delete + metadata delete) and `exportBackup` / `restoreBackup` services.
- Added `/fs/*` routes (`/fs/folder`, `/fs/list`, `/fs/node`, `/fs/file/created`, `/fs/backup`, `/fs/restore`) gated by the existing JWT auth pre-handler.
- Decorated the Fastify request with `accountId = SHA-256(webhookUrl)` so every repository call is account-scoped.
- Added 24 new tests across `tests/fs-repo.test.ts`, `tests/fs.test.ts`, and `tests/backup.test.ts`. Full suite is now 45/45 green.

## Files Created/Modified

- `src/db/schema.ts` — `SCHEMA_SQL` constant (tables, indexes, cascades).
- `src/db/database.ts` — `openDatabase()` helper (path resolution, directory creation, PRAGMAs, schema bootstrap).
- `src/services/fs-repo.ts` — typed repository functions + `UniqueViolationError` class.
- `src/services/cascade.ts` — `cascadeDelete` orchestration (Discord first, then DB).
- `src/services/backup.ts` — `exportBackup` / `restoreBackup` with strict validation and atomic restore.
- `src/routes/fs.ts` — `/fs/*` route handlers.
- `src/plugins/auth.ts` — added `accountId` decoration (no breaking change to existing routes).
- `src/app.ts` — `buildApp({ db? })` now accepts an optional DB instance and decorates the app.
- `.gitignore` — excludes `data/`, `*.db*`.
- Tests: `fs-repo.test.ts` (10), `fs.test.ts` (9), `backup.test.ts` (5).

## Decisions Made

- Added `accountId` to the Fastify request decoration rather than recomputing it in each route handler. This keeps repository code free of webhook-URL awareness.
- Sibling uniqueness uses `IFNULL(parent_id, '')` in the index expression so that root-level (NULL parent) names are also unique-per-account.
- `cascadeDelete` uses `db.transaction(() => deleteNodes(...))()` (sync wrapper) because better-sqlite3 transactions are synchronous. The Discord deletes are awaited *before* the transaction, so a partial Discord failure short-circuits the metadata delete.
- `restoreBackup` validates the entire payload (version, account_id, node/chunk shape) before opening a transaction, so a malformed backup returns 400 without touching the DB.
- `deletedNodes` returned by cascade reports the total descendant count (including auto-cascaded children), not the SQL `changes` count, so the response is semantically meaningful.

## Deviations from Plan

- `restoreBackup` uses `INSERT OR IGNORE` (idempotent re-import) instead of plain `INSERT` (which would fail on duplicates). The "rollback on partial insert" test was redesigned to verify a clean rejection (no inserts at all) rather than a mid-transaction rollback.

## Issues Encountered

- `parent_id IS NULL` does not match across rows in a unique index, so `Folder` and `folder` at the root did not collide. Fixed by using `IFNULL(parent_id, '')` in the index expression.
- `better-sqlite3` `db.transaction` cannot wrap an `async` function. Adjusted `cascade.ts` to do Discord deletes first (async) and wrap the metadata delete in a sync transaction.

## User Setup Required

- None — the DB file is created on first run (`./data/wyvern.db` by default, override with `DB_PATH`).

## Next Phase Readiness

- All `/fs` endpoints are ready for the React SPA to consume (Phase 3). The SPA will need the `accountId` decoration to drive breadcrumbs and listing queries.
- `accountId` is now available on every authenticated request, so client-side state can include it for optimistic UI.
