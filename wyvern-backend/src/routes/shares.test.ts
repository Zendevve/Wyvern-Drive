import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import express from 'express';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import sharesRouter from './shares.js';
import streamRouter from './stream.js';
import { getDatabase, closeDatabase, getDatabasePath } from '../db/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-wyvern-key-change-in-prod';

describe('Shares & Streaming Routes', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  let authToken: string;
  let otherToken: string;
  let userId = 'user-test-shares-123';
  let otherUserId = 'user-test-shares-456';
  let fileId = 999;
  let smallFileId = 1000;
  let shareId: string;
  let smallShareId: string;

  beforeAll(() => {
    process.env.DATABASE_URL = 'data/test_shares.db';
    process.env.JWT_SECRET = JWT_SECRET;
    const testDbPath = getDatabasePath();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }

    // Mock global fetch for downloading chunks during share creation, leaving local server requests alone
    const originalFetch = global.fetch;
    vi.spyOn(global, 'fetch').mockImplementation((url: any, options: any) => {
      const urlStr = typeof url === 'string' ? url : url.toString();
      if (!urlStr.includes('localhost') && !urlStr.includes('127.0.0.1')) {
        if (options?.method === 'HEAD') {
          return Promise.resolve(new Response(null, { status: 200 }));
        }
        const size = urlStr.includes('small') ? 25 : 1000000;
        return Promise.resolve(new Response(Buffer.alloc(size)));
      }
      return originalFetch(url, options);
    });

    const db = getDatabase();

    // Seed test users
    db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (?, 'shares_test@example.com', 'pwd_hash', ?)
    `).run(userId, new Date().toISOString());

    db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (?, 'shares_other@example.com', 'pwd_hash', ?)
    `).run(otherUserId, new Date().toISOString());

    // Seed mock Discord file (large file - size 2,000,000 bytes > 1MB limit)
    db.prepare(`
      INSERT INTO files (id, user_id, name, type, size, content, created_at, updated_at)
      VALUES (?, ?, 'large-file.mp4', 'file', 2000000, ?, ?, ?)
    `).run(
      fileId, 
      userId, 
      JSON.stringify([{ i: 0, u: 'https://cdn.discordapp.com/attachments/123/456/chunk_0', s: 1000000 }, { i: 1, u: 'https://cdn.discordapp.com/attachments/123/456/chunk_1', s: 1000000 }]),
      new Date().toISOString(),
      new Date().toISOString()
    );

    // Seed mock Discord file (small file for server storage test)
    db.prepare(`
      INSERT INTO files (id, user_id, name, type, size, content, created_at, updated_at)
      VALUES (?, ?, 'small-file.txt', 'file', 25, ?, ?, ?)
    `).run(
      smallFileId, 
      userId, 
      JSON.stringify([{ i: 0, u: 'https://cdn.discordapp.com/attachments/123/456/chunk_small', s: 25 }]),
      new Date().toISOString(),
      new Date().toISOString()
    );

    authToken = jwt.sign({ userId }, JWT_SECRET);
    otherToken = jwt.sign({ userId: otherUserId }, JWT_SECRET);

    app = express();
    app.use(express.json());
    app.use('/api', sharesRouter);
    app.use('/api', streamRouter);

    return new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}/api`;
        resolve();
      });
    });
  });

  afterAll(() => {
    closeDatabase();
    const testDbPath = getDatabasePath();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }

    // Clean up local test shares storage
    const sharesDir = path.resolve(__dirname, '../../data/shares');
    if (fs.existsSync(sharesDir)) {
      try {
        fs.rmSync(sharesDir, { recursive: true, force: true });
      } catch (e) {}
    }

    vi.restoreAllMocks();

    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should allow creating a public share for a file', async () => {
    const response = await fetch(`${baseUrl}/shares/${userId}/${fileId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        password: 'myPassword123',
        expiryHours: 24
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.id).toBeDefined();
    expect(data.url).toContain('/share/');
    expect(data.expiresAt).toBeDefined();
    expect(data.storedInStorage).toBe(false);

    shareId = data.id;
  });

  it('should block creating a share for another user\'s file', async () => {
    const response = await fetch(`${baseUrl}/shares/${userId}/${fileId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${otherToken}`
      },
      body: JSON.stringify({})
    });

    expect(response.status).toBe(403);
  });

  it('should get share info without authentication', async () => {
    const response = await fetch(`${baseUrl}/share/${shareId}/info`);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.fileName).toBe('large-file.mp4');
    expect(data.passwordRequired).toBe(true);
  });

  it('should deny getting chunks if password is required but not provided', async () => {
    const response = await fetch(`${baseUrl}/share/${shareId}/chunks`);
    expect(response.status).toBe(401);
  });

  it('should deny getting chunks if password is wrong', async () => {
    const response = await fetch(`${baseUrl}/share/${shareId}/chunks?password=wrongpwd`);
    expect(response.status).toBe(401);
  });

  it('should retrieve chunks if password is correct', async () => {
    const response = await fetch(`${baseUrl}/share/${shareId}/chunks?password=myPassword123`);
    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.chunks).toBeDefined();
    expect(data.chunks.length).toBeGreaterThan(0);
  });

  it('should deny download if password is wrong', async () => {
    const response = await fetch(`${baseUrl}/share/${shareId}?password=wrongpwd`);
    expect(response.status).toBe(401);
  });

  it('should download/stream small files saved to server storage', async () => {
    // Create share for small file (which gets saved to server disk)
    const shareRes = await fetch(`${baseUrl}/shares/${userId}/${smallFileId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({})
    });
    
    expect(shareRes.status).toBe(200);
    const shareData = await shareRes.json() as any;
    expect(shareData.storedInStorage).toBe(true);
    smallShareId = shareData.id;
    
    const dlRes = await fetch(`${baseUrl}/share/${shareData.id}`);
    expect(dlRes.status).toBe(200);
    const text = await dlRes.text();
    expect(text.length).toBe(25);
  });

  it('should list active shares for a file', async () => {
    const response = await fetch(`${baseUrl}/shares/${userId}/${fileId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status).toBe(200);
    const data = await response.json() as any[];
    expect(data.length).toBeGreaterThan(0);
    expect(data[0].id).toBe(shareId);
  });

  it('should stream private files with range requests when authenticated', async () => {
    // 1. No token -> 401
    const noAuthRes = await fetch(`${baseUrl}/stream/${userId}/${fileId}`);
    expect(noAuthRes.status).toBe(401);

    // 2. Range request: bytes 0-49
    const rangeRes = await fetch(`${baseUrl}/stream/${userId}/${fileId}?token=${authToken}`, {
      headers: { 'Range': 'bytes=0-49' }
    });
    if (rangeRes.status !== 206) {
      console.log('rangeRes failed status:', rangeRes.status, await rangeRes.text());
    }
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get('Content-Range')).toBe('bytes 0-49/2000000');
    expect(rangeRes.headers.get('Content-Length')).toBe('50');
    expect(rangeRes.headers.get('Content-Type')).toBe('video/mp4');

    const text = await rangeRes.text();
    expect(text.length).toBe(50);
  });

  it('should stream shared files with range requests', async () => {
    // Range request: bytes 10-29
    const rangeRes = await fetch(`${baseUrl}/stream/share/${shareId}?password=myPassword123`, {
      headers: { 'Range': 'bytes=10-29' }
    });
    if (rangeRes.status !== 206) {
      console.log('rangeRes shared failed status:', rangeRes.status, await rangeRes.text());
    }
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get('Content-Range')).toBe('bytes 10-29/2000000');
    expect(rangeRes.headers.get('Content-Length')).toBe('20');
    expect(rangeRes.headers.get('Content-Type')).toBe('video/mp4');

    const text = await rangeRes.text();
    expect(text.length).toBe(20);
  });

  it('should stream small stored shared files with range requests', async () => {
    // Range request: bytes 0-9
    const rangeRes = await fetch(`${baseUrl}/stream/share/${smallShareId}`, {
      headers: { 'Range': 'bytes=0-9' }
    });
    if (rangeRes.status !== 206) {
      console.log('rangeRes small shared failed status:', rangeRes.status, await rangeRes.text());
    }
    expect(rangeRes.status).toBe(206);
    expect(rangeRes.headers.get('Content-Range')).toBe('bytes 0-9/25');
    expect(rangeRes.headers.get('Content-Length')).toBe('10');
    expect(rangeRes.headers.get('Content-Type')).toContain('text/plain');

    const text = await rangeRes.text();
    expect(text.length).toBe(10);
  });

  it('should allow revoking a share link', async () => {
    const deleteRes = await fetch(`${baseUrl}/shares/${userId}/${shareId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(deleteRes.status).toBe(200);

    const infoRes = await fetch(`${baseUrl}/share/${shareId}/info`);
    expect(infoRes.status).toBe(404);
  });
});
