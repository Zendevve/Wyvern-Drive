'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const { startTestServer, makeClient, login, uploadFile, makeFixture } = require('./helpers');

const EXPECTED_HEADERS = {
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'x-frame-options': 'SAMEORIGIN',
};

function assertSecurityHeaders(res, label) {
  for (const [name, value] of Object.entries(EXPECTED_HEADERS)) {
    assert.strictEqual(res.headers.get(name), value, `${label}: ${name}`);
  }
}

test('API responses carry the baseline security headers', async (t) => {
  const ctx = await startTestServer();
  t.after(() => ctx.close());

  const res = await makeClient(ctx.baseUrl).request('/api/auth/me');
  assert.strictEqual(res.status, 200);
  assertSecurityHeaders(res, 'GET /api/auth/me');
});

test('download responses carry the baseline security headers', async (t) => {
  const ctx = await startTestServer();
  t.after(() => ctx.close());
  const client = makeClient(ctx.baseUrl);
  await login(client, ctx);

  const { json: entry } = await uploadFile(client, { name: 'headers.bin', data: makeFixture(24), expect: 201 });
  const res = await client.request(`/api/files/${entry.id}/download`);
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.headers.get('content-disposition').startsWith('attachment'), true);
  assertSecurityHeaders(res, 'GET /api/files/:id/download');
});

test('SPA fallback responses carry the baseline security headers', async (t) => {
  // mountStatic serves ../web/build only when index.html exists. Create a
  // minimal build fixture for the duration of this test so the real SPA
  // fallback path (express.static + sendFile) runs; nothing else in the suite
  // requests non-API routes, so the fixture cannot shadow another test.
  const buildDir = path.join(__dirname, '..', 'web', 'build');
  const indexHtml = path.join(buildDir, 'index.html');
  fs.mkdirSync(buildDir, { recursive: true });
  fs.writeFileSync(indexHtml, '<!doctype html><html><body>wyvern test spa</body></html>');
  const ctx = await startTestServer();
  try {
    const res = await makeClient(ctx.baseUrl).request('/some/spa/route');
    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assertSecurityHeaders(res, 'SPA fallback');
  } finally {
    await ctx.close();
    fs.rmSync(indexHtml, { force: true });
    try {
      fs.rmdirSync(buildDir);
    } catch {
      // Already removed.
    }
  }
});
