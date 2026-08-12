'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createSetupApp } = require('../src/http/setup-app');
const { REQUIRED_VARS } = require('../src/config');
const { startTestServer, makeClient } = require('./helpers');

const VALID_ID = '123456789012345678';
const VALID_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const tmpDirs = [];
const openServers = [];

after(async () => {
  // Safety net: a failed test may never reach its finally close.
  for (const server of openServers) {
    await new Promise((resolve) => server.close(() => resolve()));
  }
  for (const dir of tmpDirs) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function makeTmpDir(prefix = 'wyvern-setup-config-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(dir);
  return dir;
}

/**
 * Boot the limited setup app on a random port with a temp env file. The env
 * file is created only when `seed` is given, so tests that assert "nothing
 * was written" can check for the file's absence.
 */
async function startSetupServer(opts = {}) {
  const tmpDir = makeTmpDir();
  const envFile = opts.envFile || path.join(tmpDir, '.env');
  if (opts.seed) {
    fs.mkdirSync(path.dirname(envFile), { recursive: true });
    fs.writeFileSync(envFile, opts.seed);
  }
  const setupToken = opts.setupToken || crypto.randomBytes(24).toString('base64url');
  const app = createSetupApp({
    missing: opts.missing || [...REQUIRED_VARS],
    invalid: opts.invalid || [],
    setupToken,
    envFile,
    initialEnv: opts.initialEnv || {},
  });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  openServers.push(server);
  return {
    baseUrl: `http://127.0.0.1:${server.address().port}`,
    port: server.address().port,
    envFile,
    setupToken,
    close() {
      return new Promise((resolve) => server.close(() => resolve()));
    },
  };
}

/**
 * Issue an HTTP request with a custom Host header so the setup app treats it
 * as non-local (the global fetch/undici forbids overriding Host). The TCP
 * connection still goes to 127.0.0.1; locality is decided by Host.
 */
function nonLoopbackRequest(port, opts) {
  const { method = 'GET', path: routePath = '/api/setup/credentials', host, origin, token, body } = opts;
  return new Promise((resolve, reject) => {
    const headers = { host };
    if (origin) headers.origin = origin;
    if (token) headers['x-wyvern-setup-token'] = token;
    if (body !== undefined) headers['content-type'] = 'application/json';
    const req = http.request(
      { host: '127.0.0.1', port, method, path: routePath, headers },
      (res) => {
        let data = '';
        res.on('data', (chunk) => {
          data += chunk;
        });
        res.on('end', () => {
          let json = null;
          try {
            json = JSON.parse(data);
          } catch {
            json = null;
          }
          resolve({ status: res.statusCode, text: data, json });
        });
      }
    );
    req.on('error', reject);
    req.end(body === undefined ? undefined : JSON.stringify(body));
  });
}

function loopbackPost(baseUrl, port, body) {
  return fetch(`${baseUrl}/api/setup/credentials`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      origin: `http://127.0.0.1:${port}`,
    },
    body: JSON.stringify(body),
  });
}

