import { useCallback, useRef } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { useUploadStore } from '../stores/upload-store';
import { useFileStore, getWebhookUrl } from '../stores/file-store';
import { uploadFile } from '../lib/upload';

export function DropZone() {
  const key = useAuthStore(s => s.derivedKey);
  const startUpload = useUploadStore(s => s.startUpload);
  const updateProgress = useUploadStore(s => s.updateProgress);
  const completeUpload = useUploadStore(s => s.completeUpload);
  const failUpload = useUploadStore(s => s.failUpload);
  const loadFiles = useFileStore(s => s.loadFiles);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = useCallback(async (files: FileList | File[]) => {
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl || !key) return;

    for (const file of Array.from(files)) {
      const fileId = crypto.randomUUID();
      startUpload(fileId, file.name, 0);

      try {
        await uploadFile(file, key, webhookUrl, (progress) => {
          updateProgress(progress.fileId, progress.completedChunks, progress.status);
        });
        completeUpload(fileId);
        await loadFiles();
      } catch (err) {
        failUpload(fileId, (err as Error).message);
      }
    }
  }, [key, startUpload, updateProgress, completeUpload, failUpload, loadFiles]);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files.length > 0) {
      handleFiles(e.dataTransfer.files);
    }
  }, [handleFiles]);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  return (
    <div
      onDrop={onDrop}
      onDragOver={onDragOver}
      role="button"
      tabIndex={0}
      aria-label="Upload files by clicking or dropping files here"
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
      className="border-2 border-dashed border-gray-600 rounded-lg min-h-[120px] sm:min-h-[160px] p-4 sm:p-6 text-center hover:border-blurple transition-colors cursor-pointer"
    >
      <p className="text-discord-muted mb-2">Drag and drop files here</p>
      <p className="text-sm text-discord-muted mb-4">or</p>
      <button
        onClick={(e) => { e.stopPropagation(); inputRef.current?.click(); }}
        className="px-4 py-2 bg-blurple hover:bg-blurple/80 rounded text-sm"
      >
        Browse Files
      </button>
      <input
        ref={inputRef}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleFiles(e.target.files)}
      />
    </div>
  );
}
