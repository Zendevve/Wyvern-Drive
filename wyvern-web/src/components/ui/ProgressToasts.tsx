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

// Format progress info based on unit type
function formatProgress(info: UploadInfo): string {
  if (info.unit === 'files') {
    return `${info.loaded} / ${info.total} files`
  }
  return `${formatBytes(info.loaded)} / ${formatBytes(info.total)}`
}

// Calculate percentage with appropriate precision
function formatPercent(info: UploadInfo): string {
  const percent = (info.loaded / info.total) * 100
  // For very large files (>1GB), show 2 decimal places
  // For large files (>100MB), show 1 decimal place
  // Otherwise show integer
  if (info.total > 1024 * 1024 * 1024) {
    return `${percent.toFixed(2)}%`
  }
  if (info.total > 100 * 1024 * 1024) {
    return `${percent.toFixed(1)}%`
  }
  return `${Math.round(percent)}%`
}

// Store for EMA-smoothed speeds (smoother than raw rolling window)
const smoothedSpeeds = new Map<string, number>()
const lastUpdates = new Map<string, { timestamp: number; bytes: number }>()

// EMA smoothing factor (lower = smoother/slower to respond, higher = more reactive)
// 0.15 gives a nice balance - responds to changes but doesn't spike
const EMA_ALPHA = 0.15

// Minimum time between speed updates (prevents micro-bursts from spiking)
const MIN_UPDATE_INTERVAL_MS = 500

// Add a speed sample and calculate current speed using EMA smoothing
function updateSpeedSample(id: string, loaded: number): number {
  const now = Date.now()
  const lastUpdate = lastUpdates.get(id)
  let currentSmoothed = smoothedSpeeds.get(id) || 0

  if (!lastUpdate) {
    // First sample - just store it
    lastUpdates.set(id, { timestamp: now, bytes: loaded })
    return 0
  }

  const timeDiff = now - lastUpdate.timestamp

  // Don't update too frequently (prevents burst spikes)
  if (timeDiff < MIN_UPDATE_INTERVAL_MS) {
    return currentSmoothed
  }

  const bytesDiff = loaded - lastUpdate.bytes
  const instantSpeed = bytesDiff / (timeDiff / 1000) // bytes per second

  // Apply EMA smoothing
  // newEMA = alpha * newValue + (1 - alpha) * oldEMA
  if (currentSmoothed === 0) {
    // First real speed calculation
    currentSmoothed = instantSpeed
  } else {
    currentSmoothed = EMA_ALPHA * instantSpeed + (1 - EMA_ALPHA) * currentSmoothed
  }

  // Sanity check: cap at reasonable max (1 Gbps = 125 MB/s)
  const MAX_REASONABLE_SPEED = 125 * 1024 * 1024 // 125 MB/s
  currentSmoothed = Math.min(currentSmoothed, MAX_REASONABLE_SPEED)

  // Store updated values
  lastUpdates.set(id, { timestamp: now, bytes: loaded })
  smoothedSpeeds.set(id, currentSmoothed)

  return currentSmoothed
}

// Cleanup function for completed transfers
function cleanupSpeedData(activeIds: Set<string>) {
  for (const id of smoothedSpeeds.keys()) {
    if (!activeIds.has(id)) {
      smoothedSpeeds.delete(id)
      lastUpdates.delete(id)
    }
  }
}

// Get current speed from samples
function getCurrentSpeed(id: string, loaded: number): number {
  return updateSpeedSample(id, loaded)
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

// Calculate ETA based on current speed
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

  // Trigger re-render every 250ms for smooth updates
  const intervalRef = useRef<number | null>(null)

  useEffect(() => {
    if (uploadProgress.size > 0) {
      intervalRef.current = window.setInterval(() => {
        // Force re-render by this component (state change)
      }, 250)
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [uploadProgress.size])

  if (uploadProgress.size === 0) {
    // Cleanup all samples when no active transfers
    smoothedSpeeds.clear()
    lastUpdates.clear()
    return null
  }

  // Cleanup samples for completed transfers
  cleanupSpeedData(new Set(uploadProgress.keys()))

  // Convert map to array for rendering
  const items = Array.from(uploadProgress.entries()).map(([id, info]) => {
    const currentSpeed = getCurrentSpeed(id, info.loaded)
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
