import { useRef, useEffect } from 'react'
import { useFileStore, type UploadInfo } from '../../stores/fileStore'
import './ProgressToasts.css'

// Rolling window for speed calculation (stores last N samples)
interface SpeedSample {
  timestamp: number
  bytes: number
}

// Map to store speed samples per transfer
const speedSamples = new Map<string, SpeedSample[]>()

// Config
const SAMPLE_WINDOW_MS = 5000 // Use last 5 seconds of data
const MAX_SAMPLES = 50 // Max samples to keep per transfer

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

// Add a speed sample and calculate current speed using rolling window
function updateSpeedSample(id: string, loaded: number): number {
  const now = Date.now()
  let samples = speedSamples.get(id) || []

  // Add new sample
  samples.push({ timestamp: now, bytes: loaded })

  // Remove samples older than window
  const cutoff = now - SAMPLE_WINDOW_MS
  samples = samples.filter(s => s.timestamp >= cutoff)

  // Keep only latest MAX_SAMPLES
  if (samples.length > MAX_SAMPLES) {
    samples = samples.slice(-MAX_SAMPLES)
  }

  speedSamples.set(id, samples)

  // Calculate speed from samples
  if (samples.length < 2) return 0

  const oldest = samples[0]
  const newest = samples[samples.length - 1]
  const timeDiff = (newest.timestamp - oldest.timestamp) / 1000 // seconds
  const bytesDiff = newest.bytes - oldest.bytes

  if (timeDiff < 0.1) return 0 // Need at least 100ms of data

  return bytesDiff / timeDiff // bytes per second
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

// Cleanup speed samples for completed transfers
function cleanupSamples(activeIds: Set<string>) {
  for (const id of speedSamples.keys()) {
    if (!activeIds.has(id)) {
      speedSamples.delete(id)
    }
  }
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
    speedSamples.clear()
    return null
  }

  // Cleanup samples for completed transfers
  cleanupSamples(new Set(uploadProgress.keys()))

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
