# Phase 2: Virtual Filesystem Metadata Layer - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning
**Mode:** Autonomous smart-discuss (yolo)

<domain>
## Phase Boundary

File tree database using SQLite, directory hierarchy CRUD, account isolation by hashed webhook, cascade delete of folders (metadata + Discord messages), and backup metadata export/import as JSON. The storage engine (Phase 1) already handles chunked upload/download/delete at the message level; this phase adds the metadata layer that maps logical file/folder names to Discord message chunks.

</domain>

<decisions>
## Implementation Decisions

### SQLite Schema Layout
- **D-01:** Two tables — `nodes` (unified rows for files and folders) and `chunks` (per-message descriptors).
- **D-02:** `nodes` columns: `id` (TEXT PK, UUID v4), `parent_id` (TEXT FK → nodes.id, NULL for root), `account_id` (TEXT, NOT NULL — SHA-256 hex of webhook URL), `name` (TEXT, NOT NULL), `kind` (TEXT CHECK in ('file','folder')), `size_bytes` (INTEGER, NULL for folders), `mime_type` (TEXT, NULL for folders), `created_at` (INTEGER, ms epoch), `updated_at` (INTEGER, ms epoch). Indexes on `(account_id, parent_id)` and `(account_id, name)` for listing and uniqueness.
- **D-03:** `chunks` columns: `id` (TEXT PK, autoincrement), `node_id` (TEXT FK → nodes.id ON DELETE CASCADE), `discord_message_id` (TEXT, NOT NULL), `index` (INTEGER, NOT NULL), `size_bytes` (INTEGER, NOT NULL), `cdn_url` (TEXT, NOT NULL). Unique index on `(node_id, "index")` to guarantee chunk ordering.

### Account Isolation
- **D-04:** Every read and write is filtered by `account_id` derived in the existing JWT auth middleware (Phase 1) by `SHA-256(webhookUrl).hex()`. There is no API path that can read or write a row whose `account_id` does not match the request's `account_id`. The `account_id` is added as a `request.accountId` decoration in `src/plugins/auth.ts` and consumed in repository functions.

### Hierarchical Path Representation
- **D-05:** Materialize hierarchy via `parent_id` adjacency (single FK). Listing a folder executes `SELECT … WHERE account_id=? AND parent_id=?`. No materialized `path` column; the agent computes breadcrumbs client-side or by walking parents on demand. Adjacency keeps writes simple and avoids re-parenting cascades.

### Folder Uniqueness & Name Handling
- **D-06:** Enforce uniqueness of sibling names via composite unique index `(account_id, parent_id, name)`. Sibling names are case-insensitive (case-sensitive compare lowered in code). Reserved names (`""`, `.`, `..`) are rejected at the route layer. Trailing whitespace and path separators are stripped from `name` on insert.

### Cascade Delete Strategy
- **D-07:** Folder delete is a transaction: (1) recursively collect descendant `node_id`s via recursive CTE bounded by `account_id`; (2) collect all `discord_message_id`s for those nodes; (3) call `DiscordService.deleteChunk` (Phase 1) concurrently with limit 3 for each; (4) `DELETE FROM nodes WHERE id IN (…)` — `ON DELETE CASCADE` on `chunks.node_id` removes chunk rows. Both metadata cleanup and Discord cleanup occur; if Discord deletes partially fail, the metadata delete is rolled back and the route returns 500 so the client can retry.

### Backup Format (Export/Import)
- **D-08:** JSON shape: `{ "version": 1, "account_id": "<sha256-hex>", "exported_at": <ms-epoch>, "nodes": [ {…node row…} ], "chunks": [ {…chunk row…} ] }`. Import is all-or-nothing: parse → validate `version === 1` and `account_id` matches the requester → BEGIN → INSERT OR IGNORE all nodes and chunks → COMMIT. Import never writes to another `account_id`.

### API Surface
- **D-09:** Routes registered under `/fs` (mounted by `src/routes/fs.ts`):
  - `POST /fs/folder` — body `{ parent_id: string|null, name: string }` → returns folder row.
  - `GET  /fs/list`  — query `parent_id` (omit for root) → returns `{ items: Node[] }`.
  - `GET  /fs/node`  — query `id` → returns the node plus ordered `chunks` array.
  - `PATCH /fs/node` — body `{ id, name? }` → renames; validates sibling uniqueness.
  - `DELETE /fs/node` — body `{ id }` → cascade deletes node + chunks (uses Phase 1 delete service for Discord messages).
  - `GET  /fs/backup` → returns the export JSON for the requester's `account_id`.
  - `POST /fs/restore` — body `{ backup: <JSON> }` → all-or-nothing import.
