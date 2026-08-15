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

  const totalBytes = stats?.total_bytes || 0;
  const formattedTotal = formatBytes(totalBytes);

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
            <p className="text-[11px] text-slate-400 font-medium">Discord Cloud Storage</p>
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

        {/* Media Categories */}
        <div>
          <div className="px-3 pb-1.5 text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            Categories
          </div>
          <div className="space-y-0.5">
            {mediaNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = currentCategory === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    onSelectFolder(null);
                    onSelectCategory(item.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                    isActive
                      ? 'bg-wyvern-600/20 text-white border border-wyvern-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-accent-teal' : 'text-slate-400'}`} />
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

        {/* Virtual Folders Tree */}
        <div>
          <div className="px-3 pb-1.5 flex items-center justify-between text-[10px] font-semibold tracking-wider text-slate-500 uppercase">
            <span>Folders</span>
            <button
              onClick={onNewFolder}
              title="Create New Folder"
              className="p-1 rounded hover:bg-obsidian-elevated text-slate-400 hover:text-white transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="space-y-0.5">
            {folders.map((folder) => {
              const isFolderActive = currentCategory === 'all' && currentFolderId === folder.id;
              return (
                <button
                  key={folder.id}
                  onClick={() => {
                    onSelectCategory('all');
                    onSelectFolder(folder.id);
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
                    isFolderActive
                      ? 'bg-wyvern-600/20 text-white border border-wyvern-500/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60'
                  }`}
                >
                  <div className="flex items-center gap-2.5 truncate">
                    <div
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: folder.color || '#5865F2' }}
                    />
                    <span className="truncate">{folder.name}</span>
                  </div>
                  <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
                </button>
              );
            })}
            {folders.length === 0 && (
              <div className="px-3 py-2 text-[11px] text-slate-600 italic">No custom folders</div>
            )}
          </div>
        </div>

        {/* Trash */}
        <div className="pt-2 border-t border-obsidian-border">
          <button
            onClick={() => {
              onSelectFolder(null);
              onSelectCategory('trash');
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-medium transition-all duration-150 ${
              currentCategory === 'trash'
                ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                : 'text-slate-400 hover:text-slate-200 hover:bg-obsidian-elevated/60'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-400" />
            <span>Trash</span>
          </button>
        </div>
      </div>

      {/* Storage & Webhook Health Widget */}
      <div className="p-3 border-t border-obsidian-border bg-obsidian-base/60 space-y-3">
        {/* Storage Bar */}
        <div className="glass-panel p-2.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center gap-1.5 font-medium text-slate-300">
              <Zap className="w-3.5 h-3.5 text-wyvern-400" />
              <span>Storage Used</span>
            </div>
            <span className="font-mono text-slate-200 text-[11px] font-semibold">{formattedTotal}</span>
          </div>
          
          <div className="w-full bg-obsidian-border h-1.5 rounded-full overflow-hidden flex">
            <div className="bg-wyvern-500 h-full w-[45%]" title="Videos & Media" />
            <div className="bg-accent-cyan h-full w-[25%]" title="Images" />
            <div className="bg-accent-emerald h-full w-[20%]" title="Documents" />
            <div className="bg-accent-amber h-full w-[10%]" title="Archives" />
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-500">
            <span>Discord Backed</span>
            <span className="text-accent-emerald font-medium">Unlimited</span>
          </div>
        </div>

        {/* Webhook Status & Settings Button */}
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2">
            <div
              className={`w-2 h-2 rounded-full ${
                webhookConfigured ? 'bg-emerald-400 shadow-glow-emerald animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="text-[11px] text-slate-400 font-medium truncate max-w-[120px]">
              {webhookConfigured ? (webhookName || 'Vault Online') : 'Setup Required'}
            </span>
          </div>
          <button
            onClick={onOpenSettings}
            title="Settings & Webhook Configuration"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-obsidian-elevated transition-colors"
          >
            <Settings className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
