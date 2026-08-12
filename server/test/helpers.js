'use strict';

const path = require('node:path');
const crypto = require('node:crypto');
const assert = require('node:assert');
const { WyvernError } = require('../src/errors');
const { loadConfig } = require('../src/config');
const { openDatabase, closeDatabase, run, get, all } = require('../src/db/connection');
const { migrate } = require('../src/db/migrate');
const { createRepositories } = require('../src/db/repositories');
const { createSessionStore } = require('../src/auth/session-store');
const { createDiscordOAuth } = require('../src/auth/discord-oauth');
const { createFileService } = require('../src/services/file-service');
const { createApp } = require('../src/http/app');

const ORIGIN = 'http://localhost:3000';
const MIGRATIONS_DIR = path.join(__dirname, '..', 'src', 'db', 'migrations');
const DEFAULT_WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test-token';
const WEBHOOK_URL_RE = /^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/;

// Deterministic test environment. Tests set every required variable explicitly;
// there is no blanket "skip validation" path.
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = ORIGIN;
process.env.DB_URL = ':memory:';
process.env.DISCORD_CLIENT_ID = '123456789012345678';
process.env.DISCORD_CLIENT_SECRET = 'abcdefghijklmnopqrstuvwxyz0123456789';
process.env.DISCORD_REDIRECT_URI = `${ORIGIN}/api/auth/discord/callback`;
process.env.WYVERN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
// Smallest config-valid chunk size (64 KiB). Individual tests that need
// per-byte chunk granularity opt into `chunkSizeBytes: 8` via startTestServer
// overrides; config validation itself is pinned in config.test.js.
process.env.WYVERN_CHUNK_SIZE_BYTES = '65536';
process.env.DEFAULT_QUOTA_BYTES = '1048576';

function sha256hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/** Deterministic 24-byte fixture that splits into exactly 3 x 8-byte chunks. */
function makeFixture(size = 24) {
  return Buffer.from(Array.from({ length: size }, (_, i) => (i * 7 + 13) % 256));
}

function fakeJsonResponse(body, status = 200) {
  const text = JSON.stringify(body);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => text,
    arrayBuffer: async () => Buffer.from(text),
  };
}

/** Stubbed Discord OAuth: returns the current user from fn.currentUser. */
function createFakeOAuthFetch() {
  const fn = async (url, opts) => {
    if (url === 'https://discord.com/api/oauth2/token') {
      return fakeJsonResponse({ access_token: 'test-access-token', token_type: 'Bearer', expires_in: 604800, scope: 'identify' });
    }
    if (url === 'https://discord.com/api/users/@me') {
      const u = fn.currentUser;
      return fakeJsonResponse({ id: u.id, username: u.username, avatar: u.avatar ?? null });
    }
    throw new Error(`unexpected fetch url: ${url}`);
  };
  fn.currentUser = { id: '1001', username: 'alice', avatar: null };
  return fn;
}

/**
 * In-memory fake DiscordStorage. Models webhook credential configuration
 * (validateAndSealWebhook over a set of accepted URLs) and per-webhook
 * message storage, with failure injection: failNextWebhookValidations,
 * failNextPutChunks, failPutChunkOnCall, failNextGetChunks,
 * failNextDeleteChunks, failDeleteChunkOnCall.
 *
 * Chunk operations take WEBHOOK CREDENTIALS ({ id, drive_id,
 * webhook_ciphertext, ... }) exactly like the real adapter — the file
 * service passes `webhooks` table rows through — so messages are stored per
 * webhook.id and the fake tracks which webhooks a drive has seen
 * (webhooksByDrive). Tests map drive -> webhook ids through the repository
 * (listWebhooks(driveId)) or the fake's webhooksForDrive(driveId), then read
 * the per-webhook store via messagesForWebhook(webhookId).
 *
 * Messages hold 1..10 attachments (packed uploads). Counting and failure
 * injection are PER-CHUNK — putCalls increments once per chunk, and
 * failNextPutChunks / failPutChunkOnCall trip on the matching chunk inside a
 * putChunks batch — so "the second chunk fails" tests keep working with
 * batched uploads. A failing batch is atomic: nothing of it is stored
 * (mirrors the real adapter, which posts each batch as one message). delete
 * is idempotent, matching the real adapter's 404-as-success contract.
 */
