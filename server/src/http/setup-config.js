'use strict';

const express = require('express');
const crypto = require('node:crypto');
const { httpError } = require('../errors');
const { createRateLimiter, safeEqual, asyncHandler } = require('./middleware');
const { writeSetupValues } = require('../config/env-file');
const { diagnoseConfig } = require('../config');

const CLIENT_ID_RE = /^\d{17,20}$/;
const CLIENT_SECRET_RE = /^[\x21-\x7E]{16,256}$/;
const CONTROL_CHARS_RE = /[\u0000-\u001F\u007F]/;

// Canonical response ordering for the saved/generated key lists.
const SAVED_ORDER = ['DISCORD_CLIENT_ID', 'DISCORD_CLIENT_SECRET', 'DB_URL', 'APP_ORIGIN'];
const GENERATED_ORDER = ['WYVERN_ENCRYPTION_KEY', 'DISCORD_REDIRECT_URI'];

/** True for ::1, 127.0.0.1, or any 127.x.y.z (after stripping an IPv4-mapped prefix). */
function isLoopbackIp(ip) {
  const normalized = String(ip || '').replace(/^::ffff:/, '');
  if (normalized === '::1' || normalized === '127.0.0.1') return true;
  return /^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(normalized);
}

/**
 * A request is local only when it arrives on a loopback socket AND its Host
 * hostname is localhost / 127.0.0.1 / ::1. Fails closed: anything else is
 * treated as non-local so the setup token is required.
 */
function isLocalRequest(req) {
  const remote = req.socket && req.socket.remoteAddress;
  if (!isLoopbackIp(remote)) return false;
  const hostHeader = String(req.headers.host || '').toLowerCase();
  let hostname = hostHeader;
  if (hostname.startsWith('[')) {
    const close = hostname.indexOf(']');
    hostname = close === -1 ? hostname : hostname.slice(1, close);
  } else {
    hostname = hostname.split(':')[0];
  }
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
}

/**
 * Parse a plain http(s) origin (no credentials, query, hash, or path).
 * Returns { ok, protocol, origin, host } where origin is normalized
 * (protocol + '//' + host, dropping any trailing slash).
 */
function parseOrigin(value) {
  try {
    const url = new URL(String(value));
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return { ok: false };
    if (url.username || url.password) return { ok: false };
    if (url.search || url.hash) return { ok: false };
    if (url.pathname !== '' && url.pathname !== '/') return { ok: false };
    return {
      ok: true,
      protocol: url.protocol,
      origin: `${url.protocol}//${url.host}`,
      host: url.host.toLowerCase(),
    };
  } catch {
    return { ok: false };
  }
}

