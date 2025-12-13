import { useRef, useEffect } from 'react'
import { Play, Pause, SkipBack, SkipForward, Volume2, VolumeX, X, Music } from 'lucide-react'
import { useAudioPlayer } from '../stores/audioPlayerStore'
import './AudioPlayer.css'

/**
 * Persistent audio player bar that stays at the bottom of the screen
 * Survives navigation between folders
 */
export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<HTMLDivElement>(null)

  const {
    currentTrack,
    isPlaying,
    volume,
    currentTime,
    duration,
    isLoading,
    togglePlay,
    setVolume,
    setCurrentTime,
    setDuration,
    setIsPlaying,
    nextTrack,
    prevTrack,
    closePlayer
  } = useAudioPlayer()

  // Sync audio element with play state
  useEffect(() => {
    if (!audioRef.current || !currentTrack) return
    if (isPlaying) {
      audioRef.current.play().catch(() => setIsPlaying(false))
    } else {
      audioRef.current.pause()
    }
  }, [isPlaying, setIsPlaying, currentTrack])

  // Sync volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume
    }
  }, [volume])

  // Don't render if no track (MUST be after all hooks)
  if (!currentTrack) return null

  // Handle progress bar click
  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!progressRef.current || !audioRef.current) return
    const rect = progressRef.current.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const newTime = pos * duration
    audioRef.current.currentTime = newTime
    setCurrentTime(newTime)
  }

  // Format time (mm:ss)
  const formatTime = (seconds: number) => {
    if (!isFinite(seconds)) return '0:00'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  // Progress percentage
  const progress = duration > 0 ? (currentTime / duration) * 100 : 0

  return (
    <div className="audio-player-bar">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={currentTrack.blobUrl || undefined}
        onTimeUpdate={() => setCurrentTime(audioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(audioRef.current?.duration || 0)}
        onEnded={nextTrack}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
      />

      {/* Track info */}
      <div className="player-track-info">
        <div className="player-artwork">
          <Music size={20} />
        </div>
        <div className="player-track-details">
          <span className="player-track-name">{currentTrack.name}</span>
          {isLoading && <span className="player-loading">Loading...</span>}
        </div>
      </div>

      {/* Controls */}
      <div className="player-controls">
        <button onClick={prevTrack} title="Previous" className="player-btn">
          <SkipBack size={18} />
        </button>
        <button
          onClick={togglePlay}
          title={isPlaying ? 'Pause' : 'Play'}
          className="player-btn play-btn"
          disabled={isLoading}
        >
          {isPlaying ? <Pause size={20} /> : <Play size={20} />}
        </button>
        <button onClick={nextTrack} title="Next" className="player-btn">
          <SkipForward size={18} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="player-progress-container">
        <span className="player-time">{formatTime(currentTime)}</span>
        <div
          ref={progressRef}
          className="player-progress-bar"
          onClick={handleProgressClick}
        >
          <div
            className="player-progress-fill"
            style={{ width: `${progress}%` }}
          />
          <div
            className="player-progress-handle"
            style={{ left: `${progress}%` }}
          />
        </div>
        <span className="player-time">{formatTime(duration)}</span>
      </div>

      {/* Volume */}
      <div className="player-volume">
        <button
          onClick={() => setVolume(volume > 0 ? 0 : 0.8)}
          className="player-btn"
          title={volume > 0 ? 'Mute' : 'Unmute'}
        >
          {volume > 0 ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="volume-slider"
        />
      </div>

      {/* Close button */}
      <button onClick={closePlayer} className="player-btn close-btn" title="Close player">
        <X size={18} />
      </button>
    </div>
  )
}
