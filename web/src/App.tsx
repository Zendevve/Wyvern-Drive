import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { AuthPage } from './pages/AuthPage';
import { DrivePage } from './pages/DrivePage';
import { ToastHost } from './components/Toast';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const status = useAuthStore((s) => s.status);
  if (status === 'unknown') {
    return <div className="splash" aria-busy />;
  }
  if (status !== 'authenticated') {
    return <AuthPage />;
  }
  return <>{children}</>;
}

export function App() {
  const restore = useAuthStore((s) => s.restore);
  const status = useAuthStore((s) => s.status);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    void restore().finally(() => setReady(true));
  }, [restore]);

  if (!ready) {
    return <div className="splash" aria-busy />;
  }

  return (
    <>
      {status === 'authenticated' ? <AppShell /> : <AuthPage />}
      <ToastHost />
    </>
  );
}

function AppShell() {
  return (
    <PrivateRoute>
      <DriveRoute />
    </PrivateRoute>
  );
}

function DriveRoute() {
  const { folderId } = useParams<{ folderId?: string }>();
  const navigate = useNavigate();
  if (folderId === 'setup' || folderId === 'auth') {
    navigate('/', { replace: true });
    return null;
  }
  return <DrivePage parentId={folderId ?? null} />;
}

export { Link };
