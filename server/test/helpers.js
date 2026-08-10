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

// Deterministic test environment. Tests set every required variable explicitly;
// there is no blanket "skip validation" path.
process.env.NODE_ENV = 'test';
process.env.APP_ORIGIN = ORIGIN;
process.env.DB_URL = ':memory:';
process.env.DISCORD_CLIENT_ID = 'test-client-id';
process.env.DISCORD_CLIENT_SECRET = 'test-client-secret';
process.env.DISCORD_REDIRECT_URI = `${ORIGIN}/api/auth/discord/callback`;
process.env.DISCORD_BOT_TOKEN = 'test-bot-token';
process.env.DISCORD_STORAGE_GUILD_ID = '111';
process.env.DISCORD_STORAGE_CATEGORY_ID = '222';
process.env.WYVERN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString('base64');
process.env.WYVERN_CHUNK_SIZE_BYTES = '8';
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
 * In-memory fake DiscordStorage. Tracks messages per channel and supports
 * failure injection: ensureDriveChannelFailures, failNextPutChunks,
 * failNextGetChunks, failNextDeleteChunks.
 */
function createFakeDiscordStorage() {
  const channels = new Map(); // channelId -> Map(messageId -> Buffer)
  const deletedMessages = [];
  const storage = {
    ensureDriveChannelCalls: 0,
    ensureDriveChannelFailures: 0,
    failNextPutChunks: 0,
    failPutChunkOnCall: 0,
    putCalls: 0,
    failNextGetChunks: 0,
    failNextDeleteChunks: 0,
    failDeleteChunkOnCall: 0,
    deleteCalls: 0,
    msgSeq: 0,
    deletedMessages,

    async ensureDriveChannel(driveOwner) {
      storage.ensureDriveChannelCalls += 1;
      if (storage.ensureDriveChannelFailures > 0) {
        storage.ensureDriveChannelFailures -= 1;
        throw new Error('fake: channel creation failed');
      }
      return `channel-${driveOwner.id}`;
    },

    async putChunk(channelId, filename, encryptedBuffer) {
      storage.putCalls += 1;
      if (storage.failPutChunkOnCall > 0 && storage.putCalls === storage.failPutChunkOnCall) {
        throw storageError('fake: putChunk failed');
      }
      if (storage.failNextPutChunks > 0) {
        storage.failNextPutChunks -= 1;
        throw storageError('fake: putChunk failed');
      }
      let msgs = channels.get(channelId);
      if (!msgs) {
        msgs = new Map();
        channels.set(channelId, msgs);
      }
      storage.msgSeq += 1;
      const messageId = `msg-${storage.msgSeq}`;
      msgs.set(messageId, Buffer.from(encryptedBuffer));
      return messageId;
    },

    async getChunk(channelId, messageId) {
      if (storage.failNextGetChunks > 0) {
        storage.failNextGetChunks -= 1;
        throw storageError('fake: getChunk failed');
      }
      const msgs = channels.get(channelId);
      const buf = msgs && msgs.get(messageId);
      if (!buf) throw storageError('fake: chunk not found');
      return Buffer.from(buf);
    },

    async deleteChunk(channelId, messageId) {
      storage.deleteCalls += 1;
      if (storage.failDeleteChunkOnCall > 0 && storage.deleteCalls === storage.failDeleteChunkOnCall) {
        throw storageError('fake: deleteChunk failed');
      }
      if (storage.failNextDeleteChunks > 0) {
        storage.failNextDeleteChunks -= 1;
        throw storageError('fake: deleteChunk failed');
      }
      const msgs = channels.get(channelId);
      if (msgs && msgs.has(messageId)) {
        msgs.delete(messageId);
        deletedMessages.push({ channelId, messageId });
      }
    },

    countMessages() {
      let n = 0;
      for (const msgs of channels.values()) n += msgs.size;
      return n;
    },

    getMessages(channelId) {
      return channels.get(channelId);
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

  const db = await openDatabase(config.dbUrl);
  await migrate(db, MIGRATIONS_DIR);
  const repositories = createRepositories(db);
  const sessionStore = createSessionStore(repositories);

  const oauthFetch = createFakeOAuthFetch();
  if (overrides.oauthUser) oauthFetch.currentUser = overrides.oauthUser;
  const oauth = createDiscordOAuth(config, oauthFetch);
  const discordStorage = createFakeDiscordStorage();
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

/** Login as the oauth fetch's current user and assert a successful session. */
async function login(client, ctx, opts = {}) {
  if (opts.as) ctx.oauthFetch.currentUser = opts.as;
  const res = await performOAuth(client);
  assert.strictEqual(res.status, 302);
  const location = res.headers.get('location');
  assert.ok(location.endsWith('/drive'), `expected redirect to /drive, got ${location}`);
  assert.ok(res.cookies.wyvern_session, 'session cookie should be set');
  assert.ok(res.cookies.wyvern_csrf, 'csrf cookie should be set');
  return res;
}

/** Multipart upload helper. Returns the client response. */
async function uploadFile(client, opts = {}) {
  const {
    parentId = '',
    name = 'fixture.bin',
    data,
    type = 'application/octet-stream',
    expect,
  } = opts;
  const fd = new FormData();
  fd.append('parentId', String(parentId));
  fd.append('file', new Blob([data], type ? { type } : undefined), name);
  return client.request('/api/files/upload', { method: 'POST', body: fd, csrf: true, expect });
}

module.exports = {
  ORIGIN,
  MIGRATIONS_DIR,
  sha256hex,
  makeFixture,
  createFakeOAuthFetch,
  createFakeDiscordStorage,
  startTestServer,
  makeClient,
  performOAuth,
  login,
  uploadFile,
  dbAll: all,
  dbGet: get,
  dbRun: run,
};
