import { useRef, useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
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


// File categories config - comprehensive extension support
const FILE_CATEGORIES: Record<string, { extensions: string[], color: string, icon: typeof Image }> = {
  images: {
    extensions: [
      'jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico', 'heic', 'heif',
      'tiff', 'tif', 'raw', 'cr2', 'nef', 'arw', 'dng', 'psd', 'ai', 'eps', 'avif'
    ],
    color: '#3b82f6',
    icon: Image
  },
  videos: {
    extensions: [
      'mp4', 'webm', 'mkv', 'avi', 'mov', 'm4v', 'flv', 'wmv', 'mpg', 'mpeg',
      '3gp', 'ts', 'mts', 'm2ts', 'vob', 'ogv', 'rm', 'rmvb', 'asf', 'divx'
    ],
    color: '#a855f7',
    icon: Video
  },
  audio: {
    extensions: [
      'mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma', 'aiff', 'ape',
      'alac', 'mid', 'midi', 'amr', 'pcm'
    ],
    color: '#10b981',
    icon: Music
  },
  documents: {
    extensions: [
      'pdf', 'doc', 'docx', 'txt', 'md', 'xls', 'xlsx', 'ppt', 'pptx', 'odt',
      'ods', 'odp', 'rtf', 'csv', 'epub', 'mobi', 'pages', 'numbers', 'key'
    ],
    color: '#f59e0b',
    icon: FileText
  },
  archives: {
    extensions: [
      'zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'cab', 'iso', 'dmg',
      'pkg', 'deb', 'rpm', 'apk', 'ipa', 'msi', 'jar', 'war'
    ],
    color: '#ec4899',
    icon: File
  },
  code: {
    extensions: [
      'js', 'ts', 'jsx', 'tsx', 'py', 'java', 'c', 'cpp', 'h', 'hpp', 'cs', 'go',
      'rs', 'rb', 'php', 'swift', 'kt', 'lua', 'sh', 'bash', 'ps1', 'bat', 'html',
      'css', 'scss', 'sass', 'vue', 'svelte', 'sql', 'json', 'xml', 'yaml', 'yml'
    ],
    color: '#06b6d4',
    icon: FileText
  },
  other: { extensions: [], color: '#6b7280', icon: File }
}

function getFileCategory(filename: string): keyof typeof FILE_CATEGORIES {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  for (const [category, config] of Object.entries(FILE_CATEGORIES)) {
    if (config.extensions.includes(ext)) return category as keyof typeof FILE_CATEGORIES
  }
  return 'other'
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

  // Input refs
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)
  const resumeInputRef = useRef<HTMLInputElement>(null)
  const pendingUploadRef = useRef<PendingUpload | null>(null)

  const webhookStats = getWebhookPoolStats()

  // Calculate stats
  // ... (Calculation logic remains same, but embedded for clarity if needed, or simplified)
  // For brevity re-using logic inline or memoized is better, but here we just need visually
  // correct rendering. I'll re-implement the calculation logic quickly inside the component
  // or helper functions defined above.

  // Re-implementing helper calculateStorageByCategory for this scope
  const calculateStorageByCategory = (items: Record<string, any>) => {
    const result: Record<string, number> = { images: 0, videos: 0, audio: 0, documents: 0, archives: 0, code: 0, other: 0 }
    if (!items) return result
    function traverse(files: Record<string, any>) {
      for (const item of Object.values(files)) {
        if (item.type === 'file') {
          const category = getFileCategory(item.name)
          result[category] += item.size || 0
        } else if (item.type === 'directory' && item.children) {
          traverse(item.children)
        }
      }
    }
    traverse(items)
    return result
  }

  const storageByCategory = calculateStorageByCategory(files)
  const totalStorageUsed = Object.values(storageByCategory).reduce((a, b) => a + b, 0)


  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFiles(e.target.files)
      setIsMenuOpen(false)
    }
  }

  const handleFolderSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      uploadFolder(e.target.files)
      setIsMenuOpen(false)
    }
  }

  // Resume upload handler - opens file picker for user to select the same file
  const handleResumeUpload = (upload: PendingUpload) => {
    pendingUploadRef.current = upload
    // Show alert to guide user
    alert(`To resume "${upload.fileName}", please select the SAME file from your computer.\n\nThe upload will continue from chunk ${upload.uploadedChunks.length + 1} of ${upload.totalChunks}.`)
    // Trigger file picker
    resumeInputRef.current?.click()
  }

  const handleResumeSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    const pending = pendingUploadRef.current

    if (!file || !pending) return

    // Check if it's the same file (by name and size)
    if (file.name !== pending.fileName || file.size !== pending.fileSize) {
      alert(`File mismatch! Expected "${pending.fileName}" (${pending.fileSize} bytes) but got "${file.name}" (${file.size} bytes).\n\nPlease select the exact same file to resume.`)
      e.target.value = ''
      return
    }

    // File matches - resume upload via uploadFiles which will detect pending state
    await uploadFiles(e.target.files!)
    pendingUploadRef.current = null
    e.target.value = ''
  }

  const NavItem = ({ to, icon: Icon, label, isActive, onClick }: any) => (
    <button
      onClick={onClick || (() => to && navigate(to))}
      className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all group ${isActive
        ? 'bg-accent/10 text-accent'
        : 'text-text-secondary hover:text-text-main hover:bg-bg-hover'
        }`}
    >
      <Icon size={18} className={isActive ? 'text-accent' : 'text-text-secondary group-hover:text-text-main'} strokeWidth={1.5} />
      <span>{label}</span>
    </button>
  )

  return (
    <>
      <aside className="w-64 h-full bg-bg-sidebar border-r border-border-divider flex flex-col flex-shrink-0 z-30">
        {/* Header */}
        <div className="h-[64px] flex items-center px-6 border-b border-transparent">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-text-main font-[Playfair_Display] font-bold text-xl tracking-tight">Wyvern</span>
            <span className="text-xs text-accent font-medium px-1.5 py-0.5 rounded border border-accent/20 bg-accent/5">Drive</span>
          </Link>
        </div>

        <div className="flex-1 flex flex-col px-4 py-6 overflow-y-auto overflow-x-hidden custom-scrollbar">
          {/* New Button */}
          <div className="relative mb-8">
            <button
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`w-full flex items-center justify-center gap-2 h-12 rounded-xl font-medium transition-all ${isMenuOpen
                ? 'bg-accent text-white shadow-lg shadow-accent/20'
                : 'bg-accent text-white hover:bg-accent-hover shadow-md shadow-accent/10'
                }`}
            >
              <Plus size={20} />
              <span>New Upload</span>
            </button>

            {/* Dropdown */}
            {isMenuOpen && (
              <div className="absolute top-14 left-0 w-full bg-bg-card border border-border-card rounded-xl shadow-2xl p-1.5 z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-text-main hover:bg-surface-hover transition-colors text-left"
                >
                  <FileUp size={16} className="text-text-secondary" />
                  File upload
                </button>
                <button
                  onClick={() => folderInputRef.current?.click()}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-text-main hover:bg-surface-hover transition-colors text-left"
                >
                  <FolderUp size={16} className="text-text-secondary" />
                  Folder upload
                </button>
              </div>
            )}
          </div>

          {/* Navigation */}
          <div className="space-y-1 mb-8">
            <div className="px-3 mb-2 text-xs font-semibold text-text-tertiary uppercase tracking-wider">Storage</div>
            <NavItem
              to="/app"
              icon={Home}
              label="Home Drive"
              isActive={location.pathname === '/app' || location.pathname === '/app/'}
            />
            <NavItem
              to="/app/photos"
              icon={Image}
              label="Photos"
              isActive={location.pathname === '/app/photos'}
            />
            <NavItem icon={Cloud} label="Shared with me" />
            <NavItem icon={Clock} label="Recent" />
            <NavItem
              icon={Upload}
              label="Pending Uploads"
              onClick={() => setShowPendingUploads(true)}
            />
            <NavItem icon={Star} label="Starred" />
            <NavItem icon={Trash2} label="Trash" />
          </div>

          {/* Storage Meter */}
          <div className="mt-auto pt-6 border-t border-border-divider">
            <div
              className="group cursor-pointer select-none"
              onClick={() => setShowAnalytics(!showAnalytics)}
            >
              <div className="flex items-center justify-between mb-2 text-sm">
                <span className="text-text-main">Storage</span>
                <span className="text-text-secondary">{formatStorageSize(totalStorageUsed)} used</span>
              </div>

              {/* Minimal Progress Bar */}
              <div className="h-1.5 w-full bg-surface rounded-full overflow-hidden flex">
                {totalStorageUsed > 0 && Object.entries(storageByCategory).map(([category, size]) => (
                  size > 0 && (
                    <div
                      key={category}
                      style={{ width: `${(size / totalStorageUsed) * 100}%`, backgroundColor: FILE_CATEGORIES[category as keyof typeof FILE_CATEGORIES].color }}
                      className="h-full"
                    />
                  )
                ))}
              </div>

              {showAnalytics && (
                <div className="mt-4 space-y-2 animate-in slide-in-from-top-2">
                  {Object.entries(storageByCategory)
                    .filter(([, size]) => size > 0)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 4) // Show top 4
                    .map(([category, size]) => (
                      <div key={category} className="flex items-center justify-between text-xs text-text-secondary">
                        <span className="capitalize flex items-center gap-1.5">
                          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: FILE_CATEGORIES[category].color }}></div>
                          {category}
                        </span>
                        <span>{formatStorageSize(size)}</span>
                      </div>
                    ))}
                </div>
              )}
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2 mt-6 p-2 rounded-lg bg-surface border border-border-divider">
              {isOffline ? <CloudOff size={14} className="text-status-red" /> : isSyncing ? <RefreshCw size={14} className="text-status-blue animate-spin" /> : <Cloud size={14} className="text-status-green" />}
              <span className="text-xs text-text-secondary">
                {isOffline ? 'Offline Mode' : isSyncing ? 'Syncing...' : 'System Operational'}
              </span>
              {webhookStats && webhookStats.isOptimal && (
                <Zap size={12} className="ml-auto text-status-yellow" fill="currentColor" />
              )}
            </div>

            {/* User Profile */}
            <div className="flex items-center justify-between mt-4 pl-1">
              <div className="flex items-center gap-2 overflow-hidden">
                <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-white/10 to-white/5 flex items-center justify-center text-xs font-medium text-text-main ring-1 ring-border-divider">
                  {userEmail?.[0]?.toUpperCase() || 'U'}
                </div>
                <div className="flex flex-col truncate">
                  <span className="text-xs font-medium text-text-main truncate max-w-[100px]">{userEmail?.split('@')[0]}</span>
                  <span className="text-[10px] text-text-label">Pro Plan</span>
                </div>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setActiveModal('settings')} className="p-1.5 text-text-secondary hover:text-text-main hover:bg-surface-hover rounded-md transition-colors"><Settings size={16} /></button>
                <button onClick={logout} className="p-1.5 text-text-secondary hover:text-red-400 hover:bg-surface-hover rounded-md transition-colors"><LogOut size={16} /></button>
              </div>
            </div>
          </div>
        </div>

        {/* Hidden Inputs */}
        <input type="file" ref={fileInputRef} multiple hidden onChange={handleFileSelect} />
        {/* @ts-ignore - webkitdirectory is standard but not in types */}
        <input type="file" ref={folderInputRef} multiple hidden webkitdirectory="" directory="" onChange={handleFolderSelect} />
        {/* Resume upload input - single file */}
        <input type="file" ref={resumeInputRef} hidden onChange={handleResumeSelect} />
      </aside >

      {/* Pending Uploads Modal */}
      {
        showPendingUploads && (
          <PendingUploadsModal
            isOpen={true}
            onClose={() => setShowPendingUploads(false)}
            onResumeUpload={handleResumeUpload}
          />
        )
      }
    </>
  )
}
