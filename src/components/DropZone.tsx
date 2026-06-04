import { useCallback, useRef, useState, useEffect } from 'react';
import { UploadSimple } from '@phosphor-icons/react';
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
  
  const [isDragging, setIsDragging] = useState(false);
  const dragCounter = useRef(0);

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

  useEffect(() => {
    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current++;
      if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter.current--;
      if (dragCounter.current === 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = (e: DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      dragCounter.current = 0;
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFiles(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [handleFiles]);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload files by clicking or dropping files here"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); inputRef.current?.click(); } }}
        className="group relative border-2 border-dashed border-border hover:border-primary/50 bg-card/50 hover:bg-card/80 rounded-2xl min-h-[160px] p-6 text-center flex flex-col items-center justify-center transition-all duration-300 cursor-pointer shadow-sm overflow-hidden"
      >
        {/* Glow effect */}
        <div className="absolute inset-0 bg-radial from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

        <div className="text-3xl mb-3 transform group-hover:-translate-y-1 transition-transform duration-300">
          <UploadSimple size={28} weight="regular" className="text-text-muted group-hover:text-primary transition-colors" aria-hidden="true" />
        </div>
        <p className="text-foreground font-medium mb-1">Drag & drop files here</p>
        <p className="text-xs text-text-muted">or click to browse from your device</p>
        
        <input
          ref={inputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => e.target.files && handleFiles(e.target.files)}
        />
      </div>

      {/* Fullscreen drag overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-md border-4 border-dashed border-primary animate-in fade-in duration-200">
          <div className="bg-card border border-border rounded-3xl p-8 flex flex-col items-center gap-4 max-w-sm text-center shadow-2xl scale-in duration-200">
            <div className="text-5xl animate-bounce text-primary">
              <UploadSimple size={48} weight="regular" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-semibold text-foreground">Drop files to upload</h3>
            <p className="text-sm text-text-muted">Release to upload files securely to your encrypted storage.</p>
          </div>
        </div>
      )}
    </>
  );
}
