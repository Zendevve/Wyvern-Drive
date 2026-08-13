'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createDiscordWebhookStorage } = require('../src/storage/discord-webhook-storage');
const { startTestServer } = require('../test/helpers');

const CHUNK_SIZE = 64 * 1024;
const ITERATIONS = 3;
function jsonResponse(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    arrayBuffer: async () => Buffer.from(JSON.stringify(body)),
  };
}

function createMockDiscord() {
  const messages = new Map();
  const cdnObjects = new Map();
  let messageSequence = 0;
  let messageFetches = 0;
  let cdnFetches = 0;

  async function fetchImpl(rawUrl, init = {}) {
    const url = new URL(rawUrl);
    if (url.hostname === 'cdn.test') {
      cdnFetches += 1;
      const data = cdnObjects.get(url.href);
      return data ? { ok: true, status: 200, arrayBuffer: async () => Buffer.from(data) } : jsonResponse({}, 404);
    }
    if (url.hostname !== 'discord.com') return jsonResponse({}, 404);
    const messageMatch = url.pathname.match(/\/messages\/([^/]+)$/);
    if (messageMatch && (!init.method || init.method === 'GET')) {
      messageFetches += 1;
      const message = messages.get(messageMatch[1]);
      return message ? jsonResponse(message) : jsonResponse({}, 404);
    }
    if (messageMatch && init.method === 'DELETE') {
      messages.delete(messageMatch[1]);
      return jsonResponse({}, 204);
    }
    if (init.method === 'POST' && url.searchParams.get('wait') === 'true') {
      const id = `msg-${++messageSequence}`;
      const attachments = [];
      if (init.body && typeof init.body.entries === 'function') {
        for (const [name, value] of init.body.entries()) {
          if (name !== 'file') continue;
          const attachmentUrl = `https://cdn.test/${id}/${attachments.length}`;
          cdnObjects.set(attachmentUrl, Buffer.from(await value.arrayBuffer()));
          attachments.push({ url: attachmentUrl });
        }
      }
      const message = { id, attachments };
      messages.set(id, message);
      return jsonResponse(message);
    }
    return jsonResponse({ id: '123' });
  }

  return {
    fetchImpl,
    get messageFetches() { return messageFetches; },
    get cdnFetches() { return cdnFetches; },
    get messageCount() { return messages.size; },
    get attachmentCount() {
      let total = 0;
      for (const message of messages.values()) total += message.attachments.length;
      return total;
    },
  };
}
const WEBHOOK_URL = 'https://discord.com/api/webhooks/123/test-token';

function makeFixture(size, seed) {
  const data = Buffer.allocUnsafe(size);
  let state = seed >>> 0;
  for (let i = 0; i < data.length; i += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    data[i] = state >>> 24;
  }
  return data;
}

function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

async function collect(stream) {
  const parts = [];
  for await (const part of stream) parts.push(Buffer.from(part));
  return Buffer.concat(parts);
}

async function upload(ctx, drive, parentId, name, data, token) {
  await ctx.fileService.uploadFile({
    drive,
    parentId,
    fileStream: Readable.from([data]),
    filename: name,
    mimeType: 'application/octet-stream',
    uploadToken: token,
    expectedSizeBytes: data.length,
  });
  const entry = await ctx.repositories.getEntryByUploadToken(drive.id, token);
  assert.ok(entry && entry.status === 'ready', `${name} should be ready`);
  return entry;
}

async function download(ctx, drive, entryId, range) {
  const result = await ctx.fileService.downloadFile({ drive, entryId, range });
  return { result, body: await collect(result.stream()) };
}