test('GET /api/setup/meta returns the exact loopback shape with nothing configured', async () => {
  const ctx = await startSetupServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/setup/meta`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), {
      writesSupported: true,
      tokenRequired: false,
      clientIdConfigured: false,
      clientSecretConfigured: false,
    });
  } finally {
    await ctx.close();
  }
});

test('GET /api/setup/meta reports configured flags from the process env snapshot', async () => {
  const ctx = await startSetupServer({
    initialEnv: { DISCORD_CLIENT_ID: VALID_ID, DISCORD_CLIENT_SECRET: VALID_SECRET },
  });
  try {
    const res = await fetch(`${ctx.baseUrl}/api/setup/meta`);
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), {
      writesSupported: true,
      tokenRequired: false,
      clientIdConfigured: true,
      clientSecretConfigured: true,
    });
  } finally {
    await ctx.close();
  }
});

test('GET /api/setup/meta requires the setup token for non-loopback requests', async () => {
  const ctx = await startSetupServer();
  try {
    const res = await nonLoopbackRequest(ctx.port, { path: '/api/setup/meta', host: 'example.com' });
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(res.json, {
      writesSupported: true,
      tokenRequired: true,
      clientIdConfigured: false,
      clientSecretConfigured: false,
    });
  } finally {
    await ctx.close();
  }
});

test('env-file credentials do not count as configured without a restart (boot env is authoritative)', async () => {
  // The operator edited server/.env with real credentials while the process
  // was already running; the boot env snapshot still lacks them. Saving
  // without supplying the credentials must fail clearly — never return a
  // success response that claims they are "still missing".
  const ctx = await startSetupServer({
    seed: `DISCORD_CLIENT_ID=${VALID_ID}\nDISCORD_CLIENT_SECRET=${VALID_SECRET}\n`,
    initialEnv: {},
  });
  try {
    const meta = await (await fetch(`${ctx.baseUrl}/api/setup/meta`)).json();
    assert.strictEqual(meta.clientIdConfigured, false);
    assert.strictEqual(meta.clientSecretConfigured, false);

    const res = await loopbackPost(ctx.baseUrl, ctx.port, {});
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'SETUP_VALIDATION_FAILED');
    assert.strictEqual(body.error.message, 'DISCORD_CLIENT_ID is required');

    const content = fs.readFileSync(ctx.envFile, 'utf8');
    assert.ok(content.includes(`DISCORD_CLIENT_ID=${VALID_ID}`), 'seeded credentials untouched');
    assert.ok(!content.includes('APP_ORIGIN='), 'no partial write');
  } finally {
    await ctx.close();
  }
});

test('already-configured credentials may be omitted and are not reported missing', async () => {
  // Counterpart: with valid credentials in the boot env, omitting them is
  // legal and the response must NOT list them as remaining-missing.
  const ctx = await startSetupServer({
    initialEnv: { DISCORD_CLIENT_ID: VALID_ID, DISCORD_CLIENT_SECRET: VALID_SECRET },
    missing: ['APP_ORIGIN'],
  });
  try {
    const res = await loopbackPost(ctx.baseUrl, ctx.port, { appOrigin: `http://127.0.0.1:${ctx.port}` });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.deepStrictEqual(body.saved, ['DB_URL', 'APP_ORIGIN']);
    assert.deepStrictEqual(body.generated, ['WYVERN_ENCRYPTION_KEY', 'DISCORD_REDIRECT_URI']);
    assert.deepStrictEqual(body.remainingMissing, []);
    assert.deepStrictEqual(body.remainingInvalid, []);

    const content = fs.readFileSync(ctx.envFile, 'utf8');
    assert.ok(content.includes(`APP_ORIGIN=http://127.0.0.1:${ctx.port}`));
    assert.ok(content.includes('DB_URL=./data/wyvern.db'));
    assert.ok(!content.includes('DISCORD_CLIENT_ID='), 'already-configured credentials are not rewritten');
  } finally {
    await ctx.close();
  }
});

test('POST /api/setup/credentials writes validated values and safe defaults, and never returns secrets', async () => {
  const ctx = await startSetupServer();
  try {
    const res = await loopbackPost(ctx.baseUrl, ctx.port, { clientId: VALID_ID, clientSecret: VALID_SECRET });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    const body = JSON.parse(text);

    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.restartRequired, true);
    assert.deepStrictEqual(body.saved, ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DB_URL', 'APP_ORIGIN']);
    assert.deepStrictEqual(body.generated, ['WYVERN_ENCRYPTION_KEY', 'DISCORD_REDIRECT_URI']);
    assert.deepStrictEqual(body.remainingMissing, []);
    assert.deepStrictEqual(body.remainingInvalid, []);

    // Exact key lines in the env file; the generated key is 44-char base64
    // (32 random bytes) and exists only in the file.
    const lines = fs.readFileSync(ctx.envFile, 'utf8').split(/\r?\n/).filter((l) => l !== '');
    assert.strictEqual(lines.length, 6, 'exactly the six intended keys should be written');
    const keyLine = lines.find((l) => l.startsWith('WYVERN_ENCRYPTION_KEY='));
    assert.ok(keyLine, 'the generated encryption key must be written to the env file');
    const keyValue = keyLine.slice('WYVERN_ENCRYPTION_KEY='.length);
    assert.match(keyValue, /^[A-Za-z0-9+/=]{44}$/);
    for (const line of [
      `DISCORD_CLIENT_ID=${VALID_ID}`,
      `DISCORD_CLIENT_SECRET=${VALID_SECRET}`,
      'DB_URL=./data/wyvern.db',
      `APP_ORIGIN=http://127.0.0.1:${ctx.port}`,
      `DISCORD_REDIRECT_URI=http://127.0.0.1:${ctx.port}/api/auth/discord/callback`,
      `WYVERN_ENCRYPTION_KEY=${keyValue}`,
    ]) {
      assert.ok(lines.includes(line), `env file should contain ${line}`);
    }

    // The raw response must never echo the secret, the generated key, or the
    // one-time setup token.
    assert.ok(!text.includes(VALID_SECRET), 'response must not contain the client secret');
    assert.ok(!text.includes(keyValue), 'response must not contain the generated encryption key');
    assert.ok(!text.includes(ctx.setupToken), 'response must not contain the setup token');
  } finally {
    await ctx.close();
  }
});

