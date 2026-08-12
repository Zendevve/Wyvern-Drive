'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile } = require('./helpers');

let ctx;
let client;
let rootFolder;
let nestedFolder;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);
  rootFolder = await createFolder(client, 'root');
  nestedFolder = await createFolder(client, 'nested', rootFolder.id);
});

after(() => ctx.close());

async function createFolder(client, name, parentId = null, { expect = 201 } = {}) {
  const res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId, name }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect,
  });
  return res.json;
}

test('folder creation returns a 201 entry with the exact JSON shape', async () => {
  const folder = await createFolder(client, 'alpha');
  assert.deepStrictEqual(Object.keys(folder).sort(), [
    'createdAt', 'deletedAt', 'id', 'kind', 'mimeType', 'name', 'parentId', 'sizeBytes', 'status', 'updatedAt',
  ]);
  assert.strictEqual(folder.kind, 'folder');
  assert.strictEqual(folder.name, 'alpha');
  assert.strictEqual(folder.parentId, null);
  assert.strictEqual(folder.status, 'ready');
  assert.strictEqual(folder.sizeBytes, 0);
  assert.strictEqual(folder.mimeType, null);
  assert.strictEqual(folder.deletedAt, null);
});

test('duplicate sibling names conflict with 409 NAME_CONFLICT', async () => {
  await createFolder(client, 'dup');
  const res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'dup' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.error.code, 'NAME_CONFLICT');
});

test('invalid names are rejected with 400 INVALID_NAME', async () => {
  for (const name of ['', 'a/b', 'a\\b', '.', '..', '  ', 'x\u0000y', 'a'.repeat(256)]) {
    const res = await client.request('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ parentId: null, name }),
      headers: { 'content-type': 'application/json' },
      csrf: true,
    });
    assert.strictEqual(res.status, 400, `name ${JSON.stringify(name)}`);
    assert.strictEqual(res.json.error.code, 'INVALID_NAME');
  }
});

test('non-folder parents are rejected with 400 INVALID_PARENT', async () => {
  const { json: fileEntry } = await uploadFile(client, { name: 'leaf.txt', data: Buffer.from('hi') });
  const res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: fileEntry.id, name: 'under-file' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_PARENT');
});

test('foreign or missing parents return 404 NOT_FOUND', async () => {
  const res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: 999999, name: 'x' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.json.error.code, 'NOT_FOUND');
});

test('listing returns only ready children with default sort by name', async () => {
  const res = await client.request('/api/entries');
  assert.strictEqual(res.status, 200);
  const names = res.json.entries.map((e) => e.name);
  for (const expected of ['root', 'alpha', 'dup', 'leaf.txt']) {
    assert.ok(names.includes(expected), `missing ${expected}`);
  }
  assert.ok(
    names.every((n, i) => i === 0 || n.toLowerCase() >= names[i - 1].toLowerCase()),
    'default sort should be name ascending'
  );
});

