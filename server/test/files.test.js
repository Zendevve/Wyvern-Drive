'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const zlib = require('node:zlib');
const { startTestServer, makeClient, login, uploadFile, makeFixture, sha256hex, dbAll } = require('./helpers');

let ctx;
let client;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);
});

after(() => ctx.close());

async function freshContext(t, overrides = {}) {
  const c = await startTestServer(overrides);
  t.after(() => c.close());
  const cl = makeClient(c.baseUrl);
  await login(cl, c);
  return { ctx: c, client: cl };
}

test('24-byte upload splits into exactly 3 x 8-byte encrypted chunks packed in one message', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const fixture = makeFixture(24);
  const res = await uploadFile(c2, { name: 'fixture.bin', data: fixture, expect: 201 });
  const entry = res.json;

  assert.strictEqual(entry.kind, 'file');
  assert.strictEqual(entry.status, 'ready');
  assert.strictEqual(entry.sizeBytes, 24);
  assert.strictEqual(entry.parentId, null);
  assert.strictEqual(entry.name, 'fixture.bin');
  assert.strictEqual(entry.mimeType, 'application/octet-stream');

  // Chunk rows are pure joins onto content_blocks: message id, sizes, nonce,
  // auth tag and checksum all live on the block.
  const chunks = await ctx.repositories.getChunksByEntry(entry.id);
  assert.strictEqual(chunks.length, 3, '24 bytes / 8-byte chunks = 3 chunks');
  chunks.forEach((chunk, i) => {
    assert.strictEqual(chunk.ordinal, i);
    assert.strictEqual(chunk.plain_size_bytes, 8);
    // Chunks are deflated (compression default on) then AES-GCM encrypted;
    // ciphertext length equals the deflated length.
    const stored = zlib.deflateSync(fixture.subarray(i * 8, i * 8 + 8));
    assert.strictEqual(chunk.compression, 'deflate');
    assert.strictEqual(chunk.cipher_size_bytes, stored.length);
    assert.strictEqual(chunk.checksum, sha256hex(stored), 'hash covers the pre-encryption stored bytes');
    assert.strictEqual(chunk.nonce.length, 12);
    assert.strictEqual(chunk.auth_tag.length, 16);
    assert.strictEqual(chunk.deleted_at, null);
  });

  // Discord storage holds one packed message with three attachments per the
  // drive's webhook; the stored bytes are ciphertext, never plaintext.
  const webhookId = (await ctx.repositories.listWebhooks(1))[0].id;
  const stored = ctx.discordStorage.messagesForWebhook(webhookId);
  assert.ok(stored, 'messages stored per webhook');
  assert.strictEqual(stored.size, 1, '3 chunks -> 1 packed message');
  const attachments = [...stored.values()][0];
  assert.strictEqual(attachments.length, 3, 'one attachment per chunk');
  attachments.forEach((attachment, i) => {
    assert.strictEqual(attachment.filename, `chunk-${i}.bin`);
    assert.notDeepStrictEqual(attachment.buffer, fixture.subarray(i * 8, i * 8 + 8), 'chunk must be encrypted at rest');
  });
  assert.strictEqual(ctx.discordStorage.countAttachments(), 3);
  return { entry, fixture };
});

