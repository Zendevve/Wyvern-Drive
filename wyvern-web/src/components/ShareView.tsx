import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
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

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || ''
  const icons: Record<string, string> = {
    pdf: '📄',
    doc: '📝', docx: '📝',
    xls: '📊', xlsx: '📊',
    ppt: '📽️', pptx: '📽️',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    mp3: '🎵', wav: '🎵', flac: '🎵', m4a: '🎵',
    mp4: '🎬', mkv: '🎬', avi: '🎬', mov: '🎬', webm: '🎬',
    zip: '📦', rar: '📦', '7z': '📦',
    txt: '📃', md: '📃',
  }
  return icons[ext] || '📁'
}

export function ShareView() {
  const { shareId } = useParams<{ shareId: string }>()
  const [shareInfo, setShareInfo] = useState<ShareInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [password, setPassword] = useState('')
  const [downloading, setDownloading] = useState(false)

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
        return
      }

      // Trigger download
      const blob = await res.blob()
      const downloadUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = downloadUrl
      a.download = shareInfo.fileName
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(downloadUrl)
    } catch {
      setError('Download failed')
    } finally {
      setDownloading(false)
    }
  }

  if (loading) {
    return (
      <div className="share-view">
        <div className="share-card">
          <div className="share-loading">
            <div className="spinner"></div>
            <p>Loading share...</p>
          </div>
        </div>
      </div>
    )
  }

  if (error && !shareInfo) {
    return (
      <div className="share-view">
        <div className="share-card share-error">
          <div className="error-icon">❌</div>
          <h2>Share Unavailable</h2>
          <p>{error}</p>
          <a href="/" className="back-link">← Go to Wyvern Drive</a>
        </div>
      </div>
    )
  }

  if (!shareInfo) return null

  return (
    <div className="share-view">
      <div className="share-card">
        <div className="share-header">
          <div className="wyvern-logo">◇ WYVERN DRIVE</div>
          <h1>Shared File</h1>
        </div>

        <div className="file-preview">
          <div className="file-icon">{getFileIcon(shareInfo.fileName)}</div>
          <div className="file-info">
            <h2 className="file-name">{shareInfo.fileName}</h2>
            <p className="file-size">{formatFileSize(shareInfo.fileSize)}</p>
          </div>
        </div>

        {shareInfo.passwordRequired && (
          <div className="password-section">
            <label htmlFor="share-password">This file is password protected</label>
            <input
              id="share-password"
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleDownload()}
            />
          </div>
        )}

        {error && <p className="error-message">{error}</p>}

        <button
          className="download-btn"
          onClick={handleDownload}
          disabled={downloading || (shareInfo.passwordRequired && !password)}
        >
          {downloading ? (
            <>
              <span className="spinner-small"></span>
              Downloading...
            </>
          ) : (
            <>
              ⬇️ Download File
            </>
          )}
        </button>

        <div className="share-meta">
          {shareInfo.expiresAt && (
            <p>Expires: {new Date(shareInfo.expiresAt).toLocaleDateString()}</p>
          )}
          <p>{shareInfo.downloadCount} download{shareInfo.downloadCount !== 1 ? 's' : ''}</p>
        </div>
      </div>
    </div>
  )
}
