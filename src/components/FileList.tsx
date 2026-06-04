import { useState } from 'react';
import { useFileStore } from '../stores/file-store';
import { useFolderStore } from '../stores/folder-store';
import { useSearchStore } from '../stores/search-store';
import { formatFileSize, formatDate } from '../utils/format';
import { isPreviewable } from '../lib/media';
import { FileActions } from './FileActions';
import { MediaPreviewModal } from './MediaPreviewModal';
import { PhotoTimeline } from './PhotoTimeline';
import type { FileRecord } from '../types';

function getFileIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return '🖼️';
  if (mimeType.startsWith('video/')) return '🎥';
  if (mimeType.startsWith('audio/')) return '🎵';
  if (mimeType === 'application/pdf') return '📕';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('gzip')) return '📦';
  if (mimeType.includes('word') || mimeType.includes('office') || mimeType.includes('document')) return '📄';
  if (mimeType.includes('excel') || mimeType.includes('sheet')) return '📊';
  if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return '📈';
  return '💾';
}

function getFileIconBg(mimeType: string) {
  if (mimeType.startsWith('image/')) return 'bg-blue-500/10 text-blue-500';
  if (mimeType.startsWith('video/')) return 'bg-amber-500/10 text-amber-500';
  if (mimeType.startsWith('audio/')) return 'bg-purple-500/10 text-purple-500';
  if (mimeType === 'application/pdf') return 'bg-rose-500/10 text-rose-500';
  if (mimeType.includes('zip') || mimeType.includes('tar') || mimeType.includes('rar') || mimeType.includes('gzip')) return 'bg-orange-500/10 text-orange-500';
  return 'bg-primary/10 text-primary';
}