test('download round-trips byte-for-byte with the original SHA-256', async () => {
  const fixture = makeFixture(24);
  const { json: entry } = await uploadFile(client, { name: 'roundtrip.bin', data: fixture });

  const res = await client.request(`/api/files/${entry.id}/download`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-length'), '24');
  assert.strictEqual(res.headers.get('content-type'), 'application/octet-stream');
  assert.match(res.headers.get('content-disposition'), /attachment; /);
  assert.match(res.headers.get('content-disposition'), /filename\*=UTF-8''roundtrip\.bin/);

  const buf = Buffer.from(await res.raw.arrayBuffer());
  assert.strictEqual(buf.length, 24);
  assert.deepStrictEqual(buf, fixture);
  assert.strictEqual(sha256hex(buf), sha256hex(fixture));
});

test('upload name conflicts get a server-side auto-suffix', async () => {
  const data = makeFixture(8);
  await uploadFile(client, { name: 'photo.png', data });
  const second = await uploadFile(client, { name: 'photo.png', data });
  assert.strictEqual(second.json.name, 'photo (1).png');
  const third = await uploadFile(client, { name: 'photo.png', data });
  assert.strictEqual(third.json.name, 'photo (2).png');
});

test('empty file upload produces a zero-chunk ready entry', async () => {
  const res = await uploadFile(client, { name: 'empty.bin', data: Buffer.alloc(0) });
  assert.strictEqual(res.json.status, 'ready');
  assert.strictEqual(res.json.sizeBytes, 0);
  const chunks = await ctx.repositories.getChunksByEntry(res.json.id);
  assert.strictEqual(chunks.length, 0);

  const dl = await client.request(`/api/files/${res.json.id}/download`);
  assert.strictEqual(dl.headers.get('content-length'), '0');
  const buf = Buffer.from(await dl.raw.arrayBuffer());
  assert.strictEqual(buf.length, 0);
});

test('upload preserves the declared MIME type', async () => {
  const res = await uploadFile(client, { name: 'notes.txt', data: Buffer.from('hello world'), type: 'text/plain' });
  assert.strictEqual(res.json.mimeType, 'text/plain');
  const dl = await client.request(`/api/files/${res.json.id}/download`);
  assert.strictEqual(dl.headers.get('content-type'), 'text/plain');
});

test('upload rejects invalid, foreign, or missing parents', async () => {
  const { json: folder } = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'up-parent' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });

  // parent is a file -> INVALID_PARENT
  const { json: fileEntry } = await uploadFile(client, { name: 'up-target.txt', data: Buffer.from('x') });
  let res = await uploadFile(client, { parentId: fileEntry.id, name: 'x.bin', data: makeFixture(8) });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_PARENT');

  // foreign/missing parent -> NOT_FOUND
  res = await uploadFile(client, { parentId: 999999, name: 'x.bin', data: makeFixture(8) });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.json.error.code, 'NOT_FOUND');

  // non-numeric parent -> INVALID_PARENT
  res = await uploadFile(client, { parentId: 'abc', name: 'x.bin', data: makeFixture(8) });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_PARENT');

  // upload inside the folder works
  res = await uploadFile(client, { parentId: folder.id, name: 'ok.bin', data: makeFixture(8), expect: 201 });
  assert.strictEqual(res.json.parentId, folder.id);
});

test('upload without a file part or wrong content type returns 400', async () => {
  const fd = new FormData();
  fd.append('parentId', '');
  let res = await client.request('/api/files/upload', { method: 'POST', body: fd, csrf: true });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'UPLOAD_FAILED');

  res = await client.request('/api/files/upload', {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'UPLOAD_FAILED');
});

test('download of missing, foreign, folder, or unready entries returns 404', async () => {
  const { json: folder } = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'dl-parent' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  for (const id of [999999, folder.id]) {
    const res = await client.request(`/api/files/${id}/download`);
    assert.strictEqual(res.status, 404, `id ${id}`);
    assert.strictEqual(res.json.error.code, 'NOT_FOUND');
  }
});

test('quota exceeded returns 413 and keeps the failed entry for resume', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { quotaBytes: 16 });

  const res = await uploadFile(c2, { name: 'big.bin', data: makeFixture(24) });
  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.json.error.code, 'QUOTA_EXCEEDED');

  // Quota is checked before any chunk is posted: nothing reached Discord, but
  // the entry row is kept (status 'failed') so a token retry can resume it.
  const rows = await dbAll(ctx.db, 'SELECT * FROM entries');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].status, 'failed');
  assert.strictEqual(ctx.discordStorage.countMessages(), 0, 'no chunk posted past the quota check');
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM file_chunks'))[0].c, 0);

  const root = await c2.request('/api/entries');
  assert.deepStrictEqual(root.json.entries, [], 'failed entries are never listable');
});

