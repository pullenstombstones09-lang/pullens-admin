import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

/**
 * GET /api/loans?employee_id=<uuid>
 * Returns all loans for that employee, with deductions nested.
 *
 * GET /api/loans?employee_id=<uuid>&summary=true
 * Returns { active_outstanding } only — used by the staff profile badge.
 */
export async function GET(request: NextRequest) {
  const employeeId = request.nextUrl.searchParams.get('employee_id');
  const summary = request.nextUrl.searchParams.get('summary') === 'true';

  if (!employeeId) {
    return Response.json({ error: 'employee_id required' }, { status: 400 });
  }

  const supabase = await getSupabase();

  if (summary) {
    const { data } = await supabase
      .from('loans')
      .select('outstanding, status')
      .eq('employee_id', employeeId)
      .eq('status', 'active');
    const active_outstanding = (data ?? []).reduce((s, r) => s + Number(r.outstanding), 0);
    return Response.json({ active_outstanding, count: data?.length ?? 0 });
  }

  const { data: loans, error: loanErr } = await supabase
    .from('loans')
    .select('*')
    .eq('employee_id', employeeId)
    .order('date_advanced', { ascending: false });

  if (loanErr) {
    return Response.json({ error: loanErr.message }, { status: 500 });
  }

  const loanIds = (loans ?? []).map((l: { id: string }) => l.id);
  let deductions: Array<{ loan_id: string }> = [];
  if (loanIds.length > 0) {
    const { data: dedData } = await supabase
      .from('loan_deductions')
      .select('*')
      .in('loan_id', loanIds)
      .order('deducted_at', { ascending: true });
    deductions = dedData ?? [];
  }

  return Response.json({ loans: loans ?? [], deductions });
}

/**
 * POST /api/loans
 * Body: { employee_id, amount, weekly_deduction, purpose?, from_petty? }
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const { employee_id, amount, weekly_deduction, purpose, from_petty } = body;

  if (!employee_id || amount === undefined || weekly_deduction === undefined) {
    return Response.json({ error: 'employee_id, amount, weekly_deduction required' }, { status: 400 });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('loans')
    .insert({
      employee_id,
      amount: Number(amount),
      outstanding: Number(amount),
      weekly_deduction: Number(weekly_deduction),
      purpose: purpose || null,
      date_advanced: new Date().toISOString().split('T')[0],
      status: 'active',
      auto_generated_from_petty: !!from_petty,
    })
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ loan: data });
}

/**
 * PATCH /api/loans?id=<loan_id>
 * Body can include: outstanding, weekly_deduction, status, purpose.
 * If outstanding is set and <= 0, status is automatically set to 'closed'.
 */
export async function PATCH(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'id query param required' }, { status: 400 });
  }
  const body = await request.json();
  const updates: Record<string, unknown> = {};

  if (body.outstanding !== undefined) {
    const val = Number(body.outstanding);
    if (isNaN(val) || val < 0) {
      return Response.json({ error: 'outstanding must be a non-negative number' }, { status: 400 });
    }
    updates.outstanding = val;
    if (val <= 0) updates.status = 'closed';
    else updates.status = 'active';
  }
  if (body.weekly_deduction !== undefined) {
    const val = Number(body.weekly_deduction);
    if (isNaN(val) || val < 0) {
      return Response.json({ error: 'weekly_deduction must be a non-negative number' }, { status: 400 });
    }
    updates.weekly_deduction = val;
  }
  if (body.purpose !== undefined) updates.purpose = body.purpose || null;
  if (body.status !== undefined) updates.status = body.status;

  if (Object.keys(updates).length === 0) {
    return Response.json({ error: 'no updatable fields supplied' }, { status: 400 });
  }

  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('loans')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ loan: data });
}

/**
 * DELETE /api/loans?id=<loan_id>
 * Cascades delete to loan_deductions for that loan.
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'id query param required' }, { status: 400 });
  }

  const supabase = await getSupabase();
  await supabase.from('loan_deductions').delete().eq('loan_id', id);
  const { error } = await supabase.from('loans').delete().eq('id', id);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json({ success: true });
}
