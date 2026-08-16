import React from 'react';
import {
  Folder as FolderIcon,
  HardDrive,
  Star,
  Clock,
  Image as ImageIcon,
  Video,
  Music,
  FileText,
  Trash2,
  Settings,
  Plus,
  Radio,
  Lock,
  ChevronRight,
  ShieldCheck,
  Zap,
  PieChart,
  Network,
  FolderSync,
  Server,
} from 'lucide-react';
import { Folder, StorageStats, ViewCategory } from '../types';
import { formatBytes } from '../services/api';

interface SidebarProps {
  currentCategory: ViewCategory;
  onSelectCategory: (cat: ViewCategory) => void;
  currentFolderId: string | null;
  onSelectFolder: (folderId: string | null) => void;
  folders: Folder[];
  stats: StorageStats | null;
  onOpenSettings: () => void;
  onNewFolder: () => void;
  webhookConfigured: boolean;
  webhookName?: string;
  onOpenShards: () => void;
  onOpenSync: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentCategory,
  onSelectCategory,
  currentFolderId,
  onSelectFolder,
  folders,
  stats,
  onOpenSettings,
  onNewFolder,
  webhookConfigured,
  webhookName,
  onOpenShards,
  onOpenSync,
}) => {
  const mainNavItems = [
    { id: 'all' as ViewCategory, label: 'All Files', icon: HardDrive, count: stats?.total_files },
    { id: 'favorites' as ViewCategory, label: 'Favorites', icon: Star, count: undefined },
    { id: 'recent' as ViewCategory, label: 'Recent', icon: Clock, count: undefined },
  ];

  const mediaNavItems = [
    { id: 'media_image' as ViewCategory, label: 'Images & Photos', icon: ImageIcon, count: stats?.category_counts['images'] },
    { id: 'media_video' as ViewCategory, label: 'Videos & Clips', icon: Video, count: stats?.category_counts['videos'] },
    { id: 'media_audio' as ViewCategory, label: 'Audio & Music', icon: Music, count: stats?.category_counts['audio'] },
    { id: 'documents' as ViewCategory, label: 'Documents', icon: FileText, count: stats?.category_counts['documents'] },
  ];

  const enterpriseTools = [
    { id: 'analytics' as ViewCategory, label: 'Storage Analytics', icon: PieChart },
  ];

  const totalBytes = stats?.total_bytes || 0;
  const formattedTotal = formatBytes(totalBytes);
  const dedupBytes = stats?.deduplicated_bytes || 0;

  return (
    <aside className="w-64 flex flex-col h-full bg-obsidian-card/90 border-r border-obsidian-border select-none z-20 flex-shrink-0">
      {/* Brand Header */}
      <div className="p-4 border-b border-obsidian-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-wyvern-600 via-wyvern-500 to-accent-cyan flex items-center justify-center shadow-glow-blurple p-1">
            <img src="/icon.png" alt="Wyvern Emblem" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <span className="font-bold text-sm tracking-wide text-gradient-blurple">WYVERN</span>
              <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-wyvern-500/20 text-wyvern-400 border border-wyvern-500/30">
                DRIVE
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">Enterprise Discord Cloud</p>
          </div>
        </div>
      </div>

      {/* Navigation Links */}
      <div className="flex-1 overflow-y-auto px-3 py-3 space-y-5">
        {/* Quick Main Nav */}
        <div className="space-y-0.5">
          {mainNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentCategory === item.id && currentFolderId === null;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectFolder(null);
                  onSelectCategory(item.id);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                  isActive
                    ? 'bg-wyvern-600/20 text-white border border-wyvern-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <Icon className={`w-4 h-4 ${isActive ? 'text-wyvern-400' : 'text-slate-400'}`} />
                  <span>{item.label}</span>
                </div>
                {item.count !== undefined && item.count > 0 && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-obsidian-elevated text-slate-400 border border-obsidian-border font-mono">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Enterprise Tools */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Cloud Engine
          </div>
          <div className="space-y-0.5">
            {enterpriseTools.map((item) => {
              const Icon = item.icon;
              const isActive = currentCategory === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectFolder(null);
                    onSelectCategory(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-wyvern-600/20 text-white border border-wyvern-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-wyvern-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                </button>
              );
            })}

            <button
              onClick={onOpenShards}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <Network className="w-4 h-4 text-wyvern-400" />
                <span>Webhook Shards</span>
              </div>
              <span className="text-[10px] px-1.5 py-0.2 rounded bg-wyvern-500/10 text-wyvern-400 border border-wyvern-500/20 font-mono">
                {stats?.total_shards || 1}
              </span>
            </button>

            <button
              onClick={onOpenSync}
              className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60 transition-colors"
            >
              <div className="flex items-center gap-2.5">
                <FolderSync className="w-4 h-4 text-accent-cyan" />
                <span>Auto-Sync Folders</span>
              </div>
            </button>
          </div>
        </div>

        {/* Media Categories */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Categories
          </div>
          <div className="space-y-0.5">
            {mediaNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentCategory === item.id && currentFolderId === null;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectFolder(null);
                    onSelectCategory(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-wyvern-600/20 text-white border border-wyvern-500/40 shadow-sm'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-wyvern-400' : 'text-slate-400'}`} />
                    <span>{item.label}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-obsidian-elevated text-slate-400 border border-obsidian-border font-mono">
                      {item.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Virtual Folders */}
        <div>
          <div className="flex items-center justify-between px-3 pb-1.5">
            <span className="text-[10px] font-semibold tracking-wider text-slate-500 uppercase">Folders</span>
            <button
              onClick={onNewFolder}
              className="p-1 rounded text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
              title="New Folder"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="space-y-0.5">
            {folders.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-slate-500 italic">No folders created yet</p>
            ) : (
              folders.map((folder) => {
                const isSelected = currentFolderId === folder.id;
                return (
                  <button
                    key={folder.id}
                    onClick={() => {
                      onSelectCategory('all');
                      onSelectFolder(folder.id);
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? 'bg-wyvern-600/20 text-white border border-wyvern-500/40 shadow-sm'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <FolderIcon
                        className="w-4 h-4 flex-shrink-0"
                        style={{ color: folder.color || '#3B82F6' }}
                      />
                      <span className="truncate">{folder.name}</span>
                    </div>
                    {folder.file_count !== undefined && folder.file_count > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-obsidian-elevated text-slate-400 border border-obsidian-border font-mono">
                        {folder.file_count}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* Trash */}
        <div className="pt-2 border-t border-obsidian-border/50">
          <button
            onClick={() => {
              onSelectFolder(null);
              onSelectCategory('trash');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              currentCategory === 'trash'
                ? 'bg-red-500/20 text-red-300 border border-red-500/30'
                : 'text-slate-400 hover:text-red-400 hover:bg-obsidian-elevated/60'
            }`}
          >
            <Trash2 className="w-4 h-4" />
            <span>Trash Bin</span>
          </button>
        </div>
      </div>

      {/* Storage Footer Info */}
      <div className="p-3 border-t border-obsidian-border bg-obsidian-elevated/20 space-y-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Vault Usage</span>
          <span className="text-white font-semibold font-mono">{formattedTotal}</span>
        </div>

        {/* Deduplication Pill */}
        {dedupBytes > 0 && (
          <div className="flex items-center justify-between px-2 py-1 rounded-lg bg-accent-cyan/10 border border-accent-cyan/20 text-[10px]">
            <span className="text-accent-cyan font-medium flex items-center gap-1">
              <Zap className="w-3 h-3" /> Deduplication
            </span>
            <span className="text-white font-mono font-bold">+{formatBytes(dedupBytes)}</span>
          </div>
        )}

        {/* Webhook Connection Indicator */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${webhookConfigured ? 'bg-accent-green shadow-glow-green' : 'bg-amber-500'}`} />
            <span className="text-[11px] text-slate-400 truncate max-w-[120px]">
              {webhookConfigured ? (webhookName || 'Discord Shards Active') : 'No Webhook'}
            </span>
          </div>

          <button
            onClick={onOpenSettings}
            className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
