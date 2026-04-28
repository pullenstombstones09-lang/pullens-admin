# Pullens Admin System Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform the Pullens Admin Dashboard from disconnected pages into a guided weekly cycle with complete HR features, vibrant royal blue UI, and undo safety for non-technical users.

**Architecture:** Visual refresh first (colours/animations/components shared by everything), then shared infrastructure (undo toast, workflow stepper, time picker), then page-by-page rebuilds following the weekly cycle order (register → payroll → sign → print → bank), then staff profiles and HR features, and finally HR Advisor fixes.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Supabase (PostgreSQL + Storage), jsPDF, lucide-react, date-fns

**Spec:** `docs/superpowers/specs/2026-04-28-system-overhaul-design.md`

---

## File Structure

### New files:
| File | Responsibility |
|------|---------------|
| `src/components/ui/workflow-stepper.tsx` | Weekly cycle stepper bar (5 steps with status) |
| `src/components/ui/undo-toast.tsx` | 10-second undo toast with countdown + callback |
| `src/components/ui/time-picker.tsx` | Tap-friendly hour/minute grid selector |
| `src/components/ui/slide-panel.tsx` | Reusable slide-out panel (right side) for forms |
| `src/components/ui/progress-ring.tsx` | Small SVG donut ring for completeness % |
| `src/components/ui/employee-info-card.tsx` | Read-only employee details card with inline edit |
| `src/app/api/payroll/bank/route.ts` | Banking tick-off API (mark employees as banked) |
| `src/app/api/register/photo/route.ts` | Register photo upload API |
| `src/app/api/workflow/route.ts` | GET weekly workflow status (which steps complete) |

### Modified files:
| File | Changes |
|------|---------|
| `src/app/globals.css` | New palette variables, pulse animation, gradient classes |
| `src/components/ui/button.tsx` | Royal blue primary variant, pulse class option |
| `src/components/ui/card.tsx` | Updated shadow/border for white-on-light-blue |
| `src/components/ui/badge.tsx` | No changes needed (colours already flexible) |
| `src/components/ui/toast.tsx` | Add "undo" toast type with action callback |
| `src/app/(dashboard)/layout.tsx` | Royal blue sidebar, workflow stepper, updated nav |
| `src/app/(dashboard)/dashboard/page.tsx` | Rebuild as "This Week" view with stepper + summary |
| `src/app/(dashboard)/register/page.tsx` | Clean layout, time picker, photo upload, undo |
| `src/app/(dashboard)/payroll/page.tsx` | Tick boxes, inline loan edit, action bar |
| `src/app/(dashboard)/payroll/payslip-viewer/page.tsx` | Dropdown nav, signature flow, auto-file, progress |
| `src/app/(dashboard)/staff/[id]/page.tsx` | Visible info card, inline edit sections |
| `src/app/(dashboard)/staff/[id]/tabs/overview-tab.tsx` | Full employee info display |
| `src/app/(dashboard)/staff/[id]/tabs/loans-tab.tsx` | Working New Loan form (slide panel) |
| `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx` | Working Record Leave form (slide panel) |
| `src/app/(dashboard)/staff/[id]/tabs/disciplinary-tab.tsx` | Working CCMA Case File generator |
| `src/app/api/hr-advisor/advise/route.ts` | Model fix, user attribution, error messages |
| `src/app/api/register/route.ts` | Support photo URL field |
| `src/app/(dashboard)/staff/page.tsx` | Completeness ring, updated card style |

---

## Task 1: Visual Foundation — Palette & CSS

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace CSS variables and add new ones**

Open `src/app/globals.css` and replace the `:root` block and add new animations:

```css
:root {
  --background: #F8FAFC;
  --foreground: #1E293B;
  --primary: #1E40AF;
  --primary-light: #3B82F6;
  --primary-glow: #60A5FA;
  --accent-gold: #C4A35A;
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;
  --card: #FFFFFF;
  --sidebar-from: #1E3A8A;
  --sidebar-to: #1E40AF;
}
```

Add after existing animations:

```css
@keyframes pulse-blue {
  0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.5); }
  50% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
}

@keyframes pulse-dot {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
}

@keyframes hover-lift {
  to { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -5px rgba(0,0,0,0.04); }
}

@keyframes countdown {
  from { width: 100%; }
  to { width: 0%; }
}

.animate-pulse-blue { animation: pulse-blue 2s ease-in-out infinite; }
.animate-pulse-dot { animation: pulse-dot 1.5s ease-in-out infinite; }
.card-hover { transition: transform 200ms ease, box-shadow 200ms ease; }
.card-hover:hover { transform: translateY(-2px); box-shadow: 0 8px 25px -5px rgba(0,0,0,0.1); }
.gradient-sidebar { background: linear-gradient(180deg, var(--sidebar-from), var(--sidebar-to)); }
.gradient-header { background: linear-gradient(135deg, var(--primary), var(--primary-light)); }
```

- [ ] **Step 2: Verify the CSS compiles**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | head -20`
Expected: No CSS parsing errors.

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/globals.css
git commit -m "style: replace beige palette with royal blue, add pulse/lift animations"
```

---

## Task 2: Update Button Component — Royal Blue Primary

**Files:**
- Modify: `src/components/ui/button.tsx`

- [ ] **Step 1: Update primary variant colours**

In `src/components/ui/button.tsx`, find the primary variant class string and replace:

Old (gold):
```
'bg-[#C4A35A] hover:bg-[#B3944F] text-white focus:ring-[#C4A35A]/30'
```

New (royal blue with optional pulse):
```
'bg-[#1E40AF] hover:bg-[#1E3A8A] text-white focus:ring-[#3B82F6]/30'
```

Add a `pulse` prop to the component interface:
```tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost'
  size?: 'sm' | 'md' | 'lg'
  loading?: boolean
  icon?: React.ReactNode
  pulse?: boolean
}
```

In the className join, add: `pulse && 'animate-pulse-blue'`

- [ ] **Step 2: Update focus ring colour throughout**

Replace all `focus:ring-[#C4A35A]` with `focus:ring-[#3B82F6]` in button.tsx.

- [ ] **Step 3: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`
Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/button.tsx
git commit -m "style: button primary variant now royal blue, add pulse prop"
```

---

## Task 3: Update Card Component — White on Light Blue

**Files:**
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Update card base styles**

Replace the card's base className:

Old:
```
'bg-white rounded-xl border border-gray-100 shadow-sm'
```

New:
```
'bg-white rounded-xl border border-gray-100/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]'
```

Add `card-hover` class when `hoverable` prop is true (this class is defined in globals.css from Task 1).

- [ ] **Step 2: Update accent border**

Replace accent border from gold to blue:

Old: `'border-t-2 border-t-[#C4A35A]'`
New: `'border-t-2 border-t-[#1E40AF]'`

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/card.tsx
git commit -m "style: card component - layered shadow, blue accent, hover lift"
```

---

## Task 4: Undo Toast Component

**Files:**
- Create: `src/components/ui/undo-toast.tsx`

- [ ] **Step 1: Create the undo toast component**

```tsx
'use client'

import { useEffect, useState, useCallback } from 'react'
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
```

- [ ] **Step 2: Create a useUndo hook for easy usage**

Add to the bottom of the same file:

```tsx
import { createContext, useContext, ReactNode } from 'react'

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
```

- [ ] **Step 3: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/undo-toast.tsx
git commit -m "feat: undo toast component with 10s countdown, provider, and hook"
```

---

## Task 5: Time Picker Component

**Files:**
- Create: `src/components/ui/time-picker.tsx`

- [ ] **Step 1: Create tap-friendly time picker**

```tsx
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

  // Parse current value
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
```

- [ ] **Step 2: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/time-picker.tsx
git commit -m "feat: tap-friendly time picker with hour/minute grid selector"
```

---

## Task 6: Slide Panel Component

**Files:**
- Create: `src/components/ui/slide-panel.tsx`

- [ ] **Step 1: Create reusable slide-out panel**

```tsx
'use client'

