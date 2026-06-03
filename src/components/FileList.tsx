import { useEffect } from 'react';
import { useFileStore } from '../stores/file-store';
import { formatFileSize, formatDate } from '../utils/format';
import { FileActions } from './FileActions';

export function FileList() {
  const files = useFileStore(s => s.files);
  const isLoading = useFileStore(s => s.isLoading);
  const loadFiles = useFileStore(s => s.loadFiles);

  useEffect(() => { loadFiles(); }, [loadFiles]);

  if (isLoading) return <p className="text-discord-muted p-4">Loading files...</p>;
  if (files.length === 0) return <p className="text-discord-muted p-4">No files yet</p>;

  return (
    <div className="mt-4">
      <h2 className="text-lg font-bold mb-2">Files</h2>
      <div className="space-y-1">
        {files.map(file => (
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
