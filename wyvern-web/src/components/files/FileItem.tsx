import { useState, useEffect, memo } from 'react'
import type { WyvernFile, WyvernFolder, ChunkInfo, LegacyChunkInfo } from '../../lib/types'
import { normalizeChunk } from '../../lib/types'
import { useFileStore } from '../../stores/fileStore'
import { fetchViaExtension } from '../../lib/extension'
import {
  getCachedThumbnail,
  setCachedThumbnail,
  getLoadingPromise,
  setLoadingPromise
} from '../../lib/thumbnailCache'
import { ContextMenu } from './ContextMenu'
import { getFileIconName, formatSize, formatDate } from '../../lib/utils'
import { isPreviewable, isImageFile, isVideoFile, getMimeType } from '../../lib/thumbnails'
import { decryptChunk, restoreEncryptionContext } from '../../lib/encryption'
import { decompressData } from '../../lib/compression'
import { Loader, Folder, File, FileText, Image, Music, Video, Archive, Code, Cog, AlertTriangle } from 'lucide-react'
import './FileItem.css'

// Module-level icon mapping (prevents recreation on each render)
const ICON_MAP: Record<string, typeof File> = {
  Folder, File, FileText, Image, Music, Video, Archive, Code, Cog
}

interface FileItemProps {
  file: WyvernFile | WyvernFolder
  viewMode: 'grid' | 'list'
}

