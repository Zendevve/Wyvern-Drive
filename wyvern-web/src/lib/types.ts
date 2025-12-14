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

/**
 * Chunk info - compact format for storage efficiency
 * Short keys reduce JSON size by ~27% for large files
 *
 * Old format: {"index":0,"messageId":"x","url":"...","size":123,"iv":[...]}
 * New format: {"i":0,"u":"...","s":123,"v":[...]}
 */
export interface ChunkInfo {
  i: number       // index
  u: string       // url (Discord CDN)
  s: number       // size in bytes
  v?: number[]    // iv for encrypted chunks (Array for JSON serialization)
}

/**
 * Legacy chunk format for backward compatibility
 */
export interface LegacyChunkInfo {
  index: number
  messageId: string
  url: string
  size: number
  iv?: number[]
}

/**
 * Normalize chunk to compact format (handles both old and new formats)
 */
export function normalizeChunk(chunk: ChunkInfo | LegacyChunkInfo): ChunkInfo {
  // Check if already in new format
  if ('i' in chunk && 'u' in chunk && 's' in chunk) {
    return chunk as ChunkInfo
  }
  // Convert from legacy format
  const legacy = chunk as LegacyChunkInfo
  return {
    i: legacy.index,
    u: legacy.url,
    s: legacy.size,
    v: legacy.iv
  }
}

export interface EncryptedChunk {
  data: ArrayBuffer
  iv: Uint8Array
}

/**
 * Discord server boost level - determines max attachment size
 * - none/level1: 8MB limit → 7.5MB chunks
 * - level2: 8MB limit → 7.5MB chunks
 * - level3: 25MB limit → 24MB chunks
 */
export type ServerBoostLevel = 'none' | 'level1' | 'level2' | 'level3'

/**
 * Get the optimal chunk size for a given server boost level
 */
export function getChunkSizeForBoostLevel(level: ServerBoostLevel): number {
  // Only Level 3 boosted servers have 25MB file limit
  if (level === 'level3') {
    return 24 * 1024 * 1024 // 24MB
  }
  return 7.5 * 1024 * 1024 // 7.5MB for all other levels
}

// Config - Performance optimized based on DDrive benchmarks
export const CONFIG = {
  // Chunk sizes
  CHUNK_SIZE_DEFAULT: 7.5 * 1024 * 1024, // 7.5MB - Discord webhooks limit is 8MB
  CHUNK_SIZE_NITRO: 24 * 1024 * 1024,    // 24MB - for Nitro/boosted servers with 25MB limit

  // Parallelism settings (increased from 3 based on competitive analysis)
  MAX_PARALLEL_UPLOADS: 5,               // DDrive uses 3-5 with multiple webhooks
  MAX_PARALLEL_DOWNLOADS: 5,

  // Webhook pool settings
  MIN_WEBHOOKS_RECOMMENDED: 3,           // Minimum for good performance
  OPTIMAL_WEBHOOKS: 5,                   // Optimal for maximum throughput

  // Retry settings
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_BASE: 1000, // ms - exponential backoff base

  // Dynamic concurrency thresholds
  LARGE_FILE_THRESHOLD: 100 * 1024 * 1024, // 100MB - increase concurrency for large files
  SMALL_FILE_CONCURRENCY: 3,              // Concurrency for files < threshold
  LARGE_FILE_CONCURRENCY: 5,              // Concurrency for files >= threshold
} as const

export const FILE_DELIMITER = '/'

