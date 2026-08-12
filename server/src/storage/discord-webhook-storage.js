'use strict';

const crypto = require('node:crypto');
const { WyvernError } = require('../errors');

const WEBHOOK_PATH_RE = /^\/api\/webhooks\/(\d+)\/([A-Za-z0-9_-]+)$/;
const ALLOWED_WEBHOOK_HOSTS = new Set(['discord.com', 'discordapp.com']);
const MAX_RETRIES = 3;
const MAX_CHUNKS_PER_MESSAGE = 10;

/**
 * Discord chunk storage adapter around per-drive Discord webhooks. Each
 * webhook URL is stored only as AES-256-GCM ciphertext (fresh 12-byte nonce +
 * auth tag per credential) under the master WYVERN_ENCRYPTION_KEY; every call
 * decrypts the credential in memory and speaks to Discord through fetchImpl,
 * so the browser never sees the URL, message IDs, or raw CDN attachment URLs.
 *
 * All chunk operations take a WEBHOOK CREDENTIAL object (a row from the
 * `webhooks` table) instead of a drive:
 *   webhook = { id, webhook_ciphertext, webhook_nonce, webhook_auth_tag }
 *
 * Interface:
 *  - validateAndSealWebhook(webhookUrl) -> { webhook_ciphertext, webhook_nonce, webhook_auth_tag }
 *  - putChunks(webhook, chunks) -> [{ ordinal, messageId }]  (1..10 chunks per message)
 *  - putChunk(webhook, filename, encryptedBuffer) -> messageId
 *  - getChunk(webhook, messageId, attachmentIndex?) -> Buffer
 *  - deleteChunk(webhook, messageId) -> Promise<void> (404 counts as success)
 */
