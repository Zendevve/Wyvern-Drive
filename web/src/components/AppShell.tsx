import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useSelectionStore } from '../store/selection';
import { Sidebar } from './Sidebar/Sidebar';

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
        <div className="app-topbar-spacer" />
        <button type="button" className="app-account" onClick={handleLogout} title="Disconnect">
          <span className="app-account-avatar" aria-hidden>{initials}</span>
          <span>Disconnect</span>
        </button>
      </header>
      <Sidebar />
      <main className="app-main" role="main">
        {children}
      </main>
    </div>
  );
}
