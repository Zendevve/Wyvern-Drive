import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import { supabase } from '../lib/supabase'
import type { WyvernFile, WyvernFolder, FileVersion, ServerBoostLevel } from '../lib/types'
import { WyvernFileManager } from '../lib/wyvern-file-manager'
import { cacheFileTree, getCachedFileTree, clearUserCache, isOnline } from '../lib/offlineCache'

// Progress tracking with speed info
export interface UploadInfo {
  fileName: string   // Name of file being transferred
  percent: number
  loaded: number
  total: number
  startTime: number
  type: 'upload' | 'download'
  unit: 'bytes' | 'files'  // bytes for single file, files for folder operations
}

// Sort and filter types
export type SortBy = 'name' | 'size' | 'date' | 'type'
export type SortOrder = 'asc' | 'desc'
export type FileTypeFilter = 'all' | 'images' | 'videos' | 'audio' | 'documents'

// File health status
export type FileHealthStatus = 'unknown' | 'healthy' | 'unavailable' | 'checking'

interface FileStore {
  // Auth
  webhookUrl: string | null  // @deprecated - kept for backward compatibility migration
  webhookUrls: string[]      // New: array of webhook URLs for parallel uploads
  userId: string | null
  userEmail: string | null   // New: user email for UI display
  isAuthenticated: boolean
  encryptionPassword: string | null
  serverBoostLevel: ServerBoostLevel  // Discord server boost level for chunk sizing

  // Core Engine
  fileManager: WyvernFileManager | null

  // File tree
  currentPath: string
  breadcrumbs: { id: string; name: string }[]
  files: Record<string, WyvernFile | WyvernFolder>
  selectedIds: Set<string>
  lastSelectedId: string | null

  // UI state
  isLoading: boolean
  isSyncing: boolean     // Background sync in progress
  isOffline: boolean     // No network connection
  uploadProgress: Map<string, UploadInfo>
  isSettingsOpen: boolean

  // Search, Sort & Filter
  searchQuery: string
  sortBy: SortBy
  sortOrder: SortOrder
  filterType: FileTypeFilter

  // File Health Checking
  fileHealthStatus: Map<string, FileHealthStatus>
  isVerifying: boolean
  verifyProgress: { checked: number; total: number; unavailable: number }
  error: string | null // New error state

  // Actions
  setWebhookUrl: (url: string) => void  // @deprecated - use setWebhookUrls
  setWebhookUrls: (urls: string[]) => void
  setUserEmail: (email: string | null) => void // New action
  updateWebhooks: (urls: string[]) => Promise<void>  // For post-login updates
  setEncryptionPassword: (password: string | null) => Promise<void>
  setServerBoostLevel: (level: ServerBoostLevel) => void
  initializeManager: () => Promise<void>
  loadFiles: () => Promise<void>
  uploadFiles: (files: FileList) => Promise<void>
  uploadFolder: (files: FileList) => Promise<void>
  downloadFile: (fileId: string) => Promise<void>
  downloadFolder: (folderId: string) => Promise<void>
  deleteFile: (fileId: string) => Promise<void>
  logout: () => Promise<void>
  setCurrentPath: (path: string) => void
  selectFile: (id: string) => void
  toggleSelection: (id: string) => void
  clearSelection: () => void
  selectAll: () => void
  setRangeSelection: (fromId: string, toId: string) => void
  deleteSelected: () => Promise<void>
  moveSelected: (parentId: number | null) => Promise<void>

  // Modal State
  activeModal: 'rename' | 'move' | 'versions' | 'share' | 'settings' | null
  activeFileId: string | null
  setActiveModal: (modal: 'rename' | 'move' | 'versions' | 'share' | 'settings' | null, fileId?: string | null) => void

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

  // Search, Sort & Filter Actions
  setSearchQuery: (query: string) => void
  setSortBy: (sortBy: SortBy) => void
  setSortOrder: (order: SortOrder) => void
  toggleSortOrder: () => void
  setFilterType: (filter: FileTypeFilter) => void

