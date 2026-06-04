import { useEffect } from 'react';
import { useFolderStore } from '../stores/folder-store';
import { useFileStore } from '../stores/file-store';
import { Breadcrumbs } from './Breadcrumbs';
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
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-card p-4 rounded-2xl border border-border/80 shadow-sm">
        <Breadcrumbs />
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="flex-1 md:flex-initial min-w-[220px]">
            <SearchBar />
          </div>
          <FolderActions />
        </div>
      </div>
      <FileList />
    </div>
  );
}
