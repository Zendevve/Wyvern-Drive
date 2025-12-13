import { useRef, useMemo, useCallback } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import type { WyvernFile, WyvernFolder } from '../../lib/types'
import { FileItem } from './FileItem'
import { useFileStore } from '../../stores/fileStore'
import './FileGrid.css'

interface VirtualFileGridProps {
  files: Record<string, WyvernFile | WyvernFolder>
  viewMode: 'grid' | 'list'
}

// Constants for virtualization
const ITEM_HEIGHT_GRID = 140  // Height of grid item including gap
const ITEM_HEIGHT_LIST = 48   // Height of list item including gap
const ITEMS_PER_ROW_GRID = 6  // Number of items per row in grid view (adjust based on container width)

/**
 * VirtualFileGrid - Virtualized file grid for handling 10k+ files
 * Only renders visible items to maintain smooth scrolling performance
 */
export function VirtualFileGrid({ files, viewMode }: VirtualFileGridProps) {
  const parentRef = useRef<HTMLDivElement>(null)
  const { clearSelection } = useFileStore.getState()

  // Sort items: folders first, then by name
  const sortedItems = useMemo(() => {
    return Object.values(files).sort((a, b) => {
      if (a.type !== b.type) return a.type === 'directory' ? -1 : 1
      return a.name.localeCompare(b.name)
    })
  }, [files])

  // Calculate row count based on view mode
  const rowCount = useMemo(() => {
    if (viewMode === 'list') {
      return sortedItems.length
    }
    // Grid mode: items per row based on container width
    return Math.ceil(sortedItems.length / ITEMS_PER_ROW_GRID)
  }, [sortedItems.length, viewMode])

  // Get item height based on view mode
  const itemHeight = viewMode === 'list' ? ITEM_HEIGHT_LIST : ITEM_HEIGHT_GRID

  // Virtual row configuration
  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan: 5, // Render 5 extra rows above/below viewport
  })

  // Get items for a specific row
  const getRowItems = useCallback((rowIndex: number) => {
    if (viewMode === 'list') {
      return [sortedItems[rowIndex]]
    }
    // Grid mode: get items for this row
    const startIdx = rowIndex * ITEMS_PER_ROW_GRID
    const endIdx = Math.min(startIdx + ITEMS_PER_ROW_GRID, sortedItems.length)
    return sortedItems.slice(startIdx, endIdx)
  }, [sortedItems, viewMode])

  // Handle background click to clear selection
  const handleBackgroundClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      clearSelection()
    }
  }

  return (
    <div
      ref={parentRef}
      className={`virtual-file-grid ${viewMode}`}
      style={{ height: '100%', overflow: 'auto' }}
      onClick={handleBackgroundClick}
    >
      <div
        className="virtual-grid-inner"
        style={{
          height: `${rowVirtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {rowVirtualizer.getVirtualItems().map((virtualRow) => {
          const rowItems = getRowItems(virtualRow.index)

          return (
            <div
              key={virtualRow.key}
              className={`virtual-row ${viewMode}`}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              {rowItems.map((item) => (
                <FileItem key={item.id} file={item} viewMode={viewMode} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}
