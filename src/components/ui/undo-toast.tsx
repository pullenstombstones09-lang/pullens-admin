'use client'

import { useEffect, useState, useCallback, createContext, useContext, ReactNode } from 'react'
import { Undo2, X } from 'lucide-react'

interface UndoToastProps {
  message: string
  duration?: number // ms, default 10000
  onUndo: () => void
  onExpire: () => void
  onDismiss: () => void
}

export function UndoToast({ message, duration = 10000, onUndo, onExpire, onDismiss }: UndoToastProps) {
  const [visible, setVisible] = useState(true)
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setElapsed(prev => {
        if (prev + 100 >= duration) {
          clearInterval(interval)
          setVisible(false)
          onExpire()
          return duration
        }
        return prev + 100
      })
    }, 100)
    return () => clearInterval(interval)
  }, [duration, onExpire])

  const handleUndo = useCallback(() => {
    setVisible(false)
    onUndo()
  }, [onUndo])

  if (!visible) return null

  const progress = ((duration - elapsed) / duration) * 100

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl bg-[#1E293B] px-4 py-3 text-white shadow-lg animate-fade-in-up"
         style={{ minWidth: 320 }}>
      <Undo2 size={18} className="shrink-0 text-[#60A5FA]" />
      <span className="flex-1 text-sm font-medium">{message}</span>
      <button
        onClick={handleUndo}
        className="shrink-0 rounded-lg bg-[#3B82F6] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#2563EB] transition-colors"
      >
        Undo
      </button>
      <button onClick={onDismiss} className="shrink-0 text-gray-400 hover:text-white">
        <X size={16} />
      </button>
      <div className="absolute bottom-0 left-0 h-0.5 rounded-full bg-[#3B82F6]"
           style={{ width: `${progress}%`, transition: 'width 100ms linear' }} />
    </div>
  )
}

type UndoState = {
  message: string
  onUndo: () => void
  onExpire: () => void
} | null

const UndoContext = createContext<{
  showUndo: (message: string, onUndo: () => void, onExpire?: () => void) => void
  clearUndo: () => void
}>({ showUndo: () => {}, clearUndo: () => {} })

export function UndoProvider({ children }: { children: ReactNode }) {
  const [undo, setUndo] = useState<UndoState>(null)

  const showUndo = useCallback((message: string, onUndo: () => void, onExpire?: () => void) => {
    setUndo({ message, onUndo, onExpire: onExpire || (() => {}) })
  }, [])

  const clearUndo = useCallback(() => setUndo(null), [])

  return (
    <UndoContext.Provider value={{ showUndo, clearUndo }}>
      {children}
      {undo && (
        <UndoToast
          message={undo.message}
          onUndo={() => { undo.onUndo(); setUndo(null) }}
          onExpire={() => { undo.onExpire(); setUndo(null) }}
          onDismiss={() => setUndo(null)}
        />
      )}
    </UndoContext.Provider>
  )
}

export const useUndo = () => useContext(UndoContext)
