'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile, dbRun } = require('./helpers');

let ctx;
let client;

before(async () => {
  ctx = await startTestServer(); // default trashRetentionDays = 30
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);
});

after(() => ctx.close());

/**
 * Replicates index.js's boot retention sweep: list every drive id, then purge
 * each drive's expired trash. The sweep is fire-and-forget in production; the
 * test drives it directly so failures are observable.
 */
async function runBootSweep(c) {
  const driveIds = await c.repositories.listDriveIds();
  for (const { id } of driveIds) {
    const drive = await c.repositories.getDriveById(id);
    if (drive) {
      await c.fileService.purgeExpiredTrash({ drive });
    }
  }
  return driveIds;
}

async function createFolder(client, name) {
  const res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  return res.json;
}

test('boot sweep purges trash older than the retention window and keeps fresh entries', async () => {
  const expired = await createFolder(client, 'sweep-expired');
  const fresh = await createFolder(client, 'sweep-fresh');

  // Soft-delete both into the trash.
  await client.request(`/api/entries/${expired.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  await client.request(`/api/entries/${fresh.id}`, { method: 'DELETE', csrf: true, expect: 204 });

  // Backdate only the expired one beyond the 30-day window.
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  await dbRun(ctx.db, 'UPDATE entries SET deleted_at = ? WHERE id = ?', [old, expired.id]);

  const driveIds = await runBootSweep(ctx);
  assert.ok(driveIds.some((row) => row.id === 1), 'listDriveIds enumerates the drive');

  assert.strictEqual(await ctx.repositories.getEntryById(expired.id), undefined, 'expired trash is purged');
  assert.ok(await ctx.repositories.getEntryById(fresh.id), 'fresh trash survives the sweep');

  const trash = await client.request('/api/trash');
  assert.ok(!trash.json.entries.some((e) => e.id === expired.id));
  assert.ok(trash.json.entries.some((e) => e.id === fresh.id));
});

test('boot sweep purges an expired trashed file and reclaims its Discord messages', async () => {
  const { json: fileEntry } = await uploadFile(client, { name: 'sweep-expired.bin', data: Buffer.alloc(24, 0x43), expect: 201 });

  // Soft-delete the file, then backdate it beyond the retention window.
  await client.request(`/api/entries/${fileEntry.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  const old = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  await dbRun(ctx.db, 'UPDATE entries SET deleted_at = ? WHERE id = ?', [old, fileEntry.id]);

  const messagesBefore = ctx.discordStorage.countMessages();
  assert.ok(messagesBefore > 0, 'upload stored a Discord message');

  await runBootSweep(ctx);

  assert.strictEqual(await ctx.repositories.getEntryById(fileEntry.id), undefined);
  assert.strictEqual(ctx.discordStorage.countMessages(), 0, 'expired file message is reclaimed');
  const trash = await client.request('/api/trash');
  assert.ok(!trash.json.entries.some((e) => e.id === fileEntry.id));
});
