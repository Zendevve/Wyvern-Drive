'use strict';

const crypto = require('node:crypto');
const express = require('express');
const { avatarUrl } = require('../auth/discord-oauth');
const { SESSION_TTL_MS } = require('../config');
const { asyncHandler, csrfProtect, createRateLimiter, safeEqual } = require('./middleware');

function createAuthRoutes({ config, repositories, sessionStore, oauth, discordStorage }) {
  const router = express.Router();
  const callbackLimiter = createRateLimiter({ windowMs: 60 * 1000, max: 10 });

  router.get('/discord', (req, res) => {
    const state = crypto.randomBytes(16).toString('hex');
    res.cookie('wyvern_oauth_state', state, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 10 * 60 * 1000,
      secure: config.isProduction,
    });
    res.redirect(oauth.buildAuthorizeUrl(state));
  });

  router.get(
    '/discord/callback',
    callbackLimiter,
    asyncHandler(async (req, res) => {
      const stateCookie = req.cookies && req.cookies.wyvern_oauth_state;
      res.clearCookie('wyvern_oauth_state', { path: '/' });

      const { state, code } = req.query;
      if (
        !code ||
        typeof state !== 'string' ||
        !stateCookie ||
        !safeEqual(state, stateCookie)
      ) {
        res.redirect(`${config.appOrigin}/login?error=invalid_state`);
        return;
      }

      let oauthResult;
      try {
        oauthResult = await oauth.exchangeCode(code);
      } catch (err) {
        res.redirect(`${config.appOrigin}/login?error=oauth_failed`);
        return;
      }

      const discordUser = oauthResult.user;
      const user = await repositories.upsertUserByDiscord({
        discordId: discordUser.id,
        username: discordUser.username,
        avatarUrl: avatarUrl(discordUser),
      });

      let drive = await repositories.getDriveByOwner(user.id);
      if (!drive) {
        try {
          const channelId = await discordStorage.ensureDriveChannel(discordUser);
          drive = await repositories.insertDrive({
            ownerId: user.id,
            channelId,
            quotaBytes: config.defaultQuotaBytes,
          });
        } catch (err) {
          // User row remains; provisioning is retried on the next sign-in.
          res.redirect(`${config.appOrigin}/login?error=storage_unavailable`);
          return;
        }
      }

      const token = crypto.randomBytes(32).toString('base64url');
      await sessionStore.create(token, user.id, SESSION_TTL_MS);
      const csrf = crypto.randomBytes(16).toString('hex');

      res.cookie('wyvern_session', token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_MS,
        secure: config.isProduction,
      });
      res.cookie('wyvern_csrf', csrf, {
        httpOnly: false,
        sameSite: 'lax',
        path: '/',
        maxAge: SESSION_TTL_MS,
        secure: config.isProduction,
      });
      res.redirect(`${config.appOrigin}/drive`);
    })
  );

  router.post(
    '/logout',
    csrfProtect(config),
    asyncHandler(async (req, res) => {
      const token = req.cookies && req.cookies.wyvern_session;
      if (token) await sessionStore.revoke(token);
      res.clearCookie('wyvern_session', { path: '/' });
      res.clearCookie('wyvern_csrf', { path: '/' });
      res.status(204).end();
    })
  );

  router.get(
    '/me',
    asyncHandler(async (req, res) => {
      const token = req.cookies && req.cookies.wyvern_session;
      const session = token ? await sessionStore.findByToken(token) : null;
      if (!session) {
        res.json({ user: null });
        return;
      }
      const user = await repositories.getUserById(session.userId);
      if (!user) {
        res.json({ user: null });
        return;
      }
      const drive = await repositories.getDriveByUser(user.id);
      let driveJson = null;
      if (drive) {
        const usedBytes = await repositories.sumReadyBytes(drive.id);
        driveJson = { id: drive.id, quotaBytes: drive.quota_bytes, usedBytes };
      }
      res.json({
        user: {
          id: user.id,
          discordId: user.discord_id,
          username: user.username,
          avatarUrl: user.avatar_url,
        },
        drive: driveJson,
      });
    })
  );

  return router;
}

module.exports = { createAuthRoutes };
