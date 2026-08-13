'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { openDatabase, closeDatabase, run, get, all, exec } = require('../src/db/connection');
const { migrate } = require('../src/db/migrate');
const { MIGRATIONS_DIR } = require('./helpers');

async function freshDb() {
  const db = await openDatabase(':memory:');
  return db;
}

test('migrate creates all tables, indexes, and the migrations ledger', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);

  const tables = (await all(db, "SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")).map((r) => r.name);
  for (const expected of ['users', 'drives', 'entries', 'file_chunks', 'content_blocks', 'webhooks', 'shares', 'sessions', 'pending_posts', 'schema_migrations']) {
    assert.ok(tables.includes(expected), `missing table ${expected}`);
  }

  const indexes = (await all(db, "SELECT name FROM sqlite_master WHERE type = 'index'")).map((r) => r.name);
  for (const expected of [
    'idx_entries_drive_parent_status',
    'idx_entries_drive_updated',
    'idx_entries_drive_upload_token',
    'idx_entries_unique_live',
    'idx_entries_unique_live_root',
    'idx_entries_deleted',
    'idx_webhooks_drive_id',
    'idx_file_chunks_entry_ordinal',
    'idx_file_chunks_block_id',
    'idx_shares_token_hash',
  ]) {
    assert.ok(indexes.includes(expected), `missing index ${expected}`);
  }

  const versions = await all(db, 'SELECT version FROM schema_migrations');
  assert.deepStrictEqual(versions.map((r) => r.version), [1, 2, 3, 4, 5, 6]);

  const driveColumns = (await all(db, 'PRAGMA table_info(drives)')).map((c) => c.name);
  for (const expected of ['id', 'owner_id', 'legacy_discord_channel_id', 'webhook_ciphertext', 'webhook_nonce', 'webhook_auth_tag', 'quota_bytes', 'created_at']) {
    assert.ok(driveColumns.includes(expected), `missing drives column ${expected}`);
  }

  const entryColumns = (await all(db, 'PRAGMA table_info(entries)')).map((c) => c.name);
  for (const expected of ['upload_token', 'expected_size_bytes', 'deleted_at']) {
    assert.ok(entryColumns.includes(expected), `missing entries column ${expected}`);
  }

  await closeDatabase(db);
});

test('migrate is idempotent', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);
  await migrate(db, MIGRATIONS_DIR);
  const versions = await all(db, 'SELECT version FROM schema_migrations');
  assert.strictEqual(versions.length, 6);
  await closeDatabase(db);
});

