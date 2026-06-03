import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../db/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import { getValidChunkUrl, hashPasswordSha256 } from './shares.js';
import jwt from 'jsonwebtoken';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-wyvern-key-change-in-prod';

// Optional/custom auth middleware for streaming that checks both Authorization header and query param token
async function streamAuthMiddleware(req: any, res: any, next: any) {
  let token = '';
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    token = req.headers.authorization.split(' ')[1];
  } else if (req.query.token) {
    token = req.query.token as string;
  }

  if (!token) {
    res.status(401).json({ error: 'Authentication token required for streaming' });
    return;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as any;
    req.userId = decoded.userId;
    next();
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired streaming token' });
  }
}

// 1. GET /api/stream/share/:shareId - Public shared media stream (with range support)
router.get('/stream/share/:shareId', async (req, res) => {
  const { shareId } = req.params;
  const providedPassword = req.query.password as string | undefined;
  const db = getDatabase();

  try {
    const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(shareId) as any;
    if (!share) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ error: 'Share link expired' });
      return;
    }

    // Check password
    if (share.password_hash) {
      const providedHash = providedPassword ? hashPasswordSha256(providedPassword) : null;
      if (!providedHash || providedHash !== share.password_hash) {
        res.status(401).json({ error: 'Password required', passwordRequired: true });
        return;
      }
    }

    const file = db.prepare('SELECT * FROM files WHERE id = ?').get(share.file_id) as any;
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    const totalSize = file.size;

    // Parse MIME Type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
      wav: 'audio/wav', ogg: 'video/ogg'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // CASE 1: File stored locally on server disk
    if (share.storage_path) {
      const localPath = path.resolve(__dirname, '../../data', share.storage_path);
      if (fs.existsSync(localPath)) {
        // Express native sendFile handles range headers automatically
        res.sendFile(localPath, { acceptRanges: true });
        return;
      }
    }

    // CASE 2: Discord-backed stream
    if (!file.content) {
      res.status(404).json({ error: 'File content metadata not found' });
      return;
    }

    let rawChunks: any[];
    try {
      rawChunks = JSON.parse(file.content);
    } catch {
      res.status(500).json({ error: 'Invalid chunk metadata' });
      return;
    }

    const chunks = rawChunks.map((c: any) => ({
      index: c.i ?? c.index ?? 0,
      url: c.u ?? c.url ?? '',
      size: c.s ?? c.size ?? 0,
      messageId: c.m ?? c.messageId
    })).sort((a: any, b: any) => a.index - b.index);

    // Get owner's webhook for refreshing Discord URLs
    let ownerWebhook: string | undefined;
    const profile = db.prepare('SELECT webhook_urls FROM user_profiles WHERE id = ?').get(share.user_id) as any;
    if (profile?.webhook_urls) {
      try {
        const webhooks = JSON.parse(profile.webhook_urls);
        if (Array.isArray(webhooks) && webhooks.length > 0) {
          ownerWebhook = webhooks[0];
        }
      } catch (e) {}
    }

    // Parse Range header
    const rangeHeader = req.headers.range;
    let start = 0;
    let end = totalSize - 1;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const partialstart = parts[0];
      const partialend = parts[1];
      start = parseInt(partialstart, 10);
      end = partialend ? parseInt(partialend, 10) : totalSize - 1;
    }

    if (start >= totalSize || end >= totalSize) {
      res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
      res.end();
      return;
    }

    const contentLength = end - start + 1;

    res.status(rangeHeader ? 206 : 200);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Content-Type', contentType);

    // Identify overlap chunks
    let currentOffset = 0;
    const chunksToFetch: { chunk: any, chunkStart: number, chunkEnd: number }[] = [];

    for (const chunk of chunks) {
      const chunkStart = currentOffset;
      const chunkEnd = currentOffset + chunk.size - 1;

      if (chunkEnd >= start && chunkStart <= end) {
        chunksToFetch.push({
          chunk,
          chunkStart,
          chunkEnd
        });
      }
      currentOffset += chunk.size;
      if (currentOffset > end) break;
    }

    for (const item of chunksToFetch) {
      const { chunk, chunkStart } = item;
      
      const validUrl = await getValidChunkUrl({ url: chunk.url, messageId: chunk.messageId }, ownerWebhook);
      if (!validUrl) {
        throw new Error(`Failed to refresh Discord URL for chunk ${chunk.index}`);
      }

      const chunkRes = await fetch(validUrl);
      if (!chunkRes.ok) {
        throw new Error(`Failed to fetch chunk ${chunk.index}: ${chunkRes.status}`);
      }

      const arrayBuffer = await chunkRes.arrayBuffer();
      const chunkData = Buffer.from(arrayBuffer);

      const requestStartInFile = Math.max(start, chunkStart);
      const requestEndInFile = Math.min(end, chunk.size + chunkStart - 1);

      const sliceStart = requestStartInFile - chunkStart;
      const sliceEnd = requestEndInFile - chunkStart + 1;

      const slicedData = chunkData.subarray(sliceStart, sliceEnd);
      res.write(slicedData);
    }
    
    res.end();
  } catch (error: any) {
    console.error("[Stream Share Route Error]:", error);
    if (res.headersSent) {
      res.destroy();
    } else {
      res.status(500).json({ error: error.message || 'Streaming failed' });
    }
  }
});

