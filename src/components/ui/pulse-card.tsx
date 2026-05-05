import { ReactNode } from 'react'

interface PulseCardProps {
  children: ReactNode;
  pulse?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PulseCard({ children, pulse, onClick, className = '' }: PulseCardProps) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-xl border-2 p-4 transition-all ${
        pulse
          ? 'border-[var(--accent)] bg-amber-50 shadow-lg'
          : 'border-[var(--border)] bg-white hover:border-[var(--primary)] hover:shadow-md'
      } ${className}`}
    >
      {pulse && (
        <span className="absolute top-3 right-3 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]" />
        </span>
      )}
      {children}
    </button>
  )
}
