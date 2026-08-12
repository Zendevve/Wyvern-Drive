'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const SERVER_ROOT = path.join(__dirname, '..');

const VALID_ID = '123456789012345678';
const VALID_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789';

const ALL_VARS = [
  'PORT',
  'APP_ORIGIN',
  'DB_URL',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'WYVERN_ENCRYPTION_KEY',
  'DEFAULT_QUOTA_BYTES',
  'WYVERN_CHUNK_SIZE_BYTES',
  'WYVERN_CHUNKS_PER_MESSAGE',
  'WYVERN_UPLOAD_CONCURRENCY',
  'WYVERN_DOWNLOAD_CONCURRENCY',
  'WYVERN_COMPRESS_CHUNKS',
  'WYVERN_TRASH_RETENTION_DAYS',
  'WYVERN_MAX_WEBHOOKS_PER_DRIVE',
];

const VALID_ENV = {
  NODE_ENV: 'test',
  PORT: '0',
  APP_ORIGIN: 'http://localhost:3000',
  DB_URL: ':memory:',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
  DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
  WYVERN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
};

function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of ALL_VARS) delete env[key];
  // NODE_ENV=test keeps the child from loading a developer's local .env.
  env.NODE_ENV = 'test';
  return { ...env, ...extra };
}

/** Run the server to completion; resolves { code, stdout, stderr }. */
function runServer(env) {
  return new Promise((resolve) => {
    execFile(
      process.execPath,
      ['src/index.js'],
      { cwd: SERVER_ROOT, env, timeout: 20000 },
      (error, stdout, stderr) => {
        resolve({ code: error && typeof error.code === 'number' ? error.code : error ? 1 : 0, stdout, stderr });
      }
    );
  });
}

/**
 * Start the server and resolve with { child, port, stdout, stderr } as soon as
 * it logs a bound port. The child stays running; callers must kill it.
 * `opts.cwd` overrides the working directory (defaults to the server root),
 * which lets a file-backed DB_URL resolve inside a temp dir.
 */
function spawnLiveServer(env, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [path.join(SERVER_ROOT, 'src', 'index.js')], {
      cwd: opts.cwd || SERVER_ROOT,
      env,
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      const m = stdout.match(/listening on http:\/\/(?:localhost|127\.0\.0\.1):(\d+)/);
      if (m) resolve({ child, port: Number(m[1]), stdout, stderr });
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('error', (err) => reject(err));
    child.on('exit', (code) => {
      reject(new Error(`server exited before listening (code ${code}): ${stderr}`));
    });
  });
}

const liveChildren = [];
after(() => Promise.all(liveChildren.map((c) => new Promise((r) => c.on('exit', r))).concat(
  liveChildren.map((c) => {
    c.kill();
    return Promise.resolve();
  })
)));

function killAndWait(child) {
  return new Promise((resolve) => {
    child.on('exit', resolve);
    child.kill();
  });
}

/**
 * Remove a temp dir, retrying on transient Windows handle locks (a child
 * process that ran with this dir as its cwd can briefly hold it after exit).
 */
async function rmrf(dir) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      fs.rmSync(dir, { recursive: true, force: true });
      return;
    } catch (err) {
      if (attempt >= 10 || (err.code !== 'EBUSY' && err.code !== 'EPERM')) throw err;
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
}

