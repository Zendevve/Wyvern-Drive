import { useEffect, useRef } from 'react'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import { useFileStore } from '../../stores/fileStore'
import { Download, Archive, Pencil, FolderInput, History, Trash2 } from 'lucide-react'
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

  const { downloadFile, downloadFolder, deleteFile, setActiveModal, selectedIds, deleteSelected, loadFiles, setCurrentPath, setPreviewFile } = useFileStore()

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      // If the click is inside the menu, do nothing. But wait, menu is portalled? No, it's inline.
      // e.target check needs to be robust.
      // If clicking context menu item, it fires action then closes.
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose()
      }
    }

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }

    document.addEventListener('mousedown', handleClickOutside) // mousedown is better than click to catch it early
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [onClose])

  const selectedCount = selectedIds.size
  const isMultiple = selectedCount > 1 && selectedIds.has(String(file.id))

  const handleAction = (action: string) => {
    // Capture selection state BEFORE any async operations or dialogs
    const currentSelectedCount = selectedIds.size
    const currentIsMultiple = currentSelectedCount > 1 && selectedIds.has(String(file.id))

    if (action === 'open') {
      if (isFolder) {
        setCurrentPath(String(file.id))
        loadFiles()
      } else {
        setPreviewFile(String(file.id))
      }
      onClose()
    } else if (action === 'download' && !isFolder && !currentIsMultiple) {
      downloadFile(String(file.id))
      onClose()
    } else if (action === 'download-zip' && isFolder && !currentIsMultiple) {
      downloadFolder(String(file.id))
      onClose()
    } else if (action === 'delete') {
      // Close menu FIRST, then show confirm
      onClose()
      // Use setTimeout to let menu close animation complete before confirm
      setTimeout(() => {
        if (currentIsMultiple) {
          if (confirm(`Are you sure you want to delete ${currentSelectedCount} items?`)) {
            deleteSelected()
          }
        } else {
          if (confirm(`Are you sure you want to delete ${file.name}?`)) {
            deleteFile(String(file.id))
          }
        }
      }, 10)
    } else if (action === 'rename' && !currentIsMultiple) {
      setActiveModal('rename', String(file.id))
      onClose()
    } else if (action === 'move') {
      if (currentIsMultiple) {
        setActiveModal('move', null)
      } else {
        setActiveModal('move', String(file.id))
      }
      onClose()
    } else if (action === 'versions' && !isFolder && !currentIsMultiple) {
      setActiveModal('versions', String(file.id))
      onClose()
    } else {
      onClose()
    }
  }

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {!isMultiple && (
        <button onClick={() => handleAction('open')}>
          <FolderInput size={14} /> Open
        </button>
      )}

      {!isMultiple && !isFolder && (
        <button onClick={() => handleAction('download')}>
          <Download size={14} /> Download
        </button>
      )}
      {!isMultiple && isFolder && (
        <button onClick={() => handleAction('download-zip')}>
          <Archive size={14} /> Download as ZIP
        </button>
      )}

      {!isMultiple && (
        <button onClick={() => handleAction('rename')}>
          <Pencil size={14} /> Rename
        </button>
      )}

      <button onClick={() => handleAction('move')}>
        <FolderInput size={14} /> {isMultiple ? `Move ${selectedCount} items...` : 'Move to...'}
      </button>

      {!isMultiple && !isFolder && (
        <button onClick={() => handleAction('versions')}>
          <History size={14} /> Version History
        </button>
      )}

      <div className="context-divider" />
      <button onClick={() => handleAction('delete')} className="danger">
        <Trash2 size={14} /> {isMultiple ? `Delete ${selectedCount} items` : 'Delete'}
      </button>
    </div>
  )
}
