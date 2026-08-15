import {
  AppSettings,
  FileItem,
  FileListResult,
  Folder,
  StorageStats,
  Transfer,
  WebhookInfo,
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
          ListFiles(folderId: string | null | undefined, filter: string, sortBy: string, sortOrder: string, limit: number, offset: number): Promise<FileListResult>;
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
        };
      };
    };
  }
}

const isWails = typeof window !== 'undefined' && !!window.go?.main?.App;

// Local Mock state for browser preview mode
let mockSettings: AppSettings = {
  webhook_url: 'https://discord.com/api/webhooks/123456789/mock-vault-token',
  webhook_name: 'Wyvern Vault Discord Channel',
  channel_id: '9876543210',
  guild_id: '1122334455',
  master_key: 'wyvern-secure-passphrase-2025',
  encryption_enabled: true,
  chunk_size_bytes: 18 * 1024 * 1024,
  max_concurrency: 4,
  auto_launch_server: true,
  server_port: 49152,
  theme: 'dark',
  download_directory: 'C:\\Users\\Downloads\\Wyvern',
  setup_completed: true,
};

let mockFolders: Folder[] = [
  { id: 'f-1', parent_id: null, name: 'Documents', path: '/Documents', color: '#3b82f6', icon: 'folder', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), file_count: 3, total_size: 45000000 },
  { id: 'f-2', parent_id: null, name: 'Media Projects', path: '/Media Projects', color: '#8b5cf6', icon: 'film', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), file_count: 5, total_size: 180000000 },
  { id: 'f-3', parent_id: null, name: 'Backups', path: '/Backups', color: '#10b981', icon: 'archive', created_at: new Date().toISOString(), updated_at: new Date().toISOString(), file_count: 2, total_size: 420000000 },
];

let mockFiles: FileItem[] = [
  {
    id: 'file-1',
    folder_id: 'f-2',
    name: 'cyberpunk_showreel_4k.mp4',
    size: 94371840,
    formatted_size: '90.00 MB',
    mime_type: 'video/mp4',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    is_encrypted: true,
    chunk_count: 5,
    chunk_size: 18874368,
    favorite: true,
    status: 'completed',
    tags: ['video', 'showreel', '4k'],
    created_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 2).toISOString(),
    chunks: [
      { id: 'c-1', file_id: 'file-1', chunk_index: 0, message_id: '123450', attachment_id: 'att-1', attachment_url: 'https://cdn.discordapp.com/attachments/1.bin', size: 18874368, chunk_hash: 'h1', nonce: 'a1b2c3d4e5f60708', created_at: new Date().toISOString() },
      { id: 'c-2', file_id: 'file-1', chunk_index: 1, message_id: '123451', attachment_id: 'att-2', attachment_url: 'https://cdn.discordapp.com/attachments/2.bin', size: 18874368, chunk_hash: 'h2', nonce: 'b1c2d3e4f5060708', created_at: new Date().toISOString() },
    ]
  },
  {
    id: 'file-2',
    folder_id: 'f-1',
    name: 'Financial_Report_Q4.pdf',
    size: 4194304,
    formatted_size: '4.00 MB',
    mime_type: 'application/pdf',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    is_encrypted: true,
    chunk_count: 1,
    chunk_size: 18874368,
    favorite: false,
    status: 'completed',
    tags: ['finance', 'pdf'],
    created_at: new Date(Date.now() - 3600000 * 24).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 24).toISOString(),
  },
  {
    id: 'file-3',
    folder_id: null,
    name: 'dragon_wallpaper_dark.png',
    size: 8388608,
    formatted_size: '8.00 MB',
    mime_type: 'image/png',
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    is_encrypted: true,
    chunk_count: 1,
    chunk_size: 18874368,
    favorite: true,
    status: 'completed',
    tags: ['wallpaper', 'art'],
    created_at: new Date(Date.now() - 3600000 * 48).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 48).toISOString(),
  },
  {
    id: 'file-4',
    folder_id: 'f-3',
    name: 'database_dump_2025_03.tar.gz',
    size: 262144000,
    formatted_size: '250.00 MB',
    mime_type: 'application/gzip',
    sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    is_encrypted: true,
    chunk_count: 14,
    chunk_size: 18874368,
    favorite: false,
    status: 'completed',
    tags: ['backup', 'database'],
    created_at: new Date(Date.now() - 3600000 * 72).toISOString(),
    updated_at: new Date(Date.now() - 3600000 * 72).toISOString(),
  },
];

