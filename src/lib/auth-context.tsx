'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import type { UserRole } from '@/types/database';

export interface AuthUser {
  id: string;
  name: string;
  role: UserRole;
  email?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  logout: async () => {},
});

const DEFAULT_USER: AuthUser = {
  id: '8382580b-0dd4-4aad-b77c-9d2be6ca1c5d',
  name: 'Annika',
  role: 'owner' as UserRole,
};

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
  return match ? decodeURIComponent(match[2]) : null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = getCookie('pullens-user');
    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        setUser({
          id: parsed.id,
          name: parsed.name,
          role: parsed.role as UserRole,
        });
      } catch {
        // Bad cookie — redirect to login
        window.location.href = '/login';
        return;
      }
    } else {
      // No cookie — redirect to login
      window.location.href = '/login';
      return;
    }
    setLoading(false);
  }, []);

  const logout = useCallback(async () => {
    document.cookie = 'pullens-user=; path=/; max-age=0';
    window.location.href = '/login';
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