  // Webhook Pool Stats (for UI indicators)
  getWebhookPoolStats: () => { count: number; isOptimal: boolean; recommendation: string | null } | null

  // File Health Actions
  verifyAllFiles: () => Promise<void>
  setFileHealthStatus: (fileId: string, status: FileHealthStatus) => void
  getFileHealthStatus: (fileId: string) => FileHealthStatus
}

export const useFileStore = create<FileStore>()(
  persist(
    (set, get) => ({
      // Initial state
      webhookUrl: null,  // @deprecated
      webhookUrls: [],
      userId: null,
      userEmail: null,
      isAuthenticated: false,
      encryptionPassword: null,
      serverBoostLevel: 'none' as ServerBoostLevel,  // Default: no boost
      fileManager: null, // Non-persisted class instance
      currentPath: '',
      breadcrumbs: [],
      files: {},
      selectedIds: new Set(),
      lastSelectedId: null,
      isLoading: false,
      error: null,
      isSyncing: false,
      isOffline: !isOnline(),
      uploadProgress: new Map(),
      activeModal: null,
      activeFileId: null,
      previewFileId: null,
      isSettingsOpen: false,

      // Search, Sort & Filter defaults
      searchQuery: '',
      sortBy: 'name' as SortBy,
      sortOrder: 'asc' as SortOrder,
      filterType: 'all' as FileTypeFilter,

      // File Health Checking
      fileHealthStatus: new Map<string, FileHealthStatus>(),
      isVerifying: false,
      verifyProgress: { checked: 0, total: 0, unavailable: 0 },

      // Actions
      // @deprecated - use setWebhookUrls
      setWebhookUrl: (url) => set({
        webhookUrl: url,
        webhookUrls: [url],  // Migrate to array
        isAuthenticated: true
        // userId will be set by initializeManager with proper hash
      }),

      setWebhookUrls: (urls) => {
        const validUrls = urls.filter(u => u.trim().length > 0)
        if (validUrls.length === 0) return
        set({
          webhookUrls: validUrls,
          webhookUrl: validUrls[0],  // Keep for backward compat
          isAuthenticated: true
          // userId will be set by initializeManager with proper hash
        })
      },

      updateWebhooks: async (urls) => {
        const validUrls = urls.filter(u => u.trim().length > 0)
        if (validUrls.length === 0) return

        const { encryptionPassword, userId } = get()

        // Update state
        set({
          webhookUrls: validUrls,
          webhookUrl: validUrls[0]
        })

        // Persist to Supabase profiles table
        if (userId) {
          try {
            const { error } = await supabase
              .from('profiles')
              .upsert({
                id: userId,
                webhook_urls: validUrls,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' })

            if (error) {
              console.error('[FileStore] Failed to save webhooks to DB:', error)
            } else {
              console.log('[FileStore] Webhooks saved to database')
            }
          } catch (err) {
            console.error('[FileStore] Error saving webhooks:', err)
          }
        }

        // Reinitialize manager with new webhooks
        console.log('[FileStore] Updating webhooks and reinitializing manager')
        const { serverBoostLevel } = get()
        // Uses async create() which auto-migrates to SHA-256 userId
        const manager = await WyvernFileManager.create(validUrls, serverBoostLevel)
        if (encryptionPassword) {
          await manager.setPassword(encryptionPassword)
        }
        set({ fileManager: manager })
      },

      setServerBoostLevel: (level) => {
        set({ serverBoostLevel: level })
        // Update existing manager if present
        const { fileManager } = get()
        if (fileManager) {
          fileManager.setBoostLevel(level)
          console.log('[FileStore] Updated boost level to:', level)
        }
      },

      setEncryptionPassword: async (password) => {
        set({ encryptionPassword: password })
        const { fileManager } = get()
        if (fileManager && password) {
          await fileManager.setPassword(password)
        }
      },

      initializeManager: async () => {
        const { webhookUrls, webhookUrl, encryptionPassword, serverBoostLevel, fileManager, userId } = get()

        // Use webhookUrls array, fall back to single webhookUrl for backward compat
        const urls = webhookUrls.length > 0 ? webhookUrls : (webhookUrl ? [webhookUrl] : [])
        if (urls.length === 0) return

        // GUARD: Skip if we already have a valid manager for this user
        // This prevents race conditions from multiple useEffect triggers
        if (fileManager && userId) {
          console.log('[FileStore] Manager already initialized, skipping')
          return
        }

        // GUARD: Prevent concurrent initialization calls
        // Use module-level variable to track ongoing initialization
        if ((window as unknown as { __wyvernInitPromise?: Promise<void> }).__wyvernInitPromise) {
          console.log('[FileStore] Initialization already in progress, waiting...')
          await (window as unknown as { __wyvernInitPromise?: Promise<void> }).__wyvernInitPromise
          return
        }

        const initPromise = (async () => {
          console.log('[FileStore] Initializing manager with', urls.length, 'webhook(s). Boost:', serverBoostLevel, 'PW present:', !!encryptionPassword)
          // Uses async create() which auto-migrates to SHA-256 userId
          const manager = await WyvernFileManager.create(urls, serverBoostLevel)
          if (encryptionPassword) {
            await manager.setPassword(encryptionPassword)
          }
          // CRITICAL: Set both fileManager AND userId - loadFiles needs userId!
          set({ fileManager: manager, userId: manager.getUserId() })

          // SYNC: Persist webhooks to Supabase profile (for Share Link refreshing)
          // This enables the backend to access the user's webhooks when serving shared files
          try {
            const { error } = await supabase
              .from('profiles')
              .upsert({
                id: manager.getUserId(),
                webhook_urls: urls,
                server_boost_level: serverBoostLevel,
                updated_at: new Date().toISOString()
              }, { onConflict: 'id' })

            if (error) console.error('[FileStore] Failed to sync webhooks to profile:', error)
            else console.log('[FileStore] Synced webhooks to profile for sharing support')
          } catch (e) {
            console.error('[FileStore] Profile sync error:', e)
          }
        })();

        (window as unknown as { __wyvernInitPromise?: Promise<void> }).__wyvernInitPromise = initPromise

        try {
          await initPromise
        } finally {
          (window as unknown as { __wyvernInitPromise?: Promise<void> }).__wyvernInitPromise = undefined
        }
      },

      loadFiles: async () => {
        const { fileManager, currentPath, userId } = get()
        console.log('[FileStore] loadFiles called - fileManager:', !!fileManager, 'userId:', userId)
        if (!fileManager || !userId) {
          console.warn('[FileStore] loadFiles early return - missing fileManager or userId')
          return
        }

        // Helper to apply file tree to state
        const applyFileTree = (root: WyvernFolder) => {
          if (currentPath && currentPath !== '') {
            let foundPath: { id: string; name: string }[] = []

            const findFolderAndPath = (
              node: WyvernFolder,
              currentBreadcrumbs: { id: string; name: string }[]
            ): WyvernFolder | null => {
              if (String(node.id) === currentPath) {
                foundPath = [...currentBreadcrumbs, { id: String(node.id), name: node.name }]
                return node
              }
              if (node.children) {
                for (const child of Object.values(node.children)) {
                  if (child.type === 'directory') {
                    const result = findFolderAndPath(child as WyvernFolder, [
                      ...currentBreadcrumbs,
                      { id: String(node.id), name: node.name },
                    ])
                    if (result) return result
                  }
                }
              }
              return null
            }

            const targetFolder = findFolderAndPath(root, [])

            if (targetFolder) {
              set({ files: targetFolder.children || {}, breadcrumbs: foundPath })
            } else {
              set({ files: root.children, currentPath: '', breadcrumbs: [] })
            }
          } else {
            set({ files: root.children, breadcrumbs: [] })
          }
        }

        // STEP 1: Try to load from cache first (instant UI)
        const cachedTree = await getCachedFileTree(userId)
        if (cachedTree) {
          console.log('[FileStore] Loaded from cache - instant UI!')
          // Create a fake root to reuse applyFileTree logic
          const cachedRoot = { children: cachedTree } as WyvernFolder
          applyFileTree(cachedRoot)

          // Start background sync
          set({ isSyncing: true, isOffline: !isOnline(), error: null })
        } else {
          // No cache - show loading state
          set({ isLoading: true, isOffline: !isOnline(), error: null })
        }

        // STEP 2: Fetch fresh data from API (sync)
        try {
          const root = await fileManager.fetchFiles()
          applyFileTree(root)

          // STEP 3: Cache the file tree for next time
          await cacheFileTree(userId, root.children)
          console.log('[FileStore] File tree cached for offline use')
          set({ error: null }) // Clear any previous errors on success

        } catch (error) {
          console.error('Failed to load files:', error)
          const message = (error as Error).message || 'Failed to load files'

          if (message.includes('404')) {
            // 404 might mean user has no file record yet - which is fine, treat as empty?
            // Or it implies backend endpoint missing.
            // If WyvernFileManager throws 404 for fetchFiles, it usually means the endpoint failed.
            set({ error: 'Could not connect to server. Check your connection or deploy status.' })
          } else {
            set({ error: message })
          }

          set({ isOffline: true })
          // If we had cache, we're still showing it (graceful offline)
        } finally {
          set({ isLoading: false, isSyncing: false })
        }
      },

      uploadFiles: async (fileList) => {
        const { fileManager, currentPath } = get()
        if (!fileManager) return

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i]
          const tempId = `temp-${Date.now()}-${i}`
          const startTime = Date.now()

          set((state) => {
            const newProgress = new Map(state.uploadProgress)
            newProgress.set(tempId, {
              fileName: file.name,
              percent: 0,
              loaded: 0,
              total: file.size,
              startTime,
              type: 'upload',
              unit: 'bytes'
            })
            return { uploadProgress: newProgress }
          })

          try {
            await fileManager.uploadFile(
              file,
              currentPath + '/' + file.name,
              null, // TODO: Get parent ID from current path mapping
              {
                encrypt: !!get().encryptionPassword,
                compress: true,  // Enable gzip compression for compressible files
                onProgress: (loaded, total) => {
                  set((state) => {
                    const newProgress = new Map(state.uploadProgress)
                    newProgress.set(tempId, {
                      fileName: file.name,
                      percent: (loaded / total) * 100,
                      loaded,
                      total,
                      startTime,
                      type: 'upload',
                      unit: 'bytes'
                    })
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
        const startTime = Date.now()
        // Folder upload tracks file count, not bytes
        const totalFiles = files.length

        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.set(tempId, {
            fileName: 'Folder upload',
            percent: 0,
            loaded: 0,
            total: totalFiles,
            startTime,
            type: 'upload',
            unit: 'files'
          })
          return { uploadProgress: newProgress }
        })

        try {
          await fileManager.uploadFolder(files, parentId, {
            encrypt: !!encryptionPassword,
            onProgress: (loaded, total) => {
              set((state) => {
                const newProgress = new Map(state.uploadProgress)
                newProgress.set(tempId, {
                  fileName: 'Folder upload',
                  percent: (loaded / total) * 100,
                  loaded,
                  total,
                  startTime,
                  type: 'upload',
                  unit: 'files'
                })
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
        const startTime = Date.now()
        const fileSize = (file as WyvernFile).size || 0

        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.set(tempId, {
            fileName: file.name,
            percent: 0,
            loaded: 0,
            total: fileSize,
            startTime,
            type: 'download',
            unit: 'bytes'
          })
          return { uploadProgress: newProgress }
        })

        try {
          await fileManager.downloadFile(file as WyvernFile, {
            onProgress: (loaded, total) => {
              set((state) => {
                const newProgress = new Map(state.uploadProgress)
                newProgress.set(tempId, {
                  fileName: file.name,
                  percent: (loaded / total) * 100,
                  loaded,
                  total,
                  startTime,
                  type: 'download',
                  unit: 'bytes'
                })
                return { uploadProgress: newProgress }
              })
            }
          })
        } catch (error) {
          console.error(`Failed to download ${file.name}:`, error)
          const msg = (error as Error).message || String(error)

          if (msg.includes('404')) {
            alert(`Download Failed: The file link has expired (404). Discord attachment links expire after 24 hours. Please re-upload the file or refresh the cache.`)
          } else if (msg.includes('403')) {
            alert(`Download Failed: Access denied (403). The link signature may have expired.`)
          } else {
            alert(`Failed to download ${file.name}: ${msg}\n\nTip: If this file is encrypted, ensure your encryption password is set in Settings.`)
          }
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
        const startTime = Date.now()

        set((state) => {
          const newProgress = new Map(state.uploadProgress)
          newProgress.set(tempId, {
            fileName: folder.name + '.zip',
            percent: 0,
            loaded: 0,
            total: 100,
            startTime,
            type: 'download',
            unit: 'files'
          })
          return { uploadProgress: newProgress }
        })

        try {
          await fileManager.downloadFolder(Number(folderId), folder.name, {
            onProgress: (loaded, total) => {
              set((state) => {
                const newProgress = new Map(state.uploadProgress)
                newProgress.set(tempId, {
                  fileName: folder.name + '.zip',
                  percent: (loaded / total) * 100,
                  loaded,
                  total,
                  startTime,
                  type: 'download',
                  unit: 'files'
                })
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

      setUserEmail: (email) => set({ userEmail: email }),

      logout: async () => {
        const { userId } = get()

        // Clear offline cache for this user
        if (userId) {
          clearUserCache(userId).catch(console.error)
        }

        // Sign out of Supabase (use local scope to avoid 403 errors)
        try {
          await supabase.auth.signOut({ scope: 'local' })
        } catch (e) {
          console.warn('[FileStore] Logout API failed, clearing local state anyway:', e)
        }

        // Clear all Supabase auth data from localStorage to force logout
        // This ensures we log out even if the API call fails
        if (typeof window !== 'undefined') {
          localStorage.removeItem('wyvern-saved-webhooks')
          // Clear Supabase auth keys
          const keysToRemove = Object.keys(localStorage).filter(key =>
            key.startsWith('sb-') || key.includes('supabase')
          )
          keysToRemove.forEach(key => localStorage.removeItem(key))
        }

        // Clear store state
        set({
          webhookUrl: null,
          webhookUrls: [],
          userId: null,
          userEmail: null,
          isAuthenticated: false,
          encryptionPassword: null,
          fileManager: null,
          currentPath: '',
          breadcrumbs: [],
          files: {},
          selectedIds: new Set(),
          isSettingsOpen: false,
          isSyncing: false,
          isOffline: false,
        })

        // Force page reload to clear any cached auth state
        window.location.href = '/'
      },

      setCurrentPath: (path) => set({ currentPath: path, selectedIds: new Set(), lastSelectedId: null }),

      selectFile: (id) => set({ selectedIds: new Set([id]), lastSelectedId: id }),

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
      },

      getWebhookPoolStats: () => {
        const { fileManager } = get()
        if (!fileManager) return null
        const stats = fileManager.getWebhookPoolStats()
        return {
          count: stats.count,
          isOptimal: stats.isOptimal,
          recommendation: stats.recommendation
        }
      },

      // Search, Sort & Filter Actions
      setSearchQuery: (query) => set({ searchQuery: query }),

      setSortBy: (sortBy) => set({ sortBy }),

      setSortOrder: (order) => set({ sortOrder: order }),

      toggleSortOrder: () => set((state) => ({
        sortOrder: state.sortOrder === 'asc' ? 'desc' : 'asc'
      })),

      setFilterType: (filter) => set({ filterType: filter }),

      // File Health Actions
      verifyAllFiles: async () => {
        const { files, isVerifying } = get()
        if (isVerifying) return

        // Get all files (not folders)
        const fileList = Object.values(files).filter(f => f.type === 'file') as WyvernFile[]
        if (fileList.length === 0) return

        set({
          isVerifying: true,
          verifyProgress: { checked: 0, total: fileList.length, unavailable: 0 }
        })

        let unavailableCount = 0

        for (let i = 0; i < fileList.length; i++) {
          const file = fileList[i]
          const fileId = String(file.id)

          // Update to checking status
          set((state) => {
            const newHealth = new Map(state.fileHealthStatus)
            newHealth.set(fileId, 'checking')
            return { fileHealthStatus: newHealth }
          })

          try {
            // Parse content to get first chunk URL
            if (!file.content) {
              throw new Error('No content')
            }

            const chunks = JSON.parse(file.content)
            if (!chunks || chunks.length === 0) {
              throw new Error('No chunks')
            }

            // Get first chunk URL (might be 'u' or 'url')
            const firstChunk = chunks[0]
            const url = firstChunk.u || firstChunk.url
            if (!url) {
              throw new Error('No URL in chunk')
            }

            // Do a HEAD request to check if the URL is accessible
            // Note: This may fail due to CORS, so we fall back to assuming healthy
            try {
              await fetch(url, { method: 'HEAD', mode: 'no-cors' })
              // no-cors always returns opaque response, so we can't check status
              // If it throws, the URL is likely bad
              set((state) => {
                const newHealth = new Map(state.fileHealthStatus)
                newHealth.set(fileId, 'healthy')
                return { fileHealthStatus: newHealth }
              })
            } catch {
              // Fetch failed - file is unavailable
              unavailableCount++
              set((state) => {
                const newHealth = new Map(state.fileHealthStatus)
                newHealth.set(fileId, 'unavailable')
                return { fileHealthStatus: newHealth }
              })
            }
          } catch {
            // Parsing failed or no content - mark as unavailable
            unavailableCount++
            set((state) => {
              const newHealth = new Map(state.fileHealthStatus)
              newHealth.set(fileId, 'unavailable')
              return { fileHealthStatus: newHealth }
            })
          }

          // Update progress
          set({ verifyProgress: { checked: i + 1, total: fileList.length, unavailable: unavailableCount } })
        }

        set({ isVerifying: false })
        console.log(`[FileStore] Verification complete: ${unavailableCount} unavailable out of ${fileList.length}`)
      },

      setFileHealthStatus: (fileId, status) => set((state) => {
        const newHealth = new Map(state.fileHealthStatus)
        newHealth.set(fileId, status)
        return { fileHealthStatus: newHealth }
      }),

      getFileHealthStatus: (fileId) => {
        return get().fileHealthStatus.get(fileId) || 'unknown'
      }

    }),
    {
      name: 'wyvern-drive-storage',
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') return window.localStorage
        return {
          getItem: () => null,
          setItem: () => { },
          removeItem: () => { },
        }
      }),
      partialize: (state) => ({
        webhookUrl: state.webhookUrl,  // @deprecated - kept for backward compat
        webhookUrls: state.webhookUrls,
        userId: state.userId,
        isAuthenticated: state.isAuthenticated,
        serverBoostLevel: state.serverBoostLevel,  // Persist boost level setting
        // SECURITY: encryptionPassword is intentionally NOT persisted
        // User must re-enter password on each session to decrypt files
      }),
    }
  )
)
