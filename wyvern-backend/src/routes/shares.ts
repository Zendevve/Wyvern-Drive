import { Router } from 'express';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDatabase } from '../db/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// Hashing helper matching Deno
export function hashPasswordSha256(password: string): string {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// Extract Discord IDs from a CDN URL
export function extractDiscordIds(url: string): { channelId: string; messageId: string; filename: string } | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split('/');
    if (pathParts.length >= 4 && pathParts[1] === 'attachments') {
      return {
        channelId: pathParts[2],
        messageId: pathParts[3],
        filename: pathParts[4] || 'chunk'
      };
    }
  } catch {
    // Invalid URL
  }
  return null;
}

// Refresh Discord CDN URL by fetching fresh attachment URL from Discord API
export async function refreshDiscordUrl(
  channelId: string,
  messageId: string | undefined,
  filename: string,
  webhookUrl?: string
): Promise<string | null> {
  // Strategy 0: Webhook Fetch
  if (webhookUrl && messageId) {
    try {
      console.log(`[refreshDiscordUrl] Trying webhook refresh for msg ${messageId.substring(0, 5)}...`);
      const match = webhookUrl.match(/webhooks\/(\d+)\/([^\/?]+)/);
      if (match) {
        const [, wbId, wbToken] = match;
        const res = await fetch(`https://discord.com/api/v10/webhooks/${wbId}/${wbToken}/messages/${messageId}`);
        if (res.ok) {
          const message = (await res.json()) as any;
          const attachment = message.attachments?.find((a: any) => a.filename === filename) || message.attachments?.[0];
          if (attachment) {
            console.log(`[refreshDiscordUrl] Webhook refresh success!`);
            return attachment.url;
          }
        } else {
          console.warn(`[refreshDiscordUrl] Webhook fetch failed: ${res.status} ${await res.text()}`);
        }
      }
    } catch (e) {
      console.error("[refreshDiscordUrl] Webhook error:", e);
    }
  }

  // Strategy 1: Bot Token
  const botToken = process.env.DISCORD_BOT_TOKEN;
  if (!botToken) {
    return null;
  }

  const headers = {
    'Authorization': `Bot ${botToken}`,
    'Content-Type': 'application/json'
  };

  try {
    if (messageId) {
      const response = await fetch(
        `https://discord.com/api/v10/channels/${channelId}/messages/${messageId}`,
        { headers }
      );

      if (response.ok) {
        const message = (await response.json()) as any;
        const attachment = message.attachments.find((a: any) => a.filename === filename) || message.attachments[0];
        if (attachment) return attachment.url;
      }
    }

    if (filename.startsWith('chunk_') || filename === 'file') {
      console.warn(`[refreshDiscordUrl] Skipping search for generic filename '${filename}' to prevent data corruption.`);
      return null;
    }

    const searchResponse = await fetch(
      `https://discord.com/api/v10/channels/${channelId}/messages?limit=50`,
      { headers }
    );

    if (searchResponse.ok) {
      const messages = (await searchResponse.json()) as any[];
      for (const msg of messages) {
        const attachment = msg.attachments?.find((a: any) => a.filename === filename);
        if (attachment) return attachment.url;
      }
    }

    return null;
  } catch (e) {
    console.error("[refreshDiscordUrl] Bot error:", e);
    return null;
  }
}

// Try to get a valid URL for a chunk, refreshing if needed
export async function getValidChunkUrl(
  chunk: { url: string; channelId?: string; messageId?: string },
  webhookUrl?: string
): Promise<string | null> {
  try {
    const testResponse = await fetch(chunk.url, { method: 'HEAD' });
    if (testResponse.ok) {
      return chunk.url;
    }
  } catch {
    // Ignore, try refresh
  }

  const ids = extractDiscordIds(chunk.url);
  if (!ids) {
    return null;
  }

  const freshUrl = await refreshDiscordUrl(ids.channelId, chunk.messageId || ids.messageId, ids.filename, webhookUrl);
  return freshUrl;
}

