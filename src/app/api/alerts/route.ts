import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export interface AlertItem {
  id: string;
  type: string;
  severity: 'red' | 'amber' | 'yellow' | 'blue' | 'green';
  title: string;
  description: string;
  employee_id: string | null;
  employee_name: string | null;
  action_url: string | null;
  created_at: string;
}

const SEVERITY_ORDER: Record<string, number> = {
  red: 0,
  amber: 1,
  yellow: 2,
  blue: 3,
  green: 4,
};

function daysUntil(dateStr: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const target = new Date(dateStr);
  target.setHours(0, 0, 0, 0);
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function makeId(type: string, entityId: string): string {
  return `${type}::${entityId}`;
}

export async function GET() {
  try {
    // Use service role to bypass RLS (auth is temporarily bypassed)
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    const alerts: AlertItem[] = [];
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Fetch employees for name lookups
    const { data: employees } = await supabase
      .from('employees')
      .select('id, full_name, id_number, start_date, status')
      .eq('status', 'active');

    const empMap = new Map(
      (employees || []).map((e) => [e.id, e])
    );

    // ─── 1 & 2: Medical certificates expiring / expired ───
    const { data: medCerts } = await supabase
      .from('medical_certs')
      .select('id, employee_id, to_date');

    for (const cert of medCerts || []) {
      const days = daysUntil(cert.to_date);
      const emp = empMap.get(cert.employee_id);
      if (!emp) continue;

      if (days < 0) {
        alerts.push({
          id: makeId('medical_expired', cert.id),
          type: 'medical_expired',
          severity: 'red',
          title: 'Medical certificate expired',
          description: `Certificate expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`,
          employee_id: cert.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${cert.employee_id}`,
          created_at: todayStr,
        });
      } else if (days <= 14) {
        alerts.push({
          id: makeId('medical_expiring', cert.id),
          type: 'medical_expiring',
          severity: 'amber',
          title: 'Medical certificate expiring',
          description: `Expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: cert.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${cert.employee_id}`,
          created_at: todayStr,
        });
      }
    }

    // ─── 3, 4, 5: Warnings expiring ───
    const { data: warnings } = await supabase
      .from('warnings')
      .select('id, employee_id, level, expiry_date, status')
      .eq('status', 'active')
      .not('expiry_date', 'is', null);

    for (const w of warnings || []) {
      if (!w.expiry_date) continue;
      const days = daysUntil(w.expiry_date);
      const emp = empMap.get(w.employee_id);
      if (!emp) continue;

      if (w.level === 'verbal' && days <= 7 && days >= 0) {
        alerts.push({
          id: makeId('verbal_expiring', w.id),
          type: 'verbal_expiring',
          severity: 'yellow',
          title: 'Verbal warning expiring',
          description: `Expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: w.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${w.employee_id}`,
          created_at: todayStr,
        });
      } else if (w.level === 'written' && days <= 14 && days >= 0) {
        alerts.push({
          id: makeId('written_expiring', w.id),
          type: 'written_expiring',
          severity: 'yellow',
          title: 'Written warning expiring',
          description: `Expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: w.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${w.employee_id}`,
          created_at: todayStr,
        });
      } else if (w.level === 'final' && days <= 30 && days >= 0) {
        alerts.push({
          id: makeId('final_expiring', w.id),
          type: 'final_expiring',
          severity: 'amber',
          title: 'Final written warning expiring',
          description: `Expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: w.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${w.employee_id}`,
          created_at: todayStr,
        });
      }
    }

    // ─── 6: Probation ending (based on start_date, assume 3-month probation) ───
    for (const emp of employees || []) {
      if (!emp.start_date) continue;
      const probationEnd = new Date(emp.start_date);
      probationEnd.setMonth(probationEnd.getMonth() + 3);
      const days = daysUntil(probationEnd.toISOString().split('T')[0]);

      if (days === 0) {
        alerts.push({
          id: makeId('probation_ending', emp.id),
          type: 'probation_ending',
          severity: 'red',
          title: 'Probation ending today',
          description: 'Probation period ends today — confirm or extend',
          employee_id: emp.id,
          employee_name: emp.full_name,
          action_url: `/staff/${emp.id}`,
          created_at: todayStr,
        });
      } else if (days > 0 && days <= 7) {
        alerts.push({
          id: makeId('probation_ending', emp.id),
          type: 'probation_ending',
          severity: days <= 3 ? 'amber' : 'yellow',
          title: 'Probation ending soon',
          description: `Probation ends in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          action_url: `/staff/${emp.id}`,
          created_at: todayStr,
        });
      } else if (days > 7 && days <= 14) {
        alerts.push({
          id: makeId('probation_ending', emp.id),
          type: 'probation_ending',
          severity: 'yellow',
          title: 'Probation ending in 2 weeks',
          description: `Probation ends in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          action_url: `/staff/${emp.id}`,
          created_at: todayStr,
        });
      }
    }

    // ─── 7: Payslip unsigned (Tuesday after payroll) ───
    const dayOfWeek = now.getDay(); // 0=Sun
    if (dayOfWeek >= 2) {
      // Tuesday or later — check for unsigned payslips from the latest run
      const { data: latestRun } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('status', 'paid')
        .order('week_end', { ascending: false })
        .limit(1)
        .single();

      if (latestRun) {
        const { data: unsignedSlips } = await supabase
          .from('payslips')
          .select('id, employee_id')
          .eq('payroll_run_id', latestRun.id)
          .is('signed_at', null);

        for (const slip of unsignedSlips || []) {
          const emp = empMap.get(slip.employee_id);
          if (!emp) continue;
          alerts.push({
            id: makeId('payslip_unsigned', slip.id),
            type: 'payslip_unsigned',
            severity: 'amber',
            title: 'Payslip unsigned',
            description: 'Employee has not signed their payslip',
            employee_id: slip.employee_id,
            employee_name: emp.full_name,
            action_url: `/staff/${slip.employee_id}`,
            created_at: todayStr,
          });
        }
      }
    }

    // ─── 8: Loan paid off ───
    const { data: paidLoans } = await supabase
      .from('loans')
      .select('id, employee_id, updated_at')
      .eq('status', 'closed')
      .eq('outstanding', 0)
      .order('updated_at', { ascending: false })
      .limit(20);

    for (const loan of paidLoans || []) {
      const emp = empMap.get(loan.employee_id);
      if (!emp) continue;
      const daysAgo = -daysUntil(loan.updated_at.split('T')[0]);
      if (daysAgo <= 7) {
        alerts.push({
          id: makeId('loan_paid_off', loan.id),
          type: 'loan_paid_off',
          severity: 'green',
          title: 'Loan fully paid off',
          description: 'Loan balance is zero — no further deductions needed',
          employee_id: loan.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${loan.employee_id}`,
          created_at: loan.updated_at,
        });
      }
    }

    // ─── 9: Staff birthday (today/tomorrow) ───
    for (const emp of employees || []) {
      if (!emp.id_number || emp.id_number.length < 6) continue;
      const mm = emp.id_number.slice(2, 4);
      const dd = emp.id_number.slice(4, 6);
      const thisYearBday = `${now.getFullYear()}-${mm}-${dd}`;
      const days = daysUntil(thisYearBday);

      if (days === 0) {
        alerts.push({
          id: makeId('birthday', emp.id),
          type: 'birthday',
          severity: 'blue',
          title: 'Happy birthday!',
          description: `${emp.full_name}'s birthday is today`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          action_url: null,
          created_at: todayStr,
        });
      } else if (days === 1) {
        alerts.push({
          id: makeId('birthday', emp.id),
          type: 'birthday',
          severity: 'blue',
          title: 'Birthday tomorrow',
          description: `${emp.full_name}'s birthday is tomorrow`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          action_url: null,
          created_at: todayStr,
        });
      }
    }

    // ─── 10: Contract expiring (fixed-term, via employee_documents) ───
    const { data: contracts } = await supabase
      .from('employee_documents')
      .select('id, employee_id, expiry_date')
      .eq('doc_type', 'contract')
      .not('expiry_date', 'is', null);

    for (const doc of contracts || []) {
      if (!doc.expiry_date) continue;
      const days = daysUntil(doc.expiry_date);
      const emp = empMap.get(doc.employee_id);
      if (!emp) continue;

      if (days <= 0) {
        alerts.push({
          id: makeId('contract_expired', doc.id),
          type: 'contract_expired',
          severity: 'red',
          title: 'Contract expired',
          description: `Contract expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`,
          employee_id: doc.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${doc.employee_id}`,
          created_at: todayStr,
        });
      } else if (days <= 7) {
        alerts.push({
          id: makeId('contract_expiring', doc.id),
          type: 'contract_expiring',
          severity: 'red',
          title: 'Contract expiring this week',
          description: `Contract expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: doc.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${doc.employee_id}`,
          created_at: todayStr,
        });
      } else if (days <= 14) {
        alerts.push({
          id: makeId('contract_expiring', doc.id),
          type: 'contract_expiring',
          severity: 'amber',
          title: 'Contract expiring in 2 weeks',
          description: `Contract expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: doc.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${doc.employee_id}`,
          created_at: todayStr,
        });
      } else if (days <= 30) {
        alerts.push({
          id: makeId('contract_expiring', doc.id),
          type: 'contract_expiring',
          severity: 'yellow',
          title: 'Contract expiring in 30 days',
          description: `Contract expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: doc.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${doc.employee_id}`,
          created_at: todayStr,
        });
      }
    }

    // ─── 11: Driver's licence / PrDP expiring (30 days) ───
    const { data: licenceDocs } = await supabase
      .from('employee_documents')
      .select('id, employee_id, doc_type, expiry_date')
      .in('doc_type', ['drivers', 'prdp'])
      .not('expiry_date', 'is', null);

    for (const doc of licenceDocs || []) {
      if (!doc.expiry_date) continue;
      const days = daysUntil(doc.expiry_date);
      const emp = empMap.get(doc.employee_id);
      if (!emp) continue;

      if (days <= 30) {
        const label = doc.doc_type === 'drivers' ? "Driver's licence" : 'PrDP';
        alerts.push({
          id: makeId('licence_expiring', doc.id),
          type: 'licence_expiring',
          severity: 'red',
          title: `${label} expiring`,
          description: days <= 0
            ? `${label} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago`
            : `${label} expires in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: doc.employee_id,
          employee_name: emp.full_name,
          action_url: `/staff/${doc.employee_id}`,
          created_at: todayStr,
        });
      }
    }

    // ─── 12: Document missing (ID / contract / EIF / banking) ───
    const requiredDocTypes = ['id_copy', 'contract', 'eif', 'bank'];
    const { data: allDocs } = await supabase
      .from('employee_documents')
      .select('employee_id, doc_type');

    const docsByEmployee = new Map<string, Set<string>>();
    for (const d of allDocs || []) {
      if (!docsByEmployee.has(d.employee_id)) {
        docsByEmployee.set(d.employee_id, new Set());
      }
      docsByEmployee.get(d.employee_id)!.add(d.doc_type);
    }

    for (const emp of employees || []) {
      const empDocs = docsByEmployee.get(emp.id) || new Set();
      const missing = requiredDocTypes.filter((t) => !empDocs.has(t));
      if (missing.length > 0) {
        alerts.push({
          id: makeId('doc_missing', emp.id),
          type: 'doc_missing',
          severity: 'red',
          title: 'Required document missing',
          description: `Missing: ${missing.map((t) => t.replace(/_/g, ' ').toUpperCase()).join(', ')}`,
          employee_id: emp.id,
          employee_name: emp.full_name,
          action_url: `/staff/${emp.id}`,
          created_at: todayStr,
        });
      }
    }

    // ─── 13: Late-pattern flag (5+ lates in 20 days) ───
    const twentyDaysAgo = new Date(now);
    twentyDaysAgo.setDate(twentyDaysAgo.getDate() - 20);
    const { data: lateRecords } = await supabase
      .from('attendance')
      .select('employee_id')
      .eq('status', 'late')
      .gte('date', twentyDaysAgo.toISOString().split('T')[0]);

    const lateCounts = new Map<string, number>();
    for (const r of lateRecords || []) {
      lateCounts.set(r.employee_id, (lateCounts.get(r.employee_id) || 0) + 1);
    }
    for (const [empId, count] of lateCounts) {
      if (count >= 5) {
        const emp = empMap.get(empId);
        if (!emp) continue;
        alerts.push({
          id: makeId('late_pattern', empId),
          type: 'late_pattern',
          severity: 'amber',
          title: 'Late-coming pattern flagged',
          description: `${count} lates in the last 20 days`,
          employee_id: empId,
          employee_name: emp.full_name,
          action_url: `/staff/${empId}`,
          created_at: todayStr,
        });
      }
    }

    // ─── 14: Petty cash shortfall pending (Wednesday preview) ───
    if (dayOfWeek === 3) {
      // Wednesday
      const { data: openOuts } = await supabase
        .from('petty_cash_outs')
        .select('id, recipient_employee_id, recipient_name_freetext, amount, status')
        .in('status', ['open', 'partial']);

      for (const out of openOuts || []) {
        const empName = out.recipient_employee_id
          ? empMap.get(out.recipient_employee_id)?.full_name || 'Unknown'
          : out.recipient_name_freetext || 'Unknown';
        alerts.push({
          id: makeId('petty_shortfall', out.id),
          type: 'petty_shortfall',
          severity: 'amber',
          title: 'Petty cash shortfall pending',
          description: `R${out.amount.toFixed(2)} outstanding — cutoff approaching`,
          employee_id: out.recipient_employee_id,
          employee_name: empName,
          action_url: '/petty-cash',
          created_at: todayStr,
        });
      }
    }

    // ─── 15: Tin variance (3+ days) ───
    // Compare expected tin balance vs actual (simplified: sum ins - sum outs)
    const { data: cashIns } = await supabase
      .from('petty_cash_ins')
      .select('amount');
    const { data: cashOuts } = await supabase
      .from('petty_cash_outs')
      .select('amount');

    const totalIn = (cashIns || []).reduce((s, r) => s + r.amount, 0);
    const totalOut = (cashOuts || []).reduce((s, r) => s + r.amount, 0);
    const expectedBalance = totalIn - totalOut;

    // We check settings for last_tin_count; if variance exists 3+ days, flag it
    const { data: tinSetting } = await supabase
      .from('settings')
      .select('value, updated_at')
      .eq('key', 'last_tin_count')
      .single();

    if (tinSetting) {
      const actualBalance = typeof tinSetting.value === 'number' ? tinSetting.value : 0;
      const variance = Math.abs(expectedBalance - actualBalance);
      if (variance > 1) {
        const countDate = new Date(tinSetting.updated_at);
        const daysSinceCount = -daysUntil(countDate.toISOString().split('T')[0]);
        if (daysSinceCount >= 3) {
          alerts.push({
            id: makeId('tin_variance', 'global'),
            type: 'tin_variance',
            severity: 'red',
            title: 'Petty cash tin variance',
            description: `R${variance.toFixed(2)} variance for ${daysSinceCount} day${daysSinceCount === 1 ? '' : 's'}`,
            employee_id: null,
            employee_name: null,
            action_url: '/petty-cash',
            created_at: todayStr,
          });
        }
      }
    }

    // ─── 16: Public holiday in 7 days ───
    const { data: holidays } = await supabase
      .from('public_holidays')
      .select('date, name');

    for (const h of holidays || []) {
      const days = daysUntil(h.date);
      if (days >= 0 && days <= 7) {
        alerts.push({
          id: makeId('public_holiday', h.date),
          type: 'public_holiday',
          severity: 'blue',
          title: days === 0 ? 'Public holiday today' : 'Public holiday approaching',
          description: days === 0
            ? `${h.name} — today`
            : `${h.name} in ${days} day${days === 1 ? '' : 's'}`,
          employee_id: null,
          employee_name: null,
          action_url: '/settings',
          created_at: todayStr,
        });
      }
    }

    // Sort by severity (red first)
    alerts.sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);

    return NextResponse.json(alerts);
  } catch (error) {
    console.error('Error computing alerts:', error);
    return NextResponse.json(
      { error: 'Failed to compute alerts' },
      { status: 500 }
    );
  }
}
