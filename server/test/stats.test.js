'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile } = require('./helpers');

let ctx;
let client;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);
});

after(() => ctx.close());

/** 100 KiB of a single repeated byte: compresses extremely well. */
function compressibleFixture() {
  return Buffer.alloc(102400, 0x41);
}

test('drive stats: empty drive reports a zeroed shape with webhooks 1 and null ratio', async () => {
  const res = await client.request('/api/drive/stats');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json, {
    files: 0,
    folders: 0,
    sizeBytes: 0,
    storedBytes: 0,
    blocks: 0,
    messages: 0,
    webhooks: 1,
    compressionRatio: null,
  });
});

test('drive stats: a compressible upload reports sizes, ratio, and sane counts', async () => {
  const fixture = compressibleFixture();
  await uploadFile(client, { name: 'compressible.bin', data: fixture, expect: 201 });

  const res = await client.request('/api/drive/stats');
  assert.strictEqual(res.status, 200);
  const stats = res.json;

  assert.strictEqual(stats.files, 1);
  assert.strictEqual(stats.folders, 0);
  assert.strictEqual(stats.sizeBytes, 102400);
  assert.ok(stats.storedBytes > 0, 'stored bytes are nonzero');
  assert.ok(stats.storedBytes < stats.sizeBytes, 'compression shrinks the Discord footprint');
  assert.ok(stats.compressionRatio > 1, 'compressionRatio = sizeBytes / storedBytes');
  assert.ok(stats.blocks >= 1, '100 KiB / 64 KiB chunks = 2 blocks');
  assert.strictEqual(stats.messages, 1, 'all chunks pack into one Discord message');
  assert.strictEqual(stats.webhooks, 1);
});

test('drive stats: deduped identical upload doubles files/sizeBytes but not stored bytes', async () => {
  const fixture = compressibleFixture();
  let stats = (await client.request('/api/drive/stats')).json;
  const filesBefore = stats.files;
  const sizeBefore = stats.sizeBytes;
  const blocksBefore = stats.blocks;
  const messagesBefore = stats.messages;
  const storedBefore = stats.storedBytes;

  await uploadFile(client, { name: 'dedup-a.bin', data: fixture, expect: 201 });
  await uploadFile(client, { name: 'dedup-b.bin', data: fixture, expect: 201 });
  stats = (await client.request('/api/drive/stats')).json;

  assert.strictEqual(stats.files, filesBefore + 2);
  assert.strictEqual(stats.sizeBytes, sizeBefore + 2 * 102400);
  assert.strictEqual(stats.blocks, blocksBefore, 'blocks are shared, not duplicated');
  assert.strictEqual(stats.messages, messagesBefore);
  assert.strictEqual(stats.storedBytes, storedBefore);
  assert.ok(stats.compressionRatio > 1);
});

test('drive stats: folders and trashed files are counted the documented way', async () => {
  await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'stats-folder' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const { json: fileEntry } = await uploadFile(client, { name: 'stats-trash.bin', data: Buffer.alloc(4096, 0x42), expect: 201 });

  const before = (await client.request('/api/drive/stats')).json;

  // Soft delete: sizeBytes keeps counting the trashed file (status stays
  // 'ready') but the live `files` count drops (deleted_at IS NULL).
  await client.request(`/api/entries/${fileEntry.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  const stats = (await client.request('/api/drive/stats')).json;

  assert.strictEqual(stats.files, before.files - 1, 'trashed files are not live');
  assert.strictEqual(stats.folders, before.folders, 'trashing a file does not change folder counts');
  assert.strictEqual(stats.sizeBytes, before.sizeBytes, 'trashed files still count toward logical size');
  assert.strictEqual(stats.storedBytes, before.storedBytes, 'Discord blocks are untouched by soft delete');
});
