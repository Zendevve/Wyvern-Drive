import { NavLink } from 'react-router-dom';
import { useStorageStats } from '../../hooks/useStorageStats';
import { StorageGauge } from './StorageGauge';
import { CategoryBreakdown } from './CategoryBreakdown';

export function Sidebar() {
  const { data: stats } = useStorageStats();

  const totalBytes = stats?.totalBytes ?? 0;
  const categories = stats?.categories ?? {
    documents: 0,
    images: 0,
    videos: 0,
    audio: 0,
    others: 0
  };

  return (
    <aside className="app-sidebar" role="navigation" aria-label="Primary">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="sidebar-brand-logo" aria-hidden="true">
          <svg
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            {/* Left Claw Prong */}
            <path d="M 6 4 C 8 8 7 14 3 20" />
            <path d="M 3 20 C 5 18 8 16 10 15" />
            {/* Middle Claw Prong */}
            <path d="M 12 2 C 13 8 12 14 8 22" />
            <path d="M 8 22 C 10 19 13 17 16 16" />
            {/* Right Claw Prong */}
            <path d="M 18 3 C 18 9 17 15 13 21" />
            <path d="M 13 21 C 15 19 18 18 21 18" />
          </svg>
        </div>
        <div className="sidebar-brand-text">
          <span className="brand-title">ARTANO</span>
          <span className="brand-subtitle">WYVERN DRIVE</span>
        </div>
      </div>

      {/* Main Navigation Links */}
      <nav className="sidebar-nav">
        <NavLink
          to="/drive"
          end
          className={({ isActive }) => `sidebar-nav-item${isActive ? ' is-active' : ''}`}
        >
          <div className="sidebar-nav-indicator" />
          <svg
            className="sidebar-nav-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
          </svg>
          <span className="sidebar-nav-label">My Drive</span>
        </NavLink>

        <button
          type="button"
          className="sidebar-nav-item"
          disabled
          aria-disabled="true"
          title="Recent (Coming Soon)"
        >
          <div className="sidebar-nav-indicator" />
          <svg
            className="sidebar-nav-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <circle cx="12" cy="12" r="9" />
            <path d="M12 7v5l3 2" />
          </svg>
          <span className="sidebar-nav-label">Recent</span>
        </button>

        <button
          type="button"
          className="sidebar-nav-item"
          disabled
          aria-disabled="true"
          title="Trash (Coming Soon)"
        >
          <div className="sidebar-nav-indicator" />
          <svg
            className="sidebar-nav-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M4 7h16l-1 13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 7z" />
            <path d="M9 7V4h6v3" />
          </svg>
          <span className="sidebar-nav-label">Trash</span>
        </button>

        <NavLink
          to="/activity"
          className={({ isActive }) => `sidebar-nav-item${isActive ? ' is-active' : ''}`}
        >
          <div className="sidebar-nav-indicator" />
          <svg
            className="sidebar-nav-icon"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 8v4l3 2" />
            <circle cx="12" cy="12" r="9" />
            <path d="M4 12h2" />
            <path d="M18 12h2" />
            <path d="M12 4v2" />
            <path d="M12 18v2" />
          </svg>
          <span className="sidebar-nav-label">Activity</span>
        </NavLink>
      </nav>

      {/* Storage Gauge & Widgets */}
      <div className="sidebar-footer">
        <StorageGauge totalBytes={totalBytes} />
        <CategoryBreakdown categories={categories} />
      </div>
    </aside>
  );
}
