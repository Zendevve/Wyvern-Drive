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
  for (const expected of ['users', 'drives', 'entries', 'file_chunks', 'shares', 'sessions', 'schema_migrations']) {
    assert.ok(tables.includes(expected), `missing table ${expected}`);
  }

  const indexes = (await all(db, "SELECT name FROM sqlite_master WHERE type = 'index'")).map((r) => r.name);
  for (const expected of [
    'idx_entries_drive_parent_status',
    'idx_entries_drive_updated',
    'idx_file_chunks_entry_ordinal',
    'idx_shares_token_hash',
  ]) {
    assert.ok(indexes.includes(expected), `missing index ${expected}`);
  }

  const versions = await all(db, 'SELECT version FROM schema_migrations');
  assert.deepStrictEqual(versions.map((r) => r.version), [1, 2]);

  const driveColumns = (await all(db, 'PRAGMA table_info(drives)')).map((c) => c.name);
  for (const expected of ['id', 'owner_id', 'legacy_discord_channel_id', 'webhook_ciphertext', 'webhook_nonce', 'webhook_auth_tag', 'quota_bytes', 'created_at']) {
    assert.ok(driveColumns.includes(expected), `missing drives column ${expected}`);
  }

  await closeDatabase(db);
});

test('migrate is idempotent', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);
  await migrate(db, MIGRATIONS_DIR);
  const versions = await all(db, 'SELECT version FROM schema_migrations');
  assert.strictEqual(versions.length, 2);
  await closeDatabase(db);
});

test('foreign keys are enabled and enforced', async () => {
  const db = await freshDb();
  await migrate(db, MIGRATIONS_DIR);
  const pragma = await get(db, 'PRAGMA foreign_keys');
  assert.strictEqual(pragma.foreign_keys, 1);

  const now = new Date().toISOString();
  const userRes = await run(db, 'INSERT INTO users (discord_id, username, created_at, updated_at) VALUES (?, ?, ?, ?)', ['d1', 'alice', now, now]);
  const driveRes = await run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [userRes.lastID, 100, now]);
  const entryRes = await run(db, "INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, 'folder', 'f', 'ready', ?, ?)", [driveRes.lastID, now, now]);

  await assert.rejects(
    run(db, 'INSERT INTO entries (drive_id, kind, name, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [999, 'file', 'x', 'ready', now, now]),
    /FOREIGN KEY/
  );
  await assert.rejects(
    run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [999, 100, now]),
    /FOREIGN KEY/
  );
  // ON DELETE CASCADE from entries -> file_chunks
  await run(db, 'INSERT INTO file_chunks (entry_id, ordinal, discord_message_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, checksum) VALUES (?, ?, ?, ?, ?, ?, ?, ?)', [entryRes.lastID, 0, 'm1', 8, 8, Buffer.alloc(12), Buffer.alloc(16), 'aa']);
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
  assert.deepStrictEqual(files, ['001_initial.sql', '002_webhook_storage.sql']);
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

    // Apply the real migration set (001 skipped, 002 runs).
    await migrate(db, MIGRATIONS_DIR);

    const versions = await all(db, 'SELECT version FROM schema_migrations');
    assert.deepStrictEqual(versions.map((r) => r.version), [1, 2]);

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
