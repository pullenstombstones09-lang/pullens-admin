import { NextRequest, NextResponse } from 'next/server'
import { createServiceRoleSupabase } from '@/lib/supabase/server'

export async function POST(req: NextRequest) {
  const { run_id, employee_ids } = await req.json()
  const supabase = await createServiceRoleSupabase()

  // Mark payslips as banked
  const { error } = await supabase
    .from('payslips')
    .update({ banked_at: new Date().toISOString() })
    .eq('payroll_run_id', run_id)
    .in('employee_id', employee_ids)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Check if all payslips banked
  const { count: unbanked } = await supabase
    .from('payslips')
    .select('*', { count: 'exact', head: true })
    .eq('payroll_run_id', run_id)
    .is('banked_at', null)

  if (unbanked === 0) {
    await supabase
      .from('payroll_runs')
      .update({ status: 'banked' as any })
      .eq('id', run_id)
  }

  return NextResponse.json({ success: true, allBanked: unbanked === 0 })
}
