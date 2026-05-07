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
    bank_name: string | null
    payment_method: string | null
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
  const [ticked, setTicked] = useState<Map<string, 'eft' | 'cash'>>(new Map()) // employee_id → method
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
        .select('id, employee_id, net, banked_at, employees(full_name, pt_code, bank_name, payment_method)')
        .eq('payroll_run_id', latestRun.id)
        .order('employees(full_name)')

      if (slipErr) {
        setError(slipErr.message)
        setLoading(false)
        return
      }

      const rows = (slips ?? []) as unknown as PayslipRow[]
      setPayslips(rows)

      // Only tick employees that were already banked (banked_at not null)
      const alreadyBanked = new Map<string, 'eft' | 'cash'>()
      rows.filter((r) => r.banked_at).forEach((r) => {
        const method = (r.employees?.payment_method === 'cash' ? 'cash' : 'eft') as 'eft' | 'cash'
        alreadyBanked.set(r.employee_id, method)
      })
      setTicked(alreadyBanked)
      setLoading(false)
    }

    load()
  }, [])

  // ---------- tick handler ----------

  const handleTick = async (employeeId: string, method: 'eft' | 'cash') => {
    if (!run) return

    const wasTickedWithSameMethod = ticked.get(employeeId) === method

    // Optimistic local toggle
    setTicked((prev) => {
      const next = new Map(prev)
      wasTickedWithSameMethod ? next.delete(employeeId) : next.set(employeeId, method)
      return next
    })

    setSaving((prev) => new Set(prev).add(employeeId))

    try {
      if (!wasTickedWithSameMethod) {
        // Mark banked
        await fetch('/api/payroll/bank', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ run_id: run.id, employee_ids: [employeeId] }),
        })
        // Update employee payment method
        await supabase
          .from('employees')
          .update({ payment_method: method })
          .eq('id', employeeId)
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
        const next = new Map(prev)
        wasTickedWithSameMethod ? next.set(employeeId, method) : next.delete(employeeId)
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
  const eftTotal = payslips.filter((p) => ticked.get(p.employee_id) === 'eft').reduce((s, p) => s + (p.net ?? 0), 0)
  const cashTotal = payslips.filter((p) => ticked.get(p.employee_id) === 'cash').reduce((s, p) => s + (p.net ?? 0), 0)
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
            <h1 className="text-xl font-black text-[var(--foreground)] tracking-tight">Banking</h1>
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
          <p className="text-2xl font-black text-[var(--foreground)] tabular-nums">
            {formatCurrency(totalToPay)}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">total to bank</p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <span>{ticked.size} of {payslips.length} confirmed</span>
          <div className="flex gap-3">
            {eftTotal > 0 && <span className="text-blue-600 font-semibold">EFT: {formatCurrency(eftTotal)}</span>}
            {cashTotal > 0 && <span className="text-amber-600 font-semibold">Cash: {formatCurrency(cashTotal)}</span>}
          </div>
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
          const tickedMethod = ticked.get(payslip.employee_id)
          const isTicked = !!tickedMethod
          const isSaving = saving.has(payslip.employee_id)
          const name = payslip.employees?.full_name ?? '—'
          const ptCode = payslip.employees?.pt_code ?? ''

          return (
            <div
              key={payslip.id}
              className={cn(
                'flex items-center gap-3 px-4 py-3.5',
                idx !== payslips.length - 1 && 'border-b border-gray-100',
                isTicked ? 'bg-green-50/60' : 'bg-white',
                isSaving && 'opacity-60 pointer-events-none'
              )}
            >
              {/* Name + code */}
              <div className="flex-1 min-w-0">
                <p className={cn(
                  'text-sm font-semibold truncate',
                  isTicked ? 'text-green-800' : 'text-[var(--foreground)]'
                )}>
                  {name}
                </p>
                <span className="text-xs text-gray-400 font-mono">{ptCode}</span>
              </div>

              {/* Net pay */}
              <div className="shrink-0 text-right mr-3">
                <p className={cn(
                  'text-sm font-black tabular-nums',
                  isTicked ? 'text-green-700' : 'text-[var(--foreground)]'
                )}>
                  {formatCurrency(payslip.net ?? 0)}
                </p>
              </div>

              {/* EFT / Cash buttons */}
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => handleTick(payslip.employee_id, 'eft')}
                  disabled={isSaving}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-bold uppercase min-h-[44px] min-w-[52px] transition-all',
                    tickedMethod === 'eft'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200'
                  )}
                >
                  EFT
                </button>
                <button
                  onClick={() => handleTick(payslip.employee_id, 'cash')}
                  disabled={isSaving}
                  className={cn(
                    'px-3 py-2 rounded-lg text-xs font-bold uppercase min-h-[44px] min-w-[52px] transition-all',
                    tickedMethod === 'cash'
                      ? 'bg-amber-500 text-white shadow-sm'
                      : 'bg-amber-50 text-amber-600 hover:bg-amber-100 border border-amber-200'
                  )}
                >
                  Cash
                </button>
              </div>
            </div>
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
