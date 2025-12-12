import { useFileStore } from '../../stores/fileStore'
import './ProgressToasts.css'

export function ProgressToasts() {
  const { uploadProgress } = useFileStore()

  if (uploadProgress.size === 0) return null

  // Convert map to array for rendering
  const items = Array.from(uploadProgress.entries()).map(([id, percent]) => ({
    id,
    percent,
    type: id.startsWith('dl-') ? 'Download' : 'Upload'
  }))

  return (
    <div className="progress-toasts">
      {items.map(item => (
        <div key={item.id} className="progress-toast">
          <div className="toast-header">
            <span className="toast-title">{item.type}ing...</span>
            <span className="toast-percent">{Math.round(item.percent)}%</span>
          </div>
          <div className="progress-bar-bg">
            <div
              className="progress-bar-fill"
              style={{ width: `${item.percent}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
