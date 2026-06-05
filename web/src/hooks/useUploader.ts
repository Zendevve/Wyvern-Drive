import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { extractMessageIdFromUrl, uploadFile } from '../api/upload';
import { runWithConcurrency } from '../lib/concurrency';
import { useUploadsStore } from '../store/uploads';
import { newCorrelationId, recordAuditEvent, withAudit } from '../lib/auditMiddleware';
import { useResumableUploader } from './useResumableUploader';
import { computeAad, encryptChunk, generateDek, wrapDek } from '../lib/crypto';
import type { DekWrapMode } from '../components/UploadDialog';

const RESUMABLE_THRESHOLD = 50 * 1024 * 1024;
const PLAINTEXT_CHUNK_SIZE = 24 * 1024 * 1024;
const ENCRYPTED_CHUNK_PLAINTEXT = PLAINTEXT_CHUNK_SIZE - 28;

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const controllers = new Map<string, AbortController>();

export interface FileEncryptionOptions {
  enabled: boolean;
  wrapMode: DekWrapMode;
  masterKek?: CryptoKey;
  passphrase?: string;
}

export interface UseUploader {
  enqueueFiles: (
    files: FileList | File[],
    parentId: string | null,
    encryption?: FileEncryptionOptions
  ) => Promise<void>;
  cancel: (id: string) => void;
}

async function prepareEncryption(
  file: File,
  enc: FileEncryptionOptions,
  correlationId: string
): Promise<{
  dek: CryptoKey;
  wrappedDek: ArrayBuffer;
  fileId: string;
  chunks: Array<{ nonce: ArrayBuffer; tag: ArrayBuffer; index: number; plaintextLength: number; ciphertextOffset: number; ciphertextLength: number }>;
  blob: Blob;
  filename: string;
  size: number;
} | null> {
  if (!enc.enabled) return null;
  const fileId = newId();
  const dek = await generateDek();
  let wrappedDek: ArrayBuffer;
  if (enc.wrapMode === 'master') {
    if (!enc.masterKek) throw new Error('Master KEK not available for master-wrap mode');
    wrappedDek = await wrapDek(dek, enc.masterKek);
  } else {
    if (!enc.passphrase || enc.passphrase.length < 8) {
      throw new Error('Passphrase required (min 8 chars) for passphrase-wrap mode');
    }
    wrappedDek = new ArrayBuffer(0);
  }
  const parts: Uint8Array[] = [];
  const chunks: Array<{ nonce: ArrayBuffer; tag: ArrayBuffer; index: number; plaintextLength: number; ciphertextOffset: number; ciphertextLength: number }> = [];
  let runningOffset = 0;
  let index = 0;
  for (let offset = 0; offset < file.size; offset += ENCRYPTED_CHUNK_PLAINTEXT) {
    const end = Math.min(offset + ENCRYPTED_CHUNK_PLAINTEXT, file.size);
    const plainBuf = await file.slice(offset, end).arrayBuffer();
    const aad = await computeAad(fileId, index);
    const e = await encryptChunk(plainBuf, dek, aad);
    const blob = new Uint8Array(e.nonce.byteLength + e.ciphertext.byteLength + e.tag.byteLength);
    blob.set(e.nonce, 0);
    blob.set(new Uint8Array(e.ciphertext), e.nonce.byteLength);
    blob.set(e.tag, e.nonce.byteLength + e.ciphertext.byteLength);
    parts.push(blob);
    chunks.push({
      nonce: e.nonce.buffer as ArrayBuffer,
      tag: e.tag.buffer as ArrayBuffer,
      index,
      plaintextLength: end - offset,
      ciphertextOffset: runningOffset + e.nonce.byteLength,
      ciphertextLength: e.ciphertext.byteLength
    });
    runningOffset += blob.byteLength;
    index += 1;
  }
  const blob = new Blob(parts, { type: 'application/octet-stream' });
  void recordAuditEvent({
    action: 'file_encrypted',
    target_id: fileId,
    target_type: 'file',
    outcome: 'success',
    correlation_id: correlationId,
    metadata: {
      fileId,
      dekWrapMode: enc.wrapMode,
      chunkCount: chunks.length
    }
  });
  return {
    dek,
    wrappedDek,
    fileId,
    chunks,
    blob,
    filename: `${file.name}.enc`,
    size: blob.size
  };
}

