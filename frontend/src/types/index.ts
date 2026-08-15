export type FileStatus = 'uploading' | 'completed' | 'failed' | 'trash';

export interface Folder {
  id: string;
  parent_id?: string | null;
  name: string;
  path: string;
  color?: string;
  icon?: string;
  created_at: string;
  updated_at: string;
  file_count?: number;
  total_size?: number;
}

export interface Chunk {
  id: string;
  file_id: string;
  chunk_index: number;
  message_id: string;
  attachment_id: string;
  attachment_url: string;
  proxy_url?: string;
  size: number;
  chunk_hash: string;
  nonce?: string;
  created_at: string;
}

export interface FileItem {
  id: string;
  folder_id?: string | null;
  name: string;
  size: number;
  formatted_size?: string;
  mime_type: string;
  sha256: string;
  is_encrypted: boolean;
  chunk_count: number;
  chunk_size: number;
  favorite: boolean;
  status: FileStatus;
  tags?: string[];
  thumbnail_url?: string;
  created_at: string;
  updated_at: string;
  chunks?: Chunk[];
}

export type TransferType = 'upload' | 'download';
export type TransferStatus = 'queued' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';

export interface Transfer {
  id: string;
  file_id: string;
  filename: string;
  type: TransferType;
  status: TransferStatus;
  total_bytes: number;
  transferred_bytes: number;
  progress_percent: number;
  speed_bps: number;
  speed_formatted?: string;
  eta_seconds?: number;
  chunks_total: number;
  chunks_done: number;
  error_message?: string;
  local_path?: string;
  created_at: string;
  updated_at: string;
}

export interface AppSettings {
  webhook_url: string;
  webhook_name?: string;
  channel_id?: string;
  guild_id?: string;
  master_key: string;
  encryption_enabled: boolean;
  chunk_size_bytes: number;
  max_concurrency: number;
  auto_launch_server: boolean;
  server_port: number;
  theme: string;
  download_directory: string;
  setup_completed: boolean;
}

export interface StorageStats {
  total_files: number;
  total_folders: number;
  total_bytes: number;
  formatted_total?: string;
  total_chunks: number;
  category_counts: Record<string, number>;
  category_bytes: Record<string, number>;
  encrypted_files: number;
  active_transfers: number;
}

export interface WebhookInfo {
  id: string;
  name: string;
  channel_id?: string;
  guild_id?: string;
  token: string;
  avatar?: string;
  latency_ms?: number;
}

export interface FileListResult {
  files: FileItem[];
  total: number;
}

export type ViewCategory =
  | 'all'
  | 'favorites'
  | 'recent'
  | 'media_image'
  | 'media_video'
  | 'media_audio'
  | 'documents'
  | 'trash';

export type ViewMode = 'grid' | 'list';
export type SortField = 'name' | 'size' | 'created_at' | 'updated_at';
export type SortOrder = 'asc' | 'desc';
