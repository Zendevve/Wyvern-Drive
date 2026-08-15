import React from 'react';
import {
  X,
  UploadCloud,
  DownloadCloud,
  CheckCircle2,
  AlertCircle,
  Clock,
  Trash2,
  Radio,
  Zap,
  StopCircle,
} from 'lucide-react';
import { Transfer } from '../types';
import { formatBytes } from '../services/api';

interface TransferCenterProps {
  transfers: Transfer[];
  onClose: () => void;
  onCancelTransfer: (transferId: string) => void;
  onClearCompleted: () => void;
}

export const TransferCenter: React.FC<TransferCenterProps> = ({
  transfers,
  onClose,
  onCancelTransfer,
  onClearCompleted,
}) => {
  const activeTransfers = transfers.filter((t) => t.status === 'running' || t.status === 'queued');
  const pastTransfers = transfers.filter((t) => t.status !== 'running' && t.status !== 'queued');

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-obsidian-card/95 backdrop-blur-2xl border-l border-obsidian-border shadow-2xl z-40 flex flex-col justify-between select-none">
      {/* Header */}
      <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-wyvern-500/20 border border-wyvern-500/40 flex items-center justify-center text-wyvern-400">
            <Radio className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-white uppercase tracking-wider">
              Transfer Center
            </h3>
            <p className="text-[10px] text-slate-400 font-mono">
              {activeTransfers.length} Active • {transfers.length} Total
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {pastTransfers.length > 0 && (
            <button
              onClick={onClearCompleted}
              title="Clear completed"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated transition-colors text-xs"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Transfer List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
        {transfers.length === 0 ? (
          <div className="h-64 flex flex-col items-center justify-center text-center text-slate-500">
            <Zap className="w-8 h-8 text-slate-600 mb-2" />
            <p className="text-xs font-medium">No transfer activity</p>
            <span className="text-[10px] text-slate-600">Uploads and downloads will appear here</span>
          </div>
        ) : (
          transfers.map((t) => {
            const isUpload = t.type === 'upload';
            const isRunning = t.status === 'running';
            const isCompleted = t.status === 'completed';
            const isFailed = t.status === 'failed';
            const isCancelled = t.status === 'cancelled';

            const progress = t.progress_percent || (t.total_bytes > 0 ? (t.transferred_bytes / t.total_bytes) * 100 : 0);

            return (
              <div
                key={t.id}
                className="glass-card p-3 rounded-xl border border-obsidian-border space-y-2.5"
              >
                {/* Title & Type Icon */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 truncate">
                    {isUpload ? (
                      <UploadCloud className="w-4 h-4 text-wyvern-400 flex-shrink-0" />
                    ) : (
                      <DownloadCloud className="w-4 h-4 text-accent-cyan flex-shrink-0" />
                    )}
                    <span className="text-xs font-medium text-white truncate" title={t.filename}>
                      {t.filename}
                    </span>
                  </div>

                  {/* Status Badges */}
                  <div>
                    {isRunning && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-wyvern-500/20 text-wyvern-400 border border-wyvern-500/40 animate-pulse">
                        {Math.round(progress)}%
                      </span>
                    )}
                    {isCompleted && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>Done</span>
                      </span>
                    )}
                    {isFailed && (
                      <span className="flex items-center gap-1 text-[10px] font-mono text-rose-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>Failed</span>
                      </span>
                    )}
                    {isCancelled && (
                      <span className="text-[10px] font-mono text-slate-500">Cancelled</span>
                    )}
                  </div>
                </div>

                {/* Progress Bar */}
                <div className="w-full bg-obsidian-elevated h-1.5 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-300 ${
                      isCompleted
                        ? 'bg-emerald-500'
                        : isFailed
                        ? 'bg-rose-500'
                        : 'bg-gradient-to-r from-wyvern-500 to-accent-cyan'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
                  />
                </div>

                {/* Transfer Metrics Footer */}
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <div className="flex items-center gap-2">
                    <span>
                      {formatBytes(t.transferred_bytes)} / {formatBytes(t.total_bytes)}
                    </span>
                    {isRunning && t.speed_bps > 0 && (
                      <span className="text-accent-cyan font-semibold">
                        {formatBytes(t.speed_bps)}/s
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {t.chunks_total > 0 && (
                      <span>
                        Chunk {t.chunks_done}/{t.chunks_total}
                      </span>
                    )}
                    {isRunning && (
                      <button
                        onClick={() => onCancelTransfer(t.id)}
                        title="Cancel Transfer"
                        className="text-slate-500 hover:text-rose-400 transition-colors"
                      >
                        <StopCircle className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer info */}
      <div className="p-3 border-t border-obsidian-border bg-obsidian-base/60 text-[10px] text-slate-500 text-center">
        Powered by Discord Webhook Attachment Pipeline
      </div>
    </div>
  );
};
