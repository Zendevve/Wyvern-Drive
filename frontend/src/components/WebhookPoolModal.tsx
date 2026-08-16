import React, { useState, useEffect } from 'react';
import {
  X,
  Network,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Activity,
  Shield,
  Layers,
  Zap,
} from 'lucide-react';
import { WebhookShard } from '../types';
import { api } from '../services/api';

interface WebhookPoolModalProps {
  onClose: () => void;
}

export const WebhookPoolModal: React.FC<WebhookPoolModalProps> = ({ onClose }) => {
  const [shards, setShards] = useState<WebhookShard[]>([]);
  const [name, setName] = useState<string>('');
  const [url, setUrl] = useState<string>('');
  const [priority, setPriority] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadShards = () => {
    api.listWebhookShards().then(setShards).catch(() => {});
  };

  useEffect(() => {
    loadShards();
  }, []);

  const handleAddShard = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !url.trim()) {
      setError('Please provide shard name and webhook URL');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await api.createWebhookShard(name.trim(), url.trim(), '', '', priority);
      setName('');
      setUrl('');
      setPriority(1);
      loadShards();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to add webhook shard');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleShard = async (shard: WebhookShard) => {
    await api.updateWebhookShard({
      ...shard,
      is_active: !shard.is_active,
    });
    loadShards();
  };

  const handleDeleteShard = async (id: string) => {
    await api.deleteWebhookShard(id);
    loadShards();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/80 backdrop-blur-md p-4 select-none animate-fadeIn">
      <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between bg-obsidian-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-wyvern-500/10 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400">
              <Network className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Multi-Channel Webhook Pool</h2>
              <p className="text-[11px] text-slate-400">Stripes uploads across multiple Discord channels to bypass rate limits</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form to add shard */}
        <form onSubmit={handleAddShard} className="p-4 border-b border-obsidian-border bg-obsidian-base/40 space-y-3">
          <div className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
            <Zap className="w-3.5 h-3.5 text-accent-cyan" />
            Add New Channel Shard
          </div>

          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <input
              type="text"
              placeholder="Shard Name (e.g. Channel #vault-2)"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-obsidian-card border border-obsidian-border rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 outline-none focus:border-wyvern-500"
            />
            <input
              type="text"
              placeholder="https://discord.com/api/webhooks/..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              className="sm:col-span-2 bg-obsidian-card border border-obsidian-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-wyvern-500"
            />
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={loading}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-wyvern-600 hover:bg-wyvern-500 text-white text-xs font-medium transition-colors shadow-sm disabled:opacity-50"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Shard to Pool
            </button>
          </div>
        </form>

        {/* Shards List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Active Shards ({shards.length})
          </div>

          {shards.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No extra shards configured. Transfers use the primary fallback webhook.
            </div>
          ) : (
            shards.map((shard) => (
              <div
                key={shard.id}
                className="p-3 bg-obsidian-base border border-obsidian-border rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      shard.is_active ? 'bg-accent-green' : 'bg-slate-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold text-white truncate">{shard.name}</span>
                      <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-obsidian-elevated text-slate-400 border border-obsidian-border">
                        Priority {shard.priority}
                      </span>
                    </div>
                    <p className="text-[11px] font-mono text-slate-400 truncate max-w-md">{shard.url}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleShard(shard)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      shard.is_active
                        ? 'bg-accent-green/10 text-accent-green border-accent-green/30 hover:bg-accent-green/20'
                        : 'bg-obsidian-elevated text-slate-400 border-obsidian-border hover:text-white'
                    }`}
                  >
                    {shard.is_active ? 'Enabled' : 'Disabled'}
                  </button>

                  <button
                    onClick={() => handleDeleteShard(shard.id)}
                    className="p-1.5 text-slate-500 hover:text-red-400 rounded-lg hover:bg-obsidian-elevated transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-obsidian-border bg-obsidian-elevated/30 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-obsidian-elevated text-xs font-medium text-slate-200 hover:text-white border border-obsidian-border transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
