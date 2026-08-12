'use strict';

const crypto = require('node:crypto');
const zlib = require('node:zlib');
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
    deletedAt: row.deleted_at != null ? row.deleted_at : null,
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
  // Compress chunks before encryption when enabled (default on); the block
  // content hash covers the compressed bytes, so dedup still works.
  const compressEnabled = config.compressChunks !== false;
  const trashRetentionDays = config.trashRetentionDays != null ? config.trashRetentionDays : 30;
  const maxWebhooksPerDrive = config.maxWebhooksPerDrive != null ? config.maxWebhooksPerDrive : 8;
  // One Discord message holds up to ~24.5 MiB of attachment bytes; cap each
  // packed batch so a batch of chunkSizeBytes chunks always fits.
  const effectiveChunksPerMessage = Math.max(
    1,
    Math.min(config.chunksPerMessage, Math.floor((24.5 * 1024 * 1024) / chunkSizeBytes))
  );
  // Round-robin position per drive across its webhooks (persists across
  // uploads so traffic keeps spreading evenly).
  const webhookCursors = new Map();
  // Serialize upload-vs-cancel per upload token (and purge per entry): the
  // cancel endpoint must never interleave with an upload's flush so partial
  // chunks/blocks can't be orphaned or a committed entry wiped.
  const entryLocks = new Map(); // key -> promise chain tail
  function withEntryLock(key, fn) {
    const prev = entryLocks.get(key) || Promise.resolve();
    const run = prev.then(fn);
    const tail = run.catch(() => {});
    entryLocks.set(key, tail);
    tail.then(() => { if (entryLocks.get(key) === tail) entryLocks.delete(key); });
    return run;
  }

  /**
   * Fetch, decrypt, hash-verify, decompress, and range-slice one chunk. The
   * content_hash covers the pre-encryption stored bytes (the deflated form
   * when compression is on), so verification runs before any decompression.
   */
  async function fetchDecryptSlice(row, from, to, attachmentIndex) {
    const webhook = {
      id: row.webhook_id,
      webhook_ciphertext: row.webhook_ciphertext,
      webhook_nonce: row.webhook_nonce,
      webhook_auth_tag: row.webhook_auth_tag,
    };
    let encrypted;
    try {
      encrypted = await discordStorage.getChunk(webhook, row.message_id, attachmentIndex);
    } catch (err) {
      if (err && err.code === 'STORAGE_UNAVAILABLE') throw err;
      throw new WyvernError('STORAGE_UNAVAILABLE', 'Chunk fetch failed');
    }
    let stored;
    try {
      stored = decryptChunk(encrypted, encryptionKey, row.nonce, row.auth_tag);
    } catch (err) {
      throw new WyvernError('CHECKSUM_MISMATCH', 'Chunk decryption failed');
    }
    if (sha256hex(stored) !== row.checksum) {
      throw new WyvernError('CHECKSUM_MISMATCH', 'Chunk checksum mismatch');
    }
    let plain;
    try {
      plain = row.compression === 'deflate' ? zlib.inflateSync(stored) : stored;
    } catch (err) {
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

      // Attachment order within a message = block id order (blocks are
      // inserted in attachment order when their batch is posted). Resolve
      // each referenced block to its position inside its message via
      // getBlocksByMessageId, which covers every block of the message, so
      // indexes stay correct when a message is shared with other entries
      // (dedup/copy).
      const attachmentIndexByBlockId = new Map();
      {
        const messages = new Set(chunks.map((row) => row.message_id));
        for (const messageId of messages) {
          const blocks = await repositories.getBlocksByMessageId(messageId);
          blocks.forEach((block, index) => attachmentIndexByBlockId.set(block.id, index));
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
            const promise = fetchDecryptSlice(
              item.row,
              item.from,
              item.to,
              attachmentIndexByBlockId.get(item.row.block_id)
            );
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
      const search = typeof query === 'string' && query.length > 0;
      // Global search spans the whole drive; the folder-scope resolution is
      // skipped so a stale/unknown parentId can never 404 a search.
      if (!search) {
        await resolveParent(repositories, drive, parentId);
      }
      const normalizedSort = ['name', 'size', 'createdAt', 'updatedAt'].includes(sort) ? sort : 'name';
      const normalizedDirection = direction === 'desc' ? 'desc' : 'asc';
      const normalizedKind = ['file', 'folder', 'all'].includes(kind) ? kind : 'all';
      const rows = await repositories.listEntries(drive.id, {
        parentId,
        query: typeof query === 'string' ? query : '',
        search,
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

      // From entry resolution through the final ready/failed marker, the body
      // below is serialized per upload token so the cancel endpoint can never
      // interleave with an upload's flush: a cancel either runs before any
      // chunk is posted or after the entry committed or marked failed.
      const runUpload = async () => {
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
        let newBytes = 0; // plaintext newly posted this run (quota; dedup/skips excluded)
        let ordinal = 0;
        const inFlight = [];
        const pendingByWebhook = new Map(); // webhook.id -> { webhook, chunks: [] }
        let webhookList = null; // refreshed once per uploadFile call, on first miss
        let cursor = webhookCursors.get(drive.id) || 0;

        /** Round-robin webhook for a fresh block; STORAGE_UNAVAILABLE when none. */
        const nextWebhook = async () => {
          if (webhookList === null) {
            webhookList = await repositories.listWebhooks(drive.id);
            if (webhookList.length === 0) {
              throw new WyvernError('STORAGE_UNAVAILABLE', 'Drive has no configured webhooks');
            }
          }
          const webhook = webhookList[cursor % webhookList.length];
          cursor += 1;
          webhookCursors.set(drive.id, cursor);
          return webhook;
        };

        /**
         * Post one webhook's pending batch to Discord and insert its block +
         * chunk rows only after the post succeeds. Apply upload backpressure:
         * once `uploadConcurrency` batches are in flight, wait for the oldest
         * before reading more stream.
         */
        const flushWebhook = (webhookId) => {
          const holder = pendingByWebhook.get(webhookId);
          if (!holder || holder.chunks.length === 0) return Promise.resolve();
          const toPost = holder.chunks;
          holder.chunks = [];
          const promise = (async () => {
            const results = await discordStorage.putChunks(
              holder.webhook,
              toPost.map((chunk) => ({
                filename: `chunk-${chunk.ordinal}.bin`,
                encryptedBuffer: chunk.cipher,
                ordinal: chunk.ordinal,
              }))
            );
            const messageIdByOrdinal = new Map(results.map((r) => [r.ordinal, r.messageId]));
            for (const chunk of toPost) {
              const block = await repositories.insertBlock({
                driveId: drive.id,
                contentHash: chunk.checksum,
                messageId: messageIdByOrdinal.get(chunk.ordinal),
                webhookId: holder.webhook.id,
                plainSizeBytes: chunk.plain.length,
                cipherSizeBytes: chunk.cipher.length,
                nonce: chunk.nonce,
                authTag: chunk.authTag,
                compression: compressEnabled ? 'deflate' : 'none',
              });
              await repositories.insertChunk({ entryId: entry.id, ordinal: chunk.ordinal, blockId: block.id });
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

        /**
         * One plaintext chunk: identical content already stored for this drive
         * reuses its block with no Discord I/O; a miss is encrypted and batched
         * to its round-robin webhook. Dedup hits and skipped ordinals count
         * toward size_bytes but never toward newBytes/quota.
         */
        const processChunk = async (plain, ordinal) => {
          const stored = compressEnabled ? zlib.deflateSync(plain) : plain;
          const contentHash = sha256hex(stored);
          const existing = await repositories.getBlockByContentHash(drive.id, contentHash);
          if (existing) {
            await repositories.insertChunk({ entryId: entry.id, ordinal, blockId: existing.id });
            return;
          }
          const webhook = await nextWebhook();
          const { cipher, nonce, authTag } = encryptChunk(stored, encryptionKey);
          newBytes += plain.length;
          this.assertQuota(usedBytes, newBytes, drive.quota_bytes);
          let holder = pendingByWebhook.get(webhook.id);
          if (!holder) {
            holder = { webhook, chunks: [] };
            pendingByWebhook.set(webhook.id, holder);
          }
          holder.chunks.push({ plain, cipher, nonce, authTag, checksum: contentHash, ordinal });
          if (holder.chunks.length >= effectiveChunksPerMessage) {
            await flushWebhook(webhook.id);
          }
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
                await processChunk(chunk, ordinal);
              }
              ordinal += 1;
            }
          }
          if (pending.length > 0) {
            bytesRead += pending.length;
            if (!skipOrdinals.has(ordinal)) {
              await processChunk(pending, ordinal);
            }
            ordinal += 1;
          }
          // Flush each webhook's remaining batch, then drain every in-flight post.
          for (const webhookId of pendingByWebhook.keys()) {
            await flushWebhook(webhookId);
          }
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

      };

      return token ? withEntryLock('upload:' + token, runUpload) : runUpload();
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
      if (
        !entry ||
        entry.drive_id !== drive.id ||
        entry.kind !== 'file' ||
        entry.status !== 'ready' ||
        entry.deleted_at != null
      ) {
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

    /**
     * Soft delete: the subtree is hidden and counted as trash; its chunks and
     * Discord messages stay until the entry is purged from the trash.
     */
    async deleteEntry({ drive, entryId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');

      await repositories.markSubtreeDeleted(drive.id, entryId);
    },

    /**
     * Hard delete with block refcounting (the trash "delete forever" path).
     * A Discord message is deleted only when every block it backs becomes
     * dead (no live chunk-row references anywhere); a message shared with
     * another entry survives and only this entry's rows are dropped. On
     * error the subtree stays 'deleting' and a later purge retries only the
     * rows whose deleted_at is still NULL.
     */
    async purgeEntry({ drive, entryId }) {
      // Defense in depth: serialize purges per entry id so a purge never
      // interleaves with an upload or another purge on the same subtree.
      await withEntryLock('entry:' + entryId, async () => {
        const entry = await repositories.getEntryById(entryId);
        if (!entry || entry.drive_id !== drive.id) throw httpError('NOT_FOUND');

        await repositories.markSubtreeDeleting(drive.id, entryId);
        const deadBlocks = new Set();
        const fileRows = await repositories.getSubtreeFiles(drive.id, entryId);
        try {
          for (const fileRow of fileRows) {
            const chunks = await repositories.getPendingChunks(fileRow.id);
            // Rows packed into one Discord message share its id and webhook;
            // group them so the message is deleted exactly when every block it
            // backs is dead.
            const byMessageId = new Map();
            for (const chunk of chunks) {
              let group = byMessageId.get(chunk.message_id);
              if (!group) {
                group = [];
                byMessageId.set(chunk.message_id, group);
              }
              group.push(chunk);
            }
            for (const [messageId, group] of byMessageId) {
              const refsByBlock = new Map();
              for (const chunk of group) {
                refsByBlock.set(chunk.block_id, (refsByBlock.get(chunk.block_id) || 0) + 1);
              }
              // Block liveness after this entry's rows for the message go away.
              let allDead = true;
              for (const [blockId, ownRefs] of refsByBlock) {
                const liveRefs = await repositories.countLiveBlockRefs(blockId);
                if (liveRefs - ownRefs > 0) {
                  allDead = false;
                  break;
                }
              }
              const webhook = {
                id: group[0].webhook_id,
                webhook_ciphertext: group[0].webhook_ciphertext,
                webhook_nonce: group[0].webhook_nonce,
                webhook_auth_tag: group[0].webhook_auth_tag,
              };
              if (allDead) {
                await discordStorage.deleteChunk(webhook, messageId);
                for (const chunk of group) {
                  await repositories.markChunkDeleted(chunk.id);
                }
                for (const blockId of refsByBlock.keys()) {
                  deadBlocks.add(blockId);
                }
              } else {
                // Shared with another entry: the message stays; drop only this
                // entry's rows so the other entry keeps its blocks.
                for (const chunk of group) {
                  await repositories.markChunkDeleted(chunk.id);
                }
              }
            }
          }
        } catch (err) {
          // Subtree stays in 'deleting' state; a later purge retries only the
          // chunks whose deleted_at is still NULL.
          throw new WyvernError('STORAGE_UNAVAILABLE', 'Remote chunk deletion failed');
        }
        await repositories.deleteRecursive(drive.id, entryId);
        // Block rows drop only after their referencing chunk rows are gone (the
        // recursive delete cascades them away); FK enforcement forbids earlier.
        for (const blockId of deadBlocks) {
          await repositories.deleteBlock(blockId);
        }

      });
    },

    /**
     * Cancel a resumable upload: hard-purge the partial entry plus its posted
     * chunks and Discord messages. Runs under the same per-token lock as
     * uploadFile, so it can never interleave with an in-flight flush: a
     * committed entry is seen as ready and 404s; a failed upload has already
     * drained and marked every posted chunk, which the purge then removes.
     */
    async cancelUpload({ drive, uploadToken }) {
      await withEntryLock('upload:' + uploadToken, async () => {
        const entry = await repositories.getEntryByUploadToken(drive.id, uploadToken);
        if (!entry || (entry.status !== 'uploading' && entry.status !== 'failed')) {
          throw httpError('NOT_FOUND');
        }
        await this.purgeEntry({ drive, entryId: entry.id });
      });
    },

    /** Trashed entries, most recently deleted first. */
    async listTrash({ drive }) {
      const rows = await repositories.listTrash(drive.id);
      return { entries: rows.map(toEntryJson) };
    },

    /**
     * Restore a trashed entry: clears the subtree's deleted_at, re-homes the
     * entry to the drive root when its parent is deleted or gone, and
     * auto-suffixes the name against live siblings. The conflict check runs
     * while the entry is still deleted so it never counts as its own sibling.
     */
    async restoreEntry({ drive, entryId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id || entry.deleted_at == null) throw httpError('NOT_FOUND');

      let parentId = entry.parent_id;
      if (parentId != null) {
        const parent = await repositories.getEntryById(parentId);
        if (!parent || parent.drive_id !== drive.id || parent.deleted_at != null) {
          parentId = null;
        }
      }
      const finalName = await this.uniqueSiblingName(drive.id, parentId, entry.name);
      await repositories.clearSubtreeDeleted(drive.id, entryId);
      const updated = await repositories.updateEntry(entry.id, { parent_id: parentId, name: finalName });
      return toEntryJson(updated);
    },

    /**
     * Lazy trash sweep: purge trashed ROOT entries older than the retention
     * window. Children of a trashed entry age out with their root, so only
     * roots are considered.
     */
    async purgeExpiredTrash({ drive, now }) {
      const timestamp = now !== undefined && now !== null ? now : Date.now();
      const cutoff = timestamp - trashRetentionDays * 24 * 60 * 60 * 1000;
      const trashed = await repositories.listTrash(drive.id);
      const trashedIds = new Set(trashed.map((row) => row.id));
      for (const row of trashed) {
        if (row.parent_id != null && trashedIds.has(row.parent_id)) continue;
        if (Date.parse(row.deleted_at) < cutoff) {
          try {
            await this.purgeEntry({ drive, entryId: row.id });
          } catch (err) {
            // One failing entry must not abort the sweep for the rest of the
            // trash: log and move on to the next trashed root.
            console.error(`purgeExpiredTrash: failed to purge entry ${row.id}: ${err && err.message}`);
            continue;
          }
        }
      }
    },

    /**
     * Copy a live entry to a live ready folder (or root). Files reuse their
     * blocks (chunk rows reference the same content_blocks — instant, no
     * Discord I/O); folders recurse into their ready children.
     */
    async copyEntry({ drive, entryId, parentId }) {
      const entry = await repositories.getEntryById(entryId);
      if (!entry || entry.drive_id !== drive.id || entry.deleted_at != null) throw httpError('NOT_FOUND');

      await resolveParent(repositories, drive, parentId);
      if (parentId != null) {
        if (parentId === entry.id) throw httpError('INVALID_MOVE');
        const subtree = await repositories.subtreeEntryIds(drive.id, entry.id);
        if (subtree.some((r) => r.id === parentId)) throw httpError('INVALID_MOVE');
      }
      const finalName = await this.uniqueSiblingName(drive.id, parentId, entry.name);

      const copySubtree = async (source, targetParentId, targetName) => {
        const row = await repositories.insertEntry({
          driveId: drive.id,
          parentId: targetParentId,
          kind: source.kind,
          name: targetName,
          sizeBytes: source.kind === 'file' ? source.size_bytes : 0,
          mimeType: source.mime_type,
          status: source.status === 'uploading' ? 'failed' : source.status,
          uploadToken: null,
          expectedSizeBytes: null,
        });
        if (source.kind === 'file') {
          const chunks = await repositories.getChunksByEntry(source.id);
          for (const chunk of chunks) {
            if (chunk.deleted_at != null) continue;
            await repositories.insertChunk({ entryId: row.id, ordinal: chunk.ordinal, blockId: chunk.block_id });
          }
        } else {
          const children = await repositories.listEntries(drive.id, {
            parentId: source.id,
            query: '',
            kind: 'all',
            sort: 'name',
            direction: 'asc',
          });
          for (const child of children) {
            await copySubtree(child, row.id, child.name);
          }
        }
        return row;
      };

      const copied = await copySubtree(entry, parentId, finalName);
      return toEntryJson(copied);
    },

    /** Validate + seal a webhook URL and persist it for the drive. */
    async addWebhook({ drive, webhookUrl }) {
      const count = await repositories.countWebhooks(drive.id);
      if (count >= maxWebhooksPerDrive) {
        throw new WyvernError('WEBHOOK_LIMIT', 'Webhook limit reached for this drive', 409);
      }
      const sealed = await discordStorage.validateAndSealWebhook(webhookUrl);
      const row = await repositories.insertWebhook({
        driveId: drive.id,
        webhookCiphertext: sealed.webhook_ciphertext,
        webhookNonce: sealed.webhook_nonce,
        webhookAuthTag: sealed.webhook_auth_tag,
      });
      return { id: row.id, createdAt: row.created_at };
    },

    async listWebhooks({ drive }) {
      const rows = await repositories.listWebhooks(drive.id);
      return { webhooks: rows.map((row) => ({ id: row.id, createdAt: row.created_at })) };
    },

    /** Remove a webhook that no stored block references. */
    async removeWebhook({ drive, webhookId }) {
      const webhook = await repositories.getWebhookById(webhookId);
      if (!webhook || webhook.drive_id !== drive.id) throw httpError('NOT_FOUND');
      const blockCount = await repositories.countBlocksForWebhook(webhook.id);
      if (blockCount > 0) {
        throw new WyvernError('WEBHOOK_IN_USE', 'Webhook is in use by stored content', 409);
      }
      await repositories.deleteWebhook(webhook.id);
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
      if (!entry || entry.kind !== 'file' || entry.status !== 'ready' || entry.deleted_at != null) {
        throw httpError('SHARE_NOT_FOUND');
      }
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
