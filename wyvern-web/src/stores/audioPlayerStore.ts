import { create } from 'zustand'
import type { WyvernFile } from '../lib/types'

export interface AudioTrack {
  id: string
  name: string
  file: WyvernFile
  blobUrl: string | null
}

interface AudioPlayerState {
  // Playback
  currentTrack: AudioTrack | null
  queue: AudioTrack[]
  isPlaying: boolean
  volume: number
  currentTime: number
  duration: number
  isLoading: boolean

  // Actions
  playTrack: (track: AudioTrack) => void
  addToQueue: (track: AudioTrack) => void
  removeFromQueue: (trackId: string) => void
  clearQueue: () => void
  nextTrack: () => void
  prevTrack: () => void
  togglePlay: () => void
  setVolume: (volume: number) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setIsPlaying: (playing: boolean) => void
  setIsLoading: (loading: boolean) => void
  closePlayer: () => void
}

export const useAudioPlayer = create<AudioPlayerState>()((set, get) => ({
  // Initial state
  currentTrack: null,
  queue: [],
  isPlaying: false,
  volume: 0.8,
  currentTime: 0,
  duration: 0,
  isLoading: false,

  // Actions
  playTrack: (track) => {
    const { queue, currentTrack } = get()
    // If there's a current track, add it to queue history
    if (currentTrack && currentTrack.id !== track.id) {
      // Don't add duplicate
      if (!queue.find(t => t.id === track.id)) {
        set({ queue: [...queue, track] })
      }
    }
    set({
      currentTrack: track,
      isPlaying: true,
      currentTime: 0,
      isLoading: !track.blobUrl
    })
  },

  addToQueue: (track) => {
    const { queue } = get()
    // Don't add duplicate
    if (!queue.find(t => t.id === track.id)) {
      set({ queue: [...queue, track] })
    }
  },

  removeFromQueue: (trackId) => {
    set(state => ({
      queue: state.queue.filter(t => t.id !== trackId)
    }))
  },

  clearQueue: () => set({ queue: [] }),

  nextTrack: () => {
    const { queue, currentTrack } = get()
    if (queue.length === 0) return

    // Find current track index in queue
    const currentIndex = currentTrack
      ? queue.findIndex(t => t.id === currentTrack.id)
      : -1

    // Get next track
    const nextIndex = currentIndex + 1
    if (nextIndex < queue.length) {
      set({
        currentTrack: queue[nextIndex],
        isPlaying: true,
        currentTime: 0
      })
    }
  },

  prevTrack: () => {
    const { queue, currentTrack, currentTime } = get()

    // If more than 3 seconds in, restart current track
    if (currentTime > 3) {
      set({ currentTime: 0 })
      return
    }

    // Find current track index
    const currentIndex = currentTrack
      ? queue.findIndex(t => t.id === currentTrack.id)
      : -1

    // Get previous track
    const prevIndex = currentIndex - 1
    if (prevIndex >= 0) {
      set({
        currentTrack: queue[prevIndex],
        isPlaying: true,
        currentTime: 0
      })
    } else {
      // Just restart current
      set({ currentTime: 0 })
    }
  },

  togglePlay: () => set(state => ({ isPlaying: !state.isPlaying })),

  setVolume: (volume) => set({ volume: Math.min(Math.max(volume, 0), 1) }),

  setCurrentTime: (time) => set({ currentTime: time }),

  setDuration: (duration) => set({ duration }),

  setIsPlaying: (playing) => set({ isPlaying: playing }),

  setIsLoading: (loading) => set({ isLoading: loading }),

  closePlayer: () => {
    const { currentTrack } = get()
    // Revoke blob URL if exists
    if (currentTrack?.blobUrl) {
      URL.revokeObjectURL(currentTrack.blobUrl)
    }
    set({
      currentTrack: null,
      isPlaying: false,
      currentTime: 0,
      duration: 0,
      queue: []
    })
  }
}))
