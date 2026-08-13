'use strict';

const { test, before, after } = require('node:test');
const assert = require('node:assert');
const {
  startTestServer,
  makeClient,
  performOAuth,
  makeFixture,
  sha256hex,
  dbAll,
  ORIGIN,
} = require('./helpers');
const { createDiscordWebhookStorage } = require('../src/storage/discord-webhook-storage');
const { loadConfig } = require('../src/config');

const WEBHOOK_ID = '123';
const WEBHOOK_TOKEN = 'test-token';
const VALID_URL = `https://discord.com/api/webhooks/${WEBHOOK_ID}/${WEBHOOK_TOKEN}`;

function jsonResponse(body, status = 200) {
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

function rawResponse(buffer, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/octet-stream' }),
    arrayBuffer: async () => Buffer.from(buffer),
    text: async () => Buffer.from(buffer).toString('utf8'),
  };
}

/**
 * Fake Discord webhook REST surface for the real adapter: GET webhook,
 * POST ?wait=true (multipart with payload_json + one file per attachment),
 * GET/DELETE messages/:id, and the CDN attachment endpoint. Messages hold an
 * attachment list (packed uploads put several chunks in one message); CDN
 * URLs carry the attachment index so getChunk(drive, mid, i) resolves the
 * right bytes. Tracks every call and the attachments received so tests can
 * assert protocol shape and cleanup.
 */
function createFakeDiscordFetch() {
  const messages = new Map(); // messageId -> [{ filename, buffer }]
  const state = {
    valid: true,
    getWebhookCalls: 0,
    putAttempts: 0,
    putFailures: 0, // respond 429 this many times before succeeding
    putRetryAfter: 0.01, // retry_after value for injected 429s
    putServerErrors: 0, // respond 500 this many times before succeeding
    messageGetCalls: 0,
    messageGetDelayMs: 0, // message GET sleeps this long so tests can force real concurrency
    getMessageFailures: 0, // message GET returns 500 this many times
    cdnFailures: 0, // attachment fetch returns 500 this many times
    deleted: [],
    attachments: [], // { messageId, filename, buffer, index }
  };

  const fn = async (url, init = {}) => {
    const u = new URL(url);
    const method = (init && init.method) || 'GET';
    if (u.hostname === 'cdn.discordapp.com') {
      if (state.cdnFailures > 0) {
        state.cdnFailures -= 1;
        return rawResponse(Buffer.from('boom'), 500);
      }
      // /attachments/<guild>/<channel>/<messageId>/<attachmentIndex>
      const parts = u.pathname.split('/').filter(Boolean);
      const index = parts.length >= 5 ? Number(parts[parts.length - 1]) : 0;
      const mid = parts.length >= 5 ? parts[parts.length - 2] : parts[parts.length - 1];
      const msg = messages.get(mid);
      const attachment = msg && msg[index];
      if (!attachment) return rawResponse(Buffer.from('not found'), 404);
      return rawResponse(attachment.buffer);
    }

    const match = u.pathname.match(/^\/api\/webhooks\/(\d+)\/([^/]+)(\/messages\/([^/]+))?$/);
    if (!match) throw new Error(`unexpected discord url: ${url}`);
    const [, id, token, , messageId] = match;
    if (id !== WEBHOOK_ID || token !== WEBHOOK_TOKEN) {
      return jsonResponse({ message: 'Unknown Webhook', code: 10015 }, 404);
    }
    if (!state.valid) {
      return jsonResponse({ message: 'Unknown Webhook', code: 10015 }, 404);
    }

    if (method === 'GET' && !messageId) {
      state.getWebhookCalls += 1;
      return jsonResponse({ id: Number(WEBHOOK_ID), type: 1, token: WEBHOOK_TOKEN, name: 'wyvern' });
    }

    if (method === 'POST' && u.searchParams.get('wait') === 'true') {
      state.putAttempts += 1;
      if (state.putFailures > 0) {
        state.putFailures -= 1;
        return jsonResponse({ retry_after: state.putRetryAfter, message: 'You are being rate limited.', code: 20028 }, 429);
      }
      if (state.putServerErrors > 0) {
        state.putServerErrors -= 1;
        return rawResponse(Buffer.from('boom'), 500);
      }
      const attachments = [];
      for (const [, part] of init.body) {
        if (part instanceof Blob) {
          attachments.push({ filename: part.name || null, buffer: Buffer.from(await part.arrayBuffer()) });
        }
      }
      const mid = `m-${messages.size + 1}`;
      messages.set(mid, attachments);
      attachments.forEach((att, i) => {
        state.attachments.push({ messageId: mid, filename: att.filename, buffer: att.buffer, index: i });
      });
      return jsonResponse({
        id: mid,
        attachments: attachments.map((att, i) => ({
          id: i + 1,
          filename: att.filename,
          url: `https://cdn.discordapp.com/attachments/8/9/${mid}/${i}`,
        })),
      });
    }

    if (messageId && method === 'GET') {
      state.messageGetCalls += 1;
      if (state.messageGetDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, state.messageGetDelayMs));
      }
      if (state.getMessageFailures > 0) {
        state.getMessageFailures -= 1;
        return rawResponse(Buffer.from('boom'), 500);
      }
      const msg = messages.get(messageId);
      if (!msg) return jsonResponse({ message: 'Unknown Message', code: 10008 }, 404);
      return jsonResponse({
        id: messageId,
        attachments: msg.map((att, i) => ({
          id: i + 1,
          filename: att.filename,
          url: `https://cdn.discordapp.com/attachments/8/9/${messageId}/${i}`,
        })),
      });
    }

    if (messageId && method === 'DELETE') {
      if (!messages.has(messageId)) {
        return jsonResponse({ message: 'Unknown Message', code: 10008 }, 404);
      }
      messages.delete(messageId);
      state.deleted.push(messageId);
      return rawResponse(Buffer.alloc(0), 204);
    }

    throw new Error(`unexpected request: ${method} ${url}`);
  };
  fn.state = state;
  fn.messages = messages;
  return fn;
}

