import { useState, useEffect } from 'react'
import type { WyvernFile, WyvernFolder, ChunkInfo } from '../../lib/types'
import { useFileStore } from '../../stores/fileStore'
import { ContextMenu } from './ContextMenu'
import { getFileIcon, formatSize, formatDate } from '../../lib/utils'
import { isPreviewable, isImageFile, getMimeType } from '../../lib/thumbnails'
import { decryptChunk, restoreEncryptionContext } from '../../lib/encryption'
import { Loader } from 'lucide-react'
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

  const { encryptionPassword } = useFileStore()
  const { moveFile } = useFileStore.getState()

  const isFolder = file.type === 'directory'
  const isImage = !isFolder && isImageFile(file.name)
  const icon = isFolder ? '📁' : getFileIcon(file.name)

  // Load thumbnail for images in grid view
  useEffect(() => {
    if (!isImage || viewMode !== 'grid' || thumbnail) return

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
        const url = URL.createObjectURL(blob)
        setThumbnail(url)

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
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDoubleClick = () => {
    if (isFolder) {
      console.log('Navigate to:', file.path)
    } else if (isPreviewable(file.name)) {
      useFileStore.getState().setPreviewFile(String(file.id))
    } else {
      useFileStore.getState().downloadFile(String(file.id))
    }
  }

  // Drag Source
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/wyvern-file-id', String(file.id))
    e.dataTransfer.effectAllowed = 'move'
  }

  // Drop Target (Folders only)
  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return
    if (e.dataTransfer.types.includes('application/wyvern-file-id')) {
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

  const handleDrop = (e: React.DragEvent) => {
    if (!isFolder) return
    e.preventDefault()
    e.stopPropagation()
    setIsDragOver(false)

    const fileId = e.dataTransfer.getData('application/wyvern-file-id')
    if (fileId && fileId !== String(file.id)) {
      moveFile(fileId, file.id)
    }
  }

  return (
    <>
      <div
        className={`file-item ${viewMode} ${isDragOver ? 'drag-over' : ''} ${isImage && thumbnail ? 'has-thumbnail' : ''}`}
        draggable="true"
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
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
          <span className="file-icon">{icon}</span>
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
