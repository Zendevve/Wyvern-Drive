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
  const downloadConcurrency = config.downloadConcurrency;
  // One Discord message holds up to ~24.5 MiB of attachment bytes; cap each
  // packed batch so a batch of chunkSizeBytes chunks always fits.
  const effectiveChunksPerMessage = Math.max(
    1,
    Math.min(config.chunksPerMessage, Math.floor((24.5 * 1024 * 1024) / chunkSizeBytes))
  );

  /** Fetch, decrypt, verify, and range-slice one chunk. */
  async function fetchDecryptSlice(row, from, to, drive, attachmentIndex) {
    let encrypted;
    try {
      encrypted = await discordStorage.getChunk(drive, row.discord_message_id, attachmentIndex);
    } catch (err) {
      if (err && err.code === 'STORAGE_UNAVAILABLE') throw err;
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Chunk fetch failed');
    }
    let plain;
    try {
      plain = decryptChunk(encrypted, encryptionKey, row.nonce, row.auth_tag);
    } catch (err) {
      throw new WyvernError('CHECKSUM_MISMATCH', 'Chunk decryption failed');
    }
    if (sha256hex(plain) !== row.checksum) {
      throw new WyvernError('CHECKSUM_MISMATCH', 'Chunk checksum mismatch');
    }
    if (from === 0 && to === plain.length - 1) return plain;
    return plain.subarray(from, to + 1);
  }

  /**
   * Parallel bounded-prefetch chunk stream: up to `downloadConcurrency` chunks
   * are fetched ahead of the yield cursor (never more than concurrency x chunk
   * size held in memory), yielded in ordinal order, each decrypted and
   * sha256-verified before it is yielded. With `range` { start, end } (inclusive
   * byte offsets) only the covering ordinals are fetched and the first/last
   * buffers are sliced.
   */
  function streamChunks(entry, drive, range) {
    return async function* stream() {
      const chunks = await repositories.getChunksByEntry(entry.id);

      // Packed uploads share one message id across a batch; the attachment
      // order within a message matches the ordinal order of the chunks that
      // were posted together, so a chunk's position inside its message group
      // selects the right attachment.
      const attachmentIndexByRowId = new Map();
      {
        const seenByMessage = new Map();
        for (const row of chunks) {
          const index = seenByMessage.get(row.discord_message_id) || 0;
          attachmentIndexByRowId.set(row.id, index);
          seenByMessage.set(row.discord_message_id, index + 1);
        }
      }

      const plan = [];
      if (range) {
        let cursor = 0;
        for (const row of chunks) {
          const chunkStart = cursor;
          const chunkEnd = cursor + row.plain_size_bytes - 1;
          cursor = chunkEnd + 1;
          if (chunkEnd < range.start || chunkStart > range.end) continue;
          plan.push({
            row,
            from: Math.max(0, range.start - chunkStart),
            to: Math.min(row.plain_size_bytes - 1, range.end - chunkStart),
          });
        }
      } else {
        for (const row of chunks) plan.push({ row, from: 0, to: row.plain_size_bytes - 1 });
      }

      const pending = new Map(); // plan index -> promise of the decrypted/sliced buffer
      let fetchIndex = 0;
      let yieldIndex = 0;
      try {
        while (yieldIndex < plan.length) {
          while (fetchIndex < plan.length && pending.size < downloadConcurrency) {
            const item = plan[fetchIndex];
            const promise = fetchDecryptSlice(item.row, item.from, item.to, drive, attachmentIndexByRowId.get(item.row.id));
            // Mark handled immediately so a rejection while this promise is
            // still in the prefetch map (waiting on an earlier chunk) never
            // surfaces as an unhandled rejection; the error still reaches the
            // consumer through await/allSettled below.
            promise.catch(() => {});
            pending.set(fetchIndex, promise);
            fetchIndex += 1;
          }
          const buffer = await pending.get(yieldIndex);
          pending.delete(yieldIndex);
          yieldIndex += 1;
          yield buffer;
        }
      } finally {
        // Observe any prefetched-but-unconsumed promises (a consumer may stop
        // early or an earlier chunk may fail) so their rejections never become
        // unhandled.
        const leftover = [...pending.values()];
        pending.clear();
        if (leftover.length > 0) await Promise.allSettled(leftover);
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

    async uploadFile({ drive, parentId, fileStream, filename, mimeType, uploadToken, expectedSizeBytes }) {
      validateName(filename);
      await resolveParent(repositories, drive, parentId);

      const token = typeof uploadToken === 'string' && uploadToken.length > 0 ? uploadToken : null;

      // A client upload token resumes the owning uploading/failed entry: the
      // row and its name are reused and only missing ordinals are posted. A
      // token bound to a ready entry (or no token at all) is a fresh upload.
      let entry = null;
      let resume = false;
      if (token) {
        const existing = await repositories.getEntryByUploadToken(drive.id, token);
        if (existing && existing.kind === 'file' && (existing.status === 'uploading' || existing.status === 'failed')) {
          entry = existing;
          resume = true;
        }
      }

      const usedBytes = await repositories.sumUsedBytes(drive.id);
      const finalName = resume ? entry.name : await this.uniqueSiblingName(drive.id, parentId, filename);

      const expectedSize =
        expectedSizeBytes !== undefined && expectedSizeBytes !== null && expectedSizeBytes !== ''
          ? Number(expectedSizeBytes)
          : NaN;
      const normalizedExpectedSize = Number.isInteger(expectedSize) && expectedSize >= 0 ? expectedSize : null;

      if (!resume) {
        try {
          entry = await repositories.insertEntry({
            driveId: drive.id,
            parentId,
            kind: 'file',
            name: finalName,
            sizeBytes: 0,
            mimeType: mimeType || 'application/octet-stream',
            status: 'uploading',
            uploadToken: token,
            expectedSizeBytes: normalizedExpectedSize,
          });
        } catch (err) {
          if (err && err.code) throw err;
          throw new WyvernError('UPLOAD_FAILED', 'Failed to create upload record');
        }
      }

      const skipOrdinals = new Set();
      if (resume) {
        const posted = await repositories.getPendingChunks(entry.id);
        for (const row of posted) skipOrdinals.add(row.ordinal);
      }

      let bytesRead = 0; // plaintext consumed from the stream (final size_bytes)
      let newBytes = 0; // plaintext newly posted this run (quota)
      let ordinal = 0;
      let batch = [];
      const inFlight = [];

      // Push the assembled batch to Discord, insert its chunk rows only after
      // the post succeeds, and apply upload backpressure: once `uploadConcurrency`
      // batches are in flight, wait for the oldest before reading more stream.
      const flush = () => {
        if (batch.length === 0) return Promise.resolve();
        const toPost = batch;
        batch = [];
        const promise = (async () => {
          const results = await discordStorage.putChunks(
            drive,
            toPost.map((chunk) => ({
              filename: `chunk-${chunk.ordinal}.bin`,
              encryptedBuffer: chunk.cipher,
              ordinal: chunk.ordinal,
            }))
          );
          const messageIdByOrdinal = new Map(results.map((r) => [r.ordinal, r.messageId]));
          for (const chunk of toPost) {
            await repositories.insertChunk({
              entryId: entry.id,
              ordinal: chunk.ordinal,
              messageId: messageIdByOrdinal.get(chunk.ordinal),
              plainSizeBytes: chunk.plain.length,
              cipherSizeBytes: chunk.cipher.length,
              nonce: chunk.nonce,
              authTag: chunk.authTag,
              checksum: chunk.checksum,
            });
          }
        })();
        // Mark handled immediately: a batch that rejects while other batches
        // are still draining must not surface as an unhandled rejection; the
        // error still propagates through the awaited oldest batch / final
        // Promise.all below.
        promise.catch(() => {});
        inFlight.push(promise);
        if (inFlight.length >= config.uploadConcurrency) {
          return inFlight.shift();
        }
        return Promise.resolve();
      };

      try {
        let pending = Buffer.alloc(0);
        for await (const data of fileStream) {
          pending = pending.length > 0 ? Buffer.concat([pending, data]) : data;
          while (pending.length >= chunkSizeBytes) {
            const chunk = pending.subarray(0, chunkSizeBytes);
            pending = pending.subarray(chunkSizeBytes);
            bytesRead += chunk.length;
            if (!skipOrdinals.has(ordinal)) {
              const { cipher, nonce, authTag } = encryptChunk(chunk, encryptionKey);
              newBytes += chunk.length;
              this.assertQuota(usedBytes, newBytes, drive.quota_bytes);
              batch.push({ plain: chunk, cipher, nonce, authTag, checksum: sha256hex(chunk), ordinal });
            }
            ordinal += 1;
            if (batch.length >= effectiveChunksPerMessage) await flush();
          }
        }
        if (pending.length > 0) {
          bytesRead += pending.length;
          if (!skipOrdinals.has(ordinal)) {
            const { cipher, nonce, authTag } = encryptChunk(pending, encryptionKey);
            newBytes += pending.length;
            this.assertQuota(usedBytes, newBytes, drive.quota_bytes);
            batch.push({ plain: pending, cipher, nonce, authTag, checksum: sha256hex(pending), ordinal });
          }
          ordinal += 1;
        }
        await flush();
        await Promise.all(inFlight);

        const ready = await repositories.updateEntry(entry.id, { size_bytes: bytesRead, status: 'ready' });
        return toEntryJson(ready);
      } catch (err) {
        // Keep the entry row and every posted chunk so the upload can resume;
        // just mark the entry failed. Drain in-flight batches so no promise
        // is left unobserved.
        await Promise.allSettled(inFlight);
        try {
          await repositories.updateEntry(entry.id, { status: 'failed' });
        } catch (updateErr) {
          // Row vanished mid-upload; nothing left to mark.
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

    async downloadFile({ drive, entryId, range }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id || entry.kind !== 'file' || entry.status !== 'ready') {
        throw httpError('NOT_FOUND');
      }
      const size = entry.size_bytes;
      if (!range) {
        return {
          name: entry.name,
          mimeType: entry.mime_type || 'application/octet-stream',
          sizeBytes: size,
          status: 200,
          stream: streamChunks(entry, drive),
        };
      }
      // Clamp inclusive byte offsets to the file; an unsatisfiable range (start
      // past EOF, end before start, or an empty file) falls back to a full 200.
      const start = Math.max(0, range.start);
      if (size === 0 || start >= size) {
        return {
          name: entry.name,
          mimeType: entry.mime_type || 'application/octet-stream',
          sizeBytes: size,
          status: 200,
          stream: streamChunks(entry, drive),
        };
      }
      const end = Math.min(size - 1, range.end);
      if (start > end) {
        return {
          name: entry.name,
          mimeType: entry.mime_type || 'application/octet-stream',
          sizeBytes: size,
          status: 200,
          stream: streamChunks(entry, drive),
        };
      }
      return {
        name: entry.name,
        mimeType: entry.mime_type || 'application/octet-stream',
        sizeBytes: size,
        status: 206,
        start,
        end,
        contentLength: end - start + 1,
        stream: streamChunks(entry, drive, { start, end }),
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
          // Chunks packed into one Discord message share its id; delete each
          // message once, then mark every chunk row it backed as deleted.
          const byMessageId = new Map();
          for (const chunk of chunks) {
            let group = byMessageId.get(chunk.discord_message_id);
            if (!group) {
              group = [];
              byMessageId.set(chunk.discord_message_id, group);
            }
            group.push(chunk);
          }
          for (const [messageId, group] of byMessageId) {
            await discordStorage.deleteChunk(drive, messageId);
            for (const chunk of group) {
              await repositories.markChunkDeleted(chunk.id);
            }
          }
        }
      } catch (err) {
        // Subtree stays in 'deleting' state; a later DELETE retries only the
        // chunks whose deleted_at is still NULL.
        throw new WyvernError('STORAGE_UNAVAILABLE', 'Remote chunk deletion failed');
      }
      await repositories.deleteRecursive(drive.id, entryId);
    },

    /** Upload progress for a resumable upload: status, bytes posted so far, declared total. */
    async getUploadProgress({ drive, entryId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');
      const postedBytes = await repositories.sumPlainBytesByEntry(entry.id);
      return {
        status: entry.status,
        postedBytes,
        expectedBytes: entry.expected_size_bytes != null ? entry.expected_size_bytes : null,
      };
    },

    /** Resolve an upload token to its entry's progress; NOT_FOUND when no entry matches. */
    async getUploadProgressByToken({ drive, uploadToken }) {
      const entry = await repositories.getEntryByUploadToken(drive.id, uploadToken);
      if (!entry) throw httpError('NOT_FOUND');
      return this.getUploadProgress({ drive, entryId: entry.id });
    },

    /** Flat pre-order subtree rows (parents before children, root first). */
    async getSubtreeEntries(drive, entryId) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');
      const rows = await repositories.getSubtreeEntries(drive.id, entryId);
      return rows.map((row) => ({
        id: row.id,
        parentId: row.parent_id,
        kind: row.kind,
        name: row.name,
        sizeBytes: row.size_bytes,
      }));
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