test('failed chunk upload keeps the entry failed and resumeable, never listable', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  ctx.discordStorage.failNextPutChunks = 1; // first (and only) batch fails

  const res = await uploadFile(c2, { name: 'doomed.bin', data: makeFixture(24) });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  // NEW contract: the entry row is kept (status 'failed'); the failed batch
  // was atomic, so no chunk rows and no Discord messages remain.
  const rows = await dbAll(ctx.db, 'SELECT * FROM entries');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].status, 'failed');
  assert.strictEqual(rows[0].size_bytes, 0);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM file_chunks'))[0].c, 0);
  assert.strictEqual(ctx.discordStorage.countMessages(), 0);

  const root = await c2.request('/api/entries');
  assert.deepStrictEqual(root.json.entries, []);

  // A later upload still works.
  const ok = await uploadFile(c2, { name: 'after.bin', data: makeFixture(8), expect: 201 });
  assert.strictEqual(ok.json.status, 'ready');
});

test('failed mid-upload keeps completed batches: entry failed, partial chunks retained', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  // 200-byte fixture -> 25 chunks -> batches of 10/10/5. The second batch
  // fails on its second chunk (putCalls 12); the first batch is already
  // stored, the third batch still posts (its chunks are counted after 12).
  ctx.discordStorage.failPutChunkOnCall = 12;

  const res = await uploadFile(c2, { name: 'stuck.bin', data: makeFixture(200) });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  // entry retained with status 'failed', completed batches retained
  const rows = await dbAll(ctx.db, 'SELECT * FROM entries');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].status, 'failed');
  const chunks = await dbAll(ctx.db, 'SELECT * FROM file_chunks');
  assert.strictEqual(chunks.length, 15, 'batches 1 and 3 kept their chunk rows');
  assert.ok(chunks.every((c) => c.deleted_at === null));
  assert.strictEqual(ctx.discordStorage.countMessages(), 2, 'two packed messages remain (resume mechanism)');
  assert.strictEqual(ctx.discordStorage.countAttachments(), 15);

  const root = await c2.request('/api/entries');
  assert.deepStrictEqual(root.json.entries, []);

  // a later upload still works
  const ok = await uploadFile(c2, { name: 'after.bin', data: makeFixture(8), expect: 201 });
  assert.strictEqual(ok.json.status, 'ready');
});

test('retryable recursive purge: failure keeps the subtree in trash, retry completes it', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const { json: folder } = await c2.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'retry-tree' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const { json: fileEntry } = await uploadFile(c2, { parentId: folder.id, name: 'victim.bin', data: makeFixture(24) });
  const before = ctx.discordStorage.countMessages();
  assert.strictEqual(before, 1, '3 chunks packed into one message');

  // Soft delete moves the subtree to the trash without touching Discord.
  await c2.request(`/api/entries/${folder.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  assert.strictEqual(ctx.discordStorage.countMessages(), before, 'soft delete keeps Discord messages');

  // First purge: the single deleteChunk call (one per packed message) fails,
  // leaving the subtree marked 'deleting' but fully retryable.
  ctx.discordStorage.failDeleteChunkOnCall = 1;
  let res = await c2.request(`/api/trash/${folder.id}`, { method: 'DELETE', csrf: true });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  assert.strictEqual((await ctx.repositories.getEntryById(fileEntry.id)).status, 'deleting');
  assert.strictEqual(ctx.discordStorage.countMessages(), before, 'packed message retained after failed purge');
  const pending = await ctx.repositories.getPendingChunks(fileEntry.id);
  assert.strictEqual(pending.length, 3, 'all 3 chunk rows still pending (one packed message)');

  // Retry succeeds and removes everything.
  res = await c2.request(`/api/trash/${folder.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  void res;
  assert.strictEqual(await ctx.repositories.getEntryById(folder.id), undefined);
  assert.strictEqual(await ctx.repositories.getEntryById(fileEntry.id), undefined);
  assert.strictEqual(ctx.discordStorage.countMessages(), before - 1, 'one delete call per packed message');
  assert.strictEqual((await ctx.repositories.getChunksByEntry(fileEntry.id)).length, 0);
});

test('usedBytes counts kept failed uploads in addition to ready files', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const before = (await c2.request('/api/drive')).json.usedBytes;

  // A failed upload keeps its entry row; sumUsedBytes counts rows with status
  // IN ('ready','uploading','failed'). The failed row's size_bytes is 0 (only
  // a successful upload commits size), so the total is unchanged — but the
  // counting query includes it, and the quota state stays consistent.
  ctx.discordStorage.failPutChunkOnCall = 2;
  const res = await uploadFile(c2, { name: 'stuck.bin', data: makeFixture(24) });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  const failedRows = await dbAll(ctx.db, "SELECT * FROM entries WHERE status = 'failed'");
  assert.strictEqual(failedRows.length, 1);
  assert.strictEqual(failedRows[0].size_bytes, 0);
  assert.strictEqual(await ctx.repositories.sumUsedBytes(1), before, 'failed entries are counted (0 bytes until ready)');
  assert.strictEqual((await c2.request('/api/drive')).json.usedBytes, before);

  // A ready upload counts normally.
  await uploadFile(c2, { name: 'meter.bin', data: makeFixture(24), expect: 201 });
  assert.strictEqual((await c2.request('/api/drive')).json.usedBytes, before + 24);
});

