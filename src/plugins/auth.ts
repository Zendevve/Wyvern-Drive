import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

declare module 'fastify' {
  interface FastifyRequest {
    webhookUrl: string;
    accountId: string;
  }
}

export async function authPlugin(app: FastifyInstance) {
  app.decorateRequest('webhookUrl', '');
  app.decorateRequest('accountId', '');
}

export function deriveAccountId(webhookUrl: string): string {
  return crypto.createHash('sha256').update(webhookUrl).digest('hex');
}

export async function authenticate(request: FastifyRequest, reply: FastifyReply) {
  try {
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Missing or invalid Authorization header' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET || 'test_secret_key_1234567890';
    const decoded = jwt.verify(token, secret) as { webhookUrl: string };

    if (!decoded || !decoded.webhookUrl) {
      return reply.status(401).send({ error: 'Invalid token payload' });
    }

    request.webhookUrl = decoded.webhookUrl;
    request.accountId = deriveAccountId(decoded.webhookUrl);
  } catch (error) {
    return reply.status(401).send({ error: 'Invalid or expired token' });
  }
}
