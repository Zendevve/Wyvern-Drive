'use strict';

const crypto = require('node:crypto');
const { WyvernError, httpError } = require('../errors');

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;

function sha256hex(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

function encryptChunk(plain, key) {
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, nonce);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  return { cipher: encrypted, nonce, authTag: cipher.getAuthTag() };
}

function decryptChunk(cipherBuffer, key, nonce, authTag) {
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, nonce);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(cipherBuffer), decipher.final()]);
}

function validateName(name) {
  if (typeof name !== 'string' || name.length === 0 || name.length > 255) {
    throw httpError('INVALID_NAME');
  }
  if (name === '.' || name === '..') throw httpError('INVALID_NAME');
  if (name.trim().length === 0) throw httpError('INVALID_NAME');
  if (name.includes('/') || name.includes('\\') || CONTROL_CHARS.test(name)) throw httpError('INVALID_NAME');
}

function toEntryJson(row) {
  return {
    id: row.id,
    parentId: row.parent_id,
    kind: row.kind,
    name: row.name,
    sizeBytes: row.size_bytes,
    mimeType: row.mime_type,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Auto-conflict suffix: "name (1).ext", "name (2).ext" (suffix inserted before
 * the last dot; bare names become "name (N)").
 */
function conflictSuffixName(name, n) {
  const dot = name.lastIndexOf('.');
  if (dot <= 0) return `${name} (${n})`;
  return `${name.slice(0, dot)} (${n})${name.slice(dot)}`;
}

/** Resolve the parent entry for a folder/file: root (null) or an owned ready folder. */
async function resolveParent(repositories, drive, parentId) {
  if (parentId == null) return null;
  const parent = await repositories.getEntryById(parentId);
  if (!parent || parent.drive_id !== drive.id) throw httpError('NOT_FOUND');
  if (parent.kind !== 'folder' || parent.status !== 'ready') throw httpError('INVALID_PARENT');
  return parent;
}

function hmacToken(key, shareId) {
  return crypto.createHmac('sha256', key).update(`wyvern-share:${shareId}`).digest('base64url');
}

/**
 * Share tokens are deterministically derived from the share id plus the master
 * key, so only sha256(token) needs to be persisted while plaintext tokens can
 * still be returned for copying by listShares.
 */
function buildShareToken(key, shareId) {
  return `${shareId}.${hmacToken(key, shareId)}`;
}

function parseShareToken(key, token) {
  if (typeof token !== 'string') return null;
  const dot = token.indexOf('.');
  if (dot <= 0 || dot === token.length - 1) return null;
  const idPart = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const shareId = Number(idPart);
  if (!Number.isInteger(shareId) || shareId <= 0) return null;
  const expected = Buffer.from(hmacToken(key, shareId));
  const actual = Buffer.from(sig);
  if (expected.length !== actual.length) return null;
  if (!crypto.timingSafeEqual(expected, actual)) return null;
  return shareId;
}

function createFileService({ db, repositories, discordStorage, config }) {
  const chunkSizeBytes = config.chunkSizeBytes;
  const encryptionKey = config.encryptionKey;

  function streamChunks(entry, drive) {
    return async function* stream() {
      const chunks = await repositories.getChunksByEntry(entry.id);
      for (const chunk of chunks) {
        let encrypted;
        try {
          encrypted = await discordStorage.getChunk(drive, chunk.discord_message_id);
        } catch (err) {
          if (err && err.code === 'STORAGE_UNAVAILABLE') throw err;
          throw new WyvernError('STORAGE_UNAVAILABLE', 'Chunk fetch failed');
        }
        let plain;
        try {
          plain = decryptChunk(encrypted, encryptionKey, chunk.nonce, chunk.auth_tag);
        } catch (err) {
          throw new WyvernError('CHECKSUM_MISMATCH', 'Chunk decryption failed');
        }
        if (sha256hex(plain) !== chunk.checksum) {
          throw new WyvernError('CHECKSUM_MISMATCH', 'Chunk checksum mismatch');
        }
        yield plain;
      }
    };
  }

  return {
    async listEntries({ drive, parentId, query, kind, sort, direction }) {
      await resolveParent(repositories, drive, parentId);
      const normalizedSort = ['name', 'size', 'createdAt', 'updatedAt'].includes(sort) ? sort : 'name';
      const normalizedDirection = direction === 'desc' ? 'desc' : 'asc';
      const normalizedKind = ['file', 'folder', 'all'].includes(kind) ? kind : 'all';
      const rows = await repositories.listEntries(drive.id, {
        parentId,
        query: typeof query === 'string' ? query : '',
        kind: normalizedKind,
        sort: normalizedSort,
        direction: normalizedDirection,
      });
      return rows.map(toEntryJson);
    },

    async createFolder({ drive, parentId, name }) {
      validateName(name);
      await resolveParent(repositories, drive, parentId);
      if ((await repositories.siblingCount(drive.id, parentId, name)) > 0) {
        throw httpError('NAME_CONFLICT');
      }
      const row = await repositories.insertEntry({
        driveId: drive.id,
        parentId,
        kind: 'folder',
        name,
        sizeBytes: 0,
        mimeType: null,
        status: 'ready',
      });
      return toEntryJson(row);
    },

    async uploadFile({ drive, parentId, fileStream, filename, mimeType }) {
      validateName(filename);
      await resolveParent(repositories, drive, parentId);

      const usedBytes = await repositories.sumReadyBytes(drive.id);
      const finalName = await this.uniqueSiblingName(drive.id, parentId, filename);

      let entry;
      try {
        entry = await repositories.insertEntry({
          driveId: drive.id,
          parentId,
          kind: 'file',
          name: finalName,
          sizeBytes: 0,
          mimeType: mimeType || 'application/octet-stream',
          status: 'uploading',
        });
      } catch (err) {
        if (err && err.code) throw err;
        throw new WyvernError('UPLOAD_FAILED', 'Failed to create upload record');
      }

      let bytesRead = 0;
      let ordinal = 0;
      const sentMessageIds = [];

      try {
        let pending = Buffer.alloc(0);
        for await (const data of fileStream) {
          pending = pending.length > 0 ? Buffer.concat([pending, data]) : data;
          while (pending.length >= chunkSizeBytes) {
            const chunk = pending.subarray(0, chunkSizeBytes);
            pending = pending.subarray(chunkSizeBytes);
            bytesRead += chunk.length;
            this.assertQuota(usedBytes, bytesRead, drive.quota_bytes);
            const messageId = await this.putEncryptedChunk(entry.id, drive, chunk, ordinal);
            sentMessageIds.push(messageId);
            ordinal += 1;
          }
        }
        if (pending.length > 0) {
          bytesRead += pending.length;
          this.assertQuota(usedBytes, bytesRead, drive.quotaBytes);
          const messageId = await this.putEncryptedChunk(entry.id, drive, pending, ordinal);
          sentMessageIds.push(messageId);
          ordinal += 1;
        }

        const ready = await repositories.updateEntry(entry.id, { size_bytes: bytesRead, status: 'ready' });
        return toEntryJson(ready);
      } catch (err) {
        try {
          for (const messageId of sentMessageIds) {
            await discordStorage.deleteChunk(drive, messageId);
          }
          await repositories.deleteEntryById(entry.id);
        } catch (cleanupErr) {
          // Remote cleanup itself failed: keep the row for operator/retry
          // cleanup and make sure it is never listable.
          await repositories.updateEntry(entry.id, { status: 'failed' });
        }
        if (err && err.code) throw err;
        throw new WyvernError('UPLOAD_FAILED', 'Upload failed');
      }
    },

    assertQuota(usedBytes, bytesRead, quotaBytes) {
      if (usedBytes + bytesRead > quotaBytes) {
        throw new WyvernError('QUOTA_EXCEEDED', 'Quota exceeded', 413);
      }
    },

    async uniqueSiblingName(driveId, parentId, name) {
      if ((await repositories.siblingCount(driveId, parentId, name)) === 0) return name;
      let n = 1;
      while ((await repositories.siblingCount(driveId, parentId, conflictSuffixName(name, n))) > 0) {
        n += 1;
      }
      return conflictSuffixName(name, n);
    },

    async putEncryptedChunk(entryId, drive, plain, ordinal) {
      const { cipher, nonce, authTag } = encryptChunk(plain, encryptionKey);
      const checksum = sha256hex(plain);
      const messageId = await discordStorage.putChunk(drive, `chunk-${ordinal}.bin`, cipher);
      await repositories.insertChunk({
        entryId,
        ordinal,
        messageId,
        plainSizeBytes: plain.length,
        cipherSizeBytes: cipher.length,
        nonce,
        authTag,
        checksum,
      });
      return messageId;
    },

    async downloadFile({ drive, entryId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id || entry.kind !== 'file' || entry.status !== 'ready') {
        throw httpError('NOT_FOUND');
      }
      return {
        name: entry.name,
        mimeType: entry.mime_type || 'application/octet-stream',
        sizeBytes: entry.size_bytes,
        stream: streamChunks(entry, drive),
      };
    },

    async renameEntry({ drive, entryId, name }) {
      validateName(name);
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');
      if (name !== entry.name) {
        if ((await repositories.siblingCount(drive.id, entry.parent_id, name)) > 0) {
          throw httpError('NAME_CONFLICT');
        }
      }
      const updated = await repositories.updateEntry(entry.id, { name });
      return toEntryJson(updated);
    },

    async moveEntry({ drive, entryId, parentId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');

      if (parentId != null) {
        const destination = await repositories.getEntryById(parentId);
        if (!destination || destination.drive_id !== drive.id) throw httpError('NOT_FOUND');
        if (destination.kind !== 'folder' || destination.status !== 'ready') throw httpError('INVALID_PARENT');
        if (parentId === entry.id) throw httpError('INVALID_MOVE');
        const subtree = await repositories.subtreeEntryIds(drive.id, entry.id);
        if (subtree.some((r) => r.id === parentId)) throw httpError('INVALID_MOVE');
      }

      const targetParent = parentId != null ? parentId : null;
      if (targetParent !== entry.parent_id) {
        if ((await repositories.siblingCount(drive.id, targetParent, entry.name)) > 0) {
          throw httpError('NAME_CONFLICT');
        }
      }
      const updated = await repositories.updateEntry(entry.id, { parent_id: targetParent });
      return toEntryJson(updated);
    },

    async deleteEntry({ drive, entryId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');

      await repositories.markSubtreeDeleting(drive.id, entryId);
      const fileRows = await repositories.getSubtreeFiles(drive.id, entryId);
      try {
        for (const fileRow of fileRows) {
          const chunks = await repositories.getPendingChunks(fileRow.id);
          for (const chunk of chunks) {
            await discordStorage.deleteChunk(drive, chunk.discord_message_id);
            await repositories.markChunkDeleted(chunk.id);
          }
        }
      } catch (err) {
        // Subtree stays in 'deleting' state; a later DELETE retries only the
        // chunks whose deleted_at is still NULL.
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Remote chunk deletion failed');
      }
      await repositories.deleteRecursive(drive.id, entryId);
    },

    async createShare({ drive, entryId, expiresAt }) {
      let normalizedExpiry = null;
      if (expiresAt != null && expiresAt !== '') {
        const parsed = Date.parse(expiresAt);
        if (Number.isNaN(parsed)) throw httpError('INVALID_DATE');
        normalizedExpiry = new Date(parsed).toISOString();
      }
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');
      if (entry.kind !== 'file' || entry.status !== 'ready') throw httpError('FORBIDDEN');

      const placeholder = crypto.randomBytes(32).toString('hex');
      const row = await repositories.insertShare({
        entryId: entry.id,
        tokenHash: placeholder,
        createdBy: drive.owner_id,
        expiresAt: normalizedExpiry,
      });
      const token = buildShareToken(encryptionKey, row.id);
      await repositories.updateShareTokenHash(row.id, crypto.createHash('sha256').update(token).digest('hex'));

      return {
        id: row.id,
        token,
        url: `${config.appOrigin}/share/${token}`,
        expiresAt: row.expires_at,
        revokedAt: null,
        createdAt: row.created_at,
      };
    },

    async listShares({ drive, entryId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id || entry.kind !== 'file') throw httpError('NOT_FOUND');
      const rows = await repositories.listSharesByEntry(entry.id);
      return rows.map((row) => {
        const token = buildShareToken(encryptionKey, row.id);
        return {
          id: row.id,
          token,
          url: `${config.appOrigin}/share/${token}`,
          createdAt: row.created_at,
          expiresAt: row.expires_at,
          revokedAt: row.revoked_at,
        };
      });
    },

    async revokeShare({ drive, shareId }) {
      const share = await repositories.getShareById(shareId);
      if (!share) throw httpError('NOT_FOUND');
      const entry = await repositories.getEntryById(share.entry_id);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');
      await repositories.revokeShare(share.id);
    },

    /** Public read of share metadata; identical 404 for every invalid share. */
    async readShare(token) {
      const shareId = parseShareToken(encryptionKey, token);
      if (shareId == null) throw httpError('SHARE_NOT_FOUND');
      const hash = crypto.createHash('sha256').update(token).digest('hex');
      const share = await repositories.getShareByTokenHash(hash);
      if (!share) throw httpError('SHARE_NOT_FOUND');
      if (share.revoked_at) throw httpError('SHARE_NOT_FOUND');
      if (share.expires_at && Date.parse(share.expires_at) <= Date.now()) throw httpError('SHARE_NOT_FOUND');
      const entry = await repositories.getEntryById(share.entry_id);
      if (!entry || entry.kind !== 'file' || entry.status !== 'ready') throw httpError('SHARE_NOT_FOUND');
      return {
        entry,
        name: entry.name,
        sizeBytes: entry.size_bytes,
        mimeType: entry.mime_type || 'application/octet-stream',
        expiresAt: share.expires_at,
      };
    },

    /** Public share file stream, same download semantics without a session. */
    async streamShareFile(token) {
      const meta = await this.readShare(token);
      const drive = await repositories.getDriveById(meta.entry.drive_id);
      return {
        name: meta.name,
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        stream: streamChunks(meta.entry, drive),
      };
    },
  };
}

module.exports = { createFileService };
