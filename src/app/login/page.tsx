'use client';

import { useState } from 'react';

const USERS = ['Annika', 'Nisha', 'Veshi', 'Marlyn', 'Lee-Ann', 'Kam'] as const;

export default function LoginPage() {
  const [error, setError] = useState('');
  const [loading, setLoading] = useState('');

  async function login(name: string) {
    setLoading(name);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setLoading('');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Connection error. Try again.');
      setLoading('');
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#1A1A2E' }}>
      <div className="w-full" style={{ maxWidth: 420 }}>
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-widest" style={{ color: '#FFFFFF' }}>
            PULLENS ADMIN
          </h1>
          <p className="text-sm font-semibold mt-1" style={{ color: '#C4A35A', letterSpacing: '0.3em' }}>
            CAST IN STONE
          </p>
        </div>

        <div
          className="rounded-2xl p-6"
          style={{
            background: 'rgba(255,255,255,0.05)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          }}
        >
          <p className="text-center text-sm mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Select your name to sign in
          </p>

          {error && (
            <p className="text-center text-sm mb-4" style={{ color: '#f87171' }}>{error}</p>
          )}

          <div className="grid grid-cols-2 gap-3">
            {USERS.map((name) => (
              <button
                key={name}
                onClick={() => login(name)}
                disabled={!!loading}
                className="rounded-xl text-lg font-medium transition-all duration-150"
                style={{
                  minHeight: 48,
                  padding: '12px 16px',
                  background: loading === name ? '#C4A35A' : 'rgba(255,255,255,0.1)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: loading === name ? '#1A1A2E' : '#FFFFFF',
                  cursor: loading ? 'wait' : 'pointer',
                  opacity: loading && loading !== name ? 0.5 : 1,
                }}
              >
                {loading === name ? 'Signing in...' : name}
              </button>
            ))}
          </div>
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  );
}
