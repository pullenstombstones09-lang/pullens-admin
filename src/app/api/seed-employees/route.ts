import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NEW_EMPLOYEES = [
  { pt_code: 'PT039', full_name: 'SHAFIE', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT040', full_name: 'PHUMLANI OXBANGS', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT041', full_name: 'THOKOZANI', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT042', full_name: 'KHULEKANI', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT043', full_name: 'INNOCENT', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT044', full_name: 'MNCEDI', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT045', full_name: 'SPHA', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT046', full_name: 'RAZAK', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT047', full_name: 'ALI', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT048', full_name: 'UMAR', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT049', full_name: 'YUSUF', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT050', full_name: 'JUMA', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT051', full_name: 'MOLEFE', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT052', full_name: 'THOBE', occupation: 'GENERAL WORKER' },
  { pt_code: 'PT053', full_name: 'REUBEN', occupation: 'GENERAL WORKER' },
];

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== 'pullens-seed-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results = [];

  for (const emp of NEW_EMPLOYEES) {
    // Check if pt_code already exists
    const { data: existing } = await supabase
      .from('employees')
      .select('id')
      .eq('pt_code', emp.pt_code)
      .maybeSingle();

    if (existing) {
      results.push({ pt_code: emp.pt_code, name: emp.full_name, status: 'skipped (exists)' });
      continue;
    }

    const { error } = await supabase.from('employees').insert({
      pt_code: emp.pt_code,
      full_name: emp.full_name,
      occupation: emp.occupation,
      gender: 'Male',
      disability: false,
      weekly_wage: 0,
      payment_method: 'cash',
      garnishee: 0,
      eif_on_file: false,
      eif_signed: false,
      status: 'active',
    });

    if (error) {
      results.push({ pt_code: emp.pt_code, name: emp.full_name, status: 'error: ' + error.message });
    } else {
      results.push({ pt_code: emp.pt_code, name: emp.full_name, status: 'created' });
    }
  }

  return NextResponse.json({ results });
}