let ctx;
let client;
let discordFetch;

before(async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  discordFetch = createFakeDiscordFetch();
  const realStorage = createDiscordWebhookStorage(config, {
    chunkSizeBytes: 8,
    fetchImpl: discordFetch,
  });
  // 8-byte chunks keep the round-trip fixtures small (24 bytes = 3 chunks).
  ctx = await startTestServer({ storage: realStorage, chunkSizeBytes: 8 });
  client = makeClient(ctx.baseUrl);
  await performOAuth(client);
});

after(() => ctx.close());

test('configure webhook: 201 with drive summary + webhook list, no URL leaks, ciphertext-only storage', async () => {
  const res = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: VALID_URL }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  assert.deepStrictEqual(Object.keys(res.json).sort(), ['id', 'quotaBytes', 'usedBytes', 'webhooks']);
  assert.strictEqual(res.json.id, 1);
  assert.strictEqual(res.json.quotaBytes, ctx.config.defaultQuotaBytes);
  assert.strictEqual(res.json.usedBytes, 0);
  assert.strictEqual(res.json.webhooks.length, 1);
  assert.strictEqual(res.json.webhooks[0].id, 1);
  assert.ok(res.json.webhooks[0].createdAt, 'webhook list carries creation dates');
  assert.ok(!JSON.stringify(res.json).includes('discord.com'), 'response must not contain the webhook URL');

  // auth/me carries the drive summary, never the credential or URL.
  const me = await client.request('/api/auth/me');
  assert.strictEqual(me.json.drive.id, 1);
  assert.ok(!JSON.stringify(me.json).includes('discord.com'));

  // The URL appears nowhere in the legacy drive credential columns; the
  // sealed credential lives in the webhooks table instead.
  const drive = await ctx.repositories.getDriveByOwner(1);
  assert.strictEqual(drive.legacy_discord_channel_id, null);
  assert.strictEqual(drive.webhook_ciphertext, null, 'legacy drive credential columns stay NULL for new drives');
  const webhooks = await ctx.repositories.listWebhooks(1);
  assert.strictEqual(webhooks.length, 1);
  assert.ok(Buffer.isBuffer(webhooks[0].webhook_ciphertext), 'ciphertext is a blob');
  assert.strictEqual(webhooks[0].webhook_nonce.length, 12, 'fresh 12-byte nonce');
  assert.strictEqual(webhooks[0].webhook_auth_tag.length, 16, 'GCM auth tag persisted');
  assert.ok(
    !webhooks[0].webhook_ciphertext.includes(Buffer.from(VALID_URL)),
    'ciphertext must not embed the plaintext URL'
  );
  const allDrives = await dbAll(ctx.db, 'SELECT * FROM drives');
  assert.strictEqual(allDrives.length, 1);
});

