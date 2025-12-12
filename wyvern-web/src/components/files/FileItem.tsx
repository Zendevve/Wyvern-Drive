import { useState } from 'react'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import { useFileStore } from '../../stores/fileStore'
import { ContextMenu } from './ContextMenu'
import './FileItem.css'

interface FileItemProps {
  file: WyvernFile | WyvernFolder
  viewMode: 'grid' | 'list'
}

export function FileItem({ file, viewMode }: FileItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  const { moveFile } = useFileStore.getState() // Access store directly to avoid hook in loop?
  // Actually hook is better, but let's import it

  const isFolder = file.type === 'directory'
  const icon = isFolder ? '📁' : getFileIcon(file.name)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDoubleClick = () => {
    if (isFolder) {
      console.log('Navigate to:', file.path)
    } else {
      useFileStore.getState().downloadFile(String(file.id))
    }
  }

  // Drag Source
  const handleDragStart = (e: React.DragEvent) => {
    e.dataTransfer.setData('application/wyvern-file-id', String(file.id))
    e.dataTransfer.effectAllowed = 'move'
    // Optional: Set custom drag image
  }

  // Drop Target (Folders only)
  const handleDragOver = (e: React.DragEvent) => {
    if (!isFolder) return
    if (e.dataTransfer.types.includes('application/wyvern-file-id')) {
      e.preventDefault() // Allow drop
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
      // Trigger move action
      // We need to import useFileStore properly or pass the action down
      // For simplicity, let's use the hook at component level
      // Ensure parentId is number or null, handles root folder logic if needed
      moveFile(fileId, file.id)
    }
  }

  return (
    <>
      <div
        className={`file-item ${viewMode} ${isDragOver ? 'drag-over' : ''}`}
        draggable="true"
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        onDoubleClick={handleDoubleClick}
      >
        <span className="file-icon">{icon}</span>
        <span className="file-name">{file.name}</span>
        {viewMode === 'list' && !isFolder && (
          <>
            <span className="file-size">{formatSize((file as WyvernFile).size)}</span>
            <span className="file-date">{formatDate(file.updatedAt)}</span>
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

function getFileIcon(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() || ''
  const icons: Record<string, string> = {
    pdf: '📕', doc: '📄', docx: '📄', txt: '📝',
    jpg: '🖼️', jpeg: '🖼️', png: '🖼️', gif: '🖼️', webp: '🖼️',
    mp3: '🎵', wav: '🎵', flac: '🎵', ogg: '🎵',
    mp4: '🎬', mkv: '🎬', avi: '🎬', mov: '🎬',
    zip: '📦', rar: '📦', '7z': '📦', tar: '📦',
    js: '📜', ts: '📜', py: '🐍', rs: '🦀',
    exe: '⚙️', msi: '⚙️',
  }
  return icons[ext] || '📄'
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDate(isoDate: string): string {
  return new Date(isoDate).toLocaleDateString()
}
