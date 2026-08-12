'use strict';

const { test } = require('node:test');
const assert = require('node:assert');
const { startTestServer, makeClient, performOAuth, login, configureWebhook, ORIGIN, dbAll } = require('./helpers');

async function setup(t, overrides = {}) {
  const ctx = await startTestServer(overrides);
  t.after(() => ctx.close());
  const client = makeClient(ctx.baseUrl);
  return { ctx, client };
}

test('GET /api/auth/discord redirects to Discord with state and a state cookie', async (t) => {
  const { client } = await setup(t);
  const res = await client.request('/api/auth/discord', { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  const location = res.headers.get('location');
  const url = new URL(location);
  assert.strictEqual(url.origin, 'https://discord.com');
  assert.strictEqual(url.pathname, '/api/oauth2/authorize');
  assert.strictEqual(url.searchParams.get('scope'), 'identify');
  assert.strictEqual(url.searchParams.get('response_type'), 'code');
  assert.strictEqual(url.searchParams.get('client_id'), 'test-client-id');
  assert.strictEqual(url.searchParams.get('redirect_uri'), `${ORIGIN}/api/auth/discord/callback`);
  assert.ok(url.searchParams.get('state'));
  assert.ok(res.cookies.wyvern_oauth_state);
});

test('callback happy path creates user and session, redirects to /connect, and webhook setup creates the drive', async (t) => {
  const { ctx, client } = await setup(t);
  const res = await performOAuth(client);
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get('location'), `${ORIGIN}/connect`);

  const sessionCookie = res.cookies.wyvern_session;
  const csrfCookie = res.cookies.wyvern_csrf;
  assert.ok(sessionCookie);
  assert.ok(csrfCookie);

  // No storage is provisioned by the callback itself.
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM drives'))[0].c, 0);

  const user = await ctx.repositories.getUserById(1);
  assert.strictEqual(user.discord_id, '1001');
  assert.strictEqual(user.username, 'alice');

  // The authenticated webhook setup creates the drive with a sealed credential.
  const cfg = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/123/test-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  assert.strictEqual(cfg.json.id, 1);
  assert.strictEqual(cfg.json.quotaBytes, ctx.config.defaultQuotaBytes);
  assert.strictEqual(cfg.json.usedBytes, 0);
  assert.strictEqual(cfg.json.webhooks.length, 1);

  const drive = await ctx.repositories.getDriveByOwner(1);
  assert.ok(drive, 'drive should be provisioned by webhook setup');
  assert.strictEqual(drive.legacy_discord_channel_id, null);
  // Credentials live in the webhooks table; the legacy drive columns stay NULL.
  assert.strictEqual(drive.webhook_ciphertext, null);
  const webhooks = await ctx.repositories.listWebhooks(1);
  assert.strictEqual(webhooks.length, 1);
  assert.ok(Buffer.isBuffer(webhooks[0].webhook_ciphertext) && webhooks[0].webhook_ciphertext.length > 0);
  assert.strictEqual(webhooks[0].webhook_nonce.length, 'nonce:https://discord.com/api/webhooks/123/test-token'.length);
  assert.strictEqual(drive.quota_bytes, ctx.config.defaultQuotaBytes);

  // session row stores only the hash, never the token
  const sessions = await dbAll(ctx.db, 'SELECT token_hash FROM sessions');
  assert.strictEqual(sessions.length, 1);
  assert.notStrictEqual(sessions[0].token_hash, sessionCookie);
  assert.match(sessions[0].token_hash, /^[0-9a-f]{64}$/);
});

test('session cookie carries the required security attributes', async (t) => {
  const { client } = await setup(t);
  const res = await performOAuth(client);
  const setCookies = res.raw.headers.getSetCookie();
  const sessionHeader = setCookies.find((c) => c.startsWith('wyvern_session='));
  assert.match(sessionHeader, /HttpOnly/i);
  assert.match(sessionHeader, /SameSite=Lax/i);
  assert.match(sessionHeader, /Path=\//i);
  assert.match(sessionHeader, /Max-Age=2592000/i);
  assert.doesNotMatch(sessionHeader, /Secure/i); // NODE_ENV=test

  const csrfHeader = setCookies.find((c) => c.startsWith('wyvern_csrf='));
  assert.doesNotMatch(csrfHeader, /HttpOnly/i, 'wyvern_csrf must be readable');
});

test('callback with an invalid or missing state redirects without a session', async (t) => {
  const { ctx, client } = await setup(t);
  // no state cookie at all
  let res = await client.request('/api/auth/discord/callback?code=test-code&state=nope', { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get('location'), `${ORIGIN}/login?error=invalid_state`);
  assert.ok(!res.cookies.wyvern_session);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM sessions'))[0].c, 0);

  // state cookie present but mismatched
  res = await client.request('/api/auth/discord', { redirect: 'manual' });
  res = await client.request('/api/auth/discord/callback?code=test-code&state=wrong-state', { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get('location'), `${ORIGIN}/login?error=invalid_state`);
  assert.ok(!res.cookies.wyvern_session);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM sessions'))[0].c, 0);
});

test('callback without a code redirects to an error', async (t) => {
  const { client } = await setup(t);
  await client.request('/api/auth/discord', { redirect: 'manual' });
  const res = await client.request('/api/auth/discord/callback?state=whatever', { redirect: 'manual' });
  assert.strictEqual(res.status, 302);
  assert.strictEqual(res.headers.get('location'), `${ORIGIN}/login?error=invalid_state`);
});

test('webhook validation failure leaves a drive with no webhooks and surfaces INVALID_WEBHOOK', async (t) => {
  const { ctx, client } = await setup(t);
  await performOAuth(client);

  const res = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/123/bad-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 400);
  assert.strictEqual(res.json.error.code, 'INVALID_WEBHOOK');
  // The drive row is created before validation (unified route), but a failed
  // validation must never persist a webhook credential.
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM drives'))[0].c, 1);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM webhooks'))[0].c, 0, 'no webhook row on failure');
  assert.strictEqual(ctx.discordStorage.webhookValidationCalls, 1);
});

