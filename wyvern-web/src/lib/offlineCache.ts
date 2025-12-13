/**
 * Offline Cache Layer using IndexedDB
 *
 * Provides instant file tree loading by caching data locally.
 * Uses the 'idb' library for Promise-based IndexedDB access.
 */

import { openDB, type IDBPDatabase } from 'idb'
import type { WyvernFile, WyvernFolder } from './types'

// Database schema version - increment when changing structure
const DB_VERSION = 1
const DB_NAME = 'wyvern-drive-cache'

// Store names
const STORES = {
  FILES: 'files',      // Cached file tree
  META: 'meta',        // Timestamps, sync status
  THUMBNAILS: 'thumbnails', // Future: cached thumbnails
} as const

// Type for cached file tree
interface CachedFileTree {
  userId: string
  tree: Record<string, WyvernFile | WyvernFolder>
  cachedAt: number
  version: number
}

// Type for metadata
interface CacheMeta {
  key: string
  value: unknown
  updatedAt: number
}

// Database instance (singleton)
let db: IDBPDatabase | null = null

/**
 * Initialize the IndexedDB database
 */
async function getDB(): Promise<IDBPDatabase> {
  if (db) return db

  db = await openDB(DB_NAME, DB_VERSION, {
    upgrade(database) {
      // Files store - keyed by userId
      if (!database.objectStoreNames.contains(STORES.FILES)) {
        database.createObjectStore(STORES.FILES, { keyPath: 'userId' })
      }

      // Meta store - for sync timestamps etc
      if (!database.objectStoreNames.contains(STORES.META)) {
        database.createObjectStore(STORES.META, { keyPath: 'key' })
      }

      // Thumbnails store - for future use
      if (!database.objectStoreNames.contains(STORES.THUMBNAILS)) {
        database.createObjectStore(STORES.THUMBNAILS, { keyPath: 'fileId' })
      }
    },
  })

  return db
}

/**
 * Cache the file tree for a user
 */
export async function cacheFileTree(
  userId: string,
  tree: Record<string, WyvernFile | WyvernFolder>
): Promise<void> {
  try {
    const database = await getDB()
    const cached: CachedFileTree = {
      userId,
      tree,
      cachedAt: Date.now(),
      version: DB_VERSION,
    }
    await database.put(STORES.FILES, cached)
    console.log('[OfflineCache] File tree cached for user:', userId)
  } catch (error) {
    console.error('[OfflineCache] Failed to cache file tree:', error)
  }
}

/**
 * Get cached file tree for a user
 * Returns null if no cache exists or cache is invalid
 */
export async function getCachedFileTree(
  userId: string
): Promise<Record<string, WyvernFile | WyvernFolder> | null> {
  try {
    const database = await getDB()
    const cached = await database.get(STORES.FILES, userId) as CachedFileTree | undefined

    if (!cached) {
      console.log('[OfflineCache] No cache found for user:', userId)
      return null
    }

    // Check cache age (optional: invalidate after 24 hours)
    const MAX_CACHE_AGE = 24 * 60 * 60 * 1000 // 24 hours
    if (Date.now() - cached.cachedAt > MAX_CACHE_AGE) {
      console.log('[OfflineCache] Cache expired for user:', userId)
      return null
    }

    console.log('[OfflineCache] Loaded cached file tree for user:', userId)
    return cached.tree
  } catch (error) {
    console.error('[OfflineCache] Failed to get cached file tree:', error)
    return null
  }
}

/**
 * Get cache timestamp for a user
 */
export async function getCacheTimestamp(userId: string): Promise<number | null> {
  try {
    const database = await getDB()
    const cached = await database.get(STORES.FILES, userId) as CachedFileTree | undefined
    return cached?.cachedAt ?? null
  } catch {
    return null
  }
}

/**
 * Clear cache for a user
 */
export async function clearUserCache(userId: string): Promise<void> {
  try {
    const database = await getDB()
    await database.delete(STORES.FILES, userId)
    console.log('[OfflineCache] Cache cleared for user:', userId)
  } catch (error) {
    console.error('[OfflineCache] Failed to clear cache:', error)
  }
}

/**
 * Clear all caches
 */
export async function clearAllCache(): Promise<void> {
  try {
    const database = await getDB()
    await database.clear(STORES.FILES)
    await database.clear(STORES.META)
    await database.clear(STORES.THUMBNAILS)
    console.log('[OfflineCache] All caches cleared')
  } catch (error) {
    console.error('[OfflineCache] Failed to clear all caches:', error)
  }
}

/**
 * Set metadata value
 */
export async function setMeta(key: string, value: unknown): Promise<void> {
  try {
    const database = await getDB()
    const meta: CacheMeta = {
      key,
      value,
      updatedAt: Date.now(),
    }
    await database.put(STORES.META, meta)
  } catch (error) {
    console.error('[OfflineCache] Failed to set meta:', error)
  }
}

/**
 * Get metadata value
 */
export async function getMeta<T>(key: string): Promise<T | null> {
  try {
    const database = await getDB()
    const meta = await database.get(STORES.META, key) as CacheMeta | undefined
    return (meta?.value as T) ?? null
  } catch {
    return null
  }
}

/**
 * Check if we're online
 */
export function isOnline(): boolean {
  return navigator.onLine
}

/**
 * Listen for online/offline events
 */
export function onConnectivityChange(callback: (online: boolean) => void): () => void {
  const handleOnline = () => callback(true)
  const handleOffline = () => callback(false)

  window.addEventListener('online', handleOnline)
  window.addEventListener('offline', handleOffline)

  return () => {
    window.removeEventListener('online', handleOnline)
    window.removeEventListener('offline', handleOffline)
  }
}