export function useUploader(): UseUploader {
  const queryClient = useQueryClient();
  const enqueue = useUploadsStore((s) => s.enqueue);
  const setStatus = useUploadsStore((s) => s.setStatus);
  const updateProgress = useUploadsStore((s) => s.updateProgress);
  const markDone = useUploadsStore((s) => s.markDone);
  const markError = useUploadsStore((s) => s.markError);
  const markCancelled = useUploadsStore((s) => s.markCancelled);
  const remove = useUploadsStore((s) => s.remove);
  const resumable = useResumableUploader();

  async function enqueueFiles(
    files: FileList | File[],
    parentId: string | null,
    encryption?: FileEncryptionOptions
  ): Promise<void> {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const tasks = arr.map((file) => {
      const id = newId();
      enqueue({ id, name: file.name, size: file.size });
      return { id, file, parentId };
    });

    await runWithConcurrency(tasks, 3, async ({ id, file, parentId }) => {
      const correlationId = newCorrelationId();
      const controller = new AbortController();
      controllers.set(id, controller);
      setStatus(id, 'uploading');
      try {
        const enc = encryption?.enabled ? encryption : undefined;
        const prepared = enc
          ? await prepareEncryption(file, enc, correlationId)
          : null;
        if (file.size >= RESUMABLE_THRESHOLD) {
          await withAudit(
            { correlationId, targetType: 'file' },
            {
              action: 'upload',
              metadata: () => ({
                name: file.name,
                size_bytes: file.size,
                parent_id: parentId,
                mode: 'resumable',
                encrypted: prepared !== null
              })
            },
            async () => {
              const result = await resumable.uploadResumable(file, {
                onProgress: (bytes) => updateProgress(id, Math.round((bytes / file.size) * 100))
              });
              const chunks = result.chunks.map((c) => ({
                discordMessageId: extractMessageIdFromUrl(c.url),
                index: c.index,
                sizeBytes: c.size,
                cdnUrl: c.url
              }));
              const created = await apiFetch<{ node?: { id?: string }; node_id?: string }>(
                '/fs/file/created',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    name: file.name,
                    parent_id: parentId,
                    size_bytes: result.size,
                    mime_type: result.mimeType,
                    chunks,
                    ...(prepared
                      ? {
                          encryption: {
                            fileId: prepared.fileId,
                            wrapMode: prepared.chunks.length > 0 ? enc!.wrapMode : null,
                            wrappedDek: arrayBufferToBase64(prepared.wrappedDek),
                            chunks: prepared.chunks.map((c) => ({
                              index: c.index,
                              nonce: arrayBufferToBase64(c.nonce),
                              tag: arrayBufferToBase64(c.tag),
                              plaintextLength: c.plaintextLength
                            }))
                          }
                        }
                      : {})
                  })
                }
              );
              const nodeId = created?.node?.id ?? created?.node_id ?? null;
              await recordAuditEvent({
                action: 'upload',
                target_id: nodeId,
                target_type: 'file',
                outcome: 'success',
                correlation_id: correlationId,
                metadata: { phase: 'manifested', name: file.name, size_bytes: result.size, mode: 'resumable' }
              });
              return nodeId;
            }
          );
        } else {
          await withAudit(
            { correlationId, targetType: 'file' },
            {
              action: 'upload',
              metadata: () => ({
                name: file.name,
                size_bytes: file.size,
                parent_id: parentId,
                mode: 'single',
                encrypted: prepared !== null
              })
            },
            async () => {
              const { promise } = uploadFile(
                prepared ? new File([prepared.blob], prepared.filename, { type: 'application/octet-stream' }) : file,
                (pct) => updateProgress(id, pct),
                controller.signal
              );
              const result = await promise;
              const chunks = result.chunks.map((c) => ({
                discordMessageId: extractMessageIdFromUrl(c.url),
                index: c.index,
                sizeBytes: c.size,
                cdnUrl: c.url
              }));
              const created = await apiFetch<{ node?: { id?: string }; node_id?: string }>(
                '/fs/file/created',
                {
                  method: 'POST',
                  body: JSON.stringify({
                    name: file.name,
                    parent_id: parentId,
                    size_bytes: prepared ? prepared.size : result.size,
                    mime_type: prepared ? 'application/octet-stream' : (result.mimeType || file.type),
                    chunks,
                    ...(prepared
                      ? {
                          encryption: {
                            fileId: prepared.fileId,
                            wrapMode: enc!.wrapMode,
                            wrappedDek: arrayBufferToBase64(prepared.wrappedDek),
                            chunks: prepared.chunks.map((c) => ({
                              index: c.index,
                              nonce: arrayBufferToBase64(c.nonce),
                              tag: arrayBufferToBase64(c.tag),
                              plaintextLength: c.plaintextLength
                            }))
                          }
                        }
                      : {})
                  })
                }
              );
              const nodeId = created?.node?.id ?? created?.node_id ?? null;
              await recordAuditEvent({
                action: 'upload',
                target_id: nodeId,
                target_type: 'file',
                outcome: 'success',
                correlation_id: correlationId,
                metadata: { phase: 'manifested', name: file.name, size_bytes: result.size, mode: 'single' }
              });
              return nodeId;
            }
          );
        }
        markDone(id);
        queryClient.invalidateQueries({ queryKey: ['folder'] });
      } catch (err) {
        if (controller.signal.aborted) {
          markCancelled(id);
          await recordAuditEvent({
            action: 'upload',
            target_id: id,
            target_type: 'file',
            outcome: 'cancelled',
            correlation_id: correlationId,
            metadata: { name: file.name, size_bytes: file.size }
          });
        } else {
          const message = err instanceof Error ? err.message : 'Upload failed';
          markError(id, message);
        }
      } finally {
        controllers.delete(id);
      }
    });
  }

  function cancel(id: string): void {
    const controller = controllers.get(id);
    if (controller) {
      controller.abort();
    } else {
      remove(id);
    }
  }

  return { enqueueFiles, cancel };
}

export function __resetUploaderControllers(): void {
  controllers.clear();
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let s = '';
  for (let i = 0; i < bytes.byteLength; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}
