import { useRef, useEffect, useCallback } from 'react';
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

  const loadTrack = useCallback(async () => {
    if (!currentTrack || !key) return;
    const webhookUrl = getWebhookUrl();
    if (!webhookUrl) return;

    const blob = await loadMediaBlob(currentTrack.id, key, webhookUrl);
    const url = createMediaBlobUrl(blob);
    setBlobUrl(url);
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
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (!isVisible || !currentTrack) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-dark-bg border-t border-gray-700 z-40 px-4 py-3">
      <audio
        ref={audioRef}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
      />

      <div className="max-w-4xl mx-auto flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <p className="font-medium truncate text-sm">{currentTrack.name}</p>
        </div>

        <div className="flex items-center gap-2">
          <button onClick={previous} className="text-discord-muted hover:text-discord-text px-1">⏮</button>
          <button
            onClick={() => isPlaying ? pause() : resume()}
            className="bg-blurple hover:bg-blurple/80 rounded-full w-8 h-8 flex items-center justify-center"
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button onClick={next} className="text-discord-muted hover:text-discord-text px-1">⏭</button>
        </div>

        <div className="flex items-center gap-2 flex-1">
          <span className="text-xs text-discord-muted w-10 text-right">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={currentTime}
            onChange={handleSeek}
            className="flex-1 h-1 accent-blurple"
          />
          <span className="text-xs text-discord-muted w-10">{formatTime(duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-discord-muted">🔊</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolumeChange}
            className="w-20 h-1 accent-blurple"
          />
        </div>

        <button onClick={close} className="text-discord-muted hover:text-discord-text text-sm">✕</button>
      </div>
    </div>
  );
}
