-- Migration 004: content-addressed block store, multi-webhook, recycle bin.
--
-- Storage moves from "every chunk row carries its own Discord message id and
-- ciphertext" to a shared block store:
--   webhooks        one row per Discord webhook credential per drive. Chunks
--                   reference their webhook through content_blocks, so a drive
--                   can fan uploads across several webhooks.
--   content_blocks  one row per unique stored chunk per drive. The dedup key
--                   is content_hash = sha256 of the bytes that are ENCRYPTED,
--                   i.e. the pre-encryption stored bytes: the zlib-deflated
--                   form when compression='deflate', else the plaintext.
--                   Identical content deflates to identical bytes, so dedup
--                   survives compression. plain_size_bytes is the UNCOMPRESSED
--                   plaintext size (drives HTTP Range math); cipher_size_bytes
--                   is the encrypted size. Read-time integrity is
--                   decrypt -> sha256(decrypted) == content_hash.
--   file_chunks     rebuilt as a pure join (entry -> ordinal -> block); the
--                   old per-chunk message/ciphertext columns move to
--                   content_blocks.
--   entries.deleted_at  soft delete for the recycle bin. The table-level
--                   UNIQUE(drive_id,parent_id,name) is replaced by a partial
--                   unique index over live rows, so a trashed entry and a new
--                   live entry may share a name.
--
-- Backfills: drives.webhook_* rows become webhooks 1:1; chunk rows are
-- INSERT OR IGNORE'd into content_blocks by (drive_id, content_hash), which
-- dedups same-content chunks within a drive. A hash-duplicate chunk's own
-- Discord message becomes an unreferenced orphan (accepted: that message is
-- the dedup feature's cost, and purging it would race concurrent uploads).
-- Chunks of webhook-less drives (the legacy bot era, which the app refuses to
-- serve) produce no block and their file_chunks rows drop out of the rebuild;
-- their data lived in bot channels, exported by the operator pre-cutover.
--
-- The legacy drives.webhook_* columns stay in the schema (like
-- legacy_discord_channel_id) but no code path reads or writes them after this
-- migration.

CREATE TABLE webhooks (
  id INTEGER PRIMARY KEY,
  drive_id INTEGER NOT NULL REFERENCES drives(id),
  webhook_ciphertext BLOB NOT NULL,
  webhook_nonce BLOB NOT NULL,
  webhook_auth_tag BLOB NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX idx_webhooks_drive_id ON webhooks(drive_id);

INSERT INTO webhooks (drive_id, webhook_ciphertext, webhook_nonce, webhook_auth_tag, created_at)
  SELECT id, webhook_ciphertext, webhook_nonce, webhook_auth_tag, created_at
  FROM drives
  WHERE webhook_ciphertext IS NOT NULL;

CREATE TABLE content_blocks (
  id INTEGER PRIMARY KEY,
  drive_id INTEGER NOT NULL REFERENCES drives(id),
  content_hash TEXT NOT NULL,
  message_id TEXT NOT NULL,
  webhook_id INTEGER NOT NULL REFERENCES webhooks(id),
  plain_size_bytes INTEGER NOT NULL,
  cipher_size_bytes INTEGER NOT NULL,
  nonce BLOB NOT NULL,
  auth_tag BLOB NOT NULL,
  compression TEXT NOT NULL DEFAULT 'none' CHECK(compression IN ('none','deflate')),
  created_at TEXT NOT NULL,
  UNIQUE(drive_id, content_hash)
);

INSERT OR IGNORE INTO content_blocks (drive_id, content_hash, message_id, webhook_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, compression, created_at)
  SELECT e.drive_id, c.checksum, c.discord_message_id,
         (SELECT w.id FROM webhooks w WHERE w.drive_id = e.drive_id ORDER BY w.id LIMIT 1),
         c.plain_size_bytes, c.cipher_size_bytes, c.nonce, c.auth_tag, 'none',
         strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
  FROM file_chunks c
  JOIN entries e ON e.id = c.entry_id;

CREATE TABLE file_chunks_new (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  block_id INTEGER NOT NULL REFERENCES content_blocks(id),
  deleted_at TEXT,
  UNIQUE(entry_id, ordinal)
);

INSERT INTO file_chunks_new (id, entry_id, ordinal, block_id, deleted_at)
  SELECT c.id, c.entry_id, c.ordinal, b.id, c.deleted_at
  FROM file_chunks c
  JOIN entries e ON e.id = c.entry_id
  JOIN content_blocks b ON b.drive_id = e.drive_id AND b.content_hash = c.checksum;

DROP TABLE file_chunks;
ALTER TABLE file_chunks_new RENAME TO file_chunks;
CREATE INDEX idx_file_chunks_entry_ordinal ON file_chunks(entry_id, ordinal);
CREATE INDEX idx_file_chunks_block_id ON file_chunks(block_id);

CREATE TABLE entries_new (
  id INTEGER PRIMARY KEY,
  drive_id INTEGER NOT NULL REFERENCES drives(id),
  parent_id INTEGER REFERENCES entries(id),
  kind TEXT NOT NULL CHECK(kind IN ('file','folder')),
  name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  status TEXT NOT NULL CHECK(status IN ('uploading','ready','failed','deleting')),
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  upload_token TEXT,
  expected_size_bytes INTEGER
);

INSERT INTO entries_new (id, drive_id, parent_id, kind, name, size_bytes, mime_type, status, deleted_at, created_at, updated_at, upload_token, expected_size_bytes)
  SELECT id, drive_id, parent_id, kind, name, size_bytes, mime_type, status, NULL, created_at, updated_at, upload_token, expected_size_bytes
  FROM entries;

DROP TABLE entries;
ALTER TABLE entries_new RENAME TO entries;
CREATE INDEX idx_entries_drive_parent_status ON entries(drive_id, parent_id, status);
CREATE INDEX idx_entries_drive_updated ON entries(drive_id, updated_at);
CREATE INDEX idx_entries_drive_upload_token ON entries(drive_id, upload_token) WHERE upload_token IS NOT NULL;
CREATE UNIQUE INDEX idx_entries_unique_live ON entries(drive_id, parent_id, name) WHERE deleted_at IS NULL;
CREATE INDEX idx_entries_deleted ON entries(drive_id, deleted_at);
