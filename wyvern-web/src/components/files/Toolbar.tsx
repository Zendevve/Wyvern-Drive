import { useRef } from 'react'
import './Toolbar.css'

interface ToolbarProps {
  viewMode: 'grid' | 'list'
  setViewMode: (mode: 'grid' | 'list') => void
}

export function Toolbar({ viewMode, setViewMode }: ToolbarProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleUploadFile = () => {
    fileInputRef.current?.click()
  }

  const handleUploadFolder = () => {
    folderInputRef.current?.click()
  }

  const handleNewFolder = () => {
    // TODO: Create folder modal
    console.log('Create new folder')
  }

  return (
    <div className="toolbar">
      <div className="toolbar-left">
        <button className="toolbar-btn primary" onClick={handleUploadFile}>
          <span>📤</span> Upload File
        </button>
        <button className="toolbar-btn" onClick={handleUploadFolder}>
          <span>📁</span> Upload Folder
        </button>
        <button className="toolbar-btn" onClick={handleNewFolder}>
          <span>➕</span> New Folder
        </button>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => console.log('Files:', e.target.files)}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is non-standard but widely supported
          webkitdirectory=""
          style={{ display: 'none' }}
          onChange={(e) => console.log('Folder:', e.target.files)}
        />
      </div>

      <div className="toolbar-right">
        <div className="view-toggle">
          <button
            className={viewMode === 'grid' ? 'active' : ''}
            onClick={() => setViewMode('grid')}
            title="Grid view"
          >
            ⊞
          </button>
          <button
            className={viewMode === 'list' ? 'active' : ''}
            onClick={() => setViewMode('list')}
            title="List view"
          >
            ☰
          </button>
        </div>
      </div>
    </div>
  )
}
