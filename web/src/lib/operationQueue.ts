import { apiFetch } from './api';
import { useQueueStore } from '../store/queue';
import {
  saveOperation,
  listPendingOrInFlight,
  type QueueOperation
} from './queueDb';
import {
  createUploadSession,
  appendChunk,
  finalizeSession,
  getSessionOffset,
  chunkIdempotencyKey,
  RateLimitedError
} from '../api/uploadResumable';
import { uploadFile, extractMessageIdFromUrl } from '../api/upload';
import { recordAuditEvent } from './audit';

class OperationQueueManager {
  private runningCount = 0;
  private queryClient: any = null;
  private isOnline = true;
  private isInitialized = false;

  setQueryClient(qc: any): void {
    this.queryClient = qc;
  }

  async init(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // 1. Set online listener
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine;
      window.addEventListener('online', () => {
        this.isOnline = true;
        void this.drain();
      });
      window.addEventListener('offline', () => {
        this.isOnline = false;
      });
      // Hybrid poll every 15 seconds
      setInterval(() => {
        void this.checkOnlineStatus();
      }, 15000);
    }

    // 2. Load pending and in-flight from DB into Zustand
    const unfinished = await listPendingOrInFlight();
    // Reset any in_flight operation to pending (crash recovery)
    for (const op of unfinished) {
      if (op.status === 'in_flight') {
        op.status = 'pending';
        op.error = 'Resumed after crash';
        await saveOperation(op);
      }
    }
    useQueueStore.getState().setOperations(unfinished);

