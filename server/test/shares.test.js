'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile, makeFixture, ORIGIN, dbAll } = require('./helpers');

let ctx;
let client;
let fixture;
let fileEntry;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);
  fixture = makeFixture(24);
  const res = await uploadFile(client, { name: 'shared.bin', data: fixture, type: 'application/x-fixture' });
  fileEntry = res.json;
});

after(() => ctx.close());

test('creating a share returns id, plaintext token, url and no hashes', async () => {
  const res = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const share = res.json;
  assert.deepStrictEqual(Object.keys(share).sort(), ['createdAt', 'expiresAt', 'id', 'revokedAt', 'token', 'url']);
  assert.strictEqual(share.revokedAt, null);
  assert.strictEqual(share.expiresAt, null);
  assert.strictEqual(share.url, `${ORIGIN}/share/${share.token}`);
  assert.match(share.token, /^\d+\.[A-Za-z0-9_-]+$/);

  const serialized = JSON.stringify(share);
  assert.ok(!serialized.includes('hash'), 'no token hash may leak');

  // only the hash is persisted
  const rows = await dbAll(ctx.db, 'SELECT token_hash FROM shares');
  assert.strictEqual(rows.length, 1);
  assert.notStrictEqual(rows[0].token_hash, share.token);
  assert.match(rows[0].token_hash, /^[0-9a-f]{64}$/);
  return share;
});

test('GET /api/shares/:token returns the exact public metadata shape', async () => {
  const created = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const token = created.json.token;
  const res = await client.request(`/api/shares/${token}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json, {
    name: 'shared.bin',
    sizeBytes: 24,
    mimeType: 'application/x-fixture',
    expiresAt: null,
  });
});

test('GET /s/:token streams the file with download headers', async () => {
  const created = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const token = created.json.token;
  const res = await client.request(`/s/${token}`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'application/x-fixture');
  assert.strictEqual(res.headers.get('content-length'), '24');
  assert.match(res.headers.get('content-disposition'), /attachment; /);
  const buf = Buffer.from(await res.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture);
});

test('GET /api/files/:id/shares lists shares with recoverable plaintext tokens', async () => {
  const created = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const res = await client.request(`/api/files/${fileEntry.id}/shares`);
  assert.strictEqual(res.status, 200);
  assert.ok(Array.isArray(res.json.shares));
  const share = res.json.shares.find((s) => s.id === created.json.id);
  assert.ok(share);
  assert.deepStrictEqual(Object.keys(share).sort(), ['createdAt', 'expiresAt', 'id', 'revokedAt', 'token', 'url']);
  assert.strictEqual(share.token, created.json.token);
  assert.strictEqual(share.url, `${ORIGIN}/share/${share.token}`);
  assert.strictEqual(share.revokedAt, null);
  assert.ok(!JSON.stringify(res.json).includes('hash'));
});

test('revoking a share makes both public routes return an identical 404', async () => {
  const created = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const token = created.json.token;

  const revoked = await client.request(`/api/shares/${created.json.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  void revoked;

  const meta = await client.request(`/api/shares/${token}`);
  const stream = await client.request(`/s/${token}`);
  assert.strictEqual(meta.status, 404);
  assert.strictEqual(stream.status, 404);
  assert.deepStrictEqual(meta.json, stream.json, 'no existence oracle: bodies must be identical');
  assert.strictEqual(meta.json.error.code, 'SHARE_NOT_FOUND');

  // still listed as revoked for the owner
  const list = await client.request(`/api/files/${fileEntry.id}/shares`);
  const share = list.json.shares.find((s) => s.id === created.json.id);
  assert.ok(share.revokedAt);
});

test('expired shares behave like missing shares', async () => {
  const past = new Date(Date.now() - 60 * 1000).toISOString();
  const created = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({ expiresAt: past }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const meta = await client.request(`/api/shares/${created.json.token}`);
  const stream = await client.request(`/s/${created.json.token}`);
  assert.strictEqual(meta.status, 404);
  assert.strictEqual(stream.status, 404);
});

test('future expiry is honored and echoed', async () => {
  const future = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  const created = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({ expiresAt: future }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  assert.strictEqual(created.json.expiresAt, new Date(future).toISOString());
  const meta = await client.request(`/api/shares/${created.json.token}`);
  assert.strictEqual(meta.status, 200);
  assert.strictEqual(meta.json.expiresAt, new Date(future).toISOString());
});

test('invalid expiration dates return 400 INVALID_DATE', async () => {
  const res = await client.request(`/api/files/${fileEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({ expiresAt: 'not-a-date' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_DATE');
});

test('sharing a folder or an unready entry is forbidden with 403', async () => {
  const folder = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'share-folder' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  const res = await client.request(`/api/files/${folder.json.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.error.code, 'FORBIDDEN');
});

test('malformed or unknown tokens return 404 SHARE_NOT_FOUND', async () => {
  for (const token of ['garbage', '1.not-a-real-signature', 'abc.def', '999999.xyz']) {
    const meta = await client.request(`/api/shares/${token}`);
    assert.strictEqual(meta.status, 404, token);
    assert.strictEqual(meta.json.error.code, 'SHARE_NOT_FOUND');
    const stream = await client.request(`/s/${token}`);
    assert.strictEqual(stream.status, 404, token);
    assert.deepStrictEqual(meta.json, stream.json);
  }
});
