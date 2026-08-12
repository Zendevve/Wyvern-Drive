'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile, makeFixture, dbAll, dbRun } = require('./helpers');

const WH_URL_A = 'https://discord.com/api/webhooks/123/test-token';
const WH_URL_B = 'https://discord.com/api/webhooks/456/other-token';
const WH_URL_C = 'https://discord.com/api/webhooks/789/third-token';

async function freshContext(t, overrides = {}) {
  const c = await startTestServer(overrides);
  t.after(() => c.close());
  const cl = makeClient(c.baseUrl);
  await login(cl, c);
  return { ctx: c, client: cl };
}

/** Register an extra accepted webhook URL on the fake, then POST it. */
async function addWebhook(client, url) {
  return client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: url }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
}

test('dedup: identical bytes reuse the same blocks with no new Discord posts', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const fixture = makeFixture(24); // 3 x 8-byte chunks

  const a = await uploadFile(c2, { name: 'a.bin', data: fixture, expect: 201 });
  const blockIdsA = (await ctx.repositories.getChunksByEntry(a.json.id)).map((r) => r.block_id);
  assert.strictEqual(blockIdsA.length, 3);
  const putCallsAfterA = ctx.discordStorage.putCalls;
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, '3 chunks packed into one message');

  // Identical bytes as a second file: chunk rows reference the SAME blocks.
  const b = await uploadFile(c2, { name: 'b.bin', data: fixture, expect: 201 });
  assert.strictEqual(b.json.name, 'b.bin', 'distinct names, same content');
  const blockIdsB = (await ctx.repositories.getChunksByEntry(b.json.id)).map((r) => r.block_id);
  assert.deepStrictEqual(blockIdsB, blockIdsA, 'dedup hit reuses the exact block rows');
  assert.strictEqual(ctx.discordStorage.putCalls, putCallsAfterA, 'no Discord I/O for the dedup hit');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'one packed message backs both files');
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM content_blocks'))[0].c, 3, 'no duplicate block rows');

  // Both downloads are byte-equal.
  for (const entry of [a.json, b.json]) {
    const dl = await c2.request(`/api/files/${entry.id}/download`);
    assert.strictEqual(dl.status, 200);
    assert.deepStrictEqual(Buffer.from(await dl.raw.arrayBuffer()), fixture);
  }
});

