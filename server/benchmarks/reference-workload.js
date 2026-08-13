'use strict';

const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { startTestServer } = require('../test/helpers');

const CHUNK_SIZE = 64 * 1024;
const ITERATIONS = 3;
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
  const ctx = await startTestServer({
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
    assert.ok(ctx.discordStorage.countMessages() > 0);
    return {
      elapsedMs,
      dedupSavedChunks: Math.ceil(first.length / CHUNK_SIZE),
      messages: ctx.discordStorage.countMessages(),
      attachments: ctx.discordStorage.countAttachments(),
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
  console.log(`METRIC dedup_saved_chunks=${last.dedupSavedChunks}`);
  console.log(`METRIC logical_bytes=${last.logicalBytes}`);
  console.log(`METRIC stored_bytes=${last.storedBytes}`);
}

main().catch((error) => {
  console.error(error.stack || error.message || error);
  process.exitCode = 1;
});
