'use strict';

const DEFAULT_PORT = 8080;
const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB
const DEFAULT_CHUNK_SIZE_BYTES = 2 * 1024 * 1024; // 2 MiB
const CHUNK_SIZE_MIN_BYTES = 64 * 1024; // 64 KiB
const CHUNK_SIZE_MAX_BYTES = 8 * 1024 * 1024; // 8 MiB
const DEFAULT_CHUNKS_PER_MESSAGE = 10;
const DEFAULT_UPLOAD_CONCURRENCY = 4;
const DEFAULT_DOWNLOAD_CONCURRENCY = 6;
const DEFAULT_TRASH_RETENTION_DAYS = 30;
const DEFAULT_MAX_WEBHOOKS_PER_DRIVE = 8;
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const REQUIRED_VARS = [
  'APP_ORIGIN',
  'DB_URL',
  'DISCORD_CLIENT_ID',
  'DISCORD_CLIENT_SECRET',
  'DISCORD_REDIRECT_URI',
  'WYVERN_ENCRYPTION_KEY',
];

/** Parse an optional bounded integer env var; on invalid input record a diagnostic and fall back. */
function boundedIntEnv(value, key, min, max, fallback, invalid) {
  if (value === undefined || value === '') return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < min || n > max) {
    invalid.push({ key, message: `must be an integer between ${min} and ${max}` });
    return fallback;
  }
  return n;
}

/**
 * Shared environment validation used by both loadConfig (strict) and
 * diagnoseConfig (startup diagnostics).
 *
 * Returns parsed values plus:
 *  - missing: required variable names with no value
 *  - invalid: [{ key, message }] for non-secret validation problems
 *  - fatalPortError: set when PORT is unusable; the process cannot choose a
 *    listening port, so this is always fatal (never a setup diagnostic)
 *
 * The returned parsed values are deliberately minimal in diagnoseConfig so
 * secret values (client secret, bot token, encryption key material) are never
 * part of the diagnostics surface.
 */
function validateEnv(env = process.env) {
  const invalid = [];
  let fatalPortError = null;

  const missing = REQUIRED_VARS.filter((key) => !env[key]);

  let port = DEFAULT_PORT;
  if (env.PORT !== undefined && env.PORT !== '') {
    port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      fatalPortError = 'PORT must be an integer between 0 and 65535';
    }
  }

  let appOrigin = null;
  if (env.APP_ORIGIN) {
    try {
      const parsed = new URL(env.APP_ORIGIN);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('not http(s)');
      }
      appOrigin = env.APP_ORIGIN.replace(/\/+$/, '');
    } catch {
      invalid.push({ key: 'APP_ORIGIN', message: 'must be a valid http(s) URL' });
    }
  }

  if (env.DISCORD_REDIRECT_URI) {
    try {
      const parsed = new URL(env.DISCORD_REDIRECT_URI);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('not http(s)');
      }
    } catch {
      invalid.push({ key: 'DISCORD_REDIRECT_URI', message: 'must be an absolute http(s) URL' });
    }
  }

  let encryptionKey = null;
  if (env.WYVERN_ENCRYPTION_KEY) {
    let buf = null;
    try {
      buf = Buffer.from(env.WYVERN_ENCRYPTION_KEY, 'base64');
    } catch {
      buf = null;
    }
    if (!buf || buf.length !== 32) {
      invalid.push({ key: 'WYVERN_ENCRYPTION_KEY', message: 'must be a base64-encoded 32-byte key' });
    } else {
      encryptionKey = buf;
    }
  }

  let defaultQuotaBytes = DEFAULT_QUOTA_BYTES;
  if (env.DEFAULT_QUOTA_BYTES !== undefined && env.DEFAULT_QUOTA_BYTES !== '') {
    const n = Number(env.DEFAULT_QUOTA_BYTES);
    if (!Number.isInteger(n) || n <= 0) {
      invalid.push({ key: 'DEFAULT_QUOTA_BYTES', message: 'must be a positive integer' });
    } else {
      defaultQuotaBytes = n;
    }
  }

  const nodeEnv = env.NODE_ENV || 'development';

  let chunkSizeBytes = DEFAULT_CHUNK_SIZE_BYTES;
  if (env.WYVERN_CHUNK_SIZE_BYTES !== undefined && env.WYVERN_CHUNK_SIZE_BYTES !== '') {
    const n = Number(env.WYVERN_CHUNK_SIZE_BYTES);
    if (!Number.isInteger(n) || n < CHUNK_SIZE_MIN_BYTES || n > CHUNK_SIZE_MAX_BYTES) {
      invalid.push({
        key: 'WYVERN_CHUNK_SIZE_BYTES',
        message: `must be an integer between ${CHUNK_SIZE_MIN_BYTES} and ${CHUNK_SIZE_MAX_BYTES}`,
      });
    } else {
      chunkSizeBytes = n;
    }
  }
  const chunksPerMessage = boundedIntEnv(
    env.WYVERN_CHUNKS_PER_MESSAGE,
    'WYVERN_CHUNKS_PER_MESSAGE',
    1,
    10,
    DEFAULT_CHUNKS_PER_MESSAGE,
    invalid
  );
  const uploadConcurrency = boundedIntEnv(
    env.WYVERN_UPLOAD_CONCURRENCY,
    'WYVERN_UPLOAD_CONCURRENCY',
    1,
    16,
    DEFAULT_UPLOAD_CONCURRENCY,
    invalid
  );
  const downloadConcurrency = boundedIntEnv(
    env.WYVERN_DOWNLOAD_CONCURRENCY,
    'WYVERN_DOWNLOAD_CONCURRENCY',
    1,
    16,
    DEFAULT_DOWNLOAD_CONCURRENCY,
    invalid
  );

  let compressChunks = true;
  if (env.WYVERN_COMPRESS_CHUNKS !== undefined && env.WYVERN_COMPRESS_CHUNKS !== '') {
    const raw = String(env.WYVERN_COMPRESS_CHUNKS).toLowerCase();
    if (raw === '1' || raw === 'true') {
      compressChunks = true;
    } else if (raw === '0' || raw === 'false') {
      compressChunks = false;
    } else {
      invalid.push({ key: 'WYVERN_COMPRESS_CHUNKS', message: "must be '1'/'true' (on) or '0'/'false' (off)" });
    }
  }
  const trashRetentionDays = boundedIntEnv(
    env.WYVERN_TRASH_RETENTION_DAYS,
    'WYVERN_TRASH_RETENTION_DAYS',
    1,
    365,
    DEFAULT_TRASH_RETENTION_DAYS,
    invalid
  );
  const maxWebhooksPerDrive = boundedIntEnv(
    env.WYVERN_MAX_WEBHOOKS_PER_DRIVE,
    'WYVERN_MAX_WEBHOOKS_PER_DRIVE',
    1,
    32,
    DEFAULT_MAX_WEBHOOKS_PER_DRIVE,
    invalid
  );

  return {
    missing,
    invalid,
    fatalPortError,
    port,
    appOrigin,
    dbUrl: env.DB_URL || null,
    encryptionKey,
    defaultQuotaBytes,
    chunkSizeBytes,
    chunksPerMessage,
    uploadConcurrency,
    downloadConcurrency,
    compressChunks,
    trashRetentionDays,
    maxWebhooksPerDrive,
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  };
}

