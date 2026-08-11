'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient } = require('./helpers');

let ctx;
let client;

before(async () => {
  ctx = await startTestServer();
  client = makeClient(ctx.baseUrl);
});

after(() => ctx.close());

test('GET /api/setup/status reports a complete configuration with the exact contract shape', async () => {
  const res = await client.request('/api/setup/status');
  assert.strictEqual(res.status, 200);
  assert.deepStrictEqual(res.json, {
    setupRequired: false,
    usesWebhooks: true,
    storageMode: 'discord-webhooks-per-user',
    missing: [],
    invalid: [],
  });
});

test('complete configuration still reaches the full app, not setup mode', async () => {
  // Protected API is alive (401, not 404) and auth/me works: the server is
  // running the full composition, not the limited setup app.
  const me = await client.request('/api/auth/me');
  assert.strictEqual(me.status, 200);
  assert.deepStrictEqual(me.json, { user: null });

  const drive = await client.request('/api/drive');
  assert.strictEqual(drive.status, 401);
  assert.deepStrictEqual(drive.json, { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
});
