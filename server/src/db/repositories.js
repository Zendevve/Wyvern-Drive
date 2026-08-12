'use strict';

const { run, get, all } = require('./connection');

/** All SQL lives in this module. Business invariants live in services. */
function createRepositories(db) {
  const nowIso = () => new Date().toISOString();

  // Zero-padded id segments make path ordering equal to numeric pre-order
  // (parents before children, root first, siblings by id) for getSubtreeEntries.
  const SUBTREE_CTE = `
    WITH RECURSIVE subtree(id, path) AS (
      SELECT id, printf(',%012d,', id) FROM entries WHERE drive_id = ? AND id = ?
      UNION ALL
      SELECT e.id, s.path || printf(',%012d,', e.id)
      FROM entries e
      JOIN subtree s ON e.parent_id = s.id AND e.drive_id = ?
      WHERE instr(s.path, printf(',%012d,', e.id)) = 0
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
    // Drive rows carry webhook credential columns (ciphertext/nonce/auth tag)
    // for server-side services only; no route serializes them.
    getDriveByOwner(ownerId) {
      return get(db, 'SELECT * FROM drives WHERE owner_id = ?', [ownerId]);
    },

    getDriveByUser(userId) {
      return get(db, 'SELECT * FROM drives WHERE owner_id = ?', [userId]);
    },

    getDriveById(driveId) {
      return get(db, 'SELECT * FROM drives WHERE id = ?', [driveId]);
    },

    /** Every drive id (boot-time retention sweep iterates these). */
    listDriveIds() {
      return all(db, 'SELECT id FROM drives ORDER BY id ASC');
    },

    /**
     * Drive-wide usage summary over COMMITTED files only: uploading/failed
     * entries are resumable or abandoned (see the orphan sweep) and must not
     * count as phantom files, size, or stored blocks. sizeBytes is the logical
     * user byte count over ready file entries; storedBytes is the actual
     * Discord footprint over blocks referenced by a ready entry; messages
     * counts distinct Discord messages holding such blocks. Trashed ready
     * files still count (soft delete keeps status 'ready'), so deleted_at is
     * deliberately absent from the size/blocks clauses. Folders count
     * unchanged. compressionRatio is null when nothing is uploaded, 0 when no
     * blocks are stored, else sizeBytes / storedBytes.
     */
    async driveStats(driveId) {
      const row = await get(
        db,
        `SELECT
           COALESCE(SUM(CASE WHEN kind = 'file' AND status = 'ready' THEN size_bytes END), 0) AS sizeBytes,
           (SELECT COUNT(*) FROM entries WHERE drive_id = ? AND kind = 'file' AND status = 'ready' AND deleted_at IS NULL) AS files,
           (SELECT COUNT(*) FROM entries WHERE drive_id = ? AND kind = 'folder' AND status = 'ready' AND deleted_at IS NULL) AS folders,
           (SELECT COUNT(*) FROM content_blocks b WHERE b.drive_id = ? AND EXISTS (
              SELECT 1 FROM file_chunks fc JOIN entries e ON e.id = fc.entry_id
              WHERE fc.block_id = b.id AND e.status = 'ready'
            )) AS blocks,
           (SELECT COUNT(DISTINCT b.message_id) FROM content_blocks b WHERE b.drive_id = ? AND EXISTS (
              SELECT 1 FROM file_chunks fc JOIN entries e ON e.id = fc.entry_id
              WHERE fc.block_id = b.id AND e.status = 'ready'
            )) AS messages,
           (SELECT COUNT(*) FROM webhooks WHERE drive_id = ?) AS webhooks,
           (SELECT COALESCE(SUM(b.cipher_size_bytes), 0) FROM content_blocks b WHERE b.drive_id = ? AND EXISTS (
              SELECT 1 FROM file_chunks fc JOIN entries e ON e.id = fc.entry_id
              WHERE fc.block_id = b.id AND e.status = 'ready'
            )) AS storedBytes
         FROM entries WHERE drive_id = ?`,
        [driveId, driveId, driveId, driveId, driveId, driveId, driveId]
      );
      const sizeBytes = row.sizeBytes;
      const storedBytes = row.storedBytes;
      const compressionRatio = sizeBytes > 0 ? (storedBytes > 0 ? sizeBytes / storedBytes : 0) : null;
      return {
        files: row.files,
        folders: row.folders,
        sizeBytes,
        storedBytes,
        blocks: row.blocks,
        messages: row.messages,
        webhooks: row.webhooks,
        compressionRatio,
      };
    },

    // Drive rows still carry the legacy webhook credential columns (never
    // auto-migrated, like legacy_discord_channel_id) but no code path reads or
    // writes them: credentials live in the webhooks table (migration 004).
    async insertDrive({ ownerId, quotaBytes }) {
      const now = nowIso();
      const res = await run(db, 'INSERT INTO drives (owner_id, quota_bytes, created_at) VALUES (?, ?, ?)', [
        ownerId,
        quotaBytes,
        now,
      ]);
      return {
        id: res.lastID,
        owner_id: ownerId,
        quota_bytes: quotaBytes,
        created_at: now,
      };
    },

    // ---- webhooks ----
    async insertWebhook({ driveId, webhookCiphertext, webhookNonce, webhookAuthTag }) {
      const now = nowIso();
      const res = await run(
        db,
        'INSERT INTO webhooks (drive_id, webhook_ciphertext, webhook_nonce, webhook_auth_tag, created_at) VALUES (?, ?, ?, ?, ?)',
        [driveId, webhookCiphertext, webhookNonce, webhookAuthTag, now]
      );
      return get(db, 'SELECT * FROM webhooks WHERE id = ?', [res.lastID]);
    },

    listWebhooks(driveId) {
      return all(db, 'SELECT * FROM webhooks WHERE drive_id = ? ORDER BY id ASC', [driveId]);
    },

    getWebhookById(id) {
      return get(db, 'SELECT * FROM webhooks WHERE id = ?', [id]);
    },

    deleteWebhook(id) {
      return run(db, 'DELETE FROM webhooks WHERE id = ?', [id]);
    },

    async countWebhooks(driveId) {
      const row = await get(db, 'SELECT COUNT(*) AS c FROM webhooks WHERE drive_id = ?', [driveId]);
      return row.c;
    },

    // ---- entries ----
    getEntryById(id) {
      return get(db, 'SELECT * FROM entries WHERE id = ?', [id]);
    },

    deleteEntryById(id) {
      return run(db, 'DELETE FROM entries WHERE id = ?', [id]);
    },

    listEntries(driveId, { parentId, query, kind, sort, direction, search }) {
      const where = ['drive_id = ?', "status = 'ready'", 'deleted_at IS NULL'];
      const params = [driveId];
      // Global search: when `search` is true the parent clause is dropped
      // entirely so matches come from the whole drive, not one folder.
      if (!search) {
        if (parentId == null) {
          where.push('parent_id IS NULL');
        } else {
          where.push('parent_id = ?');
          params.push(parentId);
        }
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

    async insertEntry({ driveId, parentId, kind, name, sizeBytes, mimeType, status, uploadToken, expectedSizeBytes }) {
      const now = nowIso();
      const res = await run(
        db,
        'INSERT INTO entries (drive_id, parent_id, kind, name, size_bytes, mime_type, status, upload_token, expected_size_bytes, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [driveId, parentId, kind, name, sizeBytes, mimeType, status, uploadToken ?? null, expectedSizeBytes ?? null, now, now]
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

    /**
     * Logical bytes of COMMITTED file entries (status 'ready'; trashed files
     * keep counting until purged, matching driveStats.sizeBytes). Interrupted
     * uploading/failed entries are excluded: they are resumable and, once
     * abandoned, reclaimed by the orphan-upload sweep.
     */
    async sumUsedBytes(driveId) {
      const row = await get(
        db,
        "SELECT COALESCE(SUM(size_bytes), 0) AS total FROM entries WHERE drive_id = ? AND kind = 'file' AND status = 'ready'",
        [driveId]
      );
      return row.total;
    },

    /** Resume target: the live entry (if any) already bound to a client upload token. */
    getEntryByUploadToken(driveId, uploadToken) {
      return get(
        db,
        'SELECT * FROM entries WHERE drive_id = ? AND upload_token = ? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1',
        [driveId, uploadToken]
      );
    },

    /** Abandoned upload entries: no activity within the orphan TTL window. */
    listStaleUploads(driveId, cutoffIso) {
      return all(
        db,
        "SELECT id FROM entries WHERE drive_id = ? AND kind = 'file' AND status IN ('uploading','failed') AND deleted_at IS NULL AND updated_at < ?",
        [driveId, cutoffIso]
      );
    },

    /** Plaintext bytes currently posted for an entry (deleted chunks excluded). */
    async sumPlainBytesByEntry(entryId) {
      const row = await get(
        db,
        `SELECT COALESCE(SUM(b.plain_size_bytes), 0) AS total
         FROM file_chunks c
         JOIN content_blocks b ON b.id = c.block_id
         WHERE c.entry_id = ? AND c.deleted_at IS NULL`,
        [entryId]
      );
      return row.total;
    },

    /** Flat subtree rows (parents before children, root first) for archive/progress use. */
    getSubtreeEntries(driveId, entryId) {
      return all(
        db,
        `${SUBTREE_CTE} SELECT e.id, e.parent_id, e.kind, e.name, e.size_bytes FROM entries e JOIN subtree s ON e.id = s.id ORDER BY s.path ASC`,
        [driveId, entryId, driveId]
      );
    },

    /** Live siblings only: a trashed entry with the same name does not conflict. */
    async siblingCount(driveId, parentId, name) {
      const row = await get(
        db,
        'SELECT COUNT(*) AS c FROM entries WHERE drive_id = ? AND parent_id IS ? AND name = ? AND deleted_at IS NULL',
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

    // ---- trash (soft delete) ----
    listTrash(driveId) {
      return all(
        db,
        'SELECT * FROM entries WHERE drive_id = ? AND deleted_at IS NOT NULL ORDER BY deleted_at DESC, id DESC',
        [driveId]
      );
    },

    markSubtreeDeleted(driveId, entryId) {
      return run(
        db,
        `UPDATE entries SET deleted_at = ?, updated_at = ? WHERE drive_id = ? AND id IN (${SUBTREE_CTE} SELECT id FROM subtree)`,
        [nowIso(), nowIso(), driveId, driveId, entryId, driveId]
      );
    },

    clearSubtreeDeleted(driveId, entryId) {
      return run(
        db,
        `UPDATE entries SET deleted_at = NULL, updated_at = ? WHERE drive_id = ? AND id IN (${SUBTREE_CTE} SELECT id FROM subtree)`,
        [nowIso(), driveId, driveId, entryId, driveId]
      );
    },

    // ---- content_blocks ----
    getBlockByContentHash(driveId, contentHash) {
      return get(db, 'SELECT * FROM content_blocks WHERE drive_id = ? AND content_hash = ?', [driveId, contentHash]);
    },

    async insertBlock({ driveId, contentHash, messageId, webhookId, plainSizeBytes, cipherSizeBytes, nonce, authTag, compression }) {
      const now = nowIso();
      const res = await run(
        db,
        'INSERT INTO content_blocks (drive_id, content_hash, message_id, webhook_id, plain_size_bytes, cipher_size_bytes, nonce, auth_tag, compression, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [driveId, contentHash, messageId, webhookId, plainSizeBytes, cipherSizeBytes, nonce, authTag, compression, now]
      );
      return get(db, 'SELECT * FROM content_blocks WHERE id = ?', [res.lastID]);
    },

    /** Blocks in attachment order within one Discord message. */
    getBlocksByMessageId(messageId) {
      return all(db, 'SELECT * FROM content_blocks WHERE message_id = ? ORDER BY id ASC', [messageId]);
    },

    async countLiveBlockRefs(blockId) {
      const row = await get(db, 'SELECT COUNT(*) AS c FROM file_chunks WHERE block_id = ? AND deleted_at IS NULL', [
        blockId,
      ]);
      return row.c;
    },

    deleteBlock(id) {
      return run(db, 'DELETE FROM content_blocks WHERE id = ?', [id]);
    },

    /** Blocks referencing a webhook — nonzero blocks webhook removal. */
    async countBlocksForWebhook(webhookId) {
      const row = await get(db, 'SELECT COUNT(*) AS c FROM content_blocks WHERE webhook_id = ?', [webhookId]);
      return row.c;
    },

    // ---- file_chunks ----
    async insertChunk({ entryId, ordinal, blockId }) {
      const res = await run(db, 'INSERT INTO file_chunks (entry_id, ordinal, block_id) VALUES (?, ?, ?)', [
        entryId,
        ordinal,
        blockId,
      ]);
      return { id: res.lastID, entry_id: entryId, ordinal };
    },

    /** Join shape shared by every chunk read: chunk + block + webhook credential. */
    getChunksByEntry(entryId) {
      return all(
        db,
        `SELECT c.id, c.entry_id, c.ordinal, c.deleted_at,
                b.id AS block_id, b.message_id, b.content_hash AS checksum,
                b.plain_size_bytes, b.cipher_size_bytes, b.nonce, b.auth_tag, b.compression,
                w.id AS webhook_id, w.webhook_ciphertext, w.webhook_nonce, w.webhook_auth_tag
         FROM file_chunks c
         JOIN content_blocks b ON b.id = c.block_id
         JOIN webhooks w ON w.id = b.webhook_id
         WHERE c.entry_id = ?
         ORDER BY c.ordinal ASC`,
        [entryId]
      );
    },

    getPendingChunks(entryId) {
      return all(
        db,
        `SELECT c.id, c.entry_id, c.ordinal, c.deleted_at,
                b.id AS block_id, b.message_id, b.content_hash AS checksum,
                b.plain_size_bytes, b.cipher_size_bytes, b.nonce, b.auth_tag, b.compression,
                w.id AS webhook_id, w.webhook_ciphertext, w.webhook_nonce, w.webhook_auth_tag
         FROM file_chunks c
         JOIN content_blocks b ON b.id = c.block_id
         JOIN webhooks w ON w.id = b.webhook_id
         WHERE c.entry_id = ? AND c.deleted_at IS NULL
         ORDER BY c.ordinal ASC`,
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
