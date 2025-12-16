import { useRef, useState, useMemo, useCallback } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  Home,
  Cloud,
  CloudOff,
  RefreshCw,
  Clock,
  Star,
  Trash2,
  Plus,
  LogOut,
  FileUp,
  FolderUp,
  Zap,
  Settings,
  Image,
  Video,
  Music,
  FileText,
  File,
  Upload
} from 'lucide-react'
import { useFileStore } from '../../stores/fileStore'
import { PendingUploadsModal } from '../files/PendingUploads'
import type { PendingUpload } from '../../lib/upload-state'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import './Sidebar.css'

// File type categories with colors
const FILE_CATEGORIES: Record<string, { extensions: string[], colorVar: string, icon: typeof Image }> = {
  images: { extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic'], colorVar: 'var(--color-category-images)', icon: Image },
  videos: { extensions: ['mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'flv'], colorVar: 'var(--color-category-videos)', icon: Video },
  audio: { extensions: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus'], colorVar: 'var(--color-category-audio)', icon: Music },
  documents: { extensions: ['pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'ppt', 'pptx'], colorVar: 'var(--color-category-documents)', icon: FileText },
  other: { extensions: [], colorVar: 'var(--color-category-other)', icon: File }
}

function getFileCategory(filename: string): keyof typeof FILE_CATEGORIES {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
    if (config.extensions.includes(ext)) return category as keyof typeof FILE_CATEGORIES
  }
  return 'other'
}

// Helper to recursively calculate total size of all files
function calculateTotalSize(items: Record<string, WyvernFile | WyvernFolder> | null | undefined): number {
  if (!items) return 0
  let total = 0
  for (const item of Object.values(items)) {
    if (item.type === 'file') {
      total += (item as WyvernFile).size || 0
    } else if (item.type === 'directory' && (item as WyvernFolder).children) {
      total += calculateTotalSize((item as WyvernFolder).children)
    }
  }
  return total
}

// Calculate storage by file type category
function calculateStorageByCategory(items: Record<string, WyvernFile | WyvernFolder> | null | undefined): Record<string, number> {
  const result: Record<string, number> = { images: 0, videos: 0, audio: 0, documents: 0, other: 0 }
  if (!items) return result

  function traverse(files: Record<string, WyvernFile | WyvernFolder>) {
    for (const item of Object.values(files)) {
      if (item.type === 'file') {
        const file = item as WyvernFile
        const category = getFileCategory(file.name)
        result[category] += file.size || 0
      } else if (item.type === 'directory' && (item as WyvernFolder).children) {
        traverse((item as WyvernFolder).children)
      }
    }
  }

  traverse(items)
  return result
}

function formatStorageSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i]
}

export function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { logout, uploadFiles, uploadFolder, files, getWebhookPoolStats, setActiveModal, isSyncing, isOffline, userEmail } = useFileStore()
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [showPendingUploads, setShowPendingUploads] = useState(false)

  // Ref for resume file input
  const resumeFileInputRef = useRef<HTMLInputElement>(null)

  // Calculate total storage used from all files
  const totalStorageUsed = useMemo(() => calculateTotalSize(files), [files])

  // Calculate storage breakdown by file type
  const storageByCategory = useMemo(() => calculateStorageByCategory(files), [files])

  // Get webhook pool stats for performance indicator
  const webhookStats = getWebhookPoolStats()

  // Handle resume upload - triggers file picker
  const handleResumeUpload = useCallback((upload: PendingUpload) => {
    // Show user a message about which file to select
    alert(`Select the file "${upload.fileName}" to resume the upload from where it left off.`)
    // Trigger file picker
    resumeFileInputRef.current?.click()
  }, [])

  // Handle file selected for resume
  const onResumeFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // The uploadFiles function will automatically detect and resume pending uploads
      await uploadFiles(e.target.files)
    }
    // Reset
    if (resumeFileInputRef.current) resumeFileInputRef.current.value = ''
  }, [uploadFiles])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files)
      // Reset input
      e.target.value = ''
    }
    setIsMenuOpen(false)
  }

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFolder(e.target.files)
      e.target.value = ''
    }
    setIsMenuOpen(false)
  }

  return (
    <>
      <aside className="sidebar">
        {/* 1. App Logo / Home */}
        <div className="sidebar-header">
          <span className="app-logo">Wyvern</span>
          <span className="app-badge">Drive</span>
        </div>

        <div className="sidebar-content">
          {/* 2. Primary Action Button */}
          <div className="action-section">
            <div className="new-button-wrapper">
              <button
                className={`new-button ${isMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Create new"
                aria-haspopup="true"
                aria-expanded={isMenuOpen}
              >
                <Plus size={18} strokeWidth={2.5} />
                <span>New</span>
              </button>

              {isMenuOpen && (
                <div role="menu" aria-label="New creation options" className="new-menu-dropdown">
                  <button role="menuitem" className="menu-item" onClick={() => fileInputRef.current?.click()}>
                    <FileUp size={16} />
                    <span>File upload</span>
                  </button>
                  <button className="menu-item" onClick={() => folderInputRef.current?.click()}>
                    <FolderUp size={16} />
                    <span>Folder upload</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Hidden Inputs */}
          <input
            type="file"
            ref={fileInputRef}
            multiple
            hidden
            onChange={handleFileSelect}
          />
          <input
            type="file"
            ref={folderInputRef}
            multiple
            hidden
            // @ts-ignore - webkitdirectory is non-standard but required
            webkitdirectory=""
            // @ts-ignore
            directory=""
            onChange={handleFolderSelect}
          />

          {/* 3. Navigation Links */}
          <nav className="nav-section">
            <div className="nav-label">Locations</div>
            <button
              className={`nav-item ${location.pathname === '/app' || location.pathname === '/app/' ? 'active' : ''}`}
              onClick={() => navigate('/app')}
            >
              <Home size={18} className="nav-icon" />
              <span>Home Drive</span>
            </button>
            <button
              className={`nav-item ${location.pathname === '/app/photos' ? 'active' : ''}`}
              onClick={() => navigate('/app/photos')}
            >
              <Image size={18} className="nav-icon" />
              <span>Photos</span>
            </button>
            <button className="nav-item">
              <Cloud size={18} className="nav-icon" />
              <span>Shared with me</span>
            </button>

            <button className="nav-item">
              <Clock size={18} className="nav-icon" />
              <span>Recent</span>
            </button>
            <button className="nav-item" onClick={() => setShowPendingUploads(true)}>
              <Upload size={18} className="nav-icon" />
              <span>Pending Uploads</span>
            </button>
            <button className="nav-item">
              <Star size={18} className="nav-icon" />
              <span>Starred</span>
            </button>
            <button className="nav-item">
              <Trash2 size={18} className="nav-icon" />
              <span>Trash</span>
            </button>
          </nav>
        </div>

        {/* 4. Storage & User Profile */}
        <div className="sidebar-footer">
          <div className="storage-meter" onClick={() => setShowAnalytics(!showAnalytics)} style={{ cursor: 'pointer' }}>
            <div className="storage-text">
              <span>Storage</span>
              <span>{formatStorageSize(totalStorageUsed)} / ∞</span>
            </div>
            {/* Segmented bar showing file type distribution */}
            <div className="meter-track unlimited" style={{ display: 'flex', overflow: 'hidden' }}>
              {totalStorageUsed > 0 && Object.entries(storageByCategory).map(([category, size]) => {
                const percent = (size / totalStorageUsed) * 100
                if (percent < 1) return null
                return (
                  <div
                    key={category}
                    title={`${category}: ${formatStorageSize(size)}`}
                    style={{
                      width: `${percent}%`,
                      backgroundColor: FILE_CATEGORIES[category as keyof typeof FILE_CATEGORIES].colorVar,
                      height: '100%',
                      transition: 'width 0.3s ease'
                    }}
                  />
                )
              })}
              {totalStorageUsed === 0 && <div className="meter-fill" style={{ width: '100%' }} />}
            </div>
          </div>

          {/* Analytics Breakdown (collapsible) */}
          {showAnalytics && totalStorageUsed > 0 && (
            <div className="storage-analytics">
              {Object.entries(storageByCategory)
                .filter(([, size]) => size > 0)
                .sort((a, b) => b[1] - a[1])
                .map(([category, size]) => {
                  const CategoryIcon = FILE_CATEGORIES[category as keyof typeof FILE_CATEGORIES].icon
                  const color = FILE_CATEGORIES[category as keyof typeof FILE_CATEGORIES].colorVar
                  const percent = ((size / totalStorageUsed) * 100).toFixed(1)
                  return (
                    <div key={category} className="analytics-row">
                      <CategoryIcon size={14} style={{ color }} />
                      <span className="analytics-label">{category}</span>
                      <span className="analytics-value">{formatStorageSize(size)}</span>
                      <span className="analytics-percent" style={{ color }}>{percent}%</span>
                    </div>
                  )
                })}
            </div>
          )}

          {/* Connection Status Indicator */}
          <div className={`connection-indicator ${isOffline ? 'offline' : isSyncing ? 'syncing' : 'online'}`}>
            {isOffline ? (
              <>
                <CloudOff size={14} />
                <span>Offline Mode</span>
              </>
            ) : isSyncing ? (
              <>
                <RefreshCw size={14} className="spin" />
                <span>Syncing...</span>
              </>
            ) : (
              <>
                <Cloud size={14} />
                <span>Connected</span>
              </>
            )}
          </div>

          {/* Webhook Pool Performance Indicator */}
          {webhookStats && (
            <div className={`webhook-pool-indicator ${webhookStats.isOptimal ? 'optimal' : 'suboptimal'}`}>
              <div className="webhook-pool-header">
                <Zap size={14} className="webhook-icon" />
                <span>Performance</span>
                <span className="webhook-count">{webhookStats.count} webhook{webhookStats.count !== 1 ? 's' : ''}</span>
              </div>
              {webhookStats.recommendation && (
                <div className="webhook-recommendation">
                  {webhookStats.recommendation}
                </div>
              )}
            </div>
          )}

          <div className="user-profile">
            <div className="user-avatar" />
            <div className="user-info">
              <span className="username" title={userEmail || 'User'}>{userEmail || 'User'}</span>
            </div>
            <button
              onClick={() => setActiveModal('settings')}
              className="settings-btn"
              title="Settings"
            >
              <Settings size={16} />
            </button>
            <button onClick={logout} className="logout-btn" title="Logout">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      {/* Hidden file input for resume uploads */}
      <input
        ref={resumeFileInputRef}
        type="file"
        style={{ display: 'none' }}
        onChange={onResumeFileChange}
      />

      {/* Pending Uploads Modal */}
      <PendingUploadsModal
        isOpen={showPendingUploads}
        onClose={() => setShowPendingUploads(false)}
        onResumeUpload={handleResumeUpload}
      />
    </>
  )
}
