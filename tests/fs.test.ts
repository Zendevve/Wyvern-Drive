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

describe('Fastify /fs routes', () => {
  let ctx: ReturnType<typeof makeApp>;

  beforeEach(() => {
    ctx = makeApp();
  });

  afterEach(async () => {
    await ctx.cleanup();
  });

  it('rejects requests without a bearer token', async () => {
    const res = await ctx.app.inject({ method: 'POST', url: '/fs/folder', payload: { name: 'x' } });
    expect(res.statusCode).toBe(401);
  });

  it('creates a folder and lists it', async () => {
    const create = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { parent_id: null, name: 'Documents' },
    });
    expect(create.statusCode).toBe(201);
    const created = JSON.parse(create.body);
    expect(created.kind).toBe('folder');
    expect(created.name).toBe('Documents');

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/fs/list',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    expect(list.statusCode).toBe(200);
    const body = JSON.parse(list.body);
    expect(body.items.length).toBe(1);
    expect(body.items[0].id).toBe(created.id);
  });

  it('rejects reserved names', async () => {
    const res = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: '..' },
    });
    expect(res.statusCode).toBe(400);
  });

  it('returns 409 on sibling name conflict', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'Docs' },
    });
    const second = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'docs' },
    });
    expect(second.statusCode).toBe(409);
  });

  it('isolates account A from account B listings', async () => {
    await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'Private' },
    });
    const listB = await ctx.app.inject({
      method: 'GET',
      url: '/fs/list',
      headers: { authorization: `Bearer ${ctx.tokenB}` },
    });
    expect(JSON.parse(listB.body).items.length).toBe(0);
  });

  it('returns 404 when fetching a foreign account node', async () => {
    const create = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'mine' },
    });
    const id = JSON.parse(create.body).id;
    const get = await ctx.app.inject({
      method: 'GET',
      url: `/fs/node?id=${id}`,
      headers: { authorization: `Bearer ${ctx.tokenB}` },
    });
    expect(get.statusCode).toBe(404);
  });

  it('records chunks for a file and returns them ordered', async () => {
    const folder = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'f' },
    });
    const parent = JSON.parse(folder.body).id;

    const created = await ctx.app.inject({
      method: 'POST',
      url: '/fs/file/created',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: {
        name: 'big.bin',
        parent_id: parent,
        size_bytes: 30,
        mime_type: 'application/octet-stream',
        chunks: [
          { discordMessageId: 'msg2', index: 1, sizeBytes: 10, cdnUrl: 'u2' },
          { discordMessageId: 'msg1', index: 0, sizeBytes: 10, cdnUrl: 'u1' },
        ],
      },
    });
    expect(created.statusCode).toBe(201);
    const body = JSON.parse(created.body);
    expect(body.node.kind).toBe('file');
    expect(body.chunks.length).toBe(2);
    expect(body.chunks[0].index).toBe(0);

    const get = await ctx.app.inject({
      method: 'GET',
      url: `/fs/node?id=${body.node_id}`,
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    expect(get.statusCode).toBe(200);
    const detail = JSON.parse(get.body);
    expect(detail.chunks.map((c: any) => c.index)).toEqual([0, 1]);
  });

  it('cascade deletes a folder and its files', async () => {
    const folder = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'doomed' },
    });
    const folderId = JSON.parse(folder.body).id;

    const file = await ctx.app.inject({
      method: 'POST',
      url: '/fs/file/created',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: {
        name: 'a.bin',
        parent_id: folderId,
        size_bytes: 5,
        chunks: [{ discordMessageId: 'msgA', index: 0, sizeBytes: 5, cdnUrl: 'uA' }],
      },
    });
    expect(file.statusCode).toBe(201);

    const del = await ctx.app.inject({
      method: 'DELETE',
      url: '/fs/node',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: { id: folderId },
    });
    expect(del.statusCode).toBe(200);
    const result = JSON.parse(del.body);
    expect(result.success).toBe(true);
    expect(result.deleted_nodes).toBe(2);
    expect(result.deleted_messages).toEqual(['msgA']);

    const list = await ctx.app.inject({
      method: 'GET',
      url: '/fs/list',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
    });
    expect(JSON.parse(list.body).items.length).toBe(0);
  });

  it('renames a node', async () => {
    const folder = await ctx.app.inject({
      method: 'POST',
      url: '/fs/folder',
      headers: { authorization: `Bearer ${ctx.tokenA}` },
      payload: { name: 'old' },
    });
    const id = JSON.parse(folder.body).id;
    const patch = await ctx.app.inject({
      method: 'PATCH',
      url: '/fs/node',
      headers: { authorization: `Bearer ${ctx.tokenA}`, 'content-type': 'application/json' },
      payload: { id, name: 'new' },
    });
    expect(patch.statusCode).toBe(200);
    expect(JSON.parse(patch.body).name).toBe('new');
  });
});
