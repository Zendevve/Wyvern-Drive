'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadConfig, DEFAULT_PORT, DEFAULT_QUOTA_BYTES, PRODUCTION_CHUNK_SIZE_BYTES } = require('../src/config');

const VALID_ENV = {
  APP_ORIGIN: 'http://localhost:3000',
  DB_URL: ':memory:',
  DISCORD_CLIENT_ID: 'cid',
  DISCORD_CLIENT_SECRET: 'csecret',
  DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
  DISCORD_BOT_TOKEN: 'bot-token',
  DISCORD_STORAGE_GUILD_ID: '111',
  DISCORD_STORAGE_CATEGORY_ID: '222',
  WYVERN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  WYVERN_CHUNK_SIZE_BYTES: '8',
  NODE_ENV: 'test',
};

test('loadConfig accepts a complete valid environment', () => {
  const cfg = loadConfig(VALID_ENV);
  assert.strictEqual(cfg.appOrigin, 'http://localhost:3000');
  assert.strictEqual(cfg.dbUrl, ':memory:');
  assert.strictEqual(cfg.discordClientId, 'cid');
  assert.strictEqual(cfg.encryptionKey.length, 32);
  assert.strictEqual(cfg.defaultQuotaBytes, DEFAULT_QUOTA_BYTES);
  assert.strictEqual(cfg.port, DEFAULT_PORT);
  assert.strictEqual(cfg.chunkSizeBytes, 8); // WYVERN_CHUNK_SIZE_BYTES honored in test env
});

test('loadConfig strips a trailing slash from APP_ORIGIN', () => {
  const cfg = loadConfig({ ...VALID_ENV, APP_ORIGIN: 'http://localhost:3000/' });
  assert.strictEqual(cfg.appOrigin, 'http://localhost:3000');
});

test('loadConfig throws when each required variable is missing', () => {
  const required = [
    'APP_ORIGIN',
    'DB_URL',
    'DISCORD_CLIENT_ID',
    'DISCORD_CLIENT_SECRET',
    'DISCORD_REDIRECT_URI',
    'DISCORD_BOT_TOKEN',
    'DISCORD_STORAGE_GUILD_ID',
    'DISCORD_STORAGE_CATEGORY_ID',
    'WYVERN_ENCRYPTION_KEY',
  ];
  for (const key of required) {
    const env = { ...VALID_ENV };
    delete env[key];
    assert.throws(
      () => loadConfig(env),
      (err) => err.message.includes(key),
      `should complain about missing ${key}`
    );
  }
});

test('loadConfig throws listing all missing variables at once', () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: 'test' }),
    (err) => {
      for (const key of ['APP_ORIGIN', 'DB_URL', 'DISCORD_CLIENT_ID', 'WYVERN_ENCRYPTION_KEY']) {
        if (!err.message.includes(key)) return false;
      }
      return true;
    }
  );
});

test('loadConfig rejects a malformed encryption key', () => {
  // base64 of 16 bytes — not 32.
  assert.throws(
    () => loadConfig({ ...VALID_ENV, WYVERN_ENCRYPTION_KEY: Buffer.alloc(16, 2).toString('base64') }),
    /WYVERN_ENCRYPTION_KEY/
  );
  // invalid base64 characters
  assert.throws(
    () => loadConfig({ ...VALID_ENV, WYVERN_ENCRYPTION_KEY: '!!!not-base64!!!' }),
    /WYVERN_ENCRYPTION_KEY/
  );
});

test('loadConfig accepts a 32-byte key in any base64 form', () => {
  const cfg = loadConfig({ ...VALID_ENV, WYVERN_ENCRYPTION_KEY: Buffer.alloc(32, 3).toString('base64') });
  assert.strictEqual(cfg.encryptionKey.length, 32);
});

test('chunk size override only applies in test env', () => {
  const testCfg = loadConfig({ ...VALID_ENV, NODE_ENV: 'test', WYVERN_CHUNK_SIZE_BYTES: '8' });
  assert.strictEqual(testCfg.chunkSizeBytes, 8);

  const prodCfg = loadConfig({ ...VALID_ENV, NODE_ENV: 'production', WYVERN_CHUNK_SIZE_BYTES: '8' });
  assert.strictEqual(prodCfg.chunkSizeBytes, PRODUCTION_CHUNK_SIZE_BYTES);

  const defaultCfg = loadConfig({ ...VALID_ENV, NODE_ENV: 'development' });
  assert.strictEqual(defaultCfg.chunkSizeBytes, PRODUCTION_CHUNK_SIZE_BYTES);
});

test('loadConfig rejects an invalid chunk size in test env', () => {
  assert.throws(() => loadConfig({ ...VALID_ENV, NODE_ENV: 'test', WYVERN_CHUNK_SIZE_BYTES: '0' }), /WYVERN_CHUNK_SIZE_BYTES/);
  assert.throws(() => loadConfig({ ...VALID_ENV, NODE_ENV: 'test', WYVERN_CHUNK_SIZE_BYTES: 'abc' }), /WYVERN_CHUNK_SIZE_BYTES/);
});

test('loadConfig validates PORT', () => {
  assert.throws(() => loadConfig({ ...VALID_ENV, PORT: 'abc' }), /PORT/);
  assert.throws(() => loadConfig({ ...VALID_ENV, PORT: '70000' }), /PORT/);
  assert.strictEqual(loadConfig({ ...VALID_ENV, PORT: '9090' }).port, 9090);
});

test('loadConfig validates APP_ORIGIN and DEFAULT_QUOTA_BYTES', () => {
  assert.throws(() => loadConfig({ ...VALID_ENV, APP_ORIGIN: 'not-a-url' }), /APP_ORIGIN/);
  assert.throws(() => loadConfig({ ...VALID_ENV, APP_ORIGIN: 'ftp://x' }), /APP_ORIGIN/);
  assert.throws(() => loadConfig({ ...VALID_ENV, DEFAULT_QUOTA_BYTES: '0' }), /DEFAULT_QUOTA_BYTES/);
  assert.strictEqual(loadConfig({ ...VALID_ENV, DEFAULT_QUOTA_BYTES: '4096' }).defaultQuotaBytes, 4096);
});

test('loadConfig exposes environment flags', () => {
  const prod = loadConfig({ ...VALID_ENV, NODE_ENV: 'production' });
  assert.strictEqual(prod.isProduction, true);
  assert.strictEqual(prod.isTest, false);
  const test = loadConfig({ ...VALID_ENV, NODE_ENV: 'test' });
  assert.strictEqual(test.isTest, true);
});
