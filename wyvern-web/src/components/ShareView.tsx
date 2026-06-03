import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Download, File, Loader, AlertCircle, Shield, Clock, HardDrive, Play } from 'lucide-react'
import { waitForExtension, fetchViaExtension, isExtensionAvailable } from '../lib/extension'
import { MediaPlayer } from './MediaPlayer'
import { getMimeType, isMediaFile } from '../lib/mimeTypes'
import './ShareView.css'

interface ShareInfo {
  id: string
  fileName: string
  fileSize: number
  fileType: string
  expiresAt: string | null
  passwordRequired: boolean
  downloadCount: number
}

interface ChunkData {
  i?: number
  u?: string
  s?: number
  index?: number
  url?: string
  size?: number
}

interface LargeFileResponse {
  requiresExtension: true
  fileSize: number
  fileName: string
  chunks?: ChunkData[]  // API should return chunks for extension-based download
}

const API_URL = 'http://localhost:3001/api'
const SUPABASE_ANON_KEY = 'mock-anon-key'

// Threshold for extension-based downloads (files >=100MB require extension)
const EXTENSION_DOWNLOAD_THRESHOLD = 100 * 1024 * 1024

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export function ShareView() {
  const { shareId } = useParams<{ shareId: string }>()
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [extensionAvailable, setExtensionAvailable] = useState(false)

  // Media Streaming State
  const [playingFile, setPlayingFile] = useState<{ id: string, name: string, size: number, type: string } | null>(null)

  // Download state
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadedSize, setLoadedSize] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0) // bytes per second
  const [downloadStatus, setDownloadStatus] = useState('Downloading...')

  // Check for extension availability on mount
  useEffect(() => {
    const checkExtension = async () => {
      const available = await waitForExtension(3000)
      setExtensionAvailable(available)
      console.log('[ShareView] Extension available:', available)
    }
    checkExtension()
  }, [])

  useEffect(() => {
    if (!shareId) return

    const fetchShareInfo = async () => {
      try {
        const res = await fetch(`${API_URL}/share/${shareId}/info`, {
          headers: {
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
          }
        })

        if (!res.ok) {
          const data = await res.json()
          if (data.expired) {
            setError('This share link has expired.')
          } else if (res.status === 404) {
            setError('Share link not found. It may have been deleted.')
          } else {
            setError(data.error || 'Failed to load share info')
          }
          return
        }

        const data = await res.json()
        setShareInfo(data)
      } catch {
        setError('Failed to connect to server')
      } finally {
        setLoading(false)
      }
    }

    fetchShareInfo()
  }, [shareId])


  // Stream large file using FileSystem Access API (prevents OOM)
  const streamViaExtension = async (fileName: string, totalSize: number) => {
    try {
      // 1. Get file handle from user
      // @ts-ignore - File System Access API
      const handle = await window.showSaveFilePicker({
        suggestedName: fileName,
      })
      const writable = await handle.createWritable()

      // 2. Start pagination loop
      const CHUNKS_PER_PAGE = 50
      let page = 0
      let downloadedBytes = 0
      const startTime = Date.now()

      setDownloadStatus('Initializing download stream...')

      while (true) {
        // Fetch page of chunks
        const chunksUrl = new URL(`${API_URL}/share/${shareId}/chunks`)
        chunksUrl.searchParams.set('page', page.toString())
        chunksUrl.searchParams.set('limit', CHUNKS_PER_PAGE.toString())
        if (shareInfo?.passwordRequired && password) {
          chunksUrl.searchParams.set('password', password)
        }

        const res = await fetch(chunksUrl.toString(), {
          headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
        })

        if (!res.ok) throw new Error(`Failed to fetch chunk metadata (Page ${page})`)

        const data = await res.json()
        const chunks = data.chunks || []

        if (chunks.length === 0) break // No more chunks

        // Download chunks in this page
        // Process in small batches to keep parallelism but maintain order for writing
        const BATCH_SIZE = 5

        for (let i = 0; i < chunks.length; i += BATCH_SIZE) {
          const batch = chunks.slice(i, i + BATCH_SIZE)
          const promises = batch.map((chunk: any) =>
            fetchViaExtension(chunk.u || chunk.url, 120000)
              .then(data => ({
                index: chunk.i ?? chunk.index,
                data: new Uint8Array(data)
              }))
          )

          const results = await Promise.all(promises)

          // Sort results by index to ensure correct write order
          results.sort((a, b) => a.index - b.index)

          // Write to disk
          for (const result of results) {
            await writable.write(result.data)
            downloadedBytes += result.data.length

            // Update UI
            setLoadedSize(downloadedBytes)
            setProgress((downloadedBytes / totalSize) * 100)
          }

          // Update speed
          const elapsed = (Date.now() - startTime) / 1000
          if (elapsed > 0) setDownloadSpeed(downloadedBytes / elapsed)

          setDownloadStatus(`Downloading... ${(downloadedBytes / 1024 / 1024).toFixed(0)} MB`)
        }

        if (!data.hasMore) break
        page++
      }

      await writable.close()
      setDownloadStatus('Complete!')
      setProgress(100)

    } catch (err: any) {
      console.error('[ShareView] Streaming failed:', err)
      if (err.name === 'AbortError') {
        setDownloadStatus('Cancelled')
      } else {
        setError(`Download failed: ${err.message}`)
      }
      setDownloading(false)
    }
  }

  // Legacy download for smaller files (or browsers without FS API)
  const downloadViaExtension = async (_chunks: ChunkData[], fileName: string, totalSize: number) => {
    // Check if we can use streaming (Preferred for all large files)
    // @ts-ignore
    if (window.showSaveFilePicker) {
      console.log('[ShareView] Using FileSystem Streaming for download')
      await streamViaExtension(fileName, totalSize)
      return
    }

    console.log('[ShareView] Fallback to memory download (legacy)')

    // ... Legacy implementation (simplified for brevity, or we can keep the old one if we want full fallback)
    // For now, if they don't have FS API and it's 16GB, they will crash.
    // But we can leave the old logic here if we assume the chunks passed are ALL chunks (which they won't be with pagination).
    // Actually, we need to adapt legacy to pagination too if we want it to work for medium files.
    // But for 16GB, FS API is hard requirement.

    setError('Your browser does not support the File System Access API required for this large download. Please use Chrome, Edge, or Opera.')
    setDownloading(false)
  }

  const handleDownload = async () => {
    if (!shareId || !shareInfo) return

    setDownloading(true)
    setProgress(0)
    setLoadedSize(0)
    setDownloadSpeed(0)
    setDownloadStatus('Downloading...')
    setError(null)

    try {
      // For large files, check extension first
      const isLargeFile = shareInfo.fileSize >= EXTENSION_DOWNLOAD_THRESHOLD

      if (isLargeFile) {
        // Re-check extension availability
        const extAvailable = isExtensionAvailable() || await waitForExtension(3000)
        if (!extAvailable) {
          setError('This file is too large for direct download (100MB+ limit). Please install the Wyvern Drive browser extension to download this file.')
          setDownloading(false)
          return
        }
        console.log('[ShareView] Large file detected, will use extension-based download')
      }

      const url = new URL(`${API_URL}/share/${shareId}`)
      if (shareInfo.passwordRequired && password) {
        url.searchParams.set('password', password)
      }


      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })

      console.log('[ShareView] API response status:', res.status)

      if (!res.ok) {
        const data = await res.json() as LargeFileResponse & { passwordRequired?: boolean; error?: string }
        console.log('[ShareView] API error response:', data)

        if (data.passwordRequired) {
          setError('Incorrect password')
          setDownloading(false)
          return
        }

        if (data.requiresExtension) {
          console.log('[ShareView] API says requiresExtension, checking...')

          // Send a ping right now to wake up the extension
          window.postMessage({ type: 'WYVERN_PING' }, '*')

          // Wait a moment then check availability
          await new Promise(r => setTimeout(r, 500))
          const extAvailable = isExtensionAvailable() || await waitForExtension(5000)
          console.log('[ShareView] Extension check result:', extAvailable)

          if (!extAvailable) {
            setError('This file is too large for direct download (100MB+ limit). Please install the Wyvern Drive browser extension to download this file.')
            setDownloading(false)
            return
          }

          // Extension available - fetch chunks
          console.log('[ShareView] Extension available! Fetching chunks...')
          const chunksUrl = new URL(`${API_URL}/share/${shareId}/chunks`)
          if (shareInfo.passwordRequired && password) {
            chunksUrl.searchParams.set('password', password)
          }

          const chunksRes = await fetch(chunksUrl.toString(), {
            headers: {
              'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
          })

          console.log('[ShareView] Chunks response status:', chunksRes.status)

          if (chunksRes.ok) {
            const chunksData = await chunksRes.json()
            console.log('[ShareView] Got chunks:', chunksData.chunks?.length || 0)

            if (chunksData.chunks && chunksData.chunks.length > 0) {
              await downloadViaExtension(chunksData.chunks, shareInfo.fileName, shareInfo.fileSize)
              setDownloading(false)
              return
            }
          } else {
            const chunksError = await chunksRes.json().catch(() => ({}))
            console.error('[ShareView] Chunks fetch failed:', chunksError)
          }

          // Fallback error - couldn't get chunk data
          setError('Could not retrieve file data for download. The share may have expired.')
          setDownloading(false)
          return
        }

        setError(data.error || 'Download failed')
        setDownloading(false)
        return
      }

      // Small file - stream directly
      const body = res.body
      if (!body) throw new Error('ReadableStream not supported')

      const reader = body.getReader()
      const contentLength = shareInfo.fileSize
      let receivedLength = 0
      const chunks: Uint8Array[] = []

      const startTime = Date.now()
      let lastUpdate = startTime

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        receivedLength += value.length

        // Update stats every 100ms to avoid too many renders
        const now = Date.now()
        if (now - lastUpdate > 100) {
          setLoadedSize(receivedLength)
          setProgress((receivedLength / contentLength) * 100)

          const elapsed = (now - startTime) / 1000
          if (elapsed > 0) {
            setDownloadSpeed(receivedLength / elapsed)
          }
          lastUpdate = now
        }
      }

      // Final update
      setLoadedSize(receivedLength)
      setProgress(100)

      // Create blob and download
      const blob = new Blob(chunks as any)
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = shareInfo.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)

    } catch (err) {
      console.error(err)
      setError('Download interrupted: ' + (err instanceof Error ? err.message : 'Unknown error'))
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="share-view">
        <div className="share-card loading-state">
          <Loader className="spinner" size={48} />
          <p>Loading shared file...</p>
        </div>
      </div>
    )
  }

  if (error && !shareInfo) {
    return (
      <div className="share-view">
        <div className="share-card error-state">
          <AlertCircle className="error-icon" size={64} />
          <h2>Share Unavailable</h2>
          <p>{error}</p>
          <a href="/" className="back-link">Return to Wyvern Drive</a>
        </div>
      </div>
    )
  }

  if (!shareInfo) return null

  // Determine if this file needs extension
  const needsExtension = shareInfo.fileSize >= EXTENSION_DOWNLOAD_THRESHOLD

  return (
    <div className="share-view">
      {/* Background decorations */}
      <div className="bg-blob blob-1"></div>
      <div className="bg-blob blob-2"></div>

      <div className="share-card">
        <div className="share-header">
          <div className="brand-badge">WYVERN DRIVE</div>
          <h1>Ready to download</h1>
        </div>

        <div className="file-display">
          <div className="file-icon-wrapper">
            <File size={48} className="file-icon-lucide" />
          </div>
          <div className="file-details">
            <h2 className="file-name" title={shareInfo.fileName}>{shareInfo.fileName}</h2>
            <div className="file-meta-row">
              <span className="meta-tag">
                <HardDrive size={14} />
                {formatFileSize(shareInfo.fileSize)}
              </span>
              {shareInfo.expiresAt && (
                <span className="meta-tag">
                  <Clock size={14} />
                  Expires {new Date(shareInfo.expiresAt).toLocaleDateString()}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Extension requirement notice for large files */}
        {needsExtension && !extensionAvailable && (
          <div className="extension-notice">
            This file is too large for direct download. Please install the Wyvern Drive extension to download files over 100MB.
          </div>
        )}

        {shareInfo.passwordRequired && (
          <div className="password-section">
            <div className="input-group">
              <Shield size={18} className="input-icon" />
              <input
                type="password"
                placeholder="Password required"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
              />
            </div>
          </div>
        )}

        {error && <div className="error-message">{error}</div>}

        <div className="action-area">
          {isMediaFile(shareInfo.fileName) && !downloading && (
            <button
              className="download-btn secondary-btn"
              style={{ marginBottom: '12px', background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)' }}
              onClick={() => setPlayingFile({
                id: shareId!,
                name: shareInfo.fileName,
                size: shareInfo.fileSize,
                type: getMimeType(shareInfo.fileName)
              })}
            >
              <Play size={20} />
              <span>Play Stream</span>
            </button>
          )}

          {!downloading ? (
            <button
              className="download-btn premium-btn"
              onClick={handleDownload}
              disabled={(shareInfo.passwordRequired && !password) || (needsExtension && !extensionAvailable)}
            >
              <Download size={20} />
              <span>Download File</span>
            </button>
          ) : (
            <div className="download-progress-container">
              <div className="progress-header">
                <span className="progress-status">{downloadStatus}</span>
                <span className="progress-percent">{Math.round(progress)}%</span>
              </div>
              <div className="progress-bar-track">
                <div
                  className="progress-bar-fill"
                  style={{ width: `${progress}%` }}
                ></div>
              </div>
              <div className="progress-stats">
                <span>{formatFileSize(loadedSize)} / {formatFileSize(shareInfo.fileSize)}</span>
                <span>{formatFileSize(downloadSpeed)}/s</span>
              </div>
            </div>
          )}
        </div>

        <div className="share-footer">
          <p>{shareInfo.downloadCount} Total Downloads</p>
        </div>
      </div>

      {playingFile && (
        <MediaPlayer
          shareId={playingFile.id}
          fileName={playingFile.name}
          fileSize={playingFile.size}
          mimeType={playingFile.type}
          onClose={() => setPlayingFile(null)}
        />
      )}
    </div>
  )
}
