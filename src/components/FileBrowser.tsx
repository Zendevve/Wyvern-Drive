import { useEffect } from 'react';
import { useFolderStore } from '../stores/folder-store';
import { useFileStore } from '../stores/file-store';
import { Breadcrumbs } from './Breadcrumbs';
import { FolderTree } from './FolderTree';
import { FolderActions } from './FolderActions';
import { FileList } from './FileList';
import { SearchBar } from './SearchBar';

export function FileBrowser() {
  const loadFolders = useFolderStore(s => s.loadFolders);
  const loadFiles = useFileStore(s => s.loadFiles);

  useEffect(() => {
    loadFolders();
    loadFiles();
  }, [loadFolders, loadFiles]);

  return (
    <div className="flex gap-4">
      <aside className="w-48 shrink-0">
        <FolderTree />
      </aside>
      <main className="flex-1 min-w-0">
        <Breadcrumbs />
        <FolderActions />
        <SearchBar />
        <FileList />
      </main>
    </div>
  );
}
