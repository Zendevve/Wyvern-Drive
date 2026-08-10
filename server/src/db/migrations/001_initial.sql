PRAGMA foreign_keys = ON;

CREATE TABLE users (
  id INTEGER PRIMARY KEY,
  discord_id TEXT UNIQUE NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE drives (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  discord_channel_id TEXT UNIQUE NOT NULL,
  quota_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE entries (
  id INTEGER PRIMARY KEY,
  drive_id INTEGER NOT NULL REFERENCES drives(id),
  parent_id INTEGER REFERENCES entries(id),
  kind TEXT NOT NULL CHECK(kind IN ('file','folder')),
  name TEXT NOT NULL,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT,
  status TEXT NOT NULL CHECK(status IN ('uploading','ready','failed','deleting')),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(drive_id,parent_id,name)
);

CREATE TABLE file_chunks (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  ordinal INTEGER NOT NULL,
  discord_message_id TEXT NOT NULL,
  plain_size_bytes INTEGER NOT NULL,
  cipher_size_bytes INTEGER NOT NULL,
  nonce BLOB NOT NULL,
  auth_tag BLOB NOT NULL,
  checksum TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE(entry_id,ordinal)
);

CREATE TABLE shares (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES entries(id) ON DELETE CASCADE,
  token_hash TEXT UNIQUE NOT NULL,
  created_by INTEGER NOT NULL REFERENCES users(id),
  expires_at TEXT,
  revoked_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE sessions (
  id INTEGER PRIMARY KEY,
  token_hash TEXT UNIQUE NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX idx_entries_drive_parent_status ON entries(drive_id, parent_id, status);
CREATE INDEX idx_entries_drive_updated ON entries(drive_id, updated_at);
CREATE INDEX idx_file_chunks_entry_ordinal ON file_chunks(entry_id, ordinal);
CREATE INDEX idx_shares_token_hash ON shares(token_hash);
