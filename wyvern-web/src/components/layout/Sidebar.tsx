import { useFileStore } from '../../stores/fileStore'
import './Sidebar.css'

export function Sidebar() {
  const { logout, currentPath } = useFileStore()

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <h1 className="sidebar-logo">🐉 Wyvern</h1>
      </div>

      <nav className="sidebar-nav">
        <button className="nav-item active">
          <span className="nav-icon">📁</span>
          <span>My Files</span>
        </button>
        <button className="nav-item">
          <span className="nav-icon">⭐</span>
          <span>Starred</span>
        </button>
        <button className="nav-item">
          <span className="nav-icon">🕒</span>
          <span>Recent</span>
        </button>
        <button className="nav-item">
          <span className="nav-icon">🗑️</span>
          <span>Trash</span>
        </button>
      </nav>

      <div className="sidebar-footer">
        <div className="storage-info">
          <div className="storage-bar">
            <div className="storage-used" style={{ width: '35%' }} />
          </div>
          <span className="storage-text">Storage: Unlimited ✨</span>
        </div>

        <button className="logout-button" onClick={logout}>
          Disconnect
        </button>
      </div>
    </aside>
  )
}
