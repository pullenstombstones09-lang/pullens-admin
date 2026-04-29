'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { hasPermission, getHomeRoute } from '@/lib/permissions'
import { WorkflowStepper } from '@/components/ui/workflow-stepper'
import { Button } from '@/components/ui/button'
import { Users, Calculator, PenTool, AlertTriangle, ClipboardList, Brain, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
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
  const router = useRouter()
  const [stats, setStats] = useState<WeekStats | null>(null)
  const supabase = createClient()

  // Redirect unauthorized users to their home route
  useEffect(() => {
    if (user && !hasPermission(user.role, 'view_dashboard')) {
      router.replace(getHomeRoute(user.role))
    }
  }, [user, router])

  useEffect(() => {
    if (!user || !hasPermission(user.role, 'view_dashboard')) return

    async function load() {
      const today = format(new Date(), 'yyyy-MM-dd')
      const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
      const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

      const [attendance, employees, runs, alerts] = await Promise.all([
        supabase.from('attendance').select('*', { count: 'exact', head: true }).eq('date', today),
        supabase.from('employees').select('*', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payroll_runs').select('id, status').gte('week_start', weekStart).lte('week_start', weekEnd).limit(1),
        supabase.from('alerts').select('*', { count: 'exact', head: true }).eq('resolved', false),
      ])

      const run = runs.data?.[0]
      let unsigned = 0
      if (run) {
        const { count } = await supabase
          .from('payslips')
          .select('*', { count: 'exact', head: true })
          .eq('payroll_run_id', run.id)
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
  }, [user])

  // Don't render for unauthorized users
  if (!user || !hasPermission(user.role, 'view_dashboard')) return null

  const metrics = stats ? [
    { label: 'Captured Today', value: `${stats.attendanceToday}/${stats.totalStaff}`, icon: <Users size={24} />, color: '#1E40AF', colorEnd: '#3B82F6' },
    { label: 'Payroll', value: stats.payrollStatus || 'Not run', icon: <Calculator size={24} />, color: stats.payrollStatus === 'generated' ? '#059669' : '#1E40AF', colorEnd: stats.payrollStatus === 'generated' ? '#10B981' : '#3B82F6' },
    { label: 'Unsigned', value: stats.unsignedCount.toString(), icon: <PenTool size={24} />, color: stats.unsignedCount > 0 ? '#D97706' : '#059669', colorEnd: stats.unsignedCount > 0 ? '#F59E0B' : '#10B981' },
    { label: 'Alerts', value: stats.alertCount.toString(), icon: <AlertTriangle size={24} />, color: stats.alertCount > 0 ? '#DC2626' : '#059669', colorEnd: stats.alertCount > 0 ? '#EF4444' : '#10B981' },
  ] : []

  // Permission-gated quick actions
  const actions = [
    hasPermission(user.role, 'view_register') && { href: '/register', label: 'Capture Register', icon: <ClipboardList size={18} />, variant: 'primary' as const },
    hasPermission(user.role, 'view_payroll') && { href: '/payroll', label: 'Run Payroll', icon: <Calculator size={18} />, variant: 'primary' as const },
    hasPermission(user.role, 'view_payslips') && { href: '/payroll/payslip-viewer', label: 'View Payslips', icon: <PenTool size={18} />, variant: 'secondary' as const },
    hasPermission(user.role, 'view_petty_cash') && { href: '/petty-cash', label: 'Petty Cash', icon: <Wallet size={18} />, variant: 'secondary' as const },
    hasPermission(user.role, 'view_hr_advisor') && { href: '/hr-advisor', label: 'HR Advisor', icon: <Brain size={18} />, variant: 'secondary' as const },
  ].filter(Boolean) as { href: string; label: string; icon: React.ReactNode; variant: 'primary' | 'secondary' }[]

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[#1E293B]">
          Welcome back, {user?.name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Week of {format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM')} — {format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'dd MMM yyyy')}
        </p>
      </div>

      <WorkflowStepper />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m, i) => (
          <div key={i} className="rounded-xl p-5 card-hover shadow-md"
               style={{ background: `linear-gradient(135deg, ${m.color}, ${m.colorEnd})` }}>
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs font-semibold text-white/70 uppercase tracking-wide">{m.label}</p>
                <p className="text-3xl font-bold text-white mt-1">{m.value}</p>
              </div>
              <div className="p-2 rounded-lg bg-white/20 text-white">
                {m.icon}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {actions.map((a) => (
          <a key={a.href} href={a.href}>
            <Button variant={a.variant} size="lg" className="w-full" icon={a.icon}>
              {a.label}
            </Button>
          </a>
        ))}
      </div>
    </div>
  )
}
