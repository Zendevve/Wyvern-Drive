import React, { useState, useEffect } from 'react';
import {
  X,
  FolderSync,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Folder as FolderIcon,
  HardDrive,
} from 'lucide-react';
import { Folder, SyncFolder } from '../types';
import { api, formatDate } from '../services/api';

interface SyncFoldersModalProps {
  folders: Folder[];
  onClose: () => void;
}

export const SyncFoldersModal: React.FC<SyncFoldersModalProps> = ({ folders, onClose }) => {
  const [syncFolders, setSyncFolders] = useState<SyncFolder[]>([]);
  const [localPath, setLocalPath] = useState<string>('');
  const [selectedFolderId, setSelectedFolderId] = useState<string>('');
  const [syncing, setSyncing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadSyncFolders = () => {
    api.listSyncFolders().then(setSyncFolders).catch(() => {});
  };

  useEffect(() => {
    loadSyncFolders();
  }, []);

  const handleSelectDirectory = async () => {
    try {
      const path = await api.selectDirectory();
      if (path) setLocalPath(path);
    } catch {}
  };

  const handleAddSyncFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!localPath.trim()) {
      setError('Please select a local folder to synchronize');
      return;
    }

    try {
      await api.createSyncFolder(localPath.trim(), selectedFolderId || null);
      setLocalPath('');
      setSelectedFolderId('');
      setError(null);
      loadSyncFolders();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to register sync folder');
    }
  };

  const handleToggleSync = async (sf: SyncFolder) => {
    await api.updateSyncFolder({
      ...sf,
      enabled: !sf.enabled,
    });
    loadSyncFolders();
  };

  const handleDeleteSync = async (id: string) => {
    await api.deleteSyncFolder(id);
    loadSyncFolders();
  };

  const handleSyncNow = async () => {
    setSyncing(true);
    await api.syncFoldersNow();
    setTimeout(() => {
      setSyncing(false);
      loadSyncFolders();
    }, 1200);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-obsidian-base/80 backdrop-blur-md p-4 select-none animate-fadeIn">
      <div className="bg-obsidian-card border border-obsidian-border rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-obsidian-border flex items-center justify-between bg-obsidian-elevated/40">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent-cyan/10 border border-accent-cyan/30 flex items-center justify-center text-accent-cyan">
              <FolderSync className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Background Auto-Sync Folders</h2>
              <p className="text-[11px] text-slate-400">Continuous directory watchers syncing local folders to Discord</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSyncNow}
              disabled={syncing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-wyvern-600/30 text-wyvern-400 hover:text-white hover:bg-wyvern-600 border border-wyvern-500/30 text-xs font-medium transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncing ? 'animate-spin' : ''}`} />
              Sync Now
            </button>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleAddSyncFolder} className="p-4 border-b border-obsidian-border bg-obsidian-base/40 space-y-3">
          <div className="text-xs font-semibold text-slate-300">Add Directory to Watch & Sync</div>

          {error && (
            <div className="p-2.5 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="sm:col-span-2 flex items-center gap-1.5">
              <input
                type="text"
                placeholder="C:\Users\Documents\MyFolder..."
                value={localPath}
                onChange={(e) => setLocalPath(e.target.value)}
                className="flex-1 bg-obsidian-card border border-obsidian-border rounded-xl px-3 py-2 text-xs font-mono text-white placeholder-slate-500 outline-none focus:border-wyvern-500"
              />
              <button
                type="button"
                onClick={handleSelectDirectory}
                className="px-3 py-2 rounded-xl bg-obsidian-elevated hover:bg-obsidian-border text-xs text-slate-300 border border-obsidian-border"
              >
                Browse...
              </button>
            </div>

            <select
              value={selectedFolderId}
              onChange={(e) => setSelectedFolderId(e.target.value)}
              className="bg-obsidian-card border border-obsidian-border rounded-xl px-3 py-2 text-xs text-white outline-none focus:border-wyvern-500"
            >
              <option value="">(Root Vault)</option>
              {folders.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-wyvern-600 hover:bg-wyvern-500 text-white text-xs font-medium transition-colors shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              Register Sync Directory
            </button>
          </div>
        </form>

        {/* Sync Folders List */}
        <div className="p-4 flex-1 overflow-y-auto space-y-2">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-2">
            Watched Local Folders ({syncFolders.length})
          </div>

          {syncFolders.length === 0 ? (
            <div className="text-center py-8 text-xs text-slate-500">
              No directories configured for background synchronization yet.
            </div>
          ) : (
            syncFolders.map((sf) => (
              <div
                key={sf.id}
                className="p-3 bg-obsidian-base border border-obsidian-border rounded-xl flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      sf.enabled ? 'bg-accent-cyan' : 'bg-slate-600'
                    }`}
                  />
                  <div className="min-w-0">
                    <span className="text-xs font-mono text-white truncate block">{sf.local_path}</span>
                    <p className="text-[10px] text-slate-400">
                      Status: <span className="font-semibold text-slate-300 capitalize">{sf.sync_status}</span> • Last Synced: {sf.last_sync_time ? formatDate(sf.last_sync_time) : 'Never'}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleToggleSync(sf)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors ${
                      sf.enabled
                        ? 'bg-accent-cyan/10 text-accent-cyan border-accent-cyan/30 hover:bg-accent-cyan/20'
                        : 'bg-obsidian-elevated text-slate-400 border-obsidian-border hover:text-white'
                    }`}
                  >
                    {sf.enabled ? 'Active' : 'Paused'}
                  </button>

                  <button
                    onClick={() => handleDeleteSync(sf.id)}
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
