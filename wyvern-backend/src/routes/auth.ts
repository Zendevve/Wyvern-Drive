import { Router, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { getDatabase } from '../db/database.js';
import { authMiddleware, AuthenticatedRequest } from '../middleware/auth.js';
import crypto from 'crypto';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-wyvern-key-change-in-prod';

// SignUp Route
router.post('/signup', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const db = getDatabase();

  try {
    const userId = crypto.randomUUID();
    const passwordHash = bcrypt.hashSync(password, 10);
    const now = new Date().toISOString();

    // Insert user
    db.prepare(`
      INSERT INTO users (id, email, password_hash, created_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, email, passwordHash, now);

    // Insert default profile
    db.prepare(`
      INSERT INTO user_profiles (id, webhook_urls, encryption_enabled, server_boost_level, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(userId, JSON.stringify([]), 0, 'none', now, now);

    const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
    const user = { id: userId, email };

    res.status(201).json({
      user,
      session: {
        access_token: token,
        token_type: 'bearer',
        user
      }
    });
  } catch (error: any) {
    if (error.message && error.message.includes('UNIQUE constraint failed: users.email')) {
      res.status(400).json({ error: 'A user with this email already exists' });
    } else {
      res.status(500).json({ error: error.message || 'Failed to sign up' });
    }
  }
});

// Login Route
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: 'Email and password are required' });
    return;
  }

  const db = getDatabase();

  try {
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;
    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      res.status(401).json({ error: 'Invalid email or password' });
      return;
    }

    const token = jwt.sign({ userId: user.id }, JWT_SECRET, { expiresIn: '7d' });
    const userData = { id: user.id, email: user.email };

    res.json({
      user: userData,
      session: {
        access_token: token,
        token_type: 'bearer',
        user: userData
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to log in' });
  }
});

// Me/Session Route
router.get('/me', authMiddleware, (req: AuthenticatedRequest, res) => {
  const db = getDatabase();
  try {
    const user = db.prepare('SELECT id, email, created_at FROM users WHERE id = ?').get(req.userId) as any;
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }
    res.json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get user' });
  }
});

// Get User Profile Route
router.get('/profiles/:userId', authMiddleware, (req: AuthenticatedRequest, res) => {
  // Authorization check: users can only fetch their own profile
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied: cannot read another user\'s profile' });
    return;
  }

  const db = getDatabase();
  try {
    const profile = db.prepare('SELECT * FROM user_profiles WHERE id = ?').get(req.params.userId) as any;
    if (!profile) {
      res.status(404).json({ error: 'Profile not found' });
      return;
    }

    res.json({
      id: profile.id,
      webhook_urls: JSON.parse(profile.webhook_urls),
      encryption_enabled: Boolean(profile.encryption_enabled),
      server_boost_level: profile.server_boost_level || 'none',
      created_at: profile.created_at,
      updated_at: profile.updated_at
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to get profile' });
  }
});

// Upsert User Profile Route
router.post('/profiles/:userId', authMiddleware, (req: AuthenticatedRequest, res) => {
  // Authorization check
  if (req.userId !== req.params.userId) {
    res.status(403).json({ error: 'Access denied: cannot write another user\'s profile' });
    return;
  }

  const { webhook_urls, encryption_enabled, server_boost_level } = req.body;
  const db = getDatabase();
  const now = new Date().toISOString();

  try {
    const existing = db.prepare('SELECT id FROM user_profiles WHERE id = ?').get(req.params.userId);

    if (existing) {
      db.prepare(`
        UPDATE user_profiles
        SET webhook_urls = ?, encryption_enabled = ?, server_boost_level = ?, updated_at = ?
        WHERE id = ?
      `).run(
        JSON.stringify(webhook_urls || []),
        encryption_enabled ? 1 : 0,
        server_boost_level || 'none',
        now,
        req.params.userId
      );
    } else {
      db.prepare(`
        INSERT INTO user_profiles (id, webhook_urls, encryption_enabled, server_boost_level, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(
        req.params.userId,
        JSON.stringify(webhook_urls || []),
        encryption_enabled ? 1 : 0,
        server_boost_level || 'none',
        now,
        now
      );
    }

    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Failed to update profile' });
  }
});

export default router;
