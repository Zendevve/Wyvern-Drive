import { useState } from 'react';
import { useFileStore } from '../stores/file-store';
import { isImageFile } from '../lib/media';
import { MediaPreviewModal } from './MediaPreviewModal';
import { PhotoThumbnail } from './PhotoThumbnail';
import type { FileRecord } from '../types';

export function PhotoTimeline() {
  const files = useFileStore(s => s.files);
  const [selectedFile, setSelectedFile] = useState<FileRecord | null>(null);

  const images = files
    .filter(f => isImageFile(f.mimeType) && f.status === 'complete')
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());

  const grouped = new Map<string, FileRecord[]>();
  for (const file of images) {
    const key = file.createdAt.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const group = grouped.get(key) || [];
    group.push(file);
    grouped.set(key, group);
  }

  if (images.length === 0) {
    return <p className="text-discord-muted p-4">No photos found</p>;
  }

  return (
    <div>
      <h2 className="text-lg font-bold mb-4">Photo Timeline</h2>

      {Array.from(grouped.entries()).map(([date, photos]) => (
        <div key={date} className="mb-6">
          <h3 className="text-sm font-medium text-discord-muted mb-2">{date}</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {photos.map(photo => (
              <PhotoThumbnail
                key={photo.id}
                file={photo}
                onClick={() => setSelectedFile(photo)}
              />
            ))}
          </div>
        </div>
      ))}

      {selectedFile && (
        <MediaPreviewModal
          file={selectedFile}
          isOpen={!!selectedFile}
          onClose={() => setSelectedFile(null)}
        />
      )}
    </div>
  );
}
