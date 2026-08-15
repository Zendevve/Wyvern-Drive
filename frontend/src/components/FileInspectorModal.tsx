import React, { useState, useEffect } from 'react';
import {
  X,
  ShieldCheck,
  Layers,
  Copy,
  Check,
  ExternalLink,
  Lock,
  Database,
  Hash,
  Clock,
  HardDrive,
} from 'lucide-react';
import { FileItem } from '../types';
import { api, formatBytes, formatDate } from '../services/api';

interface FileInspectorModalProps {
  file: FileItem;
  onClose: () => void;
}

export const FileInspectorModal: React.FC<FileInspectorModalProps> = ({ file, onClose }) => {
  const [detailedFile, setDetailedFile] = useState<FileItem>(file);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    api.getFileDetails(file.id).then((f) => {
      if (f) setDetailedFile(f);
    });
  }, [file.id]);

  const copyToClipboard = (text: string, field: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const chunks = detailedFile.chunks || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/90 backdrop-blur-xl p-6 select-none">
      <div className="w-full max-w-3xl max-h-[85vh] bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-teal/20 border border-accent-teal/30 flex items-center justify-center text-accent-teal">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                File Manifest & Chunk Inspector
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">{file.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Metadata Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="glass-panel p-3 rounded-xl">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <HardDrive className="w-3.5 h-3.5 text-wyvern-400" />
                <span>Total Size</span>
              </div>
              <p className="text-xs font-mono font-bold text-white mt-1">
                {formatBytes(detailedFile.size)}
              </p>
            </div>

            <div className="glass-panel p-3 rounded-xl">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Layers className="w-3.5 h-3.5 text-accent-cyan" />
                <span>Chunk Count</span>
              </div>
              <p className="text-xs font-mono font-bold text-white mt-1">
                {detailedFile.chunk_count} Chunks
              </p>
            </div>

            <div className="glass-panel p-3 rounded-xl">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Lock className="w-3.5 h-3.5 text-emerald-400" />
                <span>Encryption</span>
              </div>
              <p className="text-xs font-mono font-bold text-emerald-400 mt-1">
                {detailedFile.is_encrypted ? 'AES-256-GCM' : 'Plaintext'}
              </p>
            </div>

            <div className="glass-panel p-3 rounded-xl">
              <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                <Clock className="w-3.5 h-3.5 text-pink-400" />
                <span>Uploaded</span>
              </div>
              <p className="text-xs font-mono font-bold text-white mt-1">
                {formatDate(detailedFile.created_at)}
              </p>
            </div>
          </div>

          {/* SHA-256 Checksum Bar */}
          <div className="glass-panel p-3.5 rounded-xl space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                <Hash className="w-3.5 h-3.5 text-accent-cyan" />
                <span>SHA-256 Integrity Checksum</span>
              </span>
              <button
                onClick={() => copyToClipboard(detailedFile.sha256, 'sha256')}
                className="flex items-center gap-1 text-[11px] text-wyvern-400 hover:text-wyvern-300 font-mono"
              >
                {copiedField === 'sha256' ? (
                  <>
                    <Check className="w-3 h-3 text-emerald-400" />
                    <span className="text-emerald-400">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3 h-3" />
                    <span>Copy Hash</span>
                  </>
                )}
              </button>
            </div>
            <div className="p-2 bg-obsidian-base rounded-lg border border-obsidian-border font-mono text-[11px] text-slate-300 break-all select-all">
              {detailedFile.sha256}
            </div>
          </div>

          {/* Chunk Manifest Table */}
          <div className="space-y-2.5">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-wyvern-400" />
              <span>Discord Attachment Chunks ({chunks.length})</span>
            </h4>

            <div className="border border-obsidian-border rounded-xl overflow-hidden bg-obsidian-elevated/40">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-obsidian-elevated border-b border-obsidian-border text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    <th className="py-2.5 px-3 w-16">Index</th>
                    <th className="py-2.5 px-3 w-24">Size</th>
                    <th className="py-2.5 px-3">Message ID</th>
                    <th className="py-2.5 px-3">Attachment URL</th>
                    <th className="py-2.5 px-3 w-28">Nonce</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-obsidian-border/50 font-mono text-[11px]">
                  {chunks.map((c) => (
                    <tr key={c.id} className="hover:bg-obsidian-elevated/60 transition-colors">
                      <td className="py-2 px-3 text-wyvern-400 font-bold">#{c.chunk_index}</td>
                      <td className="py-2 px-3 text-slate-300">{formatBytes(c.size)}</td>
                      <td className="py-2 px-3 text-slate-400 truncate max-w-[120px]" title={c.message_id}>
                        {c.message_id}
                      </td>
                      <td className="py-2 px-3 text-accent-cyan truncate max-w-[200px]">
                        <a
                          href={c.attachment_url}
                          target="_blank"
                          rel="noreferrer"
                          className="hover:underline flex items-center gap-1"
                        >
                          <span className="truncate">{c.attachment_url}</span>
                          <ExternalLink className="w-3 h-3 flex-shrink-0" />
                        </a>
                      </td>
                      <td className="py-2 px-3 text-slate-500 truncate max-w-[100px]" title={c.nonce || 'N/A'}>
                        {c.nonce ? c.nonce.slice(0, 12) + '...' : 'N/A'}
                      </td>
                    </tr>
                  ))}
                  {chunks.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-slate-500 italic font-sans">
                        No chunk breakdown available for this file.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-obsidian-border bg-obsidian-card flex items-center justify-between">
          <span className="text-[11px] text-slate-500">
            Stored in Discord Channel ID: {file.folder_id || 'Root'}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold text-white bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
