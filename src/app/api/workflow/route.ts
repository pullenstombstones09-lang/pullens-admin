import { NextResponse } from 'next/server'
import { createServiceRoleSupabase } from '@/lib/supabase/server'
import { startOfWeek, endOfWeek, format } from 'date-fns'

export async function GET() {
  const supabase = await createServiceRoleSupabase()
  const now = new Date()
  const weekStart = format(startOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(now, { weekStartsOn: 1 }), 'yyyy-MM-dd')

  // Step 1: Register — any attendance this week?
  const { count: attendanceCount } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .gte('date', weekStart)
    .lte('date', weekEnd)

  // Step 2: Payroll — any run this week?
  const { data: runs } = await supabase
    .from('payroll_runs')
    .select('id, status')
    .gte('week_start', weekStart)
    .lte('week_start', weekEnd)
    .limit(1)

  const latestRun = runs?.[0]

  // Step 3: Signatures
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

  // Step 4: Print
  let printedCount = 0
  if (latestRun) {
    const { count } = await supabase
      .from('payslips')
      .select('*', { count: 'exact', head: true })
      .eq('payroll_run_id', latestRun.id)
      .not('pdf_url', 'is', null)
    printedCount = count || 0
  }

  // Step 5: Bank
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
