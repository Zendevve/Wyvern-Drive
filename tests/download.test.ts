import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import jwt from 'jsonwebtoken';

describe('Fastify Download & Delete routes', () => {
  const token = jwt.sign({ webhookUrl: 'https://discord.com/api/webhooks/1234567890/abc-123_xyz' }, 'test_secret_key_1234567890');

  it('GET /download should return 401 if unauthorized', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/download',
    });

    expect(response.statusCode).toBe(401);
  });

  it('GET /download should download file correctly', async () => {
    const app = buildApp();
    const metadata = {
      filename: 'hello.txt',
      mimeType: 'text/plain',
      size: 20,
      chunks: [
        {
          index: 0,
          url: 'https://cdn.discordapp.com/attachments/111111111/msg_9876543210/hello.txt',
          size: 20,
        },
      ],
    };

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify(metadata),
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('text/plain');
    expect(response.headers['content-length']).toBe('20');
    expect(response.headers['content-disposition']).toBe('attachment; filename="hello.txt"');
    expect(response.body).toBe('mocked chunk content');
  });

  it('GET /download should support range seeking requests', async () => {
    const app = buildApp();
    const metadata = {
      filename: 'hello.txt',
      mimeType: 'text/plain',
      size: 20,
      chunks: [
        {
          index: 0,
          url: 'https://cdn.discordapp.com/attachments/111111111/msg_9876543210/hello.txt',
          size: 20,
        },
      ],
    };

    // Request bytes 7-11 ('chunk')
    const response = await app.inject({
      method: 'GET',
      url: '/download',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        range: 'bytes=7-11',
      },
      payload: JSON.stringify(metadata),
    });

    expect(response.statusCode).toBe(206);
    expect(response.headers['content-range']).toBe('bytes 7-11/20');
    expect(response.headers['content-length']).toBe('5');
    expect(response.body).toBe('chunk');
  });

  it('GET /download should return 416 for out-of-bound ranges', async () => {
    const app = buildApp();
    const metadata = {
      filename: 'hello.txt',
      mimeType: 'text/plain',
      size: 20,
      chunks: [
        {
          index: 0,
          url: 'https://cdn.discordapp.com/attachments/111111111/msg_9876543210/hello.txt',
          size: 20,
        },
      ],
    };

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        range: 'bytes=30-40',
      },
      payload: JSON.stringify(metadata),
    });

    expect(response.statusCode).toBe(416);
  });

  it('GET /download should refresh link if CDN URL expired (403)', async () => {
    const app = buildApp();
    const metadata = {
      filename: 'expired.txt',
      mimeType: 'text/plain',
      size: 20,
      chunks: [
        {
          index: 0,
          // URL contains 'expired' to trigger mock 403 error, then triggers getMessage and refreshes
          url: 'https://cdn.discordapp.com/attachments/111111111/msg_9876543210/expired.txt',
          size: 20,
        },
      ],
    };

    const response = await app.inject({
      method: 'GET',
      url: '/download',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify(metadata),
    });

    expect(response.statusCode).toBe(200);
    // After refresh, the url fetched will have 'refreshed' in it and succeed returning mock data
    expect(response.body).toBe('mocked chunk content');
  });

  it('DELETE /delete should delete multiple chunks', async () => {
    const app = buildApp();
    const deletePayload = {
      messageIds: ['msg_1', 'msg_2', 'msg_3'],
    };

    const response = await app.inject({
      method: 'DELETE',
      url: '/delete',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      payload: JSON.stringify(deletePayload),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.message).toBe('All specified chunks deleted successfully');
  });
});
