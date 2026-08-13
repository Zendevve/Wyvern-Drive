'use strict';

const crypto = require('node:crypto');

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

/**
 * Session store over the repositories' sessions table. Only sha256 hashes of
 * opaque tokens are persisted; plaintext tokens exist solely in the browser
 * cookie and the HTTP request.
 */
function createSessionStore(repositories) {
  return {
    async create(token, userId, ttlMs) {
      const expiresAt = new Date(Date.now() + ttlMs).toISOString();
      return repositories.insertSession({ tokenHash: sha256(token), userId, expiresAt });
    },

    async findByToken(token) {
      if (!token) return null;
      const row = await repositories.getSessionByTokenHash(sha256(token));
      if (!row) return null;
      if (new Date(row.expires_at).getTime() <= Date.now()) return null;
      return { id: row.id, userId: row.user_id, expiresAt: row.expires_at };
    },

    async revoke(token) {
      if (!token) return;
      await repositories.deleteSessionByTokenHash(sha256(token));
    },

    /**
     * Reclaim expired session rows. Invoked by the periodic maintenance sweep;
     * lookup semantics are unchanged (findByToken already treats an expired
     * row as absent).
     */
    async deleteExpired() {
      return repositories.deleteExpiredSessions();
    },
  };
}

module.exports = { createSessionStore, sha256 };
