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

  const traverseFileTree = useCallback((item: FileSystemEntry, path = ''): Promise<File[]> => {
    return new Promise((resolve) => {
      if (item.isFile) {
        ; (item as FileSystemFileEntry).file((file) => {
          // Manually set webkitRelativePath for uploaded structure
          const newFile = new File([file], file.name, { type: file.type })
          Object.defineProperty(newFile, 'webkitRelativePath', {
            value: path ? path + '/' + file.name : file.name
          })
          resolve([newFile])
        })
      } else if (item.isDirectory) {
        const dirReader = (item as FileSystemDirectoryEntry).createReader()
        dirReader.readEntries(async (entries) => {
          const promiseList: Promise<File[]>[] = []
          for (const entry of entries) {
            promiseList.push(traverseFileTree(entry, path ? path + '/' + item.name : item.name))
          }
          const results = await Promise.all(promiseList)
          resolve(results.flat())
        })
      } else {
        resolve([])
      }
    })
  }, [])

  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    // Check if dropping files from OS
    if (e.dataTransfer.types.includes('Files')) {
      const items = e.dataTransfer.items
      if (!items) return

      const filePromises: Promise<File[]>[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i].webkitGetAsEntry()
        if (item) {
          filePromises.push(traverseFileTree(item))
        } else {
          // Fallback for standard files without entry support
          const file = items[i].getAsFile()
          if (file) filePromises.push(Promise.resolve([file]))
        }
      }

      const filesArray = (await Promise.all(filePromises)).flat()
      // Convert to FileList-like object if needed, or just pass array
      // Our store expects FileList (for input), but we can adapt it to Array<File>
      // Let's create a DataTransfer to generate a FileList
      const dataTransfer = new DataTransfer()
      filesArray.forEach(f => dataTransfer.items.add(f))

      if (filesArray.length > 0) {
        onDrop(dataTransfer.files)
      }
    }
  }, [onDrop, traverseFileTree])

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
