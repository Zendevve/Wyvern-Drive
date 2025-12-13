import { useFileStore } from '../../stores/fileStore'
import { Home, ChevronRight } from 'lucide-react'
import './Breadcrumb.css'

interface BreadcrumbProps {
  path: string
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  const { setCurrentPath, loadFiles } = useFileStore()

  // For now, path is just the folder ID
  // We need to track folder names for proper breadcrumb display
  // Simple approach: if path is empty, we're at root
  const isRoot = !path || path === ''

  const handleNavigateHome = () => {
    setCurrentPath('')
    loadFiles()
  }

  // TODO: For proper nested breadcrumbs, we'd need to track the navigation path
  // For now, just show Home and current folder

  return (
    <nav className="breadcrumb">
      <button
        className={`breadcrumb-item ${isRoot ? 'active' : ''}`}
        onClick={handleNavigateHome}
      >
        <Home size={14} />
        <span>Home</span>
      </button>

      {!isRoot && (
        <>
          <ChevronRight size={14} className="breadcrumb-separator" />
          <span className="breadcrumb-item active">
            Current Folder
          </span>
        </>
      )}
    </nav>
  )
}