export function FileList() {
  const files = useFileStore(s => s.files);
  const isLoading = useFileStore(s => s.isLoading);
  const selectedFileId = useFileStore(s => s.selectedFileId);
  const setSelectedFileId = useFileStore(s => s.setSelectedFileId);
  
  const folders = useFolderStore(s => s.folders);
  const currentFolderId = useFolderStore(s => s.currentFolderId);
  const setCurrentFolder = useFolderStore(s => s.setCurrentFolder);
  
  const query = useSearchStore(s => s.query);
  const filters = useSearchStore(s => s.filters);
  
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'timeline'>('grid');
  const [previewFile, setPreviewFile] = useState<FileRecord | null>(null);

  // Filter folders in the current view (only if not searching)
  const currentFolders = query
    ? []
    : folders.filter(folder => folder.parentId === currentFolderId);

  // Filter files in the current view
  const filteredFiles = files.filter(file => {
    if (!query && file.folderId !== currentFolderId) return false;
    if (query && !file.name.toLowerCase().includes(query.toLowerCase())) return false;
    if (filters.mimeType && file.mimeType !== filters.mimeType) return false;
    if (filters.dateFrom && file.createdAt < filters.dateFrom) return false;
    if (filters.dateTo && file.createdAt > filters.dateTo) return false;
    return true;
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <p className="text-text-muted text-sm animate-pulse">Loading files and folders...</p>
      </div>
    );
  }

  const handleFileClick = (e: React.MouseEvent, file: FileRecord) => {
    e.stopPropagation();
    setSelectedFileId(file.id);
  };

  const handleFileDoubleClick = (e: React.MouseEvent, file: FileRecord) => {
    e.stopPropagation();
    if (isPreviewable(file.mimeType)) {
      setPreviewFile(file);
    }
  };

  return (
    <div className="space-y-6 select-none" onClick={() => setSelectedFileId(null)}>
      {/* Header with View Actions */}
      <div className="flex items-center justify-between border-b border-border/60 pb-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Items</h3>
          <span className="text-xs text-text-muted bg-background border border-border/80 px-2 py-0.5 rounded-full">
            {filteredFiles.length} files {currentFolders.length > 0 && `• ${currentFolders.length} folders`}
          </span>
        </div>
        
        <div className="flex items-center gap-1.5 bg-card border border-border p-1 rounded-xl shadow-xs">
          <button
            onClick={() => setViewMode('grid')}
            aria-label="Grid view"
            className={`p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              viewMode === 'grid' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-foreground'
            }`}
          >
            Grid
          </button>
          <button
            onClick={() => setViewMode('list')}
            aria-label="List view"
            className={`p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              viewMode === 'list' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-foreground'
            }`}
          >
            List
          </button>
          <button
            onClick={() => setViewMode('timeline')}
            aria-label="Timeline view"
            className={`p-1.5 rounded-lg text-xs font-medium cursor-pointer transition-all ${
              viewMode === 'timeline' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-foreground'
            }`}
          >
            Timeline
          </button>
        </div>
      </div>

      {/* Main Content Render */}
      {viewMode === 'timeline' ? (
        <PhotoTimeline />
      ) : (
        <div className="space-y-6">
          {/* Folders Section */}
          {currentFolders.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Folders</h4>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {currentFolders.map(folder => (
                  <div
                    key={folder.id}
                    onClick={(e) => { e.stopPropagation(); setCurrentFolder(folder.id); }}
                    className="flex items-center gap-3 p-3 bg-card border border-border/80 hover:border-primary/40 hover:bg-card-hover rounded-xl cursor-pointer transition-all duration-200 group shadow-xs"
                  >
                    <span className="text-2xl transform group-hover:scale-110 transition-transform duration-300">📁</span>
                    <span className="text-sm font-medium text-foreground truncate">{folder.name}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Files Section */}
          {filteredFiles.length > 0 ? (
            <div className="space-y-3">
              <h4 className="text-xs font-medium text-text-muted uppercase tracking-wider">Files</h4>
              
              {viewMode === 'grid' ? (
                /* Grid View */
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {filteredFiles.map(file => {
                    const isSelected = selectedFileId === file.id;
                    return (
                      <div
                        key={file.id}
                        onClick={(e) => handleFileClick(e, file)}
                        onDoubleClick={(e) => handleFileDoubleClick(e, file)}
                        className={`group relative flex flex-col p-3 bg-card border hover:bg-card-hover rounded-2xl cursor-pointer transition-all duration-200 shadow-xs ${
                          isSelected ? 'border-primary bg-primary/5 ring-2 ring-primary' : 'border-border/80'
                        }`}
                      >
                        {/* File Format Large Visual */}
                        <div className={`h-24 rounded-xl flex items-center justify-center text-4xl mb-3 transition-colors ${getFileIconBg(file.mimeType)}`}>
                          <span className="transform group-hover:scale-110 transition-transform duration-300">
                            {getFileIcon(file.mimeType)}
                          </span>
                        </div>

                        {/* File Metadata info */}
                        <div className="flex-1 min-w-0 pr-6">
                          <p className="text-sm font-semibold text-foreground truncate" title={file.name}>
                            {file.name}
                          </p>
                          <p className="text-xxs text-text-muted mt-0.5">
                            {formatFileSize(file.size)}
                          </p>
                        </div>

                        {/* File actions float option */}
                        <div className="absolute bottom-2.5 right-2 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                          <FileActions fileId={file.id} fileName={file.name} status={file.status} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                /* List View */
                <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-border text-xs font-semibold text-text-muted bg-background/40">
                          <th className="py-3 px-4 w-8">Type</th>
                          <th className="py-3 px-4">Name</th>
                          <th className="py-3 px-4 hidden sm:table-cell">Size</th>
                          <th className="py-3 px-4 hidden md:table-cell">Created</th>
                          <th className="py-3 px-4 w-12 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/60">
                        {filteredFiles.map(file => {
                          const isSelected = selectedFileId === file.id;
                          return (
                            <tr
                              key={file.id}
                              onClick={(e) => handleFileClick(e, file)}
                              onDoubleClick={(e) => handleFileDoubleClick(e, file)}
                              className={`group hover:bg-card-hover text-sm cursor-pointer transition-colors ${
                                isSelected ? 'bg-primary/5' : ''
                              }`}
                            >
                              <td className="py-3 px-4 text-xl">
                                {getFileIcon(file.mimeType)}
                              </td>
                              <td className="py-3 px-4 font-semibold text-foreground truncate max-w-xs">
                                {file.name}
                              </td>
                              <td className="py-3 px-4 text-text-muted hidden sm:table-cell">
                                {formatFileSize(file.size)}
                              </td>
                              <td className="py-3 px-4 text-text-muted hidden md:table-cell">
                                {formatDate(file.createdAt)}
                              </td>
                              <td className="py-3 px-4 text-right">
                                <div className="inline-block" onClick={e => e.stopPropagation()}>
                                  <FileActions fileId={file.id} fileName={file.name} status={file.status} />
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          ) : (
            currentFolders.length === 0 && (
              <div className="text-center py-12 bg-card border border-border/80 border-dashed rounded-2xl">
                <p className="text-text-muted text-sm">No files or folders here yet.</p>
              </div>
            )
          )}
        </div>
      )}

      {/* Media Preview Overlay */}
      {previewFile && (
        <MediaPreviewModal
          file={previewFile}
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  );
}