test('file-backed databases open in WAL journal mode (crash-window durability)', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-wal-'));
  const dbUrl = path.join(dir, 'wal.db');
  try {
    const db = await openDatabase(dbUrl);
    const mode = await get(db, 'PRAGMA journal_mode');
    assert.strictEqual(mode.journal_mode, 'wal', 'journal_mode must be WAL for file-backed databases');
    // A table written under WAL is durable and readable after reopen.
    await run(db, 'CREATE TABLE probe (id INTEGER PRIMARY KEY, v TEXT)');
    await run(db, 'INSERT INTO probe (v) VALUES (?)', ['wal-durable']);
    await closeDatabase(db);

    const reopened = await openDatabase(dbUrl);
    const row = await get(reopened, 'SELECT v FROM probe WHERE id = 1');
    assert.strictEqual(row.v, 'wal-durable');
    await closeDatabase(reopened);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('foreign keys are enabled and enforced', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);
  const pragma = await get(db, 'PRAGMA foreign_keys');
  assert.strictEqual(pragma.foreign_keys, 1);

  const now = new Date().toISOString();
  const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
  const driveRes = await run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [userRes.lastID, 100, now]);
  const webhookRes = await run(db, 'INSERT INTO webhooks (drive_id, webhook_ciphertext, webhook_nonce, webhook_auth_tag, created_at) VALUES (?, ?, ?, ?, ?)', [driveRes.lastID, Buffer.from('c'), Buffer.from('n'), Buffer.from('t'), now]);
  const entryRes = await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'folder', 'f', 'ready', ?, ?)", [driveRes.lastID, now, now]);
  const blockRes = await run(db, "INSERT INTO content_blocks (drive_id, content_hash, message_id, webhook_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, compression, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'none', ?)", [driveRes.lastID, 'aa', 'm1', webhookRes.lastID, 8, 8, Buffer.alloc(12), Buffer.alloc(16), now]);

  await assert.rejects(
    run(db, 'INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [999, 'file', 'x', 'ready', now, now]),
    /FOREIGN KEY/
  );
  await assert.rejects(
    run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [999, 100, now]),
    /FOREIGN KEY/
  );
  await assert.rejects(
    run(db, 'INSERT INTO webhooks (drive_id, webhook_ciphertext, webhook_nonce, webhook_auth_tag, created_at) VALUES (?, ?, ?, ?, ?)', [999, Buffer.from('c'), Buffer.from('n'), Buffer.from('t'), now]),
    /FOREIGN KEY/
  );
  // Chunk rows are pure joins; an entry_id or block_id without a parent row fails.
  await assert.rejects(
    run(db, 'INSERT INTO file_chunks (entry_id, ordinal, block_id) VALUES (?, ?, ?)', [999, 0, blockRes.lastID]),
    /FOREIGN KEY/
  );
  await assert.rejects(
    run(db, 'INSERT INTO file_chunks (entry_id, ordinal, block_id) VALUES (?, ?, ?)', [entryRes.lastID, 0, 999]),
    /FOREIGN KEY/
  );
  // ON DELETE CASCADE from entries -> file_chunks
  await run(db, 'INSERT INTO file_chunks (entry_id, ordinal, block_id) VALUES (?, ?, ?)', [entryRes.lastID, 0, blockRes.lastID]);
  await run(db, 'DELETE FROM entries WHERE id = ?', [entryRes.lastID]);
  const chunks = await all(db, 'SELECT * FROM file_chunks WHERE entry_id = ?', [entryRes.lastID]);
  assert.strictEqual(chunks.length, 0);
  await closeDatabase(db);
});

test('UNIQUE(drive_id, parent_id, name) rejects duplicate siblings under a parent', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);
  const now = new Date().toISOString();
  const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
  const driveRes = await run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [userRes.lastID, 100, now]);
  const parentRes = await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'folder', 'f', 'ready', ?, ?)", [driveRes.lastID, now, now]);
  await run(db, "INSERT INTO entries (drive_id, parent_id, kind, name, status, created_at, updated_at) VALUES (?, ?, 'file', 'dup', 'ready', ?, ?)", [driveRes.lastID, parentRes.lastID, now, now]);
  await assert.rejects(
    run(db, "INSERT INTO entries (drive_id, parent_id, kind, name, status, created_at, updated_at) VALUES (?, ?, 'file', 'dup', 'ready', ?, ?)", [driveRes.lastID, parentRes.lastID, now, now]),
    /UNIQUE/
  );
  await closeDatabase(db);
});

test('migration 006: live drive-root entries are name-unique too (NULL parent_id)', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);
  const now = new Date().toISOString();
  const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
  const driveRes = await run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [userRes.lastID, 100, now]);
  // Two LIVE root rows with the same name conflict (the partial index is over
  // live rows; SQLite treats NULL parent_id as distinct, so the root has its
  // own (drive_id, name) index from migration 006).
  await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'file', 'root-dup', 'ready', ?, ?)", [driveRes.lastID, now, now]);
  await assert.rejects(
    run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'file', 'root-dup', 'ready', ?, ?)", [driveRes.lastID, now, now]),
    /UNIQUE/
  );
  // A trashed root row does NOT occupy the name.
  await run(db, "INSERT INTO entries (drive_id, kind, name, status, deleted_at, created_at, updated_at) VALUES (?, 'file', 'root-trash', 'ready', ?, ?, ?)", [driveRes.lastID, now, now, now]);
  await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'file', 'root-trash', 'ready', ?, ?)", [driveRes.lastID, now, now]);
  await closeDatabase(db);
});

test('a failed migration aborts and rolls back cleanly', async () => {
  const db = await freshDb();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-migrate-'));
  try {
    fs.writeFileSync(path.join(dir, '001_bad.sql'), 'CREATE TABLE broken (id INTEGER PRIMARY KEY;\nSELECT * FROM nowhere;');
    await assert.rejects(migrate(db, dir), /migration 001_bad.sql failed/);
    const versions = await all(db, 'SELECT version FROM schema_migrations');
    assert.strictEqual(versions.length, 0);
    const tables = await all(db, "SELECT name FROM sqlite_master WHERE name = 'broken'");
    assert.strictEqual(tables.length, 0);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeDatabase(db);
  }
});

