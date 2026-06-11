import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { computeFamilyBalance } from '@/lib/leave-balance';

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

export async function GET(request: NextRequest) {
  const date = request.nextUrl.searchParams.get('date');
  const showInactive = request.nextUrl.searchParams.get('showInactive') === 'true';

  if (!date) {
    return Response.json({ error: 'date required' }, { status: 400 });
  }

  const supabase = await getSupabase();

  const empQuery = supabase
    .from('employees')
    .select('id, pt_code, full_name, photo_url, weekly_wage, weekly_hours, status')
    .order('full_name');

  if (!showInactive) {
    empQuery.eq('status', 'active');
  }

  const [empResult, attResult, balResult] = await Promise.all([
    empQuery,
    supabase.from('attendance').select('*').eq('date', date),
    supabase.from('leave_balances').select('employee_id, family_remaining'),
  ]);

  return Response.json({
    employees: empResult.data ?? [],
    attendance: attResult.data ?? [],
    family_balances: balResult.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const { records, date } = await request.json();

  const supabase = await getSupabase();

  // 1. Read existing attendance for this date. Two purposes:
  //    a) detect status TRANSITIONS into 'family' for FRL precheck / decrement
  //    b) detect time_in / time_out CHANGES to flag them as source='manual',
  //       so the biometric webhook stops overwriting human edits.
  const employeeIds = records.map((r: { employee_id: string }) => r.employee_id);
  const { data: existing } = await supabase
    .from('attendance')
    .select('employee_id, status, time_in, time_out, time_in_source, time_out_source')
    .eq('date', date)
    .in('employee_id', employeeIds);

  type ExistingRow = {
    employee_id: string;
    status: string;
    time_in: string | null;
    time_out: string | null;
    time_in_source: string | null;
    time_out_source: string | null;
  };

  const existingByEmp = new Map<string, ExistingRow>();
  const existingStatusByEmp = new Map<string, string>();
  for (const e of (existing ?? []) as ExistingRow[]) {
    existingByEmp.set(e.employee_id, e);
    existingStatusByEmp.set(e.employee_id, e.status);
  }

  const newFamilyEmployeeIds: string[] = records
    .filter((r: { status: string; employee_id: string }) =>
      r.status === 'family' && existingStatusByEmp.get(r.employee_id) !== 'family'
    )
    .map((r: { employee_id: string }) => r.employee_id);

  // 2. FRL precheck — compute on-the-fly from leave history. Reject the whole save if any
  //    employee would go negative. No partial state.
  if (newFamilyEmployeeIds.length > 0) {
    const [leavesResult, empsResult] = await Promise.all([
      supabase
        .from('leave')
        .select('employee_id, leave_type, from_date, to_date, days')
        .in('employee_id', newFamilyEmployeeIds),
      supabase
        .from('employees')
        .select('id, full_name')
        .in('id', newFamilyEmployeeIds),
    ]);

    const nameById = new Map(
      (empsResult.data ?? []).map((e: { id: string; full_name: string }) => [e.id, e.full_name])
    );

    for (const empId of newFamilyEmployeeIds) {
      const empLeaves = (leavesResult.data ?? []).filter(
        (l: { employee_id: string }) => l.employee_id === empId
      );
      const remaining = computeFamilyBalance(empLeaves, new Date());
      if (remaining < 1) {
        return Response.json(
          {
            error: `${nameById.get(empId) ?? empId} has no family responsibility leave remaining for this cycle.`,
            code: 'FRL_EXHAUSTED',
            employee_id: empId,
          },
          { status: 409 }
        );
      }
    }
  }

  // 3. Stamp time_in_source / time_out_source on each record so the biometric
  //    webhook respects human edits. Rule:
  //      - status with no times (absent / leave / sick / etc.) → both sources null
  //      - no existing row → both sources 'manual' (fresh manual entry)
  //      - existing row → only mark the side that actually changed; preserve the
  //        other side's prior source (so passive re-saves don't lock biometric out).
  const NO_TIME_STATUSES = new Set(['absent', 'leave', 'sick', 'family', 'ph', 'short_time']);
  const normTime = (t: string | null | undefined) =>
    t ? t.slice(0, 5) : null; // DB returns 'HH:MM:SS', UI sends 'HH:MM'

  // `time_in_source` / `time_out_source` are NOT NULL CHECK IN ('manual','biometric').
  // The register POST is always a manual action — even when the saved status carries no
  // times (absent / leave / etc.), the row was authored by a human, so 'manual' is correct.
  // Only preserve 'biometric' on the specific side whose value didn't change vs the existing row.
  const stamped = records.map(
    (r: { employee_id: string; status: string; time_in: string | null; time_out: string | null }) => {
      if (NO_TIME_STATUSES.has(r.status)) {
        return { ...r, time_in_source: 'manual', time_out_source: 'manual' };
      }
      const ex = existingByEmp.get(r.employee_id);
      const newIn = normTime(r.time_in);
      const newOut = normTime(r.time_out);
      if (!ex) {
        return { ...r, time_in_source: 'manual', time_out_source: 'manual' };
      }
      const exIn = normTime(ex.time_in);
      const exOut = normTime(ex.time_out);
      return {
        ...r,
        time_in_source: newIn !== exIn ? 'manual' : (ex.time_in_source ?? 'manual'),
        time_out_source: newOut !== exOut ? 'manual' : (ex.time_out_source ?? 'manual'),
      };
    }
  );

  const { error } = await supabase
    .from('attendance')
    .upsert(stamped, { onConflict: 'employee_id,date' });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 4. For each new family day: insert a leave row + decrement family_remaining.
  for (const empId of newFamilyEmployeeIds) {
    await supabase.from('leave').insert({
      employee_id: empId,
      leave_type: 'family',
      from_date: date,
      to_date: date,
      days: 1,
      reason: 'Recorded from register',
      approved_by: null,
      approved_at: new Date().toISOString(),
    });

    const { data: bal } = await supabase
      .from('leave_balances')
      .select('family_remaining')
      .eq('employee_id', empId)
      .single();
    const current = bal?.family_remaining ?? 0;
    await supabase
      .from('leave_balances')
      .update({ family_remaining: Math.max(0, current - 1) })
      .eq('employee_id', empId);
  }

  return Response.json({ success: true });
}

export async function PATCH(request: NextRequest) {
  const { employeeId, status } = await request.json();

  const supabase = await getSupabase();

  const { error } = await supabase
    .from('employees')
    .update({ status })
    .eq('id', employeeId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}

export async function DELETE(request: NextRequest) {
  const { attendanceId } = await request.json();

  const supabase = await getSupabase();

  const { error } = await supabase
    .from('attendance')
    .delete()
    .eq('id', attendanceId);

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ success: true });
}
