import { useState, useEffect, memo } from 'react'
import type { WyvernFile, WyvernFolder, ChunkInfo, LegacyChunkInfo } from '../../lib/types'
import { normalizeChunk } from '../../lib/types'
import { useFileStore } from '../../stores/fileStore'
import {
  getCachedThumbnail,
  setCachedThumbnail,
  getLoadingPromise,
  setLoadingPromise
} from '../../lib/thumbnailCache'
import { ContextMenu } from './ContextMenu'
import { getFileIconName, formatSize, formatDate } from '../../lib/utils'
import { isPreviewable, isImageFile, isVideoFile } from '../../lib/thumbnails'
import { getMimeType } from '../../lib/mimeTypes'
import { decryptChunk, restoreEncryptionContext } from '../../lib/encryption'
import { decompressData } from '../../lib/compression'
import { fetchChunkWithRetry } from '../../lib/chunkFetcher'
import {
  Loader, Folder, File, FileText, Image, Music, Video, Archive, Code, Cog,
  AlertTriangle, Download, Share2, MoreHorizontal
} from 'lucide-react'
// Removed FileItem.css as we moved to Tailwind

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
  const [isUnavailable, setIsUnavailable] = useState(false)

  const isSelected = useFileStore(state => state.selectedIds.has(String(file.id)))
  const encryptionPassword = useFileStore(state => state.encryptionPassword)
  const toggleSelection = useFileStore(state => state.toggleSelection)
  const lastSelectedId = useFileStore(state => state.lastSelectedId)
  const setRangeSelection = useFileStore(state => state.setRangeSelection)
  const { moveFile, downloadFile, setActiveModal } = useFileStore.getState()

  const isFolder = file.type === 'directory'
  const isImage = !isFolder && isImageFile(file.name)
  const isVideo = !isFolder && isVideoFile(file.name)
  const iconName = isFolder ? 'Folder' : getFileIconName(file.name)
  const IconComponent = ICON_MAP[iconName] || File

  useEffect(() => {
    if (!isImage || viewMode !== 'grid') return

    const cachedUrl = getCachedThumbnail(String(file.id))
    if (cachedUrl) {
      setThumbnail(cachedUrl)
      return
    }

    if (thumbnail) return

    const wyvernFile = file as WyvernFile
    if (!wyvernFile.content) return

    const existingPromise = getLoadingPromise(String(file.id))
    if (existingPromise) {
      setIsLoadingThumb(true)
      existingPromise
        .then(url => setThumbnail(url))
        .catch(() => setIsUnavailable(true))
        .finally(() => setIsLoadingThumb(false))
      return
    }

    const loadThumbnail = async (): Promise<string> => {
      const rawChunks: (ChunkInfo | LegacyChunkInfo)[] = JSON.parse(wyvernFile.content!)
      const chunks = rawChunks.map(c => normalizeChunk(c))
      chunks.sort((a, b) => a.i - b.i)

      let decryptionKey: CryptoKey | null = null
      if (wyvernFile.encrypted && encryptionPassword && wyvernFile.encryption_salt) {
        decryptionKey = await restoreEncryptionContext(encryptionPassword, wyvernFile.encryption_salt)
      }

      const chunksToFetch = chunks.slice(0, 1)
      const fileParts: ArrayBuffer[] = []

      for (const chunk of chunksToFetch) {
        let data = await fetchChunkWithRetry(chunk)
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
      .finally(() => setIsLoadingThumb(false))
  }, [file.id, viewMode, isImage, isVideo, encryptionPassword, thumbnail])

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const { selectedIds, selectFile } = useFileStore.getState()
    if (!selectedIds.has(String(file.id))) {
      selectFile(String(file.id))
    }
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDoubleClick = () => {
    if (isFolder) {
      const { setCurrentPath, loadFiles } = useFileStore.getState()
      setCurrentPath(String(file.id))
      loadFiles()
    } else {

      // Check if previewable (Image, Video, Audio)
      if (isPreviewable(file.name)) {
        useFileStore.getState().setPreviewFile(String(file.id))
      } else {
        // Fallback to download
        useFileStore.getState().downloadFile(String(file.id))
      }
    }
  }

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (e.shiftKey && lastSelectedId) {
      e.preventDefault()
      setRangeSelection(lastSelectedId, String(file.id))
    } else if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      toggleSelection(String(file.id))
    } else {
      useFileStore.getState().selectFile(String(file.id))
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleDoubleClick()
    }
    if (e.key === ' ') {
      e.preventDefault()
      toggleSelection(String(file.id))
    }
  }

  const handleDragStart = (e: React.DragEvent) => {
    const { selectedIds } = useFileStore.getState()
    if (!selectedIds.has(String(file.id))) {
      useFileStore.getState().selectFile(String(file.id))
    }
    const currentSelectedIds = useFileStore.getState().selectedIds
    if (currentSelectedIds.size > 1) {
      e.dataTransfer.setData('application/wyvern-file-ids', JSON.stringify(Array.from(currentSelectedIds)))
    } else {
      e.dataTransfer.setData('application/wyvern-file-id', String(file.id))
    }
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return
    if (e.dataTransfer.types.includes('application/wyvern-file-id') || e.dataTransfer.types.includes('application/wyvern-file-ids')) {
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
    const batchIds = e.dataTransfer.getData('application/wyvern-file-ids')
    if (batchIds) {
      const ids: string[] = JSON.parse(batchIds)
      const idsToMove = ids.filter(id => id !== String(file.id))
      for (const id of idsToMove) {
        await moveFile(id, file.id)
      }
      useFileStore.getState().clearSelection()
      useFileStore.getState().loadFiles()
      return
    }
    const fileId = e.dataTransfer.getData('application/wyvern-file-id')
    if (fileId && fileId !== String(file.id)) {
      moveFile(fileId, file.id)
    }
  }

  // Styles based on state
  const gridClass = `flex flex-col p-4 bg-bg-card border rounded-xl relative cursor-pointer group hover:bg-bg-hover transition-all hover:shadow-lg hover:shadow-black/20 hover:border-border-active ${isSelected ? 'ring-2 ring-accent border-transparent z-10' : 'border-border-card'
    } ${isDragOver ? 'ring-2 ring-accent bg-accent/10' : ''}`

  const listClass = `flex items-center gap-4 px-4 py-3 border-b border-border-divider hover:bg-bg-hover cursor-pointer group transition-colors ${isSelected ? 'bg-accent/5' : ''
    } ${isDragOver ? 'bg-accent/10' : ''}`

  return (
    <>
      <div
        className={viewMode === 'grid' ? gridClass : listClass}
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
        {/* Grid Thumbnail/Icon */}
        {viewMode === 'grid' && (
          <div className="w-full aspect-square mb-3 flex items-center justify-center bg-black/20 rounded-lg overflow-hidden relative">
            {(isImage || isVideo) && thumbnail ? (
              <>
                <img src={thumbnail} alt={file.name} className="w-full h-full object-cover transition-transform group-hover:scale-105 duration-500" />
                {isVideo && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                    <Video size={24} className="text-white drop-shadow-md" />
                  </div>
                )}
              </>
            ) : (isImage || isVideo) && isLoadingThumb ? (
              <Loader size={24} className="text-[#52525B] animate-spin" />
            ) : (
              <IconComponent size={32} className={isFolder ? 'text-[#E4E4E7]' : 'text-[#71717A] group-hover:text-[#E4E4E7] transition-colors'} strokeWidth={1.5} />
            )}

            {/* Unavailable Badge */}
            {isUnavailable && (
              <div className="absolute top-2 right-2 p-1 bg-amber-500/10 rounded-full text-amber-500" title="File unavailable">
                <AlertTriangle size={12} />
              </div>
            )}

            {/* Quick Actions Overlay (appears on hover) */}
            {!isFolder && (
              <div className="absolute bottom-2 right-2 flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={(e) => { e.stopPropagation(); downloadFile(String(file.id)) }}
                  className="p-2 bg-black/70 hover:bg-accent rounded-lg text-white/80 hover:text-white transition-all backdrop-blur-sm"
                  title="Download"
                >
                  <Download size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setActiveModal('share', String(file.id)) }}
                  className="p-2 bg-black/70 hover:bg-accent rounded-lg text-white/80 hover:text-white transition-all backdrop-blur-sm"
                  title="Share"
                >
                  <Share2 size={14} />
                </button>
                <button
                  onClick={(e) => { e.stopPropagation(); setContextMenu({ x: e.clientX, y: e.clientY }) }}
                  className="p-2 bg-black/70 hover:bg-accent rounded-lg text-white/80 hover:text-white transition-all backdrop-blur-sm"
                  title="More actions"
                >
                  <MoreHorizontal size={14} />
                </button>
              </div>
            )}
          </div>
        )}

        {/* List Icon */}
        {viewMode === 'list' && (
          <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg bg-black/20 text-[#A1A1AA]">
            <IconComponent size={18} strokeWidth={1.5} />
          </div>
        )}

        {/* Info */}
        <div className={`flex-1 min-w-0 ${viewMode === 'list' ? 'flex items-center justify-between' : ''}`}>
          <div className="truncate text-sm font-medium text-[#E4E4E7] group-hover:text-white transition-colors mb-0.5">
            {file.name}
          </div>
          {viewMode === 'grid' && (
            <div className="flex items-center justify-between text-[10px] text-[#71717A]">
              <span>{isFolder ? 'Folder' : formatSize((file as WyvernFile).size)}</span>
              {/* Optional: Add modification date or context menu trigger here for mobile? */}
            </div>
          )}
          {viewMode === 'list' && !isFolder && (
            <div className="flex items-center gap-8 text-xs text-[#71717A]">
              <span className="w-20 text-right">{formatSize((file as WyvernFile).size)}</span>
              <span className="w-24 text-right hidden sm:block">{formatDate(file.updated_at)}</span>
            </div>
          )}
        </div>
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

export const FileItem = memo(FileItemComponent)
