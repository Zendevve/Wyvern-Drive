import { useState, useEffect, useCallback, useRef } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader, RotateCcw, Music, FileText, AlertCircle } from 'lucide-react'
import type { WyvernFile, ChunkInfo, LegacyChunkInfo } from '../../lib/types'
import { normalizeChunk } from '../../lib/types'
import { isImageFile, isVideoFile, isAudioFile, getMimeType } from '../../lib/thumbnails'
import { useFileStore } from '../../stores/fileStore'
import { useAudioPlayer } from '../../stores/audioPlayerStore'
import { decryptChunk } from '../../lib/encryption'
import { restoreEncryptionContext } from '../../lib/encryption'
import { decompressData } from '../../lib/compression'
import { fetchChunkWithRetry } from '../../lib/chunkFetcher'
import './PreviewModal.css'

interface PreviewModalProps {
  file: WyvernFile | null
  onClose: () => void
  onNavigate?: (direction: 'prev' | 'next') => void
  hasPrev?: boolean
  hasNext?: boolean
}

export function PreviewModal({ file, onClose, onNavigate, hasPrev, hasNext }: PreviewModalProps) {
  const [zoom, setZoom] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedChunks, setLoadedChunks] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const imageRef = useRef<HTMLImageElement>(null)
  const { downloadFile, encryptionPassword } = useFileStore()

  // Reset state when file changes
  useEffect(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
    setPreviewUrl(null)
    setError(null)
    setIsLoading(false)
    setLoadedChunks(0)
    setTotalChunks(0)
  }, [file?.id])

  // Reset zoom and position
  const resetView = useCallback(() => {
    setZoom(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  // Handle mouse drag for panning
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (zoom <= 1) return // Only pan when zoomed in
    e.preventDefault()
    setIsDragging(true)
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y })
  }, [zoom, position])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging) return
    const newX = e.clientX - dragStart.x
    const newY = e.clientY - dragStart.y
    setPosition({ x: newX, y: newY })
  }, [isDragging, dragStart])

  const handleMouseUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Handle wheel zoom (centered on cursor)
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY > 0 ? -0.1 : 0.1
    setZoom(z => Math.min(Math.max(z + delta, 0.5), 5))
  }, [])

  // Double-click to reset or fit
  const handleDoubleClick = useCallback(() => {
    if (zoom !== 1 || position.x !== 0 || position.y !== 0) {
      resetView()
    } else {
      setZoom(2) // Zoom in on double-click when at 100%
    }
  }, [zoom, position, resetView])

  // Load preview when file changes (for images, videos, audio)
  useEffect(() => {
    if (!file) return
    if (!isImageFile(file.name) && !isVideoFile(file.name) && !isAudioFile(file.name)) return

    const loadPreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // NOTE: Streaming URL approach blocked by JWT verification on Edge Function
        // For now, use chunk-based download for all media types
        // TODO: Implement signed URLs or disable JWT for stream endpoint

        // Download all chunks for preview
        if (!file.content) {
          throw new Error('No content data')
        }

        const rawChunks: (ChunkInfo | LegacyChunkInfo)[] = JSON.parse(file.content)
        const chunks = rawChunks.map(c => normalizeChunk(c))
        chunks.sort((a, b) => a.i - b.i)

        // NOTE: SW streaming only works in production builds
        // For reliability, always use blob download for all media types
        // This downloads full file but ensures playback works everywhere

        // Get decryption key if encrypted
        let decryptionKey: CryptoKey | null = null
        if (file.encrypted && encryptionPassword) {
          if (!file.encryption_salt) {
            throw new Error('Missing encryption salt')
          }
          decryptionKey = await restoreEncryptionContext(encryptionPassword, file.encryption_salt)
        } else if (file.encrypted && !encryptionPassword) {
          throw new Error('File is encrypted but no password available')
        }

        // Fetch and reassemble chunks
        const fileParts: ArrayBuffer[] = []

        for (const chunk of chunks) {
          let data = await fetchChunkWithRetry(chunk)

          // Decrypt first if needed
          if (file.encrypted && decryptionKey && chunk.v) {
            const iv = new Uint8Array(chunk.v)
            data = await decryptChunk(data, decryptionKey, iv)
          }

          // Then decompress if chunk was compressed
          if (chunk.c) {
            data = await decompressData(data)
          }

          fileParts.push(data)
        }

        // Create blob URL
        const blob = new Blob(fileParts, { type: getMimeType(file.name) })
        const url = URL.createObjectURL(blob)
        setPreviewUrl(url)

      } catch (err) {
        console.error('Preview load failed:', err)
        setError((err as Error).message)
      } finally {
        setIsLoading(false)
      }
    }

    loadPreview()

    // Cleanup blob URL (but not stream URLs)
    return () => {
      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [file?.id, file?.content, file?.encrypted, encryptionPassword])

  // Send audio to persistent player when preview URL is ready
  const { playTrack } = useAudioPlayer()
  useEffect(() => {
    if (!file || !previewUrl) return
    if (!isAudioFile(file.name)) return

    // Send to persistent audio player
    playTrack({
      id: String(file.id),
      name: file.name,
      file: file,
      blobUrl: previewUrl
    })
  }, [file?.id, previewUrl, playTrack])


  // Keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    switch (e.key) {
      case 'Escape':
        onClose()
        break
      case 'ArrowLeft':
        if (hasPrev && onNavigate) onNavigate('prev')
        break
      case 'ArrowRight':
        if (hasNext && onNavigate) onNavigate('next')
        break
      case '+':
      case '=':
        setZoom(z => Math.min(z + 0.25, 3))
        break
      case '-':
        setZoom(z => Math.max(z - 0.25, 0.5))
        break
    }
  }, [onClose, onNavigate, hasPrev, hasNext])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (file) {
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [file])

  if (!file) return null

  const isImage = isImageFile(file.name)
  const isVideo = isVideoFile(file.name)
  const isAudio = isAudioFile(file.name)
  const mimeType = getMimeType(file.name)

  const handleDownload = () => {
    downloadFile(String(file.id))
  }

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-header">
          <span className="preview-filename">{file.name}</span>
          <div className="preview-actions">
            {isImage && previewUrl && (
              <>
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} title="Zoom out (-)">
                  <ZoomOut size={20} />
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(z + 0.25, 5))} title="Zoom in (+)">
                  <ZoomIn size={20} />
                </button>
                <button onClick={resetView} title="Reset view" className={zoom !== 1 || position.x !== 0 || position.y !== 0 ? 'active' : ''}>
                  <RotateCcw size={18} />
                </button>
              </>
            )}
            <button onClick={handleDownload} title="Download">
              <Download size={20} />
            </button>
            <button onClick={onClose} title="Close (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Navigation arrows */}
        {hasPrev && onNavigate && (
          <button
            className="nav-arrow prev"
            onClick={() => onNavigate('prev')}
            title="Previous (←)"
          >
            <ChevronLeft size={32} />
          </button>
        )}
        {hasNext && onNavigate && (
          <button
            className="nav-arrow next"
            onClick={() => onNavigate('next')}
            title="Next (→)"
          >
            <ChevronRight size={32} />
          </button>
        )}

        {/* Preview content */}
        <div
          className={`preview-body ${isDragging ? 'dragging' : ''} ${isImage && zoom > 1 ? 'pannable' : ''}`}
          onMouseDown={isImage ? handleMouseDown : undefined}
          onMouseMove={isImage ? handleMouseMove : undefined}
          onMouseUp={isImage ? handleMouseUp : undefined}
          onMouseLeave={isImage ? handleMouseUp : undefined}
          onWheel={isImage ? handleWheel : undefined}
        >
          {isLoading ? (
            <div className="preview-loading">
              <Loader size={32} className="spinner" />
              <p>Loading preview{totalChunks > 0 ? ` (${loadedChunks}/${totalChunks} chunks)` : ''}...</p>
            </div>
          ) : error ? (
            <div className="preview-message error">
              <p><AlertCircle size={24} /> Preview failed</p>
              <p>{error}</p>
              <button className="download-btn" onClick={handleDownload}>
                <Download size={16} /> Download Instead
              </button>
            </div>
          ) : isImage && previewUrl ? (
            <img
              ref={imageRef}
              src={previewUrl}
              alt={file.name}
              style={{
                transform: `translate(${position.x}px, ${position.y}px) scale(${zoom})`,
                cursor: zoom > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default'
              }}
              className="preview-image"
              onDoubleClick={handleDoubleClick}
              draggable={false}
            />
          ) : isImage ? (
            <div className="preview-message">
              <Loader size={32} className="spinner" />
              <p>Preparing preview...</p>
            </div>
          ) : isVideo && previewUrl ? (
            <video
              src={previewUrl}
              controls
              autoPlay
              className="preview-video"
            >
              Your browser does not support video playback.
            </video>
          ) : isVideo ? (
            <div className="preview-message">
              <Loader size={32} className="spinner" />
              <p>Loading video... {loadedChunks}/{totalChunks} chunks</p>
            </div>
          ) : isAudio && previewUrl ? (
            <div className="audio-player-container">
              <Music size={48} className="audio-icon-svg" />
              <p className="audio-filename">{file.name}</p>
              <p className="audio-hint">Playing in persistent player below</p>
              <button className="download-btn" onClick={onClose}>
                Close Preview
              </button>
            </div>
          ) : isAudio ? (
            <div className="preview-message">
              <Loader size={32} className="spinner" />
              <p>Loading audio...</p>
            </div>
          ) : (
            <div className="preview-message">
              <p><FileText size={24} /> File Preview</p>
              <p>{file.name}</p>
              <button className="download-btn" onClick={handleDownload}>
                <Download size={16} /> Download File
              </button>
            </div>
          )}
        </div>

        {/* Footer with file info */}
        <div className="preview-footer">
          <span>Size: {formatFileSize(file.size)}</span>
          <span>Type: {mimeType}</span>
        </div>
      </div>
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