test('upload/download round trip through the real adapter keeps ciphertext-only chunks', async () => {
  const fixture = makeFixture(24);
  const fd = new FormData();
  fd.append('parentId', '');
  fd.append('file', new Blob([fixture]), 'fixture.bin');
  const up = await client.request('/api/files/upload', {
    method: 'POST',
    body: fd,
    csrf: true,
    expect: 201,
  });
  assert.strictEqual(up.json.sizeBytes, 24);

  // Three encrypted chunks were posted as ONE packed message (three
  // attachments) with the Wyvern breadcrumb filename shape.
  assert.strictEqual(discordFetch.state.putAttempts, 1, '3 chunks -> 1 packed webhook post');
  const posted = discordFetch.state.attachments;
  assert.strictEqual(posted.length, 3);
  const driveId = (await ctx.repositories.getEntryById(up.json.id)).drive_id;
  const chunkRows = await ctx.repositories.getChunksByEntry(up.json.id);
  posted.forEach((part, i) => {
    assert.strictEqual(part.filename, `wyv-${driveId}-${chunkRows[i].checksum.slice(0, 12)}-${i}.bin`);
    assert.notDeepStrictEqual(part.buffer, fixture.subarray(i * 8, i * 8 + 8), 'chunk must be encrypted at rest');
  });
  const messageIds = new Set(posted.map((part) => part.messageId));
  assert.strictEqual(messageIds.size, 1, 'all attachments share one message id');
  assert.strictEqual(discordFetch.messages.size, 1, 'one Discord message holds all three chunks');

  const dl = await client.request(`/api/files/${up.json.id}/download`);
  assert.strictEqual(dl.status, 200);
  assert.strictEqual(dl.headers.get('content-length'), '24');
  const buf = Buffer.from(await dl.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture);
  assert.strictEqual(sha256hex(buf), sha256hex(fixture));
});

test('packing: 25 chunks at 8-byte chunks -> 3 posts with 10/10/5 attachments', async () => {
  // 200 bytes / 8-byte chunks = 25 chunks -> batches of 10/10/5. The fixture
  // is distinct from every earlier upload so content dedup posts no fewer
  // chunks. The shared adapter fake accumulates calls across tests, so
  // snapshot the baseline.
  const fixture = Buffer.from(Array.from({ length: 200 }, (_, i) => (i * 3 + 1) % 256));
  const beforeAttempts = discordFetch.state.putAttempts;
  const beforeAttachments = discordFetch.state.attachments.length;
  const fd = new FormData();
  fd.append('parentId', '');
  fd.append('file', new Blob([fixture]), 'packed.bin');
  const up = await client.request('/api/files/upload', {
    method: 'POST',
    body: fd,
    csrf: true,
    expect: 201,
  });
  assert.strictEqual(up.json.sizeBytes, 200);

  // 25 chunks -> batches of 10: exactly three webhook posts, one per batch.
  assert.strictEqual(discordFetch.state.putAttempts - beforeAttempts, 3, '10/10/5 batches -> 3 posts');
  const posted = discordFetch.state.attachments.slice(beforeAttachments);
  assert.strictEqual(posted.length, 25);

  // Attachments group by message: each batch shares one message id.
  const byMessage = new Map();
  for (const att of posted) {
    const list = byMessage.get(att.messageId) || [];
    list.push(att);
    byMessage.set(att.messageId, list);
  }
  const sizes = [...byMessage.values()].map((list) => list.length).sort((a, b) => b - a);
  assert.deepStrictEqual(sizes, [10, 10, 5]);

  // Every attachment uses the Wyvern breadcrumb naming
  // wyv-<driveId>-<block hash prefix>-<ordinal>.bin, covering ordinals 0..24
  // exactly once.
  const ordinals = posted.map((att) => {
    const m = /^wyv-\d+-[0-9a-f]{12}-(\d+)\.bin$/.exec(att.filename);
    assert.ok(m, `unexpected filename ${att.filename}`);
    return Number(m[1]);
  });
  assert.deepStrictEqual([...ordinals].sort((a, b) => a - b), Array.from({ length: 25 }, (_, i) => i));

  // Packed chunks still download byte-for-byte.
  const dl = await client.request(`/api/files/${up.json.id}/download`);
  assert.strictEqual(dl.status, 200);
  assert.strictEqual(dl.headers.get('content-length'), '200');
  const buf = Buffer.from(await dl.raw.arrayBuffer());
  assert.deepStrictEqual(buf, fixture);
});

