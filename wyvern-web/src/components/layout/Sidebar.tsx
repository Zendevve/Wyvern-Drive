
import {
  Home,
  Cloud,
  Clock,
  Star,
  Trash2,
  Plus,
  LogOut
} from 'lucide-react'
import { useFileStore } from '../../stores/fileStore'
import './Sidebar.css'

export function Sidebar() {
  const { logout } = useFileStore()

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
          {/* TODO: Connect this to upload trigger globally? */}
          <button className="new-button">
            <Plus size={18} strokeWidth={2.5} />
            <span>New</span>
          </button>
        </div>

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
