import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from './api.js';

const AuthContext = createContext(null);

// The session now lives in an httpOnly cookie, which JS cannot read — so the app
// asks the server who it is on boot instead of hydrating from localStorage.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Drop the pre-cookie session blob. It held a bcrypt hash on older builds.
    try { localStorage.removeItem('vv_user'); } catch {}

    let cancelled = false;
    api.get('/me')
      .then(({ data }) => { if (!cancelled) setUser(data.user); })
      .catch(() => { if (!cancelled) setUser(null); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback((u) => setUser(u), []);

  const logout = useCallback(async () => {
    try { await api.post('/logout'); } catch { /* clear locally regardless */ }
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