test('delete trashes the entry; purging removes the webhook messages', async () => {
  const up = await client.request('/api/files/upload', {
    method: 'POST',
    body: (() => {
      const fd = new FormData();
      fd.append('parentId', '');
      fd.append('file', new Blob([Buffer.from([7, 6, 5, 4, 3, 2, 1, 0])]), 'doomed.bin');
      return fd;
    })(),
    csrf: true,
    expect: 201,
  });
  const before = discordFetch.state.deleted.length;
  // Soft delete: no Discord I/O, the file is hidden and lands in the trash.
  await client.request(`/api/entries/${up.json.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  assert.strictEqual(discordFetch.state.deleted.length, before, 'soft delete must not touch Discord');
  const dl = await client.request(`/api/files/${up.json.id}/download`);
  assert.strictEqual(dl.status, 404);

  // Purging from the trash reclaims the Discord message.
  await client.request(`/api/trash/${up.json.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  assert.strictEqual(discordFetch.state.deleted.length, before + 1);
});

test('invalid or unauthorized webhook returns 400 INVALID_WEBHOOK', async () => {
  // A fresh user with no drive exercises validation directly.
  ctx.oauthFetch.currentUser = { id: '3003', username: 'carol', avatar: null };
  const login = await performOAuth(client);
  assert.strictEqual(login.headers.get('location'), `${ORIGIN}/connect`);

  // Discord rejects the webhook (404).
  let res = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/999/wrong-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_WEBHOOK');

  // A malformed URL is rejected without any Discord call.
  discordFetch.state.getWebhookCalls = 0;
  res = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/not-a-webhook' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_WEBHOOK');
  assert.strictEqual(discordFetch.state.getWebhookCalls, 0);
});

test('CSRF protects the webhook configuration mutation', async () => {
  const res = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: VALID_URL }),
    headers: { 'content-type': 'application/json' },
  });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.error.code, 'CSRF_FAILED');
});

test('adapter unit: 429 retry policy (bounded) and failure mapping', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);

  const fetch2 = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: fetch2 });
  const sealed = await storage.validateAndSealWebhook(VALID_URL);
  const webhook = { id: 99, webhook_ciphertext: sealed.webhook_ciphertext, webhook_nonce: sealed.webhook_nonce, webhook_auth_tag: sealed.webhook_auth_tag };

  // Two 429s, then success: exactly 3 attempts.
  fetch2.state.putFailures = 2;
  const mid = await storage.putChunk(webhook, 'chunk-0.bin', Buffer.from('encrypted-bytes'));
  assert.strictEqual(mid, 'm-1');
  assert.strictEqual(fetch2.state.putAttempts, 3);

  // Exhausted 429 budget -> STORAGE_UNAVAILABLE.
  fetch2.state.putFailures = 10;
  await assert.rejects(
    storage.putChunk(webhook, 'chunk-1.bin', Buffer.from('more-bytes')),
    (err) => err.code === 'STORAGE_UNAVAILABLE'
  );

  // getChunk: a transient message GET 500 is retried (exponential backoff),
  // so the chunk still loads; the CDN path has no retry and fails fast.
  fetch2.state.getMessageFailures = 1;
  const retried = await storage.getChunk(webhook, mid);
  assert.deepStrictEqual(retried, Buffer.from('encrypted-bytes'));
  assert.strictEqual(fetch2.state.messageGetCalls, 2, 'one retry after the transient 500');

  // getChunk: CDN fetch failure -> STORAGE_UNAVAILABLE.
  fetch2.state.putFailures = 0;
  fetch2.state.cdnFailures = 1;
  const okMid = await storage.putChunk(webhook, 'chunk-2.bin', Buffer.from('third'));
  await assert.rejects(
    storage.getChunk(webhook, okMid),
    (err) => err.code === 'STORAGE_UNAVAILABLE'
  );

  // getChunk happy path returns the stored bytes.
  const bytes = await storage.getChunk(webhook, mid);
  assert.deepStrictEqual(bytes, Buffer.from('encrypted-bytes'));

  // deleteChunk is idempotent: a missing message (Discord 404) resolves.
  await storage.deleteChunk(webhook, 'm-does-not-exist');
  await storage.deleteChunk(webhook, mid);
  assert.deepStrictEqual(fetch2.state.deleted, [mid]);

  // No webhook configured -> STORAGE_UNAVAILABLE on every storage op.
  const bareWebhook = { id: 98 };
  await assert.rejects(storage.putChunk(bareWebhook, 'x', Buffer.alloc(1)), (err) => err.code === 'STORAGE_UNAVAILABLE');
  await assert.rejects(storage.getChunk(bareWebhook, 'm1'), (err) => err.code === 'STORAGE_UNAVAILABLE');
  await assert.rejects(storage.deleteChunk(bareWebhook, 'm1'), (err) => err.code === 'STORAGE_UNAVAILABLE');
});

