/**
 * Global thumbnail cache to prevent re-downloading when virtual list items mount/unmount
 * This is outside React to persist across re-renders
 */

interface CacheEntry {
  url: string
  timestamp: number
}

// Cache thumbnails by file ID - survives component unmounts
const thumbnailCache = new Map<string, CacheEntry>()

// Track in-progress loads to prevent duplicate requests
const loadingPromises = new Map<string, Promise<string>>()

// Max cache size (in entries) - prevent unlimited memory growth
const MAX_CACHE_SIZE = 200
const CACHE_TTL = 5 * 60 * 1000 // 5 minutes

/**
 * Get cached thumbnail URL for a file
 */
export function getCachedThumbnail(fileId: string): string | null {
  const entry = thumbnailCache.get(fileId)
  if (!entry) return null

  // Check if expired
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    // Don't revoke URL here - it might still be in use
    thumbnailCache.delete(fileId)
    return null
  }

  return entry.url
}

/**
 * Store thumbnail URL in cache
 */
export function setCachedThumbnail(fileId: string, url: string): void {
  // Evict oldest entries if cache is full
  if (thumbnailCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = thumbnailCache.keys().next().value
    if (oldestKey) {
      const oldEntry = thumbnailCache.get(oldestKey)
      if (oldEntry) {
        // Delay revocation to prevent errors
        setTimeout(() => URL.revokeObjectURL(oldEntry.url), 500)
      }
      thumbnailCache.delete(oldestKey)
    }
  }

  thumbnailCache.set(fileId, {
    url,
    timestamp: Date.now()
  })
}

/**
 * Check if a file is currently being loaded
 */
export function isLoading(fileId: string): boolean {
  return loadingPromises.has(fileId)
}

/**
 * Get existing loading promise to await instead of starting new load
 */
export function getLoadingPromise(fileId: string): Promise<string> | null {
  return loadingPromises.get(fileId) || null
}

/**
 * Register a loading promise for deduplication
 */
export function setLoadingPromise(fileId: string, promise: Promise<string>): void {
  loadingPromises.set(fileId, promise)

  // Clean up when done (success or failure)
  promise.finally(() => {
    loadingPromises.delete(fileId)
  })
}

/**
 * Clear all cached thumbnails (e.g., on logout)
 */
export function clearThumbnailCache(): void {
  for (const entry of thumbnailCache.values()) {
    URL.revokeObjectURL(entry.url)
  }
  thumbnailCache.clear()
  loadingPromises.clear()
}

/**
 * Get cache stats for debugging
 */
export function getCacheStats(): { size: number; loading: number } {
  return {
    size: thumbnailCache.size,
    loading: loadingPromises.size
  }
}
