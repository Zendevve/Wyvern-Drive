import React from 'react';
import { UploadCloud, ShieldCheck, Zap } from 'lucide-react';

interface DropZoneProps {
  isDragging: boolean;
}

export const DropZone: React.FC<DropZoneProps> = ({ isDragging }) => {
  if (!isDragging) return null;

  return (
    <div className="fixed inset-0 z-50 bg-obsidian-base/90 backdrop-blur-md flex items-center justify-center p-8 pointer-events-none select-none">
      <div className="w-full max-w-xl border-2 border-dashed border-wyvern-400 bg-wyvern-950/40 rounded-3xl p-12 flex flex-col items-center justify-center text-center shadow-glow-blurple animate-pulse-slow">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-wyvern-600 to-accent-cyan flex items-center justify-center text-white mb-6 shadow-glow-cyan animate-bounce">
          <UploadCloud className="w-10 h-10" />
        </div>

        <h2 className="text-xl font-bold text-white tracking-wide">
          Drop Files to Upload to Discord Vault
        </h2>
        <p className="text-xs text-slate-400 mt-2 max-w-sm">
          Files will be chunked into 18MB encrypted slices with AES-256-GCM and stored directly into your Discord channel.
        </p>

        <div className="flex items-center gap-6 mt-6 pt-6 border-t border-obsidian-border text-xs text-slate-400">
          <span className="flex items-center gap-1.5 text-accent-cyan">
            <Zap className="w-4 h-4" />
            <span>Parallel Chunker</span>
          </span>
          <span className="flex items-center gap-1.5 text-emerald-400">
            <ShieldCheck className="w-4 h-4" />
            <span>End-to-End Encrypted</span>
          </span>
        </div>
      </div>
    </div>
  );
};
