import { useEffect, useState } from 'react'
import { useFileStore } from '../../stores/fileStore'
import type { FileVersion } from '../../lib/types'
import { formatSize, formatDate } from '../../lib/utils'
import './VersionHistoryModal.css'

export function VersionHistoryModal() {
  const { activeModal, activeFileId, setActiveModal, getVersions, restoreVersion, deleteVersion, files } = useFileStore()
  const [versions, setVersions] = useState<FileVersion[]>([])
  const [loading, setLoading] = useState(false)

  const isOpen = activeModal === 'versions'
  const file = activeFileId ? Object.values(files).find(f => String(f.id) === activeFileId) : null

  useEffect(() => {
    if (isOpen && activeFileId) {
      loadVersions()
    }
  }, [isOpen, activeFileId])

  const loadVersions = async () => {
    if (!activeFileId) return
    setLoading(true)
    try {
      const list = await getVersions(activeFileId)
      setVersions(list)
    } finally {
      setLoading(false)
    }
  }

  const handleRestore = async (versionId: number) => {
    if (!confirm('Are you sure?Current file content will be saved as a new version.')) return
    await restoreVersion(String(versionId))
    setActiveModal(null)
  }

  const handleDelete = async (versionId: number) => {
    if (!confirm('Delete this version permanently?')) return
    await deleteVersion(String(versionId))
    loadVersions()
  }

  if (!isOpen || !file) return null

  return (
    <div className="modal-overlay" onClick={() => setActiveModal(null)}>
      <div className="modal-content version-modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Version History: {file.name}</h2>
          <button className="close-btn" onClick={() => setActiveModal(null)}>×</button>
        </div>

        <div className="versions-list">
          {loading ? (
            <div className="loading">Loading versions...</div>
          ) : versions.length === 0 ? (
            <div className="empty-versions">No previous versions found.</div>
          ) : (
            versions.map(v => (
              <div key={v.id} className="version-item">
                <div className="version-info">
                  <span className="version-num">v{v.version_number}</span>
                  <span className="version-date">{formatDate(v.created_at)}</span>
                  <span className="version-size">{formatSize(v.size)}</span>
                </div>
                <div className="version-actions">
                  <button className="btn-restore" onClick={() => handleRestore(v.id)}>Restore</button>
                  <button className="btn-delete" onClick={() => handleDelete(v.id)}>Delete</button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