// 1. POST /api/shares/:userId/:fileId - Create a share link
router.post('/shares/:userId/:fileId', authMiddleware, async (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const fileId = parseInt(req.params.fileId as string);
  const { userId } = req.params;
  const { password, expiryHours } = req.body;

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

    const shareId = crypto.randomUUID();
    let storagePath: string | null = null;
    let storedInStorage = false;

    // Fetch owner's webhook for downloading/refreshing
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

    // If file is small (< 1MB), download chunks and save locally on server disk
    const SHARE_STORAGE_LIMIT = 1 * 1024 * 1024; // 1MB
    if (file.size <= SHARE_STORAGE_LIMIT && file.content) {
      try {
        const rawChunks = JSON.parse(file.content);
        const chunks = rawChunks.map((c: any) => ({
          index: c.i ?? c.index ?? 0,
          url: c.u ?? c.url ?? '',
          size: c.s ?? c.size ?? 0,
          messageId: c.m ?? c.messageId
        })).sort((a: any, b: any) => a.index - b.index);

        const parts: Buffer[] = [];
        for (const chunk of chunks) {
          const validUrl = await getValidChunkUrl({ url: chunk.url, messageId: chunk.messageId }, ownerWebhook);
          if (!validUrl) {
            throw new Error(`Failed to get valid URL for chunk ${chunk.index}`);
          }

          const chunkRes = await fetch(validUrl);
          if (!chunkRes.ok) {
            throw new Error(`Failed to fetch chunk ${chunk.index}: ${chunkRes.status}`);
          }
          const arrayBuffer = await chunkRes.arrayBuffer();
          parts.push(Buffer.from(arrayBuffer));
        }

        const combined = Buffer.concat(parts);
        
        // Write locally
        const localSharesDir = path.resolve(__dirname, '../../data/shares', shareId);
        fs.mkdirSync(localSharesDir, { recursive: true });
        const localFilePath = path.join(localSharesDir, file.name);
        fs.writeFileSync(localFilePath, combined);
        
        storagePath = `shares/${shareId}/${file.name}`;
        storedInStorage = true;
      } catch (e) {
        console.error("[Share] Error saving to local storage:", e);
        // Fall back to regular share
      }
    }

    const passwordHash = password ? hashPasswordSha256(password) : null;
    const expiresAt = expiryHours ? new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString() : null;
    const createdAt = new Date().toISOString();

    db.prepare(`
      INSERT INTO shares (id, user_id, file_id, password_hash, expires_at, storage_path, download_count, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(shareId, userId, fileId, passwordHash, expiresAt, storagePath, 0, createdAt);

    res.json({
      id: shareId,
      url: `/share/${shareId}`,
      expiresAt,
      storedInStorage
    });
  } catch (error: any) {
    console.error("[POST /shares Error]:", error);
    res.status(500).json({ error: error.message || 'Failed to create share' });
  }
});

// 2. GET /api/shares/:userId/:fileId - List active shares for a file
router.get('/shares/:userId/:fileId', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const fileId = parseInt(req.params.fileId as string);
  if (isNaN(fileId)) {
    res.status(400).json({ error: 'Invalid file ID' });
    return;
  }

  const db = getDatabase();

  try {
    const shares = db.prepare(`
      SELECT id, created_at, expires_at, download_count 
      FROM shares 
      WHERE user_id = ? AND file_id = ?
    `).all(req.params.userId, fileId);

    res.json(shares || []);
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to list shares' });
  }
});

// 3. DELETE /api/shares/:userId/:shareId - Revoke share
router.delete('/shares/:userId/:shareId', authMiddleware, (req: AuthenticatedRequest, res) => {
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  const { shareId } = req.params;
  const db = getDatabase();

  try {
    const share = db.prepare('SELECT * FROM shares WHERE id = ? AND user_id = ?').get(shareId, req.params.userId) as any;
    if (!share) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    if (share.storage_path) {
      const localPath = path.resolve(__dirname, '../../data', share.storage_path);
      if (fs.existsSync(localPath)) {
        fs.unlinkSync(localPath);
        const dirPath = path.dirname(localPath);
        if (fs.existsSync(dirPath)) {
          try {
            fs.rmdirSync(dirPath);
          } catch (e) {}
        }
      }
    }

    db.prepare('DELETE FROM shares WHERE id = ?').run(shareId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to revoke share' });
  }
});

// 4. GET /share/:shareId/info - Get share info (No auth)
router.get('/share/:shareId/info', (req, res) => {
  const { shareId } = req.params;
  const db = getDatabase();

  try {
    const share = db.prepare('SELECT * FROM shares WHERE id = ?').get(shareId) as any;
    if (!share) {
      res.status(404).json({ error: 'Share not found' });
      return;
    }

    // Check expiry
    if (share.expires_at && new Date(share.expires_at) < new Date()) {
      res.status(410).json({ error: 'Share link expired', expired: true });
      return;
    }

    const file = db.prepare('SELECT id, name, size, type FROM files WHERE id = ?').get(share.file_id) as any;
    if (!file) {
      res.status(404).json({ error: 'File not found' });
      return;
    }

    res.json({
      id: share.id,
      fileName: file.name,
      fileSize: file.size,
      fileType: file.type,
      expiresAt: share.expires_at,
      passwordRequired: !!share.password_hash,
      downloadCount: share.download_count || 0
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve share info' });
  }
});

// 5. GET /share/:shareId/chunks - Get paginated chunks for extension
router.get('/share/:shareId/chunks', async (req, res) => {
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
    if (!file || !file.content) {
      res.status(404).json({ error: 'File data not available' });
      return;
    }

    let rawChunks: any[];
    try {
      rawChunks = JSON.parse(file.content);
    } catch {
      res.status(500).json({ error: 'Invalid file data' });
      return;
    }

    // Pagination
    const page = parseInt((req.query.page as string) || '0');
    const limit = parseInt((req.query.limit as string) || '50');
    const startIndex = page * limit;
    const endIndex = startIndex + limit;

    const chunkSlice = rawChunks.slice(startIndex, endIndex);

    // Fetch owner's webhook for URL refresh
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

    const refreshedChunks = [];
    for (const c of chunkSlice) {
      const originalUrl = c.u ?? c.url ?? '';
      const messageId = c.m ?? c.messageId;

      const validUrl = await getValidChunkUrl(
        { url: originalUrl, messageId },
        ownerWebhook
      );

      if (!validUrl) {
        res.status(503).json({
          error: "Failed to access file content - links may have expired",
          details: `Could not refresh Discord CDN URL for chunk ${c.i ?? c.index}`
        });
        return;
      }

      refreshedChunks.push({
        i: c.i ?? c.index ?? 0,
        u: validUrl,
        s: c.s ?? c.size ?? 0
      });
    }

    res.json({
      fileName: file.name,
      fileSize: file.size,
      chunks: refreshedChunks,
      page,
      total: rawChunks.length,
      hasMore: endIndex < rawChunks.length
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to retrieve chunks' });
  }
});

// 6. GET /share/:shareId - Public download/stream
router.get('/share/:shareId', async (req, res) => {
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
      res.status(404).json({ error: 'File data not found' });
      return;
    }

    // Increment download count
    db.prepare('UPDATE shares SET download_count = download_count + 1 WHERE id = ?').run(shareId);

    // Content-Type
    const ext = file.name.split('.').pop()?.toLowerCase() || '';
    const mimeTypes: Record<string, string> = {
      mp4: 'video/mp4', webm: 'video/webm', mp3: 'audio/mpeg',
      wav: 'audio/wav', png: 'image/png', jpg: 'image/jpeg',
      jpeg: 'image/jpeg', gif: 'image/gif', pdf: 'application/pdf',
      zip: 'application/zip', txt: 'text/plain',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    // CASE 1: File stored locally on server disk
    if (share.storage_path) {
      const localPath = path.resolve(__dirname, '../../data', share.storage_path);
      if (fs.existsSync(localPath)) {
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
        res.sendFile(localPath);
        return;
      } else {
        res.status(500).json({ error: 'Local share file not found on disk' });
        return;
      }
    }

    // CASE 2: Large file requires extension
    const SHARE_STREAM_LIMIT = 100 * 1024 * 1024; // 100MB
    if (file.size >= SHARE_STREAM_LIMIT) {
      res.status(422).json({
        error: "This file is too large for web sharing (Limit: 100MB). Please install the Wyvern Drive extension.",
        requiresExtension: true,
        fileSize: file.size,
        fileName: file.name
      });
      return;
    }

    // CASE 3: Stream chunks sequentially from Discord CDN
    if (!file.content) {
      res.status(404).json({ error: 'File content not available' });
      return;
    }

    let rawChunks: any[];
    try {
      rawChunks = JSON.parse(file.content);
    } catch {
      res.status(500).json({ error: 'Invalid file data' });
      return;
    }

    const chunks = rawChunks.map((c: any) => ({
      index: c.i ?? c.index ?? 0,
      url: c.u ?? c.url ?? '',
      size: c.s ?? c.size ?? 0,
      messageId: c.m ?? c.messageId
    })).sort((a: any, b: any) => a.index - b.index);

    // Fetch owner's webhook
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

    // Pre-validate first chunk
    const testChunk = chunks[0];
    if (testChunk) {
      const validUrl = await getValidChunkUrl({ url: testChunk.url, messageId: testChunk.messageId }, ownerWebhook);
      if (!validUrl) {
        const botToken = process.env.DISCORD_BOT_TOKEN;
        if (!botToken && !ownerWebhook) {
          res.status(503).json({
            error: "Share links require server configuration. Please contact the file owner.",
            details: "Discord CDN URLs have expired and cannot be refreshed (Owner has no synced Webhook)."
          });
          return;
        }
        res.status(500).json({ error: 'Failed to access file content' });
        return;
      }
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${file.name}"`);
    res.setHeader('Content-Length', String(file.size));

    for (const chunk of chunks) {
      const validUrl = await getValidChunkUrl({ url: chunk.url, messageId: chunk.messageId }, ownerWebhook);
      if (!validUrl) {
        throw new Error(`Failed to get valid URL for chunk ${chunk.index}`);
      }

      const chunkRes = await fetch(validUrl);
      if (!chunkRes.ok) {
        throw new Error(`Chunk fetch failed: ${chunkRes.status}`);
      }

      const arrayBuffer = await chunkRes.arrayBuffer();
      res.write(Buffer.from(arrayBuffer));
    }
    res.end();

  } catch (error: any) {
    console.error("[Share Download Error]:", error);
    if (res.headersSent) {
      res.destroy();
    } else {
      res.status(500).json({ error: error.message || 'Failed to download file' });
    }
  }
});

