'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { setToken } from './api';
import { authApi } from '@/modules/auth/api';
import type { AuthUser } from './types';

const USER_KEY = 'dafater-user';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (userId: string, pin: string) => Promise<void>;
  logout: () => void;
  can: (view: string) => boolean;
  syncUser: (patch: Partial<AuthUser>) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
    if (raw) {
      try {
        setUser(JSON.parse(raw));
      } catch {
        /* ignore */
      }
    }
    setLoading(false);
  }, []);

  const login = async (username: string, password: string) => {
    const res = await authApi.login({ username, password });
    setToken(res.token);
    localStorage.setItem(USER_KEY, JSON.stringify(res.user));
    setUser(res.user);
  };

  const logout = () => {
    setToken(null);
    localStorage.removeItem(USER_KEY);
    setUser(null);
  };

  const can = (view: string) => !!user && (user.admin || user.views.includes(view));

  const syncUser = (patch: Partial<AuthUser>) => {
    setUser((prev) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(next));
      return next;
    });
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, can, syncUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
