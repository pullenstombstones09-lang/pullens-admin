import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';
import { getEnrichedEmployees } from '@/lib/seed-employees';

// This route uses the service role key to bypass RLS for seeding.
// It should only be run once during initial setup.
// Protected by a seed secret to prevent accidental re-runs.

const SEED_SECRET = process.env.SEED_SECRET || 'pullens-initial-seed-2026';

export async function POST(request: Request) {
  const { secret } = await request.json();

  if (secret !== SEED_SECRET) {
    return NextResponse.json({ error: 'Invalid seed secret' }, { status: 403 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const results: string[] = [];

  try {
    // 1. Seed users (6 system users)
    const users = [
      { name: 'Annika', role: 'head_admin', pin: '4682', force_pin_change: false },
      { name: 'Nisha', role: 'head_of_admin', pin: '0000', force_pin_change: true },
      { name: 'Veshi', role: 'head_of_sales', pin: '0000', force_pin_change: true },
      { name: 'Marlyn', role: 'admin', pin: '0000', force_pin_change: true },
      { name: 'Lee-Ann', role: 'bookkeeper', pin: '0000', force_pin_change: true },
      { name: 'Kam', role: 'petty_cash', pin: '0000', force_pin_change: true },
    ];

    for (const user of users) {
      const pin_hash = await bcrypt.hash(user.pin, 10);
      const email = `${user.name.toLowerCase().replace(/[^a-z]/g, '')}@pullens.local`;

      // Create Supabase Auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email,
        password: user.pin,
        email_confirm: true,
        user_metadata: { name: user.name, role: user.role },
      });

      if (authError && !authError.message.includes('already been registered')) {
        results.push(`Auth user ${user.name}: ERROR - ${authError.message}`);
        continue;
      }

      const userId = authUser?.user?.id;

      // Insert into users table
      const { error: insertError } = await supabase.from('users').upsert({
        id: userId,
        name: user.name,
        role: user.role,
        pin_hash,
        perms: {},
        active: true,
        force_pin_change: user.force_pin_change,
      }, { onConflict: 'id' });

      if (insertError) {
        results.push(`User ${user.name}: ERROR - ${insertError.message}`);
      } else {
        results.push(`User ${user.name}: OK (${user.role})`);
      }
    }

    // 2. Seed employees (38 staff)
    const employees = getEnrichedEmployees();

    for (const emp of employees) {
      const { error } = await supabase.from('employees').upsert({
        pt_code: emp.pt_code,
        legacy_code: emp.legacy_code,
        full_name: emp.full_name,
        id_number: emp.id_number,
        dob: emp.dob,
        gender: emp.gender,
        race: emp.race,
        disability: emp.disability,
        cell: emp.cell,
        home_address: emp.home_address,
        occupation: emp.occupation,
        start_date: emp.start_date,
        weekly_wage: emp.weekly_wage,
        payment_method: emp.payment_method,
        bank_name: emp.bank_name,
        bank_acc: emp.bank_acc,
        bank_branch: emp.bank_branch,
        bank_type: emp.bank_type,
        emergency_name: emp.emergency_name,
        emergency_rel: emp.emergency_rel,
        emergency_phone: emp.emergency_phone,
        uif_ref: emp.uif_ref,
        garnishee: emp.garnishee,
        eif_on_file: emp.eif_on_file,
        eif_signed: emp.eif_signed,
        eif_date: emp.eif_date,
        status: emp.status,
        notes: emp.notes,
      }, { onConflict: 'pt_code' });

      if (error) {
        results.push(`Employee ${emp.pt_code} ${emp.full_name}: ERROR - ${error.message}`);
      } else {
        results.push(`Employee ${emp.pt_code} ${emp.full_name}: OK`);
      }
    }

    // 3. Seed leave balances for all employees
    const { data: allEmployees } = await supabase
      .from('employees')
      .select('id')
      .eq('status', 'active');

    if (allEmployees) {
      for (const emp of allEmployees) {
        const { error } = await supabase.from('leave_balances').upsert({
          employee_id: emp.id,
          annual_remaining: 21,
          sick_remaining: 30,
          family_remaining: 3,
          parental_used: 0,
        }, { onConflict: 'employee_id' });

        if (error) {
          results.push(`Leave balance ${emp.id}: ERROR - ${error.message}`);
        }
      }
      results.push(`Leave balances: seeded for ${allEmployees.length} employees`);
    }

    return NextResponse.json({
      success: true,
      results,
      summary: {
        users: users.length,
        employees: employees.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: 'Seed failed', details: String(error) },
      { status: 500 }
    );
  }
}
