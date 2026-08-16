import {
  AppSettings,
  FileItem,
  FileListResult,
  Folder,
  GatewayStatus,
  ShareLinkResult,
  StorageStats,
  SyncFolder,
  Transfer,
  WebhookInfo,
  WebhookShard,
} from '../types';

declare global {
  interface Window {
    go?: {
      main?: {
        App?: {
          ValidateWebhook(url: string): Promise<WebhookInfo>;
          GetSettings(): Promise<AppSettings>;
          SaveSettings(settings: AppSettings): Promise<void>;
          GetStats(): Promise<StorageStats>;
          ListFolders(parentId?: string | null): Promise<Folder[]>;
          CreateFolder(parentId: string | null | undefined, name: string, color: string, icon: string): Promise<Folder>;
          RenameFolder(id: string, newName: string): Promise<void>;
          DeleteFolder(id: string, recursive: boolean): Promise<void>;
          ListFiles(folderId?: string | null, filter?: string, sortBy?: string, sortOrder?: string, limit?: number, offset?: number): Promise<FileListResult>;
          SearchFiles(query: string): Promise<FileItem[]>;
          GetFile(id: string): Promise<FileItem>;
          GetFileDetails(id: string): Promise<FileItem>;
          RenameFile(id: string, newName: string): Promise<void>;
          MoveFile(id: string, targetFolderId?: string | null): Promise<void>;
          ToggleFavorite(id: string): Promise<boolean>;
          DeleteFile(id: string, permanent: boolean): Promise<void>;
          RestoreFile(id: string): Promise<void>;
          UploadFiles(folderId: string | null | undefined, filePaths: string[]): Promise<FileItem[]>;
          SelectAndUploadFiles(folderId?: string | null): Promise<FileItem[]>;
          DownloadFile(fileId: string, destinationPath: string): Promise<void>;
          DownloadFileWithDialog(fileId: string): Promise<string>;
          GetTransfers(): Promise<Transfer[]>;
          CancelTransfer(transferId: string): Promise<boolean>;
          ClearCompletedTransfers(): Promise<void>;
          GetStreamURL(fileId: string): Promise<string>;
          ExportMetadata(): Promise<string>;
          SelectFile(): Promise<string>;
          SelectDirectory(): Promise<string>;
          GetPlatform(): Promise<string>;
          // Shards & Sync
          ListWebhookShards(): Promise<WebhookShard[]>;
          CreateWebhookShard(name: string, url: string, channelId: string, guildId: string, priority: number): Promise<WebhookShard>;
          UpdateWebhookShard(shard: WebhookShard): Promise<void>;
          DeleteWebhookShard(id: string): Promise<void>;
          ListSyncFolders(): Promise<SyncFolder[]>;
          CreateSyncFolder(localPath: string, remoteFolderId?: string | null): Promise<SyncFolder>;
          UpdateSyncFolder(folder: SyncFolder): Promise<void>;
          DeleteSyncFolder(id: string): Promise<void>;
          SyncFoldersNow(): Promise<void>;
          GenerateShareLink(fileId: string): Promise<ShareLinkResult>;
          GetGatewaysStatus(): Promise<GatewayStatus>;
        };
      };
    };
    runtime?: {
      EventsOn(eventName: string, callback: (...args: any[]) => void): () => void;
      EventsOff(eventName: string, ...additionalEvents: string[]): void;
      EventsOnce(eventName: string, callback: (...args: any[]) => void): void;
      LogInfo(message: string): void;
      LogError(message: string): void;
    };
  }
}

export function hasWails(): boolean {
  return typeof window !== 'undefined' && typeof window.go?.main?.App?.GetSettings === 'function';
}

