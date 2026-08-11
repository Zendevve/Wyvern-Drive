import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ user: null, drive: null, loading: true });
  const location = useLocation();
  const navigate = useNavigate();

  const refresh = useCallback(async () => {
    try {
      const data = await api.me();
      setState((prev) => ({
        ...prev,
        user: data.user || null,
        drive: data.drive || null,
      }));
      return data.user || null;
    } catch {
      setState((prev) => ({ ...prev, user: null, drive: null }));
      return null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((data) => {
        if (cancelled) return;
        setState({
          user: data.user || null,
          drive: data.drive || null,
          loading: false,
        });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ user: null, drive: null, loading: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Route guard:
  //  - protected pages (/drive, /settings, /connect) require a session
  //  - a signed-in user with no connected storage is sent to /connect
  //  - a signed-in user with connected storage is sent to /drive
  // The OAuth callback redirects fresh users to /connect, so this guard also
  // runs on a fresh login and keeps them there until storage is configured.
  useEffect(() => {
    if (state.loading) {
      return;
    }
    const path = location.pathname;
    const isProtected =
      path === '/drive' ||
      path === '/settings' ||
      path === '/connect' ||
      path.startsWith('/drive/') ||
      path.startsWith('/settings/');
    if (!state.user) {
      if (isProtected) {
        navigate('/login', { replace: true });
      }
      return;
    }
    const needsConnect = !state.drive;
    if (path === '/login') {
      navigate(needsConnect ? '/connect' : '/drive', { replace: true });
    } else if (path === '/connect') {
      if (!needsConnect) {
        navigate('/drive', { replace: true });
      }
    } else if (needsConnect) {
      navigate('/connect', { replace: true });
    }
  }, [state.loading, state.user, state.drive, location.pathname, navigate]);

  const value = {
    user: state.user,
    drive: state.drive,
    loading: state.loading,
    refresh,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
