'use client';

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { setToken } from './api';
import { authApi } from '@/modules/auth/api';
import type { AuthUser } from './types';

const USER_KEY = 'dafater-user';
const IDLE_MS = 30 * 60 * 1000; // 30 minutes
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll', 'click'] as const;

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
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const logoutRef = useRef<() => void>(() => {});

  useEffect(() => {
    // Load user from localStorage immediately (no flash on refresh)
    const raw = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
    let hasLocal = false;
    if (raw) {
      try {
        setUser(JSON.parse(raw));
        hasLocal = true;
      } catch { /* ignore */ }
    }
    if (!hasLocal) { setLoading(false); return; }
    // Refresh from server so admin changes (ledgerPartyIds, views, etc.)
    // take effect immediately without requiring re-login
    authApi.me().then((fresh) => {
      localStorage.setItem(USER_KEY, JSON.stringify(fresh));
      setUser(fresh);
    }).catch(() => {
      // 401 → api interceptor clears localStorage and redirects to /login
    }).finally(() => setLoading(false));
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

  // keep logoutRef in sync so the idle handler always calls the latest version
  logoutRef.current = logout;

  // idle-logout: attach listeners only while a user is logged in
  useEffect(() => {
    if (!user) return;

    const reset = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => logoutRef.current(), IDLE_MS);
    };

    reset(); // start timer immediately on login
    ACTIVITY_EVENTS.forEach((e) => window.addEventListener(e, reset, { passive: true }));

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [user?.id ?? null]);

  // online heartbeat — يحدّث "آخر ظهور" كل دقيقة طول ما التطبيق مفتوح ومسجّل دخول
  useEffect(() => {
    if (!user) return;
    const ping = () => { authApi.heartbeat().catch(() => {}); };
    ping();
    const iv = setInterval(ping, 60_000);
    return () => clearInterval(iv);
  }, [user?.id ?? null]);

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
