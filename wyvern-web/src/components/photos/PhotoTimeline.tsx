/**
 * PhotoTimeline - Google Photos-like timeline view
 * Groups images by date with virtualized scrolling
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useFileStore } from '../../stores/fileStore'
import { Calendar, Image as ImageIcon, Loader, Video } from 'lucide-react'
import type { WyvernFile, ChunkInfo, LegacyChunkInfo } from '../../lib/types'
import { normalizeChunk } from '../../lib/types'
import { isImageFile, isVideoFile, getMimeType } from '../../lib/thumbnails'
import { decryptChunk, restoreEncryptionContext } from '../../lib/encryption'
import { decompressData } from '../../lib/compression'
import {
  getCachedThumbnail,
  setCachedThumbnail,
  getLoadingPromise,
  setLoadingPromise
} from '../../lib/thumbnailCache'
import './PhotoTimeline.css'

// Types
interface PhotoGroup {
  date: string        // "2024-12-14"
  label: string       // "Today", "Yesterday", "December 14"
  photos: WyvernFile[]
}

interface TimelineRow {
  type: 'header' | 'photos'
  group: PhotoGroup
  photoStartIndex?: number  // For photo rows
}

// Constants
const PHOTOS_PER_ROW = 6
const PHOTO_HEIGHT = 160
const HEADER_HEIGHT = 48

/**
 * Format date for display
 */
function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const isToday = date.toDateString() === today.toDateString()
  const isYesterday = date.toDateString() === yesterday.toDateString()
  const isThisYear = date.getFullYear() === today.getFullYear()

  if (isToday) return 'Today'
  if (isYesterday) return 'Yesterday'

  const options: Intl.DateTimeFormatOptions = isThisYear
    ? { month: 'long', day: 'numeric' }
    : { month: 'long', day: 'numeric', year: 'numeric' }

  return date.toLocaleDateString('en-US', options)
}

/**
 * Get date key from file (YYYY-MM-DD in local time)
 */
function getDateKey(file: WyvernFile): string {
  // Use updated_at or created_at as fallback
  const dateStr = file.updated_at || file.created_at
  if (!dateStr) return 'Unknown'

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Unknown'

  // Use local time, not UTC, to match formatDateLabel behavior
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Extract first frame from video as thumbnail
 */
async function extractVideoFrame(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true

    video.onloadeddata = () => {
      video.currentTime = 1 // Seek to 1 second for better thumbnail
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 200
        canvas.height = 200

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }

        // Calculate cover fit
        const scale = Math.max(canvas.width / video.videoWidth, canvas.height / video.videoHeight)
        const x = (canvas.width - video.videoWidth * scale) / 2
        const y = (canvas.height - video.videoHeight * scale) / 2

        ctx.drawImage(video, x, y, video.videoWidth * scale, video.videoHeight * scale)
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve(thumbUrl)
      } catch {
        resolve(null)
      }
    }

    video.onerror = () => resolve(null)
    setTimeout(() => resolve(null), 10000)

    video.src = videoUrl
    video.load()
  })
}

/**
 * PhotoThumbnail - Individual photo/video with lazy loading
 */
