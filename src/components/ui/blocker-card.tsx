'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockerCardProps {
  message: string
  actionLabel?: string
  actionHref?: string
  severity?: 'error' | 'warning'
}

export function BlockerCard({
  message,
  actionLabel,
  actionHref,
  severity = 'warning',
}: BlockerCardProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border-l-4 bg-white px-4 py-3.5',
      'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
      severity === 'error'
        ? 'border-l-red-500 bg-red-50/50'
        : 'border-l-amber-500 bg-amber-50/50',
      'animate-[blocker-pulse_2s_ease-in-out_infinite]'
    )}>
      <AlertTriangle className={cn(
        'h-5 w-5 shrink-0 mt-0.5',
        severity === 'error' ? 'text-red-500' : 'text-amber-500'
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1E293B]">{message}</p>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className={cn(
              'inline-block mt-1 text-sm font-semibold',
              severity === 'error' ? 'text-red-600 hover:text-red-700' : 'text-amber-600 hover:text-amber-700'
            )}
          >
            {actionLabel} &rarr;
          </Link>
        )}
      </div>
    </div>
  )
}
