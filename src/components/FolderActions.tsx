import { useState } from 'react';
import { useFolderStore } from '../stores/folder-store';

export function FolderActions() {
  const [isCreating, setIsCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const createFolder = useFolderStore(s => s.createFolder);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createFolder(newName.trim());
    setNewName('');
    setIsCreating(false);
  };

  return (
    <div className="flex items-center gap-2 mb-4">
      {isCreating ? (
        <input
          type="text"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleCreate();
            if (e.key === 'Escape') setIsCreating(false);
          }}
          onBlur={handleCreate}
          placeholder="Folder name"
          className="bg-background border border-border rounded-lg px-2 py-1 text-sm text-foreground placeholder:text-text-muted focus:outline-none focus:border-primary transition-colors"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          aria-label="New folder"
          className="px-3 py-1 bg-card hover:bg-card-hover text-foreground rounded-lg border border-border text-sm transition-colors"
        >
          + New Folder
        </button>
      )}
    </div>
  );
}
