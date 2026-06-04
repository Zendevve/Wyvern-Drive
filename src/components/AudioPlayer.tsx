import { useRef, useEffect, useCallback, useState } from 'react';
import { MusicNotes, Play, Pause, SkipBack, SkipForward, SpeakerHigh, CaretDown, CaretUp, X } from '@phosphor-icons/react';
import { useAudioStore } from '../stores/audio-store';
import { useAuthStore } from '../stores/auth-store';
import { getWebhookUrl } from '../stores/file-store';
import { loadMediaBlob, createMediaBlobUrl } from '../lib/media';

export function AudioPlayer() {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const isVisible = useAudioStore(s => s.isVisible);
  const currentTrack = useAudioStore(s => s.currentTrack);
  const isPlaying = useAudioStore(s => s.isPlaying);
  const volume = useAudioStore(s => s.volume);
  const blobUrl = useAudioStore(s => s.blobUrl);

  const pause = useAudioStore(s => s.pause);
  const resume = useAudioStore(s => s.resume);
  const next = useAudioStore(s => s.next);
  const previous = useAudioStore(s => s.previous);
  const seek = useAudioStore(s => s.seek);
  const setVolume = useAudioStore(s => s.setVolume);
  const close = useAudioStore(s => s.close);
  const setBlobUrl = useAudioStore(s => s.setBlobUrl);
  const setCurrentTime = useAudioStore(s => s.setCurrentTime);
  const setDuration = useAudioStore(s => s.setDuration);
  const currentTime = useAudioStore(s => s.currentTime);
  const duration = useAudioStore(s => s.duration);

  const key = useAuthStore(s => s.derivedKey);
  const [isExpanded, setIsExpanded] = useState(false);

  const loadTrack = useCallback(async () => {
    if (!currentTrack || !key) return;
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    try {
      const blob = await loadMediaBlob(currentTrack.id, key, webhookUrl);
      const url = createMediaBlobUrl(blob);
      setBlobUrl(url);
    } catch (err) {
      console.error('Failed to load audio track:', err);
    }
  }, [currentTrack?.id, key]);

  useEffect(() => {
    loadTrack();
  }, [loadTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = volume;
  }, [volume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !blobUrl) return;

    audio.src = blobUrl;
    audio.load();

    if (isPlaying) {
      audio.play().catch(() => {});
    }
  }, [blobUrl]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.play().catch(() => {});
    } else {
      audio.pause();
    }
  }, [isPlaying]);

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) setCurrentTime(audio.currentTime);
  };

  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) setDuration(audio.duration);
  };

  const handleEnded = () => {
    next();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    seek(time);
    if (audioRef.current) audioRef.current.currentTime = time;
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseFloat(e.target.value));
  };

  const formatTime = (seconds: number): string => {
    if (isNaN(seconds)) return '0:00';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isVisible || !currentTrack) return null;

  return (
    <div
      className={`fixed bottom-6 right-6 z-40 bg-card/85 backdrop-blur-md border border-border rounded-2xl shadow-xl transition-all duration-300 ease-in-out select-none ${
        isExpanded ? 'w-80 p-5' : 'w-64 px-4 py-3'
      }`}
    >
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      {isExpanded ? (
        /* Expanded Mode Layout */
        <div className="flex flex-col space-y-4">
          {/* Header Controls */}
          <div className="flex items-center justify-between">
            <span className="text-xxs font-medium text-text-muted uppercase tracking-wider">Now Playing</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsExpanded(false)}
                aria-label="Collapse player"
                className="p-1 hover:bg-card-hover rounded-lg text-text-muted hover:text-foreground cursor-pointer"
              >
                <CaretDown size={12} weight="regular" aria-hidden="true" />
              </button>
              <button
                onClick={close}
                aria-label="Close player"
                className="p-1 hover:bg-card-hover rounded-lg text-text-muted hover:text-foreground cursor-pointer"
              >
                <X size={12} weight="regular" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Album Art Icon Design */}
          <div className="h-32 bg-gradient-to-tr from-primary/20 via-primary/5 to-transparent rounded-xl flex items-center justify-center relative overflow-hidden group border border-border/40">
            <MusicNotes
              size={48}
              weight="regular"
              aria-hidden="true"
              className={`text-primary transform transition-transform duration-1000 ${isPlaying ? 'rotate-180 animate-[spin_6s_linear_infinite]' : ''}`}
            />
          </div>

          {/* Track metadata details */}
          <div className="text-center">
            <h4 className="font-semibold text-foreground truncate text-sm px-2" title={currentTrack.name}>
              {currentTrack.name}
            </h4>
            <p className="text-xxs text-text-muted mt-0.5">Secure Streaming</p>
          </div>

          {/* Playback progress bar */}
          <div className="space-y-1.5">
            <input
              type="range"
              min={0}
              max={duration || 0}
              value={currentTime}
              onChange={handleSeek}
              className="w-full h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-text-muted font-medium">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>

          {/* Audio Controls */}
          <div className="flex items-center justify-center gap-4">
            <button
              onClick={previous}
              aria-label="Previous track"
              className="p-2 hover:bg-card-hover text-foreground hover:text-primary rounded-full transition-colors cursor-pointer"
            >
              <SkipBack size={18} weight="regular" aria-hidden="true" />
            </button>
            <button
              onClick={() => isPlaying ? pause() : resume()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="bg-primary hover:bg-primary-hover text-white rounded-full w-10 h-10 flex items-center justify-center transition-all shadow-md cursor-pointer"
            >
              {isPlaying ? (
                <Pause size={20} weight="regular" aria-hidden="true" />
              ) : (
                <Play size={20} weight="regular" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={next}
              aria-label="Next track"
              className="p-2 hover:bg-card-hover text-foreground hover:text-primary rounded-full transition-colors cursor-pointer"
            >
              <SkipForward size={18} weight="regular" aria-hidden="true" />
            </button>
          </div>

          {/* Volume Control */}
          <div className="flex items-center gap-2 border-t border-border/40 pt-3">
            <SpeakerHigh size={14} weight="regular" className="text-text-muted shrink-0" aria-hidden="true" />
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={handleVolumeChange}
              className="flex-1 h-1 bg-border rounded-lg appearance-none cursor-pointer accent-primary"
            />
          </div>
        </div>
      ) : (
        /* Mini Mode Layout */
        <div className="flex items-center justify-between gap-3 relative">
          <div className="flex items-center gap-2.5 min-w-0 flex-1">
            <div className={`w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 ${isPlaying ? 'animate-[spin_8s_linear_infinite]' : ''}`}>
              <MusicNotes size={14} weight="regular" className="text-primary" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-foreground text-xs truncate" title={currentTrack.name}>
                {currentTrack.name}
              </p>
              <p className="text-[10px] text-text-muted mt-0.5">{formatTime(currentTime)}</p>
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={() => isPlaying ? pause() : resume()}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className="w-7 h-7 bg-primary hover:bg-primary-hover text-white rounded-full flex items-center justify-center transition-all cursor-pointer"
            >
              {isPlaying ? (
                <Pause size={14} weight="regular" aria-hidden="true" />
              ) : (
                <Play size={14} weight="regular" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={() => setIsExpanded(true)}
              aria-label="Expand player"
              className="p-1 hover:bg-card-hover rounded-lg text-text-muted hover:text-foreground cursor-pointer"
            >
              <CaretUp size={12} weight="regular" aria-hidden="true" />
            </button>
          </div>

          {/* Absolute progress track on bottom */}
          <div className="absolute bottom-[-13px] left-[-16px] right-[-16px] h-0.5 bg-border">
            <div
              className="h-full bg-primary transition-all duration-100"
              style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
