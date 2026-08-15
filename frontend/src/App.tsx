import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FileGrid } from './components/FileGrid';
import { FileList } from './components/FileList';
import { OnboardingWizard } from './components/OnboardingWizard';
import { TransferCenter } from './components/TransferCenter';
import { FilePreviewModal } from './components/FilePreviewModal';
import { FileInspectorModal } from './components/FileInspectorModal';
import { SettingsModal } from './components/SettingsModal';
import { NewFolderModal } from './components/NewFolderModal';
import { RenameModal } from './components/RenameModal';
import { ConfirmModal } from './components/ConfirmModal';
import { DropZone } from './components/DropZone';
import {
  AppSettings,
  FileItem,
  Folder,
  SortField,
  SortOrder,
  StorageStats,
  Transfer,
  ViewCategory,
  ViewMode,
} from './types';
import { api } from './services/api';

export const App: React.FC = () => {
  // State
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [files, setFiles] = useState<FileItem[]>([]);
  const [stats, setStats] = useState<StorageStats | null>(null);
  const [transfers, setTransfers] = useState<Transfer[]>([]);

  // Navigation & Filtering
  const [currentCategory, setCurrentCategory] = useState<ViewCategory>('all');
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');
  const [sortBy, setSortBy] = useState<SortField>('created_at');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [selectedFileIds, setSelectedFileIds] = useState<string[]>([]);

  // Modals & Drawers
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);
  const [showSettings, setShowSettings] = useState<boolean>(false);
  const [showTransfers, setShowTransfers] = useState<boolean>(false);
  const [showNewFolder, setShowNewFolder] = useState<boolean>(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [inspectFile, setInspectFile] = useState<FileItem | null>(null);
  const [renamingItem, setRenamingItem] = useState<{ id: string; name: string; isFolder: boolean } | null>(null);
  const [confirmDialog, setConfirmDialog] = useState<{
    title: string;
    message: string;
    confirmLabel?: string;
    isDanger?: boolean;
    onConfirm: () => void;
  } | null>(null);

  const [isDragging, setIsDragging] = useState<boolean>(false);

  // Load Initial Configuration
  const loadInitialData = useCallback(async () => {
    try {
      const s = await api.getSettings();
      setSettings(s);
      if (!s.setup_completed || !s.webhook_url) {
        setShowOnboarding(true);
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadInitialData();
  }, [loadInitialData]);

  // Load Folders & Stats
  const refreshStructure = useCallback(async () => {
    try {
      const [fList, st] = await Promise.all([
        api.listFolders(null),
        api.getStats(),
      ]);
      setFolders(fList);
      setStats(st);
    } catch (err) {
      console.error('Failed to load folders/stats:', err);
    }
  }, []);

  // Load Files based on view/folder/search
  const refreshFiles = useCallback(async () => {
    try {
      if (searchQuery.trim()) {
        const results = await api.searchFiles(searchQuery.trim());
        setFiles(results);
      } else {
        const res = await api.listFiles(
          currentFolderId,
          currentCategory,
          sortBy,
          sortOrder,
          200,
          0
        );
        setFiles(res.files);
      }
    } catch (err) {
      console.error('Failed to load files:', err);
    }
  }, [currentFolderId, currentCategory, sortBy, sortOrder, searchQuery]);

  useEffect(() => {
    refreshStructure();
  }, [refreshStructure]);

  useEffect(() => {
    refreshFiles();
  }, [refreshFiles]);

  // Polling for Transfers
  useEffect(() => {
    const interval = setInterval(async () => {
      try {
        const trs = await api.getTransfers();
        setTransfers(trs);
        // Refresh file list if active transfer finished
        const running = trs.some((t) => t.status === 'running');
        if (running) {
          refreshFiles();
          refreshStructure();
        }
      } catch (err) {
        // quiet polling error
      }
    }, 1500);
    return () => clearInterval(interval);
  }, [refreshFiles, refreshStructure]);

  // Drag and Drop Handling
  useEffect(() => {
    let dragCounter = 0;

    const handleDragEnter = (e: DragEvent) => {
      e.preventDefault();
      dragCounter++;
      if (e.dataTransfer?.types.includes('Files')) {
        setIsDragging(true);
      }
    };

    const handleDragLeave = (e: DragEvent) => {
      e.preventDefault();
      dragCounter--;
      if (dragCounter <= 0) {
        setIsDragging(false);
      }
    };

    const handleDragOver = (e: DragEvent) => {
      e.preventDefault();
    };

    const handleDrop = async (e: DragEvent) => {
      e.preventDefault();
      dragCounter = 0;
      setIsDragging(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        // Trigger select and upload dialog or direct upload
        await api.selectAndUploadFiles(currentFolderId);
        refreshFiles();
        refreshStructure();
      }
    };

    window.addEventListener('dragenter', handleDragEnter);
    window.addEventListener('dragleave', handleDragLeave);
    window.addEventListener('dragover', handleDragOver);
    window.addEventListener('drop', handleDrop);

    return () => {
      window.removeEventListener('dragenter', handleDragEnter);
      window.removeEventListener('dragleave', handleDragLeave);
      window.removeEventListener('dragover', handleDragOver);
      window.removeEventListener('drop', handleDrop);
    };
  }, [currentFolderId, refreshFiles, refreshStructure]);

  // Keyboard Shortcuts (Ctrl+K for search)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const searchInput = document.querySelector('input[placeholder*="Search"]') as HTMLInputElement;
        searchInput?.focus();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Actions
  const handleUploadClick = async () => {
    try {
      await api.selectAndUploadFiles(currentFolderId);
      refreshFiles();
      refreshStructure();
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleCreateFolder = async (name: string, color: string) => {
    try {
      await api.createFolder(currentFolderId, name, color, 'folder');
      setShowNewFolder(false);
      refreshStructure();
    } catch (err) {
      console.error('Folder creation failed:', err);
    }
  };

  const handleToggleFavorite = async (file: FileItem, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const isFav = await api.toggleFavorite(file.id);
      setFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, favorite: isFav } : f))
      );
      refreshStructure();
    } catch (err) {
      console.error('Failed to toggle favorite:', err);
    }
  };

  const handleDeleteFile = (file: FileItem) => {
    const isTrash = currentCategory === 'trash';
    setConfirmDialog({
      title: isTrash ? 'Permanently Delete File' : 'Move File to Trash',
      message: isTrash
        ? `Are you sure you want to permanently purge "${file.name}" and delete its Discord chunks?`
        : `Move "${file.name}" to trash? You can restore it anytime.`,
      confirmLabel: isTrash ? 'Delete Permanently' : 'Move to Trash',
      isDanger: isTrash,
      onConfirm: async () => {
        await api.deleteFile(file.id, isTrash);
        setConfirmDialog(null);
        refreshFiles();
        refreshStructure();
      },
    });
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      await api.downloadFileWithDialog(file.id);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleRename = async (newName: string) => {
    if (!renamingItem) return;
    try {
      if (renamingItem.isFolder) {
        await api.renameFolder(renamingItem.id, newName);
        refreshStructure();
      } else {
        await api.renameFile(renamingItem.id, newName);
        refreshFiles();
      }
      setRenamingItem(null);
    } catch (err) {
      console.error('Rename failed:', err);
    }
  };

  const handleToggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedFileIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const currentFolder = folders.find((f) => f.id === currentFolderId) || null;
  const activeTransfersCount = transfers.filter((t) => t.status === 'running').length;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-obsidian-base text-slate-400">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-wyvern-500/20 border border-wyvern-500 flex items-center justify-center animate-pulse">
            <span className="font-bold text-wyvern-400">W</span>
          </div>
          <span className="text-xs font-mono">Initializing Wyvern Engine...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-obsidian-base overflow-hidden relative">
      {/* Drag & Drop Overlay */}
      <DropZone isDragging={isDragging} />

      {/* Main Sidebar */}
      <Sidebar
        currentCategory={currentCategory}
        onSelectCategory={(cat) => {
          setCurrentCategory(cat);
          setCurrentFolderId(null);
          setSearchQuery('');
        }}
        currentFolderId={currentFolderId}
        onSelectFolder={(id) => {
          setCurrentFolderId(id);
          setCurrentCategory('all');
          setSearchQuery('');
        }}
        folders={folders}
        stats={stats}
        onOpenSettings={() => setShowSettings(true)}
        onNewFolder={() => setShowNewFolder(true)}
        webhookConfigured={!!settings?.webhook_url && !!settings?.setup_completed}
        webhookName={settings?.webhook_name}
      />

      {/* Center Viewport */}
      <div className="flex-1 flex flex-col min-w-0 bg-obsidian-base relative overflow-hidden">
        {/* Top Header */}
        <Header
          currentCategory={currentCategory}
          currentFolder={currentFolder}
          onNavigateHome={() => {
            setCurrentFolderId(null);
            setCurrentCategory('all');
            setSearchQuery('');
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field) => {
            if (sortBy === field) {
              setSortOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
            } else {
              setSortBy(field);
              setSortOrder('desc');
            }
          }}
          onUploadClick={handleUploadClick}
          onNewFolderClick={() => setShowNewFolder(true)}
          activeTransfersCount={activeTransfersCount}
          onOpenTransfers={() => setShowTransfers(true)}
          webhookConfigured={!!settings?.webhook_url && !!settings?.setup_completed}
          onOpenSetup={() => setShowOnboarding(true)}
        />

        {/* Main Content Area */}
        <main className="flex-1 overflow-y-auto">
          {viewMode === 'grid' ? (
            <FileGrid
              folders={currentCategory === 'all' && !searchQuery ? folders.filter((f) => f.parent_id === (currentFolderId || null)) : []}
              files={files}
              selectedFileIds={selectedFileIds}
              onToggleSelect={handleToggleSelect}
              onOpenFolder={(id) => setCurrentFolderId(id)}
              onPreviewFile={(f) => setPreviewFile(f)}
              onInspectFile={(f) => setInspectFile(f)}
              onDownloadFile={handleDownloadFile}
              onToggleFavorite={handleToggleFavorite}
              onDeleteFile={handleDeleteFile}
              onRenameFile={(f) => setRenamingItem({ id: f.id, name: f.name, isFolder: false })}
            />
          ) : (
            <FileList
              folders={currentCategory === 'all' && !searchQuery ? folders.filter((f) => f.parent_id === (currentFolderId || null)) : []}
              files={files}
              selectedFileIds={selectedFileIds}
              onToggleSelect={handleToggleSelect}
              onOpenFolder={(id) => setCurrentFolderId(id)}
              onPreviewFile={(f) => setPreviewFile(f)}
              onInspectFile={(f) => setInspectFile(f)}
              onDownloadFile={handleDownloadFile}
              onToggleFavorite={handleToggleFavorite}
              onDeleteFile={handleDeleteFile}
              onRenameFile={(f) => setRenamingItem({ id: f.id, name: f.name, isFolder: false })}
            />
          )}
        </main>
      </div>

      {/* Floating / Sliding Transfer Center */}
      {showTransfers && (
        <TransferCenter
          transfers={transfers}
          onClose={() => setShowTransfers(false)}
          onCancelTransfer={(id) => api.cancelTransfer(id)}
          onClearCompleted={() => api.clearCompletedTransfers()}
        />
      )}

      {/* Onboarding Wizard Modal */}
      {showOnboarding && (
        <OnboardingWizard
          onComplete={(newSettings) => {
            setSettings(newSettings);
            setShowOnboarding(false);
            refreshStructure();
            refreshFiles();
          }}
          onCancel={settings?.setup_completed ? () => setShowOnboarding(false) : undefined}
        />
      )}

      {/* Settings Modal */}
      {showSettings && settings && (
        <SettingsModal
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSave={(updated) => {
            setSettings(updated);
            refreshStructure();
          }}
        />
      )}

      {/* Media Preview Modal */}
      {previewFile && (
        <FilePreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownloadFile}
          onInspect={(f) => {
            setPreviewFile(null);
            setInspectFile(f);
          }}
        />
      )}

      {/* File Inspector Modal */}
      {inspectFile && (
        <FileInspectorModal
          file={inspectFile}
          onClose={() => setInspectFile(null)}
        />
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <NewFolderModal
          onClose={() => setShowNewFolder(false)}
          onCreate={handleCreateFolder}
        />
      )}

      {/* Rename Modal */}
      {renamingItem && (
        <RenameModal
          initialName={renamingItem.name}
          onClose={() => setRenamingItem(null)}
          onRename={handleRename}
        />
      )}

      {/* Confirmation Dialog */}
      {confirmDialog && (
        <ConfirmModal
          title={confirmDialog.title}
          message={confirmDialog.message}
          confirmLabel={confirmDialog.confirmLabel}
          isDanger={confirmDialog.isDanger}
          onClose={() => setConfirmDialog(null)}
          onConfirm={confirmDialog.onConfirm}
        />
      )}
    </div>
  );
};
