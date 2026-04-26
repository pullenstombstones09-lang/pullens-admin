'use client';

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react';
import { createClient } from '@/lib/supabase/client';
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
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function loadSession() {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session?.user?.email) {
          setUser(null);
          setLoading(false);
          return;
        }

        // Extract name from email (e.g. annika@pullens.local -> Annika)
        const emailName = session.user.email.split('@')[0].replace(/\./g, ' ');

        // Look up user in users table
        const { data: dbUser } = await supabase
          .from('users')
          .select('id, name, role')
          .eq('name', emailName.charAt(0).toUpperCase() + emailName.slice(1))
          .eq('active', true)
          .single();

        if (!dbUser) {
          // Try case-insensitive match
          const { data: dbUser2 } = await supabase
            .from('users')
            .select('id, name, role')
            .ilike('name', emailName)
            .eq('active', true)
            .single();

          if (dbUser2) {
            setUser({ id: dbUser2.id, name: dbUser2.name, role: dbUser2.role as UserRole });
          } else {
            setUser(null);
          }
        } else {
          setUser({ id: dbUser.id, name: dbUser.name, role: dbUser.role as UserRole });
        }
      } catch {
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    loadSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setUser(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
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