test('index.js exits non-zero when PORT is invalid', async () => {
  const result = await runServer(cleanEnv({ PORT: 'abc' }));
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}`);
  assert.match(result.stderr, /PORT/);
});

test('index.js enters setup mode when env is incomplete and stays listening', async () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-setup-mode-'));
  const envFile = path.join(tmpBase, '.env');
  try {
    const { child, port, stdout } = await spawnLiveServer(cleanEnv({ PORT: '0', WYVERN_ENV_FILE: envFile }));
    liveChildren.push(child);
    assert.match(stdout, /\(setup mode\)/);
    assert.match(stdout, /Wyvern server setup token: [A-Za-z0-9_-]+/);

    const res = await fetch(`http://127.0.0.1:${port}/api/setup/status`);
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.setupRequired, true);
    assert.strictEqual(body.usesWebhooks, true);
    assert.strictEqual(body.storageMode, 'discord-webhooks-per-user');
    assert.deepStrictEqual(body.invalid, []);
    for (const key of [
      'APP_ORIGIN',
      'DB_URL',
      'DISCORD_CLIENT_ID',
      'DISCORD_CLIENT_SECRET',
      'DISCORD_REDIRECT_URI',
      'WYVERN_ENCRYPTION_KEY',
    ]) {
      assert.ok(body.missing.includes(key), `missing should include ${key}`);
    }

    // The setup-only metadata and credential-write routes are mounted.
    const meta = await fetch(`http://127.0.0.1:${port}/api/setup/meta`);
    assert.strictEqual(meta.status, 200);
    assert.deepStrictEqual(await meta.json(), {
      writesSupported: true,
      tokenRequired: false,
      clientIdConfigured: false,
      clientSecretConfigured: false,
    });
    const creds = await fetch(`http://127.0.0.1:${port}/api/setup/credentials`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: `http://127.0.0.1:${port}` },
      body: JSON.stringify({}),
    });
    assert.strictEqual(creds.status, 400);
    assert.strictEqual((await creds.json()).error.code, 'SETUP_VALIDATION_FAILED');

    await killAndWait(child);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('setup mode reports malformed config, hides protected routes, and never leaks secrets', async () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-setup-malformed-'));
  const envFile = path.join(tmpBase, '.env');
  try {
    const secrets = {
      DISCORD_CLIENT_SECRET: 'TOP-SECRET-CLIENT-SECRET',
      DISCORD_BOT_TOKEN: 'TOP-SECRET-BOT-TOKEN',
    };
    const env = cleanEnv({
      ...VALID_ENV,
      ...secrets,
      WYVERN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'), // 16 bytes, not 32
      DISCORD_REDIRECT_URI: 'not-an-absolute-url',
      WYVERN_ENV_FILE: envFile,
    });
    const { child, port, stdout, stderr } = await spawnLiveServer(env);
    liveChildren.push(child);

    assert.match(stdout, /Wyvern server setup token: [A-Za-z0-9_-]+/);
    const logs = stdout + stderr;
    assert.ok(!logs.includes('TOP-SECRET'), 'setup logs must not contain secret values');

    const res = await fetch(`http://127.0.0.1:${port}/api/setup/status`);
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    const body = JSON.parse(text);
    assert.strictEqual(body.setupRequired, true);
    assert.deepStrictEqual(body.missing, []);
    const invalidKeys = body.invalid.map((item) => item.key).sort();
    assert.deepStrictEqual(invalidKeys, ['DISCORD_REDIRECT_URI', 'WYVERN_ENCRYPTION_KEY']);
    const redirect = body.invalid.find((item) => item.key === 'DISCORD_REDIRECT_URI');
    assert.match(redirect.message, /absolute http\(s\) URL/);
    // No secret values anywhere in the diagnostics response.
    assert.ok(!text.includes('TOP-SECRET'), 'status must not contain secret values');

    // Partial protected behavior must not be exposed in setup mode.
    const folders = await fetch(`http://127.0.0.1:${port}/api/folders`, { method: 'POST' });
    assert.strictEqual(folders.status, 404);
    assert.deepStrictEqual(await folders.json(), { error: { code: 'NOT_FOUND', message: 'Not found' } });
    const me = await fetch(`http://127.0.0.1:${port}/api/auth/me`);
    assert.strictEqual(me.status, 404);
    await killAndWait(child);
  } finally {
    fs.rmSync(tmpBase, { recursive: true, force: true });
  }
});

test('index.js starts and listens when configuration is valid', async () => {
  const env = cleanEnv(VALID_ENV);
  const outcome = await new Promise((resolve) => {
    const child = execFile(process.execPath, ['src/index.js'], { cwd: SERVER_ROOT, env });
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.includes('listening')) {
        child.kill();
      }
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: String(err) }));
  });
  assert.match(outcome.stdout, /Wyvern server listening/);
  assert.ok(!outcome.stdout.includes('setup mode'), 'complete config must not enter setup mode');
  assert.ok(!outcome.stdout.includes('Wyvern server setup token'), 'complete config must not print a setup token');
});

