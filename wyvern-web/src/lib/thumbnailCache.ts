/**
 * Thumbnail Cache - IndexedDB storage for generated thumbnails
 *
 * Caches thumbnail blobs locally to avoid re-generating them on every view.
 * Significantly improves browsing performance for image-heavy folders.
 */

const DB_NAME = 'wyvern-thumbnail-cache'
const DB_VERSION = 1
const STORE_NAME = 'thumbnails'

// Cache TTL: 7 days
const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000

interface ThumbnailEntry {
  fileId: string
  blob: Blob
  width: number
  height: number
  createdAt: number
  fileHash?: string // Optional hash to detect file changes
}

let db: IDBDatabase | null = null

/**
 * Initialize the thumbnail cache database
 */
async function initDB(): Promise<IDBDatabase> {
  if (db) return db

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => {
      db = request.result
      resolve(db)
    }

    request.onupgradeneeded = (event) => {
      const database = (event.target as IDBOpenDBRequest).result

      // Create thumbnails store with fileId as key
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'fileId' })
        store.createIndex('createdAt', 'createdAt', { unique: false })
      }
    }
  })
}

/**
 * Get a cached thumbnail by file ID
 */
export async function getCachedThumbnail(fileId: string): Promise<ThumbnailEntry | null> {
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(fileId)

      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        const entry = request.result as ThumbnailEntry | undefined

        if (!entry) {
          resolve(null)
          return
        }

        // Check if expired
        if (Date.now() - entry.createdAt > CACHE_TTL_MS) {
          // Expired - delete it
          deleteCachedThumbnail(fileId).catch(console.error)
          resolve(null)
          return
        }

        resolve(entry)
      }
    })
  } catch (error) {
    console.error('[ThumbnailCache] Get failed:', error)
    return null
  }
}

/**
 * Cache a thumbnail
 */
export async function cacheThumbnail(
  fileId: string,
  blob: Blob,
  width: number,
  height: number,
  fileHash?: string
): Promise<void> {
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)

      const entry: ThumbnailEntry = {
        fileId,
        blob,
        width,
        height,
        createdAt: Date.now(),
        fileHash
      }

      const request = store.put(entry)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch (error) {
    console.error('[ThumbnailCache] Cache failed:', error)
  }
}

/**
 * Delete a cached thumbnail
 */
export async function deleteCachedThumbnail(fileId: string): Promise<void> {
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(fileId)
      request.onerror = () => reject(request.error)
      request.onsuccess = () => resolve()
    })
  } catch (error) {
    console.error('[ThumbnailCache] Delete failed:', error)
  }
}

/**
 * Clear all expired thumbnails
 */
export async function clearExpiredThumbnails(): Promise<number> {
  try {
    const database = await initDB()
    const cutoff = Date.now() - CACHE_TTL_MS
    let deletedCount = 0

    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const index = store.index('createdAt')
      const range = IDBKeyRange.upperBound(cutoff)
      const request = index.openCursor(range)

      request.onerror = () => reject(request.error)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          store.delete(cursor.primaryKey)
          deletedCount++
          cursor.continue()
        } else {
          console.log(`[ThumbnailCache] Cleared ${deletedCount} expired thumbnails`)
          resolve(deletedCount)
        }
      }
    })
  } catch (error) {
    console.error('[ThumbnailCache] Clear expired failed:', error)
    return 0
  }
}

/**
 * Clear all cached thumbnails (e.g., on logout)
 */
export async function clearAllThumbnails(): Promise<void> {
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()
      request.onerror = () => reject(request.error)
      request.onsuccess = () => {
        console.log('[ThumbnailCache] Cleared all thumbnails')
        resolve()
      }
    })
  } catch (error) {
    console.error('[ThumbnailCache] Clear all failed:', error)
  }
}

/**
 * Get cache statistics
 */
export async function getCacheStats(): Promise<{ count: number; sizeBytes: number }> {
  try {
    const database = await initDB()
    return new Promise((resolve, reject) => {
      const transaction = database.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.openCursor()

      let count = 0
      let sizeBytes = 0

      request.onerror = () => reject(request.error)
      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          count++
          const entry = cursor.value as ThumbnailEntry
          sizeBytes += entry.blob.size
          cursor.continue()
        } else {
          resolve({ count, sizeBytes })
        }
      }
    })
  } catch (error) {
    console.error('[ThumbnailCache] Get stats failed:', error)
    return { count: 0, sizeBytes: 0 }
  }
}

// Auto-clear expired thumbnails on app start
if (typeof window !== 'undefined') {
  setTimeout(() => {
    clearExpiredThumbnails().catch(console.error)
  }, 5000)
}
