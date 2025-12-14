import { useFileStore, type UploadInfo } from '../../stores/fileStore'
import './ProgressToasts.css'

// Format bytes to human readable size
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Format progress info based on unit type
function formatProgress(info: UploadInfo): string {
  if (info.unit === 'files') {
    return `${info.loaded} / ${info.total} files`
  }
  return `${formatBytes(info.loaded)} / ${formatBytes(info.total)}`
}

// Calculate speed based on unit type
function calculateSpeed(info: UploadInfo): string {
  const elapsed = (Date.now() - info.startTime) / 1000 // seconds
  if (elapsed < 0.5) return '...'

  if (info.unit === 'files') {
    const filesPerSecond = info.loaded / elapsed
    return `${filesPerSecond.toFixed(1)} files/s`
  }

  const bytesPerSecond = info.loaded / elapsed
  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(1)} MB/s`
}

// Calculate ETA
function calculateETA(info: UploadInfo): string {
  const elapsed = (Date.now() - info.startTime) / 1000 // seconds
  if (elapsed < 2 || info.loaded === 0) return ''

  const rate = info.loaded / elapsed
  const remaining = info.total - info.loaded
  const etaSeconds = remaining / rate

  if (etaSeconds < 60) {
    return `~${Math.ceil(etaSeconds)}s left`
  }
  if (etaSeconds < 3600) {
    const mins = Math.ceil(etaSeconds / 60)
    return `~${mins}m left`
  }
  const hours = Math.floor(etaSeconds / 3600)
  const mins = Math.ceil((etaSeconds % 3600) / 60)
  return `~${hours}h ${mins}m left`
}

// Truncate file name for display
function truncateName(name: string, maxLen = 25): string {
  if (name.length <= maxLen) return name
  const ext = name.includes('.') ? '.' + name.split('.').pop() : ''
  const baseName = name.slice(0, name.length - ext.length)
  const truncatedBase = baseName.slice(0, maxLen - ext.length - 3)
  return truncatedBase + '...' + ext
}

export function ProgressToasts() {
  const uploadProgress = useFileStore(state => state.uploadProgress)

  if (uploadProgress.size === 0) return null

  // Convert map to array for rendering
  const items = Array.from(uploadProgress.entries()).map(([id, info]) => ({
    id,
    info,
    label: info.type === 'download' ? '↓' : '↑'
  }))

  return (
    <div className="progress-toasts">
      {items.map(item => (
        <div key={item.id} className="progress-toast">
          <div className="toast-header">
            <span className="toast-label">{item.label}</span>
            <span className="toast-title" title={item.info.fileName}>
              {truncateName(item.info.fileName)}
            </span>
            <span className="toast-speed">{calculateSpeed(item.info)}</span>
          </div>
          <div className="toast-info">
            <span className="toast-progress">{formatProgress(item.info)}</span>
            <span className="toast-eta">{calculateETA(item.info)}</span>
            <span className="toast-percent">{Math.round(item.info.percent)}%</span>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${item.info.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

