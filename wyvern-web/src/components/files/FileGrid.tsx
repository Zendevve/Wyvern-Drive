import { useState, useRef, useCallback } from 'react'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import { FileItem } from './FileItem'
import { VirtualFileGrid } from './VirtualFileGrid'
import { useFileStore } from '../../stores/fileStore'
import { useFilteredFiles } from '../../hooks/useFilteredFiles'
// Removed FileGrid.css

interface FileGridProps {
  files: Record<string, WyvernFile | WyvernFolder>
  viewMode: 'grid' | 'list'
}

export function FileGrid({ files, viewMode }: FileGridProps) {
  const { files: filteredFiles, hasFilter } = useFilteredFiles()
  const items = hasFilter ? filteredFiles : Object.values(files)
  const { clearSelection } = useFileStore.getState()

  // Use virtualized grid for large file counts (500+ items)
  const VIRTUALIZATION_THRESHOLD = 500
  if (items.length > VIRTUALIZATION_THRESHOLD) {
    return <VirtualFileGrid files={files} viewMode={viewMode} />
  }

  const containerRef = useRef<HTMLDivElement>(null)
  const [isSelecting, setIsSelecting] = useState(false)
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null)
  const didDrag = useRef(false)

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    // Ignore clicks on file items themselves (let their handlers work)
    if ((e.target as HTMLElement).closest('[role="button"]')) return

    setIsSelecting(true)
    didDrag.current = false
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const startX = e.clientX - rect.left + containerRef.current!.scrollLeft
    const startY = e.clientY - rect.top + containerRef.current!.scrollTop

    setSelectionBox({
      startX,
      startY,
      currentX: startX,
      currentY: startY
    })

    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      clearSelection()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionBox || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const currentX = e.clientX - rect.left + containerRef.current.scrollLeft
    const currentY = e.clientY - rect.top + containerRef.current.scrollTop

    if (!didDrag.current && (Math.abs(currentX - selectionBox.startX) > 5 || Math.abs(currentY - selectionBox.startY) > 5)) {
      didDrag.current = true
    }

    setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null)
  }

  const handleMouseUp = () => {
    if (isSelecting && didDrag.current && selectionBox && containerRef.current) {
      const boxLeft = Math.min(selectionBox.startX, selectionBox.currentX)
      const boxTop = Math.min(selectionBox.startY, selectionBox.currentY)
      const boxWidth = Math.abs(selectionBox.currentX - selectionBox.startX)
      const boxHeight = Math.abs(selectionBox.currentY - selectionBox.startY)

      const fileItems = containerRef.current.querySelectorAll('[role="button"]')
      fileItems.forEach(item => {
        const itemRect = (item as HTMLElement).getBoundingClientRect()
        const containerRect = containerRef.current!.getBoundingClientRect()

        // Calculate item position relative to container, accounting for scroll
        const itemLeft = itemRect.left - containerRect.left + containerRef.current!.scrollLeft
        const itemTop = itemRect.top - containerRect.top + containerRef.current!.scrollTop

        if (
          boxLeft < itemLeft + itemRect.width &&
          boxLeft + boxWidth > itemLeft &&
          boxTop < itemTop + itemRect.height &&
          boxTop + boxHeight > itemTop
        ) {
          const id = (item as HTMLElement).getAttribute('data-id')
          if (id) {
            const store = useFileStore.getState()
            if (!store.selectedIds.has(id)) {
              store.toggleSelection(id)
            }
          }
        }
      })
    }

    setIsSelecting(false)
    setSelectionBox(null)
    setTimeout(() => { didDrag.current = false }, 0)
  }

  const handleBackgroundClick = (e: React.MouseEvent) => {
    // Only clear if we clicked background and didn't drag
    if (e.target === e.currentTarget && !didDrag.current) {
      clearSelection()
    }
  }

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) return

    e.preventDefault()
    const fileItems = containerRef.current?.querySelectorAll('[role="button"]') as NodeListOf<HTMLElement>
    if (!fileItems || fileItems.length === 0) return

    const currentIndex = Array.from(fileItems).findIndex(el => el === document.activeElement)
    let newIndex = currentIndex
    const itemsPerRow = viewMode === 'grid' ? 6 : 1 // Approximate for grid

    switch (e.key) {
      case 'ArrowRight': newIndex = Math.min(currentIndex + 1, fileItems.length - 1); break
      case 'ArrowLeft': newIndex = Math.max(currentIndex - 1, 0); break
      case 'ArrowDown': newIndex = Math.min(currentIndex + itemsPerRow, fileItems.length - 1); break
      case 'ArrowUp': newIndex = Math.max(currentIndex - itemsPerRow, 0); break
      case 'Home': newIndex = 0; break;
      case 'End': newIndex = fileItems.length - 1; break;
    }

    if (newIndex !== currentIndex && newIndex >= 0) {
      fileItems[newIndex].focus()
      const id = fileItems[newIndex].getAttribute('data-id')
      if (id) useFileStore.getState().selectFile(id)
    }
  }, [viewMode])

  return (
    <>
      {/* Accessibility: Announce file count to screen readers */}
      <div
        className="sr-only"
        role="status"
        aria-live="polite"
        aria-atomic="true"
      >
        {hasFilter
          ? `Showing ${items.length} filtered ${items.length === 1 ? 'item' : 'items'}`
          : `${items.length} ${items.length === 1 ? 'item' : 'items'} in current folder`
        }
      </div>

      <div
        className={`relative min-h-[calc(100vh-140px)] focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background-base ${viewMode === 'grid'
          ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 content-start'
          : 'flex flex-col gap-1'
          }`}
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onClick={handleBackgroundClick}
        onKeyDown={handleKeyDown}
        role="grid"
        tabIndex={0}
        aria-label={`File list, ${items.length} items`}
      >
        {items.map((item) => (
          <FileItem key={item.id} file={item} viewMode={viewMode} />
        ))}

        {isSelecting && selectionBox && (
          <div
            className="absolute bg-blue-500/20 border border-blue-500/50 z-50 pointer-events-none"
            style={{
              left: Math.min(selectionBox.startX, selectionBox.currentX),
              top: Math.min(selectionBox.startY, selectionBox.currentY),
              width: Math.abs(selectionBox.currentX - selectionBox.startX),
              height: Math.abs(selectionBox.currentY - selectionBox.startY)
            }}
          />
        )}
      </div>
    </>
  )
}
