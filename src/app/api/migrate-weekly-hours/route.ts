import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const FORTY_FIVE_HR_PT_CODES = ['PT008', 'PT012', 'PT023', 'PT024', 'PT028', 'PT032'];

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  if (searchParams.get('secret') !== 'pullens-seed-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: string[] = [];

  // Step 1: Add column via Supabase Management API SQL
  const projectRef = 'eznppvewksorfoedgzpa';
  const sql = `ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS weekly_hours integer NOT NULL DEFAULT 40;`;

  try {
    // Use supabase-js to query if column already exists
    const { data: testRow } = await supabase
      .from('employees')
      .select('weekly_hours')
      .limit(1)
      .maybeSingle();

    if (testRow !== null && 'weekly_hours' in (testRow as Record<string, unknown>)) {
      results.push('Column weekly_hours already exists');
    } else {
      results.push('Column weekly_hours does not exist yet — please run this SQL in Supabase dashboard: ' + sql);
      return NextResponse.json({ results, action_required: sql });
    }
  } catch {
    results.push('Column check failed — please run this SQL in Supabase dashboard: ' + sql);
    return NextResponse.json({ results, action_required: sql });
  }

  // Step 2: Update 45-hour employees
  for (const pt of FORTY_FIVE_HR_PT_CODES) {
    const { error } = await supabase
      .from('employees')
      .update({ weekly_hours: 45 })
      .eq('pt_code', pt);

    results.push(`${pt} → 45hrs: ${error ? 'error: ' + error.message : 'ok'}`);
  }

  return NextResponse.json({ results });
}
