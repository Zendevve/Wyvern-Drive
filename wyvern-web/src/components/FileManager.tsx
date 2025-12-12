import { useRef, useCallback, useState } from 'react'
import { useFileStore } from '../stores/fileStore'
import { FileDropZone } from './files/FileDropZone'
import { FileGrid } from './files/FileGrid'
import { Breadcrumb } from './files/Breadcrumb'
import { LayoutGrid, List as ListIcon, Filter, FolderPlus, UploadCloud } from 'lucide-react'
import './FileManager.css'

export function FileManager() {
  const { currentPath, files, isLoading, uploadFiles, uploadFolder } = useFileStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const fileInputRef = useRef<HTMLInputElement>(null)

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
    </div>
  )
}
