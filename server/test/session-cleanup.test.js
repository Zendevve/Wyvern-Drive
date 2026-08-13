'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const crypto = require('node:crypto');
const { startTestServer, dbAll } = require('./helpers');

const DAY_MS = 24 * 60 * 60 * 1000;

test('deleteExpired reclaims expired session rows and leaves active sessions valid', async (t) => {
  const ctx = await startTestServer();
  t.after(() => ctx.close());

  const user = await ctx.repositories.upsertUserByDiscord({
    discordId: 'cleanup-9001',
    username: 'sweep-user',
    avatarUrl: null,
  });
  const userId = user.id;

  // Active session: TTL in the future.
  const activeToken = 'active-session-token';
  await ctx.sessionStore.create(activeToken, userId, 30 * DAY_MS);

  // Expired sessions: TTL already elapsed, and one that expires at the exact
  // sweep boundary (ttlMs 0).
  const expiredToken = 'expired-session-token';
  const boundaryToken = 'boundary-session-token';
  await ctx.sessionStore.create(expiredToken, userId, -60 * 1000);
  await ctx.sessionStore.create(boundaryToken, userId, 0);

  // Lookup semantics unchanged: an expired row is absent even before the
  // sweep runs, and an active row resolves normally.
  assert.strictEqual(await ctx.sessionStore.findByToken(expiredToken), null);
  assert.ok((await ctx.sessionStore.findByToken(activeToken)).userId === userId);

  const { changes } = await ctx.sessionStore.deleteExpired();
  assert.strictEqual(changes, 2, 'both expired rows are deleted');

  const rows = await dbAll(ctx.db, 'SELECT token_hash FROM sessions ORDER BY id');
  assert.strictEqual(rows.length, 1, 'only the active session remains');
  assert.strictEqual(rows[0].token_hash, crypto.createHash('sha256').update(activeToken).digest('hex'));

  // Active session still resolves after the sweep.
  assert.ok(await ctx.sessionStore.findByToken(activeToken));

  // Re-running is a harmless no-op.
  const second = await ctx.sessionStore.deleteExpired();
  assert.strictEqual(second.changes, 0);
});
