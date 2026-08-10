'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { execFile } = require('node:child_process');
const path = require('node:path');

const SERVER_ROOT = path.join(__dirname, '..');

const ALL_VARS = [
  'PORT',
  'APP_ORIGIN',
  'DB_URL',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'DISCORD_BOT_TOKEN',
  'DISCORD_STORAGE_GUILD_ID',
  'DISCORD_STORAGE_CATEGORY_ID',
  'WYVERN_ENCRYPTION_KEY',
  'DEFAULT_QUOTA_BYTES',
  'WYVERN_CHUNK_SIZE_BYTES',
];

function cleanEnv(extra = {}) {
  const env = { ...process.env };
  for (const key of ALL_VARS) delete env[key];
  return { ...env, ...extra };
}

function spawnServer(env) {
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

test('index.js exits non-zero with a missing-configuration error when env is incomplete', async () => {
  const result = await spawnServer(cleanEnv());
  assert.strictEqual(result.code, 1, `expected exit 1, got ${result.code}`);
  assert.match(result.stderr, /configuration/i);
});

test('index.js exits non-zero when the encryption key is malformed', async () => {
  const env = cleanEnv({
    NODE_ENV: 'test',
    APP_ORIGIN: 'http://localhost:3000',
    DB_URL: ':memory:',
    DISCORD_CLIENT_ID: 'cid',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
    DISCORD_BOT_TOKEN: 'bot',
    DISCORD_STORAGE_GUILD_ID: '1',
    DISCORD_STORAGE_CATEGORY_ID: '2',
    WYVERN_ENCRYPTION_KEY: Buffer.alloc(16, 1).toString('base64'),
  });
  const result = await spawnServer(env);
  assert.strictEqual(result.code, 1);
  assert.match(result.stderr, /WYVERN_ENCRYPTION_KEY/);
});

test('index.js starts and listens when configuration is valid', async () => {
  const env = cleanEnv({
    NODE_ENV: 'test',
    PORT: '0',
    APP_ORIGIN: 'http://localhost:3000',
    DB_URL: ':memory:',
    DISCORD_CLIENT_ID: 'cid',
    DISCORD_CLIENT_SECRET: 'secret',
    DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
    DISCORD_BOT_TOKEN: 'bot',
    DISCORD_STORAGE_GUILD_ID: '1',
    DISCORD_STORAGE_CATEGORY_ID: '2',
    WYVERN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  });
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
});
