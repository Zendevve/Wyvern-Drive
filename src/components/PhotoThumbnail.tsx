import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import { loadMediaBlob, createMediaBlobUrl, revokeMediaBlobUrl } from '../lib/media';
import type { FileRecord } from '../types';

interface PhotoThumbnailProps {
  file: FileRecord;
  onClick: () => void;
}

export function PhotoThumbnail({ file, onClick }: PhotoThumbnailProps) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const key = useAuthStore(s => s.derivedKey);

  useEffect(() => {
    if (!key) return;
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    let cancelled = false;
    loadMediaBlob(file.id, key, webhookUrl)
      .then(blob => {
        if (!cancelled) setBlobUrl(createMediaBlobUrl(blob));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
      if (blobUrl) revokeMediaBlobUrl(blobUrl);
    };
  }, [file.id, key]);

  return (
    <button
      onClick={onClick}
      className="aspect-square bg-dark-bg rounded overflow-hidden hover:ring-2 hover:ring-blurple transition-all"
    >
      {blobUrl ? (
        <img
          src={blobUrl}
          alt={file.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        <div className="w-full h-full flex items-center justify-center text-discord-muted text-xs">
          Loading...
        </div>
      )}
    </button>
  );
}
