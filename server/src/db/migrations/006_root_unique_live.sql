-- Migration 006: enforce live sibling-name uniqueness at the drive root.
--
-- The migration-004 partial unique index covers (drive_id, parent_id, name)
-- for live rows, but SQLite treats NULL parent_id values as distinct, so two
-- live ROOT entries (parent_id IS NULL) could still share a name. The service
-- pre-checks via siblingCount, yet a raced mutation can slip past the check;
-- the unique indexes are the final authority, so root rows get their own
-- index. (A root entry's parent_id is always NULL, making (drive_id, name)
-- the root analogue of (drive_id, parent_id, name).)
--
-- Pre-existing duplicates: before this index existed, a race could have
-- committed two live root rows with the same name. Rather than fail startup,
-- keep the earliest row (lowest id) and rename the later duplicates to
-- "name (id)" so the index can be built without data loss.

UPDATE entries
SET name = printf('%s (%d)', name, id)
WHERE id IN (
  SELECT e.id
  FROM entries e
  WHERE e.deleted_at IS NULL
    AND e.parent_id IS NULL
    AND EXISTS (
      SELECT 1 FROM entries o
      WHERE o.drive_id = e.drive_id
        AND o.parent_id IS NULL
        AND o.deleted_at IS NULL
        AND o.name = e.name
        AND o.id < e.id
    )
);

CREATE UNIQUE INDEX idx_entries_unique_live_root
  ON entries(drive_id, name)
  WHERE deleted_at IS NULL AND parent_id IS NULL;
