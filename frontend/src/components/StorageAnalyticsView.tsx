import React, { useState, useEffect } from 'react';
import {
  PieChart,
  HardDrive,
  Zap,
  Server,
  Network,
  Share2,
  ShieldCheck,
  CheckCircle2,
  Layers,
  Copy,
  Check,
  FolderSync,
  RefreshCw,
} from 'lucide-react';
import { GatewayStatus, StorageStats, WebhookShard } from '../types';
import { api, formatBytes } from '../services/api';

interface StorageAnalyticsViewProps {
  stats: StorageStats | null;
  onOpenShards: () => void;
  onOpenSync: () => void;
}

export const StorageAnalyticsView: React.FC<StorageAnalyticsViewProps> = ({
  stats,
  onOpenShards,
  onOpenSync,
}) => {
  const [gateways, setGateways] = useState<GatewayStatus | null>(null);
  const [shards, setShards] = useState<WebhookShard[]>([]);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    api.getGatewaysStatus().then(setGateways).catch(() => {});
    api.listWebhookShards().then(setShards).catch(() => {});
  }, []);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const totalBytes = stats?.total_bytes || 0;
  const dedupBytes = stats?.deduplicated_bytes || 0;

  const categories = [
    { name: 'Videos', count: stats?.category_counts['videos'] || 0, bytes: stats?.category_bytes['videos'] || 0, color: 'bg-red-500' },
    { name: 'Images', count: stats?.category_counts['images'] || 0, bytes: stats?.category_bytes['images'] || 0, color: 'bg-emerald-500' },
    { name: 'Documents', count: stats?.category_counts['documents'] || 0, bytes: stats?.category_bytes['documents'] || 0, color: 'bg-blue-500' },
    { name: 'Audio', count: stats?.category_counts['audio'] || 0, bytes: stats?.category_bytes['audio'] || 0, color: 'bg-amber-500' },
    { name: 'Archives', count: stats?.category_counts['archives'] || 0, bytes: stats?.category_bytes['archives'] || 0, color: 'bg-purple-500' },
  ];

  return (
    <div className="flex-1 overflow-y-auto p-6 space-y-6 animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <PieChart className="w-5 h-5 text-wyvern-400" />
            Storage & Gateway Analytics
          </h1>
          <p className="text-xs text-slate-400">Enterprise metrics, deduplication savings, and OS drive gateways</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onOpenShards}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-elevated text-xs text-slate-200 hover:text-white border border-obsidian-border transition-colors"
          >
            <Network className="w-4 h-4 text-wyvern-400" />
            Webhook Shards ({shards.length})
          </button>
          <button
            onClick={onOpenSync}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-obsidian-elevated text-xs text-slate-200 hover:text-white border border-obsidian-border transition-colors"
          >
            <FolderSync className="w-4 h-4 text-accent-cyan" />
            Sync Folders
          </button>
        </div>
      </div>

      {/* Top Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-obsidian-card border border-obsidian-border rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Vault Stored Data</span>
            <HardDrive className="w-4 h-4 text-wyvern-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{formatBytes(totalBytes)}</div>
          <p className="text-[11px] text-slate-500 mt-1">{stats?.total_files || 0} Files • {stats?.total_chunks || 0} Encrypted Chunks</p>
        </div>

        <div className="p-4 bg-obsidian-card border border-obsidian-border rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Deduplication Savings</span>
            <Zap className="w-4 h-4 text-accent-cyan" />
          </div>
          <div className="text-xl font-bold text-accent-cyan font-mono">+{formatBytes(dedupBytes)}</div>
          <p className="text-[11px] text-slate-500 mt-1">{stats?.deduplicated_chunks || 0} Duplicate Chunks Prevented</p>
        </div>

        <div className="p-4 bg-obsidian-card border border-obsidian-border rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Active Webhook Shards</span>
            <Network className="w-4 h-4 text-accent-green" />
          </div>
          <div className="text-xl font-bold text-white font-mono">{stats?.active_shards || shards.filter(s => s.is_active).length || 1} Shards</div>
          <p className="text-[11px] text-slate-500 mt-1">Multi-Channel Rate-Limit Evasion Active</p>
        </div>

        <div className="p-4 bg-obsidian-card border border-obsidian-border rounded-2xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-slate-400 font-medium">Security & Cryptography</span>
            <ShieldCheck className="w-4 h-4 text-wyvern-400" />
          </div>
          <div className="text-xl font-bold text-white font-mono">AES-256-GCM</div>
          <p className="text-[11px] text-slate-500 mt-1">Argon2id Key Derivation</p>
        </div>
      </div>

      {/* Category Breakdown Bar */}
      <div className="p-5 bg-obsidian-card border border-obsidian-border rounded-2xl space-y-4">
        <h2 className="text-xs font-semibold text-slate-300 uppercase tracking-wider">File Category Distribution</h2>
        
        {/* Multi-color stacked bar */}
        <div className="h-3 w-full rounded-full bg-obsidian-base overflow-hidden flex">
          {categories.map((cat) => {
            const pct = totalBytes > 0 ? (cat.bytes / totalBytes) * 100 : 0;
            if (pct <= 0) return null;
            return <div key={cat.name} style={{ width: `${pct}%` }} className={`${cat.color} h-full transition-all`} title={`${cat.name}: ${pct.toFixed(1)}%`} />;
          })}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-2">
          {categories.map((cat) => (
            <div key={cat.name} className="flex items-center gap-2">
              <div className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
              <div>
                <div className="text-xs font-medium text-slate-200">{cat.name}</div>
                <div className="text-[11px] text-slate-400 font-mono">{formatBytes(cat.bytes)} ({cat.count})</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* OS Drive Gateways (WebDAV & S3) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* WebDAV Card */}
        <div className="p-5 bg-obsidian-card border border-obsidian-border rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-wyvern-500/10 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">Native WebDAV Server</h3>
                <p className="text-[11px] text-slate-400">Mount vault directly in Windows Explorer, macOS Finder, or rclone</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-green/10 text-accent-green border border-accent-green/30">
              <CheckCircle2 className="w-3 h-3" />
              PORT {gateways?.webdav.port || 49153}
            </span>
          </div>

          <div className="p-3 bg-obsidian-base rounded-xl border border-obsidian-border flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300 truncate">
              {gateways?.webdav.url || 'http://127.0.0.1:49153/webdav'}
            </span>
            <button
              onClick={() => handleCopy(gateways?.webdav.url || 'http://127.0.0.1:49153/webdav', 'webdav')}
              className="p-1.5 rounded-lg bg-obsidian-elevated text-slate-400 hover:text-white border border-obsidian-border ml-2"
            >
              {copiedKey === 'webdav' ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1 bg-obsidian-elevated/30 p-2.5 rounded-lg border border-obsidian-border/50">
            <p className="font-semibold text-slate-300">Windows Explorer Quick Mount:</p>
            <code className="text-wyvern-400 font-mono text-[10px] block">
              net use Z: http://127.0.0.1:49153/webdav
            </code>
          </div>
        </div>

        {/* S3 Gateway Card */}
        <div className="p-5 bg-obsidian-card border border-obsidian-border rounded-2xl space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan">
                <HardDrive className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-white">S3 REST API Gateway</h3>
                <p className="text-[11px] text-slate-400">Target for Restic, Kopia, Cyberduck, and AWS CLI backups</p>
              </div>
            </div>
            <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-accent-cyan/10 text-accent-cyan border border-accent-cyan/30">
              <CheckCircle2 className="w-3 h-3" />
              PORT {gateways?.s3.port || 49154}
            </span>
          </div>

          <div className="p-3 bg-obsidian-base rounded-xl border border-obsidian-border flex items-center justify-between">
            <span className="text-xs font-mono text-slate-300 truncate">
              {gateways?.s3.url || 'http://127.0.0.1:49154'}
            </span>
            <button
              onClick={() => handleCopy(gateways?.s3.url || 'http://127.0.0.1:49154', 's3')}
              className="p-1.5 rounded-lg bg-obsidian-elevated text-slate-400 hover:text-white border border-obsidian-border ml-2"
            >
              {copiedKey === 's3' ? <Check className="w-3.5 h-3.5 text-accent-green" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>

          <div className="text-[11px] text-slate-400 space-y-1 bg-obsidian-elevated/30 p-2.5 rounded-lg border border-obsidian-border/50">
            <p className="font-semibold text-slate-300">Restic / S3 Endpoint Config:</p>
            <code className="text-accent-cyan font-mono text-[10px] block">
              s3:http://127.0.0.1:49154/wyvern-vault
            </code>
          </div>
        </div>
      </div>
    </div>
  );
};
