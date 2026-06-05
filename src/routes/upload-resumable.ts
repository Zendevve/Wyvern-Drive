import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth';
import {
  appendChunk,
  cancelSession,
  chunkIdempotencyKey,
  createSession,
  deleteSession,
  getSession,
  listSessionsForAccount,
  markComplete,
  sessionToResponse
} from '../services/upload-session';

interface CreateSessionBody {
  filename: string;
  mimeType: string;
  totalSize: number;
  chunkSize: number;
}

const MAX_CHUNK_SIZE = 24 * 1024 * 1024;
const RESUMABLE_THRESHOLD = 50 * 1024 * 1024;

export async function uploadResumableRoutes(app: FastifyInstance) {
  app.post(
    '/upload/session',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      const body = request.body as CreateSessionBody;
      if (!body || typeof body !== 'object') {
        return reply.status(400).send({ error: 'Missing body' });
      }
      const { filename, mimeType, totalSize, chunkSize } = body;
      if (!filename || typeof filename !== 'string') {
        return reply.status(400).send({ error: 'filename required' });
      }
      if (typeof totalSize !== 'number' || totalSize <= 0) {
        return reply.status(400).send({ error: 'totalSize must be positive number' });
      }
      if (typeof chunkSize !== 'number' || chunkSize <= 0 || chunkSize > MAX_CHUNK_SIZE) {
        return reply
          .status(400)
          .send({ error: `chunkSize must be 1..${MAX_CHUNK_SIZE} bytes` });
      }
      if (totalSize < RESUMABLE_THRESHOLD) {
        return reply
          .status(400)
          .send({ error: `Resumable upload requires totalSize >= ${RESUMABLE_THRESHOLD}` });
      }
      const accountId = request.accountId;
      const session = createSession({
        accountId,
        filename,
        mimeType: mimeType ?? 'application/octet-stream',
        totalSize,
        chunkSize
      });
      return reply.status(201).send(sessionToResponse(session));
    }
  );

  app.head(
    '/upload/session/:id',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = getSession(id);
      if (!session || session.accountId !== request.accountId) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      reply.header('Upload-Offset', String(session.offset));
      reply.header('Upload-Length', String(session.totalSize));
      reply.header('Upload-Status', session.status);
      return reply.status(200).send();
    }
  );

  app.patch(
    '/upload/session/:id',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = getSession(id);
      if (!session || session.accountId !== request.accountId) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      if (session.status !== 'open') {
        return reply.status(409).send({ error: `Session is ${session.status}` });
      }

      const clientOffset = Number(request.headers['upload-offset']);
      if (!Number.isFinite(clientOffset) || clientOffset < 0) {
        return reply.status(400).send({ error: 'Upload-Offset header required' });
      }
      if (clientOffset !== session.offset) {
        return reply
          .status(409)
          .send({ error: `Offset mismatch: server=${session.offset} client=${clientOffset}` });
      }

      const body = request.body as Buffer;
      if (!body || body.length === 0) {
        return reply.status(400).send({ error: 'Empty body' });
      }
      if (body.length > session.chunkSize) {
        return reply
          .status(413)
          .send({ error: `Chunk exceeds chunkSize (${session.chunkSize})` });
      }

      const idempotencyHeader = request.headers['idempotency-key'];
      const idempotencyKey =
        typeof idempotencyHeader === 'string' && idempotencyHeader.length > 0
          ? idempotencyHeader
          : chunkIdempotencyKey(id, clientOffset, session.chunks.length);

      try {
        const result = await appendChunk({
          sessionId: id,
          offset: clientOffset,
          data: body,
          webhookUrl: request.webhookUrl,
          chunkIndex: session.chunks.length,
          idempotencyKey
        });

        reply.header('Upload-Offset', String(result.session.offset));
        if (typeof result.rateLimitRemaining === 'number') {
          reply.header('X-RateLimit-Remaining', String(result.rateLimitRemaining));
        }
        if (typeof result.rateLimitResetAfter === 'number') {
          reply.header('X-RateLimit-Reset-After', String(result.rateLimitResetAfter));
        }

        return reply.status(200).send({
          status: result.status,
          offset: result.session.offset,
          chunk: result.discordAttachment
            ? {
                index: result.session.chunks.length - 1,
                url: result.discordAttachment.url,
                size: body.length
              }
            : null
        });
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Append failed';
        request.log.error({ err, sessionId: id }, 'appendChunk failed');
        if (message.includes('rate')) {
          return reply.status(429).send({ error: message, retryAfter: 1 });
        }
        return reply.status(500).send({ error: message });
      }
    }
  );

  app.post(
    '/upload/session/:id/finalize',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = getSession(id);
      if (!session || session.accountId !== request.accountId) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      if (session.status === 'complete') {
        return reply.status(200).send(sessionToResponse(session));
      }
      try {
        const completed = markComplete(id);
        if (!completed) {
          return reply.status(404).send({ error: 'Session vanished' });
        }
        return reply.status(200).send(sessionToResponse(completed));
      } catch (err) {
        return reply
          .status(409)
          .send({ error: err instanceof Error ? err.message : 'finalize failed' });
      }
    }
  );

  app.post(
    '/upload/session/:id/cancel',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = getSession(id);
      if (!session || session.accountId !== request.accountId) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      cancelSession(id);
      return reply.status(200).send(sessionToResponse(session));
    }
  );

  app.get(
    '/upload/sessions',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      const list = listSessionsForAccount(request.accountId).map(sessionToResponse);
      return reply.send({ sessions: list });
    }
  );

  app.delete(
    '/upload/session/:id',
    {
      preHandler: authenticate
    },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const session = getSession(id);
      if (!session || session.accountId !== request.accountId) {
        return reply.status(404).send({ error: 'Session not found' });
      }
      deleteSession(id);
      return reply.status(204).send();
    }
  );
}