function createDiscordWebhookStorage(config, { chunkSizeBytes, fetchImpl = globalThis.fetch }) {
  const encryptionKey = config.encryptionKey;

  // Per-webhook Discord rate-limit awareness: { remaining, resetAt } keyed by
  // webhook.id (fallback 'anon' for credential-less unit-test objects),
  // populated from X-RateLimit-* response headers after each POST.
  const rateLimitState = new Map();

  /** Sleep with ±20% jitter around the requested duration (ms). */
  function jitteredSleep(ms) {
    const jitter = ms * 0.2;
    const delay = Math.max(0, ms + (Math.random() * 2 - 1) * jitter);
    return new Promise((resolve) => setTimeout(resolve, delay));
  }

  /** Read a response header, tolerating Headers instances and plain objects. */
  function headerValue(res, name) {
    if (!res || !res.headers) return null;
    const headers = res.headers;
    const raw = typeof headers.get === 'function' ? headers.get(name) : headers[name];
    if (raw === undefined || raw === null || raw === '') return null;
    return String(raw);
  }

  /** Rate-limit state key: the webhook id, or 'anon' when absent (test objects). */
  function rateLimitKey(webhook) {
    return webhook && webhook.id !== undefined && webhook.id !== null ? webhook.id : 'anon';
  }

  /** Before a POST, wait out the Discord rate-limit window when the budget is exhausted. */
  async function throttleBeforePost(webhook) {
    const state = rateLimitState.get(rateLimitKey(webhook));
    if (!state || state.remaining !== 0) return;
    if (state.resetAt != null && state.resetAt > Date.now()) {
      await jitteredSleep(state.resetAt - Date.now());
    }
  }

  /** After a successful POST, record X-RateLimit-* headers (absent → no throttling). */
  function recordRateLimit(webhook, res) {
    const remainingRaw = headerValue(res, 'x-ratelimit-remaining');
    const resetAfterRaw = headerValue(res, 'x-ratelimit-reset-after');
    if (remainingRaw === null && resetAfterRaw === null) return;
    const key = rateLimitKey(webhook);
    const state = rateLimitState.get(key) || {};
    const remaining = Number(remainingRaw);
    const resetAfter = Number(resetAfterRaw);
    if (Number.isFinite(remaining)) state.remaining = remaining;
    if (Number.isFinite(resetAfter)) state.resetAt = Date.now() + resetAfter * 1000;
    rateLimitState.set(key, state);
  }

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

  /** Decrypt a webhook credential. Throws STORAGE_UNAVAILABLE when unset or undecryptable. */
  function unsealWebhookUrl(webhook) {
    if (!webhook || !webhook.webhook_ciphertext || !webhook.webhook_nonce || !webhook.webhook_auth_tag) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Webhook has no configured credential');
    }
    try {
      const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, webhook.webhook_nonce);
      decipher.setAuthTag(webhook.webhook_auth_tag);
      return Buffer.concat([decipher.update(webhook.webhook_ciphertext), decipher.final()]).toString('utf8');
    } catch (err) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Webhook credential could not be decrypted');
    }
  }

  /**
   * Retry fn under the adapter's bounded retry budget: HTTP 429 sleeps the
   * provider's retry_after, HTTP 5xx backs off exponentially (500ms * 2^attempt);
   * every sleep carries ±20% jitter. 4xx other than 429 and transport errors
   * fail fast. After retries are exhausted a 5xx response is handed back so
   * callers map it; otherwise the last error becomes STORAGE_UNAVAILABLE.
   */
  async function withRetry(fn) {
    let lastRes = null;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
      try {
        const res = await fn();
        if (res && res.status >= 500) {
          lastRes = res;
          if (attempt < MAX_RETRIES) {
            await jitteredSleep(500 * Math.pow(2, attempt));
            continue;
          }
          return res;
        }
        return res;
      } catch (err) {
        if (attempt >= MAX_RETRIES) break;
        if (err && err.status === 429 && err.retryAfter != null) {
          await jitteredSleep(err.retryAfter * 1000);
          continue;
        }
        break;
      }
    }
    if (lastRes) return lastRes;
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

  /** Resolve and validate a webhook credential, returning its URL parse. */
  function resolveWebhook(webhook) {
    const webhookUrl = unsealWebhookUrl(webhook);
    const parsed = parseWebhookUrl(webhookUrl);
    if (!parsed) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Webhook credential is not a valid Discord webhook URL');
    }
    return parsed;
  }

  /**
   * Post 1..10 encrypted chunks as ONE webhook message, one attachment per
   * chunk (FormData payload_json + a unique file part per chunk). Resolves
   * [{ ordinal, messageId }] in input order — every attachment of a message
   * shares the message id. Throws STORAGE_UNAVAILABLE on transport/5xx or
   * when the message body lacks an `id`.
   */
  async function putChunks(webhook, chunks) {
    if (!Array.isArray(chunks) || chunks.length === 0 || chunks.length > MAX_CHUNKS_PER_MESSAGE) {
      throw new WyvernError('BAD_REQUEST', 'putChunks expects between 1 and 10 chunks');
    }
    const parsed = resolveWebhook(webhook);
    await throttleBeforePost(webhook);

    const form = new FormData();
    form.append('payload_json', JSON.stringify({}));
    for (const chunk of chunks) {
      form.append('file', new Blob([chunk.encryptedBuffer]), chunk.filename);
    }

    const res = await withRetry(() =>
      discordFetch(`${parsed.base}?wait=true`, {
        method: 'POST',
        body: form,
      })
    );
    if (!res.ok) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
    }
    recordRateLimit(webhook, res);

    const body = await res.json();
    if (!body || (typeof body.id !== 'string' && typeof body.id !== 'number')) {
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord storage request failed');
    }
    const messageId = String(body.id);
    return chunks.map((chunk) => ({ ordinal: chunk.ordinal, messageId }));
  }

  /** Post one encrypted chunk as a webhook message; resolves the message id. */
  async function putChunk(webhook, filename, encryptedBuffer) {
    const results = await putChunks(webhook, [{ filename, encryptedBuffer, ordinal: 0 }]);
    return results[0].messageId;
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

    putChunks,

    putChunk,

    /**
     * Fetch one chunk message and return the bytes of the attachment at
     * `attachmentIndex` (default 0). Packed uploads store several chunks in
     * one message; the attachment order matches the ordinal order of the
     * blocks that were posted together, so the file service passes the
     * position of a block within its message to select the right attachment.
     */
    async getChunk(webhook, messageId, attachmentIndex = 0) {
      const parsed = resolveWebhook(webhook);
      const res = await withRetry(() => discordFetch(`${parsed.base}/messages/${messageId}`));
      if (!res.ok) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk fetch failed');
      }
      const message = await res.json();
      const attachment =
        message && message.attachments && Number.isInteger(attachmentIndex) && attachmentIndex >= 0
          ? message.attachments[attachmentIndex]
          : undefined;
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

    /**
     * Delete one chunk message through the webhook API. Idempotent: a Discord
     * 404 (unknown message or webhook) counts as success.
     */
    async deleteChunk(webhook, messageId) {
      const parsed = resolveWebhook(webhook);
      const res = await withRetry(() =>
        discordFetch(`${parsed.base}/messages/${messageId}`, { method: 'DELETE' })
      );
      if (res.status === 404) return;
      if (!res.ok) {
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Discord chunk deletion failed');
      }
    },
  };
}

module.exports = { createDiscordWebhookStorage };