async function runWorkflow(iteration) {
  const mockDiscord = createMockDiscord();
  const storage = createDiscordWebhookStorage(
    { encryptionKey: Buffer.alloc(32, 7) },
    { chunkSizeBytes: CHUNK_SIZE, fetchImpl: mockDiscord.fetchImpl }
  );
  const ctx = await startTestServer({
    storage,
    chunkSizeBytes: CHUNK_SIZE,
    quotaBytes: 16 * 1024 * 1024,
    compressChunks: true,
  });
  try {
    const user = await ctx.repositories.upsertUserByDiscord({
      discordId: `bench-${iteration}`,
      username: 'benchmark',
      avatarUrl: null,
    });
    const drive = await ctx.repositories.insertDrive({ ownerId: user.id, quotaBytes: 16 * 1024 * 1024 });
    await ctx.fileService.addWebhook({ drive, webhookUrl: WEBHOOK_URL });

    const started = process.hrtime.bigint();
    const alpha = await ctx.fileService.createFolder({ drive, parentId: null, name: 'alpha' });
    const beta = await ctx.fileService.createFolder({ drive, parentId: null, name: 'beta' });
    const first = makeFixture(CHUNK_SIZE * 3 + 137, 11);
    const second = makeFixture(CHUNK_SIZE * 2 + 4099, 29);
    const third = makeFixture(CHUNK_SIZE + 8191, 47);

    const original = await upload(ctx, drive, alpha.id, 'original.bin', first, `bench-${iteration}-original`);
    const duplicate = await upload(ctx, drive, beta.id, 'duplicate.bin', first, `bench-${iteration}-duplicate`);
    const secondEntry = await upload(ctx, drive, alpha.id, 'second.bin', second, `bench-${iteration}-second`);
    const thirdEntry = await upload(ctx, drive, beta.id, 'third.bin', third, `bench-${iteration}-third`);

    const full = await download(ctx, drive, original.id);
    assert.equal(full.result.status, 200);
    assert.equal(sha256(full.body), sha256(first));
    const range = await download(ctx, drive, original.id, { start: 1234, end: CHUNK_SIZE + 4321 });
    assert.equal(range.result.status, 206);
    assert.deepEqual(range.body, first.subarray(1234, CHUNK_SIZE + 4322));

    const search = await ctx.fileService.listEntries({
      drive,
      parentId: 999999,
      query: 'bin',
      kind: 'file',
      sort: 'size',
      direction: 'desc',
    });
    assert.equal(search.length, 4);
    assert.ok(search[0].sizeBytes >= search[1].sizeBytes);

    const copy = await ctx.fileService.copyEntry({ drive, entryId: secondEntry.id, parentId: beta.id });
    await ctx.fileService.renameEntry({ drive, entryId: copy.id, name: 'second-copy.bin' });
    await ctx.fileService.moveEntry({ drive, entryId: copy.id, parentId: null });
    await ctx.fileService.deleteEntry({ drive, entryId: duplicate.id });
    await ctx.fileService.restoreEntry({ drive, entryId: duplicate.id });
    const stats = await ctx.repositories.driveStats(drive.id);
    const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;

    assert.equal(stats.sizeBytes, first.length * 2 + second.length * 2 + third.length);
    assert.ok(mockDiscord.messageCount > 0);
    return {
      elapsedMs,
      dedupSavedChunks: Math.ceil(first.length / CHUNK_SIZE),
      messages: mockDiscord.messageCount,
      attachments: mockDiscord.attachmentCount,
      messageFetches: mockDiscord.messageFetches,
      cdnFetches: mockDiscord.cdnFetches,
      storedBytes: stats.storedBytes,
      logicalBytes: stats.sizeBytes,
      entries: [original, duplicate, secondEntry, thirdEntry, copy].length,
    };
  } finally {
    await ctx.close();
  }
}

async function main() {
  process.env.WYVERN_UPLOAD_CONCURRENCY = '4';
  process.env.WYVERN_DOWNLOAD_CONCURRENCY = '4';
  await runWorkflow(0);
  const results = [];
  for (let i = 1; i <= ITERATIONS; i += 1) results.push(await runWorkflow(i));
  const sorted = results.map((result) => result.elapsedMs).sort((a, b) => a - b);
  const medianMs = sorted[Math.floor(sorted.length / 2)];
  const last = results[results.length - 1];
  console.log(`METRIC workflow_ms=${medianMs.toFixed(3)}`);
  console.log(`METRIC discord_messages=${last.messages}`);
  console.log(`METRIC discord_attachments=${last.attachments}`);
  console.log(`METRIC discord_message_fetches=${last.messageFetches}`);
  console.log(`METRIC discord_cdn_fetches=${last.cdnFetches}`);
  console.log(`METRIC dedup_saved_chunks=${last.dedupSavedChunks}`);
  console.log(`METRIC logical_bytes=${last.logicalBytes}`);
  console.log(`METRIC stored_bytes=${last.storedBytes}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
