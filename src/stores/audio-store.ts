import { create } from 'zustand';
import type { FileRecord } from '../types';

interface AudioPlayerState {
  currentTrack: FileRecord | null;
  playlist: FileRecord[];
  currentIndex: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isVisible: boolean;
  blobUrl: string | null;

  play: (track: FileRecord, playlist?: FileRecord[]) => void;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (volume: number) => void;
  close: () => void;
  setBlobUrl: (url: string | null) => void;
  setCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
}

export const useAudioStore = create<AudioPlayerState>((set, get) => ({
  currentTrack: null,
  playlist: [],
  currentIndex: 0,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  isVisible: false,
  blobUrl: null,

  play: (track, playlist) => {
    const newPlaylist = playlist || [track];
    const index = newPlaylist.findIndex(f => f.id === track.id);
    set({
      currentTrack: track,
      playlist: newPlaylist,
      currentIndex: index >= 0 ? index : 0,
      isPlaying: true,
      currentTime: 0,
      isVisible: true,
    });
  },

  pause: () => set({ isPlaying: false }),

  resume: () => set({ isPlaying: true }),

  next: () => {
    const { playlist, currentIndex } = get();
    if (currentIndex < playlist.length - 1) {
      const nextIndex = currentIndex + 1;
      set({
        currentIndex: nextIndex,
        currentTrack: playlist[nextIndex],
        currentTime: 0,
      });
    }
  },

  previous: () => {
    const { currentIndex } = get();
    if (currentIndex > 0) {
      const prevIndex = currentIndex - 1;
      set(state => ({
        currentIndex: prevIndex,
        currentTrack: state.playlist[prevIndex],
        currentTime: 0,
      }));
    }
  },

  seek: (time) => set({ currentTime: time }),

  setVolume: (volume) => set({ volume: Math.max(0, Math.min(1, volume)) }),

  close: () => {
    const { blobUrl } = get();
    if (blobUrl) URL.revokeObjectURL(blobUrl);
    set({
      isPlaying: false,
      currentTrack: null,
      playlist: [],
      currentIndex: 0,
      currentTime: 0,
      duration: 0,
      isVisible: false,
      blobUrl: null,
    });
  },

  setBlobUrl: (url) => {
    const { blobUrl: oldUrl } = get();
    if (oldUrl) URL.revokeObjectURL(oldUrl);
    set({ blobUrl: url });
  },

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),
}));
