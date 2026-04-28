'use client'

import { useState, useRef, useEffect } from 'react'
import { Clock } from 'lucide-react'

interface TimePickerProps {
  value: string // "HH:MM"
  onChange: (time: string) => void
  disabled?: boolean
  className?: string
}

const HOURS = Array.from({ length: 15 }, (_, i) => i + 6) // 06-20
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55]

export function TimePicker({ value, onChange, disabled, className }: TimePickerProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const [selectedHour, setSelectedHour] = useState<number | null>(null)

  const [currentH, currentM] = value ? value.split(':').map(Number) : [8, 0]

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false)
        setSelectedHour(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const pad = (n: number) => n.toString().padStart(2, '0')

  const handleHourTap = (h: number) => {
    setSelectedHour(h)
  }

  const handleMinuteTap = (m: number) => {
    if (selectedHour !== null) {
      onChange(`${pad(selectedHour)}:${pad(m)}`)
      setOpen(false)
      setSelectedHour(null)
    }
  }

  return (
    <div ref={ref} className={`relative ${className || ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen(!open)}
        className={`flex items-center gap-2 h-11 min-h-[44px] w-full rounded-lg border border-gray-300 px-3 text-sm
          focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 bg-white
          ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:border-[#3B82F6]'}
        `}
      >
        <Clock size={16} className="text-gray-400" />
        <span className={value ? 'text-[#1E293B] font-medium' : 'text-gray-400'}>
          {value || '--:--'}
        </span>
      </button>

      {open && (
        <div className="absolute top-full left-0 z-50 mt-1 rounded-xl bg-white border border-gray-200 shadow-lg p-3 animate-scale-in"
             style={{ minWidth: 280 }}>
          <div className="text-xs font-semibold text-gray-500 mb-2">
            {selectedHour === null ? 'Select hour' : `${pad(selectedHour)}:__ — Select minutes`}
          </div>
          {selectedHour === null ? (
            <div className="grid grid-cols-5 gap-1.5">
              {HOURS.map(h => (
                <button
                  key={h}
                  type="button"
                  onClick={() => handleHourTap(h)}
                  className={`h-11 rounded-lg text-sm font-medium transition-colors
                    ${h === currentH
                      ? 'bg-[#1E40AF] text-white'
                      : 'bg-gray-50 text-[#1E293B] hover:bg-[#3B82F6] hover:text-white'}
                  `}
                >
                  {pad(h)}
                </button>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-1.5">
              {MINUTES.map(m => (
                <button
                  key={m}
                  type="button"
                  onClick={() => handleMinuteTap(m)}
                  className={`h-11 rounded-lg text-sm font-medium transition-colors
                    ${m === currentM && selectedHour === currentH
                      ? 'bg-[#1E40AF] text-white'
                      : 'bg-gray-50 text-[#1E293B] hover:bg-[#3B82F6] hover:text-white'}
                  `}
                >
                  :{pad(m)}
                </button>
              ))}
              <button
                type="button"
                onClick={() => setSelectedHour(null)}
                className="h-11 rounded-lg text-xs font-medium text-gray-500 bg-gray-50 hover:bg-gray-100"
              >
                ← Back
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
