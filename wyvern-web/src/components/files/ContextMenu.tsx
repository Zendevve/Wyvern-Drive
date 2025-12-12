import { useEffect, useRef } from 'react'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import './ContextMenu.css'

interface ContextMenuProps {
  x: number
  y: number
  file: WyvernFile | WyvernFolder
  onClose: () => void
}

export function ContextMenu({ x, y, file, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null)
  const isFolder = file.type === 'directory'

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('click', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('click', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const handleAction = (action: string) => {
    console.log(`${action}:`, file.name)
    onClose()
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
    >
      {!isFolder && (
        <button onClick={() => handleAction('download')}>
          <span>📥</span> Download
        </button>
      )}
      {isFolder && (
        <button onClick={() => handleAction('download-zip')}>
          <span>📦</span> Download as ZIP
        </button>
      )}
      <button onClick={() => handleAction('rename')}>
        <span>✏️</span> Rename
      </button>
      <button onClick={() => handleAction('move')}>
        <span>📂</span> Move to...
      </button>
      {!isFolder && (
        <button onClick={() => handleAction('share')}>
          <span>🔗</span> Share
        </button>
      )}
      {!isFolder && (
        <button onClick={() => handleAction('versions')}>
          <span>🕒</span> Version History
        </button>
      )}
      <div className="context-divider" />
      <button onClick={() => handleAction('delete')} className="danger">
        <span>🗑️</span> Delete
      </button>
    </div>
  )
}
