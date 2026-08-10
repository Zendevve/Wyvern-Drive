'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
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

test('24-byte upload splits into exactly 3 x 8-byte encrypted chunks', async () => {
  const fixture = makeFixture(24);
  const res = await uploadFile(client, { name: 'fixture.bin', data: fixture, expect: 201 });
  const entry = res.json;

  assert.strictEqual(entry.kind, 'file');
  assert.strictEqual(entry.status, 'ready');
  assert.strictEqual(entry.sizeBytes, 24);
  assert.strictEqual(entry.parentId, null);
  assert.strictEqual(entry.name, 'fixture.bin');
  assert.strictEqual(entry.mimeType, 'application/octet-stream');

  const chunks = await ctx.repositories.getChunksByEntry(entry.id);
  assert.strictEqual(chunks.length, 3, '24 bytes / 8-byte chunks = 3 chunks');
  chunks.forEach((chunk, i) => {
    assert.strictEqual(chunk.ordinal, i);
    assert.strictEqual(chunk.plain_size_bytes, 8);
    // AES-256-GCM ciphertext length equals plaintext length; the 16-byte auth
    // tag is stored separately in auth_tag.
    assert.strictEqual(chunk.cipher_size_bytes, 8);
    assert.strictEqual(chunk.checksum, sha256hex(fixture.subarray(i * 8, i * 8 + 8)));
    assert.strictEqual(chunk.nonce.length, 12);
    assert.strictEqual(chunk.auth_tag.length, 16);
    assert.strictEqual(chunk.deleted_at, null);
  });

  // Discord storage holds ciphertext, never plaintext.
  const stored = ctx.discordStorage.getMessages('channel-1001');
  assert.strictEqual(stored.size, 3);
  for (let i = 0; i < 3; i += 1) {
    const storedBuf = [...stored.values()][i];
    assert.notDeepStrictEqual(storedBuf, fixture.subarray(i * 8, i * 8 + 8), 'chunk must be encrypted at rest');
  }
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

test('quota exceeded returns 413 and cleans up all sent chunks', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { quotaBytes: 16 });

  const res = await uploadFile(c2, { name: 'big.bin', data: makeFixture(24) });
  assert.strictEqual(res.status, 413);
  assert.strictEqual(res.json.error.code, 'QUOTA_EXCEEDED');

  const root = await c2.request('/api/entries');
  assert.deepStrictEqual(root.json.entries, []);
  assert.strictEqual(ctx.discordStorage.countMessages(), 0, 'quota failure must clean up chunks');
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM entries'))[0].c, 0);
});

test('failed chunk upload cleans up sent messages and removes the entry', async (t) => {
  const { ctx, client: c2 } = await freshContext(t);
  ctx.discordStorage.failPutChunkOnCall = 2; // second chunk fails; chunk 1 was already sent

  const res = await uploadFile(c2, { name: 'doomed.bin', data: makeFixture(24) });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  assert.strictEqual(ctx.discordStorage.countMessages(), 0, 'all sent messages deleted');
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM entries'))[0].c, 0);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM file_chunks'))[0].c, 0);
  const root = await c2.request('/api/entries');
  assert.deepStrictEqual(root.json.entries, []);
});

test('failed cleanup leaves a failed entry that is never listable', async (t) => {
  const { ctx, client: c2 } = await freshContext(t);
  ctx.discordStorage.failPutChunkOnCall = 2; // second chunk fails
  ctx.discordStorage.failNextDeleteChunks = 1; // cleanup deleteChunk also fails

  const res = await uploadFile(c2, { name: 'stuck.bin', data: makeFixture(24) });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  // entry retained with status 'failed', chunk rows retained, not listable
  const rows = await dbAll(ctx.db, 'SELECT * FROM entries');
  assert.strictEqual(rows.length, 1);
  assert.strictEqual(rows[0].status, 'failed');
  const chunks = await dbAll(ctx.db, 'SELECT * FROM file_chunks');
  assert.strictEqual(chunks.length, 1);
  assert.strictEqual(chunks[0].deleted_at, null);
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'first message remains (delete failed)');

  const root = await c2.request('/api/entries');
  assert.deepStrictEqual(root.json.entries, []);

  // a later upload still works
  const ok = await uploadFile(c2, { name: 'after.bin', data: makeFixture(8), expect: 201 });
  assert.strictEqual(ok.json.status, 'ready');
});

test('retryable recursive delete: failure hides the subtree, retry completes it', async () => {
  const { json: folder } = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'retry-tree' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const { json: fileEntry } = await uploadFile(client, { parentId: folder.id, name: 'victim.bin', data: makeFixture(24) });
  const before = ctx.discordStorage.countMessages();

  // first delete: chunk 0 is deleted, chunk 1 deletion fails
  ctx.discordStorage.failDeleteChunkOnCall = 2;
  let res = await client.request(`/api/entries/${folder.id}`, { method: 'DELETE', csrf: true });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  // subtree hidden but retryable, with partial progress
  const rootList = await client.request('/api/entries');
  assert.ok(!rootList.json.entries.some((e) => e.id === folder.id), 'deleting subtree must not be listable');
  assert.strictEqual((await ctx.repositories.getEntryById(fileEntry.id)).status, 'deleting');
  assert.strictEqual(ctx.discordStorage.countMessages(), before - 1, 'chunk 0 already deleted');
  const pending = await ctx.repositories.getPendingChunks(fileEntry.id);
  assert.strictEqual(pending.length, 2, 'retry must only re-process chunks with deleted_at IS NULL');

  // retry succeeds and removes everything
  res = await client.request(`/api/entries/${folder.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  void res;
  assert.strictEqual(await ctx.repositories.getEntryById(folder.id), undefined);
  assert.strictEqual(await ctx.repositories.getEntryById(fileEntry.id), undefined);
  assert.strictEqual(ctx.discordStorage.countMessages(), before - 3, 'all 3 chunks deleted on retry');
  assert.strictEqual((await ctx.repositories.getChunksByEntry(fileEntry.id)).length, 0);
});

test('usedBytes reflects ready files only', async () => {
  const before = (await client.request('/api/drive')).json.usedBytes;
  await uploadFile(client, { name: 'meter.bin', data: makeFixture(24) });
  const after = (await client.request('/api/drive')).json.usedBytes;
  assert.strictEqual(after - before, 24);
});