test('listing inside a folder returns that folder’s children', async () => {
  await createFolder(client, 'inside', rootFolder.id);
  const res = await client.request(`/api/entries?parentId=${rootFolder.id}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json.entries.map((e) => e.name), ['inside', 'nested']);
});

test('search filters by name substring', async () => {
  await createFolder(client, 'garden');
  await createFolder(client, 'garage');
  const res = await client.request('/api/entries?query=gar');
  const names = res.json.entries.map((e) => e.name).sort();
  assert.deepStrictEqual(names, ['garage', 'garden']);
});

test('search escapes LIKE wildcards', async () => {
  await createFolder(client, '100%real');
  let res = await client.request('/api/entries?query=100%25');
  assert.strictEqual(res.json.entries.length, 1);
  assert.strictEqual(res.json.entries[0].name, '100%real');
  res = await client.request('/api/entries?query=100%');
  assert.strictEqual(res.json.entries.length, 1, 'bare % must not act as a wildcard');
});

test('kind filter restricts listings', async () => {
  const res = await client.request('/api/entries?kind=file');
  assert.ok(res.json.entries.length > 0);
  assert.ok(res.json.entries.every((e) => e.kind === 'file'));
  const folders = await client.request('/api/entries?kind=folder');
  assert.ok(folders.json.entries.every((e) => e.kind === 'folder'));
});

test('sorting by size, createdAt and updatedAt in both directions', async () => {
  await uploadFile(client, { name: 'small.bin', data: Buffer.from('aaa') });
  await uploadFile(client, { name: 'large.bin', data: Buffer.from('a'.repeat(64)) });
  await uploadFile(client, { name: 'medium.bin', data: Buffer.from('a'.repeat(16)) });

  const positions = (names) => names.map((n) => ['small.bin', 'medium.bin', 'large.bin'].indexOf(n)).filter((i) => i >= 0);

  let res = await client.request('/api/entries?kind=file&sort=size&direction=asc');
  let pos = positions(res.json.entries.map((e) => e.name));
  assert.deepStrictEqual(pos, [0, 1, 2]);

  res = await client.request('/api/entries?kind=file&sort=size&direction=desc');
  pos = positions(res.json.entries.map((e) => e.name));
  assert.deepStrictEqual(pos, [2, 1, 0]);

  res = await client.request('/api/entries?sort=createdAt&direction=asc');
  const byCreated = res.json.entries.map((e) => e.createdAt);
  assert.deepStrictEqual(byCreated, [...byCreated].sort());

  res = await client.request('/api/entries?sort=updatedAt&direction=desc');
  const byUpdated = res.json.entries.map((e) => e.updatedAt);
  assert.deepStrictEqual(byUpdated, [...byUpdated].sort().reverse());
});

test('empty parent lists return []', async () => {
  const res = await client.request(`/api/entries?parentId=${nestedFolder.id}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json.entries, []);
});

