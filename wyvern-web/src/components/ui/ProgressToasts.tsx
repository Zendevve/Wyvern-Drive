import { useRef, useEffect } from 'react'
import { useFileStore, type UploadInfo } from '../../stores/fileStore'
import './ProgressToasts.css'

// Format bytes to human readable size
function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

// Format progress (loaded / total)
function formatProgress(info: UploadInfo): string {
  if (info.unit === 'files') {
    return `${info.loaded}/${info.total} files`
  }
  return `${formatBytes(info.loaded)} / ${formatBytes(info.total)}`
}

// Calculate percentage with appropriate precision
function formatPercent(info: UploadInfo): string {
  const percent = (info.loaded / info.total) * 100
  // For very large files (>1GB), show 2 decimal places
  if (info.total > 1024 * 1024 * 1024) {
    return `${percent.toFixed(2)}%`
  }
  // For large files (>100MB), show 1 decimal place
  if (info.total > 100 * 1024 * 1024) {
    return `${percent.toFixed(1)}%`
  }
  return `${Math.round(percent)}%`
}

// TRUE AVERAGE SPEED: total_bytes_uploaded / total_seconds_elapsed
// This is the ACTUAL throughput - no smoothing, no approximation
function calculateTrueAverageSpeed(info: UploadInfo): number {
  const elapsed = (Date.now() - info.startTime) / 1000 // seconds

  // Need at least 2 seconds of data for meaningful speed
  if (elapsed < 2) return 0

  // TRUE speed: total bytes transferred / total time
  return info.loaded / elapsed
}

// Format speed for display
function formatSpeed(bytesPerSecond: number, unit: 'bytes' | 'files'): string {
  if (unit === 'files') {
    return `${bytesPerSecond.toFixed(1)} files/s`
  }

  if (bytesPerSecond === 0) return '...'

  if (bytesPerSecond < 1024 * 1024) {
    return `${(bytesPerSecond / 1024).toFixed(1)} KB/s`
  }
  return `${(bytesPerSecond / (1024 * 1024)).toFixed(2)} MB/s`
}

// Calculate ETA based on true average speed
function calculateETA(remaining: number, bytesPerSecond: number): string {
  if (bytesPerSecond <= 0) return ''

  const etaSeconds = remaining / bytesPerSecond

  if (etaSeconds < 60) {
    return `${Math.ceil(etaSeconds)}s left`
  }
  if (etaSeconds < 3600) {
    const mins = Math.floor(etaSeconds / 60)
    const secs = Math.round(etaSeconds % 60)
    return `${mins}m ${secs}s left`
  }
  const hours = Math.floor(etaSeconds / 3600)
  const mins = Math.round((etaSeconds % 3600) / 60)
  return `${hours}h ${mins}m left`
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

  // Trigger re-render every 500ms for smooth updates
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (uploadProgress.size > 0) {
      intervalRef.current = window.setInterval(() => {
        // Force re-render to update speed/ETA
      }, 500)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [uploadProgress.size])

  if (uploadProgress.size === 0) {
    return null
  }

  // Convert map to array for rendering
  const items = Array.from(uploadProgress.entries()).map(([id, info]) => {
    // Calculate TRUE average speed from startTime
    const currentSpeed = calculateTrueAverageSpeed(info)
    const remaining = info.total - info.loaded
    const eta = calculateETA(remaining, currentSpeed)

    return {
      id,
      info,
      label: info.type === 'download' ? '↓' : '↑',
      speed: formatSpeed(currentSpeed, info.unit),
      eta,
      percent: formatPercent(info)
    }
  })

  return (
    <div className="progress-toasts">
      {items.map(item => (
        <div key={item.id} className="progress-toast">
          <div className="toast-header">
            <span className="toast-label">{item.label}</span>
            <span className="toast-title" title={item.info.fileName}>
              {truncateName(item.info.fileName)}
            </span>
            <span className="toast-speed">{item.speed}</span>
          </div>
          <div className="toast-info">
            <span className="toast-progress">{formatProgress(item.info)}</span>
            <span className="toast-eta">{item.eta}</span>
            <span className="toast-percent">{item.percent}</span>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${(item.info.loaded / item.info.total) * 100}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
