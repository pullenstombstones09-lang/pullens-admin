'use client';

import { useState, useCallback } from 'react';

export default function ChangePinPage() {
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [activeField, setActiveField] = useState<'new' | 'confirm'>('new');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const currentPin = activeField === 'new' ? newPin : confirmPin;
  const setCurrentPin =
    activeField === 'new' ? setNewPin : setConfirmPin;

  const handleKeyPress = useCallback(
    (digit: string) => {
      if (currentPin.length < 6) {
        setCurrentPin((prev) => prev + digit);
        setError('');
      }
    },
    [currentPin.length, setCurrentPin]
  );

  const handleBackspace = useCallback(() => {
    setCurrentPin((prev) => prev.slice(0, -1));
    setError('');
  }, [setCurrentPin]);

  const handleClear = useCallback(() => {
    setCurrentPin('');
    setError('');
  }, [setCurrentPin]);

  const handleSubmit = useCallback(async () => {
    if (newPin.length < 4) {
      setError('PIN must be at least 4 digits');
      return;
    }

    if (newPin !== confirmPin) {
      setError('PINs do not match');
      setConfirmPin('');
      setActiveField('confirm');
      return;
    }

    if (!/^\d+$/.test(newPin)) {
      setError('PIN must contain only digits');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/change-pin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPin }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to change PIN');
        return;
      }

      window.location.href = '/dashboard';
    } catch {
      setError('Connection error. Try again.');
    } finally {
      setLoading(false);
    }
  }, [newPin, confirmPin]);

  return (
    <div className="min-h-screen bg-[#1E293B] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Branding */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-black tracking-widest text-white">
            PULLENS ADMIN
          </h1>
          <p className="text-[#1E40AF] text-sm font-semibold tracking-[0.3em] mt-1">
            CAST IN STONE
          </p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur border border-white/10 rounded-2xl p-6 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
          <div className="text-center mb-6">
            <h2 className="text-white text-lg font-semibold">
              Change Your PIN
            </h2>
            <p className="text-white/40 text-sm mt-1">
              You must set a new PIN before continuing
            </p>
          </div>

          {/* Field selector tabs */}
          <div className="flex gap-2 mb-5">
            <button
              onClick={() => setActiveField('new')}
              className={`flex-1 min-h-[48px] rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 ${
                activeField === 'new'
                  ? 'bg-[#1E40AF]/20 border border-[#1E40AF]/40 text-[#1E40AF]'
                  : 'bg-white/5 border border-white/10 text-white/40'
              }`}
            >
              New PIN
              {newPin.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  ({newPin.length})
                </span>
              )}
            </button>
            <button
              onClick={() => setActiveField('confirm')}
              className={`flex-1 min-h-[48px] rounded-xl text-sm font-semibold transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 ${
                activeField === 'confirm'
                  ? 'bg-[#1E40AF]/20 border border-[#1E40AF]/40 text-[#1E40AF]'
                  : 'bg-white/5 border border-white/10 text-white/40'
              }`}
            >
              Confirm PIN
              {confirmPin.length > 0 && (
                <span className="ml-1.5 text-xs opacity-60">
                  ({confirmPin.length})
                </span>
              )}
            </button>
          </div>

          {/* PIN dots */}
          <div className="flex justify-center gap-3 mb-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className={`w-3.5 h-3.5 rounded-full transition-all duration-150 ${
                  i < currentPin.length
                    ? 'bg-[#1E40AF] scale-110'
                    : 'bg-white/15 border border-white/20'
                }`}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-red-400 text-center text-sm mb-4">{error}</p>
          )}

          {/* Numeric keypad */}
          <div className="grid grid-cols-3 gap-2.5 mb-4">
            {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
              <button
                key={digit}
                onClick={() => handleKeyPress(digit)}
                disabled={loading}
                className="min-h-[56px] rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-2xl font-semibold transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
              >
                {digit}
              </button>
            ))}
            <button
              onClick={handleClear}
              disabled={loading}
              className="min-h-[56px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/50 text-xs font-semibold uppercase tracking-wider transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
            >
              Clear
            </button>
            <button
              onClick={() => handleKeyPress('0')}
              disabled={loading}
              className="min-h-[56px] rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 text-white text-2xl font-semibold transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50"
            >
              0
            </button>
            <button
              onClick={handleBackspace}
              disabled={loading}
              className="min-h-[56px] rounded-xl bg-white/5 hover:bg-white/10 active:bg-white/15 text-white/50 transition-all duration-100 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 flex items-center justify-center"
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
            disabled={
              loading || newPin.length < 4 || confirmPin.length < 4
            }
            className="w-full min-h-[52px] rounded-xl bg-[#1E40AF] hover:bg-[#1E3A8A] active:bg-[#1e3480] text-white text-lg font-bold transition-all duration-150 disabled:opacity-30 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/50 focus:ring-offset-2 focus:ring-offset-[#1E293B]"
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
                Saving...
              </span>
            ) : (
              'Set New PIN'
            )}
          </button>
        </div>

        <p className="text-white/20 text-center text-xs mt-6">
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  );
}