test('adapter unit: 429 retry sleeps retry_after * 1.1 (jittered)', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const fetch4 = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: fetch4 });
  const sealed = await storage.validateAndSealWebhook(VALID_URL);
  const webhook = {
    id: 96,
    webhook_ciphertext: sealed.webhook_ciphertext,
    webhook_nonce: sealed.webhook_nonce,
    webhook_auth_tag: sealed.webhook_auth_tag,
  };

  // One 429 with retry_after 0.2, then success: the retry waits at least
  // 0.2s * 1.1 * 0.8 (jitter floor) ~= 176ms. A 1:1 retry would finish at
  // ~160ms with the same jitter, so the >=150ms bound proves the 1.1x
  // multiplier is applied.
  fetch4.state.putFailures = 1;
  fetch4.state.putRetryAfter = 0.2;
  const started = Date.now();
  const mid = await storage.putChunk(webhook, 'timed.bin', Buffer.from('timed-payload'));
  const elapsed = Date.now() - started;
  assert.strictEqual(mid, 'm-1');
  assert.strictEqual(fetch4.state.putAttempts, 2, 'one 429 then one success');
  assert.ok(elapsed >= 150, `expected >=150ms wait for retry_after 0.2, got ${elapsed}ms`);
});

test('adapter unit: 429 retries do not consume the 5xx retry budget', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const fetch5 = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: fetch5 });
  const sealed = await storage.validateAndSealWebhook(VALID_URL);
  const webhook = {
    id: 95,
    webhook_ciphertext: sealed.webhook_ciphertext,
    webhook_nonce: sealed.webhook_nonce,
    webhook_auth_tag: sealed.webhook_auth_tag,
  };

  // Exhaust the 429 budget (3 retries), then a 5xx still gets its own retry:
  // with a shared budget the post would fail after the 429s without ever
  // retrying the 500. Sequence: 429, 429, 429, 500, success.
  fetch5.state.putFailures = 3;
  fetch5.state.putServerErrors = 1;
  const mid = await storage.putChunk(webhook, 'budget.bin', Buffer.from('budget-payload'));
  assert.strictEqual(mid, 'm-1');
  assert.strictEqual(fetch5.state.putAttempts, 5, '3x 429 + 1x 500 (own budget) + success');
});

test('adapter unit: global 429s share one process-wide wait across webhooks', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const attempts = new Map(); // webhook id -> attempt count
  const messages = new Map();
  const fetchG = async (url, init = {}) => {
    const u = new URL(url);
    const match = u.pathname.match(/^\/api\/webhooks\/(\d+)\/([^/]+)(\/messages\/([^/]+))?$/);
    if (!match) throw new Error(`unexpected discord url: ${url}`);
    const id = match[1];
    const method = (init && init.method) || 'GET';
    if (method === 'GET' && !match[4]) {
      return jsonResponse({ id: Number(id), type: 1, token: match[2], name: 'wyvern' });
    }
    if (method === 'DELETE') {
      messages.delete(match[4]);
      return rawResponse(Buffer.alloc(0), 204);
    }
    if (method !== 'POST') throw new Error(`unexpected request: ${method} ${url}`);
    const n = attempts.get(id) || 0;
    attempts.set(id, n + 1);
    if (n === 0) {
      // Global 429 on the first attempt of EACH webhook: the module-level
      // gate must serialize the retries so the second webhook waits on the
      // first's longer window instead of retrying in parallel.
      return jsonResponse({ retry_after: id === '123' ? 0.3 : 0.1, global: true, message: 'global', code: 20029 }, 429);
    }
    const mid = `g-${id}-${n}`;
    messages.set(mid, []);
    return jsonResponse({ id: mid, attachments: [] });
  };
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: fetchG });
  const sealA = await storage.validateAndSealWebhook(VALID_URL);
  const sealB = await storage.validateAndSealWebhook('https://discord.com/api/webhooks/456/other-token');
  const webhookA = { id: 94, webhook_ciphertext: sealA.webhook_ciphertext, webhook_nonce: sealA.webhook_nonce, webhook_auth_tag: sealA.webhook_auth_tag };
  const webhookB = { id: 93, webhook_ciphertext: sealB.webhook_ciphertext, webhook_nonce: sealB.webhook_nonce, webhook_auth_tag: sealB.webhook_auth_tag };

  // A's POST resolves first (invoked first, synchronous fake), opening the
  // 0.3s * 1.1 global gate; B's 0.1s global 429 must join that gate rather
  // than wait on its own (which would finish in ~110ms).
  const pA = storage.putChunk(webhookA, 'a.bin', Buffer.from('aaa'));
  const bStarted = Date.now();
  const pB = storage.putChunk(webhookB, 'b.bin', Buffer.from('bbb')).then((mid) => ({ mid, elapsed: Date.now() - bStarted }));
  const [rA, rB] = await Promise.all([pA, pB]);

  assert.strictEqual(rA, 'g-123-1');
  assert.strictEqual(rB.mid, 'g-456-1');
  assert.deepStrictEqual([...attempts.values()].sort(), [2, 2], 'each webhook retried exactly once');
  assert.ok(rB.elapsed >= 200, `webhook B should wait on A's shared global gate, got ${rB.elapsed}ms`);
});