test('migrations directory contains only the numbered migrations', () => {
  const files = fs.readdirSync(MIGRATIONS_DIR).filter((f) => f.endsWith('.sql')).sort();
  assert.deepStrictEqual(files, ['001_initial.sql', '002_webhook_storage.sql', '003_add_upload_resume.sql', '004_block_store_trash.sql', '005_pending_posts.sql', '006_root_unique_live.sql']);
});

test('migration 002 rebuilds drives: legacy channel preserved, webhook columns added, foreign keys intact', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-migrate-v1-'));
  const db = await freshDb();
  try {
    // Apply only 001, then insert a bot-era drive with a channel.
    fs.copyFileSync(path.join(MIGRATIONS_DIR, '001_initial.sql'), path.join(dir, '001_initial.sql'));
    await migrate(db, dir);
    const now = new Date().toISOString();
    const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
    const driveRes = await run(db, 'INSERT INTO drives (owner_id, discord_channel_id, quota_bytes, created_at) VALUES (?, ?, ?, ?)', [userRes.lastID, 'ch-legacy-1', 100, now]);
    await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'file', 'old.bin', 'ready', ?, ?)", [driveRes.lastID, now, now]);

    // Apply the real migration set (001 skipped, 002 and 003 run).
    await migrate(db, MIGRATIONS_DIR);

    const versions = await all(db, 'SELECT version FROM schema_migrations');
    assert.deepStrictEqual(versions.map((r) => r.version), [1, 2, 3, 4, 5, 6]);

    const drive = await get(db, 'SELECT * FROM drives WHERE id = ?', [driveRes.lastID]);
    assert.strictEqual(drive.legacy_discord_channel_id, 'ch-legacy-1', 'old channel value must be preserved');
    assert.strictEqual(drive.webhook_ciphertext, null);
    assert.strictEqual(drive.webhook_nonce, null);
    assert.strictEqual(drive.webhook_auth_tag, null);
    assert.strictEqual(drive.quota_bytes, 100);
    assert.strictEqual(drive.owner_id, userRes.lastID);

    // Existing rows and relationships survive the rebuild.
    const entry = await get(db, "SELECT * FROM entries WHERE drive_id = ? AND name = 'old.bin'", [driveRes.lastID]);
    assert.ok(entry, 'entry rows must survive the drives rebuild');

    // Fresh drives leave legacy_discord_channel_id null.
    const user2Res = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d2', 'bob', now, now]);
    const freshRes = await run(db, 'INSERT INTO drives (owner_id, webhook_ciphertext, webhook_nonce, webhook_auth_tag, quota_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)', [user2Res.lastID, Buffer.from('cipher'), Buffer.from('nonce'), Buffer.from('tag'), 200, now]);
    const fresh = await get(db, 'SELECT * FROM drives WHERE id = ?', [freshRes.lastID]);
    assert.strictEqual(fresh.legacy_discord_channel_id, null);

    // Post-migration FK invariant holds and is enforced.
    const pragma = await get(db, 'PRAGMA foreign_keys');
    assert.strictEqual(pragma.foreign_keys, 1);
    await assert.rejects(
      run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [999, 100, now]),
      /FOREIGN KEY/
    );
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeDatabase(db);
  }
});