function FileItemComponent({ file, viewMode }: FileItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isLoadingThumb, setIsLoadingThumb] = useState(false)
  const [isUnavailable, setIsUnavailable] = useState(false) // Health check state

  // Optimized selectors - only re-render when THIS file's selection changes
  const isSelected = useFileStore(state => state.selectedIds.has(String(file.id)))
  const encryptionPassword = useFileStore(state => state.encryptionPassword)
  const toggleSelection = useFileStore(state => state.toggleSelection)
  const lastSelectedId = useFileStore(state => state.lastSelectedId)
  const setRangeSelection = useFileStore(state => state.setRangeSelection)
  const { moveFile } = useFileStore.getState()

  const isFolder = file.type === 'directory'
  const isImage = !isFolder && isImageFile(file.name)
  const isVideo = !isFolder && isVideoFile(file.name)
  const iconName = isFolder ? 'Folder' : getFileIconName(file.name)
  const IconComponent = ICON_MAP[iconName] || File

  // Load thumbnail for images only in grid view
  // SKIP VIDEO THUMBNAILS - they're 20MB+ each and kill memory
  useEffect(() => {
    if (!isImage || viewMode !== 'grid') return

    // Check cache first - instant display without network request
    const cachedUrl = getCachedThumbnail(String(file.id))
    if (cachedUrl) {
      setThumbnail(cachedUrl)
      return
    }

    if (thumbnail) return

    const wyvernFile = file as WyvernFile
    if (!wyvernFile.content) return

    // Check if already loading - wait for that instead of starting new load
    const existingPromise = getLoadingPromise(String(file.id))
    if (existingPromise) {
      setIsLoadingThumb(true)
      existingPromise
        .then(url => {
          setThumbnail(url)
        })
        .catch(() => {
          setIsUnavailable(true)
        })
        .finally(() => {
          setIsLoadingThumb(false)
        })
      return
    }

    // Start new load - ONLY fetch first chunk for image thumbnails
    const loadThumbnail = async (): Promise<string> => {
      const rawChunks: (ChunkInfo | LegacyChunkInfo)[] = JSON.parse(wyvernFile.content!)
      const chunks = rawChunks.map(c => normalizeChunk(c))
      chunks.sort((a, b) => a.i - b.i)

      let decryptionKey: CryptoKey | null = null
      if (wyvernFile.encrypted && encryptionPassword && wyvernFile.encryption_salt) {
        decryptionKey = await restoreEncryptionContext(encryptionPassword, wyvernFile.encryption_salt)
      }

      // For image thumbnails, only fetch first chunk (enough for preview)
      const chunksToFetch = chunks.slice(0, 1)

      const fileParts: ArrayBuffer[] = []
      for (const chunk of chunksToFetch) {
        let data = await fetchViaExtension(chunk.u)

        if (wyvernFile.encrypted && decryptionKey && chunk.v) {
          const iv = new Uint8Array(chunk.v)
          data = await decryptChunk(data, decryptionKey, iv)
        }

        if (chunk.c) {
          data = await decompressData(data)
        }

        fileParts.push(data)
      }

      const blob = new Blob(fileParts, { type: getMimeType(wyvernFile.name) })
      return URL.createObjectURL(blob)
    }

    setIsLoadingThumb(true)

    const promise = loadThumbnail()
    setLoadingPromise(String(file.id), promise)

    promise
      .then(url => {
        setCachedThumbnail(String(file.id), url)
        setThumbnail(url)
      })
      .catch(err => {
        console.error('Thumbnail load failed:', err)
        const errorMsg = String(err)
        if (errorMsg.includes('404') || errorMsg.includes('not found') || errorMsg.includes('timeout')) {
          setIsUnavailable(true)
        }
      })
      .finally(() => {
        setIsLoadingThumb(false)
      })

    // No cleanup needed - cache manages blob URL lifecycle
  }, [file.id, viewMode, isImage, isVideo, encryptionPassword, thumbnail])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    // If right-clicking an unselected item, select it first (standard behavior)
    const { selectedIds, selectFile } = useFileStore.getState()
    if (!selectedIds.has(String(file.id))) {
      selectFile(String(file.id))
    }
    // Now show context menu (will reflect current selection)
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDoubleClick = () => {
    if (isFolder) {
      // Navigate into folder
      const { setCurrentPath, loadFiles } = useFileStore.getState()
      // Build path from folder name (simple approach, assuming flat structure for now)
      // For nested folders, we'd need to track parent path properly
      setCurrentPath(String(file.id)) // Using ID as path key for now
      loadFiles()
    } else if (isPreviewable(file.name)) {
      useFileStore.getState().setPreviewFile(String(file.id))
    } else {
      useFileStore.getState().downloadFile(String(file.id))
    }
  }

  // Ctrl+Click to toggle, Shift+Click for range selection
  const handleClick = (e: React.MouseEvent) => {
    // Stop propagation so FileGrid background click doesn't trigger clearSelection
    e.stopPropagation()

    if (e.shiftKey && lastSelectedId) {
      e.preventDefault()
      setRangeSelection(lastSelectedId, String(file.id))
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      toggleSelection(String(file.id))
    } else {
      // Single click selects only this file
      useFileStore.getState().selectFile(String(file.id))
    }
  }

  // Keyboard navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Enter = open (same as double-click)
    if (e.key === 'Enter') {
      e.preventDefault()
      handleDoubleClick()
    }
    // Space = toggle selection
    if (e.key === ' ') {
      e.preventDefault()
      toggleSelection(String(file.id))
    }
  }

  // Drag Source
  const handleDragStart = (e: React.DragEvent) => {
    const { selectedIds } = useFileStore.getState()

    // If this file is part of a selection, drag all selected
    // If not selected, select it first (unless multiple selected already and we just didn't click?)
    // Actually, usually simpler: if dragging unselected item, select it.
    if (!selectedIds.has(String(file.id))) {
      useFileStore.getState().selectFile(String(file.id))
    }

    // Refresh state after potential update
    const currentSelectedIds = useFileStore.getState().selectedIds

    if (currentSelectedIds.size > 1) {
      e.dataTransfer.setData('application/wyvern-file-ids', JSON.stringify(Array.from(currentSelectedIds)))
      e.dataTransfer.effectAllowed = 'move'
    } else {
      // Single file drag
      e.dataTransfer.setData('application/wyvern-file-id', String(file.id))
      e.dataTransfer.effectAllowed = 'move'
    }
  }

  // Drop Target (Folders only)
  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return
    if (e.dataTransfer.types.includes('application/wyvern-file-id') ||
      e.dataTransfer.types.includes('application/wyvern-file-ids')) {
      e.preventDefault()
      e.stopPropagation()
      setIsDragOver(true)
      e.dataTransfer.dropEffect = 'move'
    }
  }

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isFolder) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    if (!isFolder) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    // Check for batch move first
    const batchIds = e.dataTransfer.getData('application/wyvern-file-ids')
    if (batchIds) {
      const ids: string[] = JSON.parse(batchIds)
      // Filter out self (can't move folder into itself)
      const idsToMove = ids.filter(id => id !== String(file.id))
      for (const id of idsToMove) {
        await moveFile(id, file.id)
      }
      useFileStore.getState().clearSelection()
      useFileStore.getState().loadFiles()
      return
    }

    // Single file move
    const fileId = e.dataTransfer.getData('application/wyvern-file-id')
    if (fileId && fileId !== String(file.id)) {
      moveFile(fileId, file.id)
    }
  }

  return (
    <>
      <div
        className={`file-item ${viewMode} ${isDragOver ? 'drag-over' : ''} ${isImage && thumbnail ? 'has-thumbnail' : ''} ${isSelected ? 'selected' : ''}`}
        draggable="true"
        data-id={file.id}
        tabIndex={0}
        role="button"
        aria-label={`${file.name}, ${isFolder ? 'Folder' : iconName}`}
        aria-selected={isSelected}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
      >
        {/* Thumbnail or Icon */}
        {viewMode === 'grid' && (isImage || isVideo) && thumbnail ? (
          <div className={`file-thumbnail ${isVideo ? 'video-thumb' : ''}`}>
            <img src={thumbnail} alt={file.name} />
            {isVideo && <div className="video-overlay"><Video size={24} /></div>}
          </div>
        ) : viewMode === 'grid' && (isImage || isVideo) && isLoadingThumb ? (
          <div className="file-thumbnail loading">
            <Loader size={24} className="spinner" />
          </div>
        ) : (
          <span className="file-icon"><IconComponent size={viewMode === 'grid' ? 32 : 18} /></span>
        )}

        <span className="file-name">{file.name}</span>

        {/* Unavailable warning badge */}
        {isUnavailable && (
          <span className="file-unavailable-badge" title="File unavailable - Discord content may have been deleted">
            <AlertTriangle size={14} />
          </span>
        )}

        {viewMode === 'list' && !isFolder && (
          <>
            <span className="file-size">{formatSize((file as WyvernFile).size)}</span>
            <span className="file-date">{formatDate(file.updated_at)}</span>
          </>
        )}
      </div>

      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          file={file}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}

// Memoized export - prevent re-renders when parent updates but props haven't changed
export const FileItem = memo(FileItemComponent)
