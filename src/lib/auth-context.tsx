'use client';

import {
  createContext,
  useContext,
  useState,
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

export function AuthProvider({ children }: { children: ReactNode }) {
  // TODO: Replace with real auth once login flow is fixed
  // Temporarily hardcode Annika as user to test dashboard features
  const [user] = useState<AuthUser | null>({
    id: 'temp-annika',
    name: 'Annika',
    role: 'head_admin' as UserRole,
  });
  const [loading] = useState(false);

  const logout = useCallback(async () => {
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
