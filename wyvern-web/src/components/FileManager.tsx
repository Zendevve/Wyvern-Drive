import { useCallback, useState } from 'react'
import { useFileStore } from '../stores/fileStore'
import { FileDropZone } from './files/FileDropZone'
import { FileGrid } from './files/FileGrid'
import { Toolbar } from './files/Toolbar'
import { Breadcrumb } from './files/Breadcrumb'
import './FileManager.css'

export function FileManager() {
  const { currentPath, files, isLoading } = useFileStore()
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const handleFileDrop = useCallback(async (droppedFiles: FileList) => {
    // TODO: Implement file upload
    console.log('Files dropped:', droppedFiles)
  }, [])

  return (
    <div className="file-manager">
      <Toolbar viewMode={viewMode} setViewMode={setViewMode} />
      <Breadcrumb path={currentPath} />

      <FileDropZone onDrop={handleFileDrop}>
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
      </FileDropZone>
    </div>
  )
}
