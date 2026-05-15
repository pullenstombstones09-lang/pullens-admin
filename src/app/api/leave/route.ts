import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { dateRangeDays, computeFamilyBalance } from '@/lib/leave-balance';
import type { LeaveType } from '@/types/database';

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
 * POST /api/leave
 * Body: { employee_id, leave_type, from_date, to_date, reason?, approved_by?, override?, source? }
 * Inserts a leave row, creates attendance rows for each day (excluding Sundays),
 * and decrements the matching _remaining column on leave_balances.
 * Returns 409 if family balance would go negative and override is not true.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    employee_id,
    leave_type,
    from_date,
    to_date,
    reason,
    approved_by,
    override,
    source, // optional, e.g. 'register' or 'leave-tab' (audit only)
  } = body as {
    employee_id: string;
    leave_type: LeaveType;
    from_date: string;
    to_date: string;
    reason?: string;
    approved_by?: string;
    override?: boolean;
    source?: string;
  };

  if (!employee_id || !leave_type || !from_date || !to_date) {
    return Response.json({ error: 'employee_id, leave_type, from_date, to_date are required' }, { status: 400 });
  }

  const supabase = await getSupabase();
  const days = dateRangeDays(from_date, to_date);
  if (days === 0) {
    return Response.json({ error: 'Date range yields zero working days' }, { status: 400 });
  }

  // FRL cap precheck — compute on-the-fly from leave history
  if (leave_type === 'family' && !override) {
    const { data: history } = await supabase
      .from('leave')
      .select('leave_type, from_date, to_date, days')
      .eq('employee_id', employee_id);
    const remaining = computeFamilyBalance(history ?? [], new Date());
    if (remaining - days < 0) {
      return Response.json(
        { error: `Family responsibility leave exhausted (remaining: ${remaining}, requested: ${days}). Owner override required.`, code: 'FRL_EXHAUSTED', remaining },
        { status: 409 }
      );
    }
  }

  // Insert leave row
  const { data: leaveRow, error: leaveError } = await supabase
    .from('leave')
    .insert({
      employee_id,
      leave_type,
      from_date,
      to_date,
      days,
      reason: reason || (source ? `Recorded from ${source}` : null),
      approved_by: approved_by || null,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (leaveError || !leaveRow) {
    return Response.json({ error: leaveError?.message || 'Failed to insert leave' }, { status: 500 });
  }

  // Create attendance rows (excluding Sundays)
  const attendanceRows: Array<{ employee_id: string; date: string; status: string; time_in: null; time_out: null; late_minutes: number; reason: string | null }> = [];
  const cur = new Date(from_date + 'T00:00:00');
  const end = new Date(to_date + 'T00:00:00');
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      attendanceRows.push({
        employee_id,
        date: `${y}-${m}-${d}`,
        status: leave_type === 'sick' ? 'sick' : leave_type === 'family' ? 'family' : 'leave',
        time_in: null,
        time_out: null,
        late_minutes: 0,
        reason: reason || null,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (attendanceRows.length > 0) {
    await supabase.from('attendance').upsert(attendanceRows, { onConflict: 'employee_id,date' });
  }

  // Decrement matching _remaining column
  const remainingCol =
    leave_type === 'annual' ? 'annual_remaining'
    : leave_type === 'sick' ? 'sick_remaining'
    : leave_type === 'family' ? 'family_remaining'
    : null;
  if (remainingCol) {
    const { data: bal } = await supabase
      .from('leave_balances')
      .select(remainingCol)
      .eq('employee_id', employee_id)
      .single();
    const current = (bal as Record<string, number> | null)?.[remainingCol] ?? 0;
    await supabase
      .from('leave_balances')
      .update({ [remainingCol]: Math.max(0, current - days) })
      .eq('employee_id', employee_id);
  }

  return Response.json({ leave: leaveRow, days });
}

/**
 * DELETE /api/leave?id=<leave_id>
 * Removes the leave row, deletes the attendance rows for those dates, and restores the matching _remaining column.
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'id query parameter required' }, { status: 400 });
  }

  const supabase = await getSupabase();

  const { data: leaveRow, error: fetchError } = await supabase
    .from('leave')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError || !leaveRow) {
    return Response.json({ error: 'Leave record not found' }, { status: 404 });
  }

  // Delete attendance rows for those dates (only those matching the leave's status, to avoid clobbering Present/Late entries the user later overrode)
  const cur = new Date(leaveRow.from_date + 'T00:00:00');
  const end = new Date(leaveRow.to_date + 'T00:00:00');
  const dates: string[] = [];
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  const matchingStatus = leaveRow.leave_type === 'sick' ? 'sick' : leaveRow.leave_type === 'family' ? 'family' : 'leave';
  if (dates.length > 0) {
    await supabase
      .from('attendance')
      .delete()
      .eq('employee_id', leaveRow.employee_id)
      .in('date', dates)
      .eq('status', matchingStatus);
  }

  // Restore balance
  const remainingCol =
    leaveRow.leave_type === 'annual' ? 'annual_remaining'
    : leaveRow.leave_type === 'sick' ? 'sick_remaining'
    : leaveRow.leave_type === 'family' ? 'family_remaining'
    : null;
  if (remainingCol) {
    const { data: bal } = await supabase
      .from('leave_balances')
      .select(remainingCol)
      .eq('employee_id', leaveRow.employee_id)
      .single();
    const current = (bal as Record<string, number> | null)?.[remainingCol] ?? 0;
    const cap =
      leaveRow.leave_type === 'annual' ? 21
      : leaveRow.leave_type === 'sick' ? 30
      : 3;
    await supabase
      .from('leave_balances')
      .update({ [remainingCol]: Math.min(cap, current + leaveRow.days) })
      .eq('employee_id', leaveRow.employee_id);
  }

  // Finally delete the leave row
  await supabase.from('leave').delete().eq('id', id);

  return Response.json({ success: true });
}
