import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export function useAuthActions() {
  const { user, login, logout, loading } = useAuth();
  const navigate = useNavigate();

  const handleLogin = useCallback(
    async (email: string, password: string) => {
      await login(email, password);
      navigate('/');
    },
    [login, navigate]
  );

  const handleLogout = useCallback(() => {
    logout();
    navigate('/login');
  }, [logout, navigate]);

  return {
    user,
    loading,
    isAuthenticated: !!user,
    login: handleLogin,
    logout: handleLogout,
  };
}
