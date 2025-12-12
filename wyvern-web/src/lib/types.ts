/**
 * Core types for Wyvern Drive
 */

export interface WyvernFile {
  id: number
  name: string
  type: 'file'
  size: number
  path: string
  parent_id: number | null  // snake_case to match server
  content: string // JSON array of Discord message IDs
  encrypted: boolean | number  // SQLite returns 0/1
  encryption_salt?: string | null // snake_case to match server
  created_at: string
  updated_at: string
  // Version info
  version?: number
  versions?: FileVersion[]
}

export interface WyvernFolder {
  id: number
  name: string
  type: 'directory'
  path: string
  parent_id: number | null  // snake_case to match server
  children: Record<string, WyvernFile | WyvernFolder>
  created_at: string
  updated_at: string
}

export interface FileVersion {
  id: number
  version_number: number
  size: number
  created_at: string
}

export interface UploadOptions {
  encrypt?: boolean
  password?: string
  onProgress?: (uploaded: number, total: number) => void
}

export interface DownloadOptions {
  password?: string
  onProgress?: (downloaded: number, total: number) => void
}

export interface ChunkInfo {
  index: number
  messageId: string
  url: string
  size: number
  iv?: number[] // Array needed for JSON serialization of Uint8Array
}

export interface EncryptedChunk {
  data: ArrayBuffer
  iv: Uint8Array
}

// Config
export const CONFIG = {
  CHUNK_SIZE_DEFAULT: 7.5 * 1024 * 1024, // 7.5MB - Discord webhooks limit is 8MB
  CHUNK_SIZE_NITRO: 24 * 1024 * 1024,    // 24MB - for Nitro/boosted servers with 25MB limit
  MAX_PARALLEL_UPLOADS: 3,
  MAX_PARALLEL_DOWNLOADS: 5,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // ms
} as const

export const FILE_DELIMITER = '/'
