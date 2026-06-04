import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth';
import { deleteMessage } from '../services/discord';

interface DeleteBody {
  messageIds: string[];
}

export async function deleteRoutes(app: FastifyInstance) {
  app.delete<{ Body: DeleteBody }>(
    '/delete',
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['messageIds'],
          properties: {
            messageIds: {
              type: 'array',
              items: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { messageIds } = request.body;
      const webhookUrl = request.webhookUrl;

      const deletePromises = messageIds.map((id) =>
        deleteMessage(webhookUrl, id)
          .then(() => ({ id, success: true }))
          .catch((err) => {
            app.log.error(`Failed to delete message ${id}:`, err);
            return { id, success: false, error: err.message };
          })
      );

      const results = await Promise.all(deletePromises);
      const failures = results.filter((res) => !res.success);

      if (failures.length > 0) {
        return reply.status(207).send({
          message: 'Some chunks could not be deleted',
          failures,
        });
      }

      return reply.status(200).send({ message: 'All specified chunks deleted successfully' });
    }
  );
}
