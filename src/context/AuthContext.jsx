import { createContext, useContext, useCallback, useEffect, useState } from 'react';
import { auth as authApi } from '../api/endpoints';
import { tokenStore } from '../api/client';
import { useToast } from './ToastContext';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const toast = useToast();
  // status: 'loading' | 'authed' | 'anon'
  const [status, setStatus] = useState(tokenStore.access ? 'loading' : 'anon');
  const [user, setUser] = useState(null);
  const [staff, setStaff] = useState(null);
  const [permissions, setPermissions] = useState([]);

  const loadMe = useCallback(async () => {
    if (!tokenStore.access) {
      setStatus('anon');
      return;
    }
    try {
      const me = await authApi.me();
      if (me.type === 'staff') {
        setStaff(me.staff);
        setUser(null);
        setPermissions(me.staff?.permissions || []);
      } else {
        setUser(me.user);
        setStaff(null);
        setPermissions([]);
      }
      setStatus('authed');
    } catch {
      tokenStore.clear();
      setStatus('anon');
    }
  }, []);

  useEffect(() => {
    loadMe();
  }, [loadMe]);

  useEffect(() => {
    const onExpired = () => {
      setStatus('anon');
      setUser(null);
      setStaff(null);
      setPermissions([]);
      toast.info('Your session expired. Please sign in again.');
    };
    window.addEventListener('cv:auth-expired', onExpired);
    return () => window.removeEventListener('cv:auth-expired', onExpired);
  }, [toast]);

  const login = useCallback(async (creds) => {
    const res = await authApi.login(creds);
    tokenStore.set(res);
    setUser(res.user);
    setStaff(null);
    setPermissions([]);
    setStatus('authed');
    return res;
  }, []);

  const staffLogin = useCallback(async (creds) => {
    const res = await authApi.staffLogin(creds);
    tokenStore.set(res);
    setStaff(res.staff);
    setUser(null);
    setPermissions(res.staff?.permissions || []);
    setStatus('authed');
    return res;
  }, []);

  const register = useCallback(async (body) => {
    const res = await authApi.register(body);
    tokenStore.set(res);
    setUser(res.user);
    setStatus('authed');
    return res;
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setUser(null);
    setStaff(null);
    setPermissions([]);
    setStatus('anon');
  }, []);

  const value = {
    status,
    user,
    staff,
    permissions,
    isCustomer: status === 'authed' && !!user,
    isStaff: status === 'authed' && !!staff,
    can: (perm) => permissions.includes(perm),
    login,
    staffLogin,
    register,
    logout,
    reload: loadMe,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