- **D-10:** All `/fs/*` routes are gated by the existing `verifyJwt` pre-handler from Phase 1 so `request.webhookUrl` and `request.accountId` are populated.

### Concurrency & Locking
- **D-11:** Use `better-sqlite3` (already in `package.json`) with synchronous transactions. Since Node.js is single-threaded, no row-level locking is needed beyond `BEGIN IMMEDIATE` for multi-statement writes (folder create + initial chunks, cascade delete, import).

### Error Responses
- **D-12:** Validation errors → 400 with `{ error, code, details? }`. Not-found → 404. Conflict (sibling name taken) → 409. Cascade delete partial failure → 500 with the list of `discord_message_id`s that failed so the client can retry safely.

### the agent's Discretion
- Exact route prefix mounting, internal repository class/file layout (e.g., `src/services/fs-repo.ts`), and whether to expose breadcrumbs as a derived field on the node response.
- Migration strategy for future schema changes (a `schema_version` table row is recommended but not required by this phase).
- The agent may add helper middleware for JSON-body size limits on `/fs/restore` if needed.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Specifications
- `.planning/PROJECT.md` — Core value proposition, stateless JWT constraint, account isolation principle.
- `.planning/REQUIREMENTS.md` — Functional specifications for `FS-01` … `FS-05`.
- `.planning/ROADMAP.md` — Phase 2 success criteria and mapped requirements.
- `.planning/phases/01-core-storage-engine/01-CONTEXT.md` — Phase 1 decisions (`D-04` JWT/sha256 account derivation, `D-01`/`D-02` stack).
- `.planning/phases/01-core-storage-engine/01-SUMMARY.md` — Phase 1 file layout, key files, and what API/storage is already provided.

### Reuse from Phase 1
- `src/plugins/auth.ts` — `verifyJwt` pre-handler; populates `request.webhookUrl` and `request.accountId`.
- `src/services/discord.ts` — `DiscordService.deleteChunk`, `uploadChunk`, `fetchMessage`. Phase 2 only needs `deleteChunk` for cascade delete.
- `src/app.ts` — Fastify app builder; mount new routes here.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `src/plugins/auth.ts` (Phase 1) — `verifyJwt` pre-handler adds `request.webhookUrl` and `request.accountId`. Reuse for all `/fs/*` routes.
- `src/services/discord.ts` (Phase 1) — `DiscordService` already exposes `deleteChunk` for bulk delete; reuse in cascade delete.
- `better-sqlite3` (already a dependency in `package.json`) — Phase 1 left it for "future use" (i.e., this phase).

### Established Patterns
- Fastify plugin/middleware pattern (see `src/plugins/auth.ts`).
- Route registration in `src/routes/*.ts` and mounted by `src/app.ts`.
- Vitest + `app.inject()` for integration tests, with `tests/setup.ts` providing shared config.
- `tsconfig.json` is strict-mode; all new code must be fully typed.

### Integration Points
- New routes mount under `/fs` in `src/app.ts`.
- New repository code lives in `src/services/fs-repo.ts`.
- New SQLite schema lives in `src/db/schema.sql` or in code as a `CREATE TABLE IF NOT EXISTS` block invoked at app start.
- New tests live in `tests/fs.test.ts`.

</code_context>

<specifics>
## Specific Ideas

- The DB file path should default to `./data/wyvern.db` and be overridable via `DB_PATH` env var. The directory is created on startup if missing.
- Backup export should be a single JSON download (`Content-Disposition: attachment; filename="wyvern-backup-<accountId8>.json"`).
- Cascade delete must walk descendants via a recursive CTE (so a folder containing 10k files is not loaded into memory all at once — process in batches of 100 Discord message IDs).
- Tests must mock `DiscordService.deleteChunk` so that the test suite does not hit the real Discord API.

</specifics>

<deferred>
## Deferred Ideas

- File move/rename across folders (re-parenting) — could be added later as a separate phase.
- Search and tag-based listing — out of scope; only direct parent listings are supported.
- Sharing / multi-user folders — explicitly out of scope per PROJECT.md.
- Trash / soft-delete — out of scope; deletes are immediate.

</deferred>

---

*Phase: 02-virtual-filesystem-metadata-layer*
*Context gathered: 2026-06-04 (autonomous)*
