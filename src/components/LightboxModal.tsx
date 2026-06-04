import { useState, useEffect, useCallback } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from '@phosphor-icons/react';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import { loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl } from '../lib/media';
import { formatDate, formatFileSize } from '../utils/format';
import type { FileRecord } from '../types';

interface LightboxModalProps {
  file: FileRecord;
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (direction: 'prev' | 'next') => void;
}

export function LightboxModal({ file, isOpen, onClose, onNavigate }: LightboxModalProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const key = useAuthStore(s => s.derivedKey);

  useEffect(() => {
    if (!isOpen || !key) return;

    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    setLoading(true);
    loadMediaBlob(file.id, key, webhookUrl)
      .then(blob => {
        setBlobUrl(createMediaBlobUrl(blob));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      if (blobUrl) revokeMediaBlobUrl(blobUrl);
      setBlobUrl(null);
    };
  }, [isOpen, file.id, key]);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'ArrowLeft') onNavigate?.('prev');
    if (e.key === 'ArrowRight') onNavigate?.('next');
    if (e.key === 'Escape') onClose();
  }, [onNavigate, onClose]);

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen, handleKeyDown]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/90 z-50" />
        <Dialog.Content className="fixed inset-0 z-50 flex flex-col items-center justify-center">
          <Dialog.Close asChild>
            <button
              aria-label="Close lightbox"
              className="absolute top-4 right-4 text-white/70 hover:text-white z-10 p-1"
            >
              <X size={28} weight="regular" aria-hidden="true" />
            </button>
          </Dialog.Close>

          <div className="flex-1 flex items-center justify-center w-full p-4">
            {loading && <p className="text-white/50">Decrypting...</p>}
            {!loading && blobUrl && (
              <img src={blobUrl} alt={file.name} className="max-w-full max-h-[80vh] object-contain" />
            )}
          </div>

          <div className="bg-black/50 backdrop-blur-sm px-4 py-3 w-full text-center">
            <p className="text-white font-medium">{file.name}</p>
            <p className="text-white/50 text-sm">{formatDate(file.createdAt)} • {formatFileSize(file.size)}</p>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
