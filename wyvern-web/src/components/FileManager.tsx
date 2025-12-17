import { useRef, useCallback, useState, useMemo, useEffect } from 'react'
import { useFileStore } from '../stores/fileStore'
import { FileDropZone } from './files/FileDropZone'
import { FileGrid } from './files/FileGrid'
import { FileGridSkeleton } from './files/FileGridSkeleton'
import { FloatingActionBar } from './files/FloatingActionBar'
import { Breadcrumb } from './files/Breadcrumb'
import { ShareModal } from './files/ShareModal'
import { PreviewModal } from './files/PreviewModal'
import { InfoSidebar } from './files/InfoSidebar'
import { SettingsModal } from './SettingsModal'
import { LayoutGrid, List as ListIcon, FolderPlus, AlertCircle, RotateCcw, UploadCloud, Info } from 'lucide-react'
import { isPreviewable } from '../lib/thumbnails'
import type { WyvernFile, WyvernFolder } from '../lib/types'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'
// Tailwind-based styling

export function FileManager() {
  useKeyboardShortcuts() // Enable global keyboard shortcuts
  const { files, isLoading, error, loadFiles, uploadFiles, uploadFolder, previewFileId, setPreviewFile, activeModal, activeFileId, setActiveModal, selectedIds } = useFileStore()
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
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      const items = e.clipboardData?.items
      if (!items) return

      const fileList: File[] = []
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind === 'file') {
          const file = item.getAsFile()
          if (file) {
            const ext = file.type.split('/')[1] || 'png'
            const timestamp = new Date().toISOString().slice(0, 19).replace(/[:-]/g, '')
            const namedFile = new File([file], `pasted_${timestamp}.${ext}`, { type: file.type })
            fileList.push(namedFile)
          }
        }
      }

      if (fileList.length > 0) {
        e.preventDefault()
        const dataTransfer = new DataTransfer()
        fileList.forEach(f => dataTransfer.items.add(f))
        await uploadFiles(dataTransfer.files)
      }
    }

    document.addEventListener('paste', handlePaste)
    return () => document.removeEventListener('paste', handlePaste)
  }, [uploadFiles])

  const activeFile = activeFileId
    ? (Object.values(files).find(f => String(f.id) === activeFileId) as WyvernFile)
    : null

  const previewableFiles = useMemo(() => {
    return Object.values(files || {})
      .filter(f => f.type === 'file' && isPreviewable(f.name))
      .map(f => f as WyvernFile)
  }, [files])

  const previewFile = previewFileId
    ? Object.values(files).find(f => String(f.id) === previewFileId) as WyvernFile | undefined
    : null

  const currentPreviewIndex = previewFile
    ? previewableFiles.findIndex(f => f.id === previewFile.id)
    : -1

  const handleNavigate = (direction: 'prev' | 'next') => {
    if (currentPreviewIndex === -1) return
    const newIndex = direction === 'prev' ? currentPreviewIndex - 1 : currentPreviewIndex + 1
    if (newIndex >= 0 && newIndex < previewableFiles.length) {
      setPreviewFile(String(previewableFiles[newIndex].id))
    }
  }

  const handleDrop = useCallback(async (droppedFiles: FileList) => {
    const hasStructure = Array.from(droppedFiles).some(f => f.webkitRelativePath && f.webkitRelativePath.includes('/'))
    if (hasStructure) {
      await uploadFolder(droppedFiles)
    } else {
      await uploadFiles(droppedFiles)
    }
  }, [uploadFiles, uploadFolder])

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      await uploadFiles(e.target.files)
    }
  }

  const triggerUpload = () => fileInputRef.current?.click()

  return (
    <div className="flex flex-col h-full bg-bg-app">
      <input type="file" multiple ref={fileInputRef} style={{ display: 'none' }} onChange={handleFileSelect} />

      {/* Context Bar */}
      <div className="flex items-center justify-between py-4 min-h-[60px] mb-4 sticky top-0 z-10 bg-bg-app/80 backdrop-blur-md border-b border-border-divider/50">
        <div className="flex items-center overflow-hidden">
          <Breadcrumb />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center p-1 bg-bg-card border border-border-card rounded-lg">
            <button
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-main'}`}
              onClick={() => setViewMode('list')}
              title="List View"
            >
              <ListIcon size={16} />
            </button>
            <button
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-accent text-white shadow-sm' : 'text-text-secondary hover:text-text-main'}`}
              onClick={() => setViewMode('grid')}
              title="Grid View"
            >
              <LayoutGrid size={16} />
            </button>
          </div>

          <button className="flex items-center gap-2 px-3 py-2 bg-accent hover:bg-accent-hover text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-accent/20" onClick={triggerUpload}>
            <UploadCloud size={14} />
            <span className="hidden sm:inline">Upload</span>
          </button>

          <button
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${showInfoSidebar ? 'bg-accent/10 border-accent text-accent' : 'bg-bg-card border-border-card text-text-secondary hover:text-text-main hover:bg-bg-hover'}`}
            onClick={() => setShowInfoSidebar(!showInfoSidebar)}
            title="Toggle Info Panel"
          >
            <Info size={14} />
          </button>
        </div>
      </div>

      <FileDropZone onDrop={handleDrop} className="flex-1 relative">
        {isLoading ? (
          <FileGridSkeleton count={12} viewMode={viewMode} />
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center">
            <div className="text-red-500 mb-4 opacity-80">
              <AlertCircle size={48} strokeWidth={1} />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">Unable to load files</h3>
            <p className="text-[#A1A1AA] text-sm mb-6">{error}</p>
            <button onClick={() => loadFiles()} className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-lg transition-colors">
              <RotateCcw size={16} /> Retry Connection
            </button>
          </div>
        ) : Object.keys(files || {}).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-[50vh] text-center border-2 border-dashed border-[#2A2A2E] rounded-xl bg-[#141416]/50">
            <div className="text-[#52525B] mb-4">
              <FolderPlus size={48} strokeWidth={1} />
            </div>
            <h3 className="text-white font-medium mb-1">This folder is empty</h3>
            <p className="text-[#A1A1AA] text-sm mb-6">Drag files here to upload</p>
            <button onClick={triggerUpload} className="px-6 py-2 bg-white text-black font-medium rounded-lg hover:bg-white/90 transition-colors">
              Select Files
            </button>
          </div>
        ) : (
          <div className="min-h-full pb-20">
            <FileGrid files={files} viewMode={viewMode} />
          </div>
        )}
      </FileDropZone>

      {/* Info Sidebar */}
      {
        showInfoSidebar && (
          <InfoSidebar
            file={selectedFile}
            onClose={() => setShowInfoSidebar(false)}
          />
        )
      }

      {/* Preview, Share, Settings Modals */}
      <PreviewModal
        file={previewFile || null}
        onClose={() => setPreviewFile(null)}
        onNavigate={handleNavigate}
        hasPrev={currentPreviewIndex > 0}
        hasNext={currentPreviewIndex < previewableFiles.length - 1}
      />
      {
        activeModal === 'share' && activeFile && (
          <ShareModal file={activeFile} onClose={() => setActiveModal(null)} />
        )
      }
      <SettingsModal />

      {/* Floating Action Bar for multi-selection */}
      <FloatingActionBar />

      {/* Status Bar */}
      <div className="fixed bottom-0 left-64 right-0 h-8 flex items-center justify-between px-6 bg-bg-app border-t border-border-divider text-[10px] text-text-tertiary z-20">
        <span>{Object.keys(files || {}).length} items</span>
        {useFileStore.getState().selectedIds.size > 0 && (
          <span className="bg-white/10 px-2 py-0.5 rounded text-white/80">{useFileStore.getState().selectedIds.size} selected</span>
        )}
      </div>
    </div >
  )
}