test('adapter unit: putChunks packs up to 10 chunks into one message', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const fetch3 = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: fetch3 });
  const sealed = await storage.validateAndSealWebhook(VALID_URL);
  const webhook = {
    id: 97,
    webhook_ciphertext: sealed.webhook_ciphertext,
    webhook_nonce: sealed.webhook_nonce,
    webhook_auth_tag: sealed.webhook_auth_tag,
  };

  const chunks = Array.from({ length: 10 }, (_, i) => ({
    ordinal: i,
    filename: `chunk-${i}.bin`,
    encryptedBuffer: Buffer.from(`enc-${i}`),
  }));
  const results = await storage.putChunks(webhook, chunks);

  assert.strictEqual(fetch3.state.putAttempts, 1, 'ten chunks -> one webhook POST');
  assert.strictEqual(fetch3.state.attachments.length, 10);
  assert.strictEqual(fetch3.messages.size, 1, 'one Discord message for the batch');
  const messageIds = new Set(results.map((r) => r.messageId));
  assert.strictEqual(messageIds.size, 1, 'every chunk resolves to the shared message id');
  assert.deepStrictEqual(
    results.map((r) => r.ordinal),
    [0, 1, 2, 3, 4, 5, 6, 7, 8, 9],
    'resolved in input order'
  );
  fetch3.state.attachments.forEach((att, i) => {
    assert.strictEqual(att.filename, `chunk-${i}.bin`);
    assert.deepStrictEqual(att.buffer, Buffer.from(`enc-${i}`));
  });

  // getChunk(drive, messageId, attachmentIndex) selects the right attachment.
  for (let i = 0; i < 10; i += 1) {
    const bytes = await storage.getChunk(webhook, results[0].messageId, i);
    assert.deepStrictEqual(bytes, Buffer.from(`enc-${i}`), `attachment ${i}`);
  }

  // 11 chunks exceed the Discord message limit -> BAD_REQUEST before any POST.
  await assert.rejects(
    storage.putChunks(webhook, chunks.concat([{ ordinal: 10, filename: 'chunk-10.bin', encryptedBuffer: Buffer.from('x') }])),
    (err) => err.code === 'BAD_REQUEST'
  );
  assert.strictEqual(fetch3.state.putAttempts, 1, 'no POST for an oversized batch');
});

test('webhook validation maps Discord unavailability to STORAGE_UNAVAILABLE', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const brokenFetch = async () => {
    throw new Error('network down');
  };
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: brokenFetch });
  await assert.rejects(
    storage.validateAndSealWebhook(VALID_URL),
    (err) => err.code === 'STORAGE_UNAVAILABLE'
  );
});

function sealedWebhook(id) {
  const env = { ...process.env };
  const config = loadConfig(env);
  const fetchC = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: fetchC });
  return {
    storage,
    fetchC,
    async webhook() {
      const sealed = await storage.validateAndSealWebhook(VALID_URL);
      return {
        id,
        webhook_ciphertext: sealed.webhook_ciphertext,
        webhook_nonce: sealed.webhook_nonce,
        webhook_auth_tag: sealed.webhook_auth_tag,
      };
    },
  };
}