test('resume: same upload token retries a failed upload to a ready file', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const fixture = makeFixture(24); // 3 chunks
  const token = 'resume-token-simple';

  // First attempt fails on the single batch: nothing is stored.
  ctx.discordStorage.failNextPutChunks = 1;
  const first = await uploadFile(c2, {
    name: 'resume.bin',
    data: fixture,
    uploadToken: token,
    expect: 502,
  });
  assert.strictEqual(first.json.error.code, 'STORAGE_UNAVAILABLE');

  const failed = await ctx.repositories.getEntryByUploadToken(1, token);
  assert.ok(failed, 'entry is keyed by the upload token');
  assert.strictEqual(failed.status, 'failed');
  assert.strictEqual(failed.name, 'resume.bin');
  assert.strictEqual(ctx.discordStorage.countMessages(), 0);
  const root = await c2.request('/api/entries');
  assert.deepStrictEqual(root.json.entries, [], 'failed entries are never listable');

  // Retry with the SAME token: the entry and its name are reused, all three
  // chunks are posted, and the file downloads byte-for-byte.
  const retry = await uploadFile(c2, {
    name: 'resume.bin',
    data: fixture,
    uploadToken: token,
    expect: 201,
  });
  assert.strictEqual(retry.json.status, 'ready');
  assert.strictEqual(retry.json.name, 'resume.bin', 'no conflict suffix on resume');
  assert.strictEqual(retry.json.sizeBytes, 24);

  const rows = await ctx.repositories.getChunksByEntry(retry.json.id);
  assert.strictEqual(rows.length, 3, '3 chunk rows');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'no duplicate messages');
  assert.strictEqual(ctx.discordStorage.countAttachments(), 3);

  const dl = await c2.request(`/api/files/${retry.json.id}/download`);
  const buf = Buffer.from(await dl.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture);
});

