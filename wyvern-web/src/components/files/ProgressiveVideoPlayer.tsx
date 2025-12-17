/**
 * Progressive Video Player using MediaSource API
 * Allows playback to start after first few chunks are loaded
 */
import { useState, useEffect, useRef, useCallback } from 'react'
import { X, Download, Loader, AlertCircle } from 'lucide-react'
import type { WyvernFile, ChunkInfo, LegacyChunkInfo } from '../../lib/types'
import { normalizeChunk } from '../../lib/types'
import { fetchViaExtension } from '../../lib/extension'
import { decryptChunk, restoreEncryptionContext } from '../../lib/encryption'
import { decompressData } from '../../lib/compression'
import { useFileStore } from '../../stores/fileStore'
import './PreviewModal.css'

interface ProgressivePlayerProps {
  file: WyvernFile
  onClose: () => void
}

// Minimum chunks to buffer before starting playback
const MIN_CHUNKS_TO_START = 2

export function ProgressiveVideoPlayer({ file, onClose }: ProgressivePlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const mediaSourceRef = useRef<MediaSource | null>(null)
  const sourceBufferRef = useRef<SourceBuffer | null>(null)
  const chunksQueueRef = useRef<ArrayBuffer[]>([])
  const isAppendingRef = useRef(false)

  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [loadedChunks, setLoadedChunks] = useState(0)
  const [totalChunks, setTotalChunks] = useState(0)
  const [canPlay, setCanPlay] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)

  const { downloadFile, encryptionPassword } = useFileStore()

  // Get codec string for the video
  const getCodecString = (filename: string): string => {
    const ext = filename.split('.').pop()?.toLowerCase()
    // Common codec strings for MediaSource
    switch (ext) {
      case 'mp4':
      case 'm4v':
        return 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
      case 'webm':
        return 'video/webm; codecs="vp8, vorbis"'
      default:
        return 'video/mp4; codecs="avc1.42E01E, mp4a.40.2"'
    }
  }

  // Append queued chunks to SourceBuffer
  const appendNextChunk = useCallback(() => {
    if (!sourceBufferRef.current || isAppendingRef.current) return
    if (chunksQueueRef.current.length === 0) return
    if (sourceBufferRef.current.updating) return

    const chunk = chunksQueueRef.current.shift()
    if (!chunk) return

    isAppendingRef.current = true
    try {
      sourceBufferRef.current.appendBuffer(chunk)
    } catch (e) {
      console.error('[ProgressivePlayer] Failed to append buffer:', e)
      isAppendingRef.current = false
    }
  }, [])

  // Main loading effect
  useEffect(() => {
    if (!file?.content) {
      setError('No file content')
      return
    }

    let cancelled = false
    const abortController = new AbortController()

    const startStreaming = async () => {
      try {
        // Parse chunks
        const rawChunks: (ChunkInfo | LegacyChunkInfo)[] = JSON.parse(file.content!)
        const chunks = rawChunks.map(c => normalizeChunk(c))
        chunks.sort((a, b) => a.i - b.i)
        setTotalChunks(chunks.length)

        // Check MediaSource support
        if (!('MediaSource' in window)) {
          throw new Error('MediaSource API not supported - falling back to download')
        }

        const codecString = getCodecString(file.name)
        if (!MediaSource.isTypeSupported(codecString)) {
          throw new Error(`Codec not supported: ${codecString}`)
        }

        // Get decryption key if needed
        let decryptionKey: CryptoKey | null = null
        if (file.encrypted && encryptionPassword) {
          if (!file.encryption_salt) throw new Error('Missing encryption salt')
          decryptionKey = await restoreEncryptionContext(encryptionPassword, file.encryption_salt)
        } else if (file.encrypted && !encryptionPassword) {
          throw new Error('File is encrypted but no password available')
        }

        // Create MediaSource
        const mediaSource = new MediaSource()
        mediaSourceRef.current = mediaSource

        const objectUrl = URL.createObjectURL(mediaSource)
        if (videoRef.current) {
          videoRef.current.src = objectUrl
        }

        // Wait for MediaSource to open
        await new Promise<void>((resolve, reject) => {
          mediaSource.addEventListener('sourceopen', () => resolve(), { once: true })
          mediaSource.addEventListener('error', (e) => reject(e), { once: true })
        })

        if (cancelled) return

        // Create SourceBuffer
        const sourceBuffer = mediaSource.addSourceBuffer(codecString)
        sourceBufferRef.current = sourceBuffer

        sourceBuffer.addEventListener('updateend', () => {
          isAppendingRef.current = false
          appendNextChunk()

          // Check if we have enough to start playback
          if (!canPlay && loadedChunks >= MIN_CHUNKS_TO_START) {
            setCanPlay(true)
            setIsLoading(false)
            if (videoRef.current) {
              videoRef.current.play().catch(console.error)
            }
          }
        })

        sourceBuffer.addEventListener('error', (e) => {
          console.error('[ProgressivePlayer] SourceBuffer error:', e)
        })

        // Start fetching chunks
        console.log(`[ProgressivePlayer] Starting to load ${chunks.length} chunks`)

        for (let i = 0; i < chunks.length; i++) {
          if (cancelled) break

          const chunk = chunks[i]
          try {
            let data = await fetchViaExtension(chunk.u, 60000) // 60s timeout per chunk

            // Decrypt if needed
            if (file.encrypted && decryptionKey && chunk.v) {
              const iv = new Uint8Array(chunk.v)
              data = await decryptChunk(data, decryptionKey, iv)
            }

            // Decompress if needed
            if (chunk.c) {
              data = await decompressData(data)
            }

            // Queue for appending
            chunksQueueRef.current.push(data)
            setLoadedChunks(i + 1)

            // Try to append
            appendNextChunk()

          } catch (e) {
            console.error(`[ProgressivePlayer] Failed to load chunk ${i}:`, e)
            // Continue loading other chunks
          }
        }

        // Signal end of stream when all chunks loaded
        if (!cancelled && mediaSource.readyState === 'open') {
          // Wait for all pending appends
          const waitForAppends = () => {
            if (chunksQueueRef.current.length === 0 && !sourceBuffer.updating) {
              mediaSource.endOfStream()
            } else {
              setTimeout(waitForAppends, 100)
            }
          }
          waitForAppends()
        }

      } catch (e) {
        console.error('[ProgressivePlayer] Error:', e)
        if (!cancelled) {
          setError((e as Error).message)
          setIsLoading(false)
        }
      }
    }

    startStreaming()

    return () => {
      cancelled = true
      abortController.abort()
      if (videoRef.current?.src) {
        URL.revokeObjectURL(videoRef.current.src)
      }
    }
  }, [file?.id, file?.content, file?.encrypted, encryptionPassword, appendNextChunk])

  // Handle video events
  const handleWaiting = () => setIsBuffering(true)
  const handlePlaying = () => setIsBuffering(false)
  const handleCanPlay = () => {
    setCanPlay(true)
    setIsLoading(false)
  }

  const handleDownload = () => downloadFile(String(file.id))

  return (
    <div className="preview-modal-overlay" onClick={onClose}>
      <div className="preview-modal-content" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="preview-header">
          <span className="preview-filename">{file.name}</span>
          <div className="preview-actions">
            <button onClick={handleDownload} title="Download">
              <Download size={20} />
            </button>
            <button onClick={onClose} title="Close (Esc)">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Video content */}
        <div className="preview-body">
          {error ? (
            <div className="preview-message error">
              <p><AlertCircle size={24} /> Playback failed</p>
              <p>{error}</p>
              <button className="download-btn" onClick={handleDownload}>
                <Download size={16} /> Download Instead
              </button>
            </div>
          ) : (
            <>
              {/* Loading/Buffering overlay */}
              {(isLoading || isBuffering) && (
                <div className="video-loading-overlay">
                  <Loader size={32} className="spinner" />
                  <p>
                    {isLoading
                      ? `Loading... ${loadedChunks}/${totalChunks} chunks`
                      : 'Buffering...'}
                  </p>
                </div>
              )}

              <video
                ref={videoRef}
                controls
                autoPlay
                className="preview-video"
                onWaiting={handleWaiting}
                onPlaying={handlePlaying}
                onCanPlay={handleCanPlay}
                onError={(e) => {
                  const target = e.target as HTMLVideoElement
                  console.error('Video error:', target.error)
                  if (!canPlay) {
                    setError('Video failed to load')
                  }
                }}
              />
            </>
          )}
        </div>

        {/* Footer */}
        <div className="preview-footer">
          <span>Loaded: {loadedChunks}/{totalChunks} chunks</span>
          <span>Size: {formatFileSize(file.size)}</span>
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
