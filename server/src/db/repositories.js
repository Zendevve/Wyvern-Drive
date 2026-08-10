'use strict';

const { run, get, all } = require('./connection');

/** All SQL lives in this module. Business invariants live in services. */
function createRepositories(db) {
  const nowIso = () => new Date().toISOString();

  const SUBTREE_CTE = `
    WITH RECURSIVE subtree(id, path) AS (
      SELECT id, ',' || id || ',' FROM entries WHERE drive_id = ? AND id = ?
      UNION ALL
      SELECT e.id, s.path || e.id || ','
      FROM entries e
      JOIN subtree s ON e.parent_id = s.id AND e.drive_id = ?
      WHERE instr(s.path, ',' || e.id || ',') = 0
    )
  `;

  return {
    // ---- users ----
    async upsertUserByDiscord({ discordId, username, avatarUrl }) {
      const existing = await get(db, 'SELECT * FROM users WHERE discord_id = ?', [discordId]);
      const now = nowIso();
      if (existing) {
        await run(
          db,
          'UPDATE users SET username = ?, avatar_url = ?, updated_at = ? WHERE id = ?',
          [username, avatarUrl, now, existing.id]
        );
        return { ...existing, username, avatar_url: avatarUrl, updated_at: now };
      }
      const res = await run(
        db,
        'INSERT INTO users (discord_id, username, avatar_url, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
        [discordId, username, avatarUrl, now, now]
      );
      return {
        id: res.lastID,
        discord_id: discordId,
        username,
        avatar_url: avatarUrl,
        created_at: now,
        updated_at: now,
      };
    },

    getUserById(id) {
      return get(db, 'SELECT * FROM users WHERE id = ?', [id]);
    },

    // ---- drives ----
    getDriveByOwner(ownerId) {
      return get(db, 'SELECT * FROM drives WHERE owner_id = ?', [ownerId]);
    },

    getDriveByUser(userId) {
      return get(db, 'SELECT * FROM drives WHERE owner_id = ?', [userId]);
    },

    getDriveById(driveId) {
      return get(db, 'SELECT * FROM drives WHERE id = ?', [driveId]);
    },

    async insertDrive({ ownerId, channelId, quotaBytes }) {
      const now = nowIso();
      const res = await run(
        db,
        'INSERT INTO drives (owner_id, discord_channel_id, quota_bytes, created_at) VALUES (?, ?, ?, ?)',
        [ownerId, channelId, quotaBytes, now]
      );
      return {
        id: res.lastID,
        owner_id: ownerId,
        discord_channel_id: channelId,
        quota_bytes: quotaBytes,
        created_at: now,
      };
    },

    // ---- entries ----
    getEntryById(id) {
      return get(db, 'SELECT * FROM entries WHERE id = ?', [id]);
    },

    deleteEntryById(id) {
      return run(db, 'DELETE FROM entries WHERE id = ?', [id]);
    },

    listEntries(driveId, { parentId, query, kind, sort, direction }) {
      const where = ['drive_id = ?', "status = 'ready'"];
      const params = [driveId];
      if (parentId == null) {
        where.push('parent_id IS NULL');
      } else {
        where.push('parent_id = ?');
        params.push(parentId);
      }
      if (query) {
        where.push('name LIKE ? ESCAPE ?');
        params.push(`%${escapeLike(query)}%`, '\\');
      }
      if (kind === 'file' || kind === 'folder') {
        where.push('kind = ?');
        params.push(kind);
      }
      const orderCol = { name: 'name COLLATE NOCASE', size: 'size_bytes', createdAt: 'created_at', updatedAt: 'updated_at' }[sort] || 'name COLLATE NOCASE';
      const dir = direction === 'desc' ? 'DESC' : 'ASC';
      const sql = `SELECT * FROM entries WHERE ${where.join(' AND ')} ORDER BY ${orderCol} ${dir}, id ASC`;
      return all(db, sql, params);
    },

    async insertEntry({ driveId, parentId, kind, name, sizeBytes, mimeType, status }) {
      const now = nowIso();
      const res = await run(
        db,
        'INSERT INTO entries (drive_id, parent_id, kind, name, size_bytes, mime_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [driveId, parentId, kind, name, sizeBytes, mimeType, status, now, now]
      );
      return get(db, 'SELECT * FROM entries WHERE id = ?', [res.lastID]);
    },

    async updateEntry(id, fields) {
      const allowed = new Set(['name', 'parent_id', 'size_bytes', 'mime_type', 'status']);
      const sets = [];
      const params = [];
      for (const [key, value] of Object.entries(fields)) {
        if (allowed.has(key)) {
          sets.push(`${key} = ?`);
          params.push(value);
        }
      }
      if (sets.length === 0) return get(db, 'SELECT * FROM entries WHERE id = ?', [id]);
      params.push(nowIso(), id);
      await run(db, `UPDATE entries SET ${sets.join(', ')}, updated_at = ? WHERE id = ?`, params);
      return get(db, 'SELECT * FROM entries WHERE id = ?', [id]);
    },

    markSubtreeDeleting(driveId, entryId) {
      return run(
        db,
        `UPDATE entries SET status = 'deleting', updated_at = ? WHERE drive_id = ? AND id IN (${SUBTREE_CTE} SELECT id FROM subtree)`,
        [nowIso(), driveId, driveId, entryId, driveId]
      );
    },

    subtreeEntryIds(driveId, entryId) {
      return all(db, `${SUBTREE_CTE} SELECT id FROM subtree`, [driveId, entryId, driveId]);
    },

    getSubtreeFiles(driveId, entryId) {
      return all(
        db,
        `${SUBTREE_CTE} SELECT e.id, e.status FROM entries e WHERE e.drive_id = ? AND e.kind = 'file' AND e.id IN (SELECT id FROM subtree)`,
        [driveId, entryId, driveId, driveId]
      );
    },

    async deleteRecursive(driveId, entryId) {
      const ids = await this.subtreeEntryIds(driveId, entryId);
      if (ids.length === 0) return;
      const placeholders = ids.map(() => '?').join(', ');
      await run(db, `DELETE FROM entries WHERE drive_id = ? AND id IN (${placeholders})`, [
        driveId,
        ...ids.map((r) => r.id),
      ]);
    },

    async sumReadyBytes(driveId) {
      const row = await get(
        db,
        "SELECT COALESCE(SUM(size_bytes), 0) AS total FROM entries WHERE drive_id = ? AND kind = 'file' AND status = 'ready'",
        [driveId]
      );
      return row.total;
    },

    async siblingCount(driveId, parentId, name) {
      const row = await get(
        db,
        'SELECT COUNT(*) AS c FROM entries WHERE drive_id = ? AND parent_id IS ? AND name = ?',
        [driveId, parentId, name]
      );
      return row.c;
    },

    async childCount(driveId, parentId) {
      const row = await get(db, 'SELECT COUNT(*) AS c FROM entries WHERE drive_id = ? AND parent_id = ?', [
        driveId,
        parentId,
      ]);
      return row.c;
    },

    // ---- file_chunks ----
    async insertChunk({ entryId, ordinal, messageId, plainSizeBytes, cipherSizeBytes, nonce, authTag, checksum }) {
      const res = await run(
        db,
        'INSERT INTO file_chunks (entry_id, ordinal, discord_message_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, checksum) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [entryId, ordinal, messageId, plainSizeBytes, cipherSizeBytes, nonce, authTag, checksum]
      );
      return { id: res.lastID, entry_id: entryId, ordinal };
    },

    getChunksByEntry(entryId) {
      return all(db, 'SELECT * FROM file_chunks WHERE entry_id = ? ORDER BY ordinal ASC', [entryId]);
    },

    getPendingChunks(entryId) {
      return all(
        db,
        'SELECT * FROM file_chunks WHERE entry_id = ? AND deleted_at IS NULL ORDER BY ordinal ASC',
        [entryId]
      );
    },

    markChunkDeleted(id) {
      return run(db, 'UPDATE file_chunks SET deleted_at = ? WHERE id = ?', [nowIso(), id]);
    },

    async countPendingDeletes(entryId) {
      const row = await get(db, 'SELECT COUNT(*) AS c FROM file_chunks WHERE entry_id = ? AND deleted_at IS NULL', [
        entryId,
      ]);
      return row.c;
    },

    // ---- shares ----
    async insertShare({ entryId, tokenHash, createdBy, expiresAt }) {
      const now = nowIso();
      const res = await run(
        db,
        'INSERT INTO shares (entry_id, token_hash, created_by, expires_at, revoked_at, created_at) VALUES (?, ?, ?, ?, NULL, ?)',
        [entryId, tokenHash, createdBy, expiresAt, now]
      );
      return {
        id: res.lastID,
        entry_id: entryId,
        token_hash: tokenHash,
        created_by: createdBy,
        expires_at: expiresAt,
        revoked_at: null,
        created_at: now,
      };
    },

    updateShareTokenHash(id, tokenHash) {
      return run(db, 'UPDATE shares SET token_hash = ? WHERE id = ?', [tokenHash, id]);
    },

    getShareById(id) {
      return get(db, 'SELECT * FROM shares WHERE id = ?', [id]);
    },

    getShareByTokenHash(tokenHash) {
      return get(db, 'SELECT * FROM shares WHERE token_hash = ?', [tokenHash]);
    },

    listSharesByEntry(entryId) {
      return all(db, 'SELECT * FROM shares WHERE entry_id = ? ORDER BY created_at DESC', [entryId]);
    },

    revokeShare(id) {
      return run(db, 'UPDATE shares SET revoked_at = ? WHERE id = ?', [nowIso(), id]);
    },

    // ---- sessions ----
    async insertSession({ tokenHash, userId, expiresAt }) {
      const now = nowIso();
      const res = await run(
        db,
        'INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)',
        [tokenHash, userId, expiresAt, now]
      );
      return { id: res.lastID, token_hash: tokenHash, user_id: userId, expires_at: expiresAt, created_at: now };
    },

    getSessionByTokenHash(tokenHash) {
      return get(db, 'SELECT * FROM sessions WHERE token_hash = ?', [tokenHash]);
    },

    deleteSessionByTokenHash(tokenHash) {
      return run(db, 'DELETE FROM sessions WHERE token_hash = ?', [tokenHash]);
    },
  };
}

/** Escape LIKE wildcards using backslash as the escape character. */
function escapeLike(value) {
  return String(value).replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

module.exports = { createRepositories };