function PhotoThumbnail({ photo, onClick }: { photo: WyvernFile; onClick: () => void }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const { encryptionPassword, selectedIds, toggleSelection } = useFileStore()

  const isSelected = selectedIds.has(String(photo.id))
  const isVideo = isVideoFile(photo.name)

  useEffect(() => {
    // Check cache first - instant display without network request
    const cachedUrl = getCachedThumbnail(String(photo.id))
    if (cachedUrl) {
      setThumbnail(cachedUrl)
      return
    }

    if (thumbnail || !photo.content) return

    // Check if already loading - wait for that instead of starting new load
    const existingPromise = getLoadingPromise(String(photo.id))
    if (existingPromise) {
      setIsLoading(true)
      existingPromise
        .then(url => {
          setThumbnail(url)
        })
        .catch(() => {
          setError(true)
        })
        .finally(() => {
          setIsLoading(false)
        })
      return
    }

    // Start new load - ONLY fetch first chunk for thumbnails to save memory
    const loadThumbnail = async (): Promise<string> => {
      const rawChunks: (ChunkInfo | LegacyChunkInfo)[] = JSON.parse(photo.content!)
      const chunks = rawChunks.map(c => normalizeChunk(c))
      chunks.sort((a, b) => a.i - b.i)

      // Get decryption key if encrypted
      let decryptionKey: CryptoKey | null = null
      if (photo.encrypted && encryptionPassword && photo.encryption_salt) {
        decryptionKey = await restoreEncryptionContext(encryptionPassword, photo.encryption_salt)
      }

      // Dynamic import to avoid circular dependency
      const { fetchViaExtension } = await import('../../lib/extension')

      // For thumbnails, only fetch first chunk (enough for preview)
      // For videos, might need more chunks to extract a frame
      const chunksToFetch = isVideo ? chunks.slice(0, 2) : chunks.slice(0, 1)

      const fileParts: ArrayBuffer[] = []
      for (const chunk of chunksToFetch) {
        let data = await fetchViaExtension(chunk.u)

        if (photo.encrypted && decryptionKey && chunk.v) {
          const iv = new Uint8Array(chunk.v)
          data = await decryptChunk(data, decryptionKey, iv)
        }

        if (chunk.c) {
          data = await decompressData(data)
        }

        fileParts.push(data)
      }

      // Create partial blob - may be incomplete but enough for thumbnail
      const mimeType = getMimeType(photo.name)
      const blob = new Blob(fileParts, { type: mimeType })

      if (isVideo) {
        // Extract frame from video (partial data may work for some formats)
        const videoUrl = URL.createObjectURL(blob)
        try {
          const thumbUrl = await extractVideoFrame(videoUrl)
          URL.revokeObjectURL(videoUrl)
          if (!thumbUrl) {
            throw new Error('Failed to extract video frame')
          }
          return thumbUrl
        } catch {
          URL.revokeObjectURL(videoUrl)
          throw new Error('Video frame extraction failed')
        }
      } else {
        // Direct display for images - first chunk usually has enough data
        return URL.createObjectURL(blob)
      }
    }

    setIsLoading(true)

    // Create promise and register it for deduplication
    const promise = loadThumbnail()
    setLoadingPromise(String(photo.id), promise)

    promise
      .then(url => {
        // Store in cache for reuse
        setCachedThumbnail(String(photo.id), url)
        setThumbnail(url)
      })
      .catch(err => {
        console.error('Photo thumbnail failed:', err)
        setError(true)
      })
      .finally(() => {
        setIsLoading(false)
      })

    // No cleanup needed - cache manages blob URL lifecycle
  }, [photo.id, photo.content, encryptionPassword])

  const handleClick = (e: React.MouseEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      toggleSelection(String(photo.id))
    } else {
      onClick()
    }
  }

  return (
    <div
      className={`photo-thumbnail ${isSelected ? 'selected' : ''} ${isVideo ? 'is-video' : ''}`}
      onClick={handleClick}
    >
      {isLoading ? (
        <div className="photo-loading">
          <Loader size={20} className="spinner" />
        </div>
      ) : thumbnail ? (
        <>
          <img src={thumbnail} alt={photo.name} loading="lazy" />
          {isVideo && <div className="video-badge"><Video size={16} /></div>}
        </>
      ) : error ? (
        <div className="photo-error">
          <ImageIcon size={24} />
        </div>
      ) : (
        <div className="photo-placeholder">
          <ImageIcon size={24} />
        </div>
      )}
      {isSelected && <div className="photo-check">✓</div>}
    </div>
  )
}

/**
 * Main PhotoTimeline Component
 */
