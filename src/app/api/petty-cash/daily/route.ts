import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const date = req.nextUrl.searchParams.get('date');
    if (!date) {
      return NextResponse.json({ error: 'date is required' }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabase();

    const [outsRes, insRes] = await Promise.all([
      supabase
        .from('petty_cash_outs')
        .select('*, employee:employees(full_name)')
        .eq('date', date)
        .order('created_at', { ascending: false }),
      supabase
        .from('petty_cash_ins')
        .select('*')
        .eq('date', date)
        .order('created_at', { ascending: false }),
    ]);

    const outs = (outsRes.data || []).map((o: any) => ({
      ...o,
      employee_name: o.employee?.full_name || o.recipient_freetext || 'Unknown',
    }));

    const ins = insRes.data || [];
    const totalIn = ins.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
    const totalOut = outs.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);

    return NextResponse.json({
      date,
      cashIns: ins,
      cashOuts: outs,
      totalIn,
      totalOut,
      net: totalIn - totalOut,
    });
  } catch (err) {
    console.error('Petty cash daily error:', err);
    return NextResponse.json({ error: 'Failed to load daily data' }, { status: 500 });
  }
}
