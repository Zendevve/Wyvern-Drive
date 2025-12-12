import { useState } from 'react'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import { ContextMenu } from './ContextMenu'
import './FileItem.css'

interface FileItemProps {
  file: WyvernFile | WyvernFolder
  viewMode: 'grid' | 'list'
}

export function FileItem({ file, viewMode }: FileItemProps) {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  const isFolder = file.type === 'directory'
  const icon = isFolder ? '📁' : getFileIcon(file.name)

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault()
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  const handleDoubleClick = () => {
    if (isFolder) {
      // TODO: Navigate to folder
      console.log('Navigate to:', file.path)
    } else {
      // TODO: Download file
      console.log('Download:', file.name)
    }
  }

  return (
    <>
      <div
        className={`file-item ${viewMode}`}
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
