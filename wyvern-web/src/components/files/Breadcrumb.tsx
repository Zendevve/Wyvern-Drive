import { useFileStore } from '../../stores/fileStore'
import { FILE_DELIMITER } from '../../lib/types'
import './Breadcrumb.css'

interface BreadcrumbProps {
  path: string
}

export function Breadcrumb({ path }: BreadcrumbProps) {
  const { setCurrentPath } = useFileStore()

  const parts = path ? path.split(FILE_DELIMITER).filter(Boolean) : []

  const handleNavigate = (index: number) => {
    if (index === -1) {
      setCurrentPath('')
    } else {
      const newPath = FILE_DELIMITER + parts.slice(0, index + 1).join(FILE_DELIMITER)
      setCurrentPath(newPath)
    }
  }

  return (
    <nav className="breadcrumb">
      <button
        className="breadcrumb-item"
        onClick={() => handleNavigate(-1)}
      >
        🏠 Home
      </button>

      {parts.map((part, index) => (
        <span key={index} className="breadcrumb-segment">
          <span className="breadcrumb-separator">/</span>
          <button
            className="breadcrumb-item"
            onClick={() => handleNavigate(index)}
          >
            {part}
          </button>
        </span>
      ))}
    </nav>
  )
}
