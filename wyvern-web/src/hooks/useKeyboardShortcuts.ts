import { useEffect } from 'react'
import { useFileStore } from '../stores/fileStore'

/**
 * Global keyboard shortcuts for file management.
 * - Delete: Delete selected files
 * - F2: Rename selected file (single selection only)
 * - Ctrl+A: Select all files
 * - Escape: Clear selection
 */
export function useKeyboardShortcuts() {
  const {
    selectedIds,
    selectAll,
    clearSelection,
    deleteSelected,
    setActiveModal
  } = useFileStore()

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in an input
      const target = e.target as HTMLElement
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) {
        return
      }

      // Delete key - delete selected files
      if (e.key === 'Delete' && selectedIds.size > 0) {
        e.preventDefault()
        if (confirm(`Delete ${selectedIds.size} selected item(s)?`)) {
          deleteSelected()
        }
      }

      // F2 - rename (single selection only)
      if (e.key === 'F2' && selectedIds.size === 1) {
        e.preventDefault()
        const fileId = Array.from(selectedIds)[0]
        setActiveModal('rename', fileId)
      }

      // Ctrl+A - select all
      if ((e.ctrlKey || e.metaKey) && e.key === 'a') {
        e.preventDefault()
        selectAll()
      }

      // Escape - clear selection
      if (e.key === 'Escape') {
        clearSelection()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [selectedIds, selectAll, clearSelection, deleteSelected, setActiveModal])
}
