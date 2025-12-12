import { useState, useEffect, useCallback } from 'react'
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Loader } from 'lucide-react'
import type { WyvernFile, ChunkInfo } from '../../lib/types'
import { isImageFile, isVideoFile, isAudioFile, getMimeType } from '../../lib/thumbnails'
import { useFileStore } from '../../stores/fileStore'
import { decryptChunk } from '../../lib/encryption'
import { restoreEncryptionContext } from '../../lib/encryption'
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
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { downloadFile, encryptionPassword } = useFileStore()

  // Reset state when file changes
  useEffect(() => {
    setZoom(1)
    setPreviewUrl(null)
    setError(null)
    setIsLoading(false)
  }, [file?.id])

  // Load preview when file changes (for images, videos, audio)
  useEffect(() => {
    if (!file) return
    if (!isImageFile(file.name) && !isVideoFile(file.name) && !isAudioFile(file.name)) return

    const loadPreview = async () => {
      setIsLoading(true)
      setError(null)

      try {
        // Parse chunks
        if (!file.content) {
          throw new Error('No content data')
        }

        const chunks: ChunkInfo[] = JSON.parse(file.content)
        chunks.sort((a, b) => a.index - b.index)

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
          const data = await fetchViaExtension(chunk.url)

          // Decrypt if needed
          if (file.encrypted && decryptionKey && chunk.iv) {
            const iv = new Uint8Array(chunk.iv)
            const decrypted = await decryptChunk(data, decryptionKey, iv)
            fileParts.push(decrypted)
          } else {
            fileParts.push(data)
          }
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

    // Cleanup blob URL
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl)
      }
    }
  }, [file?.id, file?.content, file?.encrypted, encryptionPassword])

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
                <button onClick={() => setZoom(z => Math.max(z - 0.25, 0.5))} title="Zoom out">
                  <ZoomOut size={20} />
                </button>
                <span className="zoom-level">{Math.round(zoom * 100)}%</span>
                <button onClick={() => setZoom(z => Math.min(z + 0.25, 3))} title="Zoom in">
                  <ZoomIn size={20} />
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
        <div className="preview-body">
          {isLoading ? (
            <div className="preview-loading">
              <Loader size={32} className="spinner" />
              <p>Loading preview...</p>
            </div>
          ) : error ? (
            <div className="preview-message error">
              <p>❌ Preview failed</p>
              <p>{error}</p>
              <button className="download-btn" onClick={handleDownload}>
                <Download size={16} /> Download Instead
              </button>
            </div>
          ) : isImage && previewUrl ? (
            <img
              src={previewUrl}
              alt={file.name}
              style={{ transform: `scale(${zoom})` }}
              className="preview-image"
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
              <p>Loading video...</p>
            </div>
          ) : isAudio && previewUrl ? (
            <div className="audio-player-container">
              <div className="audio-icon">🎵</div>
              <p className="audio-filename">{file.name}</p>
              <audio
                src={previewUrl}
                controls
                autoPlay
                className="preview-audio"
              >
                Your browser does not support audio playback.
              </audio>
            </div>
          ) : isAudio ? (
            <div className="preview-message">
              <Loader size={32} className="spinner" />
              <p>Loading audio...</p>
            </div>
          ) : (
            <div className="preview-message">
              <p>📄 File Preview</p>
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

// Fetch via extension to bypass CORS
async function fetchViaExtension(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(7)

    const handleResponse = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.data.type === 'WYVERN_DOWNLOAD_RESPONSE' && event.data.id === requestId) {
        window.removeEventListener('message', handleResponse)

        if (event.data.error) {
          reject(new Error(event.data.error))
        } else if (event.data.data) {
          // Data is Data URL (base64)
          fetch(event.data.data)
            .then(res => res.arrayBuffer())
            .then(resolve)
            .catch(reject)
        } else {
          reject(new Error('Empty response from extension'))
        }
      }
    }

    window.addEventListener('message', handleResponse)

    // Send request
    window.postMessage({
      type: 'WYVERN_DOWNLOAD_REQUEST',
      url,
      id: requestId
    }, '*')

    // Timeout
    setTimeout(() => {
      window.removeEventListener('message', handleResponse)
      reject(new Error('Extension download timeout - is extension installed?'))
    }, 60000)
  })
}

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}
