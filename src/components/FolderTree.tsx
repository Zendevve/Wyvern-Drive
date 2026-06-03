import { useState } from 'react';
import { useFolderStore } from '../stores/folder-store';

export function FolderTree() {
  const folders = useFolderStore(s => s.folders);
  const currentFolderId = useFolderStore(s => s.currentFolderId);
  const setCurrentFolder = useFolderStore(s => s.setCurrentFolder);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const rootFolders = folders.filter(f => f.parentId === null);
  const getChildren = (parentId: string) => folders.filter(f => f.parentId === parentId);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const renderFolder = (folder: typeof folders[0], depth: number = 0) => {
    const children = getChildren(folder.id);
    const isExpanded = expanded.has(folder.id);
    const isActive = currentFolderId === folder.id;

    return (
      <div key={folder.id}>
        <div
          className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm ${
            isActive ? 'bg-blurple/20 text-blurple' : 'hover:bg-dark-bg'
          }`}
          style={{ paddingLeft: `${depth * 16 + 8}px` }}
          onClick={() => setCurrentFolder(folder.id)}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
              className="text-xs w-4"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-4" />
          )}
          <span>📁</span>
          <span className="truncate">{folder.name}</span>
        </div>
        {isExpanded && children.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-0.5">
      <div
        className={`flex items-center gap-1 py-1 px-2 rounded cursor-pointer text-sm ${
          currentFolderId === null ? 'bg-blurple/20 text-blurple' : 'hover:bg-dark-bg'
        }`}
        onClick={() => setCurrentFolder(null)}
      >
        <span className="w-4" />
        <span>📁</span>
        <span>Root</span>
      </div>
      {rootFolders.map(folder => renderFolder(folder))}
    </div>
  );
}
