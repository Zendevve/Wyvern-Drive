import React from 'react';
import {
  Search,
  LayoutGrid,
  List,
  UploadCloud,
  FolderPlus,
  ArrowUpDown,
  Activity,
  X,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react';
import { Folder, SortField, SortOrder, ViewCategory, ViewMode } from '../types';

interface HeaderProps {
  currentCategory: ViewCategory;
  currentFolder: Folder | null;
  onNavigateHome: () => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (m: ViewMode) => void;
  sortBy: SortField;
  sortOrder: SortOrder;
  onSortChange: (field: SortField) => void;
  onUploadClick: () => void;
  onNewFolderClick: () => void;
  activeTransfersCount: number;
  onOpenTransfers: () => void;
  webhookConfigured: boolean;
  onOpenSetup: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentCategory,
  currentFolder,
  onNavigateHome,
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  sortOrder,
  onSortChange,
  onUploadClick,
  onNewFolderClick,
  activeTransfersCount,
  onOpenTransfers,
  webhookConfigured,
  onOpenSetup,
}) => {
  const getCategoryTitle = () => {
    if (currentFolder) return currentFolder.name;
    switch (currentCategory) {
      case 'favorites':
        return 'Favorites';
      case 'recent':
        return 'Recent Files';
      case 'media_image':
        return 'Images & Photos';
      case 'media_video':
        return 'Videos & Clips';
      case 'media_audio':
        return 'Audio & Music';
      case 'documents':
        return 'Documents';
      case 'trash':
        return 'Trash';
      default:
        return 'All Files';
    }
  };

  return (
    <header className="h-16 px-6 border-b border-obsidian-border bg-obsidian-card/70 backdrop-blur-md flex items-center justify-between gap-4 select-none z-10">
      {/* Breadcrumbs & Title */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          onClick={onNavigateHome}
          className="text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          Drive
        </button>
        {currentFolder && (
          <>
            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-xs font-medium text-slate-400 truncate max-w-[120px]">
              Folders
            </span>
          </>
        )}
        <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
        <h1 className="text-sm font-bold text-white truncate max-w-[200px]">
          {getCategoryTitle()}
        </h1>
      </div>

      {/* Global Search Bar */}
      <div className="flex-1 max-w-md relative">
        <div className="relative flex items-center">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search files, tags, or extensions..."
            className="w-full pl-9 pr-8 py-1.5 bg-obsidian-elevated/80 border border-obsidian-border rounded-xl text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-wyvern-500/60 focus:ring-1 focus:ring-wyvern-500/40 transition-all"
          />
          {searchQuery ? (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 text-slate-500 hover:text-slate-300"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          ) : (
            <kbd className="absolute right-2.5 px-1.5 py-0.5 text-[10px] font-mono text-slate-500 bg-obsidian-base/60 border border-obsidian-border rounded">
              Ctrl+K
            </kbd>
          )}
        </div>
      </div>

      {/* Action Controls & Views */}
      <div className="flex items-center gap-2.5">
        {!webhookConfigured && (
          <button
            onClick={onOpenSetup}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition-all animate-pulse"
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Setup Webhook</span>
          </button>
        )}

        {/* Transfers Active Indicator */}
        <button
          onClick={onOpenTransfers}
          title="Transfer Center"
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
            activeTransfersCount > 0
              ? 'bg-wyvern-600/20 text-wyvern-300 border-wyvern-500/40 shadow-glow-blurple'
              : 'bg-obsidian-elevated text-slate-400 border-obsidian-border hover:text-slate-200'
          }`}
        >
          <Activity
            className={`w-3.5 h-3.5 ${
              activeTransfersCount > 0 ? 'text-wyvern-400 animate-spin' : 'text-slate-400'
            }`}
          />
          <span className="hidden sm:inline">Transfers</span>
          {activeTransfersCount > 0 && (
            <span className="w-4 h-4 rounded-full bg-wyvern-500 text-[10px] font-mono text-white flex items-center justify-center font-bold">
              {activeTransfersCount}
            </span>
          )}
        </button>

        {/* Sort Trigger */}
        <div className="flex items-center bg-obsidian-elevated border border-obsidian-border rounded-lg p-0.5">
          <button
            onClick={() => onSortChange(sortBy === 'name' ? 'created_at' : sortBy === 'created_at' ? 'size' : 'name')}
            className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-slate-200 font-medium"
            title={`Sorted by ${sortBy} (${sortOrder})`}
          >
            <ArrowUpDown className="w-3 h-3" />
            <span className="capitalize">{sortBy === 'created_at' ? 'Date' : sortBy}</span>
          </button>
        </div>

        {/* Grid / List Switcher */}
        <div className="flex items-center bg-obsidian-elevated border border-obsidian-border rounded-lg p-0.5">
          <button
            onClick={() => onViewModeChange('grid')}
            title="Grid View"
            className={`p-1.5 rounded-md text-xs transition-colors ${
              viewMode === 'grid'
                ? 'bg-wyvern-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onViewModeChange('list')}
            title="List View"
            className={`p-1.5 rounded-md text-xs transition-colors ${
              viewMode === 'list'
                ? 'bg-wyvern-500 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <List className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* New Folder Button */}
        <button
          onClick={onNewFolderClick}
          title="Create New Folder"
          className="p-2 rounded-xl bg-obsidian-elevated hover:bg-obsidian-hover border border-obsidian-border text-slate-300 hover:text-white transition-all"
        >
          <FolderPlus className="w-4 h-4" />
        </button>

        {/* Upload Button */}
        <button
          onClick={onUploadClick}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold text-white bg-gradient-to-r from-wyvern-600 to-wyvern-500 hover:from-wyvern-500 hover:to-wyvern-400 shadow-glow-blurple border border-wyvern-400/30 transition-all transform active:scale-95"
        >
          <UploadCloud className="w-4 h-4" />
          <span>Upload</span>
        </button>
      </div>
    </header>
  );
};
