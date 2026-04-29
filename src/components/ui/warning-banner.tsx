'use client'

import { useState } from 'react'
import { AlertTriangle, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface WarningBannerProps {
  alertKey: string
  userId: string
  message: string
  severity?: 'warning' | 'info'
  dismissable?: boolean
}

const icons = {
  warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
}

const styles = {
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-blue-50 border-blue-200',
}

export function WarningBanner({
  alertKey,
  userId,
  message,
  severity = 'warning',
  dismissable = true,
}: WarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  async function handleDismiss() {
    setDismissed(true)
    const supabase = createClient()
    await supabase.from('alert_dismissals').upsert(
      { user_id: userId, alert_key: alertKey, dismissed_at: new Date().toISOString() },
      { onConflict: 'user_id,alert_key' }
    )
  }

  if (dismissed) return null

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3',
      'animate-[fadeIn_200ms_ease-out]',
      styles[severity]
    )}>
      {icons[severity]}
      <p className="flex-1 text-sm font-medium text-[#1E293B]">{message}</p>
      {dismissable && (
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
