'use strict';

const crypto = require('node:crypto');
const { httpError } = require('../errors');

/** Wrap an async Express handler so rejections reach the error middleware. */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/** Session middleware: 401 AUTH_REQUIRED unless a valid wyvern_session cookie. */
function requireSession(sessionStore) {
  return asyncHandler(async (req, res, next) => {
    const token = req.cookies && req.cookies.wyvern_session;
    const session = token ? await sessionStore.findByToken(token) : null;
    if (!session) throw httpError('AUTH_REQUIRED');
    req.user = { id: session.userId };
    next();
  });
}

/** Attach the authenticated user's drive to req.drive. */
function loadDrive(repositories) {
  return asyncHandler(async (req, res, next) => {
    const drive = await repositories.getDriveByUser(req.user.id);
    if (!drive) throw httpError('AUTH_REQUIRED');
    req.drive = drive;
    next();
  });
}

/**
 * CSRF protection for state-changing requests: the X-CSRF-Token header must
 * equal the readable wyvern_csrf cookie and the Origin header must equal
 * APP_ORIGIN, otherwise 403 CSRF_FAILED.
 */
function csrfProtect(config) {
  return (req, res, next) => {
    const cookieToken = req.cookies && req.cookies.wyvern_csrf;
    const headerToken = req.headers['x-csrf-token'];
    const origin = req.headers.origin;
    if (!cookieToken || !headerToken || cookieToken !== headerToken || origin !== config.appOrigin) {
      next(httpError('CSRF_FAILED'));
      return;
    }
    next();
  };
}

/**
 * In-memory fixed-window rate limiter keyed by client IP. Responds 429
 * RATE_LIMITED once `max` requests in `windowMs` are exceeded.
 */
function createRateLimiter({ windowMs, max }) {
  const hits = new Map(); // ip -> { count, resetAt }
  return (req, res, next) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();
    let record = hits.get(ip);
    if (!record || record.resetAt <= now) {
      record = { count: 0, resetAt: now + windowMs };
      hits.set(ip, record);
    }
    record.count += 1;
    if (record.count > max) {
      res.status(429).json({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
      return;
    }
    next();
  };
}

/** Constant-time comparison for strings of possibly different lengths. */
function safeEqual(a, b) {
  const ab = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/**
 * Baseline hardening headers on every response: no MIME sniffing, a
 * conservative referrer policy (full URL same-origin, bare origin
 * cross-origin), and same-origin framing so the SPA cannot be embedded
 * elsewhere. Deliberately no HSTS (the app runs on plain HTTP in development)
 * and no CSP (the CRA runtime relies on inline scripts a CSP would break).
 */
function securityHeaders() {
  return (req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    next();
  };
}

module.exports = { asyncHandler, requireSession, loadDrive, csrfProtect, createRateLimiter, safeEqual, securityHeaders };
