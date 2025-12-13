import { useRef, useCallback, useState, useMemo } from 'react'
import { useFileStore } from '../stores/fileStore'
import { FileDropZone } from './files/FileDropZone'
import { FileGrid } from './files/FileGrid'
import { Breadcrumb } from './files/Breadcrumb'
import { PreviewModal } from './files/PreviewModal'
import { LayoutGrid, List as ListIcon, Filter, FolderPlus, UploadCloud } from 'lucide-react'
import { isPreviewable } from '../lib/thumbnails'
import type { WyvernFile } from '../lib/types'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
import './FileManager.css'

export function FileManager() {
  useKeyboardShortcuts() // Enable global keyboard shortcuts
  const { currentPath, files, isLoading, uploadFiles, uploadFolder, previewFileId, setPreviewFile } = useFileStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Get list of previewable files for navigation
  const previewableFiles = useMemo(() => {
    return Object.values(files)
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
          <Breadcrumb path={currentPath} />
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

      {/* Preview Modal */}
      <PreviewModal
        file={previewFile || null}
        onClose={() => setPreviewFile(null)}
        onNavigate={handleNavigate}
        hasPrev={currentPreviewIndex > 0}
        hasNext={currentPreviewIndex < previewableFiles.length - 1}
      />
    </div>
  )
}
