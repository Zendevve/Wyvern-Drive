import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WyvernFile, WyvernFolder } from '../lib/types'
import { WyvernFileManager } from '../lib/wyvern-file-manager'

interface FileStore {
  // Auth
  webhookUrl: string | null
  userId: string | null
  isAuthenticated: boolean
  encryptionPassword: string | null

  // Core Engine
  fileManager: WyvernFileManager | null

  // File tree
  currentPath: string
  files: Record<string, WyvernFile | WyvernFolder>
  selectedIds: Set<string>

  // UI state
  isLoading: boolean
  uploadProgress: Map<string, number>

  // Actions
  setWebhookUrl: (url: string) => void
  setEncryptionPassword: (password: string | null) => Promise<void>
  initializeManager: () => Promise<void>
  loadFiles: () => Promise<void>
  uploadFiles: (files: FileList) => Promise<void>
  logout: () => void
  setCurrentPath: (path: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
}

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      // Initial state
      webhookUrl: null,
      userId: null,
      isAuthenticated: false,
      encryptionPassword: null,
      fileManager: null, // Non-persisted class instance
      currentPath: '',
      files: {},
      selectedIds: new Set(),
      isLoading: false,
      uploadProgress: new Map(),

      // Actions
      setWebhookUrl: (url) => set({
        webhookUrl: url,
        isAuthenticated: true,
        userId: url // Will be hashed by manager
      }),

      setEncryptionPassword: async (password) => {
        set({ encryptionPassword: password })
        const { fileManager } = get()
        if (fileManager && password) {
          await fileManager.setPassword(password)
        }
      },

      initializeManager: async () => {
        const { webhookUrl, encryptionPassword } = get()
        if (!webhookUrl) return

        const manager = new WyvernFileManager(webhookUrl)
        if (encryptionPassword) {
          await manager.setPassword(encryptionPassword)
        }
        set({ fileManager: manager })
      },

      loadFiles: async () => {
        const { fileManager } = get()
        if (!fileManager) return

        set({ isLoading: true })
        try {
          const root = await fileManager.fetchFiles()
          // Flatten tree to record for now, or just use root.children
          // Simple flattening for the grid view
          // TODO: Improve this to handle deep nesting properly in UI
          set({ files: root.children })
        } catch (error) {
          console.error('Failed to load files:', error)
        } finally {
          set({ isLoading: false })
        }
      },

      uploadFiles: async (fileList) => {
        const { fileManager, currentPath } = get()
        if (!fileManager) return

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i]
          const tempId = `temp-${Date.now()}-${i}`

          set((state) => {
            const newProgress = new Map(state.uploadProgress)
            newProgress.set(tempId, 0)
            return { uploadProgress: newProgress }
          })

          try {
            await fileManager.uploadFile(
              file,
              currentPath + '/' + file.name,
              null, // TODO: Get parent ID from current path mapping
              {
                encrypt: !!get().encryptionPassword,
                onProgress: (loaded, total) => {
                  set((state) => {
                    const newProgress = new Map(state.uploadProgress)
                    newProgress.set(tempId, (loaded / total) * 100)
                    return { uploadProgress: newProgress }
                  })
                }
              }
            )
          } catch (error) {
            console.error(`Failed to upload ${file.name}:`, error)
            alert(`Failed to upload ${file.name}`)
          }

          set((state) => {
            const newProgress = new Map(state.uploadProgress)
            newProgress.delete(tempId)
            return { uploadProgress: newProgress }
          })
        }

        // Refresh files after upload
        get().loadFiles()
      },

      logout: () => set({
        webhookUrl: null,
        userId: null,
        isAuthenticated: false,
        encryptionPassword: null,
        fileManager: null,
        currentPath: '',
        files: {},
        selectedIds: new Set(),
      }),

      setCurrentPath: (path) => set({ currentPath: path }),

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
    }),
    {
      name: 'wyvern-drive-storage',
      partialize: (state) => ({
        webhookUrl: state.webhookUrl,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
        // Don't persist sensitive password if possible, but setup screen asks for it.
        // For MVP we persist it or ask user to re-enter?
        // Let's persist for convenience but exclude manager instance
        encryptionPassword: state.encryptionPassword,
      }),
    }
  )
)
