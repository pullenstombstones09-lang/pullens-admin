'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { hasPermission, getHomeRoute } from '@/lib/permissions'
import { PulseCard } from '@/components/ui/pulse-card'
import { useRealtime } from '@/lib/use-realtime'
import { createClient } from '@/lib/supabase/client'
import {
  ClipboardCheck,
  Users,
  Calculator,
  PenTool,
  Printer,
  Banknote,
  AlertTriangle,
  Sun,
  CheckCircle2,
  Circle,
} from 'lucide-react'
import { format, startOfWeek, endOfWeek, getDay } from 'date-fns'

interface WorkflowState {
  register: { captured: number; total: number; done: boolean }
  review: { approved: number; flagged: number; total: number; done: boolean }
  payroll: { status: string | null; runId?: string; done: boolean }
  sign: { signed: number; total: number; done: boolean }
  saturday: { done: boolean; pending: boolean }
  alerts: number
}

const STEPS = ['Reg', 'Review', 'Payroll', 'Sign', 'Print', 'Bank'] as const

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [workflow, setWorkflow] = useState<WorkflowState | null>(null)
  const [payrollRunStatus, setPayrollRunStatus] = useState<string | null>(null)
  const supabase = createClient()

  const today = new Date()
  const dayOfWeek = getDay(today) // 0=Sun, 5=Fri, 6=Sat
  const isFriday = dayOfWeek === 5
  const isSaturday = dayOfWeek === 6
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const todayStr = format(today, 'yyyy-MM-dd')

  // Redirect unauthorized
  useEffect(() => {
    if (user && !hasPermission(user.role, 'view_dashboard')) {
      router.replace(getHomeRoute(user.role))
    }
  }, [user, router])

  const loadWorkflow = useCallback(async () => {
    if (!user || !hasPermission(user.role, 'view_dashboard')) return

    const [todayAttendance, totalEmployees, weeklyRun, alertsResult] = await Promise.all([
      supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', todayStr),
      supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('payroll_runs')
        .select('id, status, payroll_type')
        .gte('week_start', weekStart)
        .lte('week_start', weekEnd)
        .eq('payroll_type', 'weekly')
        .limit(1),
      supabase
        .from('alerts')
        .select('*', { count: 'exact', head: true })
        .eq('resolved', false),
    ])

    const run = weeklyRun.data?.[0] ?? null
    const captured = todayAttendance.count ?? 0
    const total = totalEmployees.count ?? 0

    // Batch data if run exists
    let approvedCount = 0
    let flaggedCount = 0
    let batchTotal = 0
    let signedCount = 0
    let printedCount = 0

    if (run) {
      const [batchData, signedData, printedData] = await Promise.all([
        supabase
          .from('payslips')
          .select('id, status', { count: 'exact' })
          .eq('payroll_run_id', run.id),
        supabase
          .from('payslips')
          .select('*', { count: 'exact', head: true })
          .eq('payroll_run_id', run.id)
          .not('signed_at', 'is', null),
        supabase
          .from('payslips')
          .select('*', { count: 'exact', head: true })
          .eq('payroll_run_id', run.id)
          .not('pdf_url', 'is', null),
      ])

      batchTotal = batchData.count ?? 0
      signedCount = signedData.count ?? 0
      printedCount = printedData.count ?? 0

      if (batchData.data) {
        approvedCount = batchData.data.filter((p: any) => p.status === 'approved').length
        flaggedCount = batchData.data.filter((p: any) => p.status === 'flagged').length
      }
    }

    // Saturday run
    const { data: satRuns } = await supabase
      .from('payroll_runs')
      .select('id, status')
      .gte('week_start', weekStart)
      .lte('week_start', weekEnd)
      .eq('payroll_type', 'saturday_cash')
      .limit(1)

    const satRun = satRuns?.[0] ?? null

    const status = run?.status ?? null
    setPayrollRunStatus(status)

    setWorkflow({
      register: {
        captured,
        total,
        done: captured >= total && total > 0,
      },
      review: {
        approved: approvedCount,
        flagged: flaggedCount,
        total: batchTotal,
        done: batchTotal > 0 && flaggedCount === 0 && approvedCount === batchTotal,
      },
      payroll: {
        status,
        runId: run?.id,
        done: status === 'generated' || status === 'signed' || status === 'printed' || status === 'banked',
      },
      sign: {
        signed: signedCount,
        total: batchTotal,
        done: batchTotal > 0 && signedCount === batchTotal,
      },
      saturday: {
        done: !!satRun,
        pending: (isFriday || isSaturday) && !satRun,
      },
      alerts: alertsResult.count ?? 0,
    })
  }, [user, todayStr, weekStart, weekEnd, isFriday, isSaturday])

  useEffect(() => {
    loadWorkflow()
  }, [loadWorkflow])

  // Live refresh on attendance or payslip changes
  useRealtime('attendance', loadWorkflow)
  useRealtime('payslips', loadWorkflow)

  if (!user || !hasPermission(user.role, 'view_dashboard')) return null

  const firstName = user.name?.split(' ')[0] || 'there'
  const weekLabel = `${format(startOfWeek(today, { weekStartsOn: 1 }), 'dd MMM')} — ${format(endOfWeek(today, { weekStartsOn: 1 }), 'dd MMM yyyy')}`

  // Determine which step gets the pulse (first non-done)
  function getPulse(step: 'register' | 'review' | 'payroll' | 'sign' | 'saturday' | 'alerts'): boolean {
    if (!workflow) return false
    const order: Array<'register' | 'review' | 'payroll' | 'sign' | 'saturday' | 'alerts'> = [
      'register',
      'review',
      'payroll',
      'sign',
      'saturday',
      'alerts',
    ]
    const firstIncomplete = order.find((s) => {
      if (s === 'register') return !workflow.register.done
      if (s === 'review') return (isFriday || !!workflow.payroll.runId) && !workflow.review.done
      if (s === 'payroll') return !workflow.payroll.done
      if (s === 'sign') return workflow.sign.total > 0 && !workflow.sign.done
      if (s === 'saturday') return workflow.saturday.pending && !workflow.saturday.done
      if (s === 'alerts') return workflow.alerts > 0
      return false
    })
    return firstIncomplete === step
  }

  // Weekly stepper progress
  const stepDone: Record<string, boolean> = workflow
    ? {
        Reg: workflow.register.done,
        Review: workflow.review.done,
        Payroll: workflow.payroll.done,
        Sign: workflow.sign.done,
        Print: payrollRunStatus === 'printed' || payrollRunStatus === 'banked',
        Bank: payrollRunStatus === 'banked',
      }
    : {}

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">
          Welcome back, {firstName}
        </h1>
        <p className="text-sm text-gray-500 mt-1">{weekLabel}</p>
      </div>

      {/* Workflow cards */}
      <div className="space-y-3">
        {/* Register */}
        {hasPermission(user.role, 'view_register') && (
          <PulseCard
            pulse={getPulse('register')}
            onClick={() => router.push('/register')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 text-blue-700 shrink-0">
                <ClipboardCheck size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E293B]">Register</p>
                {workflow ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {workflow.register.done
                      ? `All ${workflow.register.total} captured`
                      : `${workflow.register.captured} / ${workflow.register.total} captured today`}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Loading…</p>
                )}
              </div>
              {workflow?.register.done && (
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              )}
            </div>
          </PulseCard>
        )}

        {/* Review */}
        {hasPermission(user.role, 'run_payroll') && (isFriday || !!workflow?.payroll.runId) && (
          <PulseCard
            pulse={getPulse('review')}
            onClick={() => router.push('/payroll/review')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 text-amber-700 shrink-0">
                <Users size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E293B]">Payroll Review</p>
                {workflow ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {workflow.review.done
                      ? 'All approved — ready to generate'
                      : workflow.review.total > 0
                        ? `${workflow.review.flagged} flagged, ${workflow.review.approved} approved`
                        : 'No batch data yet'}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Loading…</p>
                )}
              </div>
              {workflow?.review.done && (
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              )}
            </div>
          </PulseCard>
        )}

        {/* Run Final Payroll */}
        {hasPermission(user.role, 'run_payroll') && workflow?.review.done && !workflow?.payroll.done && (
          <PulseCard
            pulse={getPulse('payroll')}
            onClick={() => router.push('/payroll')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 text-green-700 shrink-0">
                <Calculator size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E293B]">Generate Payroll</p>
                <p className="text-xs text-gray-500 mt-0.5">Review complete — ready to generate</p>
              </div>
            </div>
          </PulseCard>
        )}

        {/* Sign */}
        {hasPermission(user.role, 'sign_payslips') && (workflow?.sign.total ?? 0) > 0 && (
          <PulseCard
            pulse={getPulse('sign')}
            onClick={() => router.push('/payroll/sign')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100 text-purple-700 shrink-0">
                <PenTool size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E293B]">Sign Payslips</p>
                {workflow ? (
                  <p className="text-xs text-gray-500 mt-0.5">
                    {workflow.sign.done
                      ? `All ${workflow.sign.total} signed`
                      : `${workflow.sign.signed} / ${workflow.sign.total} signed`}
                  </p>
                ) : (
                  <p className="text-xs text-gray-400 mt-0.5">Loading…</p>
                )}
              </div>
              {workflow?.sign.done && (
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              )}
            </div>
          </PulseCard>
        )}

        {/* Saturday */}
        {hasPermission(user.role, 'view_payroll') && (isFriday || isSaturday) && (
          <PulseCard
            pulse={getPulse('saturday')}
            onClick={() => router.push('/payroll/saturday')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-100 text-orange-700 shrink-0">
                <Sun size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E293B]">Saturday Pay</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {workflow?.saturday.done ? 'Captured' : 'Not yet captured'}
                </p>
              </div>
              {workflow?.saturday.done && (
                <CheckCircle2 size={18} className="text-green-500 shrink-0" />
              )}
            </div>
          </PulseCard>
        )}

        {/* Alerts */}
        {(workflow?.alerts ?? 0) > 0 && (
          <PulseCard
            pulse={getPulse('alerts')}
            onClick={() => router.push('/alerts')}
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100 text-red-700 shrink-0">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-[#1E293B]">Alerts</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {workflow!.alerts} unresolved
                </p>
              </div>
            </div>
          </PulseCard>
        )}
      </div>

      {/* Weekly stepper */}
      {hasPermission(user.role, 'view_payroll') && (
        <div className="rounded-xl border border-[var(--border)] bg-white p-4">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Week Progress
          </p>
          <div className="flex items-center gap-1">
            {STEPS.map((step, i) => {
              const done = stepDone[step] ?? false
              const isLast = i === STEPS.length - 1
              return (
                <div key={step} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 flex-shrink-0">
                    {done ? (
                      <CheckCircle2 size={18} className="text-[#1E40AF]" />
                    ) : (
                      <Circle size={18} className="text-gray-300" />
                    )}
                    <span className={`text-[10px] font-medium ${done ? 'text-[#1E40AF]' : 'text-gray-400'}`}>
                      {step}
                    </span>
                  </div>
                  {!isLast && (
                    <div
                      className={`flex-1 h-0.5 mx-1 rounded ${done ? 'bg-[#1E40AF]' : 'bg-gray-200'}`}
                    />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
