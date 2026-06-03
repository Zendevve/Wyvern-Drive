import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import express from 'express';
import { Server } from 'http';
import authRouter from './auth';
import { getDatabase, closeDatabase, getDatabasePath } from '../db/database';
import fs from 'fs';

describe('Auth & Profile Routes', () => {
  let app: express.Express;
  let server: Server;
  let baseUrl: string;
  let authToken: string;
  let userId: string;

  beforeAll(() => {
    process.env.DATABASE_URL = 'data/test_auth.db';
    const testDbPath = getDatabasePath();
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch (e) {}
    }

    // Initialize database
    getDatabase();

    app = express();
    app.use(express.json());
    app.use('/api/auth', authRouter);

    return new Promise<void>((resolve) => {
      server = app.listen(0, () => {
        const address = server.address() as any;
        baseUrl = `http://localhost:${address.port}/api/auth`;
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
    return new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  it('should sign up a new user and create their profile', async () => {
    const response = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'auth_test@example.com',
        password: 'securePassword123'
      })
    });

    expect(response.status).toBe(201);
    const data = await response.json() as any;
    expect(data.user).toBeDefined();
    expect(data.user.email).toBe('auth_test@example.com');
    expect(data.session.access_token).toBeDefined();

    authToken = data.session.access_token;
    userId = data.user.id;
  });

  it('should fail to sign up with the same email', async () => {
    const response = await fetch(`${baseUrl}/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'auth_test@example.com',
        password: 'securePassword123'
      })
    });

    expect(response.status).toBe(400);
    const data = await response.json() as any;
    expect(data.error).toContain('exists');
  });

  it('should login an existing user', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'auth_test@example.com',
        password: 'securePassword123'
      })
    });

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.user.id).toBe(userId);
    expect(data.session.access_token).toBeDefined();
  });

  it('should fail login with invalid password', async () => {
    const response = await fetch(`${baseUrl}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'auth_test@example.com',
        password: 'wrongPassword'
      })
    });

    expect(response.status).toBe(401);
  });

  it('should get current logged in user details', async () => {
    const response = await fetch(`${baseUrl}/me`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.user.email).toBe('auth_test@example.com');
  });

  it('should get the user profile', async () => {
    const response = await fetch(`${baseUrl}/profiles/${userId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });

    expect(response.status).toBe(200);
    const data = await response.json() as any;
    expect(data.id).toBe(userId);
    expect(data.webhook_urls).toEqual([]);
    expect(data.encryption_enabled).toBe(false);
  });

  it('should update/upsert user profile details', async () => {
    const response = await fetch(`${baseUrl}/profiles/${userId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        webhook_urls: ['http://discord.com/webhook/1'],
        encryption_enabled: true,
        server_boost_level: 'tier2'
      })
    });

    expect(response.status).toBe(200);

    // Verify change
    const checkRes = await fetch(`${baseUrl}/profiles/${userId}`, {
      headers: { 'Authorization': `Bearer ${authToken}` }
    });
    const profile = await checkRes.json() as any;
    expect(profile.webhook_urls).toEqual(['http://discord.com/webhook/1']);
    expect(profile.encryption_enabled).toBe(true);
    expect(profile.server_boost_level).toBe('tier2');
  });
});
