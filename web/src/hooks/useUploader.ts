import { useQueryClient } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';
import { extractMessageIdFromUrl, uploadFile } from '../api/upload';
import { runWithConcurrency } from '../lib/concurrency';
import { useUploadsStore } from '../store/uploads';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

const controllers = new Map<string, AbortController>();

export interface UseUploader {
  enqueueFiles: (files: FileList | File[], parentId: string | null) => Promise<void>;
  cancel: (id: string) => void;
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

  async function enqueueFiles(files: FileList | File[], parentId: string | null): Promise<void> {
    const arr = Array.from(files);
    if (arr.length === 0) return;
    const tasks = arr.map((file) => {
      const id = newId();
      enqueue({ id, name: file.name, size: file.size });
      return { id, file, parentId };
    });

    await runWithConcurrency(tasks, 3, async ({ id, file, parentId }) => {
      const controller = new AbortController();
      controllers.set(id, controller);
      setStatus(id, 'uploading');
      try {
        const { promise } = uploadFile(
          file,
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
        await apiFetch('/fs/file/created', {
          method: 'POST',
          body: JSON.stringify({
            name: file.name,
            parent_id: parentId,
            size_bytes: result.size,
            mime_type: result.mimeType,
            chunks
          })
        });
        markDone(id);
        queryClient.invalidateQueries({ queryKey: ['folder'] });
      } catch (err) {
        if (controller.signal.aborted) {
          markCancelled(id);
        } else {
          markError(id, err instanceof Error ? err.message : 'Upload failed');
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
