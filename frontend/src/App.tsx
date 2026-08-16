import React, { useState, useEffect, useCallback } from 'react';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { FileGrid } from './components/FileGrid';
import { FileList } from './components/FileList';
import { OnboardingWizard } from './components/OnboardingWizard';
import { TransferCenter } from './components/TransferCenter';
import { UniversalViewerModal } from './components/UniversalViewerModal';
import { FileInspectorModal } from './components/FileInspectorModal';
import { SettingsModal } from './components/SettingsModal';
import { NewFolderModal } from './components/NewFolderModal';
import { RenameModal } from './components/RenameModal';
import { ConfirmModal } from './components/ConfirmModal';
import { DropZone } from './components/DropZone';
import { StorageAnalyticsView } from './components/StorageAnalyticsView';
import { ShareModal } from './components/ShareModal';
import { WebhookPoolModal } from './components/WebhookPoolModal';
import { SyncFoldersModal } from './components/SyncFoldersModal';
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
  const [showShards, setShowShards] = useState<boolean>(false);
  const [showSync, setShowSync] = useState<boolean>(false);
  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [inspectFile, setInspectFile] = useState<FileItem | null>(null);
  const [shareFile, setShareFile] = useState<FileItem | null>(null);
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
    if (currentCategory !== 'analytics') {
      refreshFiles();
    }
  }, [refreshFiles, currentCategory]);

  // Poll transfers
  useEffect(() => {
    const fetchTransfers = async () => {
      try {
        const tList = await api.getTransfers();
        setTransfers(tList);
      } catch {}
    };

    fetchTransfers();
    const interval = setInterval(fetchTransfers, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleUploadFiles = async () => {
    try {
      await api.selectAndUploadFiles(currentFolderId);
      refreshFiles();
      refreshStructure();
      setShowTransfers(true);
    } catch (err) {
      console.error('Upload failed:', err);
    }
  };

  const handleDownloadFile = async (file: FileItem) => {
    try {
      await api.downloadFileWithDialog(file.id);
      setShowTransfers(true);
    } catch (err) {
      console.error('Download failed:', err);
    }
  };

  const handleToggleFavorite = async (file: FileItem) => {
    try {
      await api.toggleFavorite(file.id);
      refreshFiles();
    } catch (err) {
      console.error('Toggle favorite failed:', err);
    }
  };

  const handleDeleteFile = (file: FileItem, permanent: boolean = false) => {
    setConfirmDialog({
      title: permanent ? 'Permanently Delete File' : 'Move to Trash',
      message: permanent
        ? `Are you sure you want to permanently delete "${file.name}"? This action cannot be undone.`
        : `Move "${file.name}" to Trash? You can restore it later.`,
      confirmLabel: permanent ? 'Delete Permanently' : 'Move to Trash',
      isDanger: true,
      onConfirm: async () => {
        try {
          await api.deleteFile(file.id, permanent);
          refreshFiles();
          refreshStructure();
        } catch (err) {
          console.error('Delete file failed:', err);
        } finally {
          setConfirmDialog(null);
        }
      },
    });
  };

  const handleRestoreFile = async (file: FileItem) => {
    try {
      await api.restoreFile(file.id);
      refreshFiles();
      refreshStructure();
    } catch (err) {
      console.error('Restore file failed:', err);
    }
  };

  const handleCreateFolder = async (name: string, color: string, icon: string) => {
    try {
      await api.createFolder(currentFolderId, name, color, icon);
      refreshStructure();
      setShowNewFolder(false);
    } catch (err) {
      console.error('Create folder failed:', err);
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

  const activeTransfersCount = transfers.filter((t) => t.status === 'running').length;

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-obsidian-base text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-wyvern-600/20 flex items-center justify-center animate-pulse">
            <img src="/icon.png" alt="Wyvern Drive" className="w-8 h-8" />
          </div>
          <p className="text-sm font-medium text-slate-400">Initializing Wyvern Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen bg-obsidian-base overflow-hidden relative font-sans">
      {/* Drag and Drop Zone */}
      <DropZone isDragging={isDragging} />

      {/* Main Sidebar Navigation */}
      <Sidebar
        currentCategory={currentCategory}
        onSelectCategory={(cat) => {
          setCurrentCategory(cat);
          setSearchQuery('');
        }}
        currentFolderId={currentFolderId}
        onSelectFolder={(fId) => {
          setCurrentFolderId(fId);
          setSearchQuery('');
        }}
        folders={folders}
        stats={stats}
        onOpenSettings={() => setShowSettings(true)}
        onNewFolder={() => setShowNewFolder(true)}
        webhookConfigured={!!settings?.webhook_url}
        webhookName={settings?.webhook_name}
        onOpenShards={() => setShowShards(true)}
        onOpenSync={() => setShowSync(true)}
      />

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-obsidian-base relative overflow-hidden">
        <Header
          currentCategory={currentCategory}
          currentFolder={folders.find((f) => f.id === currentFolderId) || null}
          onNavigateHome={() => {
            setCurrentFolderId(null);
            setCurrentCategory('all');
          }}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          viewMode={viewMode}
          onViewModeChange={setViewMode}
          sortBy={sortBy}
          sortOrder={sortOrder}
          onSortChange={(field) => {
            if (sortBy === field) {
              setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
            } else {
              setSortBy(field);
              setSortOrder('asc');
            }
          }}
          onUploadClick={handleUploadFiles}
          onNewFolderClick={() => setShowNewFolder(true)}
          activeTransfersCount={activeTransfersCount}
          onOpenTransfers={() => setShowTransfers(true)}
          webhookConfigured={!!settings?.webhook_url}
          onOpenSetup={() => setShowSettings(true)}
        />

        <main className="flex-1 overflow-y-auto">
          {currentCategory === 'analytics' ? (
            <StorageAnalyticsView
              stats={stats}
              onOpenShards={() => setShowShards(true)}
              onOpenSync={() => setShowSync(true)}
            />
          ) : viewMode === 'grid' ? (
            <FileGrid
              files={files}
              selectedFileIds={selectedFileIds}
              onSelectFile={(id) => {
                setSelectedFileIds((prev) =>
                  prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                );
              }}
              onOpenFile={(f) => setPreviewFile(f)}
              onDownloadFile={handleDownloadFile}
              onToggleFavorite={handleToggleFavorite}
              onDeleteFile={handleDeleteFile}
              onRestoreFile={handleRestoreFile}
              onRenameFile={(f) => setRenamingItem({ id: f.id, name: f.name, isFolder: false })}
              onInspectFile={(f) => setInspectFile(f)}
              onShareFile={(f) => setShareFile(f)}
              isTrash={currentCategory === 'trash'}
            />
          ) : (
            <FileList
              files={files}
              selectedFileIds={selectedFileIds}
              onSelectFile={(id) => {
                setSelectedFileIds((prev) =>
                  prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
                );
              }}
              onOpenFile={(f) => setPreviewFile(f)}
              onDownloadFile={handleDownloadFile}
              onToggleFavorite={handleToggleFavorite}
              onDeleteFile={handleDeleteFile}
              onRestoreFile={handleRestoreFile}
              onRenameFile={(f) => setRenamingItem({ id: f.id, name: f.name, isFolder: false })}
              onInspectFile={(f) => setInspectFile(f)}
              onShareFile={(f) => setShareFile(f)}
              isTrash={currentCategory === 'trash'}
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

      {/* Universal Media & Document Studio */}
      {previewFile && (
        <UniversalViewerModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onDownload={handleDownloadFile}
          onInspect={(f) => {
            setPreviewFile(null);
            setInspectFile(f);
          }}
          onShare={(f) => {
            setPreviewFile(null);
            setShareFile(f);
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

      {/* Zero-Knowledge Share Modal */}
      {shareFile && (
        <ShareModal
          file={shareFile}
          onClose={() => setShareFile(null)}
        />
      )}

      {/* Multi-Webhook Shards Modal */}
      {showShards && (
        <WebhookPoolModal
          onClose={() => {
            setShowShards(false);
            refreshStructure();
          }}
        />
      )}

      {/* Sync Folders Modal */}
      {showSync && (
        <SyncFoldersModal
          folders={folders}
          onClose={() => setShowSync(false)}
        />
      )}

      {/* New Folder Modal */}
      {showNewFolder && (
        <NewFolderModal
          onClose={() => setShowNewFolder(false)}
          onCreate={(name, color) => handleCreateFolder(name, color, 'folder')}
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