    // 3. Start draining
    void this.drain();
  }

  private async checkOnlineStatus(): Promise<void> {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.isOnline = false;
      return;
    }
    try {
      const res = await fetch('/api/fs/stats', { method: 'HEAD' });
      this.isOnline = res.status === 401 || res.ok;
    } catch {
      this.isOnline = false;
    }
    if (this.isOnline) {
      void this.drain();
    }
  }

  getOnlineStatus(): boolean {
    return this.isOnline;
  }

  async enqueue(
    type: QueueOperation['type'],
    payload: QueueOperation['payload'],
    idempotencyKey: string
  ): Promise<QueueOperation> {
    // Check for duplicate pending/in-flight tasks
    const existing = useQueueStore
      .getState()
      .operations.find(
        (op) =>
          op.idempotency_key === idempotencyKey &&
          (op.status === 'pending' || op.status === 'in_flight')
      );
    if (existing) {
      return existing;
    }

    const op: QueueOperation = {
      id: crypto.randomUUID(),
      idempotency_key: idempotencyKey,
      type,
      payload,
      status: 'pending',
      retries: 0,
      error: null,
      created_at: Date.now(),
      updated_at: Date.now()
    };

    await saveOperation(op);
    useQueueStore.getState().addOperation(op);

    // Audit event start
    void recordAuditEvent({
      action:
        type === 'upload'
          ? 'upload'
          : type === 'create_folder'
          ? 'create_folder'
          : type === 'rename'
          ? 'rename'
          : 'delete',
      target_id: op.id,
      target_type: 'operation',
      outcome: 'success',
      correlation_id: op.id,
      metadata: { phase: 'queued', type }
    });

    void this.drain();
    return op;
  }

  async drain(): Promise<void> {
    if (useQueueStore.getState().isPaused) return;
    if (!this.isOnline) return;
    if (this.runningCount >= 2) return;

    const pending = useQueueStore
      .getState()
      .operations.filter((op) => op.status === 'pending');

    if (pending.length === 0) return;

    const op = pending[0];
    this.runningCount++;

    // Transition status
    op.status = 'in_flight';
    op.updated_at = Date.now();
    await saveOperation(op);
    useQueueStore.getState().updateOperationState(op.id, { status: 'in_flight' });

    // Execute
    this.execute(op)
      .then(async () => {
        op.status = 'succeeded';
        op.updated_at = Date.now();
        await saveOperation(op);
        useQueueStore.getState().updateOperationState(op.id, { status: 'succeeded', error: null });

        // Invalidate queries to update UI
        if (this.queryClient) {
          this.queryClient.invalidateQueries({ queryKey: ['folder'] });
        }

        // Audit success
        void recordAuditEvent({
          action:
            op.type === 'upload'
              ? 'upload'
              : op.type === 'create_folder'
              ? 'create_folder'
              : op.type === 'rename'
              ? 'rename'
              : 'delete',
          target_id: op.id,
          target_type: 'operation',
          outcome: 'success',
          correlation_id: op.id,
          metadata: { phase: 'completed' }
        });
      })
      .catch(async (err) => {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isNetworkErr =
          !this.isOnline ||
          errorMsg.includes('Failed to fetch') ||
          errorMsg.includes('Network error') ||
          err.name === 'TypeError';

        if (isNetworkErr) {
          op.status = 'pending';
          op.error = `Network error, retrying: ${errorMsg}`;
          await saveOperation(op);
          useQueueStore.getState().updateOperationState(op.id, { status: 'pending', error: op.error });
        } else {
          op.retries++;
          op.error = errorMsg;

          if (op.retries < 5) {
            op.status = 'pending';
            await saveOperation(op);
            useQueueStore.getState().updateOperationState(op.id, {
              status: 'pending',
              retries: op.retries,
              error: `Error (retry ${op.retries}/5): ${errorMsg}`
            });

            // Exponential backoff
            const backoffMs = 1500 * Math.pow(1.5, op.retries);
            setTimeout(() => {
              void this.drain();
            }, backoffMs);
          } else {
            op.status = 'failed';
            await saveOperation(op);
            useQueueStore.getState().updateOperationState(op.id, { status: 'failed', error: errorMsg });

            // Audit failure
            void recordAuditEvent({
              action:
                op.type === 'upload'
                  ? 'upload'
                  : op.type === 'create_folder'
                  ? 'create_folder'
                  : op.type === 'rename'
                  ? 'rename'
                  : 'delete',
              target_id: op.id,
              target_type: 'operation',
              outcome: 'error',
              correlation_id: op.id,
              metadata: { phase: 'failed', error: errorMsg }
            });

            // Cancel subsequent dependent operations
            this.cancelDependents(op);
          }
        }
      })
      .finally(() => {
        this.runningCount--;
        void this.drain();
      });
  }

  private cancelDependents(failedOp: QueueOperation) {
    let targetId: string | null = null;
    if (failedOp.type === 'upload') {
      targetId = failedOp.payload.fileId;
    } else if (failedOp.type === 'create_folder') {
      targetId = failedOp.id;
    } else if (failedOp.type === 'rename' || failedOp.type === 'delete') {
      targetId = failedOp.payload.id;
    }

    if (!targetId) return;

    const ops = useQueueStore.getState().operations;
    for (const op of ops) {
      if (op.status === 'pending' || op.status === 'in_flight') {
        let isDependent = false;
        if (op.type === 'rename' || op.type === 'delete') {
          isDependent = op.payload.id === targetId;
        } else if (op.type === 'upload') {
          isDependent = op.payload.fileId === targetId || op.payload.parentId === targetId;
        } else if (op.type === 'create_folder') {
          isDependent = op.payload.parentId === targetId;
        }

        if (isDependent) {
          op.status = 'cancelled';
          op.error = `Cancelled because dependency ${failedOp.id} failed`;
          void saveOperation(op);
          useQueueStore.getState().updateOperationState(op.id, {
            status: 'cancelled',
            error: op.error
          });
        }
      }
    }
  }

  private async execute(op: QueueOperation): Promise<void> {
    if (typeof localStorage !== 'undefined' && localStorage.getItem('wyvern_simulate_crash') === 'true') {
      localStorage.removeItem('wyvern_simulate_crash');
      throw new Error('Simulated Crash');
    }

    switch (op.type) {
      case 'create_folder': {
        const { name, parentId } = op.payload;
        await apiFetch('/fs/folder', {
          method: 'POST',
          body: JSON.stringify({ name, parentId })
        });
        break;
      }
      case 'rename': {
        const { id, name } = op.payload;
        await apiFetch('/fs/node/rename', {
          method: 'POST',
          body: JSON.stringify({ id, name })
        });
        break;
      }
      case 'delete': {
        const { id } = op.payload;
        await apiFetch('/fs/node', {
          method: 'DELETE',
          body: JSON.stringify({ id })
        });
        break;
      }
      case 'upload': {
        await this.executeUpload(op);
        break;
      }
      default:
        throw new Error(`Unknown operation type: ${(op as any).type}`);
    }
  }

  private async executeUpload(op: QueueOperation): Promise<void> {
    const { file, parentId, encryption } = op.payload;
    if (!file) throw new Error('File object is missing in upload payload');

    const RESUMABLE_THRESHOLD = 50 * 1024 * 1024;
    const isResumable = file.size >= RESUMABLE_THRESHOLD;

    if (!isResumable) {
      // Single-shot upload
      const { promise } = uploadFile(file);
      const result = await promise;
      const chunks = result.chunks.map((c) => ({
        discordMessageId: extractMessageIdFromUrl(c.url),
        index: c.index,
        sizeBytes: c.size,
        cdnUrl: c.url
      }));

      await apiFetch('/fs/file/created', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          parent_id: parentId,
          size_bytes: result.size,
          mime_type: result.mimeType || file.type,
          chunks,
          ...(encryption ? { encryption } : {})
        })
      });
    } else {
      // Resumable upload
      const DEFAULT_CHUNK_SIZE = 24 * 1024 * 1024;
      const totalChunks = Math.ceil(file.size / DEFAULT_CHUNK_SIZE);

      let sessionId = op.payload.sessionId;
      let startOffset = 0;

      if (sessionId) {
        try {
          const statusInfo = await getSessionOffset(sessionId);
          startOffset = statusInfo.offset;
          if (statusInfo.status !== 'open') {
            sessionId = null;
            startOffset = 0;
          }
        } catch {
          sessionId = null;
          startOffset = 0;
        }
      }

      if (!sessionId) {
        const session = await createUploadSession({
          filename: file.name,
          mimeType: file.type || 'application/octet-stream',
          totalSize: file.size,
          chunkSize: DEFAULT_CHUNK_SIZE
        });
        sessionId = session.id;
        op.payload.sessionId = sessionId;
        op.payload.chunks = [];
        await saveOperation(op);
      }

      if (!op.payload.chunks) {
        op.payload.chunks = [];
      }

      const startChunkIndex = Math.floor(startOffset / DEFAULT_CHUNK_SIZE);

      for (let i = startChunkIndex; i < totalChunks; i++) {
        // Crash simulation mid-upload
        if (typeof localStorage !== 'undefined' && localStorage.getItem('wyvern_simulate_crash') === 'true') {
          localStorage.removeItem('wyvern_simulate_crash');
          throw new Error('Simulated Crash');
        }

        const chunkOffset = i * DEFAULT_CHUNK_SIZE;
        const end = Math.min(chunkOffset + DEFAULT_CHUNK_SIZE, file.size);
        const blob = file.slice(chunkOffset, end);
        const idemKey = chunkIdempotencyKey(sessionId, chunkOffset, i);

        let attempt = 0;
        let chunkResult: any = null;

        while (attempt < 5) {
          try {
            chunkResult = await appendChunk(sessionId, chunkOffset, blob, i, idemKey);
            break;
          } catch (err) {
            if (err instanceof RateLimitedError) {
              const backoff = Math.min(2000 * Math.pow(2, attempt), 30000);
              await new Promise((r) => setTimeout(r, Math.max(err.retryAfter * 1000, backoff)));
            } else {
              const backoff = Math.min(500 * Math.pow(2, attempt), 5000);
              await new Promise((r) => setTimeout(r, backoff));
            }
            attempt++;
          }
        }

        if (!chunkResult) {
          throw new Error(`Failed to upload chunk ${i}`);
        }

        if (chunkResult.chunk) {
          // Add chunk to local list and save to DB
          op.payload.chunks.push(chunkResult.chunk);
          await saveOperation(op);
        }

        const pct = Math.round((end / file.size) * 100);
        useQueueStore.getState().updateOperationState(op.id, {
          error: `Uploading: ${pct}%`
        });
      }

      await finalizeSession(sessionId);

      const chunks = op.payload.chunks.map((c: any) => ({
        discordMessageId: extractMessageIdFromUrl(c.url),
        index: c.index,
        sizeBytes: c.size,
        cdnUrl: c.url
      }));

      await apiFetch('/fs/file/created', {
        method: 'POST',
        body: JSON.stringify({
          name: file.name,
          parent_id: parentId,
          size_bytes: file.size,
          mime_type: file.type || 'application/octet-stream',
          chunks,
          ...(encryption ? { encryption } : {})
        })
      });
    }
  }

  // Exposed helper to retry failed operations manually
  async retry(id: string): Promise<void> {
    const ops = useQueueStore.getState().operations;
    const op = ops.find((o) => o.id === id);
    if (op && (op.status === 'failed' || op.status === 'cancelled')) {
      op.status = 'pending';
      op.retries = 0;
      op.error = null;
      await saveOperation(op);
      useQueueStore.getState().updateOperationState(id, {
        status: 'pending',
        retries: 0,
        error: null
      });
      void this.drain();
    }
  }
}

export const OperationQueue = new OperationQueueManager();
export type { QueueOperation };
