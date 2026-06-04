import { FastifyInstance } from 'fastify';
import jwt from 'jsonwebtoken';
import { validateWebhook } from '../services/discord';

export async function authRoutes(app: FastifyInstance) {
  app.post<{ Body: { webhookUrl: string } }>(
    '/auth/webhook',
    {
      schema: {
        body: {
          type: 'object',
          required: ['webhookUrl'],
          properties: {
            webhookUrl: { type: 'string' }
          }
        }
      }
    },
    async (request, reply) => {
      const { webhookUrl } = request.body;

      const isValid = await validateWebhook(webhookUrl);
      if (!isValid) {
        return reply.status(401).send({ error: 'Invalid Webhook URL' });
      }

      const secret = process.env.JWT_SECRET || 'test_secret_key_1234567890';
      const token = jwt.sign({ webhookUrl }, secret);

      return { token };
    }
  );
}
