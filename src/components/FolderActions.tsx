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
          className="bg-darker-bg border border-gray-600 rounded px-2 py-1 text-sm"
          autoFocus
        />
      ) : (
        <button
          onClick={() => setIsCreating(true)}
          className="px-3 py-1 bg-dark-bg hover:bg-dark-bg/80 rounded text-sm"
        >
          + New Folder
        </button>
      )}
    </div>
  );
}
