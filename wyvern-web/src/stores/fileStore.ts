import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WyvernFile, WyvernFolder } from '../lib/types'

interface FileStore {
  // Auth
  webhookUrl: string | null
  userId: string | null
  isAuthenticated: boolean
  encryptionPassword: string | null

  // File tree
  currentPath: string
  files: Record<string, WyvernFile | WyvernFolder>
  selectedIds: Set<string>

  // UI state
  isLoading: boolean
  uploadProgress: Map<string, number>

  // Actions
  setWebhookUrl: (url: string) => void
  setEncryptionPassword: (password: string | null) => void
  logout: () => void
  setCurrentPath: (path: string) => void
  setFiles: (files: Record<string, WyvernFile | WyvernFolder>) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  setLoading: (loading: boolean) => void
  setUploadProgress: (fileId: string, progress: number) => void
}

export const useFileStore = create<FileStore>()(
  persist(
    (set) => ({
      // Initial state
      webhookUrl: null,
      userId: null,
      isAuthenticated: false,
      encryptionPassword: null,
      currentPath: '',
      files: {},
      selectedIds: new Set(),
      isLoading: false,
      uploadProgress: new Map(),

      // Actions
      setWebhookUrl: (url) => set({
        webhookUrl: url,
        isAuthenticated: true,
        userId: url // Will be hashed later
      }),

      setEncryptionPassword: (password) => set({ encryptionPassword: password }),

      logout: () => set({
        webhookUrl: null,
        userId: null,
        isAuthenticated: false,
        encryptionPassword: null,
        currentPath: '',
        files: {},
        selectedIds: new Set(),
      }),

      setCurrentPath: (path) => set({ currentPath: path }),

      setFiles: (files) => set({ files }),

      toggleSelection: (id) => set((state) => {
        const newSelection = new Set(state.selectedIds)
        if (newSelection.has(id)) {
          newSelection.delete(id)
        } else {
          newSelection.add(id)
        }
        return { selectedIds: newSelection }
      }),

      clearSelection: () => set({ selectedIds: new Set() }),

      setLoading: (loading) => set({ isLoading: loading }),

      setUploadProgress: (fileId, progress) => set((state) => {
        const newProgress = new Map(state.uploadProgress)
        if (progress >= 100) {
          newProgress.delete(fileId)
        } else {
          newProgress.set(fileId, progress)
        }
        return { uploadProgress: newProgress }
      }),
    }),
    {
      name: 'wyvern-drive-storage',
      partialize: (state) => ({
        webhookUrl: state.webhookUrl,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)
