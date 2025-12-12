import { useState, useEffect } from 'react'
import { useFileStore } from '../../stores/fileStore'
import './RenameModal.css'

export function RenameModal() {
  const { activeModal, activeFileId, setActiveModal, renameFile, files } = useFileStore()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isOpen = activeModal === 'rename' && activeFileId

  useEffect(() => {
    if (isOpen && activeFileId) {
      const file = Object.values(files).find(f => String(f.id) === String(activeFileId))
      if (file) setName(file.name)
    }
  }, [isOpen, activeFileId, files])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return

    try {
      await renameFile(activeFileId!, name)
      setActiveModal(null)
    } catch (err) {
      setError('Failed to rename')
    }
  }

  return (
    <div className="modal-overlay" onClick={() => setActiveModal(null)}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h3>Rename</h3>
        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
          {error && <p className="error">{error}</p>}
          <div className="modal-actions">
            <button type="button" onClick={() => setActiveModal(null)}>Cancel</button>
            <button type="submit" className="primary">Rename</button>
          </div>
        </form>
      </div>
    </div>
  )
}