test('listing under a trashed parent is empty, then 404 after purge', async () => {
  const folder = await createFolder(client, 'toBeDeleted');
  await uploadFile(client, { parentId: folder.id, name: 'occupant.bin', data: Buffer.from('12345678') });

  // Soft delete: the subtree moves to the trash (status stays 'ready').
  await client.request(`/api/entries/${folder.id}`, { method: 'DELETE', csrf: true, expect: 204 });

  // Children are trashed too, so listing under the folder is empty.
  let res = await client.request(`/api/entries?parentId=${folder.id}`);
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json.entries, []);

  // Purging removes the folder row -> NOT_FOUND.
  await client.request(`/api/trash/${folder.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  res = await client.request(`/api/entries?parentId=${folder.id}`);
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.json.error.code, 'NOT_FOUND');
});

test('rename updates the name and rejects conflicts', async () => {
  const folder = await createFolder(client, 'rename-me');
  let res = await client.request(`/api/entries/${folder.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'renamed' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 200,
  });
  assert.strictEqual(res.json.name, 'renamed');

  // conflict with an existing sibling
  await createFolder(client, 'taken');
  res = await client.request(`/api/entries/${folder.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'taken' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.error.code, 'NAME_CONFLICT');

  // invalid name
  res = await client.request(`/api/entries/${folder.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ name: 'bad/name' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_NAME');
});

test('move entry between folders, to root, and its validation rules', async () => {
  const moving = await createFolder(client, 'moving-folder');
  const destA = await createFolder(client, 'dest-a');
  const destB = await createFolder(client, 'dest-b');

  // move to a folder
  let res = await client.request(`/api/entries/${moving.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: destA.id }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 200,
  });
  assert.strictEqual(res.json.parentId, destA.id);

  // move back to root (explicit null)
  res = await client.request(`/api/entries/${moving.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: null }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 200,
  });
  assert.strictEqual(res.json.parentId, null);

  // destination is a file -> INVALID_PARENT
  const { json: fileEntry } = await uploadFile(client, { name: 'move-target.txt', data: Buffer.from('x') });
  res = await client.request(`/api/entries/${moving.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: fileEntry.id }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_PARENT');

  // foreign/missing destination -> NOT_FOUND
  res = await client.request(`/api/entries/${moving.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: 999999 }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 404);
  assert.strictEqual(res.json.error.code, 'NOT_FOUND');

  // self move -> INVALID_MOVE
  res = await client.request(`/api/entries/${moving.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: moving.id }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_MOVE');

  // move into own descendant -> INVALID_MOVE
  const child = await createFolder(client, 'child', moving.id);
  const grandchild = await createFolder(client, 'grandchild', child.id);
  res = await client.request(`/api/entries/${moving.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: grandchild.id }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_MOVE');

  // move into a folder with a same-named child -> NAME_CONFLICT
  const clashA = await createFolder(client, 'clash', destA.id);
  await createFolder(client, 'clash', destB.id);
  res = await client.request(`/api/entries/${clashA.id}`, {
    method: 'PATCH',
    body: JSON.stringify({ parentId: destB.id }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 409);
  assert.strictEqual(res.json.error.code, 'NAME_CONFLICT');
});

test('foreign entry operations return 404', async () => {
  for (const op of ['patch', 'delete']) {
    const res =
      op === 'patch'
        ? await client.request('/api/entries/999999', {
            method: 'PATCH',
            body: JSON.stringify({ name: 'x' }),
            headers: { 'content-type': 'application/json' },
            csrf: true,
          })
        : await client.request('/api/entries/999999', { method: 'DELETE', csrf: true });
    assert.strictEqual(res.status, 404, op);
    assert.strictEqual(res.json.error.code, 'NOT_FOUND');
  }
});

test('recursive delete trashes a folder tree; purge removes it and its chunks', async () => {
  const folder = await createFolder(client, 'tree');
  const { json: inner } = await uploadFile(client, { parentId: folder.id, name: 'inner.bin', data: Buffer.from('12345678') });
  const sub = await createFolder(client, 'sub', folder.id);
  const { json: deep } = await uploadFile(client, { parentId: sub.id, name: 'deep.bin', data: Buffer.from('abcdefghij') });

  const before = ctx.discordStorage.countMessages();
  // Soft delete: the whole subtree lands in the trash, Discord untouched.
  await client.request(`/api/entries/${folder.id}`, { method: 'DELETE', csrf: true, expect: 204 });

  const trash = await client.request('/api/trash');
  const trashedIds = trash.json.entries.map((e) => e.id);
  assert.ok(trashedIds.includes(folder.id), 'folder appears in trash');
  assert.ok(trashedIds.includes(inner.id), 'file appears in trash');
  assert.ok(trashedIds.includes(sub.id), 'subfolder appears in trash');
  assert.ok(trashedIds.includes(deep.id), 'nested file appears in trash');
  assert.strictEqual(ctx.discordStorage.countMessages(), before, 'no Discord I/O on soft delete');

  // Purging the root removes the tree and reclaims its messages.
  await client.request(`/api/trash/${folder.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  assert.strictEqual(await ctx.repositories.getEntryById(folder.id), undefined);
  assert.strictEqual(await ctx.repositories.getEntryById(inner.id), undefined);
  assert.strictEqual(await ctx.repositories.getEntryById(sub.id), undefined);
  assert.strictEqual(await ctx.repositories.getEntryById(deep.id), undefined);
  // inner.bin = 1 chunk, deep.bin = 1 chunk (both smaller than one 64 KiB chunk)
  assert.strictEqual(before - ctx.discordStorage.countMessages(), 2);
});

test('folder archive streams a ZIP of the subtree', async () => {
  const folder = await createFolder(client, 'archive-root');
  const sub = await createFolder(client, 'archive-sub', folder.id);
  await uploadFile(client, { parentId: folder.id, name: 'root.txt', data: Buffer.from('hello root') });
  await uploadFile(client, { parentId: sub.id, name: 'deep.txt', data: Buffer.from('hello deep') });

  const res = await client.request(`/api/entries/${folder.id}/archive`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-type'), 'application/zip');
  assert.match(res.headers.get('content-disposition'), /^attachment; filename="archive-root\.zip"/);

  const buf = Buffer.from(await res.raw.arrayBuffer());
  assert.strictEqual(buf.subarray(0, 2).toString('ascii'), 'PK', 'body must start with the ZIP magic');
  assert.ok(buf.length > 100, 'archive contains real entries');

  // Unknown entries 404 like every other entry route.
  const missing = await client.request('/api/entries/999999/archive');
  assert.strictEqual(missing.status, 404);
  assert.strictEqual(missing.json.error.code, 'NOT_FOUND');
});
