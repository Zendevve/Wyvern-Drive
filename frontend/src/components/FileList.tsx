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
  Share2,
  Info,
  RotateCcw,
} from 'lucide-react';
import { FileItem, Folder } from '../types';
import { formatBytes, formatDate } from '../services/api';

interface FileListProps {
  folders?: Folder[];
  files: FileItem[];
  selectedFileIds: string[];
  onSelectFile: (id: string) => void;
  onOpenFolder?: (folderId: string) => void;
  onOpenFile: (file: FileItem) => void;
  onInspectFile: (file: FileItem) => void;
  onDownloadFile: (file: FileItem) => void;
  onToggleFavorite: (file: FileItem) => void;
  onDeleteFile: (file: FileItem, permanent?: boolean) => void;
  onRestoreFile?: (file: FileItem) => void;
  onRenameFile: (file: FileItem) => void;
  onShareFile: (file: FileItem) => void;
  isTrash?: boolean;
}

export const FileList: React.FC<FileListProps> = ({
  folders = [],
  files,
  selectedFileIds,
  onSelectFile,
  onOpenFolder,
  onOpenFile,
  onInspectFile,
  onDownloadFile,
  onToggleFavorite,
  onDeleteFile,
  onRestoreFile,
  onRenameFile,
  onShareFile,
  isTrash = false,
}) => {
  const getFileIcon = (file: FileItem) => {
    const mime = file.mime_type.toLowerCase();
    const name = file.name.toLowerCase();

    if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/.test(name)) {
      return { icon: ImageIcon, color: 'text-accent-cyan' };
    }
    if (mime.startsWith('video/') || /\.(mp4|mkv|webm|mov|avi)$/.test(name)) {
      return { icon: Video, color: 'text-wyvern-400' };
    }
    if (mime.startsWith('audio/') || /\.(mp3|wav|flac|ogg)$/.test(name)) {
      return { icon: Music, color: 'text-pink-400' };
    }
    if (mime.includes('zip') || mime.includes('tar') || /\.(zip|rar|7z|tar|gz)$/.test(name)) {
      return { icon: Archive, color: 'text-accent-amber' };
    }
    if (mime.includes('pdf') || mime.includes('document') || /\.(pdf|docx|txt|md)$/.test(name)) {
      return { icon: FileText, color: 'text-accent-emerald' };
    }
    return { icon: File, color: 'text-slate-400' };
  };

  return (
    <div className="p-6">
      <div className="w-full bg-obsidian-card/80 border border-obsidian-border rounded-2xl overflow-hidden shadow-xl">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-obsidian-border bg-obsidian-elevated/50 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-4 w-10">
                <span className="sr-only">Select</span>
              </th>
              <th className="py-3 px-4">Name</th>
              <th className="py-3 px-4 w-28">Size</th>
              <th className="py-3 px-4 w-28">Chunks</th>
              <th className="py-3 px-4 w-28">Security</th>
              <th className="py-3 px-4 w-36">Modified</th>
              <th className="py-3 px-4 w-40 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian-border/50 text-xs">
            {files.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500">
                  {isTrash ? 'Trash is empty.' : 'No files stored in this location.'}
                </td>
              </tr>
            ) : (
              files.map((file) => {
                const { icon: Icon, color } = getFileIcon(file);
                const isSelected = selectedFileIds.includes(file.id);

                return (
                  <tr
                    key={file.id}
                    onClick={() => onSelectFile(file.id)}
                    onDoubleClick={() => onOpenFile(file)}
                    className={`hover:bg-obsidian-hover/60 transition-colors cursor-pointer select-none ${
                      isSelected ? 'bg-wyvern-600/10' : ''
                    }`}
                  >
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      {!isTrash && (
                        <button
                          onClick={() => onToggleFavorite(file)}
                          className="text-slate-600 hover:text-amber-400 transition-colors"
                        >
                          <Star className="w-4 h-4" fill={file.favorite ? '#FBBF24' : 'none'} color={file.favorite ? '#FBBF24' : 'currentColor'} />
                        </button>
                      )}
                    </td>

                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                        <span className="font-medium text-slate-200 truncate max-w-sm">{file.name}</span>
                      </div>
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400">{formatBytes(file.size)}</td>
                    <td className="py-3 px-4 font-mono text-slate-400">{file.chunk_count}</td>

                    <td className="py-3 px-4">
                      {file.is_encrypted ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Lock className="w-2.5 h-2.5" />
                          AES-256
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 font-mono">Plain</span>
                      )}
                    </td>

                    <td className="py-3 px-4 font-mono text-slate-400 text-[11px]">{formatDate(file.created_at)}</td>

                    <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        {isTrash ? (
                          <>
                            <button
                              onClick={() => onRestoreFile && onRestoreFile(file)}
                              className="p-1.5 rounded-lg text-emerald-400 hover:bg-obsidian-elevated"
                              title="Restore"
                            >
                              <RotateCcw className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => onDeleteFile(file, true)}
                              className="p-1.5 rounded-lg text-rose-400 hover:bg-obsidian-elevated"
                              title="Delete Permanently"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              onClick={() => onOpenFile(file)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated"
                              title="Preview"
                            >
                              <Eye className="w-4 h-4 text-accent-cyan" />
                            </button>
                            <button
                              onClick={() => onShareFile(file)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated"
                              title="Share"
                            >
                              <Share2 className="w-4 h-4 text-accent-cyan" />
                            </button>
                            <button
                              onClick={() => onDownloadFile(file)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated"
                              title="Download"
                            >
                              <Download className="w-4 h-4 text-wyvern-400" />
                            </button>
                            <button
                              onClick={() => onInspectFile(file)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated"
                              title="Inspect"
                            >
                              <Info className="w-4 h-4 text-accent-teal" />
                            </button>
                            <button
                              onClick={() => onDeleteFile(file, false)}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-obsidian-elevated"
                              title="Trash"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