// 2. GET /api/stream/:userId/:fileId - Private file stream (with range support)
router.get('/stream/:userId/:fileId', streamAuthMiddleware, async (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const fileId = parseInt(req.params.fileId as string);
  const { userId } = req.params;

  if (isNaN(fileId)) {
    res.status(400).json({ error: 'Invalid file ID' });
    return;
  }

  const db = getDatabase();

  try {
    const file = db.prepare('SELECT * FROM files WHERE id = ? AND user_id = ?').get(fileId, userId) as any;
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    if (!file.content) {
      res.status(404).json({ error: 'File content metadata not found' });
      return;
    }

    let rawChunks: any[];
    try {
      rawChunks = JSON.parse(file.content);
    } catch {
      res.status(500).json({ error: 'Invalid chunk metadata' });
      return;
    }

    const chunks = rawChunks.map((c: any) => ({
      index: c.i ?? c.index ?? 0,
      url: c.u ?? c.url ?? '',
      size: c.s ?? c.size ?? 0,
      messageId: c.m ?? c.messageId
    })).sort((a: any, b: any) => a.index - b.index);

    // Get owner's webhook for refreshing Discord URLs
    let ownerWebhook: string | undefined;
    const profile = db.prepare('SELECT webhook_urls FROM user_profiles WHERE id = ?').get(userId) as any;
    if (profile?.webhook_urls) {
      try {
        const webhooks = JSON.parse(profile.webhook_urls);
        if (Array.isArray(webhooks) && webhooks.length > 0) {
          ownerWebhook = webhooks[0];
        }
      } catch (e) {}
    }

    const totalSize = file.size;

    // Parse MIME Type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
      wav: 'audio/wav', ogg: 'video/ogg'
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // Parse Range header
    const rangeHeader = req.headers.range;
    let start = 0;
    let end = totalSize - 1;

    if (rangeHeader) {
      const parts = rangeHeader.replace(/bytes=/, "").split("-");
      const partialstart = parts[0];
      const partialend = parts[1];
      start = parseInt(partialstart, 10);
      end = partialend ? parseInt(partialend, 10) : totalSize - 1;
    }

    if (start >= totalSize || end >= totalSize) {
      res.status(416).setHeader('Content-Range', `bytes */${totalSize}`);
      res.end();
      return;
    }

    const contentLength = end - start + 1;

    res.status(rangeHeader ? 206 : 200);
    res.setHeader('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Content-Length', contentLength);
    res.setHeader('Content-Type', contentType);

    // Identify overlap chunks
    let currentOffset = 0;
    const chunksToFetch: { chunk: any, chunkStart: number, chunkEnd: number }[] = [];

    for (const chunk of chunks) {
      const chunkStart = currentOffset;
      const chunkEnd = currentOffset + chunk.size - 1;

      if (chunkEnd >= start && chunkStart <= end) {
        chunksToFetch.push({
          chunk,
          chunkStart,
          chunkEnd
        });
      }
      currentOffset += chunk.size;
      if (currentOffset > end) break;
    }

    for (const item of chunksToFetch) {
      const { chunk, chunkStart } = item;
      
      const validUrl = await getValidChunkUrl({ url: chunk.url, messageId: chunk.messageId }, ownerWebhook);
      if (!validUrl) {
        throw new Error(`Failed to refresh Discord URL for chunk ${chunk.index}`);
      }

      const chunkRes = await fetch(validUrl);
      if (!chunkRes.ok) {
        throw new Error(`Failed to fetch chunk ${chunk.index}: ${chunkRes.status}`);
      }

      const arrayBuffer = await chunkRes.arrayBuffer();
      const chunkData = Buffer.from(arrayBuffer);

      const requestStartInFile = Math.max(start, chunkStart);
      const requestEndInFile = Math.min(end, chunk.size + chunkStart - 1);

      const sliceStart = requestStartInFile - chunkStart;
      const sliceEnd = requestEndInFile - chunkStart + 1;

      const slicedData = chunkData.subarray(sliceStart, sliceEnd);
      res.write(slicedData);
    }
    
    res.end();
  } catch (error: any) {
    console.error("[Stream Route Error]:", error);
    if (res.headersSent) {
      res.destroy();
    } else {
      res.status(500).json({ error: error.message || 'Streaming failed' });
    }
  }
});

export default router;