test('migration 003 adds upload-resume columns and the partial index without data loss', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-migrate-v2-'));
  const db = await freshDb();
  try {
    // Apply 001 + 002 only, then seed a drive and a file row.
    fs.copyFileSync(path.join(MIGRATIONS_DIR, '001_initial.sql'), path.join(dir, '001_initial.sql'));
    fs.copyFileSync(path.join(MIGRATIONS_DIR, '002_webhook_storage.sql'), path.join(dir, '002_webhook_storage.sql'));
    await migrate(db, dir);
    const now = new Date().toISOString();
    const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
    const driveRes = await run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [userRes.lastID, 100, now]);
    const entryRes = await run(db, "INSERT INTO entries (drive_id, kind, name, size_bytes, mime_type, status, created_at, updated_at) VALUES (?, 'file', 'old.bin', 8, 'application/octet-stream', 'ready', ?, ?)", [driveRes.lastID, now, now]);

    // Apply the real migration set (001/002 skipped, 003 runs).
    await migrate(db, MIGRATIONS_DIR);

    const versions = await all(db, 'SELECT version FROM schema_migrations');
    assert.deepStrictEqual(versions.map((r) => r.version), [1, 2, 3, 4, 5, 6]);

    // New columns exist and existing rows keep their data.
    const entry = await get(db, 'SELECT * FROM entries WHERE id = ?', [entryRes.lastID]);
    assert.strictEqual(entry.name, 'old.bin', 'existing rows survive migration 003');
    assert.strictEqual(entry.upload_token, null);
    assert.strictEqual(entry.expected_size_bytes, null);

    // Token lookups are indexed.
    const idx = await all(db, "SELECT name FROM sqlite_master WHERE type = 'index' AND name = 'idx_entries_drive_upload_token'");
    assert.strictEqual(idx.length, 1, 'partial upload_token index must exist');

    // Writing and querying a token round-trips.
    await run(db, 'UPDATE entries SET upload_token = ?, expected_size_bytes = ? WHERE id = ?', ['tok-1', 1024, entryRes.lastID]);
    const byToken = await get(db, 'SELECT * FROM entries WHERE drive_id = ? AND upload_token = ?', [driveRes.lastID, 'tok-1']);
    assert.strictEqual(byToken.id, entryRes.lastID);
    assert.strictEqual(byToken.expected_size_bytes, 1024);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeDatabase(db);
  }
});

test('schema constrains kind/status values', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);
  const now = new Date().toISOString();
  const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
  const driveRes = await run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [userRes.lastID, 100, now]);
  await assert.rejects(
    run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'symlink', 'x', 'ready', ?, ?)", [driveRes.lastID, now, now]),
    /CHECK/
  );
  await assert.rejects(
    run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'file', 'x', 'limbo', ?, ?)", [driveRes.lastID, now, now]),
    /CHECK/
  );
  await closeDatabase(db);
});

