import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { headers } from 'next/headers';

export async function GET(request: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const today = new Date().toISOString().split('T')[0];

  // Run queries in parallel
  const [employeesRes, attendanceRes, pettyCashInsRes, pettyCashOutsRes, announcementsRes] = await Promise.all([
    supabase.from('employees').select('id', { count: 'exact', head: true }).eq('status', 'active'),
    supabase.from('attendance').select('id', { count: 'exact', head: true }).eq('date', today).in('status', ['present', 'late']),
    supabase.from('petty_cash_ins').select('amount'),
    supabase.from('petty_cash_outs').select('amount').eq('status', 'approved'),
    supabase.from('announcements').select('*').order('created_at', { ascending: false }).limit(5),
  ]);

  const totalStaff = employeesRes.count || 0;
  const staffPresent = attendanceRes.count || 0;

  const totalIn = (pettyCashInsRes.data || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  const totalOut = (pettyCashOutsRes.data || []).reduce((sum, r) => sum + (r.amount || 0), 0);
  const pettyCashBalance = totalIn - totalOut;

  const announcements = announcementsRes.data || [];

  // Fetch alert count from the alerts API (same origin)
  let alertCount = 0;
  try {
    const origin = new URL(request.url).origin;
    const alertsRes = await fetch(`${origin}/api/alerts`);
    if (alertsRes.ok) {
      const alertsData = await alertsRes.json();
      alertCount = Array.isArray(alertsData) ? alertsData.length : 0;
    }
  } catch {
    // Alerts fetch failed, leave at 0
  }

  return NextResponse.json({
    totalStaff,
    staffPresent,
    pettyCashBalance,
    alertCount,
    announcements,
  });
}
