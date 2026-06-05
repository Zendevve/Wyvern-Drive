import { useRef, useCallback } from 'react';
import { useUploadsStore } from '../store/uploads';
import {
  createUploadSession,
  appendChunk,
  cancelSession as cancelRemoteSession,
  finalizeSession,
  getSessionOffset,
  chunkIdempotencyKey,
  RateLimitedError,
  type SessionState
} from '../api/uploadResumable';
import { runWithConcurrency } from '../lib/concurrency';

const DEFAULT_CHUNK_SIZE = 24 * 1024 * 1024; // 24 MiB
const RESUMABLE_THRESHOLD = 50 * 1024 * 1024; // 50 MB
const DEFAULT_PARALLEL = 4;
const MAX_RETRY_BACKOFF_MS = 30_000;
const RATE_LIMIT_BASE_BACKOFF_MS = 2_000;

export interface ResumableUploadOptions {
  parallel?: number;
  onProgress?: (bytesSent: number) => void;
}

export interface ResumableUploadResult {
  sessionId: string;
  chunks: Array<{ index: number; url: string; size: number }>;
  filename: string;
  mimeType: string;
  size: number;
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function useResumableUploader() {
  const abortControllers = useRef<Map<string, AbortController>>(new Map());

  const enqueue = useUploadsStore((s) => s.enqueue);
  const setStatus = useUploadsStore((s) => s.setStatus);
  const updateProgress = useUploadsStore((s) => s.updateProgress);
  const markDone = useUploadsStore((s) => s.markDone);
  const markError = useUploadsStore((s) => s.markError);
  const markCancelled = useUploadsStore((s) => s.markCancelled);
  const remove = useUploadsStore((s) => s.remove);

  const uploadResumable = useCallback(
    async (
      file: File,
      options: ResumableUploadOptions = {}
    ): Promise<ResumableUploadResult> => {
      if (file.size < RESUMABLE_THRESHOLD) {
        throw new Error('File below resumable threshold; use single-shot uploader');
      }

      const id = newId();
      const parallel = options.parallel ?? DEFAULT_PARALLEL;
      enqueue({ id, name: file.name, size: file.size });
      setStatus(id, 'uploading');
      const controller = new AbortController();
      abortControllers.current.set(id, controller);

      let session: SessionState | null = null;
      let startOffset = 0;
      let lastCreateError: unknown = null;

      try {
        session = await createUploadSession({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          totalSize: file.size,
          chunkSize: DEFAULT_CHUNK_SIZE
        });
      } catch (err) {
        lastCreateError = err;
      }

      if (!session) {
        const err = lastCreateError;
        markError(id, err instanceof Error ? err.message : 'create_session_failed');
        return Promise.reject(err instanceof Error ? err : new Error('create_session_failed'));
      }

      const totalChunks = Math.ceil(file.size / DEFAULT_CHUNK_SIZE);
      const completedChunks: Map<number, { index: number; url: string; size: number }> = new Map();
      const chunkIndexQueue: number[] = [];
      for (let i = 0; i < totalChunks; i++) {
        const chunkOffset = i * DEFAULT_CHUNK_SIZE;
        if (chunkOffset < startOffset) {
          continue;
        }
        chunkIndexQueue.push(i);
      }

      let bytesSent = startOffset;
      const updateBytes = (n: number) => {
        bytesSent = n;
        if (options.onProgress) options.onProgress(bytesSent);
        updateProgress(id, Math.round((bytesSent / file.size) * 100));
      };

      await runWithConcurrency(
        chunkIndexQueue.map((i) => ({ i })),
        parallel,
        async ({ i }) => {
          if (controller.signal.aborted) {
            throw new Error('aborted');
          }
          const offset = i * DEFAULT_CHUNK_SIZE;
          const end = Math.min(offset + DEFAULT_CHUNK_SIZE, file.size);
          const blob = file.slice(offset, end);
          const idemKey = chunkIdempotencyKey(session!.id, offset, i);
          let attempt = 0;
          let lastErr: unknown = null;
          while (attempt < 6) {
            if (controller.signal.aborted) throw new Error('aborted');
            try {
              const result = await appendChunk(
                session!.id,
                offset,
                blob,
                i,
                idemKey,
                { signal: controller.signal }
              );
              if (result.chunk) {
                completedChunks.set(i, result.chunk);
                updateBytes(end);
              }
              lastErr = null;
              break;
            } catch (err) {
              lastErr = err;
              if (controller.signal.aborted) throw new Error('aborted');
              if (err instanceof RateLimitedError) {
                const backoff = Math.min(
                  RATE_LIMIT_BASE_BACKOFF_MS * Math.pow(2, attempt),
                  MAX_RETRY_BACKOFF_MS
                );
                await new Promise((r) => setTimeout(r, Math.max(err.retryAfter * 1000, backoff)));
              } else {
                const backoff = Math.min(500 * Math.pow(2, attempt), 5_000);
                await new Promise((r) => setTimeout(r, backoff));
              }
              attempt++;
            }
          }
          if (lastErr) {
            throw lastErr;
          }
        }
      );

      if (controller.signal.aborted) {
        markCancelled(id);
        throw new Error('aborted');
      }

      try {
        await finalizeSession(session.id);
      } catch (err) {
        markError(id, err instanceof Error ? err.message : 'finalize_failed');
        throw err;
      }

      const sortedChunks = Array.from(completedChunks.entries())
        .sort(([a], [b]) => a - b)
        .map(([, v]) => v);

      markDone(id);
      return {
        sessionId: session.id,
        chunks: sortedChunks,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size
      };
    },
    [
      enqueue,
      setStatus,
      updateProgress,
      markDone,
      markError,
      markCancelled
    ]
  );

  const cancel = useCallback(async (id: string) => {
    const controller = abortControllers.current.get(id);
    if (controller) controller.abort();
    abortControllers.current.delete(id);
    remove(id);
  }, [remove]);

  const cancelRemote = useCallback(async (sessionId: string) => {
    try {
      await cancelRemoteSession(sessionId);
    } catch {
      // best effort
    }
  }, []);

  return { uploadResumable, cancel, cancelRemote };
}
