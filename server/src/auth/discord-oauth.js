'use strict';

const { WyvernError } = require('../errors');

const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_ME_URL = 'https://discord.com/api/users/@me';

/**
 * Discord OAuth2 client. fetchImpl is injected so tests can stub Discord.
 * Returns { buildAuthorizeUrl(state), exchangeCode(code) }.
 */
function createDiscordOAuth(config, fetchImpl = fetch) {
  return {
    buildAuthorizeUrl(state) {
      const params = new URLSearchParams({
        client_id: config.discordClientId,
        redirect_uri: config.discordRedirectUri,
        response_type: 'code',
        scope: 'identify',
        state,
      });
      return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
    },

    async exchangeCode(code) {
      let tokenRes;
      try {
        tokenRes = await fetchImpl(DISCORD_TOKEN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body: new URLSearchParams({
            client_id: config.discordClientId,
            client_secret: config.discordClientSecret,
            grant_type: 'authorization_code',
            code,
            redirect_uri: config.discordRedirectUri,
          }),
        });
      } catch (err) {
        throw new WyvernError('FORBIDDEN', 'Discord token exchange failed', 502);
      }
      if (!tokenRes.ok) {
        throw new WyvernError('FORBIDDEN', 'Discord token exchange failed', 502);
      }
      const tokenData = await tokenRes.json();

      let meRes;
      try {
        meRes = await fetchImpl(DISCORD_ME_URL, {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        });
      } catch (err) {
        throw new WyvernError('FORBIDDEN', 'Discord identity fetch failed', 502);
      }
      if (!meRes.ok) {
        throw new WyvernError('FORBIDDEN', 'Discord identity fetch failed', 502);
      }
      const me = await meRes.json();

      return {
        accessToken: tokenData.access_token,
        user: { id: String(me.id), username: String(me.username), avatar: me.avatar || null },
      };
    },
  };
}

/** avatar -> CDN URL, null avatar -> null. */
function avatarUrl(discordUser) {
  if (!discordUser.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${discordUser.id}/${discordUser.avatar}.png`;
}

module.exports = { createDiscordOAuth, avatarUrl };
