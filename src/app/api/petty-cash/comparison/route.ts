import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';

async function getMonthData(supabase: any, month: string) {
  const startDate = `${month}-01`;
  const [y, m] = month.split('-').map(Number);
  const endDate = m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, '0')}-01`;

  const [outsRes, insRes] = await Promise.all([
    supabase
      .from('petty_cash_outs')
      .select('category, amount')
      .gte('date', startDate)
      .lt('date', endDate),
    supabase
      .from('petty_cash_ins')
      .select('amount')
      .gte('date', startDate)
      .lt('date', endDate),
  ]);

  const outs = outsRes.data || [];
  const ins = insRes.data || [];

  const totalIn = ins.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
  const totalOut = outs.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);

  const categoryMap = new Map<string, number>();
  for (const o of outs) {
    const cat = o.category || 'other';
    categoryMap.set(cat, (categoryMap.get(cat) || 0) + (o.amount || 0));
  }

  return { totalIn, totalOut, byCategory: Object.fromEntries(categoryMap) };
}

export async function GET(req: NextRequest) {
  try {
    const month1 = req.nextUrl.searchParams.get('month1');
    const month2 = req.nextUrl.searchParams.get('month2');

    if (!month1 || !month2) {
      return NextResponse.json({ error: 'month1 and month2 are required' }, { status: 400 });
    }

    const supabase = await createServiceRoleSupabase();
    const [data1, data2] = await Promise.all([
      getMonthData(supabase, month1),
      getMonthData(supabase, month2),
    ]);

    // Build comparison by category
    const allCategories = new Set([
      ...Object.keys(data1.byCategory),
      ...Object.keys(data2.byCategory),
    ]);

    const comparison = Array.from(allCategories).map((cat) => {
      const v1 = data1.byCategory[cat] || 0;
      const v2 = data2.byCategory[cat] || 0;
      const diff = v1 - v2;
      const pctChange = v2 > 0 ? Math.round((diff / v2) * 100) : v1 > 0 ? 100 : 0;
      return { category: cat, month1: v1, month2: v2, diff, pctChange };
    }).sort((a, b) => b.month1 - a.month1);

    return NextResponse.json({
      month1: { month: month1, ...data1 },
      month2: { month: month2, ...data2 },
      comparison,
      totalDiff: data1.totalOut - data2.totalOut,
      totalPctChange: data2.totalOut > 0
        ? Math.round(((data1.totalOut - data2.totalOut) / data2.totalOut) * 100)
        : 0,
    });
  } catch (err) {
    console.error('Petty cash comparison error:', err);
    return NextResponse.json({ error: 'Failed to compare months' }, { status: 500 });
  }
}
