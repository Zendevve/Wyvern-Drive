import type { WyvernFile, WyvernFolder } from '../../lib/types'
import { FileItem } from './FileItem'
import './FileGrid.css'

interface FileGridProps {
  files: Record<string, WyvernFile | WyvernFolder>
  viewMode: 'grid' | 'list'
}

export function FileGrid({ files, viewMode }: FileGridProps) {
  const items = Object.values(files)

  // Sort: folders first, then by name
  const sortedItems = items.sort((a, b) => {
    if (a.type !== b.type) {
      return a.type === 'directory' ? -1 : 1
    }
    return a.name.localeCompare(b.name)
  })

  return (
    <div className={`file-grid ${viewMode}`}>
      {sortedItems.map((item) => (
        <FileItem key={item.id} file={item} viewMode={viewMode} />
      ))}
    </div>
  )
}