test('adapter unit: getChunk caches message metadata so sequential reads reuse one message GET', async () => {
  const { storage, fetchC, webhook: makeWebhook } = sealedWebhook(90);
  const webhook = await makeWebhook();

  const mid = await storage.putChunk(webhook, 'cached.bin', Buffer.from('cached-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 0);
  assert.deepStrictEqual(await storage.getChunk(webhook, mid), Buffer.from('cached-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 1);
  assert.deepStrictEqual(await storage.getChunk(webhook, mid), Buffer.from('cached-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 1, 'second read is served from the metadata cache');

  // Keying is per webhook+message: a different message is fetched fresh.
  const mid2 = await storage.putChunk(webhook, 'other.bin', Buffer.from('other-bytes'));
  assert.deepStrictEqual(await storage.getChunk(webhook, mid2), Buffer.from('other-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 2);
});

test('adapter unit: concurrent packed-chunk reads coalesce onto one message GET', async () => {
  const { storage, fetchC, webhook: makeWebhook } = sealedWebhook(89);
  const webhook = await makeWebhook();

  const chunks = Array.from({ length: 10 }, (_, i) => ({
    ordinal: i,
    filename: `packed-${i}.bin`,
    encryptedBuffer: Buffer.from(`enc-${i}`),
  }));
  const results = await storage.putChunks(webhook, chunks);
  const mid = results[0].messageId;
  assert.ok(results.every((r) => r.messageId === mid), 'ten chunks pack into one message');

  // A slow message GET: ten truly concurrent reads of the packed message
  // must share one in-flight fetch instead of serializing ten GETs.
  fetchC.state.messageGetDelayMs = 25;
  const started = Date.now();
  const bytes = await Promise.all(
    Array.from({ length: 10 }, (_, i) => storage.getChunk(webhook, mid, i))
  );
  const elapsed = Date.now() - started;
  fetchC.state.messageGetDelayMs = 0;

  assert.strictEqual(fetchC.state.messageGetCalls, 1, '10 concurrent reads -> exactly one message GET');
  assert.ok(elapsed < 200, `reads must share one delayed GET, got ${elapsed}ms (serialized floor is 250ms)`);
  bytes.forEach((b, i) => assert.deepStrictEqual(b, Buffer.from(`enc-${i}`), `attachment ${i}`));
});

test('adapter unit: a missing attachment maps to STORAGE_UNAVAILABLE even from cached metadata', async () => {
  const { storage, fetchC, webhook: makeWebhook } = sealedWebhook(88);
  const webhook = await makeWebhook();

  const mid = await storage.putChunk(webhook, 'solo.bin', Buffer.from('solo-bytes'));
  await assert.rejects(
    storage.getChunk(webhook, mid, 3), // only attachment 0 exists
    (err) => err.code === 'STORAGE_UNAVAILABLE'
  );
  assert.strictEqual(fetchC.state.messageGetCalls, 1);
  // The failure is per attachment index, not a message failure: the valid
  // index still reads from the same cached metadata without a new GET.
  assert.deepStrictEqual(await storage.getChunk(webhook, mid, 0), Buffer.from('solo-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 1, 'valid read reused the cached metadata');

  // A message that does not exist is never cached: each read retries Discord.
  await assert.rejects(storage.getChunk(webhook, 'm-unknown'), (err) => err.code === 'STORAGE_UNAVAILABLE');
  assert.strictEqual(fetchC.state.messageGetCalls, 2);
  await assert.rejects(storage.getChunk(webhook, 'm-unknown'), (err) => err.code === 'STORAGE_UNAVAILABLE');
  assert.strictEqual(fetchC.state.messageGetCalls, 3, 'failed reads are not cached');
});

test('adapter unit: concurrent reads of a missing message coalesce, all reject, and nothing is cached', async () => {
  const { storage, fetchC, webhook: makeWebhook } = sealedWebhook(87);
  const webhook = await makeWebhook();

  fetchC.state.messageGetDelayMs = 25;
  const results = await Promise.allSettled(
    Array.from({ length: 10 }, () => storage.getChunk(webhook, 'm-never'))
  );
  fetchC.state.messageGetDelayMs = 0;

  assert.strictEqual(fetchC.state.messageGetCalls, 1, 'concurrent misses share one failed message GET');
  assert.ok(
    results.every((r) => r.status === 'rejected' && r.reason.code === 'STORAGE_UNAVAILABLE'),
    'every waiter rejects with STORAGE_UNAVAILABLE'
  );
  // Nothing was cached: the next read tries Discord again.
  await assert.rejects(storage.getChunk(webhook, 'm-never'), (err) => err.code === 'STORAGE_UNAVAILABLE');
  assert.strictEqual(fetchC.state.messageGetCalls, 2);
});

test('adapter unit: a failed CDN download invalidates the cached metadata so the next read re-fetches', async () => {
  const { storage, fetchC, webhook: makeWebhook } = sealedWebhook(86);
  const webhook = await makeWebhook();

  const mid = await storage.putChunk(webhook, 'cdn.bin', Buffer.from('cdn-bytes'));
  assert.deepStrictEqual(await storage.getChunk(webhook, mid), Buffer.from('cdn-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 1);

  // A transient CDN failure must not stick: the cached metadata is dropped
  // and the next read re-fetches the message instead of replaying the dead URL.
  fetchC.state.cdnFailures = 1;
  await assert.rejects(storage.getChunk(webhook, mid), (err) => err.code === 'STORAGE_UNAVAILABLE');
  assert.strictEqual(fetchC.state.messageGetCalls, 1, 'failed CDN read did not issue a message GET');

  assert.deepStrictEqual(await storage.getChunk(webhook, mid), Buffer.from('cdn-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 2, 'metadata re-fetched after the CDN failure');
});

test('adapter unit: cached message metadata expires after the TTL', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const fetchC = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, {
    chunkSizeBytes: 8,
    fetchImpl: fetchC,
    messageMetaTtlMs: 20,
  });
  const sealed = await storage.validateAndSealWebhook(VALID_URL);
  const webhook = {
    id: 85,
    webhook_ciphertext: sealed.webhook_ciphertext,
    webhook_nonce: sealed.webhook_nonce,
    webhook_auth_tag: sealed.webhook_auth_tag,
  };

  const mid = await storage.putChunk(webhook, 'ttl.bin', Buffer.from('ttl-bytes'));
  await storage.getChunk(webhook, mid);
  assert.strictEqual(fetchC.state.messageGetCalls, 1);
  await storage.getChunk(webhook, mid);
  assert.strictEqual(fetchC.state.messageGetCalls, 1, 'fresh entry is a cache hit');

  await new Promise((resolve) => setTimeout(resolve, 30));
  await storage.getChunk(webhook, mid);
  assert.strictEqual(fetchC.state.messageGetCalls, 2, 'expired entry is re-fetched');
});

test('adapter unit: the metadata cache is bounded and evicts the oldest entries', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const fetchC = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, {
    chunkSizeBytes: 8,
    fetchImpl: fetchC,
    messageMetaCacheMax: 2,
  });
  const sealed = await storage.validateAndSealWebhook(VALID_URL);
  const webhook = {
    id: 84,
    webhook_ciphertext: sealed.webhook_ciphertext,
    webhook_nonce: sealed.webhook_nonce,
    webhook_auth_tag: sealed.webhook_auth_tag,
  };

  const m1 = await storage.putChunk(webhook, 'a.bin', Buffer.from('aaa'));
  const m2 = await storage.putChunk(webhook, 'b.bin', Buffer.from('bbb'));
  const m3 = await storage.putChunk(webhook, 'c.bin', Buffer.from('ccc'));
  await storage.getChunk(webhook, m1);
  await storage.getChunk(webhook, m2);
  await storage.getChunk(webhook, m3); // full (max 2): FIFO evicts m1
  assert.strictEqual(fetchC.state.messageGetCalls, 3);

  await storage.getChunk(webhook, m2);
  await storage.getChunk(webhook, m3);
  assert.strictEqual(fetchC.state.messageGetCalls, 3, 'm2 and m3 are still cached');

  await storage.getChunk(webhook, m1);
  assert.strictEqual(fetchC.state.messageGetCalls, 4, 'evicted m1 is re-fetched');
});

test('adapter unit: deleteChunk invalidates the cached metadata for that message', async () => {
  const { storage, fetchC, webhook: makeWebhook } = sealedWebhook(83);
  const webhook = await makeWebhook();

  const mid = await storage.putChunk(webhook, 'doomed.bin', Buffer.from('doomed-bytes'));
  assert.deepStrictEqual(await storage.getChunk(webhook, mid), Buffer.from('doomed-bytes'));
  assert.strictEqual(fetchC.state.messageGetCalls, 1);

  await storage.deleteChunk(webhook, mid);
  // After the delete the metadata must not be replayed: a fresh read misses
  // the cache and re-fetches (Discord reports the message gone -> 404).
  await assert.rejects(storage.getChunk(webhook, mid), (err) => err.code === 'STORAGE_UNAVAILABLE');
  assert.strictEqual(fetchC.state.messageGetCalls, 2, 'post-delete read re-fetched instead of hitting the cache');
});
