import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth';
import {
  createNode,
  deleteNode,
  getChunks,
  getNode,
  listChildren,
  renameNode,
  recordChunks,
  UniqueViolationError,
} from '../services/fs-repo';
import { cascadeDelete } from '../services/cascade';
import { exportBackup, restoreBackup } from '../services/backup';

const RESERVED_NAMES = new Set(['', '.', '..']);

function sanitizeName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (RESERVED_NAMES.has(trimmed)) return null;
  if (trimmed.includes('/') || trimmed.includes('\\')) return null;
  return trimmed;
}

export async function fsRoutes(app: FastifyInstance) {
  const auth = { preHandler: authenticate };

  app.post<{ Body: { parent_id?: string | null; name?: string } }>(
    '/fs/folder',
    auth,
    async (request, reply) => {
      const name = sanitizeName(request.body?.name);
      if (name === null) {
        return reply.status(400).send({ error: 'Invalid folder name', code: 'INVALID_NAME' });
      }
      const parentId = request.body?.parent_id ?? null;
      if (parentId !== null) {
        const parent = getNode(app.db, request.accountId, parentId);
        if (!parent || parent.kind !== 'folder') {
          return reply.status(404).send({ error: 'Parent folder not found', code: 'NOT_FOUND' });
        }
      }
      try {
        const node = createNode(app.db, {
          accountId: request.accountId,
          parentId,
          name,
          kind: 'folder',
        });
        return reply.status(201).send(node);
      } catch (err) {
        if (err instanceof UniqueViolationError) {
          return reply.status(409).send({ error: 'Name already exists in folder', code: 'CONFLICT' });
        }
        throw err;
      }
    }
  );

  app.get<{ Querystring: { parent_id?: string } }>(
    '/fs/list',
    auth,
    async (request) => {
      const parentId = request.query.parent_id || null;
      const items = listChildren(app.db, request.accountId, parentId);
      return { items };
    }
  );

  app.get<{ Querystring: { id: string } }>(
    '/fs/node',
    auth,
    async (request, reply) => {
      const id = request.query.id;
      const node = getNode(app.db, request.accountId, id);
      if (!node) {
        return reply.status(404).send({ error: 'Node not found', code: 'NOT_FOUND' });
      }
      const chunks = node.kind === 'file' ? getChunks(app.db, request.accountId, id) : [];
      return { node, chunks };
    }
  );

  app.patch<{ Body: { id?: string; name?: string } }>(
    '/fs/node',
    auth,
    async (request, reply) => {
      const { id } = request.body || {};
      if (!id) {
        return reply.status(400).send({ error: 'id is required', code: 'INVALID_BODY' });
      }
      const newName = sanitizeName(request.body?.name);
      if (newName === null) {
        return reply.status(400).send({ error: 'Invalid name', code: 'INVALID_NAME' });
      }
      try {
        const node = renameNode(app.db, request.accountId, id, newName);
        return node;
      } catch (err) {
        if (err instanceof UniqueViolationError) {
          return reply.status(409).send({ error: 'Name already exists in folder', code: 'CONFLICT' });
        }
        if (err instanceof Error && err.message === 'Node not found') {
          return reply.status(404).send({ error: 'Node not found', code: 'NOT_FOUND' });
        }
        throw err;
      }
    }
  );

  app.delete<{ Body: { id?: string } }>(
    '/fs/node',
    auth,
    async (request, reply) => {
      const { id } = request.body || {};
      if (!id) {
        return reply.status(400).send({ error: 'id is required', code: 'INVALID_BODY' });
      }
      try {
        const result = await cascadeDelete(app.db, request.webhookUrl, request.accountId, id);
        return { success: true, deleted_nodes: result.deletedNodes, deleted_messages: result.deletedMessages };
      } catch (err) {
        if (err instanceof Error && err.message === 'Node not found') {
          return reply.status(404).send({ error: 'Node not found', code: 'NOT_FOUND' });
        }
        throw err;
      }
    }
  );

  app.post<{
    Body: {
      node_id?: string;
      name?: string;
      parent_id?: string | null;
      size_bytes?: number;
      mime_type?: string;
      chunks?: Array<{ discordMessageId: string; index: number; sizeBytes: number; cdnUrl: string }>;
    };
  }>(
    '/fs/file/created',
    auth,
    async (request, reply) => {
      const body = request.body || {};
      const { node_id, name, parent_id, size_bytes, mime_type, chunks } = body;
      if (typeof name !== 'string' || !name.trim()) {
        return reply.status(400).send({ error: 'name is required', code: 'INVALID_BODY' });
      }
      if (!Array.isArray(chunks) || chunks.length === 0) {
        return reply.status(400).send({ error: 'chunks array is required', code: 'INVALID_BODY' });
      }
      if (parent_id) {
        const parent = getNode(app.db, request.accountId, parent_id);
        if (!parent || parent.kind !== 'folder') {
          return reply.status(404).send({ error: 'Parent folder not found', code: 'NOT_FOUND' });
        }
      }
      try {
        const fileNode = createNode(app.db, {
          accountId: request.accountId,
          parentId: parent_id ?? null,
          name: name.trim(),
          kind: 'file',
          sizeBytes: size_bytes ?? null,
          mimeType: mime_type ?? null,
        });
        recordChunks(app.db, request.accountId, fileNode.id, chunks);
        const finalChunks = getChunks(app.db, request.accountId, fileNode.id);
        return reply.status(201).send({ node: fileNode, chunks: finalChunks, node_id: fileNode.id });
      } catch (err) {
        if (err instanceof UniqueViolationError) {
          return reply.status(409).send({ error: 'Name already exists in folder', code: 'CONFLICT' });
        }
        throw err;
      }
    }
  );

  app.get('/fs/backup', auth, async (request, reply) => {
    const payload = exportBackup(app.db, request.accountId);
    const filename = `wyvern-backup-${request.accountId.slice(0, 8)}.json`;
    reply.header('Content-Disposition', `attachment; filename="${filename}"`);
    return payload;
  });

  app.post<{ Body: { backup?: unknown } }>(
    '/fs/restore',
    auth,
    async (request, reply) => {
      const payload = request.body?.backup;
      if (payload === undefined || payload === null) {
        return reply.status(400).send({ error: 'backup is required', code: 'INVALID_BODY' });
      }
      try {
        const result = restoreBackup(app.db, request.accountId, payload);
        return { success: true, inserted_nodes: result.insertedNodes, inserted_chunks: result.insertedChunks };
      } catch (err) {
        if (err instanceof Error) {
          return reply.status(400).send({ error: err.message, code: 'INVALID_BACKUP' });
        }
        throw err;
      }
    }
  );
}
