import { useFileStore } from '../../stores/fileStore'
import { Home, ChevronRight } from 'lucide-react'
import './Breadcrumb.css'

export function Breadcrumb() {
  const { currentPath, breadcrumbs, setCurrentPath, loadFiles } = useFileStore()

  const handleNavigate = (path: string) => {
    setCurrentPath(path)
    loadFiles()
  }

  const isRoot = !currentPath || currentPath === ''

  return (
    <nav className="breadcrumb">
      <button
        className={`breadcrumb-item ${isRoot ? 'active' : ''}`}
        onClick={() => handleNavigate('')}
      >
        <Home size={14} />
        <span>Home</span>
      </button>

      {breadcrumbs.map((crumb, index) => (
        <div key={crumb.id} className="breadcrumb-segment">
          <ChevronRight size={14} className="breadcrumb-separator" />
          <button
            className={`breadcrumb-item ${index === breadcrumbs.length - 1 ? 'active' : ''}`}
            onClick={() => handleNavigate(crumb.id)}
          >
            {crumb.name}
          </button>
        </div>
      ))}
    </nav>
  )
}
