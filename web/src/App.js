import React, { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import theme from './theme';
import { AuthProvider } from './auth/AuthProvider';
import UploadProvider from './upload/UploadProvider';
import { api } from './api/client';
import ScreenLoader from './components/ScreenLoader';
import LoginPage from './pages/LoginPage';
import DrivePage from './pages/DrivePage';
import SharePage from './pages/SharePage';
import SettingsPage from './pages/SettingsPage';
import SetupPage from './pages/SetupPage';
import TrashPage from './pages/TrashPage';
import WebhookSetupPage from './pages/WebhookSetupPage';

/**
 * First-run gate: calls GET /api/setup/status before AuthProvider mounts so an
 * unconfigured server never redirects anonymous users into a broken /login
 * flow. When setup is required (or the status call fails), every route
 * resolves to /setup; once the server reports a complete configuration, the
 * normal route tree renders unchanged.
 */
function SetupGate({ children }) {
  const [state, setState] = useState({ phase: 'loading', status: null });
  const location = useLocation();

  const refresh = useCallback(() => {
    setState({ phase: 'loading', status: null });
    api
      .setupStatus()
      .then((status) => setState({ phase: 'done', status: status || null }))
      .catch(() => setState({ phase: 'error', status: null }));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (state.phase === 'loading') {
    return <ScreenLoader />;
  }

  if (state.phase === 'error') {
    if (location.pathname === '/setup') {
      return <SetupPage status={null} onRetry={refresh} />;
    }
    return <Navigate to="/setup" replace />;
  }

  if (state.status && state.status.setupRequired) {
    if (location.pathname === '/setup') {
      return <SetupPage status={state.status} onRetry={refresh} />;
    }
    return <Navigate to="/setup" replace />;
  }

  return children;
}

export default function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <BrowserRouter>
        <SetupGate>
          <AuthProvider>
            <UploadProvider>
            <Routes>
              {/* Reached only when setup is complete; /setup lives at /login. */}
              <Route path="/setup" element={<Navigate to="/login" replace />} />
              <Route path="/login" element={<LoginPage />} />
              <Route path="/connect" element={<WebhookSetupPage />} />
              <Route path="/drive" element={<DrivePage />} />
              <Route path="/trash" element={<TrashPage />} />
              <Route path="/settings" element={<SettingsPage />} />
              <Route path="/share/:token" element={<SharePage />} />
              <Route path="*" element={<Navigate to="/drive" replace />} />
            </Routes>
            </UploadProvider>
          </AuthProvider>
        </SetupGate>
      </BrowserRouter>
    </ThemeProvider>
  );
}
