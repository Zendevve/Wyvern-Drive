/**
 * Core types for Wyvern Drive
 */

export interface WyvernFile {
  id: number
  name: string
  type: 'file'
  size: number
  path: string
  parentId: number | null
  content: string // JSON array of Discord message IDs
  encrypted: boolean
  encryptionIv?: string
  createdAt: string
  updatedAt: string
  // Version info
  version?: number
  versions?: FileVersion[]
}

export interface WyvernFolder {
  id: number
  name: string
  type: 'directory'
  path: string
  parentId: number | null
  children: Record<string, WyvernFile | WyvernFolder>
  createdAt: string
  updatedAt: string
}

export interface FileVersion {
  id: number
  fileId: number
  versionNumber: number
  content: string
  size: number
  createdAt: string
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
  size: number
}

export interface EncryptedChunk {
  data: ArrayBuffer
  iv: Uint8Array
}

// Config
export const CONFIG = {
  CHUNK_SIZE_DEFAULT: 25 * 1024 * 1024 - 1024, // ~25MB minus buffer
  CHUNK_SIZE_NITRO: 50 * 1024 * 1024 - 1024,   // ~50MB for Nitro
  MAX_PARALLEL_UPLOADS: 3,
  MAX_PARALLEL_DOWNLOADS: 5,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // ms
} as const

export const FILE_DELIMITER = '/'