export function PhotoTimeline() {
  const { files, setPreviewFile, loadFiles, isLoading } = useFileStore()
  const parentRef = useRef<HTMLDivElement>(null)

  // Filter to images and videos (media files)
  const mediaFiles = useMemo(() => {
    return Object.values(files)
      .filter((f): f is WyvernFile => f.type === 'file' && (isImageFile(f.name) || isVideoFile(f.name)))
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
        return dateB - dateA // Newest first
      })
  }, [files])

  // Group photos by date
  const photoGroups = useMemo(() => {
    const groups: Map<string, WyvernFile[]> = new Map()

    mediaFiles.forEach(photo => {
      const key = getDateKey(photo)
      const existing = groups.get(key) || []
      existing.push(photo)
      groups.set(key, existing)
    })

    // Convert to array and sort by date (newest first)
    return Array.from(groups.entries())
      .sort((a, b) => b[0].localeCompare(a[0]))
      .map(([date, photos]): PhotoGroup => ({
        date,
        label: formatDateLabel(date),
        photos
      }))
  }, [mediaFiles])

  // Build virtualized rows (headers + photo rows)
  const rows = useMemo((): TimelineRow[] => {
    const result: TimelineRow[] = []

    photoGroups.forEach(group => {
      // Add header
      result.push({ type: 'header', group })

      // Add photo rows
      const rowCount = Math.ceil(group.photos.length / PHOTOS_PER_ROW)
      for (let i = 0; i < rowCount; i++) {
        result.push({
          type: 'photos',
          group,
          photoStartIndex: i * PHOTOS_PER_ROW
        })
      }
    })

    return result
  }, [photoGroups])

  // Virtual scroller
  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (index) => rows[index].type === 'header' ? HEADER_HEIGHT : PHOTO_HEIGHT,
    overscan: 3
  })

  // Open preview
  const handlePhotoClick = useCallback((photo: WyvernFile) => {
    setPreviewFile(String(photo.id))
  }, [setPreviewFile])

  // Load files on mount
  useEffect(() => {
    if (Object.keys(files).length === 0) {
      loadFiles()
    }
  }, [])

  // Stats
  const totalPhotos = mediaFiles.length

  return (
    <div className="photo-timeline">
      {/* Header */}
      <div className="timeline-header">
        <div className="timeline-title">
          <Calendar size={20} />
          <h2>Photos</h2>
          <span className="photo-count">{totalPhotos} photos</span>
        </div>
      </div>

      {/* Timeline Content */}
      {isLoading ? (
        <div className="timeline-loading">
          <Loader size={32} className="spinner" />
          <p>Loading photos...</p>
        </div>
      ) : totalPhotos === 0 ? (
        <div className="timeline-empty">
          <ImageIcon size={48} strokeWidth={1} />
          <h3>No photos yet</h3>
          <p>Upload images to see them in your timeline</p>
        </div>
      ) : (
        <div ref={parentRef} className="timeline-scroll">
          <div
            className="timeline-inner"
            style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
          >
            {rowVirtualizer.getVirtualItems().map(virtualRow => {
              const row = rows[virtualRow.index]

              if (row.type === 'header') {
                return (
                  <div
                    key={virtualRow.key}
                    className="timeline-date-header"
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      height: `${virtualRow.size}px`,
                      transform: `translateY(${virtualRow.start}px)`
                    }}
                  >
                    <span className="date-label">{row.group.label}</span>
                    <span className="date-count">{row.group.photos.length} photos</span>
                  </div>
                )
              }

              // Photos row
              const startIdx = row.photoStartIndex || 0
              const rowPhotos = row.group.photos.slice(startIdx, startIdx + PHOTOS_PER_ROW)

              return (
                <div
                  key={virtualRow.key}
                  className="timeline-photo-row"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`
                  }}
                >
                  {rowPhotos.map(photo => (
                    <PhotoThumbnail
                      key={photo.id}
                      photo={photo}
                      onClick={() => handlePhotoClick(photo)}
                    />
                  ))}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}


