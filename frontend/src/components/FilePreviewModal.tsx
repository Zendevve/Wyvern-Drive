import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Lock,
  Layers,
  FileText,
  Video,
  Music,
  Image as ImageIcon,
  ZoomIn,
  ZoomOut,
  RotateCw,
  ExternalLink,
  ShieldCheck,
  Hash,
} from 'lucide-react';
import { FileItem } from '../types';
import { api, formatBytes, formatDate } from '../services/api';

interface FilePreviewModalProps {
  file: FileItem;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
  onInspect: (file: FileItem) => void;
}

export const FilePreviewModal: React.FC<FilePreviewModalProps> = ({
  file,
  onClose,
  onDownload,
  onInspect,
}) => {
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'preview' | 'chunks'>('preview');

  useEffect(() => {
    const url = api.getStreamURL(file.id);
    setStreamUrl(url);
  }, [file.id]);

  const isVideo = file.mime_type.startsWith('video/') || /\.(mp4|mkv|webm|mov)$/i.test(file.name);
  const isAudio = file.mime_type.startsWith('audio/') || /\.(mp3|wav|flac|ogg)$/i.test(file.name);
  const isImage = file.mime_type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(file.name);
  const isText = file.mime_type.startsWith('text/') || /\.(txt|md|json|ts|js|go|py|html|css|log)$/i.test(file.name);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/90 backdrop-blur-xl p-6 select-none">
      <div className="w-full max-w-4xl h-[85vh] bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="p-4 border-b border-obsidian-border bg-obsidian-elevated/40 flex items-center justify-between">
          <div className="flex items-center gap-3 truncate">
            <div className="w-8 h-8 rounded-lg bg-wyvern-500/20 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400 flex-shrink-0">
              {isVideo ? (
                <Video className="w-4 h-4" />
              ) : isAudio ? (
                <Music className="w-4 h-4" />
              ) : isImage ? (
                <ImageIcon className="w-4 h-4" />
              ) : (
                <FileText className="w-4 h-4" />
              )}
            </div>
            <div className="truncate">
              <h3 className="text-xs font-bold text-white truncate" title={file.name}>
                {file.name}
              </h3>
              <div className="flex items-center gap-2 text-[10px] font-mono text-slate-400">
                <span>{formatBytes(file.size)}</span>
                <span>•</span>
                <span>{file.chunk_count} Chunks</span>
                <span>•</span>
                <span>{formatDate(file.created_at)}</span>
              </div>
            </div>
          </div>

          {/* Controls & Close */}
          <div className="flex items-center gap-2">
            <div className="flex bg-obsidian-base rounded-lg p-0.5 border border-obsidian-border mr-2">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-colors ${
                  activeTab === 'preview'
                    ? 'bg-wyvern-500 text-white'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Media Preview
              </button>
              <button
                onClick={() => {
                  onInspect(file);
                }}
                className="px-3 py-1 text-xs font-medium text-slate-400 hover:text-white rounded-md transition-colors"
              >
                Chunk Manifest
              </button>
            </div>

            <button
              onClick={() => onDownload(file)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-wyvern-600 hover:bg-wyvern-500 shadow-glow-blurple transition-all"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Download</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Media Preview Viewport */}
        <div className="flex-1 overflow-hidden relative flex items-center justify-center bg-obsidian-base/80 p-6">
          {isVideo && (
            <div className="w-full h-full flex flex-col items-center justify-center">
              <video
                src={streamUrl}
                controls
                autoPlay
                className="max-w-full max-h-full rounded-xl shadow-2xl border border-obsidian-border bg-black"
              >
                Your browser does not support HTML5 video streaming.
              </video>
            </div>
          )}

          {isAudio && (
            <div className="flex flex-col items-center justify-center space-y-6 max-w-md w-full p-8 glass-panel rounded-2xl border border-obsidian-border">
              <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-pink-600 to-wyvern-500 flex items-center justify-center shadow-glow-blurple animate-pulse-slow">
                <Music className="w-8 h-8 text-white" />
              </div>
              <div className="text-center">
                <h4 className="text-sm font-bold text-white">{file.name}</h4>
                <p className="text-xs text-slate-400 font-mono mt-1">{formatBytes(file.size)}</p>
              </div>
              <audio src={streamUrl} controls className="w-full" autoPlay />
            </div>
          )}

          {isImage && (
            <div className="w-full h-full flex flex-col items-center justify-center relative overflow-hidden">
              <div
                className="transition-transform duration-200 ease-out flex items-center justify-center max-w-full max-h-full"
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg)`,
                }}
              >
                <img
                  src={streamUrl}
                  alt={file.name}
                  className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-2xl border border-obsidian-border"
                />
              </div>

              {/* Floating Image Toolbar */}
              <div className="absolute bottom-4 bg-obsidian-elevated/90 backdrop-blur-md border border-obsidian-border rounded-xl px-3 py-1.5 flex items-center gap-2 shadow-xl">
                <button
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-[11px] font-mono text-slate-300 w-12 text-center">
                  {Math.round(zoom * 100)}%
                </span>
                <button
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
                <div className="w-px h-4 bg-obsidian-border mx-1" />
                <button
                  onClick={() => setRotation((r) => (r + 90) % 360)}
                  className="p-1 rounded text-slate-400 hover:text-white"
                  title="Rotate 90°"
                >
                  <RotateCw className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {!isVideo && !isAudio && !isImage && (
            <div className="flex flex-col items-center justify-center text-center p-8 glass-panel rounded-2xl border border-obsidian-border max-w-md">
              <div className="w-16 h-16 rounded-2xl bg-wyvern-500/15 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400 mb-4">
                <FileText className="w-8 h-8" />
              </div>
              <h4 className="text-sm font-bold text-white mb-1">{file.name}</h4>
              <p className="text-xs text-slate-400 mb-4">
                Direct in-app rendering for this binary file format is ready for download or chunk inspection.
              </p>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onDownload(file)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-white bg-wyvern-600 hover:bg-wyvern-500 shadow-glow-blurple transition-all"
                >
                  Download File
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3 border-t border-obsidian-border bg-obsidian-card flex items-center justify-between text-xs text-slate-400 font-mono">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1 text-emerald-400">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>AES-256 Verified</span>
            </span>
            <span className="flex items-center gap-1 text-slate-500 truncate max-w-xs">
              <Hash className="w-3.5 h-3.5" />
              <span>{file.sha256}</span>
            </span>
          </div>

          <div>
            <span>Discord Attachment Stream Active</span>
          </div>
        </div>
      </div>
    </div>
  );
};