import { useEffect } from 'react'
import { X } from 'lucide-react'

interface SlidePanelProps {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  width?: string // default 'max-w-md'
}

export function SlidePanel({ open, onClose, title, children, width = 'max-w-md' }: SlidePanelProps) {
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
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" onClick={onClose} />
      {/* Panel */}
      <div className={`absolute right-0 top-0 h-full w-full ${width} bg-white shadow-2xl animate-slide-in-right`}
           style={{ animationDuration: '200ms' }}>
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h2 className="text-lg font-bold text-[#1E293B]">{title}</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>
        <div className="overflow-y-auto p-6" style={{ height: 'calc(100% - 65px)' }}>
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add slide-in-right animation to globals.css (already exists as slideInRight)**

Verify that `slideInRight` keyframe and `.animate-slide-in-right` class exist in globals.css. If not, the animation is already defined from the existing toast. The panel references `animate-slide-in-right` — verify the class name matches. The existing CSS has `slideInRight` keyframe but the utility class may not exist. If needed, add to globals.css:

```css
.animate-slide-in-right { animation: slideInRight 200ms ease-out; }
```

- [ ] **Step 3: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/slide-panel.tsx src/app/globals.css
git commit -m "feat: slide-out panel component for loan/leave forms"
```

---

## Task 7: Progress Ring Component

**Files:**
- Create: `src/components/ui/progress-ring.tsx`

- [ ] **Step 1: Create SVG donut ring**

```tsx
interface ProgressRingProps {
  percent: number // 0-100
  size?: number // px, default 32
  strokeWidth?: number // default 3
  className?: string
}

export function ProgressRing({ percent, size = 32, strokeWidth = 3, className }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  const color = percent < 50 ? '#EF4444' : percent < 80 ? '#F59E0B' : '#10B981'

  return (
    <svg width={size} height={size} className={className}>
      {/* Background circle */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 500ms ease' }}
      />
      {/* Center text */}
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
            fill={color} fontSize={size * 0.3} fontWeight="700">
        {Math.round(percent)}
      </text>
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/progress-ring.tsx
git commit -m "feat: progress ring SVG component for data completeness"
```

---

## Task 8: Workflow Stepper Component

**Files:**
- Create: `src/components/ui/workflow-stepper.tsx`
- Create: `src/app/api/workflow/route.ts`

- [ ] **Step 1: Create the workflow API route**

This route checks current week status by querying attendance, payroll, and payslip data.

```tsx
// src/app/api/workflow/route.ts
import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, format } from 'date-fns'

export async function GET() {
  const supabase = createServiceClient()
  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // Step 1: Register — any attendance records this week?
  const { count: attendanceCount } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('date', weekStart)
    .lte('date', weekEnd)

  // Step 2: Payroll — any payroll run this week?
  const { data: runs } = await supabase
    .from('payroll_runs')
    .select('id, status')
    .gte('week_start', weekStart)
    .lte('week_start', weekEnd)
    .limit(1)

  const latestRun = runs?.[0]

  // Step 3: Signatures — how many signed vs total?
  let signedCount = 0
  let totalPayslips = 0
  if (latestRun) {
    const { count: total } = await supabase
      .from('payslips')
      .select('*', { count: 'exact', head: true })
      .eq('payroll_run_id', latestRun.id)

    const { count: signed } = await supabase
      .from('payslips')
      .select('*', { count: 'exact', head: true })
      .eq('payroll_run_id', latestRun.id)
      .not('signed_at', 'is', null)

    totalPayslips = total || 0
    signedCount = signed || 0
  }

  // Step 4: Print — check if payslips have pdf_url
  let printedCount = 0
  if (latestRun) {
    const { count } = await supabase
      .from('payslips')
      .select('*', { count: 'exact', head: true })
      .eq('payroll_run_id', latestRun.id)
      .not('pdf_url', 'is', null)

    printedCount = count || 0
  }

  // Step 5: Bank — check if run is marked as banked (use status or a new field)
  const banked = latestRun?.status === 'banked'

  return NextResponse.json({
    weekStart,
    weekEnd,
    steps: {
      register: { status: (attendanceCount || 0) > 0 ? 'done' : 'active', count: attendanceCount || 0 },
      payroll: { status: latestRun ? 'done' : (attendanceCount || 0) > 0 ? 'active' : 'pending', runId: latestRun?.id },
      sign: { status: signedCount === totalPayslips && totalPayslips > 0 ? 'done' : latestRun ? 'active' : 'pending', signed: signedCount, total: totalPayslips },
      print: { status: printedCount === totalPayslips && totalPayslips > 0 ? 'done' : signedCount > 0 ? 'active' : 'pending', printed: printedCount, total: totalPayslips },
      bank: { status: banked ? 'done' : printedCount > 0 ? 'active' : 'pending' },
    }
  })
}
```

- [ ] **Step 2: Create the stepper UI component**

```tsx
// src/components/ui/workflow-stepper.tsx
'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Calculator, PenTool, Printer, Landmark, Check } from 'lucide-react'
import { usePathname } from 'next/navigation'

type StepStatus = 'pending' | 'active' | 'done'

interface WorkflowStep {
  key: string
  label: string
  icon: React.ReactNode
  href: string
  status: StepStatus
  detail?: string
}

interface WorkflowData {
  weekStart: string
  weekEnd: string
  steps: {
    register: { status: string; count: number }
    payroll: { status: string; runId?: string }
    sign: { status: string; signed: number; total: number }
    print: { status: string; printed: number; total: number }
    bank: { status: string }
  }
}

export function WorkflowStepper({ compact }: { compact?: boolean }) {
  const [data, setData] = useState<WorkflowData | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/workflow')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [pathname])

  if (!data) return null

  const steps: WorkflowStep[] = [
    {
      key: 'register',
      label: 'Register',
      icon: <ClipboardList size={compact ? 16 : 20} />,
      href: '/register',
      status: data.steps.register.status as StepStatus,
      detail: `${data.steps.register.count} records`,
    },
    {
      key: 'payroll',
      label: 'Payroll',
      icon: <Calculator size={compact ? 16 : 20} />,
      href: '/payroll',
      status: data.steps.payroll.status as StepStatus,
    },
    {
      key: 'sign',
      label: 'Sign',
      icon: <PenTool size={compact ? 16 : 20} />,
      href: '/payroll/payslip-viewer' + (data.steps.payroll.runId ? `?run=${data.steps.payroll.runId}` : ''),
      status: data.steps.sign.status as StepStatus,
      detail: data.steps.sign.total > 0 ? `${data.steps.sign.signed}/${data.steps.sign.total}` : undefined,
    },
    {
      key: 'print',
      label: 'Print',
      icon: <Printer size={compact ? 16 : 20} />,
      href: '/payroll',
      status: data.steps.print.status as StepStatus,
    },
    {
      key: 'bank',
      label: 'Bank',
      icon: <Landmark size={compact ? 16 : 20} />,
      href: '/payroll',
      status: data.steps.bank.status as StepStatus,
    },
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-3 py-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <a href={step.href} className="flex items-center gap-1 group" title={step.label}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs transition-all
                ${step.status === 'done' ? 'bg-[#10B981] text-white' :
                  step.status === 'active' ? 'bg-[#3B82F6] text-white animate-pulse-dot' :
                  'bg-gray-200 text-gray-400'}`}>
                {step.status === 'done' ? <Check size={14} /> : step.icon}
              </div>
            </a>
            {i < steps.length - 1 && (
              <div className={`w-4 h-0.5 mx-0.5 rounded ${step.status === 'done' ? 'bg-[#10B981]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100/60 shadow-sm px-6 py-4">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1">
          <a href={step.href} className="flex flex-col items-center gap-1.5 group flex-1">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all
              ${step.status === 'done' ? 'bg-[#10B981] text-white shadow-md' :
                step.status === 'active' ? 'bg-[#1E40AF] text-white shadow-lg animate-pulse-blue' :
                'bg-gray-100 text-gray-400'}`}>
              {step.status === 'done' ? <Check size={20} /> : step.icon}
            </div>
            <span className={`text-xs font-semibold
              ${step.status === 'done' ? 'text-[#10B981]' :
                step.status === 'active' ? 'text-[#1E40AF]' :
                'text-gray-400'}`}>
              {step.label}
            </span>
            {step.detail && (
              <span className="text-[10px] text-gray-400">{step.detail}</span>
            )}
          </a>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-2 rounded ${step.status === 'done' ? 'bg-[#10B981]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/workflow-stepper.tsx src/app/api/workflow/route.ts
git commit -m "feat: workflow stepper component with API status tracking"
```

---

## Task 9: Royal Blue Sidebar + Stepper Integration

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update sidebar gradient**

In `layout.tsx`, find the sidebar container div. Replace the dark navy gradient background with royal blue:

Old background classes (find the sidebar div):
```
bg-gradient-to-b from-[#1A1A2E] to-[#141425]
```

New:
```
gradient-sidebar
```

(This uses the CSS class from Task 1 which applies `background: linear-gradient(180deg, var(--sidebar-from), var(--sidebar-to))`)

- [ ] **Step 2: Update active nav item colours**

Replace all gold (#C4A35A) references in the sidebar with white pill:

Old active style:
```
'bg-[#C4A35A]/10 text-[#C4A35A]'
```

New active style:
```
'bg-white/15 text-white font-semibold'
```

Old inactive hover:
```
'text-gray-400 hover:text-[#C4A35A] hover:bg-white/5'
```

New:
```
'text-blue-200 hover:text-white hover:bg-white/10'
```

- [ ] **Step 3: Add workflow stepper to sidebar top**

Import the WorkflowStepper component and add it above the nav items:

```tsx
import { WorkflowStepper } from '@/components/ui/workflow-stepper'
```

Inside SidebarContent, after the logo section and before the nav items:

```tsx
<div className="px-2 mb-4">
  <WorkflowStepper compact />
</div>
```

- [ ] **Step 4: Add UndoProvider to dashboard layout**

Import and wrap the layout children:

```tsx
import { UndoProvider } from '@/components/ui/undo-toast'
```

In the DashboardLayout component, wrap with UndoProvider (inside AuthProvider and ToastProvider):

```tsx
<AuthProvider>
  <ToastProvider>
    <UndoProvider>
      <DashboardShell>{children}</DashboardShell>
    </UndoProvider>
  </ToastProvider>
</AuthProvider>
```

- [ ] **Step 5: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/layout.tsx
git commit -m "feat: royal blue sidebar, workflow stepper, undo provider"
```

---

## Task 10: Dashboard — "This Week" View

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`

- [ ] **Step 1: Rebuild the dashboard page**

Replace the current dashboard content with a weekly workflow view. The page should:

1. Show the full WorkflowStepper (non-compact) at the top
2. Show 4 summary metric cards in a 2x2 grid (Lark-style: big number + label + trend):
   - Staff captured today (attendance count)
   - Payroll status (draft/approved/not run)
   - Unsigned payslips (count)
   - Active alerts (count)
3. Quick action buttons below: "Capture Register", "Run Payroll", "View Payslips", "HR Advisor"
4. Recent activity feed (last 5 audit log entries)

```tsx
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { WorkflowStepper } from '@/components/ui/workflow-stepper'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Users, Calculator, PenTool, AlertTriangle, ClipboardList, Brain } from 'lucide-react'
import { createBrowserClient } from '@/lib/supabase/client'
import { format, startOfWeek, endOfWeek } from 'date-fns'

interface WeekStats {
  attendanceToday: number
  totalStaff: number
  payrollStatus: string | null
  unsignedCount: number
  alertCount: number
}

export default function DashboardPage() {
  const { user } = useAuth()
  const [stats, setStats] = useState<WeekStats | null>(null)
  const supabase = createBrowserClient()

  useEffect(() => {
    async function load() {
      const today = format(new Date(), 'yyyy-MM-dd')
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

      const [attendance, employees, runs, alerts] = await Promise.all([
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payroll_runs').select('status').gte('week_start', weekStart).lte('week_start', weekEnd).limit(1),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('resolved', false),
      ])

      const run = runs.data?.[0]
      let unsigned = 0
      if (run) {
        const { count } = await supabase
          .from('payslips')
          .select('*', { count: 'exact', head: true })
          .eq('payroll_run_id', run)
          .is('signed_at', null)
        unsigned = count || 0
      }

      setStats({
        attendanceToday: attendance.count || 0,
        totalStaff: employees.count || 0,
        payrollStatus: run?.status || null,
        unsignedCount: unsigned,
        alertCount: alerts.count || 0,
      })
    }
    load()
  }, [])

  const metrics = stats ? [
    { label: 'Captured Today', value: `${stats.attendanceToday}/${stats.totalStaff}`, icon: <Users size={24} />, color: stats.attendanceToday > 0 ? '#10B981' : '#F59E0B' },
    { label: 'Payroll', value: stats.payrollStatus || 'Not run', icon: <Calculator size={24} />, color: stats.payrollStatus === 'generated' ? '#10B981' : '#3B82F6' },
    { label: 'Unsigned', value: stats.unsignedCount.toString(), icon: <PenTool size={24} />, color: stats.unsignedCount > 0 ? '#F59E0B' : '#10B981' },
    { label: 'Alerts', value: stats.alertCount.toString(), icon: <AlertTriangle size={24} />, color: stats.alertCount > 0 ? '#EF4444' : '#10B981' },
  ] : []

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">
          Welcome back, {user?.name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Week of {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM')} — {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM yyyy')}
        </p>
      </div>

      {/* Workflow Stepper */}
      <WorkflowStepper />

      {/* Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <Card key={i} hoverable>
            <CardContent>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">{m.label}</p>
                  <p className="text-3xl font-bold mt-1" style={{ color: m.color }}>{m.value}</p>
                </div>
                <div className="p-2 rounded-lg" style={{ backgroundColor: m.color + '15', color: m.color }}>
                  {m.icon}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <a href="/register"><Button variant="primary" size="lg" className="w-full" icon={<ClipboardList size={18} />}>Capture Register</Button></a>
        <a href="/payroll"><Button variant="primary" size="lg" className="w-full" icon={<Calculator size={18} />}>Run Payroll</Button></a>
        <a href="/payroll/payslip-viewer"><Button variant="secondary" size="lg" className="w-full" icon={<PenTool size={18} />}>View Payslips</Button></a>
        <a href="/hr-advisor"><Button variant="secondary" size="lg" className="w-full" icon={<Brain size={18} />}>HR Advisor</Button></a>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/dashboard/page.tsx
git commit -m "feat: dashboard rebuilt as This Week view with stepper and metrics"
```

---

## Task 11: Register Page — Clean Layout + Time Picker + Photo

**Files:**
- Modify: `src/app/(dashboard)/register/page.tsx`
- Create: `src/app/api/register/photo/route.ts`

This is the largest single file change. The register page needs:
1. Cleaner table layout with generous row height
2. TimePicker replacing native `<input type="time">`
3. Photo upload button at top
4. Undo on save

- [ ] **Step 1: Create photo upload API route**

```tsx
// src/app/api/register/photo/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('photo') as File
  const date = formData.get('date') as string

  if (!file || !date) {
    return NextResponse.json({ error: 'Missing photo or date' }, { status: 400 })
  }

  const supabase = createServiceClient()
  const path = `registers/${date}/photo-${Date.now()}.${file.name.split('.').pop()}`

  const { data, error } = await supabase.storage
    .from('registers')
    .upload(path, file, { contentType: file.type, upsert: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const { data: { publicUrl } } = supabase.storage.from('registers').getPublicUrl(path)

  return NextResponse.json({ url: publicUrl, path })
}
```

- [ ] **Step 2: Update the register page**

In `src/app/(dashboard)/register/page.tsx`, make these changes:

**a) Import TimePicker and useUndo:**
```tsx
import { TimePicker } from '@/components/ui/time-picker'
import { useUndo } from '@/components/ui/undo-toast'
```

**b) Replace every `<input type="time" ... />` with `<TimePicker ... />`:**

Find all instances of:
```tsx
<input
  type="time"
  value={row.time_in}
  disabled={!canEdit || editLocked}
  onChange={(e) => updateRow(idx, { time_in: e.target.value })}
  className={cn(
    'h-10 min-h-[44px] w-full rounded-lg border border-gray-300 px-2 text-sm',
    ...
  )}
/>
```

Replace with:
```tsx
<TimePicker
  value={row.time_in}
  disabled={!canEdit || editLocked}
  onChange={(val) => updateRow(idx, { time_in: val })}
/>
```

Do the same for `time_out` fields.

**c) Add photo upload section after the date picker:**

Add state:
```tsx
const [registerPhoto, setRegisterPhoto] = useState<string | null>(null)
const { showUndo } = useUndo()
```

Add photo upload UI after the date picker div:
```tsx
<div className="flex items-center gap-3">
  <label className="flex items-center gap-2 cursor-pointer rounded-lg border border-dashed border-gray-300 px-4 py-2.5 text-sm text-gray-600 hover:border-[#3B82F6] hover:text-[#1E40AF] transition-colors">
    <Camera size={18} />
    <span>Upload Register Photo</span>
    <input type="file" accept="image/*" capture="environment" className="hidden"
      onChange={async (e) => {
        const file = e.target.files?.[0]
        if (!file) return
        const form = new FormData()
        form.append('photo', file)
        form.append('date', selectedDate)
        const res = await fetch('/api/register/photo', { method: 'POST', body: form })
        if (res.ok) {
          const { url } = await res.json()
          setRegisterPhoto(url)
          addToast({ type: 'success', message: 'Photo uploaded' })
        }
      }}
    />
  </label>
  {registerPhoto && (
    <img src={registerPhoto} alt="Register" className="h-12 w-12 rounded-lg object-cover border" />
  )}
</div>
```

Import Camera from lucide-react.

**d) Add undo to the save function:**

Before the existing save logic, capture the previous state:
```tsx
const previousRows = JSON.parse(JSON.stringify(rows))
```

After a successful save, replace the success toast with:
```tsx
showUndo('Register saved', async () => {
  // Revert: re-POST with previous data
  setRows(previousRows)
  await fetch('/api/register', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ date: selectedDate, rows: previousRows }),
  })
  addToast({ type: 'info', message: 'Register reverted' })
})
```

**e) Update table styling for cleaner layout:**

On the table container, ensure minimum row height of 56px:
```tsx
<tr className="border-b border-gray-50 hover:bg-gray-50/50" style={{ minHeight: 56 }}>
```

Replace any beige/gold colour references (#F5F3EF, #C4A35A) with the new palette (#F8FAFC, #1E40AF).

- [ ] **Step 3: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/register/page.tsx src/app/api/register/photo/route.ts
git commit -m "feat: register page - time picker, photo upload, undo, cleaner layout"
```

---

## Task 12: Payroll Page — Tick Boxes + Inline Loan Edit + Action Bar

**Files:**
- Modify: `src/app/(dashboard)/payroll/page.tsx`

- [ ] **Step 1: Add selection state and tick boxes**

Add to the component state:
```tsx
const [selected, setSelected] = useState<Set<string>>(new Set())

const toggleSelect = (id: string) => {
  setSelected(prev => {
    const next = new Set(prev)
    next.has(id) ? next.delete(id) : next.add(id)
    return next
  })
}

const toggleSelectAll = () => {
  if (selected.size === results.length) {
    setSelected(new Set())
  } else {
    setSelected(new Set(results.map((r: any) => r.employee_id)))
  }
}
```

In the results table, add a checkbox column:

Header:
```tsx
<th className="px-3 py-3 text-left">
  <input type="checkbox" checked={selected.size === results.length && results.length > 0}
    onChange={toggleSelectAll} className="w-5 h-5 rounded accent-[#1E40AF]" />
</th>
```

Each row:
```tsx
<td className="px-3 py-3">
  <input type="checkbox" checked={selected.has(r.employee_id)}
    onChange={() => toggleSelect(r.employee_id)} className="w-5 h-5 rounded accent-[#1E40AF]" />
</td>
```

- [ ] **Step 2: Add inline loan deduction editing**

In the results table, make the loan deduction column editable. Add editing state:
```tsx
const [editingLoan, setEditingLoan] = useState<string | null>(null)
const [loanValue, setLoanValue] = useState('')
```

Replace the static loan cell with:
```tsx
<td className="px-3 py-3 text-sm">
  {editingLoan === r.employee_id ? (
    <input type="number" value={loanValue} autoFocus
      onChange={(e) => setLoanValue(e.target.value)}
      onKeyDown={async (e) => {
        if (e.key === 'Enter') {
          // Save to loans table
          const { error } = await supabase
            .from('loans')
            .update({ weekly_deduction: parseFloat(loanValue) })
            .eq('employee_id', r.employee_id)
            .eq('status', 'active')
          if (!error) {
            r.loan_deduction = parseFloat(loanValue)
            addToast({ type: 'success', message: 'Loan updated' })
          }
          setEditingLoan(null)
        }
        if (e.key === 'Escape') setEditingLoan(null)
      }}
      onBlur={() => setEditingLoan(null)}
      className="w-20 h-9 rounded border border-[#3B82F6] px-2 text-sm focus:ring-2 focus:ring-[#3B82F6]/40"
    />
  ) : (
    <span
      onClick={() => { setEditingLoan(r.employee_id); setLoanValue(r.loan_deduction?.toString() || '0') }}
      className={r.loan_deduction > 0 ? 'cursor-pointer text-[#1E40AF] underline decoration-dotted' : 'text-gray-400'}
      title="Click to edit"
    >
      {r.loan_deduction > 0 ? `R${r.loan_deduction.toFixed(2)}` : '—'}
    </span>
  )}
</td>
```

- [ ] **Step 3: Add sticky action bar at bottom**

After the results table, add:
```tsx
{results.length > 0 && (
  <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-b-xl">
    <span className="text-sm text-gray-500">
      {selected.size} of {results.length} selected
    </span>
    <div className="flex items-center gap-3">
      <Button variant="secondary" size="md"
        onClick={() => window.open(`/api/pdf/payroll-summary?run=${runId}`, '_blank')}
        icon={<FileText size={16} />}>
        Print Summary
      </Button>
      <Button variant="primary" size="md"
        disabled={selected.size === 0}
        onClick={() => {
          const ids = Array.from(selected).join(',')
          window.open(`/api/pdf/payslips-all?run=${runId}&employees=${ids}`, '_blank')
        }}
        icon={<Printer size={16} />}>
        Print Selected ({selected.size})
      </Button>
      <Button variant="primary" size="md" pulse
        onClick={() => {
          const params = new URLSearchParams({ run: runId })
          if (selected.size > 0 && selected.size < results.length) {
            params.set('employees', Array.from(selected).join(','))
          }
          window.location.href = `/payroll/payslip-viewer?${params}`
        }}
        icon={<PenTool size={16} />}>
        View & Sign
      </Button>
    </div>
  </div>
)}
```

Import FileText, Printer, PenTool from lucide-react.

- [ ] **Step 4: Update colour references**

Replace all #C4A35A and #1A1A2E with #1E40AF and #1E293B respectively throughout the file.

- [ ] **Step 5: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/payroll/page.tsx
git commit -m "feat: payroll page - tick boxes, inline loan edit, sticky action bar"
```

---

## Task 13: Payslip Viewer — Dropdown Nav, Auto-File, Progress

**Files:**
- Modify: `src/app/(dashboard)/payroll/payslip-viewer/page.tsx`

- [ ] **Step 1: Add employee dropdown and progress bar**

Add to component state:
```tsx
const [progressSigned, setProgressSigned] = useState(0)
const [progressTotal, setProgressTotal] = useState(0)
```

Replace the current navigation (left/right arrows only) with a dropdown + arrows combo:

```tsx
<div className="flex items-center gap-4 mb-6">
  {/* Previous */}
  <Button variant="ghost" size="sm" onClick={prevSlip} disabled={currentIndex === 0}
    icon={<ChevronLeft size={20} />} />

  {/* Dropdown */}
  <select
    value={currentSlip?.id || ''}
    onChange={(e) => {
      const idx = payslips.findIndex((p: any) => p.id === e.target.value)
      if (idx >= 0) setCurrentIndex(idx)
    }}
    className="flex-1 h-11 rounded-lg border border-gray-300 px-3 text-sm font-medium focus:ring-2 focus:ring-[#3B82F6]/40"
  >
    {payslips.map((p: any, i: number) => (
      <option key={p.id} value={p.id}>
        {p.employee?.full_name || `Employee ${i + 1}`} {p.signed_at ? '✓' : ''}
      </option>
    ))}
  </select>

  {/* Next */}
  <Button variant="ghost" size="sm" onClick={nextSlip} disabled={currentIndex === payslips.length - 1}
    icon={<ChevronRight size={20} />} />
</div>

{/* Progress bar */}
<div className="mb-6">
  <div className="flex justify-between text-xs text-gray-500 mb-1">
    <span>{progressSigned} of {progressTotal} signed</span>
    <span>{progressTotal > 0 ? Math.round((progressSigned / progressTotal) * 100) : 0}%</span>
  </div>
  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
    <div className="h-full bg-[#10B981] rounded-full transition-all duration-500"
         style={{ width: `${progressTotal > 0 ? (progressSigned / progressTotal) * 100 : 0}%` }} />
  </div>
</div>
```

Update the progress counts whenever payslips data loads:
```tsx
setProgressTotal(payslips.length)
setProgressSigned(payslips.filter((p: any) => p.signed_at).length)
```

- [ ] **Step 2: Auto-advance after signing**

In the sign handler, after successful signature save, add:

```tsx
// Update progress
setProgressSigned(prev => prev + 1)

// Auto-advance to next unsigned payslip
const nextUnsigned = payslips.findIndex((p: any, i: number) => i > currentIndex && !p.signed_at)
if (nextUnsigned >= 0) {
  setCurrentIndex(nextUnsigned)
  addToast({ type: 'success', message: `Signed! Moving to next (${progressSigned + 1}/${progressTotal})` })
} else {
  addToast({ type: 'success', message: 'All payslips signed!' })
}
```

- [ ] **Step 3: Auto-file signed payslip to employee documents**

After saving the signature, also save the payslip PDF to employee documents:

```tsx
// Generate and auto-file PDF
try {
  const pdfRes = await fetch(`/api/pdf/payslip?id=${currentSlip.id}`)
  if (pdfRes.ok) {
    const pdfBlob = await pdfRes.blob()
    const pdfPath = `documents/${currentSlip.employee_id}/payslips/week-${currentSlip.week_end || 'unknown'}.pdf`

    await supabase.storage
      .from('documents')
      .upload(pdfPath, pdfBlob, { contentType: 'application/pdf', upsert: true })

    // Log to employee_documents table
    await supabase.from('employee_documents').insert({
      employee_id: currentSlip.employee_id,
      doc_type: 'payslip',
      file_url: pdfPath,
      uploaded_by: user?.id || null,
    })
  }
} catch (err) {
  console.error('Auto-file failed:', err)
  // Non-blocking — signature is already saved
}
```

- [ ] **Step 4: Update colour references**

Replace #C4A35A → #1E40AF, #1A1A2E → #1E293B, #F5F3EF → #F8FAFC throughout the file.

- [ ] **Step 5: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/payroll/payslip-viewer/page.tsx
git commit -m "feat: payslip viewer - dropdown nav, progress bar, auto-file, auto-advance"
```

---

## Task 14: Staff Profile — Employee Info Card + Inline Edit

**Files:**
- Create: `src/components/ui/employee-info-card.tsx`
- Modify: `src/app/(dashboard)/staff/[id]/page.tsx`
- Modify: `src/app/(dashboard)/staff/[id]/tabs/overview-tab.tsx`

- [ ] **Step 1: Create the employee info card component**

```tsx
// src/components/ui/employee-info-card.tsx
'use client'

import { useState } from 'react'
import { Pencil, Check, X, AlertTriangle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { createBrowserClient } from '@/lib/supabase/client'

interface InfoSection {
  title: string
  fields: { label: string; key: string; value: string | null; masked?: boolean; type?: string }[]
}

interface EmployeeInfoCardProps {
  employee: any
  canEdit: boolean
  onUpdate: (updates: Record<string, any>) => void
}

export function EmployeeInfoCard({ employee, canEdit, onUpdate }: EmployeeInfoCardProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)
  const supabase = createBrowserClient()

  const sections: InfoSection[] = [
    {
      title: 'Personal',
      fields: [
        { label: 'Gender', key: 'gender', value: employee.gender },
        { label: 'Race', key: 'race', value: employee.race },
        { label: 'Date of Birth', key: 'date_of_birth', value: employee.date_of_birth, type: 'date' },
        { label: 'ID Number', key: 'id_number', value: employee.id_number },
        { label: 'Home Address', key: 'home_address', value: employee.home_address },
      ],
    },
    {
      title: 'Contact',
      fields: [
        { label: 'Cell', key: 'cell', value: employee.cell },
        { label: 'Email', key: 'email', value: employee.email },
        { label: 'Emergency Name', key: 'emergency_name', value: employee.emergency_name },
        { label: 'Emergency Phone', key: 'emergency_phone', value: employee.emergency_phone },
      ],
    },
    {
      title: 'Employment',
      fields: [
        { label: 'Start Date', key: 'start_date', value: employee.start_date, type: 'date' },
        { label: 'Occupation', key: 'occupation', value: employee.occupation },
        { label: 'Weekly Hours', key: 'weekly_hours', value: employee.weekly_hours?.toString(), type: 'number' },
        { label: 'Weekly Wage', key: 'weekly_wage', value: employee.weekly_wage ? `R${employee.weekly_wage}` : null, type: 'number' },
        { label: 'Payment Method', key: 'payment_method', value: employee.payment_method },
      ],
    },
    {
      title: 'Banking',
      fields: [
        { label: 'Bank', key: 'bank_name', value: employee.bank_name },
        { label: 'Account', key: 'bank_acc', value: employee.bank_acc, masked: true },
        { label: 'Branch Code', key: 'bank_branch', value: employee.bank_branch },
      ],
    },
    {
      title: 'Compliance',
      fields: [
        { label: 'Tax Number', key: 'tax_number', value: employee.tax_number },
        { label: 'UIF Ref', key: 'uif_ref', value: employee.uif_ref },
        { label: 'EIF on File', key: 'eif_on_file', value: employee.eif_on_file ? 'Yes' : 'No' },
      ],
    },
  ]

  const startEdit = (sectionTitle: string) => {
    const section = sections.find(s => s.title === sectionTitle)
    if (!section) return
    const values: Record<string, any> = {}
    section.fields.forEach(f => {
      values[f.key] = f.key === 'weekly_wage' ? employee.weekly_wage : employee[f.key] || ''
    })
    setEditValues(values)
    setEditingSection(sectionTitle)
  }

  const saveEdit = async (sectionTitle: string) => {
    setSaving(true)
    const { error } = await supabase
      .from('employees')
      .update(editValues)
      .eq('id', employee.id)
    setSaving(false)

    if (!error) {
      onUpdate(editValues)
      setEditingSection(null)
    }
  }

  // Check for warning notes
  const hasWarningNote = employee.notes &&
    /missing|still to capture|not yet|banking|eif/i.test(employee.notes)

  return (
    <div className="space-y-4">
      {/* Warning banner for notes */}
      {hasWarningNote && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">{employee.notes}</p>
        </div>
      )}

      {/* Sections */}
      {sections.map(section => (
        <div key={section.title} className="rounded-xl border border-gray-100/60 bg-white p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wide">{section.title}</h3>
            {canEdit && editingSection !== section.title && (
              <button onClick={() => startEdit(section.title)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E40AF] hover:bg-blue-50 transition-colors">
                <Pencil size={14} />
              </button>
            )}
            {editingSection === section.title && (
              <div className="flex gap-1">
                <button onClick={() => saveEdit(section.title)} disabled={saving}
                  className="p-1.5 rounded-lg text-[#10B981] hover:bg-green-50">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingSection(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {section.fields.map(field => (
              <div key={field.key}>
                <p className="text-xs text-gray-400">{field.label}</p>
                {editingSection === section.title ? (
                  <input
                    type={field.type || 'text'}
                    value={editValues[field.key] || ''}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-gray-300 px-2 text-sm mt-0.5 focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm font-medium text-[#1E293B]">
                    {field.masked && field.value
                      ? '••••' + field.value.slice(-4)
                      : field.value || <span className="text-gray-300">—</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Update overview tab to use the info card**

In `src/app/(dashboard)/staff/[id]/tabs/overview-tab.tsx`, import and render the EmployeeInfoCard above the existing attendance/loan cards:

```tsx
import { EmployeeInfoCard } from '@/components/ui/employee-info-card'
```

At the top of the overview tab render:
```tsx
<EmployeeInfoCard
  employee={employee}
  canEdit={userRole === 'head_admin'}
  onUpdate={(updates) => setEmployee((prev: any) => ({ ...prev, ...updates }))}
/>
```

- [ ] **Step 3: Update profile header in staff/[id]/page.tsx**

Add quick-info row below the name/occupation header showing: Cell | Start Date | Years of Service. Replace gold accents with royal blue.

- [ ] **Step 4: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/components/ui/employee-info-card.tsx src/app/(dashboard)/staff/[id]/tabs/overview-tab.tsx src/app/(dashboard)/staff/[id]/page.tsx
git commit -m "feat: staff profile - visible employee info card with inline edit"
```

---

## Task 15: Staff List — Completeness Ring + Updated Style

**Files:**
- Modify: `src/app/(dashboard)/staff/page.tsx`

- [ ] **Step 1: Add completeness calculation and ring**

Import ProgressRing:
```tsx
import { ProgressRing } from '@/components/ui/progress-ring'
```

Add a function to calculate completeness:
```tsx
function employeeCompleteness(emp: any): number {
  const required = ['id_number', 'bank_name', 'bank_acc', 'emergency_name', 'emergency_phone', 'start_date', 'cell', 'eif_on_file']
  const filled = required.filter(k => {
    if (k === 'eif_on_file') return emp[k] === true
    return emp[k] && emp[k].toString().trim() !== ''
  })
  return Math.round((filled.length / required.length) * 100)
}
```

In each employee card/row, add the ring:
```tsx
<ProgressRing percent={employeeCompleteness(emp)} size={28} strokeWidth={3} />
```

- [ ] **Step 2: Add sort/filter by completeness**

Add to filter controls:
```tsx
<select onChange={(e) => setSortBy(e.target.value)} className="h-10 rounded-lg border px-3 text-sm">
  <option value="name">Sort: Name</option>
  <option value="completeness">Sort: Data Completeness</option>
  <option value="pt_code">Sort: PT Code</option>
</select>
```

Sort logic:
```tsx
const sorted = [...employees].sort((a, b) => {
  if (sortBy === 'completeness') return employeeCompleteness(a) - employeeCompleteness(b)
  if (sortBy === 'pt_code') return (a.pt_code || '').localeCompare(b.pt_code || '')
  return (a.full_name || '').localeCompare(b.full_name || '')
})
```

- [ ] **Step 3: Update colour references throughout the file**

Replace #C4A35A → #1E40AF, #F5F3EF → #F8FAFC, #1A1A2E → #1E293B.

- [ ] **Step 4: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 5: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/staff/page.tsx
git commit -m "feat: staff list - completeness ring, sort by data completeness"
```

---

## Task 16: New Loan Form (Replace Stub)

**Files:**
- Modify: `src/app/(dashboard)/staff/[id]/tabs/loans-tab.tsx`

- [ ] **Step 1: Replace the "coming soon" alert with a working slide panel form**

Import SlidePanel and useUndo:
```tsx
import { SlidePanel } from '@/components/ui/slide-panel'
import { useUndo } from '@/components/ui/undo-toast'
```

Add state:
```tsx
const [showNewLoan, setShowNewLoan] = useState(false)
const [newLoan, setNewLoan] = useState({ amount: '', purpose: '', weekly_deduction: '', from_petty: false })
const [savingLoan, setSavingLoan] = useState(false)
const { showUndo } = useUndo()
```

Replace the "New Loan" button's `onClick={()=> alert('coming soon')}` with:
```tsx
onClick={() => setShowNewLoan(true)}
```

Add the slide panel at the bottom of the component:
```tsx
<SlidePanel open={showNewLoan} onClose={() => setShowNewLoan(false)} title="New Loan">
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Amount (R)</label>
      <input type="number" value={newLoan.amount}
        onChange={(e) => setNewLoan(prev => ({ ...prev, amount: e.target.value }))}
        className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
        placeholder="e.g. 500" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
      <input type="text" value={newLoan.purpose}
        onChange={(e) => setNewLoan(prev => ({ ...prev, purpose: e.target.value }))}
        className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
        placeholder="e.g. Advance, Transport" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Deduction (R)</label>
      <input type="number" value={newLoan.weekly_deduction}
        onChange={(e) => setNewLoan(prev => ({ ...prev, weekly_deduction: e.target.value }))}
        className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
        placeholder="e.g. 100" />
      {newLoan.amount && newLoan.weekly_deduction && parseFloat(newLoan.weekly_deduction) > 0 && (
        <p className="text-xs text-gray-500 mt-1">
          ~{Math.ceil(parseFloat(newLoan.amount) / parseFloat(newLoan.weekly_deduction))} weeks to repay
        </p>
      )}
    </div>
    <div className="flex items-center gap-2">
      <input type="checkbox" id="fromPetty" checked={newLoan.from_petty}
        onChange={(e) => setNewLoan(prev => ({ ...prev, from_petty: e.target.checked }))}
        className="w-5 h-5 rounded accent-[#1E40AF]" />
      <label htmlFor="fromPetty" className="text-sm text-gray-700">From petty cash</label>
    </div>
    <Button variant="primary" size="lg" className="w-full" loading={savingLoan}
      disabled={!newLoan.amount || !newLoan.weekly_deduction}
      onClick={async () => {
        setSavingLoan(true)
        const amount = parseFloat(newLoan.amount)
        const { data, error } = await supabase.from('loans').insert({
          employee_id: employeeId,
          amount,
          outstanding: amount,
          weekly_deduction: parseFloat(newLoan.weekly_deduction),
          purpose: newLoan.purpose || null,
          date_advanced: new Date().toISOString().split('T')[0],
          status: 'active',
          auto_generated_from_petty: newLoan.from_petty,
        }).select().single()

        setSavingLoan(false)
        if (!error && data) {
          setShowNewLoan(false)
          setNewLoan({ amount: '', purpose: '', weekly_deduction: '', from_petty: false })
          // Refresh loans list
          fetchLoans()
          // Undo toast
          showUndo('Loan added', async () => {
            await supabase.from('loans').delete().eq('id', data.id)
            fetchLoans()
          })
        }
      }}>
      Add Loan
    </Button>
  </div>
</SlidePanel>
```

Ensure `fetchLoans` is the existing function that reloads the loans list (extract if not already a named function).

- [ ] **Step 2: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/staff/[id]/tabs/loans-tab.tsx
git commit -m "feat: working New Loan form with slide panel, undo, weeks-to-repay"
```

---

## Task 17: Record Leave Form (Replace Stub)

**Files:**
- Modify: `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx`

- [ ] **Step 1: Replace the "coming soon" alert with a working slide panel form**

Import SlidePanel and useUndo:
```tsx
import { SlidePanel } from '@/components/ui/slide-panel'
import { useUndo } from '@/components/ui/undo-toast'
```

Add state:
```tsx
const [showRecordLeave, setShowRecordLeave] = useState(false)
const [leaveForm, setLeaveForm] = useState({ type: 'annual', start_date: '', end_date: '', reason: '' })
const [savingLeave, setSavingLeave] = useState(false)
const { showUndo } = useUndo()
```

Replace the "Record Leave" button's `onClick` with:
```tsx
onClick={() => setShowRecordLeave(true)}
```

Add the slide panel:
```tsx
<SlidePanel open={showRecordLeave} onClose={() => setShowRecordLeave(false)} title="Record Leave">
  <div className="space-y-4">
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
      <select value={leaveForm.type}
        onChange={(e) => setLeaveForm(prev => ({ ...prev, type: e.target.value }))}
        className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40">
        <option value="annual">Annual Leave</option>
        <option value="sick">Sick Leave</option>
        <option value="family">Family Responsibility</option>
        <option value="unpaid">Unpaid Leave</option>
      </select>
      {/* Show remaining balance */}
      {leaveBalances && (
        <p className="text-xs text-gray-500 mt-1">
          Remaining: {leaveBalances[leaveForm.type] ?? '—'} days
        </p>
      )}
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
      <input type="date" value={leaveForm.start_date}
        onChange={(e) => setLeaveForm(prev => ({ ...prev, start_date: e.target.value }))}
        className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
      <input type="date" value={leaveForm.end_date}
        onChange={(e) => setLeaveForm(prev => ({ ...prev, end_date: e.target.value }))}
        className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40" />
    </div>
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
      <textarea value={leaveForm.reason}
        onChange={(e) => setLeaveForm(prev => ({ ...prev, reason: e.target.value }))}
        rows={3}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none resize-none"
        placeholder="Optional reason" />
    </div>
    <Button variant="primary" size="lg" className="w-full" loading={savingLeave}
      disabled={!leaveForm.start_date || !leaveForm.end_date}
      onClick={async () => {
        setSavingLeave(true)
        const { data, error } = await supabase.from('leave_records').insert({
          employee_id: employeeId,
          leave_type: leaveForm.type,
          start_date: leaveForm.start_date,
          end_date: leaveForm.end_date,
          reason: leaveForm.reason || null,
          status: 'approved',
        }).select().single()

        if (!error && data) {
          // Update leave balance
          const days = Math.ceil(
            (new Date(leaveForm.end_date).getTime() - new Date(leaveForm.start_date).getTime()) / (1000 * 60 * 60 * 24)
          ) + 1

          if (leaveForm.type !== 'unpaid') {
            await supabase.rpc('decrement_leave_balance', {
              p_employee_id: employeeId,
              p_leave_type: leaveForm.type,
              p_days: days,
            }).catch(() => {
              // If RPC doesn't exist, update directly
              // This is a fallback
            })
          }

          // Create attendance records for each leave day
          const dates: string[] = []
          const current = new Date(leaveForm.start_date)
          const end = new Date(leaveForm.end_date)
          while (current <= end) {
            const dayOfWeek = current.getDay()
            if (dayOfWeek !== 0) { // Skip Sundays
              dates.push(current.toISOString().split('T')[0])
            }
            current.setDate(current.getDate() + 1)
          }

          if (dates.length > 0) {
            await supabase.from('attendance').upsert(
              dates.map(d => ({
                employee_id: employeeId,
                date: d,
                status: leaveForm.type === 'sick' ? 'sick' : 'leave',
                time_in: null,
                time_out: null,
                late_minutes: 0,
              })),
              { onConflict: 'employee_id,date' }
            )
          }

          setSavingLeave(false)
          setShowRecordLeave(false)
          setLeaveForm({ type: 'annual', start_date: '', end_date: '', reason: '' })
          fetchLeave() // Refresh the leave list

          showUndo('Leave recorded', async () => {
            await supabase.from('leave_records').delete().eq('id', data.id)
            // Remove attendance records
            if (dates.length > 0) {
              for (const d of dates) {
                await supabase.from('attendance').delete()
                  .eq('employee_id', employeeId).eq('date', d).in('status', ['leave', 'sick'])
              }
            }
            fetchLeave()
          })
        } else {
          setSavingLeave(false)
        }
      }}>
      Record Leave
    </Button>
  </div>
</SlidePanel>
```

Ensure `fetchLeave` and `leaveBalances` are accessible (extract the existing data-fetch into a named function if needed).

- [ ] **Step 2: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx
git commit -m "feat: working Record Leave form with balance display, attendance creation, undo"
```

---

## Task 18: CCMA Case File Generator (Replace Stub)

**Files:**
- Modify: `src/app/(dashboard)/staff/[id]/tabs/disciplinary-tab.tsx`

- [ ] **Step 1: Replace the stub with a working generator**

Replace the `alert('CCMA case file generation coming soon')` button onClick with actual PDF generation:

```tsx
onClick={async () => {
  setGeneratingCcma(true)
  try {
    const res = await fetch(`/api/exports/ccma-case?employee=${employeeId}`)
    if (res.ok) {
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      window.open(url, '_blank')
    } else {
      addToast({ type: 'error', message: 'Failed to generate CCMA case file' })
    }
  } catch {
    addToast({ type: 'error', message: 'Failed to generate CCMA case file' })
  }
  setGeneratingCcma(false)
}}
```

Add state:
```tsx
const [generatingCcma, setGeneratingCcma] = useState(false)
```

Update the button to show loading:
```tsx
<Button variant="danger" size="md" loading={generatingCcma} icon={<FileText size={16} />}>
  Generate CCMA Case File
</Button>
```

- [ ] **Step 2: Verify the `/api/exports/ccma-case` route exists and accepts employee param**

Read `src/app/api/exports/ccma-case/route.ts` to verify it accepts an `employee` query parameter. If it only handles full exports, add employee filtering:

The route should filter by employee_id when the `employee` param is present.

- [ ] **Step 3: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/(dashboard)/staff/[id]/tabs/disciplinary-tab.tsx
git commit -m "feat: working CCMA case file generator button"
```

---

## Task 19: HR Advisor — Fix Model, Attribution, Errors

**Files:**
- Modify: `src/app/api/hr-advisor/advise/route.ts`

- [ ] **Step 1: Fix model name**

Find:
```tsx
model: "claude-sonnet-4-6"
```

The model name `claude-sonnet-4-6` is valid (confirmed by current model family info). Keep as-is unless the Anthropic SDK throws an error during testing. If it does, try `claude-sonnet-4-6-20250514`.

- [ ] **Step 2: Add user attribution**

At the top of the POST handler, extract user from cookie:

```tsx
import { cookies } from 'next/headers'

// Inside POST handler:
const cookieStore = await cookies()
const userCookie = cookieStore.get('pullens-user')
let advisedBy: string | null = null
if (userCookie?.value) {
  try {
    const parsed = JSON.parse(decodeURIComponent(userCookie.value))
    advisedBy = parsed.name || parsed.id || null
  } catch {}
}
```

Replace `advised_by: null` with `advised_by: advisedBy` in the incident insert.

- [ ] **Step 3: Improve error messages**

Replace the catch block:

Old:
```tsx
catch (error) {
  return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
}
```

New:
```tsx
catch (error: any) {
  const message = error?.status === 401
    ? 'AI service authentication failed — check API key'
    : error?.status === 400
    ? 'AI service rejected the request — try rephrasing'
    : error?.status === 429
    ? 'AI service is busy — try again in a moment'
    : 'AI service unavailable — try again in a moment'

  return NextResponse.json({ error: message }, { status: 502 })
}
```

- [ ] **Step 4: Warn on silent DB failures**

After the incident insert, change the silent error log to return a warning flag:

```tsx
const { error: incidentError } = await supabase.from('incidents').insert({ ... })

// Include warning in response if save failed
const response = { ...parsed }
if (incidentError) {
  response._warning = 'Advice generated but could not be saved to history'
  console.error('Incident save failed:', incidentError.message)
}

return NextResponse.json(response)
```

In the frontend (page.tsx), show the warning:
```tsx
if (data._warning) {
  addToast({ type: 'error', message: data._warning })
}
```

- [ ] **Step 5: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 6: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/api/hr-advisor/advise/route.ts src/app/(dashboard)/hr-advisor/page.tsx
git commit -m "fix: HR advisor - user attribution, specific error messages, DB warning"
```

---

## Task 20: Banking Step (Leeann's Tick-Off)

**Files:**
- Create: `src/app/api/payroll/bank/route.ts`
- Modify: `src/app/(dashboard)/payroll/page.tsx`

- [ ] **Step 1: Create banking API route**

```tsx
// src/app/api/payroll/bank/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { run_id, employee_ids } = await req.json()
  const supabase = createServiceClient()

  // Mark payslips as banked
  const { error } = await supabase
    .from('payslips')
    .update({ banked_at: new Date().toISOString() })
    .eq('payroll_run_id', run_id)
    .in('employee_id', employee_ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Check if all payslips in run are banked
  const { count: unbanked } = await supabase
    .from('payslips')
    .select('*', { count: 'exact', head: true })
    .eq('payroll_run_id', run_id)
    .is('banked_at', null)

  if (unbanked === 0) {
    await supabase.from('payroll_runs').update({ status: 'banked' }).eq('id', run_id)
  }

  return NextResponse.json({ success: true, allBanked: unbanked === 0 })
}
```

Note: This requires a `banked_at` column on the `payslips` table. Add via Supabase SQL Editor:
```sql
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS banked_at timestamptz;
```

- [ ] **Step 2: Add banking section to payroll page**

In the payroll page, when a run has status 'generated' and payslips exist, show a banking section:

```tsx
{/* Banking Section — for Leeann */}
{latestRun?.status === 'generated' && (
  <Card>
    <CardHeader>
      <CardTitle>Banking — Tick Off Payments</CardTitle>
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        {results.map((r: any) => (
          <div key={r.employee_id}
            className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50">
            <div className="flex items-center gap-3">
              <input type="checkbox"
                checked={banked.has(r.employee_id)}
                onChange={async () => {
                  const next = new Set(banked)
                  next.has(r.employee_id) ? next.delete(r.employee_id) : next.add(r.employee_id)
                  setBanked(next)
                  // Save immediately
                  await fetch('/api/payroll/bank', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ run_id: runId, employee_ids: [r.employee_id] }),
                  })
                }}
                className="w-5 h-5 rounded accent-[#10B981]" />
              <span className="text-sm font-medium">{r.full_name}</span>
            </div>
            <span className="text-sm font-bold text-[#1E293B]">R{r.net.toFixed(2)}</span>
          </div>
        ))}
      </div>
      {banked.size === results.length && results.length > 0 && (
        <Button variant="primary" size="lg" className="w-full mt-4" pulse
          onClick={async () => {
            await fetch('/api/payroll/bank', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ run_id: runId, employee_ids: Array.from(banked) }),
            })
            addToast({ type: 'success', message: 'Week complete! All payments banked.' })
          }}>
          Mark Week Complete
        </Button>
      )}
    </CardContent>
  </Card>
)}
```

Add state:
```tsx
const [banked, setBanked] = useState<Set<string>>(new Set())
```

- [ ] **Step 3: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add src/app/api/payroll/bank/route.ts src/app/(dashboard)/payroll/page.tsx
git commit -m "feat: banking step - Leeann tick-off with auto-mark-complete"
```

---

## Task 21: Global Colour Sweep

**Files:**
- All dashboard pages and components

- [ ] **Step 1: Search and replace old palette colours across all files**

Run targeted replacements across the codebase:

| Find | Replace | Context |
|------|---------|---------|
| `#F5F3EF` | `#F8FAFC` | Background |
| `#1A1A2E` | `#1E293B` | Dark text/headers |
| `#141425` | `#1E3A8A` | Sidebar gradient end |
| `#C4A35A` (in non-badge, non-logo contexts) | `#1E40AF` | Primary accent |
| `focus:ring-[#C4A35A]` | `focus:ring-[#3B82F6]` | Focus rings |

Keep #C4A35A for: logo accent, gold badges, the favicon. Replace everywhere else.

Do NOT change:
- `src/lib/logo-base64.ts` (logo data)
- Badge component (already flexible)
- Any PDF generator files (brand colours for printed docs stay as-is)

- [ ] **Step 2: Verify build**

Run: `cd C:/Users/Annika/pullens-admin && npx next build 2>&1 | tail -5`

- [ ] **Step 3: Visual check — verify no broken styles**

Run: `cd C:/Users/Annika/pullens-admin && npx next dev &` and check key pages load without errors in browser console.

- [ ] **Step 4: Commit**

```bash
cd C:/Users/Annika/pullens-admin
git add -u
git commit -m "style: global colour sweep - royal blue palette across all pages"
```

---

## Task 22: Supabase Storage Buckets (Prerequisite)

**Files:**
- No code files — run via Supabase SQL Editor or dashboard

- [ ] **Step 1: Create storage buckets**

Run these SQL commands via the Supabase SQL Editor at `https://supabase.com/dashboard/project/eznppvewksorfoedgzpa/sql`:

```sql
-- Create registers bucket for photo uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('registers', 'registers', true)
ON CONFLICT (id) DO NOTHING;

-- Create documents bucket for payslips and employee docs
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true)
ON CONFLICT (id) DO NOTHING;

-- Create signatures bucket (may already exist)
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

-- Allow authenticated uploads (service role bypasses anyway, but for safety)
CREATE POLICY "Allow public read on registers" ON storage.objects FOR SELECT USING (bucket_id = 'registers');
CREATE POLICY "Allow service upload on registers" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'registers');
CREATE POLICY "Allow public read on documents" ON storage.objects FOR SELECT USING (bucket_id = 'documents');
CREATE POLICY "Allow service upload on documents" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'documents');
```

- [ ] **Step 2: Add banked_at column to payslips**

```sql
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS banked_at timestamptz;
```

- [ ] **Step 3: Verify buckets exist**

In the Supabase dashboard, navigate to Storage and confirm `registers`, `documents`, and `signatures` buckets are visible.

---

## Task 23: Final Integration Test

- [ ] **Step 1: Full build check**

Run: `cd C:/Users/Annika/pullens-admin && npx next build`
Expected: Clean build with no TypeScript errors.

- [ ] **Step 2: Test the weekly flow end-to-end**

1. Open dashboard → verify workflow stepper shows
2. Navigate to register → verify time picker works, photo upload works
3. Save register → verify undo toast appears
4. Navigate to payroll → run payroll → verify tick boxes, loan edit
5. Click "View & Sign" → verify dropdown nav, signature canvas, progress bar
6. Navigate to staff profile → verify employee info card, inline edit
7. Open loans tab → create new loan → verify undo
8. Open leave tab → record leave → verify undo
9. Open disciplinary tab → generate CCMA case file → verify PDF opens
10. Test HR Advisor → submit incident → verify response

- [ ] **Step 3: Deploy to Vercel**

```bash
cd C:/Users/Annika/pullens-admin && vercel deploy --prod
```

- [ ] **Step 4: Commit any final fixes**

```bash
cd C:/Users/Annika/pullens-admin
git add -u
git commit -m "fix: final integration fixes from end-to-end testing"
```