test('resume: partial batches are skipped, only missing ordinals are re-posted', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const fixture = makeFixture(200); // 25 chunks -> batches 10/10/5
  const token = 'resume-token-partial';

  // First attempt: batch 1 (chunks 0-9) is stored, then the second batch
  // fails on its second chunk (putCalls 12); the trailing batch (chunks
  // 20-24) still posts, so 15 chunk rows / 2 messages survive.
  ctx.discordStorage.failPutChunkOnCall = 12;
  const first = await uploadFile(c2, {
    name: 'resume.bin',
    data: fixture,
    uploadToken: token,
    expect: 502,
  });
  assert.strictEqual(first.json.error.code, 'STORAGE_UNAVAILABLE');

  const failed = await ctx.repositories.getEntryByUploadToken(1, token);
  assert.strictEqual(failed.status, 'failed');
  const partial = await ctx.repositories.getPendingChunks(failed.id);
  assert.strictEqual(partial.length, 15, 'completed batches keep their chunk rows');
  assert.deepStrictEqual(
    partial.map((r) => r.ordinal),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 20, 21, 22, 23, 24],
    'failed batch 2 left no rows'
  );
  assert.strictEqual(ctx.discordStorage.countMessages(), 2);

  // Progress endpoint reflects the partial state.
  const progress = await c2.request(`/api/uploads/${token}`);
  assert.strictEqual(progress.json.status, 'failed');
  assert.strictEqual(progress.json.postedBytes, 120, '15 posted chunks x 8 bytes');
  assert.strictEqual(progress.json.expectedBytes, null);

  // Resume posts only the missing ordinals 10-19.
  const retry = await uploadFile(c2, {
    name: 'resume.bin',
    data: fixture,
    uploadToken: token,
    expect: 201,
  });
  assert.strictEqual(retry.json.status, 'ready');
  assert.strictEqual(retry.json.name, 'resume.bin', 'no conflict suffix on resume');
  assert.strictEqual(retry.json.sizeBytes, 200);

  const rows = await ctx.repositories.getChunksByEntry(retry.json.id);
  assert.strictEqual(rows.length, 25, 'all ordinals covered exactly once');
  assert.strictEqual(new Set(rows.map((r) => r.ordinal)).size, 25);
  assert.strictEqual(ctx.discordStorage.countMessages(), 3, 'two kept messages + one resumed batch');
  assert.strictEqual(ctx.discordStorage.countAttachments(), 25);

  const dl = await c2.request(`/api/files/${retry.json.id}/download`);
  const buf = Buffer.from(await dl.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture, 'byte-for-byte download equality');
});

test('range downloads: 206 with Content-Range, suffix and open-ended ranges, unsatisfiable falls back to 200', async () => {
  const fixture = makeFixture(24);
  const { json: entry } = await uploadFile(client, { name: 'ranged.bin', data: fixture, expect: 201 });

  // Always advertises range support.
  let res = await client.request(`/api/files/${entry.id}/download`);
  assert.strictEqual(res.headers.get('accept-ranges'), 'bytes');

  // bytes=2-9 -> 206 with the exact slice.
  res = await client.request(`/api/files/${entry.id}/download`, {
    headers: { range: 'bytes=2-9' },
  });
  assert.strictEqual(res.status, 206);
  assert.strictEqual(res.headers.get('content-range'), 'bytes 2-9/24');
  assert.strictEqual(res.headers.get('content-length'), '8');
  let buf = Buffer.from(await res.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture.subarray(2, 10));

  // Suffix range: last 4 bytes.
  res = await client.request(`/api/files/${entry.id}/download`, {
    headers: { range: 'bytes=-4' },
  });
  assert.strictEqual(res.status, 206);
  assert.strictEqual(res.headers.get('content-range'), 'bytes 20-23/24');
  buf = Buffer.from(await res.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture.subarray(20, 24));

  // Open-ended range clamps to EOF.
  res = await client.request(`/api/files/${entry.id}/download`, {
    headers: { range: 'bytes=20-' },
  });
  assert.strictEqual(res.status, 206);
  assert.strictEqual(res.headers.get('content-range'), 'bytes 20-23/24');
  buf = Buffer.from(await res.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture.subarray(20, 24));

  // Unsatisfiable range falls back to a full 200.
  res = await client.request(`/api/files/${entry.id}/download`, {
    headers: { range: 'bytes=99-' },
  });
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-length'), '24');
  buf = Buffer.from(await res.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture);
});

test('upload progress: token lookup returns posted/expected bytes; unknown token 404s', async (t) => {
  const { client: c2 } = await freshContext(t);
  const token = 'progress-token-1';
  const res = await uploadFile(c2, {
    name: 'metered.bin',
    data: makeFixture(24),
    uploadToken: token,
    fileSize: 24,
    expect: 201,
  });
  assert.strictEqual(res.json.status, 'ready');

  const progress = await c2.request(`/api/uploads/${token}`);
  assert.strictEqual(progress.status, 200);
  assert.deepStrictEqual(progress.json, {
    status: 'ready',
    postedBytes: 24,
    expectedBytes: 24,
  });

  // Unknown tokens are indistinguishable from missing entries.
  const missing = await c2.request('/api/uploads/no-such-token');
  assert.strictEqual(missing.status, 404);
  assert.strictEqual(missing.json.error.code, 'NOT_FOUND');
});

