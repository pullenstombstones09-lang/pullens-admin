'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Landmark, CheckCircle, Circle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toast'
import { SkeletonCard, SkeletonTable } from '@/components/ui/skeleton'
import { formatCurrency } from '@/lib/utils'
import { cn } from '@/lib/utils'

// ---------- types ----------

interface PayslipRow {
  id: string
  employee_id: string
  net: number
  banked_at: string | null
  employees: {
    full_name: string
    pt_code: string
  } | null
}

interface RunRow {
  id: string
  week_start: string
  week_end: string
  status: string
}

// ---------- helpers ----------

function weekLabel(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00')
  const e = new Date(end + 'T00:00:00')
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })
  return `${fmt(s)} – ${fmt(e)} ${e.getFullYear()}`
}

// ---------- component ----------

export default function BankingPage() {
  const supabase = createClient()
  const { toast } = useToast()

  const [run, setRun] = useState<RunRow | null>(null)
  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [ticked, setTicked] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [completing, setCompleting] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ---------- load data ----------

  useEffect(() => {
    async function load() {
      setLoading(true)
      setError(null)

      // Most recent run
      const { data: runs, error: runErr } = await supabase
        .from('payroll_runs')
        .select('id, week_start, week_end, status')
        .order('created_at', { ascending: false })
        .limit(1)

      if (runErr || !runs || runs.length === 0) {
        setError(runErr?.message ?? 'No payroll runs found.')
        setLoading(false)
        return
      }

      const latestRun = runs[0] as RunRow
      setRun(latestRun)

      // Payslips for that run
      const { data: slips, error: slipErr } = await supabase
        .from('payslips')
        .select('id, employee_id, net, banked_at, employees(full_name, pt_code)')
        .eq('payroll_run_id', latestRun.id)
        .order('employees(full_name)')

      if (slipErr) {
        setError(slipErr.message)
        setLoading(false)
        return
      }

      const rows = (slips ?? []) as unknown as PayslipRow[]
      setPayslips(rows)

      // Default all employees to ticked
      const allEmployeeIds = new Set(rows.map((r) => r.employee_id))
      setTicked(allEmployeeIds)
      setLoading(false)
    }

    load()
  }, [])

  // ---------- tick handler ----------

  const handleTick = async (employeeId: string) => {
    if (!run) return

    const wasTickedBefore = ticked.has(employeeId)

    // Optimistic local toggle
    setTicked((prev) => {
      const next = new Set(prev)
      wasTickedBefore ? next.delete(employeeId) : next.add(employeeId)
      return next
    })

    setSaving((prev) => new Set(prev).add(employeeId))

    try {
      if (!wasTickedBefore) {
        // Mark banked
        await fetch('/api/payroll/bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id: run.id, employee_ids: [employeeId] }),
        })
      } else {
        // Clear banked_at — untick
        await supabase
          .from('payslips')
          .update({ banked_at: null })
          .eq('payroll_run_id', run.id)
          .eq('employee_id', employeeId)
      }
    } catch {
      // Revert on failure
      setTicked((prev) => {
        const next = new Set(prev)
        wasTickedBefore ? next.add(employeeId) : next.delete(employeeId)
        return next
      })
      toast('error', 'Failed to update banking status — check connection and retry')
    } finally {
      setSaving((prev) => {
        const next = new Set(prev)
        next.delete(employeeId)
        return next
      })
    }
  }

  // ---------- mark week complete ----------

  const handleMarkComplete = async () => {
    if (!run) return
    setCompleting(true)
    try {
      // Final bank call with all employee ids to trigger status update
      await fetch('/api/payroll/bank', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          run_id: run.id,
          employee_ids: payslips.map((p) => p.employee_id),
        }),
      })
      // Refresh run status
      const { data } = await supabase
        .from('payroll_runs')
        .select('id, week_start, week_end, status')
        .eq('id', run.id)
        .single()
      if (data) setRun(data as RunRow)
    } finally {
      setCompleting(false)
    }
  }

  // ---------- derived ----------

  const allTicked = payslips.length > 0 && ticked.size === payslips.length
  const totalToPay = payslips.reduce((s, p) => s + (p.net ?? 0), 0)
  const totalBanked = payslips
    .filter((p) => ticked.has(p.employee_id))
    .reduce((s, p) => s + (p.net ?? 0), 0)

  // ---------- render ----------

  if (loading) {
    return (
      <div className="space-y-5 max-w-2xl">
        <SkeletonCard />
        <SkeletonTable rows={8} cols={3} />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-3">
          <p className="text-sm text-red-500">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="text-sm font-semibold text-[#3B82F6] hover:underline"
          >
            Retry
          </button>
        </div>
      </div>
    )
  }

  if (!run || payslips.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <div className="text-center space-y-3">
          <Landmark size={36} className="mx-auto text-gray-300" />
          <p className="text-sm font-medium text-gray-500">Payroll hasn&apos;t run yet</p>
          <a href="/payroll" className="text-sm font-semibold text-[#3B82F6] hover:underline">
            Run payroll &rarr;
          </a>
        </div>
      </div>
    )
  }

  const isComplete = run.status === 'banked' || run.status === 'paid'

  return (
    <div className="space-y-5 max-w-2xl">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Landmark size={20} className="text-[#1E40AF]" />
            <h1 className="text-xl font-black text-[#1E293B] tracking-tight">Banking</h1>
            {isComplete && (
              <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-semibold text-green-700">
                <CheckCircle size={12} />
                Complete
              </span>
            )}
          </div>
          <p className="mt-0.5 text-sm text-gray-500">{weekLabel(run.week_start, run.week_end)}</p>
        </div>

        {/* Total */}
        <div className="text-right shrink-0">
          <p className="text-2xl font-black text-[#1E293B] tabular-nums">
            {formatCurrency(totalToPay)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">total to bank</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{ticked.size} of {payslips.length} banked</span>
          <span className="font-semibold text-[#1E293B]">{formatCurrency(totalBanked)} sent</span>
        </div>
        <div className="h-2 w-full rounded-full bg-gray-100 overflow-hidden">
          <div
            className="h-full rounded-full bg-green-500 transition-all duration-300"
            style={{ width: `${payslips.length > 0 ? (ticked.size / payslips.length) * 100 : 0}%` }}
          />
        </div>
      </div>

      {/* Employee list */}
      <div className="rounded-xl border border-gray-100 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] overflow-hidden">
        {payslips.map((payslip, idx) => {
          const isTicked = ticked.has(payslip.employee_id)
          const isSaving = saving.has(payslip.employee_id)
          const name = payslip.employees?.full_name ?? '—'
          const ptCode = payslip.employees?.pt_code ?? ''

          return (
            <button
              key={payslip.id}
              onClick={() => handleTick(payslip.employee_id)}
              disabled={isSaving}
              className={cn(
                'w-full flex items-center justify-between gap-4 px-4 py-3.5 text-left',
                'transition-colors duration-150',
                idx !== payslips.length - 1 && 'border-b border-gray-100',
                isTicked
                  ? 'bg-green-50/60 hover:bg-green-50'
                  : 'bg-white hover:bg-gray-50/60',
                isSaving && 'opacity-60 pointer-events-none'
              )}
            >
              {/* Tick icon */}
              <div className="shrink-0">
                {isTicked ? (
                  <CheckCircle size={22} className="text-green-500" />
                ) : (
                  <Circle size={22} className="text-gray-300" />
                )}
              </div>

              {/* Name + code */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-semibold truncate',
                  isTicked ? 'text-green-800' : 'text-[#1E293B]'
                )}>
                  {name}
                </p>
                <p className="text-xs text-gray-400 font-mono">{ptCode}</p>
              </div>

              {/* Net pay */}
              <div className="shrink-0 text-right">
                <p className={cn(
                  'text-base font-black tabular-nums',
                  isTicked ? 'text-green-700' : 'text-[#1E293B]'
                )}>
                  {formatCurrency(payslip.net ?? 0)}
                </p>
                {isTicked && (
                  <p className="text-xs text-green-600 font-medium">banked</p>
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* Mark Week Complete */}
      {!isComplete && (
        <div className="space-y-1">
          <Button
            variant="primary"
            size="lg"
            loading={completing}
            disabled={!allTicked}
            icon={<CheckCircle size={18} />}
            onClick={handleMarkComplete}
            className="w-full"
          >
            Mark Week Complete
          </Button>
          {!allTicked && (
            <p className="text-xs text-center text-gray-400">
              {payslips.length - ticked.size} employee{payslips.length - ticked.size !== 1 ? 's' : ''} unticked — resolve or confirm unpaid
            </p>
          )}
        </div>
      )}

      {isComplete && (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-green-200 bg-green-50 py-4">
          <CheckCircle size={18} className="text-green-600" />
          <p className="text-sm font-semibold text-green-700">Week marked complete — all payments sent</p>
        </div>
      )}
    </div>
  )
}