test('the setup token is one-time: reuse, missing, and wrong tokens are all rejected', async () => {
  const ctx = await startSetupServer();
  try {
    const body = { clientId: VALID_ID, clientSecret: VALID_SECRET };
    const opts = { method: 'POST', host: 'example.com', origin: 'https://example.com' };

    const first = await nonLoopbackRequest(ctx.port, { ...opts, token: ctx.setupToken, body });
    assert.strictEqual(first.status, 200);
    assert.strictEqual(first.json.ok, true);

    const reused = await nonLoopbackRequest(ctx.port, { ...opts, token: ctx.setupToken, body });
    assert.strictEqual(reused.status, 401);
    assert.strictEqual(reused.json.error.code, 'SETUP_TOKEN_INVALID');

    const missing = await nonLoopbackRequest(ctx.port, { ...opts, body });
    assert.strictEqual(missing.status, 401);
    assert.strictEqual(missing.json.error.code, 'SETUP_TOKEN_REQUIRED');

    const wrong = await nonLoopbackRequest(ctx.port, { ...opts, token: 'not-the-token', body });
    assert.strictEqual(wrong.status, 401);
    assert.strictEqual(wrong.json.error.code, 'SETUP_TOKEN_INVALID');
  } finally {
    await ctx.close();
  }
});

test('POST rejects an Origin that does not match a configured APP_ORIGIN', async () => {
  const ctx = await startSetupServer({ initialEnv: { APP_ORIGIN: 'http://localhost:3000' } });
  try {
    const res = await fetch(`${ctx.baseUrl}/api/setup/credentials`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: 'http://evil.example.com',
      },
      body: JSON.stringify({ clientId: VALID_ID, clientSecret: VALID_SECRET }),
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual((await res.json()).error.code, 'SETUP_ORIGIN_INVALID');
    assert.strictEqual(fs.existsSync(ctx.envFile), false, 'nothing may be written');
  } finally {
    await ctx.close();
  }
});

test('non-loopback setup requires HTTPS: a plain-http origin is rejected', async () => {
  const ctx = await startSetupServer();
  try {
    const res = await nonLoopbackRequest(ctx.port, {
      method: 'POST',
      host: 'example.com',
      origin: 'http://example.com',
      token: ctx.setupToken,
      body: { clientId: VALID_ID, clientSecret: VALID_SECRET },
    });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(res.json.error.code, 'SETUP_ORIGIN_INVALID');
  } finally {
    await ctx.close();
  }
});

test('malformed JSON returns 400 BAD_REQUEST', async () => {
  const ctx = await startSetupServer();
  try {
    const res = await fetch(`${ctx.baseUrl}/api/setup/credentials`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: `http://127.0.0.1:${ctx.port}`,
      },
      body: '{not json',
    });
    assert.strictEqual(res.status, 400);
    assert.deepStrictEqual(await res.json(), { error: { code: 'BAD_REQUEST', message: 'Malformed request body' } });
  } finally {
    await ctx.close();
  }
});

test('control characters in the client secret are rejected and the env file is untouched', async () => {
  const seed = '# seeded\nFOO=bar\n';
  const ctx = await startSetupServer({ seed });
  try {
    const before = fs.readFileSync(ctx.envFile, 'utf8');
    const injected = [`abc\n${'x'.repeat(16)}`, `abc\u0000${'x'.repeat(16)}`];
    for (const secret of injected) {
      const res = await loopbackPost(ctx.baseUrl, ctx.port, { clientId: VALID_ID, clientSecret: secret });
      assert.strictEqual(res.status, 400);
      assert.strictEqual((await res.json()).error.code, 'SETUP_VALIDATION_FAILED');
      assert.strictEqual(fs.readFileSync(ctx.envFile, 'utf8'), before, 'the env file must be unchanged');
    }
  } finally {
    await ctx.close();
  }
});

