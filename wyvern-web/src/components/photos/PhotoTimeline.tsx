/**
 * PhotoTimeline - Google Photos-like timeline view
 * Groups images by date with virtualized scrolling
 */

import { useState, useMemo, useEffect, useCallback, useRef } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { useFileStore } from '../../stores/fileStore'
import { Calendar, Image as ImageIcon, Loader } from 'lucide-react'
import type { WyvernFile, ChunkInfo, LegacyChunkInfo } from '../../lib/types'
import { normalizeChunk } from '../../lib/types'
import { isImageFile, getMimeType } from '../../lib/thumbnails'
import { decryptChunk, restoreEncryptionContext } from '../../lib/encryption'
import { decompressData } from '../../lib/compression'
import { fetchViaExtension } from '../../lib/extension' // Import centralized utility
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
 * Get date key from file (YYYY-MM-DD)
 */
function getDateKey(file: WyvernFile): string {
  // Use updated_at or created_at as fallback
  const dateStr = file.updated_at || file.created_at
  if (!dateStr) return 'Unknown'

  const date = new Date(dateStr)
  if (isNaN(date.getTime())) return 'Unknown'

  return date.toISOString().split('T')[0]
}

/**
 * PhotoThumbnail - Individual photo with lazy loading
 */
function PhotoThumbnail({ photo, onClick }: { photo: WyvernFile; onClick: () => void }) {
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(false)
  const { encryptionPassword, selectedIds, toggleSelection } = useFileStore()

  const isSelected = selectedIds.has(String(photo.id))

  useEffect(() => {
    if (thumbnail || !photo.content) return

    const loadThumbnail = async () => {
      setIsLoading(true)
      try {
        const rawChunks: (ChunkInfo | LegacyChunkInfo)[] = JSON.parse(photo.content)
        const chunks = rawChunks.map(c => normalizeChunk(c))
        chunks.sort((a, b) => a.i - b.i)

        // Get decryption key if encrypted
        let decryptionKey: CryptoKey | null = null
        if (photo.encrypted && encryptionPassword && photo.encryption_salt) {
          decryptionKey = await restoreEncryptionContext(encryptionPassword, photo.encryption_salt)
        }

        // Fetch chunks
        const fileParts: ArrayBuffer[] = []
        for (const chunk of chunks) {
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

        const blob = new Blob(fileParts, { type: getMimeType(photo.name) })
        const url = URL.createObjectURL(blob)
        setThumbnail(url)
      } catch (err) {
        console.error('Photo thumbnail failed:', err)
        setError(true)
      } finally {
        setIsLoading(false)
      }
    }

    loadThumbnail()

    return () => {
      if (thumbnail) URL.revokeObjectURL(thumbnail)
    }
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
      className={`photo-thumbnail ${isSelected ? 'selected' : ''}`}
      onClick={handleClick}
    >
      {isLoading ? (
        <div className="photo-loading">
          <Loader size={20} className="spinner" />
        </div>
      ) : thumbnail ? (
        <img src={thumbnail} alt={photo.name} loading="lazy" />
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

  // Filter to only image files
  const imageFiles = useMemo(() => {
    return Object.values(files)
      .filter((f): f is WyvernFile => f.type === 'file' && isImageFile(f.name))
      .sort((a, b) => {
        const dateA = new Date(a.updated_at || a.created_at || 0).getTime()
        const dateB = new Date(b.updated_at || b.created_at || 0).getTime()
        return dateB - dateA // Newest first
      })
  }, [files])

  // Group photos by date
  const photoGroups = useMemo(() => {
    const groups: Map<string, WyvernFile[]> = new Map()

    imageFiles.forEach(photo => {
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
  }, [imageFiles])

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
  const totalPhotos = imageFiles.length

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


