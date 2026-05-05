'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type RealtimeCallback = (payload: any) => void;

// Subscribe to changes on a Supabase table
// Automatically cleans up on unmount
export function useRealtime(
  table: string,
  callback: RealtimeCallback,
  filter?: string // e.g. 'date=eq.2026-05-05'
) {
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: any) => callback(payload)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter])
}
