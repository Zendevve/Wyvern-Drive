'use strict';

const crypto = require('node:crypto');
const { WyvernError } = require('../errors');

const WEBHOOK_PATH_RE = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)$/;
const ALLOWED_WEBHOOK_HOSTS = new Set(['discord.com', 'discordapp.com']);
const MAX_RETRIES = 3;

/**
 * Discord chunk storage adapter around one per-user Discord webhook. The
 * webhook URL is stored only as AES-256-GCM ciphertext (fresh 12-byte nonce +
 * auth tag per credential) under the master WYVERN_ENCRYPTION_KEY; every call
 * decrypts the credential in memory and speaks to Discord through fetchImpl,
 * so the browser never sees the URL, message IDs, or raw CDN attachment URLs.
 *
 * Interface:
 *  - validateAndSealWebhook(webhookUrl) -> { webhook_ciphertext, webhook_nonce, webhook_auth_tag }
 *  - putChunk(drive, filename, encryptedBuffer) -> messageId
 *  - getChunk(drive, messageId) -> Buffer
 *  - deleteChunk(drive, messageId) -> Promise<void>
 */
function createDiscordWebhookStorage(config, { chunkSizeBytes, fetchImpl = globalThis.fetch }) {
  const encryptionKey = config.encryptionKey;

  function sealWebhookUrl(webhookUrl) {
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, nonce);
    const ciphertext = Buffer.concat([cipher.update(Buffer.from(webhookUrl, 'utf8')), cipher.final()]);
    return {
      webhook_ciphertext: ciphertext,
      webhook_nonce: nonce,
      webhook_auth_tag: cipher.getAuthTag(),
    };
  }

  /** Decrypt the drive's webhook credential. Throws STORAGE_UNAVAILABLE when unset or undecryptable. */
  function unsealWebhookUrl(drive) {
    if (!drive || !drive.webhook_ciphertext || !drive.webhook_nonce || !drive.webhook_auth_tag) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Drive has no configured webhook');
    }
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, drive.webhook_nonce);
      decipher.setAuthTag(drive.webhook_auth_tag);
      return Buffer.concat([decipher.update(drive.webhook_ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Drive webhook credential could not be decrypted');
    }
  }

  /**
   * Retry on HTTP 429 using the provider's retry_after (seconds), with the
   * adapter's bounded retry budget, then throw STORAGE_UNAVAILABLE.
   */
  async function withRetry(fn) {
    let lastError;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const retryAfter = err && err.retryAfter;
        if (attempt < MAX_RETRIES && err && err.status === 429 && retryAfter != null) {
          await new Promise((resolve) => setTimeout(resolve, retryAfter * 1000));
          continue;
        }
        break;
      }
    }
    throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
  }

  /** One Discord REST call, unwrapping JSON 429 bodies into { status, retryAfter }. */
  async function discordFetch(url, init = {}) {
    let res;
    try {
      res = await fetchImpl(url, init);
    } catch (err) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
    }
    if (res.status === 429) {
      let retryAfter = null;
      try {
        const body = await res.json();
        retryAfter = body && typeof body.retry_after === 'number' ? body.retry_after : null;
      } catch {
        retryAfter = null;
      }
      const err = new Error(`rate limited (${res.status})`);
      err.status = res.status;
      err.retryAfter = retryAfter;
      throw err;
    }
    return res;
  }

  /** Parse a validated webhook URL into { base, id, token }. */
  function parseWebhookUrl(webhookUrl) {
    let parsed;
    try {
      parsed = new URL(webhookUrl);
    } catch {
      return null;
    }
    if (parsed.protocol !== 'https:') return null;
    if (!ALLOWED_WEBHOOK_HOSTS.has(parsed.hostname)) return null;
    const match = WEBHOOK_PATH_RE.exec(parsed.pathname);
    if (!match) return null;
    return { base: `${parsed.origin}${parsed.pathname}`, id: match[1], token: match[2] };
  }

  return {
    chunkSizeBytes,

    /**
     * Validate a candidate webhook URL and return its sealed credential
     * fields. Trims input; requires an HTTPS Discord webhook URL on
     * discord.com/discordapp.com with a numeric id and token. An invalid or
     * unauthorized URL maps to INVALID_WEBHOOK (400); transport/Discord
     * availability failures map to STORAGE_UNAVAILABLE (502). Never logs the
     * URL or any response body.
     */
    async validateAndSealWebhook(rawUrl) {
      const webhookUrl = typeof rawUrl === 'string' ? rawUrl.trim() : '';
      const parsed = parseWebhookUrl(webhookUrl);
      if (!parsed) {
        throw new WyvernError('INVALID_WEBHOOK', 'Webhook URL must be an HTTPS Discord webhook URL');
      }
      let res;
      try {
        res = await withRetry(() => discordFetch(parsed.base));
      } catch (err) {
        // Transport failure or exhausted 429 retries: Discord is unavailable.
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
      }
      if (res.status >= 500) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
      }
      if (!res.ok) {
        // Invalid, unknown, or unauthorized webhook URL.
        throw new WyvernError('INVALID_WEBHOOK', 'Webhook URL is not a valid Discord webhook');
      }
      return sealWebhookUrl(webhookUrl);
    },

    /** Post one encrypted chunk as a webhook message; resolves the message id. */
    async putChunk(drive, filename, encryptedBuffer) {
      const webhookUrl = unsealWebhookUrl(drive);
      const parsed = parseWebhookUrl(webhookUrl);
      if (!parsed) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Drive webhook credential is not a valid Discord webhook URL');
      }
      const form = new FormData();
      form.append('payload_json', JSON.stringify({}));
      form.append('file', new Blob([encryptedBuffer]), filename);
      const res = await withRetry(() =>
        discordFetch(`${parsed.base}?wait=true`, {
          method: 'POST',
          body: form,
        })
      );
      if (!res.ok) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
      }
      const body = await res.json();
      if (!body || typeof body.id !== 'string' && typeof body.id !== 'number') {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
      }
      return String(body.id);
    },

    /** Fetch one chunk message and return its first attachment's bytes. */
    async getChunk(drive, messageId) {
      const webhookUrl = unsealWebhookUrl(drive);
      const parsed = parseWebhookUrl(webhookUrl);
      if (!parsed) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Drive webhook credential is not a valid Discord webhook URL');
      }
      const res = await withRetry(() => discordFetch(`${parsed.base}/messages/${messageId}`));
      if (!res.ok) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk fetch failed');
      }
      const message = await res.json();
      const attachment = message && message.attachments && message.attachments[0];
      if (!attachment || typeof attachment.url !== 'string') {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk attachment missing');
      }
      let cdnRes;
      try {
        cdnRes = await fetchImpl(attachment.url);
      } catch (err) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk download failed');
      }
      if (!cdnRes.ok) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk download failed');
      }
      return Buffer.from(await cdnRes.arrayBuffer());
    },

    /** Delete one chunk message through the webhook API. */
    async deleteChunk(drive, messageId) {
      const webhookUrl = unsealWebhookUrl(drive);
      const parsed = parseWebhookUrl(webhookUrl);
      if (!parsed) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Drive webhook credential is not a valid Discord webhook URL');
      }
      const res = await withRetry(() =>
        discordFetch(`${parsed.base}/messages/${messageId}`, { method: 'DELETE' })
      );
      if (!res.ok) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk deletion failed');
      }
    },
  };
}

module.exports = { createDiscordWebhookStorage };
