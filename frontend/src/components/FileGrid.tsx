import React from 'react';
import {
  FileText,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  File,
  Lock,
  Star,
  Download,
  Eye,
  Trash2,
  Folder as FolderIcon,
  MoreVertical,
  Layers,
  Info,
} from 'lucide-react';
import { FileItem, Folder } from '../types';
import { formatBytes, formatDate } from '../services/api';

interface FileGridProps {
  folders: Folder[];
  files: FileItem[];
  selectedFileIds: string[];
  onToggleSelect: (id: string, e: React.MouseEvent) => void;
  onOpenFolder: (folderId: string) => void;
  onPreviewFile: (file: FileItem) => void;
  onInspectFile: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
  onToggleFavorite: (file: FileItem, e: React.MouseEvent) => void;
  onDeleteFile: (file: FileItem) => void;
  onRenameFile: (file: FileItem) => void;
}

export const FileGrid: React.FC<FileGridProps> = ({
  folders,
  files,
  selectedFileIds,
  onToggleSelect,
  onOpenFolder,
  onPreviewFile,
  onInspectFile,
  onDownloadFile,
  onToggleFavorite,
  onDeleteFile,
  onRenameFile,
}) => {
  const getFileIcon = (file: FileItem) => {
    const mime = file.mime_type.toLowerCase();
    const name = file.name.toLowerCase();

    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) {
      return { icon: ImageIcon, color: 'text-accent-cyan', bg: 'bg-cyan-500/10 border-cyan-500/30' };
    }
    if (mime.startsWith('video/') || /\.(mp4|mkv|webm|mov|avi)$/.test(name)) {
      return { icon: Video, color: 'text-wyvern-400', bg: 'bg-wyvern-500/10 border-wyvern-500/30' };
    }
    if (mime.startsWith('audio/') || /\.(mp3|wav|flac|ogg)$/.test(name)) {
      return { icon: Music, color: 'text-pink-400', bg: 'bg-pink-500/10 border-pink-500/30' };
    }
    if (mime.includes('zip') || mime.includes('tar') || mime.includes('compressed') || /\.(zip|rar|7z|tar|gz)$/.test(name)) {
      return { icon: Archive, color: 'text-accent-amber', bg: 'bg-amber-500/10 border-amber-500/30' };
    }
    if (mime.includes('pdf') || mime.includes('document') || mime.includes('text') || /\.(pdf|docx|txt|md)$/.test(name)) {
      return { icon: FileText, color: 'text-accent-emerald', bg: 'bg-emerald-500/10 border-emerald-500/30' };
    }
    return { icon: File, color: 'text-slate-400', bg: 'bg-slate-500/10 border-slate-500/30' };
  };

  return (
    <div className="p-6 space-y-6">
      {/* Folders Section */}
      {folders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">Folders</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {folders.map((folder) => (
              <div
                key={folder.id}
                onDoubleClick={() => onOpenFolder(folder.id)}
                className="glass-card group p-3.5 rounded-xl cursor-pointer transition-all duration-200 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-3 truncate">
                  <div
                    className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${folder.color || '#5865F2'}22` }}
                  >
                    <FolderIcon
                      className="w-4 h-4"
                      style={{ color: folder.color || '#5865F2' }}
                    />
                  </div>
                  <div className="truncate">
                    <h4 className="text-xs font-semibold text-white truncate group-hover:text-wyvern-400 transition-colors">
                      {folder.name}
                    </h4>
                    <span className="text-[10px] text-slate-500">
                      {folder.file_count || 0} files
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Files Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500">
            Files ({files.length})
          </h3>
        </div>

        {files.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center p-6 border border-dashed border-obsidian-border rounded-2xl bg-obsidian-card/40">
            <div className="w-12 h-12 rounded-2xl bg-obsidian-elevated flex items-center justify-center text-slate-600 mb-3">
              <File className="w-6 h-6" />
            </div>
            <h4 className="text-sm font-semibold text-slate-300">No files found</h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              Drag & drop files anywhere onto the window, or click Upload to store files in your Discord vault.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4">
            {files.map((file) => {
              const { icon: Icon, color, bg } = getFileIcon(file);
              const isSelected = selectedFileIds.includes(file.id);

              return (
                <div
                  key={file.id}
                  onClick={(e) => onToggleSelect(file.id, e)}
                  onDoubleClick={() => onPreviewFile(file)}
                  className={`glass-card group relative p-3.5 rounded-2xl cursor-pointer transition-all duration-200 flex flex-col justify-between select-none ${
                    isSelected ? 'ring-2 ring-wyvern-500 bg-obsidian-hover/90' : ''
                  }`}
                >
                  {/* Card Header (Encryption badge & Favorite star) */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      {file.is_encrypted && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                          <Lock className="w-2.5 h-2.5" />
                          <span>AES</span>
                        </span>
                      )}
                      {file.chunk_count > 1 && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-wyvern-500/15 border border-wyvern-500/30 text-[10px] font-mono text-wyvern-400">
                          <Layers className="w-2.5 h-2.5" />
                          <span>{file.chunk_count}c</span>
                        </span>
                      )}
                    </div>

                    <button
                      onClick={(e) => onToggleFavorite(file, e)}
                      className={`p-1 rounded-md transition-colors ${
                        file.favorite
                          ? 'text-amber-400'
                          : 'text-slate-600 opacity-0 group-hover:opacity-100 hover:text-amber-400'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" fill={file.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </div>

                  {/* Thumbnail / Large File Icon */}
                  <div className="py-4 flex flex-col items-center justify-center">
                    <div className={`w-14 h-14 rounded-2xl ${bg} border flex items-center justify-center transition-transform duration-300 group-hover:scale-105 shadow-inner`}>
                      <Icon className={`w-7 h-7 ${color}`} />
                    </div>
                  </div>

                  {/* File Metadata */}
                  <div className="space-y-1">
                    <h4
                      className="text-xs font-medium text-white truncate group-hover:text-wyvern-300 transition-colors"
                      title={file.name}
                    >
                      {file.name}
                    </h4>

                    <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                      <span>{formatBytes(file.size)}</span>
                      <span>{formatDate(file.created_at)}</span>
                    </div>
                  </div>

                  {/* Hover Quick Action Buttons */}
                  <div className="absolute inset-x-2 bottom-2 bg-obsidian-elevated/95 backdrop-blur-md border border-obsidian-border rounded-xl p-1 flex items-center justify-around opacity-0 group-hover:opacity-100 transition-all duration-150 transform translate-y-1 group-hover:translate-y-0 shadow-lg">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onPreviewFile(file);
                      }}
                      title="Preview / Stream"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-hover transition-colors"
                    >
                      <Eye className="w-3.5 h-3.5 text-accent-cyan" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDownloadFile(file);
                      }}
                      title="Download"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-hover transition-colors"
                    >
                      <Download className="w-3.5 h-3.5 text-wyvern-400" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onInspectFile(file);
                      }}
                      title="Chunk Manifest & Metadata"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-hover transition-colors"
                    >
                      <Info className="w-3.5 h-3.5 text-accent-teal" />
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onDeleteFile(file);
                      }}
                      title="Delete"
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-obsidian-hover transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