test('migration 004 backfills webhooks, dedups blocks, and rebuilds chunk rows', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-migrate-v3-'));
  const db = await freshDb();
  try {
    // Apply 001 + 002 + 003, then seed a drive with legacy credential columns
    // and two files sharing one content chunk (plus one unique chunk).
    fs.copyFileSync(path.join(MIGRATIONS_DIR, '001_initial.sql'), path.join(dir, '001_initial.sql'));
    fs.copyFileSync(path.join(MIGRATIONS_DIR, '002_webhook_storage.sql'), path.join(dir, '002_webhook_storage.sql'));
    fs.copyFileSync(path.join(MIGRATIONS_DIR, '003_add_upload_resume.sql'), path.join(dir, '003_add_upload_resume.sql'));
    await migrate(db, dir);
    const now = new Date().toISOString();
    const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
    const driveRes = await run(db, 'INSERT INTO drives (owner_id, webhook_ciphertext, webhook_nonce, webhook_auth_tag, quota_bytes, created_at) VALUES (?, ?, ?, ?, ?, ?)', [userRes.lastID, Buffer.from('cipher'), Buffer.from('nonce'), Buffer.from('tag'), 100, now]);
    const aRes = await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'file', 'a.bin', 'ready', ?, ?)", [driveRes.lastID, now, now]);
    const bRes = await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'file', 'b.bin', 'ready', ?, ?)", [driveRes.lastID, now, now]);
    // a.bin: two chunks (shared hash + unique hash); b.bin: one chunk sharing
    // the first hash. The old schema stored per-chunk message/ciphertext.
    await run(db, "INSERT INTO file_chunks (entry_id, ordinal, discord_message_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, checksum) VALUES (?, ?, 'm-shared', 8, 8, ?, ?, 'hash-shared')", [aRes.lastID, 0, Buffer.alloc(12), Buffer.alloc(16)]);
    await run(db, "INSERT INTO file_chunks (entry_id, ordinal, discord_message_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, checksum) VALUES (?, ?, 'm-uniq', 8, 8, ?, ?, 'hash-uniq')", [aRes.lastID, 1, Buffer.alloc(12), Buffer.alloc(16)]);
    await run(db, "INSERT INTO file_chunks (entry_id, ordinal, discord_message_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, checksum) VALUES (?, ?, 'm-shared2', 8, 8, ?, ?, 'hash-shared')", [bRes.lastID, 0, Buffer.alloc(12), Buffer.alloc(16)]);

    // Apply the real migration set (001-003 skipped, 004 runs).
    await migrate(db, MIGRATIONS_DIR);

    const versions = await all(db, 'SELECT version FROM schema_migrations');
    assert.deepStrictEqual(versions.map((r) => r.version), [1, 2, 3, 4, 5, 6]);

    // Webhook row backfilled 1:1 from the drive credential columns.
    const webhooks = await all(db, 'SELECT * FROM webhooks');
    assert.strictEqual(webhooks.length, 1);
    assert.deepStrictEqual(webhooks[0].webhook_ciphertext, Buffer.from('cipher'));
    assert.strictEqual(webhooks[0].drive_id, driveRes.lastID);

    // Blocks dedup by (drive_id, content_hash): two distinct hashes only.
    const blocks = await all(db, 'SELECT * FROM content_blocks ORDER BY content_hash');
    assert.strictEqual(blocks.length, 2);
    const byHash = new Map(blocks.map((b) => [b.content_hash, b]));
    assert.ok(byHash.has('hash-shared'));
    assert.ok(byHash.has('hash-uniq'));
    const shared = byHash.get('hash-shared');
    assert.strictEqual(shared.compression, 'none', 'backfilled blocks are uncompressed');
    assert.strictEqual(shared.webhook_id, webhooks[0].id);
    assert.strictEqual(shared.plain_size_bytes, 8);

    // Chunk rows are pure joins onto the deduped blocks: the shared-hash
    // chunk of both files points at the SAME block row.
    const aChunks = await all(db, 'SELECT entry_id, ordinal, block_id FROM file_chunks WHERE entry_id = ? ORDER BY ordinal', [aRes.lastID]);
    assert.deepStrictEqual(
      aChunks.map((c) => c.block_id),
      [shared.id, byHash.get('hash-uniq').id]
    );
    const bChunks = await all(db, 'SELECT entry_id, ordinal, block_id FROM file_chunks WHERE entry_id = ?', [bRes.lastID]);
    assert.strictEqual(bChunks[0].block_id, shared.id, 'same block shared by both files');

    // The partial unique index lets a trashed entry share a name with a live one.
    await run(db, "INSERT INTO entries (drive_id, parent_id, kind, name, status, deleted_at, created_at, updated_at) VALUES (?, NULL, 'file', 'same', 'ready', ?, ?, ?)", [driveRes.lastID, now, now, now]);
    await run(db, "INSERT INTO entries (drive_id, parent_id, kind, name, status, deleted_at, created_at, updated_at) VALUES (?, NULL, 'file', 'same', 'ready', NULL, ?, ?)", [driveRes.lastID, now, now]);
    // Two LIVE siblings under one folder still conflict (the index is over
    // live rows; a real parent id, since NULLs are distinct in SQLite).
    const folderRes = await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'folder', 'f', 'ready', ?, ?)", [driveRes.lastID, now, now]);
    await run(db, "INSERT INTO entries (drive_id, parent_id, kind, name, status, deleted_at, created_at, updated_at) VALUES (?, ?, 'file', 'dup', 'ready', NULL, ?, ?)", [driveRes.lastID, folderRes.lastID, now, now]);
    await assert.rejects(
      run(db, "INSERT INTO entries (drive_id, parent_id, kind, name, status, deleted_at, created_at, updated_at) VALUES (?, ?, 'file', 'dup', 'ready', NULL, ?, ?)", [driveRes.lastID, folderRes.lastID, now, now]),
      /UNIQUE/
    );
    // A trashed sibling under the same folder does NOT conflict.
    await run(db, "INSERT INTO entries (drive_id, parent_id, kind, name, status, deleted_at, created_at, updated_at) VALUES (?, ?, 'file', 'dup', 'ready', ?, ?, ?)", [driveRes.lastID, folderRes.lastID, now, now, now]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
    await closeDatabase(db);
  }
});
