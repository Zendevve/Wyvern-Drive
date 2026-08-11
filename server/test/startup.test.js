'use strict';

const { test, after } = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const SERVER_ROOT = path.join(__dirname, '..');

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
];

const VALID_ENV = {
  NODE_ENV: 'test',
  PORT: '0',
  APP_ORIGIN: 'http://localhost:3000',
  DB_URL: ':memory:',
  DISCORD_CLIENT_ID: 'cid',
  DISCORD_CLIENT_SECRET: 'csecret',
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
 */
function spawnLiveServer(env) {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, ['src/index.js'], { cwd: SERVER_ROOT, env });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => {
      stdout += d.toString();
      const m = stdout.match(/listening on http:\/\/localhost:(\d+)/);
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

test('index.js exits non-zero when PORT is invalid', async () => {
  const result = await runServer(cleanEnv({ PORT: 'abc' }));
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}`);
  assert.match(result.stderr, /PORT/);
});

test('index.js enters setup mode when env is incomplete and stays listening', async () => {
  const { child, port, stdout } = await spawnLiveServer(cleanEnv({ PORT: '0' }));
  liveChildren.push(child);
  assert.match(stdout, /\(setup mode\)/);

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
  await killAndWait(child);
});

test('setup mode reports malformed config, hides protected routes, and never leaks secrets', async () => {
  const secrets = {
    DISCORD_CLIENT_SECRET: 'TOP-SECRET-CLIENT-SECRET',
    DISCORD_BOT_TOKEN: 'TOP-SECRET-BOT-TOKEN',
  };
  const env = cleanEnv({
    ...VALID_ENV,
    ...secrets,
    WYVERN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'), // 16 bytes, not 32
    DISCORD_REDIRECT_URI: 'not-an-absolute-url',
  });
  const { child, port } = await spawnLiveServer(env);
  liveChildren.push(child);

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
