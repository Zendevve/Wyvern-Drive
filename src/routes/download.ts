import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth';
import { downloadChunkStream, refreshAttachmentUrl } from '../services/discord';
import { Readable } from 'stream';

export function extractMessageIdFromUrl(url: string): string {
  const match = url.match(/\/attachments\/\d+\/(\d+)\//);
  if (!match) {
    throw new Error('Could not extract message ID from Discord attachment URL');
  }
  return match[1];
}

interface ChunkMetadata {
  index: number;
  url: string;
  size: number;
}

interface DownloadBody {
  filename: string;
  mimeType: string;
  size: number;
  chunks: ChunkMetadata[];
}

export async function downloadRoutes(app: FastifyInstance) {
  app.get<{ Body: DownloadBody }>(
    '/download',
    {
      preHandler: authenticate,
      schema: {
        body: {
          type: 'object',
          required: ['filename', 'mimeType', 'size', 'chunks'],
          properties: {
            filename: { type: 'string' },
            mimeType: { type: 'string' },
            size: { type: 'integer' },
            chunks: {
              type: 'array',
              items: {
                type: 'object',
                required: ['index', 'url', 'size'],
                properties: {
                  index: { type: 'integer' },
                  url: { type: 'string' },
                  size: { type: 'integer' },
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { filename, mimeType, size, chunks } = request.body;
      const webhookUrl = request.webhookUrl;

      // Sort chunks by index to ensure correct reassembly order
      const sortedChunks = [...chunks].sort((a, b) => a.index - b.index);

      // Parse range headers if present
      const rangeHeader = request.headers.range;
      let start = 0;
      let end = size - 1;
      let isRange = false;

      if (rangeHeader) {
        const parts = rangeHeader.replace(/bytes=/, '').split('-');
        start = parseInt(parts[0], 10);
        const endPart = parts[1] ? parseInt(parts[1], 10) : -1;
        if (endPart !== -1) {
          end = endPart;
        }
        isRange = true;
      }

      if (start < 0 || start >= size || end < start || end >= size) {
        return reply.status(416).send({ error: 'Range Not Satisfiable' });
      }

      const stream = new Readable({
        read() {}
      });

      // Execute stream chunk pulling asynchronously
      (async () => {
        try {
          let currentByteOffset = 0;

          for (const chunk of sortedChunks) {
            const chunkStart = currentByteOffset;
            const chunkEnd = currentByteOffset + chunk.size - 1;

            // Check if this chunk overlaps with the requested range
            if (chunkEnd >= start && chunkStart <= end) {
              const requestStart = Math.max(0, start - chunkStart);
              const requestEnd = Math.min(chunk.size - 1, end - chunkStart);

              const needsSlice = requestStart > 0 || requestEnd < chunk.size - 1;
              const subRangeHeader = needsSlice ? `bytes=${requestStart}-${requestEnd}` : undefined;

              let chunkUrl = chunk.url;
              let attempt = 0;
              let chunkStream: Readable | null = null;

              while (attempt < 2) {
                try {
                  chunkStream = await downloadChunkStream(chunkUrl, subRangeHeader);
                  break;
                } catch (err: any) {
                  // Attempt link refresh on auth/forbidden error
                  if ((err.response?.status === 403 || err.response?.status === 401) && attempt === 0) {
                    try {
                      const messageId = extractMessageIdFromUrl(chunkUrl);
                      chunkUrl = await refreshAttachmentUrl(webhookUrl, messageId);
                      attempt++;
                      continue;
                    } catch (refreshErr) {
                      throw err;
                    }
                  }
                  throw err;
                }
              }

              if (!chunkStream) {
                throw new Error('Failed to retrieve chunk stream');
              }

              for await (const dataChunk of chunkStream) {
                const shouldContinue = stream.push(dataChunk);
                if (!shouldContinue) {
                  await new Promise<void>((resolve) => {
                    stream.once('drain', resolve);
                  });
                }
              }
            }

            currentByteOffset += chunk.size;
          }

          stream.push(null);
        } catch (err: any) {
          app.log.error(err);
          stream.destroy(err);
        }
      })();

      if (isRange) {
        reply.status(206).headers({
          'Content-Range': `bytes ${start}-${end}/${size}`,
          'Accept-Ranges': 'bytes',
          'Content-Length': end - start + 1,
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        });
      } else {
        reply.status(200).headers({
          'Accept-Ranges': 'bytes',
          'Content-Length': size,
          'Content-Type': mimeType,
          'Content-Disposition': `attachment; filename="${filename}"`,
        });
      }

      return reply.send(stream);
    }
  );
}
