import { NextRequest, NextResponse } from 'next/server';
import { createServiceRoleSupabase } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const month = req.nextUrl.searchParams.get('month');
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      return NextResponse.json({ error: 'month is required (YYYY-MM)' }, { status: 400 });
    }

    const startDate = `${month}-01`;
    const [y, m] = month.split('-').map(Number);
    const endDate = `${y}-${String(m + 1).padStart(2, '0')}-01`;

    const supabase = await createServiceRoleSupabase();

    const [outsRes, insRes] = await Promise.all([
      supabase
        .from('petty_cash_outs')
        .select('category, amount')
        .gte('date', startDate)
        .lt('date', m === 12 ? `${y + 1}-01-01` : endDate),
      supabase
        .from('petty_cash_ins')
        .select('amount')
        .gte('date', startDate)
        .lt('date', m === 12 ? `${y + 1}-01-01` : endDate),
    ]);

    const outs = outsRes.data || [];
    const ins = insRes.data || [];

    const totalIn = ins.reduce((sum: number, i: any) => sum + (i.amount || 0), 0);
    const totalOut = outs.reduce((sum: number, o: any) => sum + (o.amount || 0), 0);

    // Group by category
    const categoryMap = new Map<string, { total: number; count: number }>();
    for (const o of outs) {
      const cat = o.category || 'other';
      const existing = categoryMap.get(cat) || { total: 0, count: 0 };
      existing.total += o.amount || 0;
      existing.count += 1;
      categoryMap.set(cat, existing);
    }

    const byCategory = Array.from(categoryMap.entries())
      .map(([category, data]) => ({
        category,
        total: data.total,
        count: data.count,
        pct: totalOut > 0 ? Math.round((data.total / totalOut) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    return NextResponse.json({
      month,
      totalIn,
      totalOut,
      balance: totalIn - totalOut,
      byCategory,
    });
  } catch (err) {
    console.error('Petty cash breakdown error:', err);
    return NextResponse.json({ error: 'Failed to load breakdown' }, { status: 500 });
  }
}