test('index.js creates the parent directory for a file-backed DB_URL', async () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-db-parent-'));
  const dbUrl = path.join(tmpBase, 'nested', 'deep', 'data', 'wyvern.db');
  const env = cleanEnv({ ...VALID_ENV, DB_URL: dbUrl });
  const outcome = await new Promise((resolve) => {
    const child = execFile(process.execPath, ['src/index.js'], { cwd: SERVER_ROOT, env });
    let stderr = '';
    let stdout = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      if (stdout.includes('listening')) {
        child.kill();
      }
    });
    child.stderr.on('data', (d) => {
      stderr += d.toString();
    });
    child.on('exit', (code) => resolve({ code, stdout, stderr }));
    child.on('error', (err) => resolve({ code: -1, stdout, stderr: String(err) }));
  });
  assert.match(outcome.stdout, /Wyvern server listening/);
  assert.ok(fs.existsSync(path.dirname(dbUrl)), 'DB parent directory should be created');
  fs.rmSync(tmpBase, { recursive: true, force: true });
});

test('setup mode writes credentials, then a restart with the written file leaves setup mode', async () => {
  const tmpBase = fs.mkdtempSync(path.join(os.tmpdir(), 'wyvern-setup-restart-'));
  try {
    const envFile = path.join(tmpBase, '.env');
    const first = await spawnLiveServer(cleanEnv({ PORT: '0', WYVERN_ENV_FILE: envFile }));
    liveChildren.push(first.child);
    const tokenMatch = first.stdout.match(/Wyvern server setup token: ([A-Za-z0-9_-]+)/);
    assert.ok(tokenMatch, 'setup mode should print the one-time setup token');

    const meta = await fetch(`http://127.0.0.1:${first.port}/api/setup/meta`);
    assert.strictEqual(meta.status, 200);

    const res = await fetch(`http://127.0.0.1:${first.port}/api/setup/credentials`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        origin: `http://127.0.0.1:${first.port}`,
      },
      body: JSON.stringify({ clientId: VALID_ID, clientSecret: VALID_SECRET }),
    });
    assert.strictEqual(res.status, 200);
    const text = await res.text();
    assert.ok(!text.includes(VALID_SECRET), 'the credentials response must not include the client secret');

    await killAndWait(first.child);

    // Restart with every value the writer placed in the env file, carried in
    // the process environment (NODE_ENV=test skips dotenv, so this simulates
    // what dotenv would load). The child runs in tmpBase so the file's
    // relative DB_URL=./data/wyvern.db resolves inside the temp dir.
    const parsed = {};
    for (const line of fs.readFileSync(envFile, 'utf8').split(/\r?\n/)) {
      const m = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/.exec(line);
      if (m) parsed[m[1]] = m[2].replace(/^"(.*)"$/, (_, v) => v).replace(/^'(.*)'$/, (_, v) => v);
    }

    const second = await spawnLiveServer(cleanEnv({ ...parsed, PORT: String(first.port) }), { cwd: tmpBase });
    liveChildren.push(second.child);
    // The full-mode log prints config.appOrigin (the file's APP_ORIGIN, which
    // carries the first child's port), so the restart must actually bind that
    // same port or the log-based port discovery would point at a dead socket.
    assert.match(second.stdout, /Wyvern server listening/);
    assert.ok(!second.stdout.includes('setup mode'), 'restart with the written values must leave setup mode');

    const status = await fetch(`http://127.0.0.1:${second.port}/api/setup/status`);
    assert.strictEqual(status.status, 200);
    assert.deepStrictEqual(await status.json(), {
      setupRequired: false,
      usesWebhooks: true,
      storageMode: 'discord-webhooks-per-user',
      missing: [],
      invalid: [],
    });

    const metaAfter = await fetch(`http://127.0.0.1:${second.port}/api/setup/meta`);
    assert.strictEqual(metaAfter.status, 404);
    const credsAfter = await fetch(`http://127.0.0.1:${second.port}/api/setup/credentials`, { method: 'POST' });
    assert.strictEqual(credsAfter.status, 404);

    await killAndWait(second.child);
  } finally {
    await rmrf(tmpBase);
  }
});
