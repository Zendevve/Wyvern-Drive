import { useEffect, useState } from 'react';
import { useFolderStore } from '../stores/folder-store';
import type { FolderRecord } from '../types';

export function Breadcrumbs() {
  const [path, setPath] = useState<FolderRecord[]>([]);
  const currentFolderId = useFolderStore(s => s.currentFolderId);
  const getFolderPath = useFolderStore(s => s.getFolderPath);
  const setCurrentFolder = useFolderStore(s => s.setCurrentFolder);

  useEffect(() => {
    getFolderPath().then(setPath);
  }, [currentFolderId, getFolderPath]);

  return (
    <nav className="flex items-center gap-1 text-sm text-discord-muted mb-4">
      <button
        onClick={() => setCurrentFolder(null)}
        className="hover:text-discord-text transition-colors"
      >
        Root
      </button>
      {path.map((folder) => (
        <span key={folder.id} className="flex items-center gap-1">
          <span>/</span>
          <button
            onClick={() => setCurrentFolder(folder.id)}
            className="hover:text-discord-text transition-colors"
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
  );
}
