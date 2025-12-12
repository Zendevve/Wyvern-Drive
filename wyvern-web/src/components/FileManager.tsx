import { useCallback, useState } from 'react'
import { useFileStore } from '../stores/fileStore'
import { FileDropZone } from './files/FileDropZone'
import { FileGrid } from './files/FileGrid'
import { Toolbar } from './files/Toolbar'
import { Breadcrumb } from './files/Breadcrumb'
import './FileManager.css'

export function FileManager() {
  const { currentPath, files, isLoading, uploadFiles, uploadFolder } = useFileStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const handleDrop = useCallback(async (droppedFiles: FileList) => {
    // Check if any file has '/' in webkitRelativePath indicating folder structure
    const hasStructure = Array.from(droppedFiles).some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'))

    if (hasStructure) {
      await uploadFolder(droppedFiles)
    } else {
      await uploadFiles(droppedFiles)
    }
  }, [uploadFiles, uploadFolder])

  return (
    <div className="file-manager">
      <FileDropZone onDrop={handleDrop}>
        <div className="toolbar-container">
          <Toolbar viewMode={viewMode} setViewMode={setViewMode} />
        </div>

        <div className="breadcrumbs-container">
          <Breadcrumb path={currentPath} />
        </div>

        <div className="file-view">
          {isLoading ? (
            <div className="loading-state">
              <div className="loader" />
              <p>Loading files...</p>
            </div>
          ) : Object.keys(files).length === 0 ? (
            <div className="empty-state">
              <span className="empty-icon">📂</span>
              <h3>No files yet</h3>
              <p>Drop files here or click "Upload" to get started</p>
            </div>
          ) : (
            <FileGrid files={files} viewMode={viewMode} />
          )}
        </div>
      </FileDropZone>
    </div>
  )
}