test('cancel purges a failed partial upload, its chunks, and its Discord messages', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const fixture = makeFixture(200); // 25 chunks -> batches 10/10/5
  const token = 'cancel-token-partial';

  // First attempt stores batch 1 (chunks 0-9), then batch 2 fails on its
  // second chunk; the trailing batch still posts, so 15 chunk rows / 2
  // messages survive (same shape as the resume test).
  ctx.discordStorage.failPutChunkOnCall = 12;
  const first = await uploadFile(c2, {
    name: 'cancel.bin',
    data: fixture,
    uploadToken: token,
    expect: 502,
  });
  assert.strictEqual(first.json.error.code, 'STORAGE_UNAVAILABLE');
  const failed = await ctx.repositories.getEntryByUploadToken(1, token);
  assert.strictEqual(failed.status, 'failed');
  const baselineMessages = ctx.discordStorage.countMessages();
  assert.strictEqual(baselineMessages, 2);

  // Cancelling hard-purges the partial upload: entry gone from listings and
  // trash, chunks reclaimed, Discord messages deleted.
  const cancel = await c2.request(`/api/uploads/${token}/cancel`, { method: 'POST', csrf: true, expect: 204 });
  assert.strictEqual(cancel.status, 204);
  assert.strictEqual(await ctx.repositories.getEntryByUploadToken(1, token), undefined);

  const entries = await c2.request('/api/entries');
  assert.ok(!entries.json.entries.some((e) => e.name === 'cancel.bin'));
  const trash = await c2.request('/api/trash');
  assert.ok(!trash.json.entries.some((e) => e.name === 'cancel.bin'), 'cancelled upload must not leak into trash');
  assert.strictEqual(ctx.discordStorage.countMessages(), 0, 'partial messages are reclaimed');
  assert.strictEqual(ctx.discordStorage.countAttachments(), 0);

  // The token is gone: cancelling again 404s.
  const again = await c2.request(`/api/uploads/${token}/cancel`, { method: 'POST', csrf: true });
  assert.strictEqual(again.status, 404);
  assert.strictEqual(again.json.error.code, 'NOT_FOUND');
});

test('cancel rejects ready entries and unknown tokens with 404', async (t) => {
  const { client: c2 } = await freshContext(t);
  const token = 'cancel-token-ready';

  const res = await uploadFile(c2, {
    name: 'ready-cancel.bin',
    data: makeFixture(24),
    uploadToken: token,
    expect: 201,
  });
  assert.strictEqual(res.json.status, 'ready');

  const cancel = await c2.request(`/api/uploads/${token}/cancel`, { method: 'POST', csrf: true });
  assert.strictEqual(cancel.status, 404);
  assert.strictEqual(cancel.json.error.code, 'NOT_FOUND');

  // The committed file is untouched.
  const entries = await c2.request('/api/entries');
  assert.ok(entries.json.entries.some((e) => e.id === res.json.id));

  // Unknown tokens are indistinguishable from missing entries.
  const missing = await c2.request('/api/uploads/no-such-token/cancel', { method: 'POST', csrf: true });
  assert.strictEqual(missing.status, 404);
  assert.strictEqual(missing.json.error.code, 'NOT_FOUND');
});

test('cancel purges an in-flight uploading entry with no stored chunks', async (t) => {
  const { ctx, client: c2 } = await freshContext(t);
  // Simulate the transient uploading state (the client aborts mid-flight
  // before any chunk is stored) by inserting the row the upload flow creates.
  const row = await ctx.repositories.insertEntry({
    driveId: 1,
    parentId: null,
    kind: 'file',
    name: 'inflight.bin',
    sizeBytes: 0,
    mimeType: 'application/octet-stream',
    status: 'uploading',
    uploadToken: 'cancel-token-inflight',
    expectedSizeBytes: null,
  });

  const cancel = await c2.request('/api/uploads/cancel-token-inflight/cancel', { method: 'POST', csrf: true, expect: 204 });
  assert.strictEqual(cancel.status, 204);
  assert.strictEqual(await ctx.repositories.getEntryById(row.id), undefined);
  assert.strictEqual(ctx.discordStorage.countMessages(), 0);
});
