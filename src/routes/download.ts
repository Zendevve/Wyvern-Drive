import { FastifyInstance } from 'fastify';
import { authenticate } from '../plugins/auth';
import { downloadChunkStream, refreshAttachmentUrl } from '../services/discord';
import { Readable } from 'stream';

export function extractMessageIdFromUrl(url: string): string {
  const match = url.match(/\/attachments\/\d+\/([a-zA-Z0-9_]+)\//);
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
    },
    async (request, reply) => {
      let body = request.body;

      if (!body) {
        // Read raw request body stream manually (Fastify does not parse bodies on GET by default)
        const rawBody = await new Promise<string>((resolve, reject) => {
          let data = '';
          request.raw.on('data', (chunk) => {
            data += chunk;
          });
          request.raw.on('end', () => {
            resolve(data);
          });
          request.raw.on('error', (err) => {
            reject(err);
          });
        });

        if (rawBody) {
          try {
            body = JSON.parse(rawBody);
          } catch (e) {
            return reply.status(400).send({ error: 'Invalid JSON body' });
          }
        }
      }

      if (!body || typeof body !== 'object') {
        return reply.status(400).send({ error: 'Missing or invalid request body' });
      }

      const { filename, mimeType, size, chunks } = body;
      if (!filename || !mimeType || typeof size !== 'number' || !Array.isArray(chunks)) {
        return reply.status(400).send({ error: 'Invalid metadata fields in request body' });
      }

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
