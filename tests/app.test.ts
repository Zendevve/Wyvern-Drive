import { describe, it, expect } from 'vitest';
import { buildApp } from '../src/app';

describe('Fastify status route', () => {
  it('GET /status should return 200 OK', async () => {
    const app = buildApp();
    const response = await app.inject({
      method: 'GET',
      url: '/status'
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('OK');
    expect(body.timestamp).toBeDefined();
  });
});
