'use strict';

const { Client, GatewayIntentBits, PermissionFlagsBits, Routes } = require('discord.js');
const { WyvernError } = require('../errors');

const CHANNEL_PERMISSIONS = ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageMessages', 'ManageChannels'];

/**
 * Discord chunk storage adapter around a single lazily-initialized discord.js
 * Client. Never exposes attachment URLs or message IDs to callers other than
 * through its own interface; attachment bytes are fetched server-side.
 *
 * Interface: ensureDriveChannel(driveOwner) -> channelId,
 * putChunk(channelId, filename, encryptedBuffer) -> messageId,
 * getChunk(channelId, messageId) -> Buffer, deleteChunk(channelId, messageId).
 */
function createDiscordStorage(config, { chunkSizeBytes }) {
  let client = null;
  let botIdPromise = null;
  const channelCache = new Map(); // driveOwner.id -> channelId

  function getClient() {
    if (!client) {
      client = new Client({
        intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages],
      });
      client.token = config.discordBotToken;
    }
    return client;
  }

  function getBotId() {
    if (!botIdPromise) {
      botIdPromise = withRetry(() => getClient().rest.get(Routes.user())).then((me) => me.id);
    }
    return botIdPromise;
  }

  /** Retry on HTTP 429 using the provider's retry_after, max 3 retries. */
  async function withRetry(fn) {
    let lastError;
    for (let attempt = 0; attempt <= 3; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const retryAfter = err && (err.rawError && err.rawError.retry_after != null
          ? err.rawError.retry_after
          : err.data && err.data.retry_after != null
            ? err.data.retry_after
            : err.retry_after);
        if (attempt < 3 && err && err.status === 429 && retryAfter != null) {
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        break;
      }
    }
    throw new WyvernError('STORAGE_UNAVAILABLE', `Discord storage request failed: ${lastError && lastError.message}`);
  }

  return {
    chunkSizeBytes,

    /** Create (or reuse) one private text channel per drive owner. */
    async ensureDriveChannel(driveOwner) {
      if (channelCache.has(driveOwner.id)) return channelCache.get(driveOwner.id);
      const botId = await getBotId();
      const allowBits = CHANNEL_PERMISSIONS.reduce(
        (acc, perm) => acc | PermissionFlagsBits[perm],
        0n
      ).toString();
      const denyBits = PermissionFlagsBits.ViewChannel.toString();
      const channel = await withRetry(() =>
        getClient().rest.post(Routes.guildChannels(config.discordStorageGuildId), {
          body: {
            name: `wyvern-${driveOwner.id}`,
            type: 0, // GUILD_TEXT
            parent_id: config.discordStorageCategoryId,
            permission_overwrites: [
              { id: config.discordStorageGuildId, type: 0, deny: denyBits, allow: '0' },
              { id: botId, type: 0, allow: allowBits, deny: '0' },
            ],
          },
        })
      );
      channelCache.set(driveOwner.id, channel.id);
      return channel.id;
    },

    async putChunk(channelId, filename, encryptedBuffer) {
      const message = await withRetry(() =>
        getClient().rest.post(Routes.channelMessages(channelId), {
          files: [{ attachment: encryptedBuffer, name: filename, description: 'Wyvern Drive encrypted chunk' }],
        })
      );
      return message.id;
    },

    async getChunk(channelId, messageId) {
      const message = await withRetry(() => getClient().rest.get(Routes.channelMessage(channelId, messageId)));
      const attachment = message && message.attachments && message.attachments[0];
      if (!attachment) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk attachment missing');
      }
      let res;
      try {
        res = await fetch(attachment.url);
      } catch (err) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk download failed');
      }
      if (!res.ok) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk download failed');
      }
      return Buffer.from(await res.arrayBuffer());
    },

    async deleteChunk(channelId, messageId) {
      await withRetry(() => getClient().rest.delete(Routes.channelMessage(channelId, messageId)));
    },
  };
}

module.exports = { createDiscordStorage };
