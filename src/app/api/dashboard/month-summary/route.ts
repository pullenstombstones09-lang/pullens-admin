import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';

// GET /api/dashboard/month-summary?month=2026-05
// Returns current month snapshot: payroll totals, attendance %, petty cash balance
export async function GET(request: NextRequest) {
  try {
    const monthParam = request.nextUrl.searchParams.get('month');
    if (!monthParam || !/^\d{4}-\d{2}$/.test(monthParam)) {
      return NextResponse.json({ error: 'month param required (YYYY-MM)' }, { status: 400 });
    }

    const [year, month] = monthParam.split('-').map(Number);
    const firstDay = `${monthParam}-01`;
    const lastDay = new Date(year, month, 0);
    const lastDayStr = `${year}-${String(month).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;

    // Count working days (Mon-Fri) in month
    let workingDays = 0;
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const dow = new Date(year, month - 1, d).getDay();
      if (dow !== 0 && dow !== 6) workingDays++;
    }

    const supabase = await createServiceRoleSupabase();

    // Payroll runs in this month
    const { data: runs } = await supabase
      .from('payroll_runs')
      .select('id, total_gross, total_net')
      .gte('week_end', firstDay)
      .lte('week_end', lastDayStr);

    const totalGross = (runs ?? []).reduce((s, r) => s + (r.total_gross || 0), 0);
    const totalNet = (runs ?? []).reduce((s, r) => s + (r.total_net || 0), 0);
    const payrollRunCount = (runs ?? []).length;

    // Attendance
    const [empCountRes, attRes] = await Promise.all([
      supabase
        .from('employees')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'active'),
      supabase
        .from('attendance')
        .select('status')
        .gte('date', firstDay)
        .lte('date', lastDayStr),
    ]);

    const empCount = empCountRes.count ?? 0;
    const attendance = attRes.data ?? [];
    const presentCount = attendance.filter((a) => a.status === 'present' || a.status === 'late').length;
    const totalPossible = empCount * workingDays;
    const attendanceRate = totalPossible > 0 ? Math.round((presentCount / totalPossible) * 100) : 0;

    // Petty cash
    const [insRes, outsRes] = await Promise.all([
      supabase
        .from('petty_cash_ins')
        .select('amount')
        .gte('date', firstDay)
        .lte('date', lastDayStr),
      supabase
        .from('petty_cash_outs')
        .select('amount, status')
        .gte('date', firstDay)
        .lte('date', lastDayStr),
    ]);

    const pettyIn = (insRes.data ?? []).reduce((s, i) => s + i.amount, 0);
    const pettyOut = (outsRes.data ?? []).reduce((s, o) => s + o.amount, 0);
    const pettyOutstanding = (outsRes.data ?? [])
      .filter((o) => o.status === 'open' || o.status === 'partial')
      .reduce((s, o) => s + o.amount, 0);

    return NextResponse.json({
      month: monthParam,
      payroll: {
        totalGross,
        totalNet,
        runCount: payrollRunCount,
      },
      attendance: {
        rate: attendanceRate,
        presentDays: presentCount,
        possibleDays: totalPossible,
      },
      pettyCash: {
        totalIn: pettyIn,
        totalOut: pettyOut,
        outstanding: pettyOutstanding,
        balance: pettyIn - pettyOut,
      },
    });
  } catch (err) {
    console.error('Month summary error:', err);
    return NextResponse.json({ error: 'Failed to load summary' }, { status: 500 });
  }
}
