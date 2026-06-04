import { useEffect, useRef } from 'react';
import { useUploadStore } from '../stores/upload-store';
import type { UploadProgress } from '../types';

export function UploadProgressList() {
  const uploads = useUploadStore(s => s.uploads);
  const removeUpload = useUploadStore(s => s.removeUpload);
  const completedTimers = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    for (const upload of uploads) {
      if (upload.status === 'complete' && !completedTimers.current.has(upload.fileId)) {
        const timer = window.setTimeout(() => {
          removeUpload(upload.fileId);
          completedTimers.current.delete(upload.fileId);
        }, 3000);
        completedTimers.current.set(upload.fileId, timer);
      }
    }
  }, [uploads, removeUpload]);

  const activeUploads = uploads.filter((u): u is UploadProgress & { status: 'pending' | 'encrypting' | 'uploading' | 'failed' } => u.status !== 'complete');

  if (activeUploads.length === 0) return null;

  return (
    <div className="mb-4 space-y-2">
      {activeUploads.map(upload => {
        const progress = upload.totalChunks > 0
          ? Math.round((upload.completedChunks / upload.totalChunks) * 100)
          : 0;

        const statusText = {
          pending: 'Queued...',
          encrypting: 'Encrypting...',
          uploading: `Uploading ${upload.completedChunks}/${upload.totalChunks} chunks`,
          failed: `Failed: ${upload.error}`,
        }[upload.status];

        return (
          <div key={upload.fileId} className="bg-dark-bg rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium truncate">{upload.fileName}</span>
              <span className="text-xs text-discord-muted">{statusText}</span>
            </div>
            <div
              className="h-1.5 bg-gray-700 rounded"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progress}
              aria-label={`Upload progress for ${upload.fileName}`}
            >
              <div
                className={`h-full rounded transition-all ${
                  upload.status === 'failed' ? 'bg-red-500' : 'bg-blurple'
                }`}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
