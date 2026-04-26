import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

// Seed one pay week of realistic test data: Fri 18 Apr → Thu 24 Apr 2026
// POST /api/seed-test-week?secret=pullens-test-week-2026

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  if (searchParams.get('secret') !== 'pullens-test-week-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() { /* service role */ },
      },
    }
  );

  const results: string[] = [];

  try {
    // Get all active employees
    const { data: employees, error: empError } = await supabase
      .from('employees')
      .select('id, pt_code, full_name, weekly_wage, garnishee')
      .eq('status', 'active');

    if (empError || !employees) {
      return NextResponse.json({ error: 'Failed to fetch employees: ' + empError?.message }, { status: 500 });
    }

    // Get Annika's user ID for captured_by
    const { data: annika } = await supabase
      .from('users')
      .select('id')
      .eq('name', 'Annika')
      .single();

    const capturedBy = annika?.id || null;

    // === ATTENDANCE ===
    // Work days: Mon 21, Tue 22, Wed 23, Thu 24 Apr (Mon-Thu = 08:00-17:00)
    //            Fri 18 Apr (08:00-16:00)
    // Sat 19, Sun 20 = off
    const workDays = [
      { date: '2026-04-18', day: 'Fri', normalOut: '16:00' },
      { date: '2026-04-21', day: 'Mon', normalOut: '17:00' },
      { date: '2026-04-22', day: 'Tue', normalOut: '17:00' },
      { date: '2026-04-23', day: 'Wed', normalOut: '17:00' },
      { date: '2026-04-24', day: 'Thu', normalOut: '17:00' },
    ];

    // Realistic patterns:
    // - Most employees: present, on time
    // - 2-3 late per day (6-30 min range)
    // - 1-2 absent per day
    // - 1 on leave (annual) for the week
    const leaveEmployeeIdx = 5; // PT006 on annual leave all week
    const attendanceRows: {
      employee_id: string;
      date: string;
      status: string;
      time_in: string | null;
      time_out: string | null;
      late_minutes: number;
      reason: string | null;
      captured_by: string | null;
    }[] = [];

    for (const wd of workDays) {
      for (let i = 0; i < employees.length; i++) {
        const emp = employees[i];

        // Employee on leave
        if (i === leaveEmployeeIdx) {
          attendanceRows.push({
            employee_id: emp.id,
            date: wd.date,
            status: 'leave',
            time_in: null,
            time_out: null,
            late_minutes: 0,
            reason: 'Annual leave',
            captured_by: capturedBy,
          });
          continue;
        }

        // Random absent (1-2 per day, different employees each day)
        const dayHash = parseInt(wd.date.replace(/-/g, '')) + i;
        if (dayHash % 47 === 0 || dayHash % 53 === 0) {
          attendanceRows.push({
            employee_id: emp.id,
            date: wd.date,
            status: 'absent',
            time_in: null,
            time_out: null,
            late_minutes: 0,
            reason: i % 2 === 0 ? 'No call no show' : 'Family emergency',
            captured_by: capturedBy,
          });
          continue;
        }

        // Late employees (3-4 per day)
        let timeIn = '08:00';
        let lateMinutes = 0;
        let status = 'present';

        if (dayHash % 11 === 0) {
          // 10-25 min late → dock 30
          lateMinutes = 10 + (dayHash % 16);
          const mins = 8 * 60 + lateMinutes;
          timeIn = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
          status = 'late';
        } else if (dayHash % 37 === 0) {
          // 35-50 min late → dock 60
          lateMinutes = 35 + (dayHash % 16);
          const mins = 8 * 60 + lateMinutes;
          timeIn = `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
          status = 'late';
        }

        attendanceRows.push({
          employee_id: emp.id,
          date: wd.date,
          status,
          time_in: timeIn,
          time_out: wd.normalOut,
          late_minutes: lateMinutes,
          reason: lateMinutes > 0 ? 'Traffic / taxi issues' : null,
          captured_by: capturedBy,
        });
      }
    }

    // Clear existing test week attendance
    for (const wd of workDays) {
      await supabase.from('attendance').delete().eq('date', wd.date);
    }

    // Insert attendance in batches
    const BATCH = 50;
    for (let i = 0; i < attendanceRows.length; i += BATCH) {
      const batch = attendanceRows.slice(i, i + BATCH);
      const { error } = await supabase.from('attendance').insert(batch);
      if (error) {
        results.push(`Attendance batch ${i} error: ${error.message}`);
      }
    }
    results.push(`Attendance: ${attendanceRows.length} records inserted`);

    // === PETTY CASH ===
    // Seed float: R5,000 cash in at start of week
    const { error: cashInError } = await supabase.from('petty_cash_ins').insert({
      date: '2026-04-18',
      amount: 5000,
      source: 'bank_withdrawal',
      source_user: capturedBy,
      notes: 'Weekly float top-up',
    });
    if (cashInError) results.push('Petty cash in error: ' + cashInError.message);
    else results.push('Petty cash in: R5,000 float');

    // Petty cash outs — realistic week
    const pettyCashOuts = [
      { date: '2026-04-18', emp_idx: 0, category: 'diesel', amount: 850, reason: 'Delivery truck fuel - Durban run', status: 'squared' },
      { date: '2026-04-18', emp_idx: 2, category: 'taxi', amount: 120, reason: 'Taxi to supplier', status: 'squared' },
      { date: '2026-04-21', emp_idx: null, category: 'materials', amount: 340, reason: 'Sandpaper + polish compound', status: 'squared', freetext: 'Builders Warehouse' },
      { date: '2026-04-21', emp_idx: 7, category: 'airtime', amount: 100, reason: 'Airtime for site supervisor', status: 'open' },
      { date: '2026-04-22', emp_idx: 0, category: 'diesel', amount: 920, reason: 'Delivery truck fuel - PMB local', status: 'squared' },
      { date: '2026-04-22', emp_idx: 10, category: 'taxi', amount: 80, reason: 'Taxi to cemetery site', status: 'open' },
      { date: '2026-04-23', emp_idx: null, category: 'materials', amount: 450, reason: 'Cement + sand for installations', status: 'squared', freetext: 'Cashbuild' },
      { date: '2026-04-23', emp_idx: 3, category: 'other', amount: 200, reason: 'Advance for personal emergency', status: 'open' },
      { date: '2026-04-24', emp_idx: 0, category: 'diesel', amount: 780, reason: 'Delivery truck fuel - weekly', status: 'open' },
      { date: '2026-04-24', emp_idx: null, category: 'tolls', amount: 95, reason: 'N3 toll fees', status: 'squared', freetext: 'N3 Toll' },
    ];

    for (const pco of pettyCashOuts) {
      const row: Record<string, unknown> = {
        date: pco.date,
        recipient_type: pco.emp_idx !== null ? 'employee' : 'supplier',
        recipient_employee_id: pco.emp_idx !== null ? employees[pco.emp_idx].id : null,
        recipient_name_freetext: pco.freetext || null,
        category: pco.category,
        amount: pco.amount,
        reason: pco.reason,
        issued_by: capturedBy,
        status: pco.status,
      };
      const { error } = await supabase.from('petty_cash_outs').insert(row);
      if (error) results.push(`Petty cash out error (${pco.reason}): ${error.message}`);
    }
    results.push(`Petty cash outs: ${pettyCashOuts.length} transactions`);

    // Insert petty cash slips for squared items
    const { data: squaredOuts } = await supabase
      .from('petty_cash_outs')
      .select('id, amount')
      .eq('status', 'squared')
      .gte('date', '2026-04-18')
      .lte('date', '2026-04-24');

    if (squaredOuts) {
      for (const so of squaredOuts) {
        await supabase.from('petty_cash_slips').insert({
          petty_cash_out_id: so.id,
          slip_amount: so.amount,
          slip_photo_url: null,
          squared_by: capturedBy,
        });
      }
      results.push(`Petty cash slips: ${squaredOuts.length} slips`);
    }

    // === ANNOUNCEMENTS ===
    await supabase.from('announcements').insert([
      {
        title: 'Freedom Day — Monday 27 April',
        body: 'Reminder: Monday 27 April is Freedom Day. The factory will be closed. Normal operations resume Tuesday 28 April.',
        created_by: capturedBy,
      },
      {
        title: 'PPE inspection this week',
        body: 'All staff must have safety boots and gloves available for inspection. Missing PPE will result in a written warning.',
        created_by: capturedBy,
      },
    ]);
    results.push('Announcements: 2 added');

    // === AUDIT LOG ===
    await supabase.from('audit_log').insert([
      {
        user_id: capturedBy,
        action: 'seed_test_week',
        entity_type: 'system',
        entity_id: null,
        after_state: { week: '2026-04-18 to 2026-04-24' },
      },
    ]);
    results.push('Audit log: 1 entry');

    // === LEAVE REQUEST ===
    // PT006 on annual leave
    if (employees[leaveEmployeeIdx]) {
      const { error: leaveError } = await supabase.from('leave').insert({
        employee_id: employees[leaveEmployeeIdx].id,
        leave_type: 'annual',
        from_date: '2026-04-18',
        to_date: '2026-04-24',
        days: 5,
        reason: 'Family visit',
        approved_by: capturedBy,
        approved_at: '2026-04-16T10:00:00Z',
      });
      if (leaveError) results.push('Leave error: ' + leaveError.message);
      else results.push('Leave: 1 annual leave record (5 days)');

      // Update leave balance
      await supabase
        .from('leave_balances')
        .update({ annual_remaining: 16 })
        .eq('employee_id', employees[leaveEmployeeIdx].id);
    }

    // === WARNING ===
    // Give a warning to someone who was repeatedly late
    const lateEmployee = employees[11]; // pick one
    if (lateEmployee) {
      await supabase.from('warnings').insert({
        employee_id: lateEmployee.id,
        issued_date: '2026-04-22',
        category: 'A',
        offence: 'Repeated lateness',
        level: 'verbal',
        description: 'Employee has been late 3 times in the past 2 weeks. Verbal warning issued per company policy.',
        issued_by: capturedBy,
        expiry_date: '2026-10-22',
        status: 'active',
      });
      results.push('Warning: 1 verbal warning issued');
    }

    // Update petty cash balance setting
    const totalIn = 5000;
    const totalOut = pettyCashOuts.reduce((s, p) => s + p.amount, 0);
    await supabase.from('settings').upsert({
      key: 'petty_cash_balance',
      value: totalIn - totalOut,
      updated_by: capturedBy,
    });
    await supabase.from('settings').upsert({
      key: 'petty_cash_float_target',
      value: 5000,
      updated_by: capturedBy,
    });
    results.push(`Petty cash balance: R${totalIn - totalOut} (in: R${totalIn}, out: R${totalOut})`);

    return NextResponse.json({ success: true, results });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: msg, results }, { status: 500 });
  }
}
