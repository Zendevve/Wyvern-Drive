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

  // Route guard: protected pages require a session; /login is for anonymous.
  useEffect(() => {
    if (state.loading) {
      return;
    }
    const isProtected =
      location.pathname === '/drive' ||
      location.pathname === '/settings' ||
      location.pathname.startsWith('/drive/') ||
      location.pathname.startsWith('/settings/');
    if (!state.user && isProtected) {
      navigate('/login', { replace: true });
    } else if (state.user && location.pathname === '/login') {
      navigate('/drive', { replace: true });
    }
  }, [state.loading, state.user, location.pathname, navigate]);

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