// 7. POST /refresh-urls - Batch refresh Discord URLs
router.post('/refresh-urls', async (req, res) => {
  const { chunks, webhookUrl } = req.body;
  if (!Array.isArray(chunks)) {
    res.status(400).json({ error: 'Invalid chunks array' });
    return;
  }

  console.log(`[REFRESH] Refreshing ${chunks.length} URLs. Webhook provided: ${!!webhookUrl}`);
  const refreshed: Record<number, string> = {};

  const BATCH_SIZE = 5;
  try {
    for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
      const batch = chunks.slice(i, i + BATCH_SIZE);
      await Promise.all(batch.map(async (chunk: any) => {
        if (!chunk.m || !chunk.cid) {
          const ids = extractDiscordIds(chunk.u || chunk.url || '');
          if (ids) {
            chunk.m = ids.messageId;
            chunk.cid = ids.channelId;
            chunk.filename = ids.filename;
          } else {
            return;
          }
        }

        const newUrl = await refreshDiscordUrl(chunk.cid, chunk.m, chunk.filename || 'file', webhookUrl);
        if (newUrl) {
          refreshed[chunk.i ?? chunk.index] = newUrl;
        }
      }));
    }

    res.json({ refreshed });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to refresh URLs' });
  }
});

// 8. POST /cleanup/shares - Cleanup expired shares and their local files
router.post('/cleanup/shares', (req, res) => {
  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    const expiredShares = db.prepare('SELECT id, storage_path FROM shares WHERE expires_at IS NOT NULL AND expires_at < ?').all(now) as any[];

    if (expiredShares.length === 0) {
      res.json({ message: 'No expired shares to clean up', cleaned: 0 });
      return;
    }

    let storageFilesDeleted = 0;
    for (const share of expiredShares) {
      if (share.storage_path) {
        const localPath = path.resolve(__dirname, '../../data', share.storage_path);
        if (fs.existsSync(localPath)) {
          fs.unlinkSync(localPath);
          const dirPath = path.dirname(localPath);
          if (fs.existsSync(dirPath)) {
            try {
              fs.rmdirSync(dirPath);
            } catch (e) {}
          }
          storageFilesDeleted++;
        }
      }
    }

    const result = db.prepare('DELETE FROM shares WHERE expires_at IS NOT NULL AND expires_at < ?').run(now);
    res.json({
      message: 'Cleanup complete',
      storageFilesDeleted,
      shareRecordsDeleted: result.changes
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to cleanup shares' });
  }
});

export default router;
