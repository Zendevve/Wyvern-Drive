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
          className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer text-xs transition-colors ${
            isActive ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:text-foreground hover:bg-card-hover'
          }`}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          role="treeitem"
          tabIndex={0}
          aria-selected={isActive}
          aria-expanded={children.length > 0 ? isExpanded : undefined}
          aria-label={folder.name}
          onClick={() => setCurrentFolder(folder.id)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentFolder(folder.id); } }}
        >
          {children.length > 0 ? (
            <button
              onClick={(e) => { e.stopPropagation(); toggleExpand(folder.id); }}
              className="text-[9px] w-3 flex items-center justify-center text-text-muted hover:text-foreground cursor-pointer"
            >
              {isExpanded ? '▼' : '▶'}
            </button>
          ) : (
            <span className="w-3" />
          )}
          <span aria-hidden="true" className="text-sm shrink-0">📁</span>
          <span className="truncate">{folder.name}</span>
        </div>
        {isExpanded && children.map(child => renderFolder(child, depth + 1))}
      </div>
    );
  };

  return (
    <div className="space-y-0.5" role="tree" aria-label="Folder navigation">
      <div
        className={`flex items-center gap-1.5 py-1 px-2 rounded-lg cursor-pointer text-xs transition-colors ${
          currentFolderId === null ? 'bg-primary/10 text-primary font-medium' : 'text-text-muted hover:text-foreground hover:bg-card-hover'
        }`}
        role="treeitem"
        tabIndex={0}
        aria-selected={currentFolderId === null}
        onClick={() => setCurrentFolder(null)}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setCurrentFolder(null); } }}
      >
        <span className="w-3" />
        <span aria-hidden="true" className="text-sm shrink-0">📁</span>
        <span>Root</span>
      </div>
      {rootFolders.map(folder => renderFolder(folder))}
    </div>
  );
}
