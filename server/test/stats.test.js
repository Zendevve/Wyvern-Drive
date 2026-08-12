'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile, sha256hex } = require('./helpers');

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

/** Fresh server+login so the drive starts empty (webhook id 1 configured). */
async function freshContext(t, overrides = {}) {
  const c = await startTestServer(overrides);
  t.after(() => c.close());
  const cl = makeClient(c.baseUrl);
  await login(cl, c);
  return { ctx: c, client: cl };
}

test('drive stats: interrupted uploads do not count as files or stored blocks', async (t) => {
  const { ctx, client: c2 } = await freshContext(t);
  // Two phantom entries, the shape a page refresh leaves behind: the client's
  // in-memory queue is gone, so the token can never resume. One is still
  // 'uploading', one 'failed'; each has a posted block + chunk row backed by a
  // fake Discord message, exactly like a real partial upload.
  const webhookId = (await ctx.repositories.listWebhooks(1))[0].id;
  for (const [name, status, token] of [
    ['phantom-uploading.bin', 'uploading', 'stale-1'],
    ['phantom-failed.bin', 'failed', 'stale-2'],
  ]) {
    const entry = await ctx.repositories.insertEntry({
      driveId: 1,
      parentId: null,
      kind: 'file',
      name,
      sizeBytes: 0,
      mimeType: 'application/octet-stream',
      status,
      uploadToken: token,
      expectedSizeBytes: null,
    });
    const [posted] = await ctx.discordStorage.putChunks(
      (await ctx.repositories.listWebhooks(1))[0],
      [{ filename: `chunk-${token}.bin`, encryptedBuffer: Buffer.alloc(16, 3), ordinal: 0 }]
    );
    const block = await ctx.repositories.insertBlock({
      driveId: 1,
      contentHash: sha256hex(Buffer.from(`phantom-${token}`)),
      messageId: posted.messageId,
      webhookId,
      plainSizeBytes: 8,
      cipherSizeBytes: 16,
      nonce: Buffer.alloc(12, 1),
      authTag: Buffer.alloc(16, 2),
      compression: 'none',
    });
    await ctx.repositories.insertChunk({ entryId: entry.id, ordinal: 0, blockId: block.id });
  }

  const stats = (await c2.request('/api/drive/stats')).json;
  assert.strictEqual(stats.files, 0, 'phantom uploads are not files');
  assert.strictEqual(stats.sizeBytes, 0, 'phantom uploads hold no logical bytes');
  assert.strictEqual(stats.blocks, 0, 'blocks of non-ready entries are not stored blocks');
  assert.strictEqual(stats.messages, 0, 'their Discord messages do not count either');
  assert.strictEqual(stats.storedBytes, 0, 'no stored footprint for non-ready entries');
  assert.strictEqual(stats.webhooks, 1);

  const drive = (await c2.request('/api/drive')).json;
  assert.strictEqual(drive.usedBytes, 0, 'usedBytes stays zero for phantom uploads');
});

test('drive stats: blocks of a ready file still count', async (t) => {
  const { client: c2 } = await freshContext(t);
  await uploadFile(c2, { name: 'ready-stats.bin', data: Buffer.alloc(4096, 0x51), expect: 201 });

  const stats = (await c2.request('/api/drive/stats')).json;
  assert.strictEqual(stats.files, 1);
  assert.strictEqual(stats.sizeBytes, 4096);
  assert.ok(stats.blocks >= 1, 'a ready file keeps its blocks in stats');
  assert.strictEqual(stats.messages, 1);
  assert.ok(stats.storedBytes > 0);
  assert.strictEqual(stats.webhooks, 1);
});
