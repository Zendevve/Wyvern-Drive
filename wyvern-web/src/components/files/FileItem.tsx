import { useState, useEffect } from 'react'
import type { WyvernFile, WyvernFolder, ChunkInfo } from '../../lib/types'
import { useFileStore } from '../../stores/fileStore'
import { ContextMenu } from './ContextMenu'
import { getFileIconName, formatSize, formatDate } from '../../lib/utils'
import { isPreviewable, isImageFile, isVideoFile, getMimeType } from '../../lib/thumbnails'
import { decryptChunk, restoreEncryptionContext } from '../../lib/encryption'
import { Loader, Folder, File, FileText, Image, Music, Video, Archive, Code, Cog } from 'lucide-react'
import './FileItem.css'

interface FileItemProps {
  file: WyvernFile | WyvernFolder
  viewMode: 'grid' | 'list'
}

export function FileItem({ file, viewMode }: FileItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [thumbnail, setThumbnail] = useState<string | null>(null)
  const [isLoadingThumb, setIsLoadingThumb] = useState(false)

  const { encryptionPassword, selectedIds, toggleSelection, lastSelectedId, setRangeSelection } = useFileStore()
  const { moveFile } = useFileStore.getState()

  const isSelected = selectedIds.has(String(file.id))

  const isFolder = file.type === 'directory'
  const isImage = !isFolder && isImageFile(file.name)
  const isVideo = !isFolder && isVideoFile(file.name)
  const iconName = isFolder ? 'Folder' : getFileIconName(file.name)

  // Icon component mapping
  const IconComponent = {
    Folder, File, FileText, Image, Music, Video, Archive, Code, Cog
  }[iconName] || File

  // Load thumbnail for images and videos in grid view
  useEffect(() => {
    if ((!isImage && !isVideo) || viewMode !== 'grid' || thumbnail) return

    const wyvernFile = file as WyvernFile
    if (!wyvernFile.content) return

    const loadThumbnail = async () => {
      setIsLoadingThumb(true)
      try {
        const chunks: ChunkInfo[] = JSON.parse(wyvernFile.content)
        chunks.sort((a, b) => a.index - b.index)

        // Get decryption key if encrypted
        let decryptionKey: CryptoKey | null = null
        if (wyvernFile.encrypted && encryptionPassword) {
          if (wyvernFile.encryption_salt) {
            decryptionKey = await restoreEncryptionContext(encryptionPassword, wyvernFile.encryption_salt)
          }
        }

        // Fetch chunks
        const fileParts: ArrayBuffer[] = []
        for (const chunk of chunks) {
          const data = await fetchViaExtension(chunk.url)

          if (wyvernFile.encrypted && decryptionKey && chunk.iv) {
            const iv = new Uint8Array(chunk.iv)
            const decrypted = await decryptChunk(data, decryptionKey, iv)
            fileParts.push(decrypted)
          } else {
            fileParts.push(data)
          }
        }

        // Create blob URL
        const blob = new Blob(fileParts, { type: getMimeType(wyvernFile.name) })

        if (isImage) {
          // Direct display for images
          const url = URL.createObjectURL(blob)
          setThumbnail(url)
        } else if (isVideo) {
          // Extract first frame for videos
          const videoUrl = URL.createObjectURL(blob)
          const thumbUrl = await extractVideoFrame(videoUrl)
          URL.revokeObjectURL(videoUrl)
          if (thumbUrl) {
            setThumbnail(thumbUrl)
          }
        }

      } catch (err) {
        console.error('Thumbnail load failed:', err)
      } finally {
        setIsLoadingThumb(false)
      }
    }

    loadThumbnail()

    return () => {
      if (thumbnail) {
        URL.revokeObjectURL(thumbnail)
      }
    }
  }, [file.id, viewMode, isImage, encryptionPassword])

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
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
      >
        {/* Thumbnail or Icon */}
        {viewMode === 'grid' && isImage && thumbnail ? (
          <div className="file-thumbnail">
            <img src={thumbnail} alt={file.name} />
          </div>
        ) : viewMode === 'grid' && isImage && isLoadingThumb ? (
          <div className="file-thumbnail loading">
            <Loader size={24} className="spinner" />
          </div>
        ) : (
          <span className="file-icon"><IconComponent size={viewMode === 'grid' ? 32 : 18} /></span>
        )}

        <span className="file-name">{file.name}</span>

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

// Fetch via extension to bypass CORS
async function fetchViaExtension(url: string): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const requestId = Math.random().toString(36).substring(7)

    const handleResponse = (event: MessageEvent) => {
      if (event.source !== window) return
      if (event.data.type === 'WYVERN_DOWNLOAD_RESPONSE' && event.data.id === requestId) {
        window.removeEventListener('message', handleResponse)

        if (event.data.error) {
          reject(new Error(event.data.error))
        } else if (event.data.data) {
          fetch(event.data.data)
            .then(res => res.arrayBuffer())
            .then(resolve)
            .catch(reject)
        } else {
          reject(new Error('Empty response'))
        }
      }
    }

    window.addEventListener('message', handleResponse)
    window.postMessage({ type: 'WYVERN_DOWNLOAD_REQUEST', url, id: requestId }, '*')

    setTimeout(() => {
      window.removeEventListener('message', handleResponse)
      reject(new Error('Thumbnail timeout'))
    }, 15000)
  })
}

// Extract first frame from video as thumbnail
async function extractVideoFrame(videoUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.muted = true

    video.onloadeddata = () => {
      video.currentTime = 1 // Seek to 1 second for better thumbnail
    }

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = 200
        canvas.height = 112 // 16:9 ratio

        const ctx = canvas.getContext('2d')
        if (!ctx) {
          resolve(null)
          return
        }

        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const thumbUrl = canvas.toDataURL('image/jpeg', 0.7)
        resolve(thumbUrl)
      } catch {
        resolve(null)
      }
    }

    video.onerror = () => {
      resolve(null)
    }

    // Timeout for video loading
    setTimeout(() => resolve(null), 10000)

    video.src = videoUrl
    video.load()
  })
}
