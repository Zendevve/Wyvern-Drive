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
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm text-discord-muted mb-4">
      <ol className="flex items-center gap-1">
        <li>
          <button
            onClick={() => setCurrentFolder(null)}
            className="hover:text-discord-text transition-colors"
          >
            Root
          </button>
        </li>
        {path.map((folder) => (
          <li key={folder.id} className="flex items-center gap-1">
            <span aria-hidden="true">/</span>
            <button
              onClick={() => setCurrentFolder(folder.id)}
              className="hover:text-discord-text transition-colors"
              aria-current={folder.id === path[path.length - 1]?.id ? 'page' : undefined}
            >
              {folder.name}
            </button>
          </li>
        ))}
      </ol>
    </nav>
  );
}
