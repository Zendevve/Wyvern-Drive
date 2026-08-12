'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile } = require('./helpers');

let ctx;
let client;
let deepFolder;
let otherFolder;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);
  const mkdir = async (name, parentId = null) => {
    const res = await client.request('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ parentId, name }),
      headers: { 'content-type': 'application/json' },
      csrf: true,
      expect: 201,
    });
    return res.json;
  };
  deepFolder = await mkdir('search-deep');
  otherFolder = await mkdir('search-other');
});

after(() => ctx.close());

test('search spans the whole drive regardless of the folder scope', async () => {
  await uploadFile(client, { parentId: deepFolder.id, name: 'needle-in-haystack.bin', data: Buffer.from('searchable') });

  // Root search finds the nested file.
  let res = await client.request('/api/entries?query=needle');
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.entries.some((e) => e.name === 'needle-in-haystack.bin'));

  // Search from a different folder also spans the drive.
  res = await client.request(`/api/entries?parentId=${otherFolder.id}&query=needle`);
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.entries.some((e) => e.name === 'needle-in-haystack.bin'));

  // An unknown parentId cannot 404 a search: folder resolution is skipped.
  res = await client.request('/api/entries?parentId=999999&query=needle');
  assert.strictEqual(res.status, 200);
  assert.ok(res.json.entries.some((e) => e.name === 'needle-in-haystack.bin'));
});

test('empty query stays folder-scoped', async () => {
  // Without a query the folder scope is enforced: an unknown parent 404s.
  let res = await client.request('/api/entries?parentId=999999&query=');
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.json.error.code, 'NOT_FOUND');

  // A known folder lists only its own children, not the whole drive.
  await uploadFile(client, { parentId: otherFolder.id, name: 'only-in-other.bin', data: Buffer.from('x') });
  res = await client.request(`/api/entries?parentId=${deepFolder.id}`);
  assert.deepStrictEqual(res.json.entries.map((e) => e.name), ['needle-in-haystack.bin']);
});
