import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { downloadUrl } from '../api/client';

const MediaPlayerContext = createContext(null);

export function MediaPlayerProvider({ children }) {
  const [currentTrack, setCurrentTrack] = useState(null); // { id, name, mimeType, sizeBytes }
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const audioRef = useRef(null);

  const playTrack = useCallback((entry) => {
    if (!entry) return;
    setCurrentTrack(entry);
    setIsPlaying(true);
    setIsMinimized(false);
  }, []);

  const pauseTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  }, []);

  const resumeTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play();
      setIsPlaying(true);
    }
  }, []);

  const togglePlay = useCallback(() => {
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  }, [isPlaying, pauseTrack, resumeTrack]);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const skip = useCallback((seconds) => {
    if (audioRef.current) {
      const next = Math.max(0, Math.min(audioRef.current.duration || 0, audioRef.current.currentTime + seconds));
      audioRef.current.currentTime = next;
      setCurrentTime(next);
    }
  }, []);

  const closePlayer = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.src = '';
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);
    const handlePlay = () => setIsPlaying(true);
    const handlePause = () => setIsPlaying(false);

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
    };
  }, []);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  useEffect(() => {
    if (currentTrack && audioRef.current) {
      const src = downloadUrl(currentTrack.id, { inline: true });
      audioRef.current.src = src;
      audioRef.current.play().catch(() => {
        setIsPlaying(false);
      });
    }
  }, [currentTrack]);

  const value = {
    currentTrack,
    isPlaying,
    duration,
    currentTime,
    volume,
    isMuted,
    isMinimized,
    setIsMinimized,
    setVolume,
    setIsMuted,
    playTrack,
    pauseTrack,
    resumeTrack,
    togglePlay,
    seek,
    skip,
    closePlayer,
  };

  return (
    <MediaPlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </MediaPlayerContext.Provider>
  );
}

export function useMediaPlayer() {
  const context = useContext(MediaPlayerContext);
  return context || {};
}
