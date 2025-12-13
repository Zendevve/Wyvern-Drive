import { useState, useRef } from 'react'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import { FileItem } from './FileItem'
import { VirtualFileGrid } from './VirtualFileGrid'
import { useFileStore } from '../../stores/fileStore'
import './FileGrid.css'

interface FileGridProps {
  files: Record<string, WyvernFile | WyvernFolder>
  viewMode: 'grid' | 'list'
}

export function FileGrid({ files, viewMode }: FileGridProps) {
  const items = Object.values(files)
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

  // Sort: folders first, then by name
  const sortedItems = items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  // Mouse handlers for drag selection
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only left click, and only on background (not if target is file item)
    if (e.button !== 0) return
    if ((e.target as HTMLElement).closest('.file-item')) return

    // Start selection
    setIsSelecting(true)
    didDrag.current = false
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect) return

    const startX = e.clientX - rect.left
    const startY = e.clientY - rect.top

    setSelectionBox({
      startX,
      startY,
      currentX: startX,
      currentY: startY
    })

    // Clear previous selection unless shift/ctrl pressed
    if (!e.shiftKey && !e.ctrlKey && !e.metaKey) {
      clearSelection()
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isSelecting || !selectionBox || !containerRef.current) return

    const rect = containerRef.current.getBoundingClientRect()
    const currentX = e.clientX - rect.left
    const currentY = e.clientY - rect.top

    // Check if moved significantly to consider it a drag
    if (!didDrag.current && (Math.abs(currentX - selectionBox.startX) > 5 || Math.abs(currentY - selectionBox.startY) > 5)) {
      didDrag.current = true
    }

    setSelectionBox(prev => prev ? { ...prev, currentX, currentY } : null)
  }

  const handleMouseUp = () => {
    if (isSelecting && didDrag.current && selectionBox && containerRef.current) {
      // Finalize selection logic
      const boxLeft = Math.min(selectionBox.startX, selectionBox.currentX)
      const boxTop = Math.min(selectionBox.startY, selectionBox.currentY)
      const boxWidth = Math.abs(selectionBox.currentX - selectionBox.startX)
      const boxHeight = Math.abs(selectionBox.currentY - selectionBox.startY)

      const fileItems = containerRef.current.querySelectorAll('.file-item')
      fileItems.forEach(item => {
        const itemRect = (item as HTMLElement).getBoundingClientRect()
        const containerRect = containerRef.current!.getBoundingClientRect()

        const itemLeft = itemRect.left - containerRect.left
        const itemTop = itemRect.top - containerRect.top

        // Check intersection (AABB)
        if (
          boxLeft < itemLeft + itemRect.width &&
          boxLeft + boxWidth > itemLeft &&
          boxTop < itemTop + itemRect.height &&
          boxTop + boxHeight > itemTop
        ) {
          const id = (item as HTMLElement).getAttribute('data-id')
          if (id) {
            const store = useFileStore.getState()
            // Add to selection if not already selected
            if (!store.selectedIds.has(id)) {
              store.toggleSelection(id)
            }
          }
        }
      })
    }

    setIsSelecting(false)
    setSelectionBox(null)

    // Allow queue to drain before resetting didDrag so click handler can see it
    setTimeout(() => { didDrag.current = false }, 0)
  }

  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && !didDrag.current) {
      clearSelection()
    }
  }

  // Calculate box style
  const boxStyle = selectionBox ? {
    left: Math.min(selectionBox.startX, selectionBox.currentX),
    top: Math.min(selectionBox.startY, selectionBox.currentY),
    width: Math.abs(selectionBox.currentX - selectionBox.startX),
    height: Math.abs(selectionBox.currentY - selectionBox.startY)
  } : {}

  return (
    <div
      className={`file-grid ${viewMode}`}
      ref={containerRef}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onClick={handleBackgroundClick}
    >
      {sortedItems.map((item) => (
        <FileItem key={item.id} file={item} viewMode={viewMode} />
      ))}

      {isSelecting && selectionBox && (
        <div className="selection-box" style={boxStyle} />
      )}
    </div>
  )
}
