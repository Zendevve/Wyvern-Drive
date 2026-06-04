import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import Database from 'better-sqlite3';
import { SCHEMA_SQL } from '../src/db/schema';
import { buildApp, type AppInstance } from '../src/app';

const WEBHOOK_A = 'https://discord.com/api/webhooks/1234567890/abc-123_xyz';
const WEBHOOK_B = 'https://discord.com/api/webhooks/9876543210/def-456_uvw';
const JWT_SECRET = 'test_secret_key_1234567890';

function makeApp(): { app: AppInstance; cleanup: () => void; tokenA: string; tokenB: string } {
  const db = new Database(':memory:');
  db.pragma('journal_mode = MEMORY');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA_SQL);
  const app = buildApp({ db });
  const tokenA = jwt.sign({ webhookUrl: WEBHOOK_A }, JWT_SECRET);
  const tokenB = jwt.sign({ webhookUrl: WEBHOOK_B }, JWT_SECRET);
  return { app, cleanup: () => app.close(), tokenA, tokenB };
}

describe('Fastify /fs/backup and /fs/restore', () => {
  let ctx: ReturnType<typeof makeApp>;

  beforeEach(() => {
    ctx = makeApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  async function seedAccountA() {
    const folder = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'A' },
    });
    const parent = JSON.parse(folder.body).id;
    await ctx.app.inject({
      method: 'POST',
      url: '/fs/file/created',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: {
        name: 'a.bin',
        parent_id: parent,
        size_bytes: 5,
        chunks: [{ discordMessageId: 'm1', index: 0, sizeBytes: 5, cdnUrl: 'u1' }],
      },
    });
  }

  it('exports only the requester account data', async () => {
    await seedAccountA();
    await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenB}` },
      payload: { name: 'B' },
    });

    const res = await ctx.app.inject({
      method: 'GET',
      url: '/fs/backup',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.version).toBe(1);
    expect(body.account_id).not.toBe('');
    expect(body.nodes.length).toBe(2);
    expect(body.nodes.every((n: any) => n.account_id === body.account_id)).toBe(true);
    expect(body.chunks.length).toBe(1);
  });

  it('round-trips a backup into the same account', async () => {
    await seedAccountA();
    const exportRes = await ctx.app.inject({
      method: 'GET',
      url: '/fs/backup',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    const backup = JSON.parse(exportRes.body);

    const freshDb = new Database(':memory:');
    freshDb.pragma('journal_mode = MEMORY');
    freshDb.pragma('foreign_keys = ON');
    freshDb.exec(SCHEMA_SQL);
    const freshApp = buildApp({ db: freshDb });

    const restore = await freshApp.inject({
      method: 'POST',
      url: '/fs/restore',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: { backup },
    });
    expect(restore.statusCode).toBe(200);
    const result = JSON.parse(restore.body);
    expect(result.inserted_nodes).toBe(2);
    expect(result.inserted_chunks).toBe(1);

    const verify = await freshApp.inject({
      method: 'GET',
      url: '/fs/backup',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    const verifyBody = JSON.parse(verify.body);
    expect(verifyBody.nodes.length).toBe(2);
    expect(verifyBody.chunks.length).toBe(1);

    await freshApp.close();
  });

  it('rejects restoring a backup from another account', async () => {
    const exportA = await ctx.app.inject({
      method: 'GET',
      url: '/fs/backup',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    const backupA = JSON.parse(exportA.body);

    const restore = await ctx.app.inject({
      method: 'POST',
      url: '/fs/restore',
      headers: { authorization: `Bearer ${ctx.tokenB}`, 'content-type': 'application/json' },
      payload: { backup: backupA },
    });
    expect(restore.statusCode).toBe(400);
    const body = JSON.parse(restore.body);
    expect(body.error).toContain('account_id');
  });

  it('rejects backup with wrong version', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/fs/restore',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: { backup: { version: 2, account_id: 'x', nodes: [], chunks: [] } },
    });
    expect(res.statusCode).toBe(400);
  });

  it('rejects malformed backup and rolls back any partial inserts', async () => {
    await seedAccountA();
    const exportA = await ctx.app.inject({
      method: 'GET',
      url: '/fs/backup',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    const backupA = JSON.parse(exportA.body);
    backupA.nodes[0].id = 12345 as any;

    const freshDb = new Database(':memory:');
    freshDb.pragma('journal_mode = MEMORY');
    freshDb.pragma('foreign_keys = ON');
    freshDb.exec(SCHEMA_SQL);
    const freshApp = buildApp({ db: freshDb });

    const res = await freshApp.inject({
      method: 'POST',
      url: '/fs/restore',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: { backup: backupA },
    });
    expect(res.statusCode).toBe(400);

    const verify = await freshApp.inject({
      method: 'GET',
      url: '/fs/backup',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    expect(JSON.parse(verify.body).nodes.length).toBe(0);

    await freshApp.close();
  });
});
