import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LOANS = [
  // Musa PT005 — multiple small loans, complex history, current balance R380
  { pt_code: 'PT005', amount: 1480, outstanding: 380, weekly_deduction: 100, date_advanced: '2026-01-08', purpose: 'Multiple advances (Jan–Apr 2026)' },
  // Enrique PT014 — R800 taken 17/03
  { pt_code: 'PT014', amount: 800, outstanding: 400, weekly_deduction: 100, date_advanced: '2026-03-17', purpose: null },
  // Cherylette PT015 — R2000 taken 07/01, "to take out from Thiken"
  { pt_code: 'PT015', amount: 2000, outstanding: 700, weekly_deduction: 100, date_advanced: '2026-01-07', purpose: 'To take out from Thiken' },
  // Thabiso (Albert) PT018 — R1500 from 2025 + R200 (12/01) + R50 (05/02) + R100 (18/02) + R1000 funeral (04/03) + R300 funeral (04/03) + R100 (13/04)
  { pt_code: 'PT018', amount: 3250, outstanding: 1500, weekly_deduction: 100, date_advanced: '2025-12-01', purpose: 'Carry-over from 2025 + funeral advances' },
  // Philani Mkhize PT026 — R3250, "Warning" noted
  { pt_code: 'PT026', amount: 3250, outstanding: 1850, weekly_deduction: 200, date_advanced: '2026-01-01', purpose: 'Warning noted' },
  // Zandile PT032 — R1000 taken 23/02, "from Payments 8314/8318"
  { pt_code: 'PT032', amount: 1000, outstanding: 100, weekly_deduction: 100, date_advanced: '2026-02-23', purpose: 'From Payments 8314/8318' },
  // Joel PT034 — Loan 1 (R200) paid off. Loan 2: R1750 taken 03/02, truck steps + R700 labour + R100 boss (09/03) + R150 (03/04)
  { pt_code: 'PT034', amount: 2700, outstanding: 1300, weekly_deduction: 200, date_advanced: '2026-02-03', purpose: 'Truck steps + R700 labour + additional advances' },
];

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');
  if (secret !== 'pullens-seed-2026') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const results: { step: string; status: string; detail?: string }[] = [];

  // Step 1: Delete accidental employees PT039-PT053
  const ptCodesToDelete = Array.from({ length: 15 }, (_, i) => `PT${String(39 + i).padStart(3, '0')}`);

  // First get IDs, then delete by ID (more reliable with RLS)
  const { data: toDelete } = await supabase
    .from('employees')
    .select('id, pt_code')
    .in('pt_code', ptCodesToDelete);

  let delCount = 0;
  if (toDelete && toDelete.length > 0) {
    for (const emp of toDelete) {
      const { error: dErr } = await supabase.from('employees').delete().eq('id', emp.id);
      if (!dErr) delCount++;
    }
  }

  results.push({
    step: 'Delete PT039-PT053',
    status: 'done',
    detail: `${delCount} of ${toDelete?.length ?? 0} deleted`,
  });

  // Step 2: Insert loans
  for (const loan of LOANS) {
    // Look up employee_id by pt_code
    const { data: emp } = await supabase
      .from('employees')
      .select('id, full_name')
      .eq('pt_code', loan.pt_code)
      .maybeSingle();

    if (!emp) {
      results.push({ step: `Loan ${loan.pt_code}`, status: 'error', detail: 'Employee not found' });
      continue;
    }

    // Check if loan already exists for this employee (avoid duplicates)
    const { data: existing } = await supabase
      .from('loans')
      .select('id')
      .eq('employee_id', emp.id)
      .eq('status', 'active')
      .maybeSingle();

    if (existing) {
      results.push({ step: `Loan ${loan.pt_code} (${emp.full_name})`, status: 'skipped', detail: 'Active loan already exists' });
      continue;
    }

    const { error: loanError } = await supabase.from('loans').insert({
      employee_id: emp.id,
      date_advanced: loan.date_advanced,
      amount: loan.amount,
      weekly_deduction: loan.weekly_deduction,
      outstanding: loan.outstanding,
      purpose: loan.purpose,
      auto_generated_from_petty: false,
      status: 'active',
    });

    results.push({
      step: `Loan ${loan.pt_code} (${emp.full_name})`,
      status: loanError ? 'error' : 'created',
      detail: loanError ? loanError.message : `R${loan.outstanding} outstanding, R${loan.weekly_deduction}/week`,
    });
  }

  return NextResponse.json({ results });
}
