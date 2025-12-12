import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WyvernFile, WyvernFolder, FileVersion } from '../lib/types'
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
  uploadFolder: (files: FileList) => Promise<void>
  downloadFile: (fileId: string) => Promise<void>
  downloadFolder: (folderId: string) => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  logout: () => void
  setCurrentPath: (path: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void

  // Modal State
  activeModal: 'rename' | 'move' | 'versions' | null
  activeFileId: string | null
  setActiveModal: (modal: 'rename' | 'move' | 'versions' | null, fileId?: string | null) => void

  // File Operations
  renameFile: (fileId: string, newName: string) => Promise<void>
  moveFile: (fileId: string, parentId: number | null) => Promise<void>

  // Versions
  getVersions: (fileId: string) => Promise<FileVersion[]>
  restoreVersion: (versionId: string) => Promise<void>
  deleteVersion: (versionId: string) => Promise<void>
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
      activeModal: null,
      activeFileId: null,

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

      uploadFolder: async (files) => {
        const { fileManager, isAuthenticated, encryptionPassword } = get()
        if (!fileManager || !isAuthenticated) return

        // Finding current folder ID would go here, MVP defaulting to root/null
        const parentId = null

        if (encryptionPassword) {
          await fileManager.setPassword(encryptionPassword)
        }

        set({ isLoading: true })

        // Use a consistent ID for the folder upload progress
        const tempId = `up-folder-${Date.now()}`

        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.set(tempId, 0)
          return { uploadProgress: newProgress }
        })

        try {
          await fileManager.uploadFolder(files, parentId, {
            encrypt: !!encryptionPassword,
            onProgress: (loaded, total) => {
              set((state) => {
                const newProgress = new Map(state.uploadProgress)
                newProgress.set(tempId, (loaded / total) * 100)
                return { uploadProgress: newProgress }
              })
            }
          })
        } catch (error) {
          console.error('Folder upload failed:', error)
          alert('Folder upload failed')
        } finally {
          set((state) => {
            const newProgress = new Map(state.uploadProgress)
            newProgress.delete(tempId)
            return { isLoading: false, uploadProgress: newProgress }
          })
          get().loadFiles()
        }
      },

      downloadFile: async (fileId) => {
        const { fileManager, files } = get()
        if (!fileManager) return

        const file = Object.values(files).find(f => String(f.id) === String(fileId))
        if (!file || file.type !== 'file') {
          console.error('File not found', fileId)
          return
        }

        const tempId = `dl-${file.id}`
        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.set(tempId, 0)
          return { uploadProgress: newProgress }
        })

        try {
          await fileManager.downloadFile(file as WyvernFile, {
            onProgress: (loaded, total) => {
              set((state) => {
                const newProgress = new Map(state.uploadProgress)
                newProgress.set(tempId, (loaded / total) * 100)
                return { uploadProgress: newProgress }
              })
            }
          })
        } catch (error) {
          console.error(`Failed to download ${file.name}:`, error)
          alert(`Failed to download ${file.name}: ${(error as Error).message}`)
        }

        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.delete(tempId)
          return { uploadProgress: newProgress }
        })
      },

      downloadFolder: async (folderId) => {
        const { fileManager, files } = get()
        if (!fileManager) return

        const folder = Object.values(files).find(f => String(f.id) === String(folderId))
        if (!folder || folder.type !== 'directory') {
          console.error('Folder not found')
          return
        }

        const tempId = `dl-zip-${folderId}`
        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.set(tempId, 0)
          return { uploadProgress: newProgress }
        })

        try {
          await fileManager.downloadFolder(Number(folderId), folder.name, {
            onProgress: (loaded, total) => {
              set((state) => {
                const newProgress = new Map(state.uploadProgress)
                newProgress.set(tempId, (loaded / total) * 100)
                return { uploadProgress: newProgress }
              })
            }
          })
        } catch (error) {
          console.error('Folder download failed:', error)
          alert(`Folder download failed: ${(error as Error).message}`)
        }

        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.delete(tempId)
          return { uploadProgress: newProgress }
        })
      },

      deleteFile: async (fileId) => {
        const { fileManager } = get()
        if (!fileManager) return

        try {
          await fileManager.deleteFile(Number(fileId))
          get().loadFiles()
        } catch (error) {
          console.error('Failed to delete file:', error)
          alert('Failed to delete file')
        }
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

      setActiveModal: (modal, fileId) => set({ activeModal: modal, activeFileId: fileId }),

      renameFile: async (fileId, newName) => {
        const { fileManager } = get()
        if (!fileManager) return
        try {
          await fileManager.renameFile(Number(fileId), newName)
          get().loadFiles()
        } catch (error) {
          console.error('Rename failed:', error)
          alert('Rename failed')
        }
      },

      moveFile: async (fileId, parentId) => {
        const { fileManager } = get()
        if (!fileManager) return
        try {
          await fileManager.moveFile(Number(fileId), parentId)
          get().loadFiles()
        } catch (error) {
          console.error('Move failed:', error)
          alert('Move failed')
        }
      },

      getVersions: async (fileId) => {
        const { fileManager } = get()
        if (!fileManager) return []
        try {
          return await fileManager.getVersions(Number(fileId))
        } catch (error) {
          console.error('Get versions failed', error)
          return []
        }
      },

      restoreVersion: async (versionId) => {
        const { fileManager } = get()
        if (!fileManager) return
        try {
          await fileManager.restoreVersion(Number(versionId))
          get().loadFiles()
        } catch (error) {
          console.error('Restore version failed', error)
          alert('Restore version failed')
        }
      },

      deleteVersion: async (versionId) => {
        const { fileManager } = get()
        if (!fileManager) return
        try {
          await fileManager.deleteVersion(Number(versionId))
        } catch (error) {
          console.error('Delete version failed', error)
          alert('Delete version failed')
        }
      }

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
