import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';

describe('Fastify Auth webhook route', () => {
  it('POST /auth/webhook with valid webhook should return 200 OK and token', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/webhook',
      payload: {
        webhookUrl: 'https://discord.com/api/webhooks/1234567890/abc-123_xyz',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.token).toBeDefined();
  });

  it('POST /auth/webhook with invalid webhook should return 401 Unauthorized', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/webhook',
      payload: {
        webhookUrl: 'https://discord.com/api/webhooks/invalid/abc-123_xyz',
      },
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.error).toBe('Invalid Webhook URL');
  });

  it('POST /auth/webhook with missing webhookUrl should return 400 Bad Request', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'POST',
      url: '/auth/webhook',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
  });
});