let mockTransfers: Transfer[] = [
  {
    id: 'tr-1',
    file_id: 'file-1',
    filename: 'cyberpunk_showreel_4k.mp4',
    type: 'upload',
    status: 'completed',
    total_bytes: 94371840,
    transferred_bytes: 94371840,
    progress_percent: 100,
    speed_bps: 12500000,
    speed_formatted: '12.5 MB/s',
    eta_seconds: 0,
    chunks_total: 5,
    chunks_done: 5,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  }
];

export const api = {
  async validateWebhook(url: string): Promise<WebhookInfo> {
    if (isWails) {
      return window.go!.main!.App!.ValidateWebhook(url);
    }
    await new Promise((r) => setTimeout(r, 600));
    if (!url.includes('discord.com/api/webhooks') && !url.includes('discordapp.com/api/webhooks')) {
      throw new Error('Invalid Discord webhook URL format');
    }
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
    if (isWails) {
      return window.go!.main!.App!.GetSettings();
    }
    return { ...mockSettings };
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.SaveSettings(settings);
    }
    mockSettings = { ...settings };
  },

  async getStats(): Promise<StorageStats> {
    if (isWails) {
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
        archives: 1,
      },
      category_bytes: {
        images: 8388608,
        videos: 94371840,
        audio: 0,
        documents: 4194304,
        archives: 262144000,
      },
      encrypted_files: mockFiles.filter((f) => f.is_encrypted).length,
      active_transfers: mockTransfers.filter((t) => t.status === 'running').length,
    };
  },

  async listFolders(parentId?: string | null): Promise<Folder[]> {
    if (isWails) {
      return window.go!.main!.App!.ListFolders(parentId);
    }
    if (!parentId) {
      return mockFolders.filter((f) => !f.parent_id);
    }
    return mockFolders.filter((f) => f.parent_id === parentId);
  },

  async createFolder(parentId: string | null | undefined, name: string, color: string = '#5865F2', icon: string = 'folder'): Promise<Folder> {
    if (isWails) {
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
    if (isWails) {
      return window.go!.main!.App!.RenameFolder(id, newName);
    }
    const f = mockFolders.find((item) => item.id === id);
    if (f) f.name = newName;
  },

  async deleteFolder(id: string, recursive: boolean = true): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.DeleteFolder(id, recursive);
    }
    mockFolders = mockFolders.filter((f) => f.id !== id);
  },

  async listFiles(folderId: string | null | undefined, filter: string = 'all', sortBy: string = 'created_at', sortOrder: string = 'desc', limit: number = 100, offset: number = 0): Promise<FileListResult> {
    if (isWails) {
      return window.go!.main!.App!.ListFiles(folderId, filter, sortBy, sortOrder, limit, offset);
    }

    let filtered = [...mockFiles];
    if (filter === 'favorites') {
      filtered = filtered.filter((f) => f.favorite && f.status !== 'trash');
    } else if (filter === 'trash') {
      filtered = filtered.filter((f) => f.status === 'trash');
    } else if (filter === 'media_image') {
      filtered = filtered.filter((f) => f.mime_type.startsWith('image/'));
    } else if (filter === 'media_video') {
      filtered = filtered.filter((f) => f.mime_type.startsWith('video/'));
    } else if (filter === 'media_audio') {
      filtered = filtered.filter((f) => f.mime_type.startsWith('audio/'));
    } else if (filter === 'documents') {
      filtered = filtered.filter((f) => f.mime_type.includes('pdf') || f.mime_type.includes('text') || f.mime_type.includes('doc'));
    } else if (filter === 'all' && folderId !== undefined) {
      filtered = filtered.filter((f) => f.folder_id === (folderId || null) && f.status !== 'trash');
    } else {
      filtered = filtered.filter((f) => f.status !== 'trash');
    }

    filtered.sort((a, b) => {
      let cmp = 0;
      if (sortBy === 'name') cmp = a.name.localeCompare(b.name);
      else if (sortBy === 'size') cmp = a.size - b.size;
      else cmp = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      return sortOrder === 'desc' ? -cmp : cmp;
    });

    return {
      files: filtered.slice(offset, offset + limit),
      total: filtered.length,
    };
  },

  async searchFiles(query: string): Promise<FileItem[]> {
    if (isWails) {
      return window.go!.main!.App!.SearchFiles(query);
    }
    const q = query.toLowerCase();
    return mockFiles.filter((f) => f.name.toLowerCase().includes(q) || f.tags?.some((t) => t.toLowerCase().includes(q)));
  },

  async getFile(id: string): Promise<FileItem> {
    if (isWails) {
      return window.go!.main!.App!.GetFile(id);
    }
    const file = mockFiles.find((f) => f.id === id);
    if (!file) throw new Error('File not found');
    return file;
  },

  async getFileDetails(id: string): Promise<FileItem> {
    if (isWails) {
      return window.go!.main!.App!.GetFileDetails(id);
    }
    const file = mockFiles.find((f) => f.id === id);
    if (!file) throw new Error('File not found');
    return file;
  },

  async renameFile(id: string, newName: string): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.RenameFile(id, newName);
    }
    const file = mockFiles.find((f) => f.id === id);
    if (file) file.name = newName;
  },

  async moveFile(id: string, targetFolderId?: string | null): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.MoveFile(id, targetFolderId);
    }
    const file = mockFiles.find((f) => f.id === id);
    if (file) file.folder_id = targetFolderId || null;
  },

  async toggleFavorite(id: string): Promise<boolean> {
    if (isWails) {
      return window.go!.main!.App!.ToggleFavorite(id);
    }
    const file = mockFiles.find((f) => f.id === id);
    if (file) {
      file.favorite = !file.favorite;
      return file.favorite;
    }
    return false;
  },

  async deleteFile(id: string, permanent: boolean = false): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.DeleteFile(id, permanent);
    }
    if (permanent) {
      mockFiles = mockFiles.filter((f) => f.id !== id);
    } else {
      const file = mockFiles.find((f) => f.id === id);
      if (file) file.status = 'trash';
    }
  },

  async restoreFile(id: string): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.RestoreFile(id);
    }
    const file = mockFiles.find((f) => f.id === id);
    if (file) file.status = 'completed';
  },

  async uploadFiles(folderId: string | null | undefined, filePaths: string[]): Promise<FileItem[]> {
    if (isWails) {
      return window.go!.main!.App!.UploadFiles(folderId, filePaths);
    }
    const newFiles: FileItem[] = filePaths.map((fp, i) => {
      const name = fp.split(/[\\/]/).pop() || `file_${i}`;
      return {
        id: `mock-uploaded-${Date.now()}-${i}`,
        folder_id: folderId || null,
        name,
        size: 15728640,
        formatted_size: '15.00 MB',
        mime_type: 'application/octet-stream',
        sha256: 'mock-sha256-hash',
        is_encrypted: true,
        chunk_count: 1,
        chunk_size: 18874368,
        favorite: false,
        status: 'completed',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
    });
    mockFiles.push(...newFiles);
    return newFiles;
  },

  async selectAndUploadFiles(folderId?: string | null): Promise<FileItem[]> {
    if (isWails) {
      return window.go!.main!.App!.SelectAndUploadFiles(folderId);
    }
    return this.uploadFiles(folderId, ['sample_uploaded_document.docx']);
  },

  async downloadFile(fileId: string, destinationPath: string): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.DownloadFile(fileId, destinationPath);
    }
    await new Promise((r) => setTimeout(r, 800));
  },

  async downloadFileWithDialog(fileId: string): Promise<string> {
    if (isWails) {
      return window.go!.main!.App!.DownloadFileWithDialog(fileId);
    }
    await new Promise((r) => setTimeout(r, 800));
    return 'C:\\Downloads\\downloaded_file.bin';
  },

  async getTransfers(): Promise<Transfer[]> {
    if (isWails) {
      return window.go!.main!.App!.GetTransfers();
    }
    return [...mockTransfers];
  },

  async cancelTransfer(transferId: string): Promise<boolean> {
    if (isWails) {
      return window.go!.main!.App!.CancelTransfer(transferId);
    }
    const tr = mockTransfers.find((t) => t.id === transferId);
    if (tr) {
      tr.status = 'cancelled';
      return true;
    }
    return false;
  },

  async clearCompletedTransfers(): Promise<void> {
    if (isWails) {
      return window.go!.main!.App!.ClearCompletedTransfers();
    }
    mockTransfers = mockTransfers.filter((t) => t.status === 'running' || t.status === 'queued');
  },

  async getStreamURL(fileId: string): Promise<string> {
    if (isWails) {
      return window.go!.main!.App!.GetStreamURL(fileId);
    }
    return `http://127.0.0.1:49152/api/stream/${fileId}`;
  },

  async exportMetadata(): Promise<string> {
    if (isWails) {
      return window.go!.main!.App!.ExportMetadata();
    }
    return JSON.stringify({ folders: mockFolders, files: mockFiles }, null, 2);
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
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);

  if (diffHours < 1) {
    const mins = Math.max(1, Math.floor(diffMs / (1000 * 60)));
    return `${mins}m ago`;
  }
  if (diffHours < 24) {
    return `${Math.floor(diffHours)}h ago`;
  }
  if (diffHours < 24 * 7) {
    const days = Math.floor(diffHours / 24);
    return `${days}d ago`;
  }
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}