test('Discord unavailability during webhook validation returns STORAGE_UNAVAILABLE and no webhook', async (t) => {
  const { ctx, client } = await setup(t);
  await performOAuth(client);
  ctx.discordStorage.failNextWebhookValidations = 1;

  const res = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/123/test-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(res.status, 502);
  assert.strictEqual(res.json.error.code, 'STORAGE_UNAVAILABLE');
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM drives'))[0].c, 1);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM webhooks'))[0].c, 0);

  // A later, successful validation adds the webhook to the existing drive (200).
  const ok = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/123/test-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 200,
  });
  assert.strictEqual(ok.json.id, 1);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM drives'))[0].c, 1);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM webhooks'))[0].c, 1);
});

test('configured drive redirects to /drive on repeat logins', async (t) => {
  const { ctx, client } = await setup(t);
  await login(client, ctx); // callback -> /connect, then webhook configured
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM drives'))[0].c, 1);

  const res = await performOAuth(client); // second login
  assert.strictEqual(res.headers.get('location'), `${ORIGIN}/drive`);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM drives'))[0].c, 1);
  assert.strictEqual(ctx.discordStorage.webhookValidationCalls, 1, 'no re-validation');
});

test('POST /api/storage/webhook: first-time 201 with the webhook listed, later adds 200', async (t) => {
  const { ctx, client } = await setup(t);
  await performOAuth(client);

  // First-time creation.
  const created = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/123/test-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 201,
  });
  assert.deepStrictEqual(Object.keys(created.json).sort(), ['id', 'quotaBytes', 'usedBytes', 'webhooks']);
  assert.strictEqual(created.json.id, 1);
  assert.strictEqual(created.json.webhooks.length, 1);

  // Appending a second webhook to the same drive returns 200 and lists both.
  ctx.discordStorage.validWebhooks.add('https://discord.com/api/webhooks/456/other-token');
  const appended = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/456/other-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
    expect: 200,
  });
  assert.strictEqual(appended.json.id, 1);
  assert.strictEqual(appended.json.webhooks.length, 2);
  assert.deepStrictEqual(
    appended.json.webhooks.map((w) => w.id),
    [1, 2]
  );
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM drives'))[0].c, 1, 'no duplicate drive');

  // A legacy bot-era drive returns STORAGE_MIGRATION_REQUIRED and keeps its value.
  await login(client, ctx, { as: { id: '2002', username: 'bob', avatar: null }, noWebhook: true });
  const legacyDrive = await ctx.repositories.insertDrive({
    ownerId: 2,
    webhookCiphertext: null,
    webhookNonce: null,
    webhookAuthTag: null,
    quotaBytes: ctx.config.defaultQuotaBytes,
  });
  await ctx.db.exec(`UPDATE drives SET legacy_discord_channel_id = 'ch-legacy' WHERE id = ${legacyDrive.id}`);
  const legacy = await client.request('/api/storage/webhook', {
    method: 'POST',
    body: JSON.stringify({ webhookUrl: 'https://discord.com/api/webhooks/123/test-token' }),
    headers: { 'content-type': 'application/json' },
    csrf: true,
  });
  assert.strictEqual(legacy.status, 409);
  assert.strictEqual(legacy.json.error.code, 'STORAGE_MIGRATION_REQUIRED');
  const kept = await ctx.repositories.getDriveById(legacyDrive.id);
  assert.strictEqual(kept.legacy_discord_channel_id, 'ch-legacy', 'legacy value preserved');
  assert.strictEqual(kept.webhook_ciphertext, null);
});

test('POST /api/storage/webhook: missing/invalid input returns 400 INVALID_WEBHOOK', async (t) => {
  const { client } = await setup(t);
  await login(client, undefined, { noWebhook: true });
  for (const body of [{}, { webhookUrl: '' }, { webhookUrl: '   ' }, { webhookUrl: 42 }]) {
    const res = await client.request('/api/storage/webhook', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
      csrf: true,
    });
    assert.strictEqual(res.status, 400, `body ${JSON.stringify(body)}`);
    assert.strictEqual(res.json.error.code, 'INVALID_WEBHOOK');
  }
});

