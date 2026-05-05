import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';

// GET: fetch batch for a payroll run
export async function GET(req: NextRequest) {
  const supabase = await createServerSupabase();
  const runId = req.nextUrl.searchParams.get('run_id');

  if (!runId) {
    return NextResponse.json({ error: 'run_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('payroll_batch')
    .select('*, employees(full_name, pt_code)')
    .eq('payroll_run_id', runId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: create batch (all employees default approved)
export async function POST(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { run_id, employee_ids } = await req.json();

  const records = employee_ids.map((eid: string) => ({
    payroll_run_id: run_id,
    employee_id: eid,
    status: 'approved',
  }));

  const { error } = await supabase
    .from('payroll_batch')
    .upsert(records, { onConflict: 'payroll_run_id,employee_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH: update individual employee status
export async function PATCH(req: NextRequest) {
  const supabase = await createServerSupabase();
  const { run_id, employee_id, status, pulled_reason } = await req.json();

  const { error } = await supabase
    .from('payroll_batch')
    .update({ status, pulled_reason: pulled_reason || null })
    .eq('payroll_run_id', run_id)
    .eq('employee_id', employee_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
