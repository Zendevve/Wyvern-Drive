export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS nodes (
  id TEXT PRIMARY KEY,
  parent_id TEXT REFERENCES nodes(id) ON DELETE CASCADE,
  account_id TEXT NOT NULL,
  name TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('file','folder')),
  size_bytes INTEGER,
  mime_type TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nodes_account_parent
  ON nodes(account_id, parent_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_nodes_sibling
  ON nodes(account_id, IFNULL(parent_id, ''), name COLLATE NOCASE);

CREATE TABLE IF NOT EXISTS chunks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  node_id TEXT NOT NULL REFERENCES nodes(id) ON DELETE CASCADE,
  discord_message_id TEXT NOT NULL,
  "index" INTEGER NOT NULL,
  size_bytes INTEGER NOT NULL,
  cdn_url TEXT NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_chunks_order
  ON chunks(node_id, "index");
`;