test('an invalid existing encryption key is never replaced', async () => {
  const ctx = await startSetupServer({
    initialEnv: { WYVERN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64') },
    invalid: [{ key: 'WYVERN_ENCRYPTION_KEY', message: 'must be a base64-encoded 32-byte key' }],
  });
  try {
    const res = await loopbackPost(ctx.baseUrl, ctx.port, { clientId: VALID_ID, clientSecret: VALID_SECRET });
    assert.strictEqual(res.status, 400);
    const body = await res.json();
    assert.strictEqual(body.error.code, 'SETUP_VALIDATION_FAILED');
    assert.match(body.error.message, /WYVERN_ENCRYPTION_KEY/);
    assert.strictEqual(fs.existsSync(ctx.envFile), false, 'nothing may be written');
  } finally {
    await ctx.close();
  }
});

test('a failed write returns 500 SETUP_WRITE_FAILED and leaves no partial file', async () => {
  const tmpDir = makeTmpDir('wyvern-setup-blocked-');
  const blocker = path.join(tmpDir, 'blocker');
  fs.writeFileSync(blocker, 'not a directory');
  const ctx = await startSetupServer({ envFile: path.join(blocker, 'nested', '.env') });
  try {
    const res = await loopbackPost(ctx.baseUrl, ctx.port, { clientId: VALID_ID, clientSecret: VALID_SECRET });
    assert.strictEqual(res.status, 500);
    assert.strictEqual((await res.json()).error.code, 'SETUP_WRITE_FAILED');
    assert.strictEqual(fs.readFileSync(blocker, 'utf8'), 'not a directory', 'the blocker must stay untouched');
    assert.strictEqual(fs.existsSync(path.join(blocker, 'nested')), false, 'no partial file tree may appear');
  } finally {
    await ctx.close();
  }
});

test('credential writes are limited to 10 per minute', async () => {
  const ctx = await startSetupServer();
  try {
    for (let i = 0; i < 10; i += 1) {
      const res = await loopbackPost(ctx.baseUrl, ctx.port, { clientSecret: 'x' });
      assert.strictEqual(res.status, 400, `request ${i + 1} should pass the limiter`);
      assert.strictEqual((await res.json()).error.code, 'SETUP_VALIDATION_FAILED');
    }
    const limited = await loopbackPost(ctx.baseUrl, ctx.port, { clientId: VALID_ID, clientSecret: VALID_SECRET });
    assert.strictEqual(limited.status, 429);
    assert.deepStrictEqual(await limited.json(), { error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
  } finally {
    await ctx.close();
  }
});

test('setup credential routes are absent in the full app', async () => {
  const ctx = await startTestServer();
  try {
    const client = makeClient(ctx.baseUrl);
    const meta = await client.request('/api/setup/meta');
    assert.strictEqual(meta.status, 404);
    assert.deepStrictEqual(meta.json, { error: { code: 'NOT_FOUND', message: 'Not found' } });

    const creds = await client.request('/api/setup/credentials', { method: 'POST' });
    assert.strictEqual(creds.status, 404);
    assert.deepStrictEqual(creds.json, { error: { code: 'NOT_FOUND', message: 'Not found' } });

    // The status contract in the full app is unchanged by the new routes.
    const status = await client.request('/api/setup/status');
    assert.strictEqual(status.status, 200);
    assert.deepStrictEqual(status.json, {
      setupRequired: false,
      usesWebhooks: true,
      storageMode: 'discord-webhooks-per-user',
      missing: [],
      invalid: [],
    });
  } finally {
    await ctx.close();
  }
});

test('an existing valid custom redirect URI is preserved and not regenerated', async () => {
  const customRedirect = 'https://custom.example.com/api/auth/discord/callback';
  const ctx = await startSetupServer({
    seed: `DISCORD_REDIRECT_URI=${customRedirect}\n`,
    initialEnv: { DISCORD_REDIRECT_URI: customRedirect },
  });
  try {
    const res = await loopbackPost(ctx.baseUrl, ctx.port, { clientId: VALID_ID, clientSecret: VALID_SECRET });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.ok(!body.generated.includes('DISCORD_REDIRECT_URI'), 'a valid custom redirect must not be regenerated');
    const lines = fs.readFileSync(ctx.envFile, 'utf8').split(/\r?\n/);
    assert.ok(
      lines.includes(`DISCORD_REDIRECT_URI=${customRedirect}`),
      'the custom redirect line must survive the write'
    );
  } finally {
    await ctx.close();
  }
});

test('unrelated env file content is preserved in place and in order', async () => {
  const seed = '# top comment\n\nFOO=bar\n# middle\nBAZ="quoted value"\n';
  const ctx = await startSetupServer({ seed });
  try {
    const res = await loopbackPost(ctx.baseUrl, ctx.port, { clientId: VALID_ID, clientSecret: VALID_SECRET });
    assert.strictEqual(res.status, 200);

    const lines = fs.readFileSync(ctx.envFile, 'utf8').split(/\r?\n/);
    const ordered = ['# top comment', '', 'FOO=bar', '# middle', 'BAZ="quoted value"'];
    let prev = -1;
    for (const want of ordered) {
      const idx = lines.indexOf(want, prev + 1);
      assert.ok(idx > prev, `expected ${JSON.stringify(want)} to appear in its original position`);
      prev = idx;
    }
    assert.ok(lines.includes(`DISCORD_CLIENT_ID=${VALID_ID}`), 'new keys are appended after the original content');
  } finally {
    await ctx.close();
  }
});
