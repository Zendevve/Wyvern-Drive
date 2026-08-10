'use strict';

const DEFAULT_PORT = 8080;
const DEFAULT_QUOTA_BYTES = 10 * 1024 * 1024 * 1024; // 10 GiB
const PRODUCTION_CHUNK_SIZE_BYTES = 24 * 1024 * 1024; // stays below Discord's 25 MiB free upload limit
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

const REQUIRED_VARS = [
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

/**
 * Validate and load server configuration from an environment object.
 * Throws a descriptive Error listing every missing/invalid value.
 * Tests set every required variable explicitly; there is no blanket
 * "skip validation in test" path.
 */
function loadConfig(env = process.env) {
  const errors = [];

  const missing = REQUIRED_VARS.filter((key) => !env[key]);
  if (missing.length > 0) {
    errors.push(`missing required environment variables: ${missing.join(', ')}`);
  }

  let port = DEFAULT_PORT;
  if (env.PORT !== undefined && env.PORT !== '') {
    port = Number(env.PORT);
    if (!Number.isInteger(port) || port < 0 || port > 65535) {
      errors.push('PORT must be an integer between 0 and 65535');
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
      errors.push('APP_ORIGIN must be a valid http(s) URL');
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
      errors.push('WYVERN_ENCRYPTION_KEY must be a base64-encoded 32-byte key');
    } else {
      encryptionKey = buf;
    }
  }

  let defaultQuotaBytes = DEFAULT_QUOTA_BYTES;
  if (env.DEFAULT_QUOTA_BYTES !== undefined && env.DEFAULT_QUOTA_BYTES !== '') {
    const n = Number(env.DEFAULT_QUOTA_BYTES);
    if (!Number.isInteger(n) || n <= 0) {
      errors.push('DEFAULT_QUOTA_BYTES must be a positive integer');
    } else {
      defaultQuotaBytes = n;
    }
  }

  const nodeEnv = env.NODE_ENV || 'development';

  let chunkSizeBytes = PRODUCTION_CHUNK_SIZE_BYTES;
  if (
    nodeEnv === 'test' &&
    env.WYVERN_CHUNK_SIZE_BYTES !== undefined &&
    env.WYVERN_CHUNK_SIZE_BYTES !== ''
  ) {
    const n = Number(env.WYVERN_CHUNK_SIZE_BYTES);
    if (!Number.isInteger(n) || n <= 0) {
      errors.push('WYVERN_CHUNK_SIZE_BYTES must be a positive integer');
    } else {
      chunkSizeBytes = n;
    }
  }

  if (errors.length > 0) {
    throw new Error(`configuration error: ${errors.join('; ')}`);
  }

  return {
    port,
    appOrigin,
    dbUrl: env.DB_URL,
    discordClientId: env.DISCORD_CLIENT_ID,
    discordClientSecret: env.DISCORD_CLIENT_SECRET,
    discordRedirectUri: env.DISCORD_REDIRECT_URI,
    discordBotToken: env.DISCORD_BOT_TOKEN,
    discordStorageGuildId: env.DISCORD_STORAGE_GUILD_ID,
    discordStorageCategoryId: env.DISCORD_STORAGE_CATEGORY_ID,
    encryptionKey,
    defaultQuotaBytes,
    chunkSizeBytes,
    nodeEnv,
    isProduction: nodeEnv === 'production',
    isTest: nodeEnv === 'test',
  };
}

module.exports = {
  loadConfig,
  DEFAULT_PORT,
  DEFAULT_QUOTA_BYTES,
  PRODUCTION_CHUNK_SIZE_BYTES,
  SESSION_TTL_MS,
};
