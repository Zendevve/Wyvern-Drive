-- Migration 005: upload outbox (pending_posts) for crash-window durability.
--
-- A packed upload batch is POSTed to Discord as ONE webhook message, then its
-- content_blocks/file_chunks rows are committed. A process crash between the
-- POST and that commit orphans the Discord message with no record. This table
-- is a durable intent ledger written BEFORE each POST:
--   message_id NULL     the POST never resolved with an id; the row is dropped
--                       by the boot/6h sweep (no message to delete).
--   message_id set      the POST completed; once the block+chunk rows commit
--                       the row is deleted inside the same transaction. A row
--                       that still exists with a message_id and NO matching
--                       content_blocks row is a crash leftover the sweep
--                       reconciles: delete the Discord message (idempotent),
--                       then drop the row.
--
-- entry_id links the row to its upload so the sweep skips rows whose upload
-- is still live (entry status 'uploading' — the block commit may be in
-- flight). It intentionally has no FOREIGN KEY and no cascade: a purged
-- upload's leftover rows must survive so the sweep can still reclaim the
-- orphaned Discord message. webhook_id has no FK either, so webhook removal
-- is never blocked by a stale intent row.

CREATE TABLE pending_posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  drive_id INTEGER NOT NULL REFERENCES drives(id),
  webhook_id INTEGER NOT NULL,
  entry_id INTEGER NOT NULL,
  message_id TEXT,
  batch_ordinal INTEGER NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
