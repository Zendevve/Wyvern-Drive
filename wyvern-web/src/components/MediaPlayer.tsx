import { useState, useRef } from 'react'
import { X } from 'lucide-react'
import './MediaPlayer.css'

interface MediaPlayerProps {
  shareId: string
  fileName: string
  fileSize: number
  mimeType: string
  onClose: () => void
}

export function MediaPlayer({ shareId, fileName, fileSize, mimeType, onClose }: MediaPlayerProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const isVideo = mimeType.startsWith('video/')
  const videoRef = useRef<HTMLVideoElement>(null)

  // Construct the virtual stream URL that the Service Worker intercepts
  // Params: name (for mime type detection in SW) and size (for Range handling)
  const streamUrl = `/virtual/stream/${shareId}?name=${encodeURIComponent(fileName)}&size=${fileSize}`

  return (
    <div className="media-player-overlay">
      <div className="media-player-container">
        <div className="media-header">
          <span className="media-title">{fileName}</span>
          <button className="close-btn" onClick={onClose}>
            <X size={24} />
          </button>
        </div>

        <div className="media-content">
          {error ? (
            <div className="media-error">
              <p>Failed to load media</p>
              <span className="error-details">{error}</span>
            </div>
          ) : (
            <>
              {loading && <div className="media-loading">Loading stream...</div>}

              {isVideo ? (
                <video
                  ref={videoRef}
                  src={streamUrl}
                  controls
                  autoPlay
                  className="media-element"
                  onCanPlay={() => setLoading(false)}
                  onError={(e) => {
                    console.error('Video error:', e)
                    setError('Video failed to load')
                    setLoading(false)
                  }}
                />
              ) : (
                <audio
                  src={streamUrl}
                  controls
                  autoPlay
                  className="media-element audio-element"
                  onCanPlay={() => setLoading(false)}
                  onError={(e) => {
                    console.error('Audio error:', e)
                    setError('Audio failed to load')
                    setLoading(false)
                  }}
                />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
