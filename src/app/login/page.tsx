'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const USERS = ['Annika', 'Nisha', 'Veshi', 'Marlyn', 'Lee-Ann', 'Kam'] as const;

type LoginStep = 'select-user' | 'enter-pin';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<LoginStep>('select-user');
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSelectUser = useCallback((name: string) => {
    setSelectedUser(name);
    setPin('');
    setError('');
    setStep('enter-pin');
  }, []);

  const handleBack = useCallback(() => {
    setStep('select-user');
    setSelectedUser(null);
    setPin('');
    setError('');
  }, []);

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (pin.length < 6) {
        setPin((prev) => prev + digit);
        setError('');
      }
    },
    [pin.length]
  );

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
    setError('');
  }, []);

  const handleClear = useCallback(() => {
    setPin('');
    setError('');
  }, []);

  const handleSubmit = useCallback(async () => {
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
  }, [selectedUser, pin]);

  return (
    <div className="min-h-screen bg-[#1A1A2E] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-widest text-white">
            PULLENS ADMIN
          </h1>
          <p className="text-[#C4A35A] text-sm font-semibold tracking-[0.3em] mt-1">
            CAST IN STONE
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          {step === 'select-user' && (
            <>
              <p className="text-white/60 text-center text-sm mb-5">
                Select your name to sign in
              </p>
              <div className="grid grid-cols-2 gap-3">
                {USERS.map((name) => (
                  <button
                    key={name}
                    onClick={() => handleSelectUser(name)}
                    className="min-h-[48px] px-4 py-3 rounded-xl bg-white/10 hover:bg-[#C4A35A]/20 active:bg-[#C4A35A]/30 border border-white/10 hover:border-[#C4A35A]/40 text-white text-lg font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/50"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </>
          )}

          {step === 'enter-pin' && (
            <>
              {/* Header with back button */}
              <div className="flex items-center mb-6">
                <button
                  onClick={handleBack}
                  className="min-h-[48px] min-w-[48px] flex items-center justify-center rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/50"
                  aria-label="Back to user selection"
                >
                  <svg
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 10H5M5 10L10 5M5 10L10 15" />
                  </svg>
                </button>
                <div className="flex-1 text-center pr-12">
                  <p className="text-white text-lg font-semibold">
                    {selectedUser}
                  </p>
                  <p className="text-white/40 text-xs">Enter your PIN</p>
                </div>
              </div>

              {/* PIN dots */}
              <div className="flex justify-center gap-3 mb-6">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div
                    key={i}
                    className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                      i < pin.length
                        ? 'bg-[#C4A35A] scale-110'
                        : 'bg-white/15 border border-white/20'
                    }`}
                  />
                ))}
              </div>

              {/* Error message */}
              {error && (
                <p className="text-red-400 text-center text-sm mb-4">
                  {error}
                </p>
              )}

              {/* Numeric keypad */}
              <div className="grid grid-cols-3 gap-2.5 mb-4">
                {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map(
                  (digit) => (
                    <button
                      key={digit}
                      onClick={() => handleKeyPress(digit)}
                      disabled={loading}
                      className="min-h-[56px] rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-2xl font-semibold transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/50"
                    >
                      {digit}
                    </button>
                  )
                )}
                {/* Bottom row: Clear, 0, Backspace */}
                <button
                  onClick={handleClear}
                  disabled={loading}
                  className="min-h-[56px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/50 text-xs font-semibold uppercase tracking-wider transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/50"
                >
                  Clear
                </button>
                <button
                  onClick={() => handleKeyPress('0')}
                  disabled={loading}
                  className="min-h-[56px] rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-2xl font-semibold transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/50"
                >
                  0
                </button>
                <button
                  onClick={handleBackspace}
                  disabled={loading}
                  className="min-h-[56px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/50 transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/50 flex items-center justify-center"
                  aria-label="Backspace"
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 4H8l-7 8 7 8h13a2 2 0 002-2V6a2 2 0 00-2-2z" />
                    <line x1="18" y1="9" x2="12" y2="15" />
                    <line x1="12" y1="9" x2="18" y2="15" />
                  </svg>
                </button>
              </div>

              {/* Submit button */}
              <button
                onClick={handleSubmit}
                disabled={loading || pin.length < 4}
                className="w-full min-h-[52px] rounded-xl bg-[#C4A35A] hover:bg-[#B89344] active:bg-[#A8832E] text-[#1A1A2E] text-lg font-bold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/50 focus:ring-offset-2 focus:ring-offset-[#1A1A2E]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <svg
                      className="animate-spin h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                      />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <p className="text-white/20 text-center text-xs mt-6">
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  );
}
