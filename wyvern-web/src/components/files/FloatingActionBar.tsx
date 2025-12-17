/**
 * FloatingActionBar - Bottom action bar that appears when files are selected
 * Shows bulk actions for selected files
 */

import { Download, Share2, FolderInput, Trash2, X } from 'lucide-react'
import { useFileStore } from '../../stores/fileStore'

export function FloatingActionBar() {
  const selectedIds = useFileStore(state => state.selectedIds)
  const clearSelection = useFileStore(state => state.clearSelection)
  const { downloadFile, deleteFile, setActiveModal } = useFileStore.getState()

  const count = selectedIds.size

  if (count === 0) return null

  const handleDownloadAll = async () => {
    for (const id of selectedIds) {
      downloadFile(id)
    }
  }

  const handleShareFirst = () => {
    const firstId = Array.from(selectedIds)[0]
    if (firstId) {
      setActiveModal('share', firstId)
    }
  }

  const handleMoveAll = () => {
    const firstId = Array.from(selectedIds)[0]
    if (firstId) {
      setActiveModal('move', firstId)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm(`Delete ${count} selected item${count > 1 ? 's' : ''}? This cannot be undone.`)) {
      return
    }
    for (const id of selectedIds) {
      await deleteFile(id)
    }
    clearSelection()
  }

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-4 fade-in duration-200">
      <div className="flex items-center gap-3 px-5 py-3 bg-bg-card border border-border-card rounded-2xl shadow-2xl shadow-black/40 backdrop-blur-xl">
        {/* Selection count */}
        <div className="flex items-center gap-2 pr-3 border-r border-border-divider">
          <span className="text-sm font-medium text-text-main">{count}</span>
          <span className="text-sm text-text-secondary">selected</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          <button
            onClick={handleDownloadAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-text-main hover:bg-bg-hover transition-colors"
            title="Download all"
          >
            <Download size={18} />
            <span className="text-sm hidden sm:inline">Download</span>
          </button>

          {count === 1 && (
            <button
              onClick={handleShareFirst}
              className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-text-main hover:bg-bg-hover transition-colors"
              title="Share"
            >
              <Share2 size={18} />
              <span className="text-sm hidden sm:inline">Share</span>
            </button>
          )}

          <button
            onClick={handleMoveAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-text-secondary hover:text-text-main hover:bg-bg-hover transition-colors"
            title="Move to folder"
          >
            <FolderInput size={18} />
            <span className="text-sm hidden sm:inline">Move</span>
          </button>

          <button
            onClick={handleDeleteAll}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-status-error hover:bg-status-error/10 transition-colors"
            title="Delete"
          >
            <Trash2 size={18} />
            <span className="text-sm hidden sm:inline">Delete</span>
          </button>
        </div>

        {/* Close button */}
        <button
          onClick={clearSelection}
          className="ml-2 p-2 rounded-lg text-text-tertiary hover:text-text-main hover:bg-bg-hover transition-colors"
          title="Clear selection"
        >
          <X size={18} />
        </button>
      </div>
    </div>
  )
}
