import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api, authStorage } from '../services/api';

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  setupRequired: boolean;
  login: (username: string, password: string) => Promise<void>;
  initSetup: (username: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);

  const checkStatusAndUser = async () => {
    setIsLoading(true);
    try {
      const statusRes = await api.getSetupStatus();
      if (statusRes.setupRequired) {
        setSetupRequired(true);
        setUser(null);
        setIsLoading(false);
        return;
      }

      setSetupRequired(false);
      const token = authStorage.getToken();
      if (token) {
        try {
          const meRes = await api.getMe();
          setUser(meRes.user);
        } catch {
          authStorage.clearToken();
          setUser(null);
        }
      } else {
        setUser(null);
      }
    } catch (e) {
      console.error('Failed to initialize auth state:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    checkStatusAndUser();

    const handleUnauthorized = () => {
      setUser(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await api.login(username, password);
    authStorage.setToken(res.token);
    setUser(res.user);
  };

  const initSetup = async (username: string, password: string) => {
    const res = await api.initSetup(username, password);
    authStorage.setToken(res.token);
    setUser(res.user);
    setSetupRequired(false);
  };

  const logout = () => {
    authStorage.clearToken();
    setUser(null);
  };

  const refreshUser = async () => {
    if (authStorage.getToken()) {
      const meRes = await api.getMe();
      setUser(meRes.user);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        setupRequired,
        login,
        initSetup,
        logout,
        refreshUser
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
};
