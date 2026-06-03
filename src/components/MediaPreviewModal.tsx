import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import {
  isImageFile, isVideoFile, isPdfFile, isPreviewable,
  loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl, MAX_PREVIEW_SIZE
} from '../lib/media';
import type { FileRecord } from '../types';

interface MediaPreviewModalProps {
  file: FileRecord;
  isOpen: boolean;
  onClose: () => void;
}

export function MediaPreviewModal({ file, isOpen, onClose }: MediaPreviewModalProps) {
  const key = useAuthStore(s => s.derivedKey);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !key) return;

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) {
      setError('No webhook configured');
      return;
    }

    if (!isPreviewable(file.mimeType)) {
      setError('Unsupported file type');
      return;
    }

    if (file.size > MAX_PREVIEW_SIZE) {
      setError('File too large to preview (max 500MB)');
      return;
    }

    setLoading(true);
    setError(null);

    loadMediaBlob(file.id, key, webhookUrl)
      .then(blob => {
        const url = createMediaBlobUrl(blob);
        setBlobUrl(url);
        setLoading(false);
      })
      .catch(err => {
        setError(err instanceof Error ? err.message : 'Failed to load media');
        setLoading(false);
      });

    return () => {
      if (blobUrl) revokeMediaBlobUrl(blobUrl);
      setBlobUrl(null);
    };
  }, [isOpen, file.id, file.mimeType, file.size, key]);

  const handleClose = () => {
    if (blobUrl) revokeMediaBlobUrl(blobUrl);
    setBlobUrl(null);
    setError(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/80 z-50" />
        <Dialog.Content className="fixed inset-4 md:inset-12 z-50 bg-darker-bg rounded-lg flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-4 border-b border-gray-700">
            <Dialog.Title className="font-bold truncate">{file.name}</Dialog.Title>
            <Dialog.Close asChild>
              <button onClick={handleClose} className="text-discord-muted hover:text-discord-text text-xl">✕</button>
            </Dialog.Close>
          </div>

          <div className="flex-1 flex items-center justify-center overflow-auto p-4">
            {loading && <p className="text-discord-muted">Decrypting...</p>}
            {error && <p className="text-red-400">{error}</p>}
            {!loading && !error && blobUrl && isImageFile(file.mimeType) && (
              <img src={blobUrl} alt={file.name} className="max-w-full max-h-full object-contain" />
            )}
            {!loading && !error && blobUrl && isVideoFile(file.mimeType) && (
              <video src={blobUrl} controls className="max-w-full max-h-full" />
            )}
            {!loading && !error && blobUrl && isPdfFile(file.mimeType) && (
              <iframe src={blobUrl} title={file.name} className="w-full h-full border-0" />
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