test('POST /api/storage/webhook: malformed URLs are rejected before any Discord call', async (t) => {
  const { ctx, client } = await setup(t);
  await login(client, undefined, { noWebhook: true });
  for (const url of [
    'http://discord.com/api/webhooks/123/token',
    'https://evil.example/api/webhooks/123/token',
    'https://discord.com/api/webhooks/abc/token',
    'https://discord.com/not-a-webhook',
    'https://discord.com/api/webhooks/123/',
  ]) {
    const res = await client.request('/api/storage/webhook', {
      method: 'POST',
      body: JSON.stringify({ webhookUrl: url }),
      headers: { 'content-type': 'application/json' },
      csrf: true,
    });
    assert.strictEqual(res.status, 400, url);
    assert.strictEqual(res.json.error.code, 'INVALID_WEBHOOK');
  }
  assert.strictEqual(ctx.discordStorage.webhookValidationCalls, 0, 'no Discord call for malformed URLs');
});

test('GET /api/auth/me returns null user anonymously and full identity when signed in', async (t) => {
  const { ctx, client } = await setup(t);

  let res = await client.request('/api/auth/me');
  assert.deepStrictEqual(res.json, { user: null });

  // Signed in but storage not yet connected: drive is null.
  await login(client, ctx, { noWebhook: true });
  res = await client.request('/api/auth/me');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.user.id, 1);
  assert.strictEqual(res.json.drive, null);

  // Once a webhook is configured, the drive summary appears.
  await configureWebhook(client);
  res = await client.request('/api/auth/me');
  assert.strictEqual(res.status, 200);
  assert.strictEqual(res.json.user.id, 1);
  assert.strictEqual(res.json.user.discordId, '1001');
  assert.strictEqual(res.json.user.username, 'alice');
  assert.strictEqual(res.json.user.avatarUrl, null);
  assert.ok(res.json.drive.id);
  assert.strictEqual(res.json.drive.quotaBytes, ctx.config.defaultQuotaBytes);
  assert.strictEqual(res.json.drive.usedBytes, 0);

  // no tokens, channel ids, webhook URLs, or hashes leak
  const serialized = JSON.stringify(res.json);
  assert.ok(!serialized.includes('token'));
  assert.ok(!serialized.includes('channel'));
  assert.ok(!serialized.includes('access'));
  assert.ok(!serialized.includes('webhook'));
});

test('POST /api/auth/logout revokes the session and clears cookies', async (t) => {
  const { ctx, client } = await setup(t);
  await login(client, ctx);

  const res = await client.request('/api/auth/logout', { method: 'POST', csrf: true, expect: 204 });
  assert.ok(!res.cookies.wyvern_session);
  assert.ok(!res.cookies.wyvern_csrf);
  assert.strictEqual((await dbAll(ctx.db, 'SELECT COUNT(*) AS c FROM sessions'))[0].c, 0);

  const me = await client.request('/api/auth/me');
  assert.deepStrictEqual(me.json, { user: null });
});

test('CSRF: mutations without token/origin are rejected with 403 CSRF_FAILED', async (t) => {
  const { client } = await setup(t);
  await login(client);
  const body = { parentId: null, name: 'x' };

  // no CSRF header, no origin
  let res = await client.request('/api/folders', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' } });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.error.code, 'CSRF_FAILED');

  // header present, origin missing
  res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-csrf-token': client.jar.wyvern_csrf },
  });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.error.code, 'CSRF_FAILED');

  // header present, wrong origin
  res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-csrf-token': client.jar.wyvern_csrf, origin: 'http://evil.example' },
  });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.error.code, 'CSRF_FAILED');

  // header mismatch
  res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'bogus', origin: ORIGIN },
  });
  assert.strictEqual(res.status, 403);
  assert.strictEqual(res.json.error.code, 'CSRF_FAILED');

  // valid token + origin passes
  res = await client.request('/api/folders', { method: 'POST', body: JSON.stringify(body), headers: { 'content-type': 'application/json' }, csrf: true, expect: 201 });
  assert.strictEqual(res.json.name, 'x');
});

test('protected routes return 401 AUTH_REQUIRED without a session', async (t) => {
  const { client } = await setup(t);
  for (const route of ['/api/drive', '/api/entries', '/api/files/1/download']) {
    const res = await client.request(route);
    assert.strictEqual(res.status, 401, route);
    assert.deepStrictEqual(res.json, { error: { code: 'AUTH_REQUIRED', message: 'Authentication required' } });
  }
});

test('anonymous mutations are rejected with 401 once CSRF passes', async (t) => {
  const { client } = await setup(t);
  const res = await client.request('/api/folders', {
    method: 'POST',
    body: JSON.stringify({ parentId: null, name: 'x' }),
    headers: { 'content-type': 'application/json', 'x-csrf-token': 'fake-token', origin: ORIGIN },
    cookies: { wyvern_csrf: 'fake-token' },
  });
  assert.strictEqual(res.status, 401);
  assert.strictEqual(res.json.error.code, 'AUTH_REQUIRED');
});
