'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, login, uploadFile, makeFixture, sha256hex, dbAll } = require('./helpers');

async function freshContext(t, overrides = {}) {
  const c = await startTestServer(overrides);
  t.after(() => c.close());
  const cl = makeClient(c.baseUrl);
  await login(cl, c);
  return { ctx: c, client: cl };
}

test('outbox lifecycle: a committed upload leaves no pending_posts rows and the message stays', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const res = await uploadFile(c2, { name: 'committed.bin', data: makeFixture(24), expect: 201 });
  assert.strictEqual(res.json.status, 'ready');

  // The intent row was inserted before the POST and deleted in the same
  // transaction as the block+chunk commit: nothing survives.
  const pending = await dbAll(ctx.db, 'SELECT * FROM pending_posts');
  assert.strictEqual(pending.length, 0, 'committed uploads leave no outbox rows');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'the packed message is committed');
  const blocks = await dbAll(ctx.db, 'SELECT * FROM content_blocks');
  assert.strictEqual(blocks.length, 3, 'one block row per chunk');
});

test('outbox lifecycle: a failed POST leaves a NULL-message_id row the sweep drops without Discord I/O', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  ctx.discordStorage.failNextPutChunks = 1;
  const res = await uploadFile(c2, { name: 'never-posted.bin', data: makeFixture(24), expect: 502 });
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');

  // The POST never resolved: the intent row exists with message_id NULL and
  // no Discord message was created.
  const pending = await dbAll(ctx.db, 'SELECT * FROM pending_posts');
  assert.strictEqual(pending.length, 1);
  assert.strictEqual(pending[0].message_id, null);
  assert.strictEqual(ctx.discordStorage.countMessages(), 0);

  const deleteCallsBefore = ctx.discordStorage.deleteCalls;
  await ctx.fileService.reconcilePendingPosts();
  assert.strictEqual((await dbAll(ctx.db, 'SELECT * FROM pending_posts')).length, 0, 'NULL-id row dropped');
  assert.strictEqual(ctx.discordStorage.deleteCalls, deleteCallsBefore, 'no Discord call for an un-posted batch');
});

test('replay sweep: a message_id-set row with no committed blocks deletes the orphan message and the row', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const entry = (await uploadFile(c2, { name: 'host.bin', data: makeFixture(24), expect: 201 })).json;
  const webhook = (await ctx.repositories.listWebhooks(1))[0];

  // Simulate a crash between the POST and the block commit: the message
  // exists on Discord, the intent row records its id, no block rows exist.
  const posted = await ctx.discordStorage.putChunks(webhook, [
    { filename: 'orphan.bin', encryptedBuffer: Buffer.from('orphaned-payload'), ordinal: 0 },
  ]);
  const messageId = posted[0].messageId;
  const intent = await ctx.repositories.insertPendingPost({
    driveId: 1,
    webhookId: webhook.id,
    entryId: entry.id,
    batchOrdinal: 99,
  });
  await ctx.repositories.updatePendingPostMessage(intent.id, messageId);
  assert.strictEqual(ctx.discordStorage.countMessages(), 2, 'host upload message + orphan message');

  await ctx.fileService.reconcilePendingPosts();

  assert.strictEqual((await dbAll(ctx.db, 'SELECT * FROM pending_posts')).length, 0, 'orphan intent row reconciled');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'orphan Discord message deleted');
  assert.ok(
    ctx.discordStorage.deletedMessages.some((d) => d.messageId === messageId),
    'deleteChunk called for the orphan message'
  );
});

test('replay sweep: skips rows whose entry is still uploading (live commit in flight)', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  await uploadFile(c2, { name: 'host.bin', data: makeFixture(24), expect: 201 });
  const webhook = (await ctx.repositories.listWebhooks(1))[0];

  // A live upload entry: its flush may be between the POST and the commit.
  const live = await ctx.repositories.insertEntry({
    driveId: 1,
    parentId: null,
    kind: 'file',
    name: 'live.bin',
    sizeBytes: 0,
    mimeType: null,
    status: 'uploading',
  });
  const posted = await ctx.discordStorage.putChunks(webhook, [
    { filename: 'midflight.bin', encryptedBuffer: Buffer.from('mid-flight-payload'), ordinal: 0 },
  ]);
  const messageId = posted[0].messageId;
  const intent = await ctx.repositories.insertPendingPost({
    driveId: 1,
    webhookId: webhook.id,
    entryId: live.id,
    batchOrdinal: 98,
  });
  await ctx.repositories.updatePendingPostMessage(intent.id, messageId);

  await ctx.fileService.reconcilePendingPosts();

  assert.strictEqual((await dbAll(ctx.db, 'SELECT * FROM pending_posts')).length, 1, 'row kept for the live upload');
  assert.ok(
    ctx.discordStorage.messagesForWebhook(webhook.id).has(messageId),
    'message untouched while the upload is live'
  );
});

