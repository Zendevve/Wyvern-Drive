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
  lastSelectedId: string | null

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
  selectAll: () => void
  setRangeSelection: (fromId: string, toId: string) => void
  deleteSelected: () => Promise<void>
  moveSelected: (parentId: number | null) => Promise<void>

  // Modal State
  activeModal: 'rename' | 'move' | 'versions' | null
  activeFileId: string | null
  setActiveModal: (modal: 'rename' | 'move' | 'versions' | null, fileId?: string | null) => void

  // Preview State
  previewFileId: string | null
  setPreviewFile: (fileId: string | null) => void

  // File Operations
  renameFile: (fileId: string, newName: string) => Promise<void>
  moveFile: (fileId: string, parentId: number | null) => Promise<void>

  // Versions
  getVersions: (fileId: string) => Promise<FileVersion[]>
  restoreVersion: (fileId: string, versionId: string) => Promise<void>
  deleteVersion: (fileId: string, versionId: string) => Promise<void>
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
      lastSelectedId: null,
      isLoading: false,
      uploadProgress: new Map(),
      activeModal: null,
      activeFileId: null,
      previewFileId: null,

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

        console.log('[FileStore] Initializing manager. PW present:', !!encryptionPassword)
        const manager = new WyvernFileManager(webhookUrl)
        if (encryptionPassword) {
          await manager.setPassword(encryptionPassword)
        }
        set({ fileManager: manager })
      },

      loadFiles: async () => {
        const { fileManager, currentPath } = get()
        if (!fileManager) return

        set({ isLoading: true })
        try {
          const root = await fileManager.fetchFiles()

          // If currentPath is set (folder ID), find that folder's children
          if (currentPath && currentPath !== '') {
            const findFolder = (node: WyvernFolder): WyvernFolder | null => {
              if (String(node.id) === currentPath) return node
              if (node.children) {
                for (const child of Object.values(node.children)) {
                  if (child.type === 'directory') {
                    const found = findFolder(child as WyvernFolder)
                    if (found) return found
                  }
                }
              }
              return null
            }

            const targetFolder = findFolder(root)
            if (targetFolder) {
              set({ files: targetFolder.children || {} })
            } else {
              // Folder not found, reset to root
              set({ files: root.children, currentPath: '' })
            }
          } else {
            // Root level
            set({ files: root.children })
          }
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
            return { uploadProgress: newProgress }
          })
          get().loadFiles()
        }
      },

      downloadFile: async (fileId) => {
        const { fileManager, files, encryptionPassword } = get()

        console.log('[FileStore] downloadFile called')
        console.log('[FileStore] encryptionPassword present:', !!encryptionPassword, 'value:', encryptionPassword ? '[HIDDEN]' : 'null')
        console.log('[FileStore] fileManager present:', !!fileManager)

        if (!fileManager) {
          console.error('[FileStore] No fileManager!')
          return
        }

        // Ensure password is set if available (reactivity fix)
        if (encryptionPassword) {
          console.log('[FileStore] Re-applying password to manager...')
          await fileManager.setPassword(encryptionPassword)
          console.log('[FileStore] Password applied successfully')
        } else {
          console.warn('[FileStore] No encryptionPassword in store! User may need to re-enter password.')
        }

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
        return { selectedIds: newSelection, lastSelectedId: id }
      }),

      clearSelection: () => set({ selectedIds: new Set(), lastSelectedId: null }),

      selectAll: () => set((state) => {
        const allIds = new Set(Object.values(state.files).map(f => String(f.id)))
        return { selectedIds: allIds, lastSelectedId: null }
      }),

      setRangeSelection: (fromId, toId) => set((state) => {
        // Get ordered list of file IDs (folders first, then by name)
        const items = Object.values(state.files)
        const sortedItems = items.sort((a, b) => {
          if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
          return a.name.localeCompare(b.name)
        })
        const orderedIds = sortedItems.map(f => String(f.id))

        const fromIndex = orderedIds.indexOf(fromId)
        const toIndex = orderedIds.indexOf(toId)
        if (fromIndex === -1 || toIndex === -1) return {}

        const start = Math.min(fromIndex, toIndex)
        const end = Math.max(fromIndex, toIndex)
        const rangeIds = orderedIds.slice(start, end + 1)

        const newSelection = new Set(state.selectedIds)
        rangeIds.forEach(id => newSelection.add(id))

        return { selectedIds: newSelection, lastSelectedId: toId }
      }),

      deleteSelected: async () => {
        const { fileManager, selectedIds } = get()
        if (!fileManager || selectedIds.size === 0) return

        const idsArray = Array.from(selectedIds)
        let failed = 0

        for (const id of idsArray) {
          try {
            await fileManager.deleteFile(Number(id))
          } catch (error) {
            console.error(`Failed to delete ${id}:`, error)
            failed++
          }
        }

        get().clearSelection()
        get().loadFiles()

        if (failed > 0) {
          alert(`Failed to delete ${failed} of ${idsArray.length} items`)
        }
      },

      moveSelected: async (parentId) => {
        const { fileManager, selectedIds } = get()
        if (!fileManager || selectedIds.size === 0) return

        const idsArray = Array.from(selectedIds)
        let failed = 0

        for (const id of idsArray) {
          try {
            await fileManager.moveFile(Number(id), parentId)
          } catch (error) {
            console.error(`Failed to move ${id}:`, error)
            failed++
          }
        }

        get().clearSelection()
        get().loadFiles()

        if (failed > 0) {
          alert(`Failed to move ${failed} of ${idsArray.length} items`)
        }
      },

      setActiveModal: (modal, fileId) => set({ activeModal: modal, activeFileId: fileId }),

      setPreviewFile: (fileId) => set({ previewFileId: fileId }),

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

      restoreVersion: async (fileId, versionId) => {
        const { fileManager } = get()
        if (!fileManager) return
        try {
          await fileManager.restoreVersion(Number(fileId), Number(versionId))
          get().loadFiles()
        } catch (error) {
          console.error('Restore version failed', error)
          alert('Restore version failed')
        }
      },

      deleteVersion: async (fileId, versionId) => {
        const { fileManager } = get()
        if (!fileManager) return
        try {
          await fileManager.deleteVersion(Number(fileId), Number(versionId))
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
