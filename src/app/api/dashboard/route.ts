import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split('T')[0];

  // Run queries in parallel
  const [employeesRes, attendanceRes, pettyCashInsRes, pettyCashOutsRes, alertsRes, announcementsRes] = await Promise.all([
    // Total active employees
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),

    // Today's attendance (present)
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).in('status', ['present', 'late']),

    // Petty cash total in
    supabase.from('petty_cash_ins').select('amount'),

    // Petty cash total out (only approved)
    supabase.from('petty_cash_outs').select('amount').eq('status', 'approved'),

    // Unread/pending alerts
    supabase.from('audit_log').select('id', { count: 'exact', head: true }).eq('acknowledged', false),

    // Recent announcements
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
  ]);

  const totalStaff = employeesRes.count || 0;
  const staffPresent = attendanceRes.count || 0;

  // Calculate petty cash balance
  const totalIn = (pettyCashInsRes.data || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalOut = (pettyCashOutsRes.data || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  const pettyCashBalance = totalIn - totalOut;

  const alertCount = alertsRes.count || 0;
  const announcements = announcementsRes.data || [];

  return NextResponse.json({
    totalStaff,
    staffPresent,
    pettyCashBalance,
    alertCount,
    announcements,
  });
}