function createFakeDiscordStorage() {
  const webhooksByDrive = new Map(); // driveId -> webhook credentials seen by putChunks
  const stores = new Map(); // webhookId -> Map(messageId -> [{ filename, buffer }])
  const deletedMessages = [];
  const storage = {
    failNextWebhookValidations: 0,
    webhookValidationCalls: 0,
    failNextPutChunks: 0,
    failPutChunkOnCall: 0,
    putCalls: 0,
    failNextGetChunks: 0,
    failNextDeleteChunks: 0,
    failDeleteChunkOnCall: 0,
    deleteCalls: 0,
    msgSeq: 0,
    deletedMessages,
    postCountsByWebhook: new Map(), // webhookId -> putChunks batches posted
    validWebhooks: new Set([DEFAULT_WEBHOOK_URL]),

    async validateAndSealWebhook(webhookUrl) {
      const trimmed = String(webhookUrl).trim();
      // Mirror the real adapter: malformed URLs are rejected before any
      // Discord call, so they never touch the validation counter.
      if (!WEBHOOK_URL_RE.test(trimmed)) {
        throw new WyvernError('INVALID_WEBHOOK', 'Webhook URL must be an HTTPS Discord webhook URL', 400);
      }
      storage.webhookValidationCalls += 1;
      if (storage.failNextWebhookValidations > 0) {
        storage.failNextWebhookValidations -= 1;
        throw storageError('fake: discord unavailable');
      }
      if (!storage.validWebhooks.has(trimmed)) {
        throw new WyvernError('INVALID_WEBHOOK', 'Webhook URL is not a valid Discord webhook', 400);
      }
      return {
        webhook_ciphertext: Buffer.from(`cipher:${trimmed}`),
        webhook_nonce: Buffer.from(`nonce:${trimmed}`),
        webhook_auth_tag: Buffer.from(`tag:${trimmed}`),
      };
    },

    /**
     * Store one batch of chunks as a single message (one attachment per
     * chunk). Resolves [{ ordinal, messageId }] in input order. The counter
     * loop runs before any store mutation, so a tripped counter aborts the
     * whole batch atomically. Credentials come from the `webhooks` table, so
     * the drive id is available to track webhooksByDrive.
     */
    async putChunks(webhook, chunks) {
      if (!webhook || webhook.id === undefined || webhook.id === null) {
        throw storageError('fake: missing webhook credential');
      }
      for (const chunk of chunks) {
        storage.putCalls += 1;
        if (storage.failPutChunkOnCall > 0 && storage.putCalls === storage.failPutChunkOnCall) {
          throw storageError('fake: putChunk failed');
        }
        if (storage.failNextPutChunks > 0) {
          storage.failNextPutChunks -= 1;
          throw storageError('fake: putChunk failed');
        }
      }
      if (webhook.drive_id !== undefined && webhook.drive_id !== null) {
        let driveWebhooks = webhooksByDrive.get(webhook.drive_id);
        if (!driveWebhooks) {
          driveWebhooks = [];
          webhooksByDrive.set(webhook.drive_id, driveWebhooks);
        }
        if (!driveWebhooks.some((w) => w.id === webhook.id)) {
          driveWebhooks.push(webhook);
        }
      }
      let msgs = stores.get(webhook.id);
      if (!msgs) {
        msgs = new Map();
        stores.set(webhook.id, msgs);
      }
      storage.msgSeq += 1;
      const messageId = `msg-${storage.msgSeq}`;
      msgs.set(
        messageId,
        chunks.map((chunk) => ({ filename: chunk.filename, buffer: Buffer.from(chunk.encryptedBuffer) }))
      );
      storage.postCountsByWebhook.set(webhook.id, (storage.postCountsByWebhook.get(webhook.id) || 0) + 1);
      return chunks.map((chunk) => ({ ordinal: chunk.ordinal, messageId }));
    },

    async putChunk(webhook, filename, encryptedBuffer) {
      const results = await storage.putChunks(webhook, [{ filename, encryptedBuffer, ordinal: 0 }]);
      return results[0].messageId;
    },

    async getChunk(webhook, messageId, attachmentIndex = 0) {
      if (storage.failNextGetChunks > 0) {
        storage.failNextGetChunks -= 1;
        throw storageError('fake: getChunk failed');
      }
      const msgs = stores.get(webhook.id);
      const attachments = msgs && msgs.get(messageId);
      const attachment = attachments && attachments[attachmentIndex];
      if (!attachment) throw storageError('fake: chunk not found');
      return Buffer.from(attachment.buffer);
    },

    async deleteChunk(webhook, messageId) {
      storage.deleteCalls += 1;
      if (storage.failDeleteChunkOnCall > 0 && storage.deleteCalls === storage.failDeleteChunkOnCall) {
        throw storageError('fake: deleteChunk failed');
      }
      if (storage.failNextDeleteChunks > 0) {
        storage.failNextDeleteChunks -= 1;
        throw storageError('fake: deleteChunk failed');
      }
      const msgs = stores.get(webhook.id);
      if (msgs && msgs.has(messageId)) {
        msgs.delete(messageId);
        deletedMessages.push({ webhookId: webhook.id, messageId });
      }
      // Missing message: idempotent success (mirrors the real adapter).
    },

    /** Unique Discord message ids across all webhooks (packed chunks share one). */
    countMessages() {
      let n = 0;
      for (const msgs of stores.values()) n += msgs.size;
      return n;
    },

    /** Total attachment count across all webhooks (one per chunk). */
    countAttachments() {
      let n = 0;
      for (const msgs of stores.values()) {
        for (const attachments of msgs.values()) n += attachments.length;
      }
      return n;
    },

    /** Webhook credentials the fake has seen chunks posted for, per drive. */
    webhooksForDrive(driveId) {
      return webhooksByDrive.get(driveId) || [];
    },

    /** Messages stored for one webhook: Map(messageId -> attachments). */
    messagesForWebhook(webhookId) {
      return stores.get(webhookId);
    },
  };
  return storage;
}

