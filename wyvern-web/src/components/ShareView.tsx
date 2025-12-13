import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { Download, File, Loader, AlertCircle, Shield, Clock, HardDrive } from 'lucide-react'
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

const API_URL = 'https://lrqnovltirjsoqfvtxxu.supabase.co/functions/v1/api'
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycW5vdmx0aXJqc29xZnZ0eHh1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU1NzQ0MjcsImV4cCI6MjA4MTE1MDQyN30.rpusoKvKGgWHofrM15aqWMh5F6A8yx78u_n2vgXxm1Q'

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

  // Download state
  const [downloading, setDownloading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [loadedSize, setLoadedSize] = useState(0)
  const [downloadSpeed, setDownloadSpeed] = useState(0) // bytes per second

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

  const handleDownload = async () => {
    if (!shareId || !shareInfo) return

    setDownloading(true)
    setProgress(0)
    setLoadedSize(0)
    setDownloadSpeed(0)
    setError(null)

    try {
      const url = new URL(`${API_URL}/share/${shareId}`)
      if (shareInfo.passwordRequired && password) {
        url.searchParams.set('password', password)
      }

      const res = await fetch(url.toString(), {
        headers: {
          'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        }
      })

      if (!res.ok) {
        const data = await res.json()
        if (data.passwordRequired) {
          setError('Incorrect password')
        } else {
          setError(data.error || 'Download failed')
        }
        setDownloading(false)
        return
      }

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
      const blob = new Blob(chunks)
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
      setError('Download interrupted')
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
          {!downloading ? (
            <button
              className="download-btn premium-btn"
              onClick={handleDownload}
              disabled={shareInfo.passwordRequired && !password}
            >
              <Download size={20} />
              <span>Download File</span>
            </button>
          ) : (
            <div className="download-progress-container">
              <div className="progress-header">
                <span className="progress-status">Downloading...</span>
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
    </div>
  )
}
