import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import jwt from 'jsonwebtoken';

describe('Fastify Upload route', () => {
  const token = jwt.sign({ webhookUrl: 'https://discord.com/api/webhooks/1234567890/abc-123_xyz' }, 'test_secret_key_1234567890');

  it('POST /upload should return 401 if unauthorized', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/upload',
    });

    expect(response.statusCode).toBe(401);
  });

  it('POST /upload should upload small file in a single chunk', async () => {
    const app = buildApp();
    const formData = new FormData();
    const fileContent = 'hello world';
    formData.append('file', new Blob([fileContent], { type: 'text/plain' }), 'hello.txt');

    const response = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: formData,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.filename).toBe('hello.txt');
    expect(body.mimeType).toBe('text/plain');
    expect(body.size).toBe(11);
    expect(body.chunks.length).toBe(1);
    expect(body.chunks[0].index).toBe(0);
    expect(body.chunks[0].size).toBe(11);
    expect(body.chunks[0].url).toContain('hello.txt.part0');
  });

  it('POST /upload should split file into multiple chunks if size > 24MB', async () => {
    const app = buildApp();
    
    // 25MB file
    const size25MB = 25 * 1024 * 1024;
    const buffer = Buffer.alloc(size25MB, 'a');
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: 'application/octet-stream' }), 'large.bin');

    const response = await app.inject({
      method: 'POST',
      url: '/upload',
      headers: {
        authorization: `Bearer ${token}`,
      },
      payload: formData,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.filename).toBe('large.bin');
    expect(body.size).toBe(size25MB);
    
    // Should be split into 2 chunks: part0 (24MB) and part1 (1MB)
    expect(body.chunks.length).toBe(2);
    expect(body.chunks[0].index).toBe(0);
    expect(body.chunks[0].size).toBe(24 * 1024 * 1024);
    expect(body.chunks[1].index).toBe(1);
    expect(body.chunks[1].size).toBe(1 * 1024 * 1024);
  });
});
