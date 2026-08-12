'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { loadConfig, diagnoseConfig, REQUIRED_VARS, DEFAULT_PORT, DEFAULT_QUOTA_BYTES, DEFAULT_CHUNK_SIZE_BYTES, DEFAULT_CHUNKS_PER_MESSAGE, DEFAULT_UPLOAD_CONCURRENCY, DEFAULT_DOWNLOAD_CONCURRENCY, DEFAULT_TRASH_RETENTION_DAYS, DEFAULT_MAX_WEBHOOKS_PER_DRIVE } = require('../src/config');

const VALID_ENV = {
  APP_ORIGIN: 'http://localhost:3000',
  DB_URL: ':memory:',
  DISCORD_CLIENT_ID: '123456789012345678',
  DISCORD_CLIENT_SECRET: 'abcdefghijklmnopqrstuvwxyz0123456789',
  DISCORD_REDIRECT_URI: 'http://localhost:3000/api/auth/discord/callback',
  WYVERN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString('base64'),
  WYVERN_CHUNK_SIZE_BYTES: '1048576', // 1 MiB — valid in every environment
  NODE_ENV: 'test',
};

test('loadConfig accepts a complete valid environment', () => {
  const cfg = loadConfig(VALID_ENV);
  assert.strictEqual(cfg.appOrigin, 'http://localhost:3000');
  assert.strictEqual(cfg.dbUrl, ':memory:');
  assert.strictEqual(cfg.discordClientId, '123456789012345678');
  assert.strictEqual(cfg.discordClientSecret, 'abcdefghijklmnopqrstuvwxyz0123456789');
  assert.strictEqual(cfg.encryptionKey.length, 32);
  assert.strictEqual(cfg.defaultQuotaBytes, DEFAULT_QUOTA_BYTES);
  assert.strictEqual(cfg.port, DEFAULT_PORT);
  assert.strictEqual(cfg.chunkSizeBytes, 1048576);
  assert.strictEqual(cfg.chunksPerMessage, DEFAULT_CHUNKS_PER_MESSAGE);
  assert.strictEqual(cfg.uploadConcurrency, DEFAULT_UPLOAD_CONCURRENCY);
  assert.strictEqual(cfg.downloadConcurrency, DEFAULT_DOWNLOAD_CONCURRENCY);
  assert.strictEqual(cfg.compressChunks, true, 'compression defaults on');
  assert.strictEqual(cfg.trashRetentionDays, DEFAULT_TRASH_RETENTION_DAYS);
  assert.strictEqual(cfg.maxWebhooksPerDrive, DEFAULT_MAX_WEBHOOKS_PER_DRIVE);
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

test('loadConfig parses and validates the roadmap variables (compression, trash retention, webhook cap)', () => {
  const cfg = loadConfig({
    ...VALID_ENV,
    WYVERN_COMPRESS_CHUNKS: '0',
    WYVERN_TRASH_RETENTION_DAYS: '7',
    WYVERN_MAX_WEBHOOKS_PER_DRIVE: '3',
  });
  assert.strictEqual(cfg.compressChunks, false);
  assert.strictEqual(cfg.trashRetentionDays, 7);
  assert.strictEqual(cfg.maxWebhooksPerDrive, 3);

  // Every accepted spelling of the boolean flag.
  for (const on of ['1', 'true', 'TRUE']) {
    assert.strictEqual(loadConfig({ ...VALID_ENV, WYVERN_COMPRESS_CHUNKS: on }).compressChunks, true, on);
  }
  for (const off of ['0', 'false', 'FALSE']) {
    assert.strictEqual(loadConfig({ ...VALID_ENV, WYVERN_COMPRESS_CHUNKS: off }).compressChunks, false, off);
  }
  // Empty/unset falls back to the default (on).
  assert.strictEqual(loadConfig({ ...VALID_ENV, WYVERN_COMPRESS_CHUNKS: '' }).compressChunks, true);
  const noCompress = { ...VALID_ENV };
  delete noCompress.WYVERN_COMPRESS_CHUNKS;
  assert.strictEqual(loadConfig(noCompress).compressChunks, true);

  // Invalid boolean spelling is rejected.
  assert.throws(() => loadConfig({ ...VALID_ENV, WYVERN_COMPRESS_CHUNKS: 'yes' }), /WYVERN_COMPRESS_CHUNKS/);
  assert.throws(() => loadConfig({ ...VALID_ENV, WYVERN_COMPRESS_CHUNKS: '2' }), /WYVERN_COMPRESS_CHUNKS/);

  // Bounded integers: defaults, valid edges, and out-of-range rejection.
  const defaults = loadConfig({ ...VALID_ENV });
  assert.strictEqual(defaults.trashRetentionDays, DEFAULT_TRASH_RETENTION_DAYS);
  assert.strictEqual(defaults.maxWebhooksPerDrive, DEFAULT_MAX_WEBHOOKS_PER_DRIVE);
  assert.strictEqual(loadConfig({ ...VALID_ENV, WYVERN_TRASH_RETENTION_DAYS: '1' }).trashRetentionDays, 1);
  assert.strictEqual(loadConfig({ ...VALID_ENV, WYVERN_TRASH_RETENTION_DAYS: '365' }).trashRetentionDays, 365);
  assert.strictEqual(loadConfig({ ...VALID_ENV, WYVERN_MAX_WEBHOOKS_PER_DRIVE: '1' }).maxWebhooksPerDrive, 1);
  assert.strictEqual(loadConfig({ ...VALID_ENV, WYVERN_MAX_WEBHOOKS_PER_DRIVE: '32' }).maxWebhooksPerDrive, 32);

  for (const bad of ['0', '366', '-1', 'abc']) {
    assert.throws(() => loadConfig({ ...VALID_ENV, WYVERN_TRASH_RETENTION_DAYS: bad }), /WYVERN_TRASH_RETENTION_DAYS/, bad);
  }
  for (const bad of ['0', '33', '-2', 'abc']) {
    assert.throws(() => loadConfig({ ...VALID_ENV, WYVERN_MAX_WEBHOOKS_PER_DRIVE: bad }), /WYVERN_MAX_WEBHOOKS_PER_DRIVE/, bad);
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

test('loadConfig rejects invalid Discord client credential formats', () => {
  // 17-20 digits required: too short, non-numeric, too long.
  for (const bad of ['abc', '1234567890123456', '123456789012345678901234567890123']) {
    assert.throws(() => loadConfig({ ...VALID_ENV, DISCORD_CLIENT_ID: bad }), /DISCORD_CLIENT_ID/, bad);
  }
  // 16-256 printable ASCII, no whitespace: too short, whitespace inside.
  for (const bad of ['x', 'short', 'has whitespace inside', 'not printable \u0007']) {
    assert.throws(() => loadConfig({ ...VALID_ENV, DISCORD_CLIENT_SECRET: bad }), /DISCORD_CLIENT_SECRET/, JSON.stringify(bad));
  }
});

test('diagnoseConfig reports invalid client credential formats with names and messages only', () => {
  const result = diagnoseConfig({
    ...VALID_ENV,
    DISCORD_CLIENT_ID: 'abc',
    DISCORD_CLIENT_SECRET: 'x',
  });
  assert.deepStrictEqual(result.missing, []);
  assert.strictEqual(result.invalid.length, 2);
  const byKey = Object.fromEntries(result.invalid.map((item) => [item.key, item.message]));
  assert.match(byKey.DISCORD_CLIENT_ID, /17-20 digit/);
  assert.match(byKey.DISCORD_CLIENT_SECRET, /16-256 printable/);

  // Diagnostics carry names and messages only — never the submitted values.
  const serialized = JSON.stringify(result);
  assert.ok(!serialized.includes('abc'), 'invalid values must not leak');
  assert.ok(!serialized.includes('DISCORD_CLIENT_ID='), 'no value assignments may appear');
  assert.throws(
    () => loadConfig({ ...VALID_ENV, DISCORD_CLIENT_ID: 'abc', DISCORD_CLIENT_SECRET: 'x' }),
    (err) => err.message.includes('DISCORD_CLIENT_ID') && err.message.includes('DISCORD_CLIENT_SECRET')
  );
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
