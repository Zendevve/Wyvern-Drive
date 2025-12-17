/**
 * FileGridSkeleton - Skeleton loader for file grid
 * Shows animated placeholders while files are loading
 */

interface FileGridSkeletonProps {
  count?: number
  viewMode?: 'grid' | 'list'
}

export function FileGridSkeleton({ count = 12, viewMode = 'grid' }: FileGridSkeletonProps) {
  if (viewMode === 'list') {
    return (
      <div className="flex flex-col gap-2 p-4">
        {Array.from({ length: count }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border-divider animate-pulse">
            {/* Icon placeholder */}
            <div className="w-8 h-8 rounded-lg bg-bg-input" />
            {/* Name placeholder */}
            <div className="flex-1">
              <div className="h-4 bg-bg-input rounded w-3/4" />
            </div>
            {/* Size placeholder */}
            <div className="h-3 bg-bg-input rounded w-16" />
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 p-6">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="flex flex-col p-4 bg-bg-card border border-border-card rounded-xl animate-pulse"
        >
          {/* Thumbnail placeholder */}
          <div className="w-full aspect-square mb-3 bg-bg-input rounded-lg" />
          {/* Name placeholder */}
          <div className="h-4 bg-bg-input rounded w-full mb-2" />
          {/* Size placeholder */}
          <div className="h-3 bg-bg-input rounded w-1/2" />
        </div>
      ))}
    </div>
  )
}
