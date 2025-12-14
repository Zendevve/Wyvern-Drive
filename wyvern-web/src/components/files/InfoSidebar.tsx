import { useMemo } from 'react'
import {
  X, File, Folder, Image, Video, Music, FileText,
  Lock, Unlock, Calendar, HardDrive, Hash, Clock
} from 'lucide-react'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import './InfoSidebar.css'

interface InfoSidebarProps {
  file: WyvernFile | WyvernFolder | null
  onClose: () => void
}

// Format bytes to human readable
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Format date to readable string
function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

// Get relative time
function getRelativeTime(dateStr: string): string {
  const date = new Date(dateStr)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSecs = Math.floor(diffMs / 1000)
  const diffMins = Math.floor(diffSecs / 60)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffDays > 30) return formatDate(dateStr)
  if (diffDays > 0) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`
  if (diffHours > 0) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`
  if (diffMins > 0) return `${diffMins} min${diffMins > 1 ? 's' : ''} ago`
  return 'Just now'
}

// Get file extension
function getExtension(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext && ext !== name.toLowerCase() ? ext : ''
}

// Get file type label
function getFileType(name: string, isFolder: boolean): string {
  if (isFolder) return 'Folder'

  const ext = getExtension(name)
  const types: Record<string, string> = {
    // Images
    jpg: 'JPEG Image', jpeg: 'JPEG Image', png: 'PNG Image',
    gif: 'GIF Image', webp: 'WebP Image', svg: 'SVG Image', bmp: 'Bitmap Image',
    // Videos
    mp4: 'MP4 Video', webm: 'WebM Video', mkv: 'MKV Video',
    avi: 'AVI Video', mov: 'QuickTime Video', wmv: 'WMV Video',
    // Audio
    mp3: 'MP3 Audio', wav: 'WAV Audio', flac: 'FLAC Audio',
    aac: 'AAC Audio', ogg: 'OGG Audio', m4a: 'M4A Audio',
    // Documents
    pdf: 'PDF Document', doc: 'Word Document', docx: 'Word Document',
    xls: 'Excel Spreadsheet', xlsx: 'Excel Spreadsheet',
    ppt: 'PowerPoint', pptx: 'PowerPoint',
    txt: 'Text File', md: 'Markdown', json: 'JSON', xml: 'XML',
    // Archives
    zip: 'ZIP Archive', rar: 'RAR Archive', '7z': '7-Zip Archive', tar: 'TAR Archive',
    // Code
    js: 'JavaScript', ts: 'TypeScript', tsx: 'TypeScript React',
    jsx: 'JavaScript React', py: 'Python', java: 'Java', cpp: 'C++', c: 'C',
    html: 'HTML', css: 'CSS', scss: 'SCSS', less: 'LESS',
  }

  return types[ext] || (ext ? `${ext.toUpperCase()} File` : 'File')
}

// Get icon for file type
function getFileIcon(name: string, isFolder: boolean) {
  if (isFolder) return <Folder size={48} />

  const ext = getExtension(name)
  const imageExts = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'ico']
  const videoExts = ['mp4', 'webm', 'mkv', 'avi', 'mov', 'wmv', 'flv']
  const audioExts = ['mp3', 'wav', 'flac', 'aac', 'ogg', 'm4a', 'opus', 'wma']
  const docExts = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md']

  if (imageExts.includes(ext)) return <Image size={48} />
  if (videoExts.includes(ext)) return <Video size={48} />
  if (audioExts.includes(ext)) return <Music size={48} />
  if (docExts.includes(ext)) return <FileText size={48} />

  return <File size={48} />
}

export function InfoSidebar({ file, onClose }: InfoSidebarProps) {
  const isFolder = file?.type === 'directory'
  const isEncrypted = file && 'encrypted' in file && (file.encrypted === true || file.encrypted === 1)

  const fileInfo = useMemo(() => {
    if (!file) return null

    const info = [
      {
        label: 'Type',
        value: getFileType(file.name, isFolder),
        icon: <FileText size={14} />
      },
      ...(file.type === 'file' ? [{
        label: 'Size',
        value: formatBytes((file as WyvernFile).size),
        icon: <HardDrive size={14} />
      }] : []),
      {
        label: 'Created',
        value: getRelativeTime(file.created_at),
        fullValue: formatDate(file.created_at),
        icon: <Calendar size={14} />
      },
      {
        label: 'Modified',
        value: getRelativeTime(file.updated_at),
        fullValue: formatDate(file.updated_at),
        icon: <Clock size={14} />
      },
      {
        label: 'Path',
        value: file.path || '/',
        icon: <Folder size={14} />
      },
      ...(file.type === 'file' ? [{
        label: 'Encryption',
        value: isEncrypted ? 'Encrypted' : 'Not encrypted',
        icon: isEncrypted ? <Lock size={14} /> : <Unlock size={14} />
      }] : []),
      {
        label: 'ID',
        value: `#${file.id}`,
        icon: <Hash size={14} />
      }
    ]

    return info
  }, [file, isFolder, isEncrypted])

  if (!file) {
    return (
      <div className="info-sidebar empty">
        <div className="info-empty-state">
          <File size={48} strokeWidth={1} />
          <p>Select a file to view details</p>
        </div>
      </div>
    )
  }

  return (
    <aside className="info-sidebar">
      <div className="info-header">
        <h3>Info</h3>
        <button className="info-close" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <div className="info-content">
        {/* File Icon & Name */}
        <div className="info-hero">
          <div className="info-icon">
            {getFileIcon(file.name, isFolder)}
          </div>
          <h4 className="info-name" title={file.name}>
            {file.name}
          </h4>
          {!isFolder && (
            <span className="info-extension">
              .{getExtension(file.name) || 'file'}
            </span>
          )}
        </div>

        {/* Metadata Grid */}
        <div className="info-metadata">
          {fileInfo?.map((item, idx) => (
            <div key={idx} className="info-row">
              <span className="info-label">
                {item.icon}
                {item.label}
              </span>
              <span
                className="info-value"
                title={'fullValue' in item ? item.fullValue : undefined}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>

        {/* Encryption Badge */}
        {file.type === 'file' && (
          <div className={`info-badge ${isEncrypted ? 'encrypted' : 'unencrypted'}`}>
            {isEncrypted ? <Lock size={14} /> : <Unlock size={14} />}
            <span>{isEncrypted ? 'End-to-End Encrypted' : 'Unencrypted'}</span>
          </div>
        )}
      </div>
    </aside>
  )
}
