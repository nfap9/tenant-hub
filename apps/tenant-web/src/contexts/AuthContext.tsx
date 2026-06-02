import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  type ReactNode,
} from 'react';
import api from '@/lib/api';

interface User {
  id: string;
  name: string;
  email: string;
  phone?: string;
  platformRole: string;
  permissions: string[];
}

interface AuthState {
  user: User | null;
  token: string | null;
  orgId: string | null;
  loading: boolean;
}

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  setOrgId: (orgId: string) => void;
  hasPermission: (permission: string) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>(() => {
    const token = localStorage.getItem('token');
    const orgId = localStorage.getItem('orgId');
    return {
      user: null,
      token,
      orgId,
      loading: !!token,
    };
  });

  useEffect(() => {
    if (state.token && !state.user) {
      api
        .get('/auth/me')
        .then((res) => {
          setState((prev) => ({
            ...prev,
            user: res.data.data ?? res.data,
            loading: false,
          }));
        })
        .catch(() => {
          localStorage.removeItem('token');
          setState({ user: null, token: null, orgId: null, loading: false });
        });
    } else if (!state.token) {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, [state.token]);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    const { token, user } = res.data.data ?? res.data;
    localStorage.setItem('token', token);
    setState({ user, token, orgId: null, loading: false });
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    localStorage.removeItem('orgId');
    setState({ user: null, token: null, orgId: null, loading: false });
  }, []);

  const setOrgId = useCallback((orgId: string) => {
    localStorage.setItem('orgId', orgId);
    setState((prev) => ({ ...prev, orgId }));
  }, []);

  const hasPermission = useCallback(
    (permission: string) => {
      if (!state.user) return false;
      if (state.user.platformRole === 'SUPER_ADMIN') return true;
      const perms = state.user.permissions ?? [];
      return perms.includes('*') || perms.includes(permission);
    },
    [state.user]
  );

  return (
    <AuthContext.Provider
      value={{ ...state, login, logout, setOrgId, hasPermission }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export function useHasPermission(permission: string) {
  const { hasPermission } = useAuth();
  return hasPermission(permission);
}
