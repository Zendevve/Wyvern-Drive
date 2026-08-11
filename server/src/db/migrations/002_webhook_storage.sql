-- Migration 002: replace the bot-provisioned channel column with per-user
-- webhook credentials. The runner disables PRAGMA foreign_keys around this
-- batch (SQLite cannot toggle it inside a transaction), so the DROP+RENAME
-- rebuild below is safe even though entries/file_chunks reference drives(id).
--
-- Old channel values are preserved in legacy_discord_channel_id (never
-- auto-migrated): an operator can export those files with the pre-migration
-- bot implementation before cutover. New drives leave it null.
-- Webhook URLs are stored only as AES-256-GCM ciphertext plus nonce/auth tag.

CREATE TABLE drives_new (
  id INTEGER PRIMARY KEY,
  owner_id INTEGER UNIQUE NOT NULL REFERENCES users(id),
  legacy_discord_channel_id TEXT UNIQUE,
  webhook_ciphertext BLOB,
  webhook_nonce BLOB,
  webhook_auth_tag BLOB,
  quota_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

INSERT INTO drives_new (id, owner_id, legacy_discord_channel_id, quota_bytes, created_at)
  SELECT id, owner_id, discord_channel_id, quota_bytes, created_at FROM drives;

DROP TABLE drives;

ALTER TABLE drives_new RENAME TO drives;
