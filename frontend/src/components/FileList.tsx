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
  Layers,
  Info,
  Edit2,
} from 'lucide-react';
import { FileItem, Folder } from '../types';
import { formatBytes, formatDate } from '../services/api';

interface FileListProps {
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

export const FileList: React.FC<FileListProps> = ({
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
              <th className="py-3 px-4 w-32">Date Added</th>
              <th className="py-3 px-4 w-32 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-obsidian-border/60 text-xs">
            {/* Folders Rows */}
            {folders.map((folder) => (
              <tr
                key={folder.id}
                onDoubleClick={() => onOpenFolder(folder.id)}
                className="hover:bg-obsidian-elevated/50 cursor-pointer transition-colors group"
              >
                <td className="py-2.5 px-4">
                  <FolderIcon
                    className="w-4 h-4"
                    style={{ color: folder.color || '#5865F2' }}
                  />
                </td>
                <td className="py-2.5 px-4 font-medium text-white group-hover:text-wyvern-400 transition-colors">
                  {folder.name}
                </td>
                <td className="py-2.5 px-4 text-slate-500 font-mono">--</td>
                <td className="py-2.5 px-4 text-slate-500 font-mono">
                  {folder.file_count || 0} files
                </td>
                <td className="py-2.5 px-4 text-slate-500">Folder</td>
                <td className="py-2.5 px-4 text-slate-500 font-mono">
                  {formatDate(folder.created_at)}
                </td>
                <td className="py-2.5 px-4 text-right">
                  <button
                    onClick={() => onOpenFolder(folder.id)}
                    className="text-xs text-wyvern-400 hover:text-wyvern-300 font-medium"
                  >
                    Open
                  </button>
                </td>
              </tr>
            ))}

            {/* Files Rows */}
            {files.map((file) => {
              const { icon: Icon, color } = getFileIcon(file);
              const isSelected = selectedFileIds.includes(file.id);

              return (
                <tr
                  key={file.id}
                  onClick={(e) => onToggleSelect(file.id, e)}
                  onDoubleClick={() => onPreviewFile(file)}
                  className={`hover:bg-obsidian-elevated/60 cursor-pointer transition-colors group select-none ${
                    isSelected ? 'bg-wyvern-500/10' : ''
                  }`}
                >
                  <td className="py-2.5 px-4" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => onToggleFavorite(file, e)}
                      className={`p-1 rounded transition-colors ${
                        file.favorite ? 'text-amber-400' : 'text-slate-600 hover:text-amber-400'
                      }`}
                    >
                      <Star className="w-3.5 h-3.5" fill={file.favorite ? 'currentColor' : 'none'} />
                    </button>
                  </td>

                  <td className="py-2.5 px-4">
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${color} flex-shrink-0`} />
                      <span className="font-medium text-white truncate max-w-sm group-hover:text-wyvern-300 transition-colors">
                        {file.name}
                      </span>
                    </div>
                  </td>

                  <td className="py-2.5 px-4 font-mono text-slate-300">
                    {formatBytes(file.size)}
                  </td>

                  <td className="py-2.5 px-4">
                    <span className="flex items-center gap-1 text-[11px] font-mono text-slate-400">
                      <Layers className="w-3 h-3 text-wyvern-400" />
                      <span>{file.chunk_count} {file.chunk_count === 1 ? 'chunk' : 'chunks'}</span>
                    </span>
                  </td>

                  <td className="py-2.5 px-4">
                    {file.is_encrypted ? (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30 text-[10px] font-mono text-emerald-400">
                        <Lock className="w-2.5 h-2.5" />
                        <span>AES-256</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">Plain</span>
                    )}
                  </td>

                  <td className="py-2.5 px-4 font-mono text-slate-400">
                    {formatDate(file.created_at)}
                  </td>

                  <td className="py-2.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => onPreviewFile(file)}
                        title="Stream & Preview"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-hover transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-accent-cyan" />
                      </button>
                      <button
                        onClick={() => onDownloadFile(file)}
                        title="Download"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-hover transition-colors"
                      >
                        <Download className="w-3.5 h-3.5 text-wyvern-400" />
                      </button>
                      <button
                        onClick={() => onInspectFile(file)}
                        title="Chunk Manifest"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-hover transition-colors"
                      >
                        <Info className="w-3.5 h-3.5 text-accent-teal" />
                      </button>
                      <button
                        onClick={() => onRenameFile(file)}
                        title="Rename"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-hover transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => onDeleteFile(file)}
                        title="Delete"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-obsidian-hover transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}

            {files.length === 0 && folders.length === 0 && (
              <tr>
                <td colSpan={7} className="py-12 text-center text-slate-500 italic">
                  No files or folders in this directory.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
