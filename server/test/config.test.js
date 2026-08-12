'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadConfig, diagnoseConfig, REQUIRED_VARS, DEFAULT_PORT, DEFAULT_QUOTA_BYTES, DEFAULT_CHUNK_SIZE_BYTES, DEFAULT_CHUNKS_PER_MESSAGE, DEFAULT_UPLOAD_CONCURRENCY, DEFAULT_DOWNLOAD_CONCURRENCY } = require('../src/config');

const VALID_ENV = {
  APP_ORIGIN: 'http://localhost:3000',
  DB_URL: ':memory:',
  DISCORD_CLIENT_ID: 'cid',
  DISCORD_CLIENT_SECRET: 'csecret',
  DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
  WYVERN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  WYVERN_CHUNK_SIZE_BYTES: '1048576', // 1 MiB — valid in every environment
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
  assert.strictEqual(cfg.chunkSizeBytes, 1048576);
  assert.strictEqual(cfg.chunksPerMessage, DEFAULT_CHUNKS_PER_MESSAGE);
  assert.strictEqual(cfg.uploadConcurrency, DEFAULT_UPLOAD_CONCURRENCY);
  assert.strictEqual(cfg.downloadConcurrency, DEFAULT_DOWNLOAD_CONCURRENCY);
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

test('WYVERN_CHUNK_SIZE_BYTES is honored in every environment', () => {
  assert.strictEqual(loadConfig({ ...VALID_ENV, NODE_ENV: 'test' }).chunkSizeBytes, 1048576);
  assert.strictEqual(loadConfig({ ...VALID_ENV, NODE_ENV: 'production' }).chunkSizeBytes, 1048576);
  assert.strictEqual(loadConfig({ ...VALID_ENV, NODE_ENV: 'development' }).chunkSizeBytes, 1048576);

  // Unset -> the default (2 MiB) in every environment.
  const env = { ...VALID_ENV };
  delete env.WYVERN_CHUNK_SIZE_BYTES;
  assert.strictEqual(loadConfig({ ...env, NODE_ENV: 'production' }).chunkSizeBytes, DEFAULT_CHUNK_SIZE_BYTES);
  assert.strictEqual(loadConfig({ ...env, NODE_ENV: 'test' }).chunkSizeBytes, DEFAULT_CHUNK_SIZE_BYTES);
});

test('loadConfig rejects an out-of-range chunk size in every environment', () => {
  for (const bad of ['0', '8', '65535', '8388609', '99999999', 'abc', '-1']) {
    assert.throws(
      () => loadConfig({ ...VALID_ENV, NODE_ENV: 'production', WYVERN_CHUNK_SIZE_BYTES: bad }),
      /WYVERN_CHUNK_SIZE_BYTES/,
      `production ${bad}`
    );
    assert.throws(
      () => loadConfig({ ...VALID_ENV, NODE_ENV: 'test', WYVERN_CHUNK_SIZE_BYTES: bad }),
      /WYVERN_CHUNK_SIZE_BYTES/,
      `test ${bad}`
    );
  }
});

test('loadConfig parses and validates the upload packing variables', () => {
  const cfg = loadConfig({
    ...VALID_ENV,
    WYVERN_CHUNKS_PER_MESSAGE: '7',
    WYVERN_UPLOAD_CONCURRENCY: '3',
    WYVERN_DOWNLOAD_CONCURRENCY: '5',
  });
  assert.strictEqual(cfg.chunksPerMessage, 7);
  assert.strictEqual(cfg.uploadConcurrency, 3);
  assert.strictEqual(cfg.downloadConcurrency, 5);

  const defaults = loadConfig({ ...VALID_ENV });
  assert.strictEqual(defaults.chunksPerMessage, DEFAULT_CHUNKS_PER_MESSAGE);
  assert.strictEqual(defaults.uploadConcurrency, DEFAULT_UPLOAD_CONCURRENCY);
  assert.strictEqual(defaults.downloadConcurrency, DEFAULT_DOWNLOAD_CONCURRENCY);

  for (const bad of ['0', '11', 'abc', '-2']) {
    assert.throws(() => loadConfig({ ...VALID_ENV, WYVERN_CHUNKS_PER_MESSAGE: bad }), /WYVERN_CHUNKS_PER_MESSAGE/, bad);
  }
  for (const bad of ['0', '17', 'abc', '-1']) {
    assert.throws(() => loadConfig({ ...VALID_ENV, WYVERN_UPLOAD_CONCURRENCY: bad }), /WYVERN_UPLOAD_CONCURRENCY/, bad);
    assert.throws(() => loadConfig({ ...VALID_ENV, WYVERN_DOWNLOAD_CONCURRENCY: bad }), /WYVERN_DOWNLOAD_CONCURRENCY/, bad);
  }
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

test('loadConfig rejects a malformed DISCORD_REDIRECT_URI', () => {
  assert.throws(() => loadConfig({ ...VALID_ENV, DISCORD_REDIRECT_URI: 'not-a-url' }), /DISCORD_REDIRECT_URI/);
  assert.throws(() => loadConfig({ ...VALID_ENV, DISCORD_REDIRECT_URI: 'ftp://x/api/auth/discord/callback' }), /DISCORD_REDIRECT_URI/);
  const cfg = loadConfig({ ...VALID_ENV, DISCORD_REDIRECT_URI: 'https://drive.example.com/api/auth/discord/callback' });
  assert.strictEqual(cfg.discordRedirectUri, 'https://drive.example.com/api/auth/discord/callback');
});

test('loadConfig exposes environment flags', () => {
  const prod = loadConfig({ ...VALID_ENV, NODE_ENV: 'production' });
  assert.strictEqual(prod.isProduction, true);
  assert.strictEqual(prod.isTest, false);
  const test = loadConfig({ ...VALID_ENV, NODE_ENV: 'test' });
  assert.strictEqual(test.isTest, true);
});

test('diagnoseConfig reports a complete environment as fully configured', () => {
  const result = diagnoseConfig(VALID_ENV);
  assert.deepStrictEqual(result.missing, []);
  assert.deepStrictEqual(result.invalid, []);
  assert.strictEqual(result.config.port, DEFAULT_PORT);
  assert.strictEqual(result.config.appOrigin, 'http://localhost:3000');
});

test('diagnoseConfig lists missing variables without throwing', () => {
  const env = { NODE_ENV: 'test', PORT: '0' };
  const result = diagnoseConfig(env);
  assert.deepStrictEqual(result.missing, REQUIRED_VARS);
  assert.deepStrictEqual(result.invalid, []);
});

test('diagnoseConfig reports a malformed redirect URI as an invalid variable', () => {
  const result = diagnoseConfig({ ...VALID_ENV, DISCORD_REDIRECT_URI: 'not-a-url' });
  assert.deepStrictEqual(result.missing, []);
  assert.strictEqual(result.invalid.length, 1);
  assert.strictEqual(result.invalid[0].key, 'DISCORD_REDIRECT_URI');
  assert.match(result.invalid[0].message, /absolute http\(s\) URL/);
});

test('diagnoseConfig reports invalid credentials and keys as diagnostics', () => {
  const result = diagnoseConfig({
    ...VALID_ENV,
    DISCORD_CLIENT_ID: '',
    WYVERN_ENCRYPTION_KEY: Buffer.alloc(16, 2).toString('base64'),
    APP_ORIGIN: 'ftp://x',
  });
  assert.deepStrictEqual(result.missing, ['DISCORD_CLIENT_ID']);
  const keys = result.invalid.map((item) => item.key).sort();
  assert.deepStrictEqual(keys, ['APP_ORIGIN', 'WYVERN_ENCRYPTION_KEY']);
});

test('diagnoseConfig never exposes secret values', () => {
  const secretEnv = {
    ...VALID_ENV,
    DISCORD_CLIENT_SECRET: 's3cr3t-cl13nt',
    DISCORD_BOT_TOKEN: 's3cr3t-bot-token',
    WYVERN_ENCRYPTION_KEY: Buffer.alloc(32, 9).toString('base64'),
  };
  const result = diagnoseConfig(secretEnv);
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('s3cr3t-cl13nt'), 'client secret must not leak');
  assert.ok(!serialized.includes('s3cr3t-bot-token'), 'bot token must not leak');
  assert.strictEqual(result.config.encryptionKey, undefined, 'key material must not be in diagnostics config');
  assert.strictEqual(result.config.discordClientSecret, undefined);
  assert.strictEqual(result.config.discordBotToken, undefined);
});

test('diagnoseConfig throws on an invalid PORT', () => {
  assert.throws(() => diagnoseConfig({ ...VALID_ENV, PORT: 'abc' }), /PORT/);
  assert.throws(() => diagnoseConfig({ ...VALID_ENV, PORT: '70000' }), /PORT/);
});
