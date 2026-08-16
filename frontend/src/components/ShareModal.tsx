import React, { useState, useEffect } from 'react';
import {
  X,
  Share2,
  Lock,
  Copy,
  Check,
  ShieldCheck,
  ExternalLink,
  Key,
  Info,
} from 'lucide-react';
import { FileItem, ShareLinkResult } from '../types';
import { api } from '../services/api';

interface ShareModalProps {
  file: FileItem;
  onClose: () => void;
}

export const ShareModal: React.FC<ShareModalProps> = ({ file, onClose }) => {
  const [shareData, setShareData] = useState<ShareLinkResult | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);

  useEffect(() => {
    api
      .generateShareLink(file.id)
      .then((res) => {
        setShareData(res);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, [file.id]);

  const handleCopy = () => {
    if (shareData) {
      navigator.clipboard.writeText(shareData.share_url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/80 backdrop-blur-md p-4 select-none animate-fadeIn">
      <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
        {/* Header */}
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between bg-obsidian-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-wyvern-500/10 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400">
              <Share2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Zero-Knowledge Share Link</h2>
              <p className="text-[11px] text-slate-400 truncate max-w-xs">{file.name}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <div className="p-3 bg-accent-cyan/10 border border-accent-cyan/20 rounded-xl flex items-start gap-2.5">
            <ShieldCheck className="w-4 h-4 text-accent-cyan flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-300">
              The decryption key is embedded in the URL fragment (<code className="text-accent-cyan font-mono">#key=...</code>). The key is parsed entirely client-side and is <strong>never transmitted</strong> to Discord or any server.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Encrypted Share URL</label>
            <div className="flex items-center gap-2">
              <input
                type="text"
                readOnly
                value={shareData?.share_url || 'Generating secure link...'}
                className="flex-1 bg-obsidian-base border border-obsidian-border rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all outline-none focus:border-wyvern-500"
              />
              <button
                onClick={handleCopy}
                disabled={!shareData}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-wyvern-600 hover:bg-wyvern-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
              >
                {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {shareData && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-wyvern-400" />
                Raw Ephemeral Key
              </label>
              <div className="p-2.5 bg-obsidian-base border border-obsidian-border rounded-xl font-mono text-[11px] text-slate-400 break-all select-all">
                {shareData.share_key}
              </div>
            </div>
          )}

          <div className="p-3 bg-obsidian-base rounded-xl border border-obsidian-border text-[11px] text-slate-400 space-y-1">
            <div className="flex items-center gap-1.5 text-slate-300 font-medium">
              <Info className="w-3.5 h-3.5 text-wyvern-400" />
              How recipient streams or downloads:
            </div>
            <p>
              When the recipient opens the link in their browser or in Wyvern Drive, the client reads the key hash and streams encrypted chunks from Discord CDN, decrypting in real-time in memory.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-obsidian-border bg-obsidian-elevated/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-obsidian-elevated text-xs font-medium text-slate-200 hover:text-white border border-obsidian-border transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
