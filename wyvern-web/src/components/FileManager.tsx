import { useRef, useCallback, useState, useMemo, useEffect } from 'react'
import { useFileStore } from '../stores/fileStore'
import { FileDropZone } from './files/FileDropZone'
import { FileGrid } from './files/FileGrid'
import { Breadcrumb } from './files/Breadcrumb'
import { ShareModal } from './files/ShareModal'
import { PreviewModal } from './files/PreviewModal'
import { InfoSidebar } from './files/InfoSidebar'
import { SettingsModal } from './SettingsModal'
import { LayoutGrid, List as ListIcon, Filter, FolderPlus, UploadCloud, Info } from 'lucide-react'
import { isPreviewable } from '../lib/thumbnails'
import type { WyvernFile, WyvernFolder } from '../lib/types'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import './FileManager.css'

export function FileManager() {
  useKeyboardShortcuts() // Enable global keyboard shortcuts
  const { files, isLoading, uploadFiles, uploadFolder, previewFileId, setPreviewFile, activeModal, activeFileId, setActiveModal, selectedIds } = useFileStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [showInfoSidebar, setShowInfoSidebar] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get selected file for info sidebar (show first selected)
  const selectedFile = useMemo(() => {
    if (selectedIds.size === 0) return null
    const firstId = Array.from(selectedIds)[0]
    return Object.values(files).find(f => String(f.id) === firstId) as WyvernFile | WyvernFolder | null
  }, [selectedIds, files])

  // Handle Ctrl+V paste upload
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Don't intercept if user is typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const items = e.clipboardData?.items
      if (!items) return

      const files: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            // Generate a meaningful name for clipboard images
            const ext = file.type.split('/')[1] || 'png'
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
            const namedFile = new File([file], `pasted_${timestamp}.${ext}`, { type: file.type })
            files.push(namedFile)
          }
        }
      }

      if (files.length > 0) {
        e.preventDefault()
        // Create a FileList-like object
        const dataTransfer = new DataTransfer()
        files.forEach(f => dataTransfer.items.add(f))
        await uploadFiles(dataTransfer.files)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [uploadFiles])

  const activeFile = activeFileId
    ? (Object.values(files).find(f => String(f.id) === activeFileId) as WyvernFile)
    : null

  // Get list of previewable files for navigation
  const previewableFiles = useMemo(() => {
    return Object.values(files || {})
      .filter(f => f.type === 'file' && isPreviewable(f.name))
      .map(f => f as WyvernFile)
  }, [files])

  // Find current preview file and its index
  const previewFile = previewFileId
    ? Object.values(files).find(f => String(f.id) === previewFileId) as WyvernFile | undefined
    : null

  const currentPreviewIndex = previewFile
    ? previewableFiles.findIndex(f => f.id === previewFile.id)
    : -1

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (currentPreviewIndex === -1) return
    const newIndex = direction === 'prev'
      ? currentPreviewIndex - 1
      : currentPreviewIndex + 1
    if (newIndex >= 0 && newIndex < previewableFiles.length) {
      setPreviewFile(String(previewableFiles[newIndex].id))
    }
  }

  const handleDrop = useCallback(async (droppedFiles: FileList) => {
    // Check if any file has '/' in webkitRelativePath indicating folder structure
    const hasStructure = Array.from(droppedFiles).some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'))

    if (hasStructure) {
      await uploadFolder(droppedFiles)
    } else {
      await uploadFiles(droppedFiles)
    }
  }, [uploadFiles, uploadFolder])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      // FileList is iterable
      await uploadFiles(e.target.files)
    }
  }

  const triggerUpload = () => {
    fileInputRef.current?.click()
  }

  return (
    <div className="file-manager">
      <input
        type="file"
        multiple
        ref={fileInputRef}
        style={{ display: 'none' }}
        onChange={handleFileSelect}
      />

      {/* Context Bar: Breadcrumb + View Controls */}
      <div className="context-bar">
        <div className="context-left">
          <Breadcrumb />
        </div>
        <div className="context-right">
          <div className="view-toggle">
            <button
              className={`toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <ListIcon size={16} />
            </button>
            <button
              className={`toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>
          <button className="filter-btn" onClick={triggerUpload} title="Upload manually">
            <UploadCloud size={14} />
            <span>Upload</span>
          </button>
          <button className="filter-btn">
            <Filter size={14} />
            <span>Filter</span>
          </button>
          <button
            className={`filter-btn ${showInfoSidebar ? 'active' : ''}`}
            onClick={() => setShowInfoSidebar(!showInfoSidebar)}
            title="Toggle Info Panel"
          >
            <Info size={14} />
            <span>Info</span>
          </button>
        </div>
      </div>

      <FileDropZone onDrop={handleDrop}>
        {isLoading ? (
          <div className="loading-state">
            <div className="loader" />
          </div>
        ) : Object.keys(files).length === 0 ? (
          <div className="empty-state">
            <div className="empty-illustration">
              <FolderPlus size={48} strokeWidth={1} />
            </div>
            <h3>This folder is empty</h3>
            <p>Drag files here to upload</p>
            <button className="cta-button" onClick={triggerUpload} style={{ marginTop: 16 }}>
              Select Files
            </button>
          </div>
        ) : (
          <div className="file-content-area">
            <FileGrid files={files} viewMode={viewMode} />
          </div>
        )}
      </FileDropZone>

      {/* Info Sidebar */}
      {showInfoSidebar && (
        <InfoSidebar
          file={selectedFile}
          onClose={() => setShowInfoSidebar(false)}
        />
      )}

      {/* Preview Modal */}
      <PreviewModal
        file={previewFile || null}
        onClose={() => setPreviewFile(null)}
        onNavigate={handleNavigate}
        hasPrev={currentPreviewIndex > 0}
        hasNext={currentPreviewIndex < previewableFiles.length - 1}
      />

      {/* Share Modal */}
      {activeModal === 'share' && activeFile && (
        <ShareModal
          file={activeFile}
          onClose={() => setActiveModal(null)}
        />
      )}

      {/* Settings Modal */}
      <SettingsModal />

      {/* Status Bar */}
      <div className="status-bar">
        <span>{Object.keys(files).length} items</span>
        {useFileStore.getState().selectedIds.size > 0 && (
          <span> • {useFileStore.getState().selectedIds.size} selected</span>
        )}
      </div>
    </div>
  )
}

