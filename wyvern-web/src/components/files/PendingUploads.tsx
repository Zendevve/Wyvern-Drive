import { useState, useEffect } from 'react'
import { Play, Trash2, Clock, File, X } from 'lucide-react'
import {
  getPendingUploads,
  deletePendingUpload,
  type PendingUpload
} from '../../lib/upload-state'
import './PendingUploads.css'

// Format bytes to human readable size
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Format time ago
function formatTimeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000)
  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

interface PendingUploadsModalProps {
  isOpen: boolean
  onClose: () => void
  onResumeUpload?: (upload: PendingUpload) => void
}

export function PendingUploadsModal({ isOpen, onClose, onResumeUpload }: PendingUploadsModalProps) {
  const [pendingUploads, setPendingUploads] = useState<PendingUpload[]>([])
  const [loading, setLoading] = useState(true)

  // Load pending uploads on mount
  useEffect(() => {
    if (isOpen) {
      loadPendingUploads()
    }
  }, [isOpen])

  const loadPendingUploads = async () => {
    setLoading(true)
    try {
      const uploads = await getPendingUploads()
      setPendingUploads(uploads)
    } catch (error) {
      console.error('Failed to load pending uploads:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await deletePendingUpload(id)
      setPendingUploads(prev => prev.filter(u => u.id !== id))
    } catch (error) {
      console.error('Failed to delete pending upload:', error)
    }
  }

  const handleResume = (upload: PendingUpload) => {
    if (onResumeUpload) {
      onResumeUpload(upload)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="pending-modal-overlay" onClick={onClose}>
      <div className="pending-modal" onClick={e => e.stopPropagation()}>
        <div className="pending-header">
          <h2>Pending Uploads</h2>
          <button className="close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="pending-content">
          {loading ? (
            <div className="pending-loading">Loading...</div>
          ) : pendingUploads.length === 0 ? (
            <div className="pending-empty">
              <Clock size={48} />
              <p>No pending uploads</p>
              <span>Interrupted uploads will appear here</span>
            </div>
          ) : (
            <div className="pending-list">
              {pendingUploads.map(upload => {
                const progress = (upload.uploadedChunks.length / upload.totalChunks) * 100
                return (
                  <div key={upload.id} className="pending-item">
                    <div className="pending-item-icon">
                      <File size={24} />
                    </div>
                    <div className="pending-item-info">
                      <div className="pending-item-name">{upload.fileName}</div>
                      <div className="pending-item-meta">
                        <span>{formatBytes(upload.fileSize)}</span>
                        <span className="meta-sep">•</span>
                        <span>{upload.uploadedChunks.length}/{upload.totalChunks} chunks</span>
                        <span className="meta-sep">•</span>
                        <span>{formatTimeAgo(upload.lastUpdatedAt)}</span>
                      </div>
                      <div className="pending-progress-bar">
                        <div
                          className="pending-progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                    <div className="pending-item-actions">
                      <button
                        className="pending-btn resume"
                        onClick={() => handleResume(upload)}
                        title="Resume upload"
                      >
                        <Play size={16} />
                      </button>
                      <button
                        className="pending-btn delete"
                        onClick={() => handleDelete(upload.id)}
                        title="Cancel upload"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {pendingUploads.length > 0 && (
          <div className="pending-footer">
            <span className="pending-count">
              {pendingUploads.length} pending upload{pendingUploads.length !== 1 ? 's' : ''}
            </span>
            <p className="pending-tip">
              Select the same file to resume an upload automatically
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
