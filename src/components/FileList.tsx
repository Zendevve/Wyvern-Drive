import { useFileStore } from '../stores/file-store';
import { useFolderStore } from '../stores/folder-store';
import { useSearchStore } from '../stores/search-store';
import { formatFileSize, formatDate } from '../utils/format';
import { FileActions } from './FileActions';

export function FileList() {
  const files = useFileStore(s => s.files);
  const isLoading = useFileStore(s => s.isLoading);
  const currentFolderId = useFolderStore(s => s.currentFolderId);
  const query = useSearchStore(s => s.query);
  const filters = useSearchStore(s => s.filters);

  const filteredFiles = files.filter(file => {
    if (file.folderId !== currentFolderId) return false;
    if (query && !file.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filters.mimeType && file.mimeType !== filters.mimeType) return false;
    if (filters.dateFrom && file.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && file.createdAt > filters.dateTo) return false;
    return true;
  });

  if (isLoading) return <p className="text-discord-muted p-4">Loading files...</p>;
  if (files.length === 0) return <p className="text-discord-muted p-4">No files yet</p>;
  if (filteredFiles.length === 0 && query) return <p className="text-discord-muted p-4">No matching files</p>;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-bold">Files</h2>
        <span className="text-xs text-discord-muted">{filteredFiles.length} files</span>
      </div>
      <div className="space-y-1">
        {filteredFiles.map(file => (
          <div key={file.id} className="flex items-center justify-between bg-dark-bg p-3 rounded hover:bg-dark-bg/80">
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{file.name}</p>
              <p className="text-xs text-discord-muted">
                {formatFileSize(file.size)} • {formatDate(file.createdAt)}
              </p>
            </div>
            <FileActions fileId={file.id} fileName={file.name} status={file.status} />
          </div>
        ))}
      </div>
    </div>
  );
}
