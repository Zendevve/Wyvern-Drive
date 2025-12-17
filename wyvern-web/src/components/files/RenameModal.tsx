import { useState, useEffect } from 'react'
import { useFileStore } from '../../stores/fileStore'
import { useFocusTrap } from '../../hooks/useFocusTrap'
import './RenameModal.css'

export function RenameModal() {
  const { activeModal, activeFileId, setActiveModal, renameFile, files } = useFileStore()
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const isOpen = activeModal === 'rename' && activeFileId
  const focusTrapRef = useFocusTrap(!!isOpen, () => setActiveModal(null))

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
      <div
        className="modal-content"
        onClick={e => e.stopPropagation()}
        ref={focusTrapRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rename-modal-title"
      >
        <h3 id="rename-modal-title">Rename File</h3>
        <form onSubmit={handleSubmit}>
          <label htmlFor="rename-input" className="input-label">
            New name
          </label>
          <input
            id="rename-input"
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
            aria-invalid={!!error}
            aria-describedby={error ? "rename-error" : undefined}
          />
          {error && (
            <div className="error" role="alert">
              <span className="error-icon" aria-hidden="true">⚠</span>
              <p id="rename-error">{error}</p>
            </div>
          )}
          <div className="modal-actions">
            <button type="button" onClick={() => setActiveModal(null)}>Cancel</button>
            <button type="submit" className="primary">Rename</button>
          </div>
        </form>
      </div>
    </div>
  )
}
