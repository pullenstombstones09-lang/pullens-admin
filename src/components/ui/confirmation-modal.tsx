'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from './button'

interface ConfirmationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
  icon?: ReactNode
}

export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  icon,
}: ConfirmationModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]" />
      <div className={cn(
        'relative z-10 w-full sm:max-w-[420px] bg-white rounded-t-2xl sm:rounded-2xl',
        'shadow-[0_8px_32px_rgba(0,0,0,0.2)]',
        'p-6 space-y-4',
        'animate-[slideUp_200ms_ease-out] sm:animate-[scaleIn_200ms_ease-out]'
      )}>
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {icon && (
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full',
            variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
          )}>
            {icon}
          </div>
        )}
        <div>
          <h3 className="text-lg font-bold text-[#1E293B]">{title}</h3>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>
        <div className="flex gap-3 pt-2">
          <Button variant="ghost" size="lg" onClick={onClose} className="flex-1">
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="lg"
            loading={loading}
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
