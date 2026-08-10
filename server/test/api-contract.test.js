'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile, makeFixture, ORIGIN } = require('./helpers');

let ctx;
let client;
let aliceEntry;
let aliceFolder;
let aliceShare;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);

  const folderRes = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'alice-folder' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  aliceFolder = folderRes.json;

  const upload = await uploadFile(client, { name: 'alice.bin', data: makeFixture(24) });
  aliceEntry = upload.json;

  const shareRes = await client.request(`/api/files/${aliceEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  aliceShare = shareRes.json;
});

after(() => ctx.close());

test('every JSON error uses the exact { error: { code, message } } shape', async () => {
  const anon = makeClient(ctx.baseUrl);
  let res = await anon.request('/api/drive');
  assert.strictEqual(res.status, 401);
  assert.deepStrictEqual(res.json, { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });

  res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'x' }),
    headers: { 'content-type': 'application/json' },
  });
  assert.strictEqual(res.status, 403);
  assert.deepStrictEqual(res.json, { error: { code: 'CSRF_FAILED', message: 'CSRF validation failed' } });

  res = await client.request('/api/definitely-not-a-route');
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(res.json, { error: { code: 'NOT_FOUND', message: 'Not found' } });

  res = await client.request(`/api/shares/not-a-token`);
  assert.strictEqual(res.status, 404);
  assert.deepStrictEqual(res.json, { error: { code: 'SHARE_NOT_FOUND', message: 'Share not found or expired' } });
});

test('GET /api/drive returns exactly { id, quotaBytes, usedBytes }', async () => {
  const res = await client.request('/api/drive');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(Object.keys(res.json).sort(), ['id', 'quotaBytes', 'usedBytes']);
  assert.strictEqual(res.json.quotaBytes, ctx.config.defaultQuotaBytes);
  assert.strictEqual(res.json.usedBytes, 24);
});

test('entry JSON never serializes driveId, chunks, or Discord internals', async () => {
  const res = await client.request('/api/entries');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(Object.keys(res.json), ['entries']);
  for (const entry of res.json.entries) {
    assert.deepStrictEqual(
      Object.keys(entry).sort(),
      ['createdAt', 'id', 'kind', 'mimeType', 'name', 'parentId', 'sizeBytes', 'status', 'updatedAt']
    );
  }
  const serialized = JSON.stringify(res.json);
  assert.ok(!serialized.includes('driveId'));
  assert.ok(!serialized.includes('discord'));
  assert.ok(!serialized.includes('chunk'));
  assert.ok(!serialized.includes('channel'));
});

test('upload and download honor the contract headers and shapes', async () => {
  const up = await uploadFile(client, { name: 'contract.bin', data: makeFixture(24), type: 'application/octet-stream', expect: 201 });
  assert.strictEqual(up.json.status, 'ready');

  const dl = await client.request(`/api/files/${up.json.id}/download`);
  assert.strictEqual(dl.status, 200);
  assert.strictEqual(dl.headers.get('content-type'), 'application/octet-stream');
  assert.strictEqual(dl.headers.get('content-length'), '24');
  assert.match(dl.headers.get('content-disposition'), /^attachment; /);
  assert.match(dl.headers.get('content-disposition'), /filename\*=UTF-8''contract\.bin/);
});

test('share endpoints return the exact contract shapes', async () => {
  const created = await client.request(`/api/files/${aliceEntry.id}/share`, {
    method: 'POST',
    body: JSON.stringify({}),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  assert.deepStrictEqual(Object.keys(created.json).sort(), ['createdAt', 'expiresAt', 'id', 'revokedAt', 'token', 'url']);
  assert.strictEqual(created.json.url, `${ORIGIN}/share/${created.json.token}`);

  const meta = await client.request(`/api/shares/${created.json.token}`);
  assert.deepStrictEqual(Object.keys(meta.json).sort(), ['expiresAt', 'mimeType', 'name', 'sizeBytes']);

  const list = await client.request(`/api/files/${aliceEntry.id}/shares`);
  assert.deepStrictEqual(Object.keys(list.json), ['shares']);
  const share = list.json.shares.find((s) => s.id === created.json.id);
  assert.deepStrictEqual(Object.keys(share).sort(), ['createdAt', 'expiresAt', 'id', 'revokedAt', 'token', 'url']);
  assert.strictEqual(share.token, created.json.token);
});

test('ownership isolation: user B sees 404 for every user A resource', async () => {
  ctx.oauthFetch.currentUser = { id: '2002', username: 'bob', avatar: null };
  await login(client, ctx);

  // B's own root is empty
  const bRoot = await client.request('/api/entries');
  assert.deepStrictEqual(bRoot.json.entries, []);

  const bDrive = await client.request('/api/drive');
  assert.strictEqual(bDrive.json.usedBytes, 0);

  const cases = [
    [`/api/entries?parentId=${aliceFolder.id}`, 'GET'],
    [`/api/files/${aliceEntry.id}/download`, 'GET'],
    [`/api/files/${aliceEntry.id}/shares`, 'GET'],
    [`/api/files/${aliceEntry.id}/share`, 'POST'],
    [`/api/entries/${aliceEntry.id}`, 'PATCH'],
    [`/api/entries/${aliceEntry.id}`, 'DELETE'],
    [`/api/shares/${aliceShare.id}`, 'DELETE'],
  ];
  for (const [route, method] of cases) {
    const res = await client.request(route, {
      method,
      body: method === 'POST' || method === 'PATCH' ? JSON.stringify({ parentId: null, name: 'x' }) : undefined,
      headers: method === 'POST' || method === 'PATCH' ? { 'content-type': 'application/json' } : {},
      csrf: true,
    });
    assert.strictEqual(res.status, 404, `${method} ${route}`);
    assert.strictEqual(res.json.error.code, 'NOT_FOUND');
  }

  // B cannot see or download A's share
  const meta = await client.request(`/api/shares/${aliceShare.token}`);
  assert.strictEqual(meta.status, 200, 'public share metadata stays public');
});
