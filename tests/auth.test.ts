import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';
import { authenticate } from '../src/plugins/auth';
import jwt from 'jsonwebtoken';

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

  describe('authenticate middleware', () => {
    it('should allow access with valid bearer token', async () => {
      const app = buildApp();
      app.get('/test-protected', { preHandler: authenticate }, async (req) => {
        return { webhookUrl: req.webhookUrl };
      });

      const token = jwt.sign({ webhookUrl: 'https://discord.com/api/webhooks/123/abc' }, 'test_secret_key_1234567890');
      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body);
      expect(body.webhookUrl).toBe('https://discord.com/api/webhooks/123/abc');
    });

    it('should deny access with missing authorization header', async () => {
      const app = buildApp();
      app.get('/test-protected', { preHandler: authenticate }, async () => {
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected'
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body);
      expect(body.error).toContain('Missing or invalid Authorization header');
    });

    it('should deny access with malformed header', async () => {
      const app = buildApp();
      app.get('/test-protected', { preHandler: authenticate }, async () => {
        return { ok: true };
      });

      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: {
          authorization: 'Bearer'
        }
      });

      expect(response.statusCode).toBe(401);
    });

    it('should deny access with invalid signature token', async () => {
      const app = buildApp();
      app.get('/test-protected', { preHandler: authenticate }, async () => {
        return { ok: true };
      });

      const token = jwt.sign({ webhookUrl: 'https://discord.com/api/webhooks/123/abc' }, 'wrong_secret');
      const response = await app.inject({
        method: 'GET',
        url: '/test-protected',
        headers: {
          authorization: `Bearer ${token}`
        }
      });

      expect(response.statusCode).toBe(401);
    });
  });
});