function storageError(message) {
  return new WyvernError('STORAGE_UNAVAILABLE', message, 502);
}

/** Boot a full app on a random port with an in-memory DB and fake Discord. */
async function startTestServer(overrides = {}) {
  const env = { ...process.env };
  if (overrides.quotaBytes != null) env.DEFAULT_QUOTA_BYTES = String(overrides.quotaBytes);
  const config = loadConfig(env);
  // Test-only fixture control: config validation (64 KiB..8 MiB) is pinned in
  // config.test.js; service-level tests may shrink chunks so multi-chunk
  // fixtures stay tiny (e.g. 8 bytes for the classic 24-byte / 3-chunk case).
  if (overrides.chunkSizeBytes != null) config.chunkSizeBytes = overrides.chunkSizeBytes;
  if (overrides.compressChunks != null) config.compressChunks = overrides.compressChunks;
  if (overrides.maxWebhooksPerDrive != null) config.maxWebhooksPerDrive = overrides.maxWebhooksPerDrive;
  if (overrides.trashRetentionDays != null) config.trashRetentionDays = overrides.trashRetentionDays;

  const db = await openDatabase(config.dbUrl);
  await migrate(db, MIGRATIONS_DIR);
  const repositories = createRepositories(db);
  const sessionStore = createSessionStore(repositories);

  const oauthFetch = createFakeOAuthFetch();
  if (overrides.oauthUser) oauthFetch.currentUser = overrides.oauthUser;
  const oauth = createDiscordOAuth(config, oauthFetch);
  const discordStorage = overrides.storage || createFakeDiscordStorage();
  const fileService = createFileService({ db, repositories, discordStorage, config });

  const app = createApp({ config, db, repositories, sessionStore, oauth, discordStorage, fileService });
  const server = await new Promise((resolve) => {
    const s = app.listen(0, () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  return {
    baseUrl,
    config,
    db,
    repositories,
    sessionStore,
    oauth,
    oauthFetch,
    discordStorage,
    fileService,
    server,
    async close() {
      await new Promise((resolve) => server.close(resolve));
      await closeDatabase(db);
    },
  };
}

/**
 * HTTP client with a cookie jar. `csrf: true` injects X-CSRF-Token from the
 * jar plus the APP_ORIGIN Origin header on state-changing requests.
 */
function makeClient(baseUrl) {
  const jar = {}; // cookie name -> value

  function absorb(res) {
    const setCookies = typeof res.headers.getSetCookie === 'function' ? res.headers.getSetCookie() : [];
    for (const header of setCookies) {
      const pair = header.split(';')[0];
      const eq = pair.indexOf('=');
      const name = pair.slice(0, eq).trim();
      let value = pair.slice(eq + 1).trim();
      if (value === '' || /max-age=0/i.test(header)) delete jar[name];
      else jar[name] = value;
    }
  }

  async function request(route, opts = {}) {
    const { method = 'GET', body, headers = {}, cookies, redirect = 'follow', csrf = false, expect } = opts;
    const hdrs = new Headers(headers);
    const cookieHeader = Object.entries({ ...jar, ...(cookies || {}) })
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
    if (cookieHeader) hdrs.set('cookie', cookieHeader);
    if (csrf) {
      hdrs.set('x-csrf-token', jar.wyvern_csrf || '');
      hdrs.set('origin', ORIGIN);
    }
    const res = await fetch(baseUrl + route, { method, headers: hdrs, body, redirect });
    absorb(res);
    const contentType = res.headers.get('content-type') || '';
    let json = null;
    if (contentType.includes('application/json')) {
      try {
        json = await res.json();
      } catch {
        json = null;
      }
    }
    if (expect !== undefined) {
      assert.strictEqual(res.status, expect, `expected ${expect}, got ${res.status}: ${JSON.stringify(json)}`);
    }
    return { status: res.status, headers: res.headers, json, cookies: { ...jar }, raw: res };
  }

  return { request, jar };
}

/** Run the real OAuth flow: /api/auth/discord then the callback. */
async function performOAuth(client) {
  let res = await client.request('/api/auth/discord', { redirect: 'manual' });
  assert.strictEqual(res.status, 302, 'GET /api/auth/discord should redirect');
  const location = res.headers.get('location');
  assert.ok(location && location.startsWith('https://discord.com/api/oauth2/authorize'), 'should redirect to Discord');
  const state = new URL(location).searchParams.get('state');
  assert.ok(state, 'authorize URL should carry a state');
  res = await client.request(
    `/api/auth/discord/callback?code=test-code&state=${encodeURIComponent(state)}`,
    { redirect: 'manual' }
  );
  return res;
}

/** Configure the fake-accepted webhook for the signed-in user (201 expected). */
async function configureWebhook(client, webhookUrl = DEFAULT_WEBHOOK_URL) {
  return client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
}

/**
 * Login as the oauth fetch's current user and assert a successful session.
 * A fresh user redirects to /connect; the default flow then configures a
 * webhook so drive/file operations work. Pass opts.noWebhook to stop after
 * the callback, or opts.webhookUrl to use a specific URL.
 */
async function login(client, ctx, opts = {}) {
  if (opts.as) ctx.oauthFetch.currentUser = opts.as;
  const res = await performOAuth(client);
  assert.strictEqual(res.status, 302);
  const location = res.headers.get('location');
  assert.ok(location.endsWith('/connect'), `expected redirect to /connect, got ${location}`);
  assert.ok(res.cookies.wyvern_session, 'session cookie should be set');
  assert.ok(res.cookies.wyvern_csrf, 'csrf cookie should be set');
  if (!opts.noWebhook) {
    await configureWebhook(client, opts.webhookUrl);
  }
  return res;
}

/** Multipart upload helper. Returns the client response. */
async function uploadFile(client, opts = {}) {
  const {
    parentId = '',
    name = 'fixture.bin',
    data,
    type = 'application/octet-stream',
    uploadToken,
    fileSize,
    expect,
  } = opts;
  const fd = new FormData();
  fd.append('parentId', String(parentId));
  if (uploadToken) {
    fd.append('uploadToken', uploadToken);
  }
  if (fileSize != null) {
    fd.append('fileSize', String(fileSize));
  }
  fd.append('file', new Blob([data], type ? { type } : undefined), name);
  return client.request('/api/files/upload', { method: 'POST', body: fd, csrf: true, expect });
}

module.exports = {
  ORIGIN,
  MIGRATIONS_DIR,
  DEFAULT_WEBHOOK_URL,
  sha256hex,
  makeFixture,
  createFakeOAuthFetch,
  createFakeDiscordStorage,
  startTestServer,
  makeClient,
  performOAuth,
  login,
  configureWebhook,
  uploadFile,
  dbAll: all,
  dbGet: get,
  dbRun: run,
};
