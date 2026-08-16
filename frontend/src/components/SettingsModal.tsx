import React, { useState } from 'react';
import {
  X,
  Settings as SettingsIcon,
  Zap,
  Lock,
  Radio,
  Sliders,
  Database,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Key,
  ShieldCheck,
  Server,
  HardDrive,
  Bot,
  Layers,
  FolderSync,
} from 'lucide-react';
import { AppSettings, WebhookInfo } from '../types';
import { api, formatBytes } from '../services/api';

interface SettingsModalProps {
  settings: AppSettings;
  onClose: () => void;
  onSave: (updated: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings: initialSettings,
  onClose,
  onSave,
}) => {
  const [settings, setSettings] = useState<AppSettings>({ ...initialSettings });
  const [testingWebhook, setTestingWebhook] = useState<boolean>(false);
  const [webhookInfo, setWebhookInfo] = useState<WebhookInfo | null>(null);
  const [webhookError, setWebhookError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [exportSuccess, setExportSuccess] = useState<boolean>(false);

  const testWebhook = async () => {
    if (!settings.webhook_url.trim()) {
      setWebhookError('Please enter a valid webhook URL');
      return;
    }
    setTestingWebhook(true);
    setWebhookError(null);
    try {
      const info = await api.validateWebhook(settings.webhook_url.trim());
      setWebhookInfo(info);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to validate webhook';
      setWebhookError(message);
      setWebhookInfo(null);
    } finally {
      setTestingWebhook(false);
    }
  };

  const handleSave = async () => {
    await api.saveSettings(settings);
    onSave(settings);
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
      onClose();
    }, 1000);
  };

  const handleExportBackup = async () => {
    try {
      const json = await api.exportMetadata();
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `wyvern_drive_backup_${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportSuccess(true);
      setTimeout(() => setExportSuccess(false), 2500);
    } catch (err) {
      console.error(err);
    }
  };

  const chunkSizeMB = Math.round(settings.chunk_size_bytes / (1024 * 1024));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/90 backdrop-blur-xl p-4 sm:p-6 select-none animate-fadeIn">
      <div className="w-full max-w-2xl max-h-[90vh] bg-obsidian-card border border-obsidian-border rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between bg-obsidian-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-wyvern-500/20 border border-wyvern-500/30 flex items-center justify-center text-wyvern-400">
              <SettingsIcon className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider">
                Enterprise Cloud Configuration
              </h3>
              <p className="text-[10px] text-slate-400">Manage Discord webhooks, OS drives, CAS deduplication & keys</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Settings Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Section 1: Discord Webhook & Bot Token */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-wyvern-400" />
              <span>Primary Discord Webhook & Credentials</span>
            </h4>

            <div className="space-y-2">
              <div>
                <label className="text-[11px] text-slate-300 font-medium mb-1 block">Storage Webhook URL</label>
                <input
                  type="password"
                  value={settings.webhook_url}
                  onChange={(e) => setSettings({ ...settings, webhook_url: e.target.value })}
                  placeholder="https://discord.com/api/webhooks/..."
                  className="w-full px-3.5 py-2 bg-obsidian-elevated border border-obsidian-border rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-wyvern-500"
                />
              </div>

              <div>
                <label className="text-[11px] text-slate-300 font-medium mb-1 flex items-center gap-1.5">
                  <Bot className="w-3.5 h-3.5 text-accent-cyan" />
                  <span>Discord Bot Token (Optional - for 2024 Signed CDN URL Auto-Refresh)</span>
                </label>
                <input
                  type="password"
                  value={settings.bot_token || ''}
                  onChange={(e) => setSettings({ ...settings, bot_token: e.target.value })}
                  placeholder="Bot token for automatic attachment URL refresh..."
                  className="w-full px-3.5 py-2 bg-obsidian-elevated border border-obsidian-border rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-wyvern-500"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={testWebhook}
                  disabled={testingWebhook || !settings.webhook_url}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border transition-all flex items-center gap-1.5 disabled:opacity-50"
                >
                  <Zap className="w-3.5 h-3.5 text-accent-cyan" />
                  <span>{testingWebhook ? 'Testing...' : 'Test Connection'}</span>
                </button>

                {webhookInfo && (
                  <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>{webhookInfo.name} ({webhookInfo.latency_ms}ms ping)</span>
                  </span>
                )}
              </div>

              {webhookError && (
                <div className="p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{webhookError}</span>
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Gateways (WebDAV & S3) */}
          <div className="space-y-3 pt-4 border-t border-obsidian-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-accent-cyan" />
              <span>OS Drive Gateways (WebDAV & S3)</span>
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* WebDAV toggle */}
              <div className="p-3 bg-obsidian-elevated border border-obsidian-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Enable WebDAV Server</span>
                  <input
                    type="checkbox"
                    checked={settings.webdav_enabled}
                    onChange={(e) => setSettings({ ...settings, webdav_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-wyvern-500 bg-obsidian-base border-obsidian-border"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Port:</span>
                  <input
                    type="number"
                    value={settings.webdav_port || 49153}
                    onChange={(e) => setSettings({ ...settings, webdav_port: parseInt(e.target.value, 10) || 49153 })}
                    className="w-20 px-2 py-1 bg-obsidian-base border border-obsidian-border rounded-lg text-xs font-mono text-white"
                  />
                </div>
              </div>

              {/* S3 toggle */}
              <div className="p-3 bg-obsidian-elevated border border-obsidian-border rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-white">Enable S3 Gateway</span>
                  <input
                    type="checkbox"
                    checked={settings.s3_enabled}
                    onChange={(e) => setSettings({ ...settings, s3_enabled: e.target.checked })}
                    className="w-4 h-4 rounded text-wyvern-500 bg-obsidian-base border-obsidian-border"
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[11px] text-slate-400">Port:</span>
                  <input
                    type="number"
                    value={settings.s3_port || 49154}
                    onChange={(e) => setSettings({ ...settings, s3_port: parseInt(e.target.value, 10) || 49154 })}
                    className="w-20 px-2 py-1 bg-obsidian-base border border-obsidian-border rounded-lg text-xs font-mono text-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Performance, Deduplication & Streaming */}
          <div className="space-y-3 pt-4 border-t border-obsidian-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Sliders className="w-3.5 h-3.5 text-accent-green" />
              <span>Deduplication & Streaming Cache</span>
            </h4>

            <div className="space-y-3">
              {/* CAS Deduplication toggle */}
              <div className="flex items-center justify-between p-3 bg-obsidian-elevated border border-obsidian-border rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-white">Content-Addressable Deduplication (CAS)</span>
                  <p className="text-[10px] text-slate-400">Instant 0s uploads for duplicate or modified files by reusing chunk hashes</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.deduplication_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, deduplication_enabled: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-wyvern-500 bg-obsidian-base border-obsidian-border focus:ring-wyvern-500"
                />
              </div>

              {/* Lookahead Prefetch toggle */}
              <div className="flex items-center justify-between p-3 bg-obsidian-elevated border border-obsidian-border rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-white">Streaming Lookahead Prefetcher</span>
                  <p className="text-[10px] text-slate-400">Pre-buffers next 2 chunks in parallel during 4K video playback</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.prefetch_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, prefetch_enabled: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-wyvern-500 bg-obsidian-base border-obsidian-border focus:ring-wyvern-500"
                />
              </div>

              {/* Chunk Size Slider */}
              <div className="space-y-1.5 pt-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300 font-medium">Chunk Slice Size</span>
                  <span className="font-mono text-wyvern-400 font-bold">{chunkSizeMB} MB</span>
                </div>
                <input
                  type="range"
                  min="2"
                  max="20"
                  step="1"
                  value={chunkSizeMB}
                  onChange={(e) =>
                    setSettings({
                      ...settings,
                      chunk_size_bytes: parseInt(e.target.value, 10) * 1024 * 1024,
                    })
                  }
                  className="w-full h-1.5 bg-obsidian-elevated rounded-lg appearance-none cursor-pointer accent-wyvern-500"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>2 MB</span>
                  <span className="text-emerald-400">18 MB (Discord Safe)</span>
                  <span>20 MB (Nitro Max)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: AES-256 Encryption */}
          <div className="space-y-3 pt-4 border-t border-obsidian-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Lock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Zero-Knowledge AES-256-GCM Security</span>
            </h4>

            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-obsidian-elevated border border-obsidian-border rounded-xl">
                <div>
                  <span className="text-xs font-semibold text-white">Client-Side Encryption</span>
                  <p className="text-[10px] text-slate-400">Argon2id key derivation with 12-byte random nonces per chunk</p>
                </div>
                <input
                  type="checkbox"
                  checked={settings.encryption_enabled}
                  onChange={(e) =>
                    setSettings({ ...settings, encryption_enabled: e.target.checked })
                  }
                  className="w-4 h-4 rounded text-wyvern-500 bg-obsidian-base border-obsidian-border focus:ring-wyvern-500"
                />
              </div>

              {settings.encryption_enabled && (
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300 flex items-center justify-between">
                    <span>Master Encryption Passphrase</span>
                    <button
                      type="button"
                      onClick={() =>
                        setSettings({
                          ...settings,
                          master_key: 'wyvern-vault-key-' + Math.random().toString(36).slice(2, 14),
                        })
                      }
                      className="text-[11px] text-wyvern-400 hover:text-wyvern-300"
                    >
                      Generate New
                    </button>
                  </label>
                  <div className="relative">
                    <Key className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
                    <input
                      type="text"
                      value={settings.master_key}
                      onChange={(e) => setSettings({ ...settings, master_key: e.target.value })}
                      className="w-full pl-9 pr-3.5 py-2 bg-obsidian-elevated border border-obsidian-border rounded-xl text-xs font-mono text-slate-200 focus:outline-none focus:border-wyvern-500"
                    />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Vault Backup */}
          <div className="space-y-3 pt-4 border-t border-obsidian-border">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
              <Database className="w-3.5 h-3.5 text-accent-amber" />
              <span>Vault Manifest Backup</span>
            </h4>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleExportBackup}
                className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium text-white bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border transition-colors"
              >
                <Download className="w-3.5 h-3.5 text-accent-emerald" />
                <span>{exportSuccess ? 'Backup Exported!' : 'Export Encrypted Manifest JSON'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-obsidian-border bg-obsidian-card flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-medium text-slate-400 hover:text-white bg-obsidian-elevated transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleSave}
            className="px-5 py-2 rounded-xl text-xs font-semibold text-white bg-wyvern-600 hover:bg-wyvern-500 shadow-glow-blurple transition-all flex items-center gap-2"
          >
            {saveSuccess ? <CheckCircle2 className="w-4 h-4" /> : null}
            <span>{saveSuccess ? 'Settings Saved' : 'Save Changes'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
