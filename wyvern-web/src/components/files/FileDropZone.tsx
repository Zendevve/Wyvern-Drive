import { useCallback, useState, type ReactNode } from 'react'
import './FileDropZone.css'

interface FileDropZoneProps {
  onDrop: (files: FileList) => void
  children: ReactNode
}

export function FileDropZone({ onDrop, children }: FileDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    // Only set false if we're leaving the dropzone (not entering a child)
    if (e.currentTarget === e.target) {
      setIsDragging(false)
    }
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const { files } = e.dataTransfer
    if (files.length > 0) {
      onDrop(files)
    }
  }, [onDrop])

  return (
    <div
      className={`file-dropzone ${isDragging ? 'dragging' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {children}

      {isDragging && (
        <div className="dropzone-overlay">
          <div className="dropzone-content">
            <span className="dropzone-icon">📥</span>
            <h3>Drop files here</h3>
            <p>Release to upload</p>
          </div>
        </div>
      )}
    </div>
  )
}
