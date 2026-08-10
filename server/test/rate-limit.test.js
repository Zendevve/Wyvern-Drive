'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login } = require('./helpers');

let ctx;
let client;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
  await login(client, ctx);
});

after(() => ctx.close());

test('mutations are limited to 60/min and then return 429 RATE_LIMITED', async () => {
  for (let i = 0; i < 60; i += 1) {
    const res = await client.request('/api/folders', {
      method: 'POST',
      body: JSON.stringify({ parentId: null }),
      headers: { 'content-type': 'application/json' },
      csrf: true,
    });
    assert.strictEqual(res.status, 400, `request ${i + 1} should pass the limiter`);
    assert.strictEqual(res.json.error.code, 'INVALID_NAME');
  }
  const res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 429);
  assert.deepStrictEqual(res.json, { error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
});

test('OAuth callback is limited to 10/min', async () => {
  // fresh server so the callback limiter starts empty
  const c = await startTestServer();
  try {
    const cl = makeClient(c.baseUrl);
    for (let i = 0; i < 10; i += 1) {
      const res = await cl.request('/api/auth/discord/callback?code=test-code&state=whatever', { redirect: 'manual' });
      assert.strictEqual(res.status, 302, `callback ${i + 1} should pass`);
    }
    const res = await cl.request('/api/auth/discord/callback?code=test-code&state=whatever', { redirect: 'manual' });
    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.json.error.code, 'RATE_LIMITED');
  } finally {
    await c.close();
  }
});

test('public share downloads are limited to 30/min', async () => {
  // fresh server so the share limiter starts empty
  const c = await startTestServer();
  try {
    const cl = makeClient(c.baseUrl);
    for (let i = 0; i < 30; i += 1) {
      const res = await cl.request('/s/invalid-token');
      assert.strictEqual(res.status, 404, `request ${i + 1} should pass the limiter`);
    }
    const res = await cl.request('/s/invalid-token');
    assert.strictEqual(res.status, 429);
    assert.strictEqual(res.json.error.code, 'RATE_LIMITED');
  } finally {
    await c.close();
  }
});

test('GET routes are not mutation-limited', async () => {
  // the mutation limiter only counts POST/PATCH/DELETE
  for (let i = 0; i < 80; i += 1) {
    const res = await client.request('/api/auth/me');
    assert.strictEqual(res.status, 200);
  }
});
