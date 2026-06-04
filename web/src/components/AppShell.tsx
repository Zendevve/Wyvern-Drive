import { useMemo } from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useSelectionStore } from '../store/selection';
import { Button } from './Button';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const accountId = useAuthStore((s) => s.accountId);
  const logout = useAuthStore((s) => s.logout);
  const clearSelection = useSelectionStore((s) => s.clear);
  const navigate = useNavigate();

  const initials = useMemo(() => {
    if (!accountId) return '?';
    return accountId.slice(0, 2).toUpperCase();
  }, [accountId]);

  function handleLogout() {
    clearSelection();
    logout();
    navigate('/', { replace: true });
  }

  return (
    <div className="app-shell">
      <header className="app-topbar" role="banner">
        <Link to="/drive" className="app-brand">
          <span className="app-brand-mark" aria-hidden />
          <span>Wyvern Drive</span>
        </Link>
        <div className="app-topbar-spacer" />
        <button type="button" className="app-account" onClick={handleLogout} title="Disconnect">
          <span className="app-account-avatar" aria-hidden>{initials}</span>
          <span>Disconnect</span>
        </button>
        <Button variant="ghost" onClick={handleLogout} aria-label="Log out" className="visually-hidden">
          Logout
        </Button>
      </header>
      <aside className="app-rail" role="navigation" aria-label="Primary">
        <NavLink to="/drive" end className={({ isActive }) => `app-rail-item${isActive ? ' is-active' : ''}`}>
          <RailIcon name="drive" />
          <span>Drive</span>
        </NavLink>
        <button type="button" className="app-rail-item" disabled aria-disabled>
          <RailIcon name="recent" />
          <span>Recent</span>
        </button>
        <button type="button" className="app-rail-item" disabled aria-disabled>
          <RailIcon name="trash" />
          <span>Trash</span>
        </button>
      </aside>
      <main className="app-main" role="main">
        {children}
      </main>
    </div>
  );
}

function RailIcon({ name }: { name: 'drive' | 'recent' | 'trash' }) {
  const common = { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
  if (name === 'drive') {
    return (
      <svg {...common}>
        <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
      </svg>
    );
  }
  if (name === 'recent') {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 7v5l3 2" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <path d="M4 7h16l-1 13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2L4 7z" />
      <path d="M9 7V4h6v3" />
    </svg>
  );
}
