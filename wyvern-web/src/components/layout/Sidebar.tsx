import { useRef, useState } from 'react'
import {
  Home,
  Cloud,
  Clock,
  Star,
  Trash2,
  Plus,
  LogOut,
  FileUp,
  FolderUp
} from 'lucide-react'
import { useFileStore } from '../../stores/fileStore'
import './Sidebar.css'

export function Sidebar() {
  const { logout, uploadFiles, uploadFolder } = useFileStore()
  const [isMenuOpen, setIsMenuOpen] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const folderInputRef = useRef<HTMLInputElement>(null)

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFiles(e.target.files)
      // Reset input
      e.target.value = ''
    }
    setIsMenuOpen(false)
  }

  const handleFolderSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await uploadFolder(e.target.files)
      e.target.value = ''
    }
    setIsMenuOpen(false)
  }

  return (
    <aside className="sidebar">
      {/* 1. App Logo / Home */}
      <div className="sidebar-header">
        <span className="app-logo">Wyvern</span>
        <span className="app-badge">Drive</span>
      </div>

      <div className="sidebar-content">
        {/* 2. Primary Action Button */}
        <div className="action-section">
          <div className="new-button-wrapper">
            <button
              className={`new-button ${isMenuOpen ? 'active' : ''}`}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              <Plus size={18} strokeWidth={2.5} />
              <span>New</span>
            </button>

            {isMenuOpen && (
              <div className="new-menu-dropdown">
                <button className="menu-item" onClick={() => fileInputRef.current?.click()}>
                  <FileUp size={16} />
                  <span>File upload</span>
                </button>
                <button className="menu-item" onClick={() => folderInputRef.current?.click()}>
                  <FolderUp size={16} />
                  <span>Folder upload</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Hidden Inputs */}
        <input
          type="file"
          ref={fileInputRef}
          multiple
          hidden
          onChange={handleFileSelect}
        />
        <input
          type="file"
          ref={folderInputRef}
          multiple
          hidden
          // @ts-ignore - webkitdirectory is non-standard but required
          webkitdirectory=""
          // @ts-ignore
          directory=""
          onChange={handleFolderSelect}
        />

        {/* 3. Navigation Links */}
        <nav className="nav-section">
          <div className="nav-label">Locations</div>
          <button className="nav-item active">
            <Home size={18} className="nav-icon" />
            <span>Home Drive</span>
          </button>
          <button className="nav-item">
            <Cloud size={18} className="nav-icon" />
            <span>Shared with me</span>
          </button>

          <div className="nav-label mt-4">Smart Views</div>
          <button className="nav-item">
            <Clock size={18} className="nav-icon" />
            <span>Recent</span>
          </button>
          <button className="nav-item">
            <Star size={18} className="nav-icon" />
            <span>Starred</span>
          </button>
          <button className="nav-item">
            <Trash2 size={18} className="nav-icon" />
            <span>Trash</span>
          </button>
        </nav>
      </div>

      {/* 4. Storage & User Profile */}
      <div className="sidebar-footer">
        <div className="storage-meter">
          <div className="storage-text">
            <span>Storage</span>
            <span>7.2 GB / 15 GB</span>
          </div>
          <div className="meter-track">
            <div className="meter-fill" style={{ width: '45%' }} />
          </div>
        </div>

        <div className="user-profile">
          <div className="user-avatar" />
          <div className="user-info">
            <span className="username">User1234</span>
          </div>
          <button onClick={logout} className="logout-btn" title="Logout">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )
}