/** True when value parses as an absolute http(s) URL (a path is allowed here). */
function isAbsoluteHttpUrl(value) {
  try {
    const url = new URL(String(value));
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

/**
 * Create the setup-mode credential routes: GET /meta (non-secret metadata)
 * and POST /credentials (validated, token-gated, atomic env-file write).
 * Mounted only from setup-app.js under /api/setup; never from the full app.
 */
function createSetupConfigRoutes({ setupToken, envFile, initialEnv = {}, missing = [], invalid = [] }) {
  const router = express.Router();
  const limiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });
  let tokenConsumed = false;

  /**
   * Effective presence: only the boot-time env snapshot counts as configured.
   * The env file must NOT be consulted here: diagnostics and the response's
   * remainingMissing/remainingInvalid come from the boot env too, and a live
   * file read (e.g. an operator editing .env without restarting) would make
   * the required-field check disagree with the reported diagnostics.
   */
  function isConfigured(key, validFn) {
    const value = initialEnv[key];
    if (value !== undefined && value !== null && String(value).trim() !== '') {
      return validFn(value);
    }
    return false;
  }

  const clientIdValid = (v) => CLIENT_ID_RE.test(String(v).trim());
  const clientSecretValid = (v) => CLIENT_SECRET_RE.test(String(v).trim());

  router.get('/meta', (req, res) => {
    res.json({
      writesSupported: true,
      tokenRequired: !isLocalRequest(req),
      clientIdConfigured: isConfigured('DISCORD_CLIENT_ID', clientIdValid),
      clientSecretConfigured: isConfigured('DISCORD_CLIENT_SECRET', clientSecretValid),
    });
  });

  /**
   * Validate the Origin header against the configured APP_ORIGIN (exact
   * match when present and valid) or the request Host (when APP_ORIGIN is
   * missing/invalid), and require HTTPS origins for non-local requests.
   * Returns the normalized browser origin used as the APP_ORIGIN default.
   */
  function checkOrigin(req) {
    const header = req.headers.origin;
    if (!header) throw httpError('SETUP_ORIGIN_INVALID');
    const parsed = parseOrigin(header);
    if (!parsed.ok) throw httpError('SETUP_ORIGIN_INVALID');

    const currentParsed = initialEnv.APP_ORIGIN ? parseOrigin(initialEnv.APP_ORIGIN) : { ok: false };
    if (currentParsed.ok) {
      if (parsed.origin !== currentParsed.origin) throw httpError('SETUP_ORIGIN_INVALID');
    } else if (parsed.host !== String(req.headers.host || '').toLowerCase()) {
      throw httpError('SETUP_ORIGIN_INVALID');
    }
    if (!isLocalRequest(req) && parsed.protocol === 'http:') {
      throw httpError('SETUP_ORIGIN_INVALID');
    }
    return parsed.origin;
  }

  /**
   * Validate the request body and compute the exact write batch. Throws
   * SETUP_VALIDATION_FAILED with a key-specific message on any violation.
   * Returns { values, saved, generated } — values maps env key -> value;
   * saved/generated are non-secret key-name lists in canonical order.
   */
  function computeWriteValues(body, browserOrigin) {
    const values = {};

    if (typeof body.clientId === 'string') {
      const trimmed = body.clientId.trim();
      if (trimmed.length > 32 || !CLIENT_ID_RE.test(trimmed)) {
        throw httpError('SETUP_VALIDATION_FAILED', 'DISCORD_CLIENT_ID must be a 17-20 digit Discord application ID');
      }
      values.DISCORD_CLIENT_ID = trimmed;
    } else if (!isConfigured('DISCORD_CLIENT_ID', clientIdValid)) {
      throw httpError('SETUP_VALIDATION_FAILED', 'DISCORD_CLIENT_ID is required');
    }

    if (typeof body.clientSecret === 'string') {
      if (CONTROL_CHARS_RE.test(body.clientSecret)) {
        throw httpError('SETUP_VALIDATION_FAILED', 'DISCORD_CLIENT_SECRET must be 16-256 printable ASCII characters with no whitespace');
      }
      const trimmed = body.clientSecret.trim();
      if (trimmed.length > 512 || !CLIENT_SECRET_RE.test(trimmed)) {
        throw httpError('SETUP_VALIDATION_FAILED', 'DISCORD_CLIENT_SECRET must be 16-256 printable ASCII characters with no whitespace');
      }
      values.DISCORD_CLIENT_SECRET = trimmed;
    } else if (!isConfigured('DISCORD_CLIENT_SECRET', clientSecretValid)) {
      throw httpError('SETUP_VALIDATION_FAILED', 'DISCORD_CLIENT_SECRET is required');
    }

    let appOriginValue;
    if (typeof body.appOrigin === 'string') {
      const trimmed = body.appOrigin.trim();
      if (trimmed.length > 2048) {
        throw httpError('SETUP_VALIDATION_FAILED', 'APP_ORIGIN must be a plain http(s) origin with no path');
      }
      const parsed = parseOrigin(trimmed);
      if (!parsed.ok) {
        throw httpError('SETUP_VALIDATION_FAILED', 'APP_ORIGIN must be a plain http(s) origin with no path');
      }
      appOriginValue = parsed.origin;
      values.APP_ORIGIN = appOriginValue;
    } else {
      const currentParsed = initialEnv.APP_ORIGIN ? parseOrigin(initialEnv.APP_ORIGIN) : { ok: false };
      if (currentParsed.ok) {
        appOriginValue = currentParsed.origin;
      } else {
        appOriginValue = browserOrigin;
        values.APP_ORIGIN = appOriginValue;
      }
    }

    // Never overwrite an existing valid custom redirect URI; derive the
    // callback from the effective app origin otherwise.
    if (!(initialEnv.DISCORD_REDIRECT_URI && isAbsoluteHttpUrl(initialEnv.DISCORD_REDIRECT_URI))) {
      values.DISCORD_REDIRECT_URI = `${appOriginValue}/api/auth/discord/callback`;
    }

    if (!initialEnv.DB_URL) {
      values.DB_URL = './data/wyvern.db';
    }

    if (!initialEnv.WYVERN_ENCRYPTION_KEY) {
      values.WYVERN_ENCRYPTION_KEY = crypto.randomBytes(32).toString('base64');
    } else if (invalid.some((item) => item && item.key === 'WYVERN_ENCRYPTION_KEY')) {
      throw httpError(
        'SETUP_VALIDATION_FAILED',
        'WYVERN_ENCRYPTION_KEY is present but invalid; restore the existing server configuration because replacing it would make stored files unreadable'
      );
    }

    if (Object.keys(values).length === 0) {
      throw httpError('SETUP_VALIDATION_FAILED', 'Nothing to save');
    }

    return {
      values,
      saved: SAVED_ORDER.filter((key) => key in values),
      generated: GENERATED_ORDER.filter((key) => key in values),
    };
  }

  router.post(
    '/credentials',
    limiter,
    asyncHandler(async (req, res) => {
      if (!isLocalRequest(req)) {
        const header = req.headers['x-wyvern-setup-token'];
        if (!header) throw httpError('SETUP_TOKEN_REQUIRED');
        if (tokenConsumed) throw httpError('SETUP_TOKEN_INVALID');
        if (!safeEqual(header, setupToken)) throw httpError('SETUP_TOKEN_INVALID');
      }

      const browserOrigin = checkOrigin(req);

      if (!req.is('application/json')) {
        throw httpError('SETUP_VALIDATION_FAILED', 'Request body must be JSON');
      }
      // Body keys DB_URL / DISCORD_REDIRECT_URI / WYVERN_ENCRYPTION_KEY are
      // deliberately never read — only server-side defaults may set them.
      const body = req.body || {};

      const { values, saved, generated } = computeWriteValues(body, browserOrigin);

      try {
        await writeSetupValues({ envFile, values });
      } catch {
        throw httpError('SETUP_WRITE_FAILED');
      }

      // One-time token: dead after any successful write.
      tokenConsumed = true;

      const diagnostics = diagnoseConfig({ ...initialEnv, ...values });
      res.json({
        ok: true,
        restartRequired: true,
        saved,
        generated,
        remainingMissing: diagnostics.missing,
        remainingInvalid: diagnostics.invalid,
      });
    })
  );

  return router;
}

module.exports = { createSetupConfigRoutes };