test('replay sweep: never touches a row whose blocks committed', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const entry = (await uploadFile(c2, { name: 'committed.bin', data: makeFixture(24), expect: 201 })).json;
  const webhook = (await ctx.repositories.listWebhooks(1))[0];

  // A stale intent row whose message actually has committed blocks: the
  // blocks prove the message is live, so the sweep must leave it alone.
  const blocks = await dbAll(ctx.db, 'SELECT * FROM content_blocks');
  assert.ok(blocks.length > 0, 'upload committed blocks');
  const intent = await ctx.repositories.insertPendingPost({
    driveId: 1,
    webhookId: webhook.id,
    entryId: entry.id,
    batchOrdinal: 97,
  });
  await ctx.repositories.updatePendingPostMessage(intent.id, blocks[0].message_id);

  await ctx.fileService.reconcilePendingPosts();

  assert.strictEqual((await dbAll(ctx.db, 'SELECT * FROM pending_posts')).length, 1, 'row kept: blocks reference the message');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'live message untouched');
});

test('orphan sweep: reclaims a refcount-zero block message (message + block rows)', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  await uploadFile(c2, { name: 'host.bin', data: makeFixture(24), expect: 201 });
  const webhook = (await ctx.repositories.listWebhooks(1))[0];

  // A rolled-back batch: the message was POSTed and the block row inserted,
  // but no chunk row ever referenced it -> zero live refs.
  const posted = await ctx.discordStorage.putChunks(webhook, [
    { filename: 'dead.bin', encryptedBuffer: Buffer.from('dead-payload'), ordinal: 0 },
  ]);
  const messageId = posted[0].messageId;
  await ctx.repositories.insertBlock({
    driveId: 1,
    contentHash: sha256hex('dead-payload'),
    messageId,
    webhookId: webhook.id,
    plainSizeBytes: 12,
    cipherSizeBytes: 12,
    nonce: Buffer.alloc(12),
    authTag: Buffer.alloc(16),
    compression: 'none',
  });
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM content_blocks'))[0].c, 4, '3 host + 1 orphan block');

  await ctx.fileService.reconcileOrphanBlocks();

  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM content_blocks'))[0].c, 3, 'orphan block row reclaimed');
  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'orphan message deleted, host message kept');
  assert.ok(ctx.discordStorage.deletedMessages.some((d) => d.messageId === messageId));
});

test('orphan sweep: a message holding any live block is never deleted (dedup shares blocks)', async (t) => {
  const { ctx, client: c2 } = await freshContext(t, { chunkSizeBytes: 8 });
  const entry = (await uploadFile(c2, { name: 'host.bin', data: makeFixture(24), expect: 201 })).json;
  const webhook = (await ctx.repositories.listWebhooks(1))[0];

  // One Discord message packing two blocks: block 1 is referenced by a live
  // chunk, block 2 is orphaned. The message must survive while block 1 is
  // live (deleting it would break the live file).
  const posted = await ctx.discordStorage.putChunks(webhook, [
    { filename: 'live.bin', encryptedBuffer: Buffer.from('live-payload'), ordinal: 0 },
    { filename: 'dead.bin', encryptedBuffer: Buffer.from('dead-payload'), ordinal: 1 },
  ]);
  const messageId = posted[0].messageId;
  const blockLive = await ctx.repositories.insertBlock({
    driveId: 1,
    contentHash: sha256hex('live-payload'),
    messageId,
    webhookId: webhook.id,
    plainSizeBytes: 12,
    cipherSizeBytes: 12,
    nonce: Buffer.alloc(12),
    authTag: Buffer.alloc(16),
    compression: 'none',
  });
  const blockDead = await ctx.repositories.insertBlock({
    driveId: 1,
    contentHash: sha256hex('dead-payload'),
    messageId,
    webhookId: webhook.id,
    plainSizeBytes: 12,
    cipherSizeBytes: 12,
    nonce: Buffer.alloc(12),
    authTag: Buffer.alloc(16),
    compression: 'none',
  });
  const chunk = await ctx.repositories.insertChunk({ entryId: entry.id, ordinal: 77, blockId: blockLive.id });

  await ctx.fileService.reconcileOrphanBlocks();

  assert.ok(ctx.discordStorage.messagesForWebhook(webhook.id).has(messageId), 'shared message survives');
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM content_blocks'))[0].c, 5, 'no block rows dropped');

  // Once the live reference is gone, the whole message becomes reclaimable.
  await ctx.repositories.markChunkDeleted(chunk.id);
  await ctx.fileService.reconcileOrphanBlocks();

  assert.strictEqual(ctx.discordStorage.countMessages(), 1, 'message deleted once every block is dead');
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM content_blocks'))[0].c, 3, 'both packed block rows dropped');
  assert.ok(ctx.discordStorage.deletedMessages.some((d) => d.messageId === messageId));
});
