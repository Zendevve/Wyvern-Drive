import { useState } from 'react'
import { useFileStore } from '../../stores/fileStore'
import './MoveModal.css'

export function MoveModal() {
  const { activeModal, activeFileId, setActiveModal, moveFile, files } = useFileStore()
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null) // null = root

  const isOpen = activeModal === 'move' && activeFileId

  if (!isOpen) return null

  const fileToMove = Object.values(files).find(f => String(f.id) === String(activeFileId))
  if (!fileToMove) return null

  // Helper to build tree for selection
  // TODO: This should probably be in a helper or selector
  const buildTree = (parentId: number | null = null, depth = 0): JSX.Element[] => {
    const nodes: JSX.Element[] = []
    Object.values(files)
      .filter(f => f.type === 'directory' && f.parentId === parentId) // Assuming flat files list has parentId
      .forEach(folder => {
        // Prevent moving into self or children
        if (String(folder.id) === String(activeFileId)) return

        nodes.push(
          <div
            key={folder.id}
            className={`folder-item ${selectedFolderId === folder.id ? 'selected' : ''}`}
            style={{ paddingLeft: `${depth * 20 + 12}px` }}
            onClick={() => setSelectedFolderId(folder.id)}
          >
            📁 {folder.name}
          </div>
        )
        nodes.push(...buildTree(folder.id, depth + 1))
      })
    return nodes
  }

  const handleMove = async () => {
    try {
      await moveFile(activeFileId!, selectedFolderId)
      setActiveModal(null)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setActiveModal(null)}>
      <div className="modal-content move-modal" onClick={e => e.stopPropagation()}>
        <h3>Move {fileToMove.name}</h3>
        <div className="folder-tree">
          <div
            className={`folder-item ${selectedFolderId === null ? 'selected' : ''}`}
            onClick={() => setSelectedFolderId(null)}
          >
            🏠 Root
          </div>
          {buildTree(null, 0)}
        </div>
        <div className="modal-actions">
          <button onClick={() => setActiveModal(null)}>Cancel</button>
          <button className="primary" onClick={handleMove}>Move Here</button>
        </div>
      </div>
    </div>
  )
}
