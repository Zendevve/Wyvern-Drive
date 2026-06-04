import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth';
import { uploadChunk } from '../services/discord';

interface UploadChunkInfo {
  index: number;
  url: string;
  size: number;
}

export async function uploadRoutes(app: FastifyInstance) {
  app.post(
    '/upload',
    {
      preHandler: authenticate,
    },
    async (request, reply) => {
      const data = await request.file();
      if (!data) {
        return reply.status(400).send({ error: 'No file uploaded' });
      }

      const { file, filename, mimetype } = data;
      const webhookUrl = request.webhookUrl;

      const chunks: UploadChunkInfo[] = [];
      let totalSize = 0;

      // 24MB Chunk Limit
      const CHUNK_SIZE = 24 * 1024 * 1024;
      let chunkIndex = 0;
      let currentChunkBuffers: Buffer[] = [];
      let currentChunkSize = 0;

      try {
        for await (const chunk of file) {
          let remainingChunk = chunk as Buffer;

          while (remainingChunk.length > 0) {
            const spaceLeft = CHUNK_SIZE - currentChunkSize;

            if (remainingChunk.length < spaceLeft) {
              currentChunkBuffers.push(remainingChunk);
              currentChunkSize += remainingChunk.length;
              break;
            } else {
              const part = remainingChunk.subarray(0, spaceLeft);
              currentChunkBuffers.push(part);
              currentChunkSize += part.length;

              const chunkBuffer = Buffer.concat(currentChunkBuffers, CHUNK_SIZE);
              const partFileName = `${filename}.part${chunkIndex}`;
              
              const attachment = await uploadChunk(webhookUrl, chunkBuffer, partFileName);
              
              chunks.push({
                index: chunkIndex,
                url: attachment.url,
                size: CHUNK_SIZE,
              });
              totalSize += CHUNK_SIZE;

              chunkIndex++;
              currentChunkBuffers = [];
              currentChunkSize = 0;

              remainingChunk = remainingChunk.subarray(spaceLeft);
            }
          }
        }

        // Upload any remaining data in the final chunk
        if (currentChunkSize > 0) {
          const chunkBuffer = Buffer.concat(currentChunkBuffers);
          const partFileName = `${filename}.part${chunkIndex}`;
          const attachment = await uploadChunk(webhookUrl, chunkBuffer, partFileName);
          
          chunks.push({
            index: chunkIndex,
            url: attachment.url,
            size: chunkBuffer.length,
          });
          totalSize += chunkBuffer.length;
        }

        return {
          filename,
          mimeType: mimetype,
          size: totalSize,
          chunks,
        };
      } catch (error: any) {
        request.log.error(error);
        return reply.status(500).send({ error: 'Upload to Discord failed', details: error.message });
      }
    }
  );
}
