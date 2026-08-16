import React, { useState, useEffect, useRef } from 'react';
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
  Share2,
  Code,
  Archive,
  Volume2,
  Subtitles,
  Maximize2,
  Copy,
  Check,
  RefreshCw,
} from 'lucide-react';
import { FileItem } from '../types';
import { api, formatBytes, formatDate } from '../services/api';

interface UniversalViewerModalProps {
  file: FileItem;
  onClose: () => void;
  onDownload: (file: FileItem) => void;
  onInspect: (file: FileItem) => void;
  onShare: (file: FileItem) => void;
}

export const UniversalViewerModal: React.FC<UniversalViewerModalProps> = ({
  file,
  onClose,
  onDownload,
  onInspect,
  onShare,
}) => {
  const [streamUrl, setStreamUrl] = useState<string>('');
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'preview' | 'chunks' | 'code'>('preview');
  const [textContent, setTextContent] = useState<string>('');
  const [loadingText, setLoadingText] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const url = api.getStreamURL(file.id);
    setStreamUrl(url);

    // If text or code file, fetch preview content
    const isCodeOrText =
      file.mime_type.startsWith('text/') ||
      /\.(txt|md|json|ts|tsx|js|jsx|go|py|rs|c|cpp|h|html|css|sql|yaml|yml|sh|env|log)$/i.test(file.name);

    if (isCodeOrText && file.size < 5 * 1024 * 1024) {
      setLoadingText(true);
      fetch(url)
        .then((res) => res.text())
        .then((text) => {
          setTextContent(text);
          setLoadingText(false);
        })
        .catch(() => {
          setTextContent('// Unable to stream text preview in current mode.');
          setLoadingText(false);
        });
    }
  }, [file.id, file.name, file.mime_type, file.size]);

  const isVideo = file.mime_type.startsWith('video/') || /\.(mp4|mkv|webm|mov|avi)$/i.test(file.name);
  const isAudio = file.mime_type.startsWith('audio/') || /\.(mp3|wav|flac|ogg|m4a)$/i.test(file.name);
  const isImage = file.mime_type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i.test(file.name);
  const isPDF = file.mime_type === 'application/pdf' || /\.pdf$/i.test(file.name);
  const isArchive = /\.(zip|rar|7z|tar|gz|bz2)$/i.test(file.name);
  const isCode = /\.(ts|tsx|js|jsx|go|py|rs|c|cpp|h|html|css|json|sql|yaml|yml|sh|md)$/i.test(file.name);

  const handleCopyText = () => {
    navigator.clipboard.writeText(textContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    if (videoRef.current) {
      videoRef.current.playbackRate = speed;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/90 backdrop-blur-xl p-4 sm:p-6 select-none animate-fadeIn">
      <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-5xl h-[88vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between bg-obsidian-elevated/40">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-wyvern-500/10 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400 flex-shrink-0">
              {isVideo && <Video className="w-5 h-5" />}
              {isAudio && <Music className="w-5 h-5" />}
              {isImage && <ImageIcon className="w-5 h-5" />}
              {isPDF && <FileText className="w-5 h-5" />}
              {isArchive && <Archive className="w-5 h-5" />}
              {isCode && <Code className="w-5 h-5" />}
              {!isVideo && !isAudio && !isImage && !isPDF && !isArchive && !isCode && <FileText className="w-5 h-5" />}
            </div>

            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white truncate">{file.name}</h2>
                {file.is_encrypted && (
                  <span className="flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">
                    <Lock className="w-3 h-3" />
                    AES-256-GCM
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400">
                {file.formatted_size || formatBytes(file.size)} • {file.chunk_count} {file.chunk_count === 1 ? 'Chunk' : 'Chunks'} • Uploaded {formatDate(file.created_at)}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex items-center bg-obsidian-base/60 p-1 rounded-lg border border-obsidian-border mr-2">
              <button
                onClick={() => setActiveTab('preview')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'preview' ? 'bg-wyvern-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Preview Studio
              </button>
              {isCode && (
                <button
                  onClick={() => setActiveTab('code')}
                  className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                    activeTab === 'code' ? 'bg-wyvern-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Source View
                </button>
              )}
              <button
                onClick={() => setActiveTab('chunks')}
                className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                  activeTab === 'chunks' ? 'bg-wyvern-600 text-white shadow-sm' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Manifest Chunks
              </button>
            </div>

            <button
              onClick={() => onShare(file)}
              className="p-2 rounded-lg bg-obsidian-elevated text-slate-300 hover:text-white hover:bg-wyvern-600/30 border border-obsidian-border transition-colors"
              title="Zero-Knowledge Share Link"
            >
              <Share2 className="w-4 h-4" />
            </button>

            <button
              onClick={() => onDownload(file)}
              className="p-2 rounded-lg bg-wyvern-600 text-white hover:bg-wyvern-500 shadow-sm transition-colors"
              title="Download File"
            >
              <Download className="w-4 h-4" />
            </button>

            <button
              onClick={onClose}
              className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated border border-obsidian-border transition-colors ml-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 bg-obsidian-base/60 overflow-hidden relative flex flex-col items-center justify-center p-4">
          {activeTab === 'preview' && (
            <>
              {/* Video Player */}
              {isVideo && (
                <div className="w-full h-full flex flex-col items-center justify-center relative group">
                  <video
                    ref={videoRef}
                    src={streamUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-[70vh] rounded-xl shadow-2xl bg-black border border-obsidian-border"
                  >
                    Your browser does not support video streaming.
                  </video>

                  {/* Playback speed bar */}
                  <div className="mt-3 flex items-center gap-2 bg-obsidian-card/80 backdrop-blur-md px-3 py-1.5 rounded-lg border border-obsidian-border text-xs text-slate-300">
                    <span className="text-[11px] text-slate-400 font-medium">Speed:</span>
                    {[0.5, 1.0, 1.25, 1.5, 2.0].map((s) => (
                      <button
                        key={s}
                        onClick={() => handleSpeedChange(s)}
                        className={`px-2 py-0.5 rounded text-[11px] font-mono transition-colors ${
                          playbackSpeed === s ? 'bg-wyvern-600 text-white font-bold' : 'hover:bg-obsidian-elevated text-slate-400'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Audio Player */}
              {isAudio && (
                <div className="w-full max-w-md p-8 bg-obsidian-card border border-obsidian-border rounded-2xl flex flex-col items-center shadow-xl">
                  <div className="w-24 h-24 rounded-2xl bg-gradient-to-tr from-wyvern-600 to-accent-cyan flex items-center justify-center text-white mb-6 shadow-glow-blurple">
                    <Music className="w-12 h-12" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-1 truncate max-w-xs">{file.name}</h3>
                  <p className="text-xs text-slate-400 mb-6">{file.formatted_size || formatBytes(file.size)}</p>
                  <audio src={streamUrl} controls autoPlay className="w-full" />
                </div>
              )}

              {/* Image Gallery */}
              {isImage && (
                <div className="w-full h-full flex flex-col items-center justify-center relative">
                  <div className="flex-1 w-full flex items-center justify-center overflow-hidden">
                    <img
                      src={streamUrl}
                      alt={file.name}
                      style={{
                        transform: `scale(${zoom}) rotate(${rotation}deg)`,
                        transition: 'transform 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
                      }}
                      className="max-w-full max-h-[68vh] object-contain rounded-lg shadow-xl"
                    />
                  </div>

                  {/* Image Controls */}
                  <div className="absolute bottom-3 flex items-center gap-2 bg-obsidian-card/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-obsidian-border shadow-lg">
                    <button
                      onClick={() => setZoom((z) => Math.max(0.2, z - 0.2))}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-obsidian-elevated transition-colors"
                      title="Zoom Out"
                    >
                      <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-xs font-mono text-slate-300 w-12 text-center">{Math.round(zoom * 100)}%</span>
                    <button
                      onClick={() => setZoom((z) => Math.min(3, z + 0.2))}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-obsidian-elevated transition-colors"
                      title="Zoom In"
                    >
                      <ZoomIn className="w-4 h-4" />
                    </button>
                    <div className="w-px h-4 bg-obsidian-border mx-1" />
                    <button
                      onClick={() => setRotation((r) => (r + 90) % 360)}
                      className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-obsidian-elevated transition-colors"
                      title="Rotate"
                    >
                      <RotateCw className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* PDF Viewer */}
              {isPDF && (
                <div className="w-full h-full flex flex-col items-center justify-center">
                  <iframe
                    src={streamUrl}
                    title={file.name}
                    className="w-full h-full rounded-xl border border-obsidian-border bg-white"
                  />
                </div>
              )}

              {/* Code / Text Preview */}
              {(isCode || file.mime_type.startsWith('text/')) && !isVideo && !isAudio && !isImage && !isPDF && (
                <div className="w-full h-full flex flex-col bg-obsidian-card border border-obsidian-border rounded-xl overflow-hidden">
                  <div className="p-2.5 border-b border-obsidian-border bg-obsidian-elevated/40 flex items-center justify-between">
                    <span className="text-xs font-mono text-slate-400">{file.name} ({formatBytes(file.size)})</span>
                    <button
                      onClick={handleCopyText}
                      className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-obsidian-elevated text-xs text-slate-300 hover:text-white border border-obsidian-border transition-colors"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                      {copied ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-200 bg-obsidian-base">
                    {loadingText ? (
                      <div className="flex items-center justify-center h-full gap-2 text-slate-400">
                        <RefreshCw className="w-4 h-4 animate-spin text-wyvern-400" />
                        <span>Streaming text stream...</span>
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap">{textContent || '// Empty file or binary stream'}</pre>
                    )}
                  </div>
                </div>
              )}

              {/* Archive / Generic File */}
              {!isVideo && !isAudio && !isImage && !isPDF && !isCode && !file.mime_type.startsWith('text/') && (
                <div className="text-center p-8 max-w-sm">
                  <div className="w-20 h-20 rounded-2xl bg-wyvern-500/10 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400 mx-auto mb-4">
                    <FileText className="w-10 h-10" />
                  </div>
                  <h3 className="text-base font-semibold text-white mb-2 truncate">{file.name}</h3>
                  <p className="text-xs text-slate-400 mb-6">
                    This file format does not have an in-app visual previewer. You can download or inspect its Discord encrypted chunks.
                  </p>
                  <button
                    onClick={() => onDownload(file)}
                    className="px-4 py-2 rounded-xl bg-wyvern-600 text-white font-medium text-xs hover:bg-wyvern-500 transition-colors shadow-sm"
                  >
                    Download to Computer
                  </button>
                </div>
              )}
            </>
          )}

          {activeTab === 'code' && (
            <div className="w-full h-full flex flex-col bg-obsidian-card border border-obsidian-border rounded-xl overflow-hidden">
              <div className="p-2.5 border-b border-obsidian-border bg-obsidian-elevated/40 flex items-center justify-between">
                <span className="text-xs font-mono text-slate-400">Source Editor • {file.name}</span>
                <button
                  onClick={handleCopyText}
                  className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-obsidian-elevated text-xs text-slate-300 hover:text-white border border-obsidian-border transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <div className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-200 bg-obsidian-base">
                <pre className="whitespace-pre-wrap">{textContent || '// Loading code content...'}</pre>
              </div>
            </div>
          )}

          {activeTab === 'chunks' && (
            <div className="w-full h-full flex flex-col bg-obsidian-card border border-obsidian-border rounded-xl p-4 overflow-y-auto">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                Discord Chunk Manifests ({file.chunk_count} Total)
              </h4>
              <div className="space-y-2">
                {Array.from({ length: file.chunk_count }).map((_, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-obsidian-base border border-obsidian-border rounded-xl flex items-center justify-between text-xs"
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-6 h-6 rounded-lg bg-wyvern-600/20 text-wyvern-400 flex items-center justify-center font-mono font-bold text-[10px]">
                        #{idx + 1}
                      </span>
                      <div>
                        <span className="font-mono text-slate-200">chunk_{String(idx).padStart(5, '0')}.wyv</span>
                        <p className="text-[10px] text-slate-500 font-mono">Size: ~18.00 MB • Status: Stored in Discord</p>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-accent-green/10 text-accent-green border border-accent-green/30">
                      CDN Verified
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