test('copy: file copy shares blocks with no Discord I/O; folder copy recurses', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const fixture = makeFixture(24);

  const src = await uploadFile(c2, { name: 'src.bin', data: fixture, expect: 201 });
  const putCalls = ctx.discordStorage.putCalls;

  // Copy the file to the root: 201 with a live-only auto-suffixed name.
  const copyRes = await c2.request(`/api/entries/${src.json.id}/copy`, {
    method: 'POST',
    body: JSON.stringify({ parentId: null }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const copied = copyRes.json;
  assert.strictEqual(copied.kind, 'file');
  assert.strictEqual(copied.name, 'src (1).bin');
  assert.strictEqual(copied.sizeBytes, 24);
  assert.strictEqual(copied.deletedAt, null);

  const srcBlocks = (await ctx.repositories.getChunksByEntry(src.json.id)).map((r) => r.block_id);
  const copyBlocks = (await ctx.repositories.getChunksByEntry(copied.id)).map((r) => r.block_id);
  assert.deepStrictEqual(copyBlocks, srcBlocks, 'copy references the source blocks');
  assert.strictEqual(ctx.discordStorage.putCalls, putCalls, 'copy is instant: no new Discord posts');

  const dl = await c2.request(`/api/files/${copied.id}/download`);
  assert.deepStrictEqual(Buffer.from(await dl.raw.arrayBuffer()), fixture, 'copy downloads byte-equal');

  // Folder with a nested file: the copy is a recursive live tree.
  const folder = await c2.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'tree' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const nested = await uploadFile(c2, { parentId: folder.json.id, name: 'leaf.txt', data: Buffer.from('hello tree'), expect: 201 });
  const putCalls2 = ctx.discordStorage.putCalls;
  const folderCopy = await c2.request(`/api/entries/${folder.json.id}/copy`, {
    method: 'POST',
    body: JSON.stringify({ parentId: null }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  assert.strictEqual(folderCopy.json.name, 'tree (1)');
  assert.strictEqual(ctx.discordStorage.putCalls, putCalls2, 'folder copy posts nothing');
  const children = await c2.request(`/api/entries?parentId=${folderCopy.json.id}`);
  assert.strictEqual(children.json.entries.length, 1);
  const leafCopy = children.json.entries[0];
  assert.strictEqual(leafCopy.name, 'leaf.txt');
  const leafBlocks = (await ctx.repositories.getChunksByEntry(leafCopy.id)).map((r) => r.block_id);
  assert.deepStrictEqual(
    leafBlocks,
    (await ctx.repositories.getChunksByEntry(nested.json.id)).map((r) => r.block_id),
    'nested file copy shares blocks'
  );
  const dlLeaf = await c2.request(`/api/files/${leafCopy.id}/download`);
  assert.deepStrictEqual(Buffer.from(await dlLeaf.raw.arrayBuffer()), Buffer.from('hello tree'));
});

test('multi-webhook: uploads round-robin across webhooks; in-use webhooks cannot be removed', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  // login() already configured the first webhook (id 1); append a second.
  ctx.discordStorage.validWebhooks.add(WH_URL_B);
  ctx.discordStorage.validWebhooks.add(WH_URL_C);

  const second = await addWebhook(c2, WH_URL_B);
  assert.strictEqual(second.status, 200, 'appending to an existing drive');
  const w1 = 1;
  const w2 = second.json.webhooks[1].id;
  assert.notStrictEqual(w1, w2);
  assert.deepStrictEqual(second.json.webhooks.map((w) => w.id), [w1, w2]);

  // 48 bytes / 8-byte chunks = 6 chunks; the round-robin cursor alternates
  // webhooks per chunk, and each webhook's batch posts as one message.
  const fixture = Buffer.from(Array.from({ length: 48 }, (_, i) => (i * 5 + 2) % 256));
  const up = await uploadFile(c2, { name: 'fanned.bin', data: fixture, expect: 201 });
  const chunks = await ctx.repositories.getChunksByEntry(up.json.id);
  assert.strictEqual(chunks.length, 6);
  chunks.forEach((chunk, i) => {
    const expected = i % 2 === 0 ? w1 : w2;
    assert.strictEqual(chunk.webhook_id, expected, `chunk ${i} posts to webhook ${expected}`);
  });
  assert.strictEqual(ctx.discordStorage.postCountsByWebhook.get(w1), 1, 'webhook 1 posted its batch');
  assert.strictEqual(ctx.discordStorage.postCountsByWebhook.get(w2), 1, 'webhook 2 posted its batch');
  const dl = await c2.request(`/api/files/${up.json.id}/download`);
  assert.deepStrictEqual(Buffer.from(await dl.raw.arrayBuffer()), fixture, 'fanned file downloads byte-equal');

  // Both webhooks back stored blocks, so neither may be removed yet.
  for (const id of [w1, w2]) {
    const res = await c2.request(`/api/storage/webhooks/${id}`, { method: 'DELETE', csrf: true });
    assert.strictEqual(res.status, 409, `webhook ${id}`);
    assert.strictEqual(res.json.error.code, 'WEBHOOK_IN_USE');
  }

  // A freshly added, unused webhook can be removed.
  const third = await addWebhook(c2, WH_URL_C);
  assert.strictEqual(third.status, 200);
  const w3 = third.json.webhooks[2].id;
  const removed = await c2.request(`/api/storage/webhooks/${w3}`, { method: 'DELETE', csrf: true, expect: 204 });
  void removed;
  const list = await c2.request('/api/storage/webhooks');
  assert.deepStrictEqual(list.json.webhooks.map((w) => w.id), [w1, w2]);
});

test('trash cycle over HTTP: delete -> trash -> restore -> purge', async (t) => {
  const { ctx, client: c2 } = await freshContext(t);
  const fixture = makeFixture(24);
  const up = await uploadFile(c2, { name: 'cycle.bin', data: fixture, expect: 201 });

  // Soft delete: absent from the live listing, present in trash with deletedAt.
  await c2.request(`/api/entries/${up.json.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  const root = await c2.request('/api/entries');
  assert.ok(!root.json.entries.some((e) => e.id === up.json.id), 'trashed entry is not listed');
  const trash = await c2.request('/api/trash');
  const trashed = trash.json.entries.find((e) => e.id === up.json.id);
  assert.ok(trashed, 'entry appears in trash');
  assert.ok(trashed.deletedAt, 'deletedAt is set');
  assert.strictEqual(trashed.name, 'cycle.bin');
  assert.strictEqual(trashed.status, 'ready', 'soft delete keeps the ready status');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'no Discord I/O on soft delete');

  // Downloads of a trashed entry are 404s.
  const dl404 = await c2.request(`/api/files/${up.json.id}/download`);
  assert.strictEqual(dl404.status, 404);

  // Restore: back in the live tree with deletedAt cleared, byte-equal download.
  const restored = await c2.request(`/api/trash/${up.json.id}/restore`, { method: 'POST', csrf: true, expect: 200 });
  assert.strictEqual(restored.json.deletedAt, null);
  const rootAfter = await c2.request('/api/entries');
  assert.ok(rootAfter.json.entries.some((e) => e.id === up.json.id), 'restored entry is listed again');
  const dl = await c2.request(`/api/files/${up.json.id}/download`);
  assert.deepStrictEqual(Buffer.from(await dl.raw.arrayBuffer()), fixture, 'restored file downloads byte-equal');

  // Purge: gone everywhere and the Discord message is reclaimed.
  await c2.request(`/api/entries/${up.json.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  const msgsBefore = ctx.discordStorage.countMessages();
  await c2.request(`/api/trash/${up.json.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  const trashAfter = await c2.request('/api/trash');
  assert.deepStrictEqual(trashAfter.json.entries, [], 'trash is empty after the purge');
  assert.strictEqual(ctx.discordStorage.countMessages(), msgsBefore - 1, 'packed message reclaimed');
  const dlAfter = await c2.request(`/api/files/${up.json.id}/download`);
  assert.strictEqual(dlAfter.status, 404);
});

test('compression: compressible chunks store deflated, smaller ciphertext; config off stores raw', async (t) => {
  const { ctx, client: c2 } = await freshContext(t);
  // 64 KiB of a repeated byte deflates to ~70 bytes; one default-size chunk.
  const compressible = Buffer.alloc(64 * 1024, 0x41);

  const up = await uploadFile(c2, { name: 'compressible.bin', data: compressible, expect: 201 });
  const chunks = await ctx.repositories.getChunksByEntry(up.json.id);
  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0].compression, 'deflate');
  assert.ok(
    chunks[0].cipher_size_bytes < chunks[0].plain_size_bytes,
    `cipher ${chunks[0].cipher_size_bytes} must be below plain ${chunks[0].plain_size_bytes}`
  );
  const dl = await c2.request(`/api/files/${up.json.id}/download`);
  assert.deepStrictEqual(Buffer.from(await dl.raw.arrayBuffer()), compressible, 'deflated chunk downloads byte-equal');

  // WYVERN_COMPRESS_CHUNKS=0: raw plaintext stored, marked 'none'.
  const off = await startTestServer({ chunkSizeBytes: 65536, compressChunks: false });
  t.after(() => off.close());
  const co = makeClient(off.baseUrl);
  await login(co, off);
  const up2 = await uploadFile(co, { name: 'raw.bin', data: compressible, expect: 201 });
  const chunks2 = await off.repositories.getChunksByEntry(up2.json.id);
  assert.strictEqual(chunks2.length, 1);
  assert.strictEqual(chunks2[0].compression, 'none');
  assert.strictEqual(chunks2[0].cipher_size_bytes, 64 * 1024, 'AES-GCM keeps the plaintext length');
  const dl2 = await co.request(`/api/files/${up2.json.id}/download`);
  assert.deepStrictEqual(Buffer.from(await dl2.raw.arrayBuffer()), compressible);
});

test('retention: expired trash is purged by the lazy sweep, fresh trash stays', async (t) => {
  const { ctx, client: c2 } = await freshContext(t);
  const oldEntry = (await uploadFile(c2, { name: 'old.bin', data: makeFixture(24), expect: 201 })).json;
  const freshEntry = (await uploadFile(c2, { name: 'fresh.bin', data: Buffer.from('different bytes'), expect: 201 })).json;
  await c2.request(`/api/entries/${oldEntry.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  await c2.request(`/api/entries/${freshEntry.id}`, { method: 'DELETE', csrf: true, expect: 204 });

  // Backdate old.bin's deleted_at beyond the 30-day default retention window.
  const longAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000).toISOString();
  await dbRun(ctx.db, 'UPDATE entries SET deleted_at = ? WHERE id = ?', [longAgo, oldEntry.id]);

  const trash = await c2.request('/api/trash');
  const ids = trash.json.entries.map((e) => e.id);
  assert.ok(!ids.includes(oldEntry.id), 'expired trash is purged by the list sweep');
  assert.ok(ids.includes(freshEntry.id), 'fresh trash remains');
  assert.strictEqual(await ctx.repositories.getEntryById(oldEntry.id), undefined, 'expired entry row is gone');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'only the fresh message remains');
});

test('webhook cap: third webhook with maxWebhooksPerDrive=2 -> 409 WEBHOOK_LIMIT', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { maxWebhooksPerDrive: 2 });
  ctx.discordStorage.validWebhooks.add(WH_URL_B);
  ctx.discordStorage.validWebhooks.add(WH_URL_C);

  // login() already used slot 1 of the cap of 2; one more add fills it.
  assert.strictEqual((await addWebhook(c2, WH_URL_A)).status, 200);
  const third = await addWebhook(c2, WH_URL_B);
  assert.strictEqual(third.status, 409);
  assert.strictEqual(third.json.error.code, 'WEBHOOK_LIMIT');
});
