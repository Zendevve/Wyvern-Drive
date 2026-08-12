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
    messageGetCalls: 0,
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
        return jsonResponse({ retry_after: 0.01, message: 'You are being rate limited.', code: 20028 }, 429);
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

test('configure webhook: 201 with drive summary, no URL leaks, ciphertext-only storage', async () => {
  const res = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: VALID_URL }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  assert.deepStrictEqual(res.json, { id: 1, quotaBytes: ctx.config.defaultQuotaBytes, usedBytes: 0 });
  assert.ok(!JSON.stringify(res.json).includes('discord.com'), 'response must not contain the webhook URL');

  // auth/me carries the drive summary, never the credential or URL.
  const me = await client.request('/api/auth/me');
  assert.strictEqual(me.json.drive.id, 1);
  assert.ok(!JSON.stringify(me.json).includes('discord.com'));

  // The URL appears nowhere in the drive credential columns.
  const drive = await ctx.repositories.getDriveByOwner(1);
  assert.strictEqual(drive.legacy_discord_channel_id, null);
  assert.ok(Buffer.isBuffer(drive.webhook_ciphertext), 'ciphertext is a blob');
  assert.strictEqual(drive.webhook_nonce.length, 12, 'fresh 12-byte nonce');
  assert.strictEqual(drive.webhook_auth_tag.length, 16, 'GCM auth tag persisted');
  assert.ok(
    !drive.webhook_ciphertext.includes(Buffer.from(VALID_URL)),
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
  // attachments) with the Disbox protocol shape.
  assert.strictEqual(discordFetch.state.putAttempts, 1, '3 chunks -> 1 packed webhook post');
  const posted = discordFetch.state.attachments;
  assert.strictEqual(posted.length, 3);
  posted.forEach((part, i) => {
    assert.strictEqual(part.filename, `chunk-${i}.bin`);
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
  // 200 bytes / 8-byte chunks = 25 chunks -> batches of 10/10/5. The shared
  // adapter fake accumulates calls across tests, so snapshot the baseline.
  const fixture = makeFixture(200);
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

  // Every attachment uses the Disbox chunk-<ordinal>.bin naming, covering
  // ordinals 0..24 exactly once.
  const ordinals = posted.map((att) => {
    const m = /^chunk-(\d+)\.bin$/.exec(att.filename);
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

test('delete removes the webhook messages', async () => {
  const up = await client.request('/api/files/upload', {
    method: 'POST',
    body: (() => {
      const fd = new FormData();
      fd.append('parentId', '');
      fd.append('file', new Blob([makeFixture(8)]), 'doomed.bin');
      return fd;
    })(),
    csrf: true,
    expect: 201,
  });
  const before = discordFetch.state.deleted.length;
  await client.request(`/api/entries/${up.json.id}`, { method: 'DELETE', csrf: true, expect: 204 });
  assert.strictEqual(discordFetch.state.deleted.length, before + 1);
  const dl = await client.request(`/api/files/${up.json.id}/download`);
  assert.strictEqual(dl.status, 404);
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
  const drive = { id: 99, webhook_ciphertext: sealed.webhook_ciphertext, webhook_nonce: sealed.webhook_nonce, webhook_auth_tag: sealed.webhook_auth_tag };

  // Two 429s, then success: exactly 3 attempts.
  fetch2.state.putFailures = 2;
  const mid = await storage.putChunk(drive, 'chunk-0.bin', Buffer.from('encrypted-bytes'));
  assert.strictEqual(mid, 'm-1');
  assert.strictEqual(fetch2.state.putAttempts, 3);

  // Exhausted 429 budget -> STORAGE_UNAVAILABLE.
  fetch2.state.putFailures = 10;
  await assert.rejects(
    storage.putChunk(drive, 'chunk-1.bin', Buffer.from('more-bytes')),
    (err) => err.code === 'STORAGE_UNAVAILABLE'
  );

  // getChunk: a transient message GET 500 is retried (exponential backoff),
  // so the chunk still loads; the CDN path has no retry and fails fast.
  fetch2.state.getMessageFailures = 1;
  const retried = await storage.getChunk(drive, mid);
  assert.deepStrictEqual(retried, Buffer.from('encrypted-bytes'));
  assert.strictEqual(fetch2.state.messageGetCalls, 2, 'one retry after the transient 500');

  // getChunk: CDN fetch failure -> STORAGE_UNAVAILABLE.
  fetch2.state.putFailures = 0;
  fetch2.state.cdnFailures = 1;
  const okMid = await storage.putChunk(drive, 'chunk-2.bin', Buffer.from('third'));
  await assert.rejects(
    storage.getChunk(drive, okMid),
    (err) => err.code === 'STORAGE_UNAVAILABLE'
  );

  // getChunk happy path returns the stored bytes.
  const bytes = await storage.getChunk(drive, mid);
  assert.deepStrictEqual(bytes, Buffer.from('encrypted-bytes'));

  // deleteChunk is idempotent: a missing message (Discord 404) resolves.
  await storage.deleteChunk(drive, 'm-does-not-exist');
  await storage.deleteChunk(drive, mid);
  assert.deepStrictEqual(fetch2.state.deleted, [mid]);

  // No webhook configured -> STORAGE_UNAVAILABLE on every storage op.
  const bareDrive = { id: 98 };
  await assert.rejects(storage.putChunk(bareDrive, 'x', Buffer.alloc(1)), (err) => err.code === 'STORAGE_UNAVAILABLE');
  await assert.rejects(storage.getChunk(bareDrive, 'm1'), (err) => err.code === 'STORAGE_UNAVAILABLE');
  await assert.rejects(storage.deleteChunk(bareDrive, 'm1'), (err) => err.code === 'STORAGE_UNAVAILABLE');
});

test('adapter unit: putChunks packs up to 10 chunks into one message', async () => {
  const env = { ...process.env };
  const config = loadConfig(env);
  const fetch3 = createFakeDiscordFetch();
  const storage = createDiscordWebhookStorage(config, { chunkSizeBytes: 8, fetchImpl: fetch3 });
  const sealed = await storage.validateAndSealWebhook(VALID_URL);
  const drive = {
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
  const results = await storage.putChunks(drive, chunks);

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
    const bytes = await storage.getChunk(drive, results[0].messageId, i);
    assert.deepStrictEqual(bytes, Buffer.from(`enc-${i}`), `attachment ${i}`);
  }

  // 11 chunks exceed the Discord message limit -> BAD_REQUEST before any POST.
  await assert.rejects(
    storage.putChunks(drive, chunks.concat([{ ordinal: 10, filename: 'chunk-10.bin', encryptedBuffer: Buffer.from('x') }])),
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
