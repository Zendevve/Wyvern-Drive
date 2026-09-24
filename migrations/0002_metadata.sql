CREATE TABLE vaults(
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  backend_type TEXT NOT NULL,
  state TEXT NOT NULL CHECK(state IN ('metadata_only', 'ready')),
  chunk_size INTEGER NOT NULL CHECK(chunk_size > 0),
  encrypted_vault_key BLOB,
  recovery_anchor_message_id TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  CHECK(state = 'metadata_only' OR encrypted_vault_key IS NOT NULL)
);
CREATE TABLE entries(
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  parent_id TEXT,
  kind TEXT NOT NULL CHECK(kind IN ('file', 'folder')),
  name TEXT NOT NULL,
  name_key TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('available', 'uploading', 'upload_failed', 'deleting', 'delete_failed', 'corrupt')),
  size INTEGER NOT NULL CHECK(size >= 0),
  mime_type TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  deleted_at INTEGER,
  UNIQUE(vault_id, id),
  FOREIGN KEY(vault_id, parent_id) REFERENCES entries(vault_id, id) ON DELETE RESTRICT,
  CHECK(parent_id IS NULL OR parent_id <> id)
);
CREATE UNIQUE INDEX entries_root_name_uniq ON entries(vault_id, name_key) WHERE parent_id IS NULL AND deleted_at IS NULL;
CREATE UNIQUE INDEX entries_child_name_uniq ON entries(vault_id, parent_id, name_key) WHERE parent_id IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX entries_listing_idx ON entries(vault_id, parent_id, name_key, id);
CREATE TABLE files(
  entry_id TEXT PRIMARY KEY REFERENCES entries(id) ON DELETE RESTRICT,
  wrapped_file_key BLOB NOT NULL,
  chunk_size INTEGER NOT NULL CHECK(chunk_size > 0),
  chunk_count INTEGER NOT NULL CHECK(chunk_count >= 0),
  sha256 BLOB CHECK(sha256 IS NULL OR length(sha256) = 32),
  created_at INTEGER NOT NULL
);
CREATE TABLE chunks(
  id TEXT PRIMARY KEY,
  file_entry_id TEXT NOT NULL REFERENCES files(entry_id) ON DELETE RESTRICT,
  chunk_index INTEGER NOT NULL CHECK(chunk_index >= 0),
  backend_type TEXT NOT NULL,
  message_id TEXT NOT NULL,
  attachment_id TEXT NOT NULL,
  remote_name TEXT NOT NULL,
  nonce BLOB NOT NULL CHECK(length(nonce) = 24),
  plaintext_size INTEGER NOT NULL CHECK(plaintext_size >= 0),
  ciphertext_size INTEGER NOT NULL CHECK(ciphertext_size >= 0),
  plaintext_sha256 BLOB NOT NULL CHECK(length(plaintext_sha256) = 32),
  created_at INTEGER NOT NULL,
  UNIQUE(file_entry_id, chunk_index)
);
CREATE TABLE jobs(
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK(type IN ('upload', 'download', 'delete', 'recovery_snapshot', 'restore', 'verify', 'cleanup')),
  vault_id TEXT NOT NULL REFERENCES vaults(id) ON DELETE RESTRICT,
  entry_id TEXT REFERENCES entries(id) ON DELETE RESTRICT,
  state TEXT NOT NULL CHECK(state IN ('queued', 'running', 'paused', 'interrupted', 'completed', 'failed', 'cancelled', 'source_changed', 'remote_state_unknown')),
  source_path TEXT,
  destination_path TEXT,
  bytes_total INTEGER NOT NULL CHECK(bytes_total >= 0),
  bytes_completed INTEGER NOT NULL CHECK(bytes_completed >= 0),
  items_total INTEGER NOT NULL CHECK(items_total >= 0),
  items_completed INTEGER NOT NULL CHECK(items_completed >= 0),
  error_code TEXT,
  error_message TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  started_at INTEGER,
  completed_at INTEGER,
  CHECK(bytes_completed <= bytes_total),
  CHECK(items_completed <= items_total)
);
CREATE INDEX jobs_state_created_idx ON jobs(state, created_at, id);