// Local Mock state for browser preview mode
let mockSettings: AppSettings = {
  webhook_url: 'https://discord.com/api/webhooks/123456789/mock-vault-token',
  webhook_name: 'Wyvern Vault Discord Channel',
  channel_id: '9876543210',
  guild_id: '1122334455',
  bot_token: '',
  master_key: 'wyvern-secure-passphrase-2025',
  encryption_enabled: true,
  chunk_size_bytes: 18 * 1024 * 1024,
  max_concurrency: 4,
  auto_launch_server: true,
  server_port: 49152,
  theme: 'dark',
  download_directory: 'C:\\Users\\Downloads\\Wyvern',
  setup_completed: true,
  webdav_enabled: true,
  webdav_port: 49153,
  s3_enabled: false,
  s3_port: 49154,
  max_cache_size_bytes: 2 * 1024 * 1024 * 1024,
  prefetch_enabled: true,
  deduplication_enabled: true,
};

let mockShards: WebhookShard[] = [
  {
    id: 'shard-alpha',
    name: 'Primary Vault Channel',
    url: 'https://discord.com/api/webhooks/123/token-alpha',
    channel_id: '123456789',
    guild_id: '99887766',
    is_active: true,
    priority: 1,
    error_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
  {
    id: 'shard-beta',
    name: 'Secondary Shard Channel',
    url: 'https://discord.com/api/webhooks/456/token-beta',
    channel_id: '987654321',
    guild_id: '99887766',
    is_active: true,
    priority: 2,
    error_count: 0,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockSyncFolders: SyncFolder[] = [
  {
    id: 'sync-1',
    local_path: 'C:\\Users\\User\\Documents\\VaultSync',
    remote_folder_id: null,
    enabled: true,
    last_sync_time: new Date().toISOString(),
    sync_status: 'idle',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];

let mockFolders: Folder[] = [
  { id: '1', parent_id: null, name: 'Documents', path: '/Documents', color: '#3B82F6', icon: 'folder', created_at: '2025-01-10T10:00:00Z', updated_at: '2025-01-10T10:00:00Z', file_count: 4, total_size: 45000000 },
  { id: '2', parent_id: null, name: 'Videos', path: '/Videos', color: '#EF4444', icon: 'film', created_at: '2025-01-11T12:00:00Z', updated_at: '2025-01-11T12:00:00Z', file_count: 2, total_size: 1500000000 },
  { id: '3', parent_id: null, name: 'Pictures', path: '/Pictures', color: '#10B981', icon: 'image', created_at: '2025-01-12T14:00:00Z', updated_at: '2025-01-12T14:00:00Z', file_count: 12, total_size: 85000000 },
];

let mockFiles: FileItem[] = [
  {
    id: 'f1',
    folder_id: '2',
    name: 'Tears_of_Steel_4K.mp4',
    size: 94371840,
    formatted_size: '90.00 MB',
    mime_type: 'video/mp4',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    is_encrypted: true,
    chunk_count: 5,
    chunk_size: 18874368,
    favorite: true,
    status: 'completed',
    tags: ['4k', 'blender', 'scifi'],
    created_at: '2025-01-15T09:30:00Z',
    updated_at: '2025-01-15T09:30:00Z',
  },
  {
    id: 'f2',
    folder_id: '1',
    name: 'Financial_Report_Q4_2024.pdf',
    size: 4194304,
    formatted_size: '4.00 MB',
    mime_type: 'application/pdf',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    is_encrypted: true,
    chunk_count: 1,
    chunk_size: 18874368,
    favorite: false,
    status: 'completed',
    tags: ['work', 'finance', '2024'],
    created_at: '2025-01-14T15:20:00Z',
    updated_at: '2025-01-14T15:20:00Z',
  },
  {
    id: 'f3',
    folder_id: '3',
    name: 'Mountain_Sunrise_Wallpaper.png',
    size: 8388608,
    formatted_size: '8.00 MB',
    mime_type: 'image/png',
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    is_encrypted: true,
    chunk_count: 1,
    chunk_size: 18874368,
    favorite: true,
    status: 'completed',
    tags: ['wallpaper', 'nature', '4k'],
    created_at: '2025-01-13T18:45:00Z',
    updated_at: '2025-01-13T18:45:00Z',
  },
];

let mockTransfers: Transfer[] = [];

export const api = {
  async validateWebhook(url: string): Promise<WebhookInfo> {
    if (hasWails()) {
      return window.go!.main!.App!.ValidateWebhook(url);
    }
    await new Promise((r) => setTimeout(r, 600));
    return {
      id: '123456789012345678',
      name: 'Wyvern Storage Vault',
      channel_id: '9876543210',
      guild_id: '1122334455',
      token: 'secure_webhook_token',
      latency_ms: 42,
    };
  },

  async getSettings(): Promise<AppSettings> {
    if (hasWails()) {
      return window.go!.main!.App!.GetSettings();
    }
    return { ...mockSettings };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.SaveSettings(settings);
    }
    mockSettings = { ...settings };
  },

  async getStats(): Promise<StorageStats> {
    if (hasWails()) {
      return window.go!.main!.App!.GetStats();
    }
    const totalBytes = mockFiles.reduce((acc, f) => acc + f.size, 0);
    return {
      total_files: mockFiles.length,
      total_folders: mockFolders.length,
      total_bytes: totalBytes,
      formatted_total: formatBytes(totalBytes),
      total_chunks: mockFiles.reduce((acc, f) => acc + f.chunk_count, 0),
      category_counts: {
        images: 1,
        videos: 1,
        audio: 0,
        documents: 1,
        archives: 0,
      },
      category_bytes: {
        images: 8388608,
        videos: 94371840,
        audio: 0,
        documents: 4194304,
        archives: 0,
      },
      encrypted_files: mockFiles.filter((f) => f.is_encrypted).length,
      active_transfers: mockTransfers.filter((t) => t.status === 'running').length,
      deduplicated_bytes: 41943040,
      deduplicated_chunks: 3,
      active_shards: mockShards.filter((s) => s.is_active).length,
      total_shards: mockShards.length,
    };
  },

  async listFolders(parentId?: string | null): Promise<Folder[]> {
    if (hasWails()) {
      return window.go!.main!.App!.ListFolders(parentId);
    }
    if (!parentId) {
      return mockFolders.filter((f) => !f.parent_id);
    }
    return mockFolders.filter((f) => f.parent_id === parentId);
  },

  async createFolder(parentId: string | null | undefined, name: string, color: string = '#5865F2', icon: string = 'folder'): Promise<Folder> {
    if (hasWails()) {
      return window.go!.main!.App!.CreateFolder(parentId, name, color, icon);
    }
    const folder: Folder = {
      id: `f-${Date.now()}`,
      parent_id: parentId || null,
      name,
      path: `/${name}`,
      color,
      icon,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      file_count: 0,
      total_size: 0,
    };
    mockFolders.push(folder);
    return folder;
  },

  async renameFolder(id: string, newName: string): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.RenameFolder(id, newName);
    }
    const f = mockFolders.find((folder) => folder.id === id);
    if (f) f.name = newName;
  },

  async deleteFolder(id: string, recursive: boolean = true): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.DeleteFolder(id, recursive);
    }
    mockFolders = mockFolders.filter((f) => f.id !== id);
  },

  async listFiles(folderId?: string | null, filter: string = 'all', sortBy: string = 'name', sortOrder: string = 'asc', limit: number = 100, offset: number = 0): Promise<FileListResult> {
    if (hasWails()) {
      return window.go!.main!.App!.ListFiles(folderId, filter, sortBy, sortOrder, limit, offset);
    }

    let files = [...mockFiles];

    if (filter === 'trash') {
      files = files.filter((f) => f.status === 'trash');
    } else {
      files = files.filter((f) => f.status !== 'trash');
      if (filter === 'favorites') {
        files = files.filter((f) => f.favorite);
      } else if (filter === 'media_image') {
        files = files.filter((f) => f.mime_type.startsWith('image/'));
      } else if (filter === 'media_video') {
        files = files.filter((f) => f.mime_type.startsWith('video/'));
      } else if (filter === 'media_audio') {
        files = files.filter((f) => f.mime_type.startsWith('audio/'));
      } else if (filter === 'documents') {
        files = files.filter((f) => f.mime_type.includes('pdf') || f.mime_type.includes('document') || f.mime_type.startsWith('text/'));
      } else if (folderId !== undefined) {
        files = files.filter((f) => (folderId === null ? !f.folder_id : f.folder_id === folderId));
      }
    }

    return {
      files: files.slice(offset, offset + limit),
      total: files.length,
    };
  },

  async searchFiles(query: string): Promise<FileItem[]> {
    if (hasWails()) {
      return window.go!.main!.App!.SearchFiles(query);
    }
    const q = query.toLowerCase();
    return mockFiles.filter((f) => f.name.toLowerCase().includes(q) || f.tags?.some((t) => t.toLowerCase().includes(q)));
  },

  async getFile(id: string): Promise<FileItem> {
    if (hasWails()) {
      return window.go!.main!.App!.GetFile(id);
    }
    const file = mockFiles.find((f) => f.id === id);
    if (!file) throw new Error('File not found');
    return file;
  },

  async getFileDetails(id: string): Promise<FileItem> {
    if (hasWails()) {
      return window.go!.main!.App!.GetFileDetails(id);
    }
    return this.getFile(id);
  },

  async renameFile(id: string, newName: string): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.RenameFile(id, newName);
    }
    const f = mockFiles.find((file) => file.id === id);
    if (f) f.name = newName;
  },

  async moveFile(id: string, targetFolderId?: string | null): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.MoveFile(id, targetFolderId);
    }
    const f = mockFiles.find((file) => file.id === id);
    if (f) f.folder_id = targetFolderId || null;
  },

  async toggleFavorite(id: string): Promise<boolean> {
    if (hasWails()) {
      return window.go!.main!.App!.ToggleFavorite(id);
    }
    const f = mockFiles.find((file) => file.id === id);
    if (f) {
      f.favorite = !f.favorite;
      return f.favorite;
    }
    return false;
  },

  async deleteFile(id: string, permanent: boolean = false): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.DeleteFile(id, permanent);
    }
    if (permanent) {
      mockFiles = mockFiles.filter((f) => f.id !== id);
    } else {
      const f = mockFiles.find((file) => file.id === id);
      if (f) f.status = 'trash';
    }
  },

  async restoreFile(id: string): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.RestoreFile(id);
    }
    const f = mockFiles.find((file) => file.id === id);
    if (f) f.status = 'completed';
  },

  async selectAndUploadFiles(folderId?: string | null): Promise<FileItem[]> {
    if (hasWails()) {
      return window.go!.main!.App!.SelectAndUploadFiles(folderId);
    }
    return [];
  },

  async downloadFile(fileId: string, destinationPath: string): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.DownloadFile(fileId, destinationPath);
    }
  },

  async downloadFileWithDialog(fileId: string): Promise<string> {
    if (hasWails()) {
      return window.go!.main!.App!.DownloadFileWithDialog(fileId);
    }
    return 'C:\\Downloads\\sample.mp4';
  },

  async getTransfers(): Promise<Transfer[]> {
    if (hasWails()) {
      return window.go!.main!.App!.GetTransfers();
    }
    return [...mockTransfers];
  },

  async cancelTransfer(transferId: string): Promise<boolean> {
    if (hasWails()) {
      return window.go!.main!.App!.CancelTransfer(transferId);
    }
    return true;
  },

  async clearCompletedTransfers(): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.ClearCompletedTransfers();
    }
    mockTransfers = mockTransfers.filter((t) => t.status === 'running' || t.status === 'queued');
  },

  getStreamURL(fileId: string): string {
    if (hasWails()) {
      return `http://127.0.0.1:${mockSettings.server_port || 49152}/stream/${fileId}`;
    }
    return `http://127.0.0.1:49152/stream/${fileId}`;
  },

  async exportMetadata(): Promise<string> {
    if (hasWails()) {
      return window.go!.main!.App!.ExportMetadata();
    }
    return JSON.stringify({ version: '1.1.0', folders: mockFolders, files: mockFiles }, null, 2);
  },

  // --------------------------------------------------
  // Multi-Webhook Shard Pool Methods
  // --------------------------------------------------
  async listWebhookShards(): Promise<WebhookShard[]> {
    if (hasWails()) {
      return window.go!.main!.App!.ListWebhookShards();
    }
    return [...mockShards];
  },

  async createWebhookShard(name: string, url: string, channelId: string = '', guildId: string = '', priority: number = 1): Promise<WebhookShard> {
    if (hasWails()) {
      return window.go!.main!.App!.CreateWebhookShard(name, url, channelId, guildId, priority);
    }
    const shard: WebhookShard = {
      id: `shard-${Date.now()}`,
      name,
      url,
      channel_id: channelId,
      guild_id: guildId,
      is_active: true,
      priority,
      error_count: 0,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockShards.push(shard);
    return shard;
  },

  async updateWebhookShard(shard: WebhookShard): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.UpdateWebhookShard(shard);
    }
    const idx = mockShards.findIndex((s) => s.id === shard.id);
    if (idx !== -1) mockShards[idx] = shard;
  },

  async deleteWebhookShard(id: string): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.DeleteWebhookShard(id);
    }
    mockShards = mockShards.filter((s) => s.id !== id);
  },

  // --------------------------------------------------
  // Background Sync Folder Methods
  // --------------------------------------------------
  async listSyncFolders(): Promise<SyncFolder[]> {
    if (hasWails()) {
      return window.go!.main!.App!.ListSyncFolders();
    }
    return [...mockSyncFolders];
  },

  async createSyncFolder(localPath: string, remoteFolderId?: string | null): Promise<SyncFolder> {
    if (hasWails()) {
      return window.go!.main!.App!.CreateSyncFolder(localPath, remoteFolderId);
    }
    const sf: SyncFolder = {
      id: `sync-${Date.now()}`,
      local_path: localPath,
      remote_folder_id: remoteFolderId || null,
      enabled: true,
      sync_status: 'idle',
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    mockSyncFolders.push(sf);
    return sf;
  },

  async updateSyncFolder(folder: SyncFolder): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.UpdateSyncFolder(folder);
    }
    const idx = mockSyncFolders.findIndex((f) => f.id === folder.id);
    if (idx !== -1) mockSyncFolders[idx] = folder;
  },

  async deleteSyncFolder(id: string): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.DeleteSyncFolder(id);
    }
    mockSyncFolders = mockSyncFolders.filter((f) => f.id !== id);
  },

  async syncFoldersNow(): Promise<void> {
    if (hasWails()) {
      return window.go!.main!.App!.SyncFoldersNow();
    }
  },

  // --------------------------------------------------
  // Zero-Knowledge Share & Gateway Status
  // --------------------------------------------------
  async generateShareLink(fileId: string): Promise<ShareLinkResult> {
    if (hasWails()) {
      return window.go!.main!.App!.GenerateShareLink(fileId);
    }
    const file = mockFiles.find((f) => f.id === fileId);
    const key = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
    return {
      file_id: fileId,
      file_name: file ? file.name : 'sample.bin',
      share_url: `http://127.0.0.1:49152/stream/${fileId}#key=${key}`,
      share_key: key,
    };
  },

  async getGatewaysStatus(): Promise<GatewayStatus> {
    if (hasWails()) {
      return window.go!.main!.App!.GetGatewaysStatus();
    }
    return {
      webdav: {
        running: true,
        port: 49153,
        url: 'http://127.0.0.1:49153/webdav',
      },
      s3: {
        running: false,
        port: 49154,
        url: 'http://127.0.0.1:49154',
      },
    };
  },

  async selectDirectory(): Promise<string> {
    if (hasWails()) {
      return window.go!.main!.App!.SelectDirectory();
    }
    return 'C:\\Users\\User\\Documents';
  },
};

export function formatBytes(bytes: number, decimals: number = 2): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function formatDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('default', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return dateString;
  }
}