/**
 * Validate and load server configuration from an environment object.
 * Throws a descriptive Error listing every missing/invalid value.
 * Tests set every required variable explicitly; there is no blanket
 * "skip validation in test" path.
 */
function loadConfig(env = process.env) {
  const v = validateEnv(env);
  const errors = [];
  if (v.missing.length > 0) {
    errors.push(`missing required environment variables: ${v.missing.join(', ')}`);
  }
  for (const item of v.invalid) {
    errors.push(`${item.key} ${item.message}`);
  }
  if (v.fatalPortError) {
    errors.push(v.fatalPortError);
  }
  if (errors.length > 0) {
    throw new Error(`configuration error: ${errors.join('; ')}`);
  }

  return {
    port: v.port,
    appOrigin: v.appOrigin,
    dbUrl: env.DB_URL,
    discordClientId: env.DISCORD_CLIENT_ID,
    discordClientSecret: env.DISCORD_CLIENT_SECRET,
    discordRedirectUri: env.DISCORD_REDIRECT_URI,
    encryptionKey: v.encryptionKey,
    defaultQuotaBytes: v.defaultQuotaBytes,
    chunkSizeBytes: v.chunkSizeBytes,
    chunksPerMessage: v.chunksPerMessage,
    uploadConcurrency: v.uploadConcurrency,
    downloadConcurrency: v.downloadConcurrency,
    compressChunks: v.compressChunks,
    trashRetentionDays: v.trashRetentionDays,
    maxWebhooksPerDrive: v.maxWebhooksPerDrive,
    nodeEnv: v.nodeEnv,
    isProduction: v.isProduction,
    isTest: v.isTest,
  };
}

/**
 * Startup diagnostics: non-fatal validation for the setup-mode path.
 * Returns only missing variable names and non-secret invalid-variable
 * messages — never secret values. An invalid PORT throws because the process
 * cannot pick a listening port at all.
 *
 * The returned `config` is intentionally minimal (no credentials, no key
 * material) so it can be handed to the read-only setup app safely.
 */
function diagnoseConfig(env = process.env) {
  const v = validateEnv(env);
  if (v.fatalPortError) {
    throw new Error(`configuration error: ${v.fatalPortError}`);
  }
  return {
    missing: v.missing,
    invalid: v.invalid,
    config: {
      port: v.port,
      appOrigin: v.appOrigin,
      nodeEnv: v.nodeEnv,
      isProduction: v.isProduction,
      isTest: v.isTest,
    },
  };
}

module.exports = {
  loadConfig,
  diagnoseConfig,
  REQUIRED_VARS,
  DEFAULT_PORT,
  DEFAULT_QUOTA_BYTES,
  DEFAULT_CHUNK_SIZE_BYTES,
  DEFAULT_CHUNKS_PER_MESSAGE,
  DEFAULT_UPLOAD_CONCURRENCY,
  DEFAULT_DOWNLOAD_CONCURRENCY,
  DEFAULT_TRASH_RETENTION_DAYS,
  DEFAULT_MAX_WEBHOOKS_PER_DRIVE,
  SESSION_TTL_MS,
};
