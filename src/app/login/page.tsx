'use client';

import { useState } from 'react';

const USERS = ['Annika', 'Nisha', 'Veshi', 'Marlyn', 'Lee-Ann', 'Kam'] as const;

export default function LoginPage() {
  const [step, setStep] = useState<'select' | 'pin'>('select');
  const [selectedUser, setSelectedUser] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  function selectUser(name: string) {
    setSelectedUser(name);
    setPin('');
    setError('');
    setStep('pin');
  }

  function goBack() {
    setStep('select');
    setSelectedUser('');
    setPin('');
    setError('');
  }

  function pressDigit(d: string) {
    if (pin.length < 6) {
      setPin(pin + d);
      setError('');
    }
  }

  function backspace() {
    setPin(pin.slice(0, -1));
    setError('');
  }

  async function submit() {
    if (!selectedUser || pin.length < 4) {
      setError('Enter at least 4 digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: selectedUser, pin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Login failed');
        setPin('');
        return;
      }

      if (data.forceChange) {
        window.location.href = '/change-pin';
      } else {
        window.location.href = '/dashboard';
      }
    } catch {
      setError('Connection error. Try again.');
      setPin('');
    } finally {
      setLoading(false);
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
          {step === 'select' && (
            <>
              <p className="text-center text-sm mb-5" style={{ color: 'rgba(255,255,255,0.6)' }}>
                Select your name to sign in
              </p>
              <div className="grid grid-cols-2 gap-3">
                {USERS.map((name) => (
                  <button
                    key={name}
                    onClick={() => selectUser(name)}
                    className="rounded-xl text-lg font-medium transition-all duration-150"
                    style={{
                      minHeight: 48,
                      padding: '12px 16px',
                      background: 'rgba(255,255,255,0.1)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#FFFFFF',
                      cursor: 'pointer',
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'pin' && (
            <>
              <div className="flex items-center mb-6">
                <button
                  onClick={goBack}
                  className="rounded-xl flex items-center justify-center"
                  style={{
                    minHeight: 48,
                    minWidth: 48,
                    background: 'rgba(255,255,255,0.1)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                  </svg>
                </button>
                <div className="flex-1 text-center" style={{ paddingRight: 48 }}>
                  <p className="text-lg font-semibold" style={{ color: '#FFFFFF' }}>{selectedUser}</p>
                  <p className="text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>Enter your PIN</p>
                </div>
              </div>

              <div className="flex justify-center gap-3 mb-6">
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div
                    key={i}
                    className="rounded-full"
                    style={{
                      width: 14,
                      height: 14,
                      background: i < pin.length ? '#C4A35A' : 'rgba(255,255,255,0.15)',
                      border: i < pin.length ? 'none' : '1px solid rgba(255,255,255,0.2)',
                      transform: i < pin.length ? 'scale(1.1)' : 'scale(1)',
                      transition: 'all 150ms',
                    }}
                  />
                ))}
              </div>

              {error && (
                <p className="text-center text-sm mb-4" style={{ color: '#f87171' }}>{error}</p>
              )}

              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
                  <button
                    key={d}
                    onClick={() => pressDigit(d)}
                    disabled={loading}
                    className="rounded-xl text-2xl font-semibold"
                    style={{
                      minHeight: 56,
                      background: 'rgba(255,255,255,0.1)',
                      color: '#FFFFFF',
                      border: 'none',
                      cursor: 'pointer',
                      opacity: loading ? 0.5 : 1,
                    }}
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => setPin('')}
                  disabled={loading}
                  className="rounded-xl text-xs font-semibold uppercase"
                  style={{
                    minHeight: 56,
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.5)',
                    border: 'none',
                    cursor: 'pointer',
                    letterSpacing: '0.1em',
                  }}
                >
                  Clear
                </button>
                <button
                  onClick={() => pressDigit('0')}
                  disabled={loading}
                  className="rounded-xl text-2xl font-semibold"
                  style={{
                    minHeight: 56,
                    background: 'rgba(255,255,255,0.1)',
                    color: '#FFFFFF',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  0
                </button>
                <button
                  onClick={backspace}
                  disabled={loading}
                  className="rounded-xl flex items-center justify-center"
                  style={{
                    minHeight: 56,
                    background: 'rgba(255,255,255,0.05)',
                    color: 'rgba(255,255,255,0.5)',
                    border: 'none',
                    cursor: 'pointer',
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                    <line x1="18" y1="9" x2="12" y2="15" />
                    <line x1="12" y1="9" x2="18" y2="15" />
                  </svg>
                </button>
              </div>

              <button
                onClick={submit}
                disabled={loading || pin.length < 4}
                className="w-full rounded-xl text-lg font-bold"
                style={{
                  minHeight: 52,
                  background: pin.length >= 4 && !loading ? '#C4A35A' : 'rgba(196,163,90,0.3)',
                  color: '#1A1A2E',
                  border: 'none',
                  cursor: pin.length >= 4 && !loading ? 'pointer' : 'not-allowed',
                }}
              >
                {loading ? 'Signing in...' : 'Sign In'}
              </button>
            </>
          )}
        </div>

        <p className="text-center text-xs mt-6" style={{ color: 'rgba(255,255,255,0.2)' }}>
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  );
}
