export interface FileVersion {
  version: number;
  timestamp: Date;
  chunkRefs: string[];
  checksum: string;
}

export interface FileRecord {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  folderId: string | null;
  createdAt: Date;
  updatedAt: Date;
  status: 'uploading' | 'complete' | 'failed';
  version: number;
  encryptionSalt: Uint8Array;
  encryptionNonce: Uint8Array;
  chunkSize: number;
  totalChunks: number;
  checksum: string;
  versionHistory: FileVersion[];
}

export interface ChunkRecord {
  id: string;
  fileId: string;
  chunkIndex: number;
  messageId: string;
  attachmentId: string;
  cdnUrl: string;
  cdnExpiry: Date;
  channelId: string;
  size: number;
  uploadedAt: Date;
}

export interface FolderRecord {
  id: string;
  name: string;
  parentId: string | null;
  path: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface UploadProgress {
  fileId: string;
  fileName: string;
  totalChunks: number;
  completedChunks: number;
  status: 'pending' | 'encrypting' | 'uploading' | 'complete' | 'failed';
  error?: string;
}

export interface AppConfig {
  key: string;
  value: unknown;
}

export interface WebhookConfig {
  url: string;
  id: string;
  token: string;
  channelId: string;
  guildId: string | null;
  name: string;
}
