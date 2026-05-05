# Payroll & Workflow Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the payroll workflow with per-employee approval, Saturday cash payroll, updated late rules, full-week register, day-aware dashboard, and a visual refresh that kills the AI slop.

**Architecture:** The payroll pipeline becomes approval-gated — every employee defaults to approved, anomalies get flagged, owner reviews before hitting "Run Final Payroll". Saturday gets its own separate cash payroll. A global payslip viewer slide panel lets you tap any employee name on any screen to see their full breakdown. The dashboard becomes day-aware with a pulsing "what's next" indicator. Supabase Realtime powers liveness — counters tick up without refreshing.

**Tech Stack:** Next.js (App Router), React, TypeScript, Tailwind CSS, Supabase (PostgreSQL + Realtime), Lucide icons, Navigator.vibrate() for haptics.

**Spec:** `docs/superpowers/specs/2026-05-05-payroll-workflow-redesign.md`

---

## File Structure

### New Files
| File | Responsibility |
|---|---|
| `supabase/migrations/00005_payroll_batch_and_saturday.sql` | Add payroll_type enum, payroll_batch table |
| `src/lib/haptics.ts` | Haptic feedback utility (light, confirm, strong) |
| `src/lib/anomalies.ts` | Anomaly detection logic for payroll review |
| `src/lib/use-realtime.ts` | Supabase Realtime hook for liveness |
| `src/components/ui/payslip-viewer.tsx` | Global slide panel — full payslip breakdown |
| `src/components/ui/anomaly-badge.tsx` | Amber/red flag badges for payroll review |
| `src/components/ui/pulse-card.tsx` | Card with optional pulse animation for dashboard |
| `src/app/(dashboard)/payroll/review/page.tsx` | Payroll review + approval gate |
| `src/app/(dashboard)/payroll/saturday/page.tsx` | Saturday cash payroll capture |
| `src/app/api/payroll/recalculate/route.ts` | Recalculate single employee's payslip |
| `src/app/api/payroll/saturday/route.ts` | Saturday payroll run endpoint |
| `src/app/api/payroll/batch/route.ts` | Approval batch management (approve/pull) |

### Modified Files
| File | What Changes |
|---|---|
| `src/lib/payroll-engine.ts` | Late rule tiers, Friday 16:00 cutoff, Saturday calc |
| `src/lib/permissions.ts` | Add `capture_saturday`, `review_payroll` permissions |
| `src/types/database.ts` | Add PayrollBatch, PayrollType types, update PayrollRun |
| `src/app/(dashboard)/dashboard/page.tsx` | Day-aware checklist, pulsing what's next |
| `src/app/(dashboard)/register/page.tsx` | Full week grid view |
| `src/app/(dashboard)/payroll/page.tsx` | Remove inline approval, link to review page |
| `src/app/(dashboard)/payroll/sign/page.tsx` | Support saturday_cash runs |
| `src/app/(dashboard)/payroll/print/page.tsx` | Filter by payroll_type |
| `src/app/(dashboard)/payroll/bank/page.tsx` | Filter weekly only (Saturday is cash) |
| `src/app/(dashboard)/layout.tsx` | Updated sidebar, nav for new pages |
| `src/app/api/payroll/run/route.ts` | Accept approved_employee_ids, payroll_type |
| `src/app/api/workflow/route.ts` | Add review step, Saturday status |
| `src/components/ui/workflow-stepper.tsx` | Add Review step, update visual style |
| `src/app/globals.css` | Visual refresh — kill gradients, clean hierarchy |

---

## Task 1: Database Migration — payroll_batch + payroll_type

**Files:**
- Create: `supabase/migrations/00005_payroll_batch_and_saturday.sql`
- Modify: `src/types/database.ts`

- [ ] **Step 1: Write the migration SQL**

```sql
-- 00005_payroll_batch_and_saturday.sql
-- Adds payroll_type to payroll_runs and creates payroll_batch table

-- 1. Add payroll_type enum
DO $$ BEGIN
  CREATE TYPE payroll_type AS ENUM ('weekly', 'saturday_cash');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 2. Add payroll_type column to payroll_runs (default weekly for existing runs)
ALTER TABLE payroll_runs
  ADD COLUMN IF NOT EXISTS payroll_type payroll_type NOT NULL DEFAULT 'weekly';

-- 3. Create payroll_batch table for per-employee approval tracking
CREATE TABLE IF NOT EXISTS payroll_batch (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  payroll_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  employee_id UUID NOT NULL REFERENCES employees(id),
  status TEXT NOT NULL DEFAULT 'approved' CHECK (status IN ('approved', 'pulled', 'pending')),
  pulled_reason TEXT,
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (payroll_run_id, employee_id)
);

-- 4. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_payroll_batch_run ON payroll_batch(payroll_run_id);
CREATE INDEX IF NOT EXISTS idx_payroll_batch_employee ON payroll_batch(employee_id);

-- 5. RLS
ALTER TABLE payroll_batch ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Management and bookkeeper can read payroll_batch"
  ON payroll_batch FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('head_admin', 'head_of_admin', 'head_of_sales', 'bookkeeper')
    )
  );

CREATE POLICY "Management can write payroll_batch"
  ON payroll_batch FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users
      WHERE users.id = auth.uid()
      AND users.role IN ('head_admin', 'head_of_admin', 'head_of_sales')
    )
  );

-- 6. Updated_at trigger
CREATE TRIGGER update_payroll_batch_updated_at
  BEFORE UPDATE ON payroll_batch
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
```

- [ ] **Step 2: Run migration via Supabase SQL Editor**

Copy the SQL above into the Supabase SQL Editor for project `eznppvewksorfoedgzpa` and execute. Verify:
- `payroll_runs` has `payroll_type` column
- `payroll_batch` table exists with correct columns and constraints

- [ ] **Step 3: Update TypeScript types**

Add to `src/types/database.ts`:

```typescript
// After PayrollStatus type
export type PayrollType = 'weekly' | 'saturday_cash';

// After PayrollRun interface
export type BatchStatus = 'approved' | 'pulled' | 'pending';

export interface PayrollBatch {
  id: string;
  payroll_run_id: string;
  employee_id: string;
  status: BatchStatus;
  pulled_reason: string | null;
  updated_at: string;
}
```

Update the `PayrollRun` interface — add:

```typescript
export interface PayrollRun {
  // ... existing fields ...
  payroll_type: PayrollType; // ADD THIS
}
```

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00005_payroll_batch_and_saturday.sql src/types/database.ts
git commit -m "feat: add payroll_batch table and payroll_type enum"
```

---

## Task 2: Update Late-Coming Rules

**Files:**
- Modify: `src/lib/payroll-engine.ts:63-75`

- [ ] **Step 1: Write tests for new late tiers**

Create a test block at the bottom of the engine or in a test file. For now, verify manually with these cases:

| Input timeIn | Expected dock |
|---|---|
| `"07:55"` | 0 (before 8) |
| `"08:00"` | 0 (on time) |
| `"08:05"` | 0 (grace) |
| `"08:06"` | 30 |
| `"08:15"` | 30 |
| `"08:16"` | 60 |
| `"08:30"` | 60 |
| `"09:00"` | 60 |
| `"09:01"` | 61 |
| `"10:00"` | 120 |
| `"10:15"` | 135 |
| `"12:00"` | 240 |

- [ ] **Step 2: Replace calculateLateMinutes function**

In `src/lib/payroll-engine.ts`, replace the existing `calculateLateMinutes` function (lines 63-75):

```typescript
// Late-coming rules (updated May 2026)
// 08:00-08:05: on time (5-minute grace)
// 08:06-08:15: dock 30 min
// 08:16-09:00: dock 60 min
// 09:01+: dock actual minutes missed (auto, no supervisor override)
// Owner can still manually override any individual dock from the register
export function calculateLateMinutes(timeIn: string | null, manualOverride?: number): number {
  if (manualOverride !== undefined) return manualOverride;
  if (!timeIn) return 0;

  const [hours, minutes] = timeIn.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const eightOClock = 8 * 60; // 480

  if (totalMinutes <= eightOClock + 5) return 0;         // grace period
  if (totalMinutes <= eightOClock + 15) return 30;        // tier 1: dock 30 min
  if (totalMinutes <= eightOClock + 60) return 60;        // tier 2: dock 60 min
  // After 09:00: dock actual minutes missed from 08:00
  return totalMinutes - eightOClock;
}
```

- [ ] **Step 3: Verify with manual test cases**

Open the app, go to register, enter these times and confirm the late minutes column shows correctly:
- 08:05 → 0
- 08:10 → 30
- 08:20 → 60
- 10:00 → 120

- [ ] **Step 4: Commit**

```bash
git add src/lib/payroll-engine.ts
git commit -m "feat: update late-coming rules — grace 5min, 30min dock to 08:15, 60min to 09:00, actual after"
```

---

## Task 3: Friday 16:00 Cutoff + OT Rollover

**Files:**
- Modify: `src/lib/payroll-engine.ts`
- Modify: `src/app/api/payroll/run/route.ts`

- [ ] **Step 1: Add Friday OT detection to payroll engine**

Add this helper function to `src/lib/payroll-engine.ts` after the `calculateHoursWorked` function:

```typescript
// Friday 16:00 cutoff — hours after 16:00 on Friday are OT for next week
export function splitFridayHours(
  timeIn: string,
  timeOut: string,
  date: string
): { ordinaryMinutes: number; fridayOtMinutes: number } {
  const dayOfWeek = new Date(date).getDay(); // 0=Sun, 5=Fri
  if (dayOfWeek !== 5) {
    // Not Friday — all hours are ordinary (minus breaks)
    const [inH, inM] = timeIn.split(':').map(Number);
    const [outH, outM] = timeOut.split(':').map(Number);
    const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
    return { ordinaryMinutes: Math.max(0, totalMinutes - 45), fridayOtMinutes: 0 };
  }

  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  const fourPm = 16 * 60; // 960
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;

  if (outMinutes <= fourPm) {
    // Finished before or at 16:00 — all ordinary
    const totalMinutes = outMinutes - inMinutes;
    return { ordinaryMinutes: Math.max(0, totalMinutes - 45), fridayOtMinutes: 0 };
  }

  // Split at 16:00
  const ordinaryMinutes = Math.max(0, (fourPm - inMinutes) - 45); // minus breaks
  const fridayOtMinutes = outMinutes - fourPm; // no break deduction for OT portion
  return { ordinaryMinutes, fridayOtMinutes };
}
```

- [ ] **Step 2: Update calculatePayroll to use Friday split**

In the `calculatePayroll` function, update the attendance loop (around line 101-127). Replace the block inside `if (day.status === 'present' || day.status === 'late')`:

```typescript
if (day.status === 'present' || day.status === 'late') {
  if (day.time_in && day.time_out) {
    const { ordinaryMinutes, fridayOtMinutes } = splitFridayHours(
      day.time_in,
      day.time_out,
      day.date
    );
    hoursWorked = round2(ordinaryMinutes / 60);
    // Friday OT goes to next week — store but don't add to this week
    if (fridayOtMinutes > 0) {
      fridayOtRollover.push({
        date: day.date,
        minutes: fridayOtMinutes,
        employee_id: employee.id,
      });
    }
  } else {
    hoursWorked = dailyHours;
  }
}
```

Add `fridayOtRollover` array at the top of `calculatePayroll`:

```typescript
const fridayOtRollover: { date: string; minutes: number; employee_id: string }[] = [];
```

Add `friday_ot_rollover` to the `PayrollResult` interface:

```typescript
export interface PayrollResult {
  // ... existing fields ...
  friday_ot_rollover: { date: string; minutes: number; employee_id: string }[];
}
```

Return it in the result object:

```typescript
return {
  // ... existing fields ...
  friday_ot_rollover: fridayOtRollover,
};
```

- [ ] **Step 3: Update the payroll run API to handle Friday OT rollover**

In `src/app/api/payroll/run/route.ts`, after calculating all results, collect Friday OT entries and store them as overtime_requests for the following week:

```typescript
// After calculating all results, handle Friday OT rollover
const fridayOtEntries: { employee_id: string; date: string; hours: number }[] = [];
for (const result of results) {
  for (const ot of result.friday_ot_rollover) {
    fridayOtEntries.push({
      employee_id: ot.employee_id,
      date: ot.date,
      hours: round2(ot.minutes / 60),
    });
  }
}

if (fridayOtEntries.length > 0) {
  // Calculate next week's start
  const nextWeekStart = format(addDays(new Date(weekEnd), 1), 'yyyy-MM-dd');

  for (const entry of fridayOtEntries) {
    await serviceClient
      .from('overtime_requests')
      .upsert({
        employee_id: entry.employee_id,
        date: entry.date,
        hours: entry.hours,
        rate_multiplier: 1.5,
        status: 'approved',
        notes: `Friday OT rollover from week of ${weekStart}`,
      }, { onConflict: 'employee_id,date' });
  }
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/payroll-engine.ts src/app/api/payroll/run/route.ts
git commit -m "feat: Friday 16:00 cutoff — OT after 4pm rolls into next week"
```

---

## Task 4: Saturday Cash Payroll

**Files:**
- Create: `src/app/api/payroll/saturday/route.ts`
- Modify: `src/lib/payroll-engine.ts`
- Create: `src/app/(dashboard)/payroll/saturday/page.tsx`

- [ ] **Step 1: Add Saturday calculation to payroll engine**

Add to `src/lib/payroll-engine.ts`:

```typescript
export interface SaturdayPayrollInput {
  employee: Employee;
  timeIn: string;   // e.g. "08:00"
  timeOut: string;  // e.g. "14:00" or "16:00"
}

export function calculateSaturdayPayroll(input: SaturdayPayrollInput): PayrollResult {
  const { employee, timeIn, timeOut } = input;
  const weeklyHours = employee.weekly_hours || 40;
  const hourlyRate = round2(employee.weekly_wage / weeklyHours);

  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);

  // Saturday: 08:00-14:00 = 6 hours ordinary (no break deduction — short day)
  const twoPm = 14 * 60;
  const outMinutes = outH * 60 + outM;

  let ordinaryMinutes = Math.min(totalMinutes, twoPm - (inH * 60 + inM));
  ordinaryMinutes = Math.max(0, ordinaryMinutes);
  const ordinaryHours = round2(ordinaryMinutes / 60);

  let otMinutes = 0;
  if (outMinutes > twoPm) {
    otMinutes = outMinutes - twoPm;
  }
  const otHours = round2(otMinutes / 60);
  const otAmount = round2(otHours * hourlyRate * 1.5);

  const grossBasic = round2(hourlyRate * ordinaryHours);
  const gross = round2(grossBasic + otAmount);

  // Saturday cash — no UIF, no PAYE, no loan deductions, no garnishee
  // These are handled on the weekly payroll
  const net = gross;

  return {
    employee_id: employee.id,
    pt_code: employee.pt_code,
    full_name: employee.full_name,
    weekly_wage: employee.weekly_wage,
    hourly_rate: hourlyRate,
    ordinary_hours: ordinaryHours,
    ot_hours: otHours,
    ot_amount: otAmount,
    late_minutes: 0,
    late_deduction: 0,
    gross,
    uif_employee: 0,
    uif_employer: 0,
    paye: 0,
    loan_deduction: 0,
    garnishee: 0,
    petty_shortfall: 0,
    net,
    friday_ot_rollover: [],
    breakdown: {
      daily_attendance: [{
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        hours_worked: ordinaryHours + otHours,
        late_minutes: 0,
      }],
      ot_entries: otHours > 0 ? [{
        date: new Date().toISOString().split('T')[0],
        hours: otHours,
        multiplier: 1.5,
        amount: otAmount,
      }] : [],
      loan_entries: [],
    },
  };
}
```

- [ ] **Step 2: Create Saturday payroll API route**

Create `src/app/api/payroll/saturday/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculateSaturdayPayroll } from '@/lib/payroll-engine';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const { date, employees } = await req.json();
  // employees: Array<{ employee_id: string, time_in: string, time_out: string }>

  if (!date || !employees?.length) {
    return NextResponse.json({ error: 'date and employees required' }, { status: 400 });
  }

  // Fetch employee records
  const employeeIds = employees.map((e: any) => e.employee_id);
  const { data: employeeRecords, error: empErr } = await supabase
    .from('employees')
    .select('*')
    .in('id', employeeIds);

  if (empErr || !employeeRecords) {
    return NextResponse.json({ error: 'Failed to fetch employees' }, { status: 500 });
  }

  const empMap = new Map(employeeRecords.map(e => [e.id, e]));

  // Calculate payroll for each Saturday worker
  const results = [];
  for (const entry of employees) {
    const employee = empMap.get(entry.employee_id);
    if (!employee) continue;

    const result = calculateSaturdayPayroll({
      employee,
      timeIn: entry.time_in || '08:00',
      timeOut: entry.time_out || '14:00',
    });
    results.push(result);
  }

  // Create Saturday payroll run
  const { data: run, error: runErr } = await supabase
    .from('payroll_runs')
    .insert({
      week_start: date,
      week_end: date,
      status: 'generated',
      payroll_type: 'saturday_cash',
      total_gross: results.reduce((s, r) => s + r.gross, 0),
      total_net: results.reduce((s, r) => s + r.net, 0),
      run_by: null, // will be set from auth context
      run_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (runErr || !run) {
    return NextResponse.json({ error: 'Failed to create Saturday run' }, { status: 500 });
  }

  // Create payslips
  const payslips = results.map(r => ({
    payroll_run_id: run.id,
    employee_id: r.employee_id,
    ordinary_hours: r.ordinary_hours,
    ot_hours: r.ot_hours,
    ot_amount: r.ot_amount,
    gross: r.gross,
    late_deduction: 0,
    uif_employee: 0,
    paye: 0,
    loan_deduction: 0,
    garnishee: 0,
    petty_shortfall: 0,
    net: r.net,
    pdf_url: null,
  }));

  const { error: slipErr } = await supabase
    .from('payslips')
    .insert(payslips);

  if (slipErr) {
    return NextResponse.json({ error: 'Failed to create Saturday payslips' }, { status: 500 });
  }

  return NextResponse.json({ success: true, runId: run.id, results });
}
```

- [ ] **Step 3: Create Saturday payroll capture page**

Create `src/app/(dashboard)/payroll/saturday/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { hasPermission } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { SlidePanel } from '@/components/ui/slide-panel'
import { haptic } from '@/lib/haptics'
import { Check, X, Clock, Printer } from 'lucide-react'
import { format } from 'date-fns'

interface SaturdayWorker {
  employee_id: string
  full_name: string
  pt_code: string
  hourly_rate: number
  selected: boolean
  time_in: string
  time_out: string
}

export default function SaturdayPayrollPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [date, setDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [workers, setWorkers] = useState<SaturdayWorker[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [runId, setRunId] = useState<string | null>(null)
  const [results, setResults] = useState<any[] | null>(null)

  useEffect(() => {
    async function loadEmployees() {
      setLoading(true)
      const { data } = await supabase
        .from('employees')
        .select('id, full_name, pt_code, weekly_wage, weekly_hours')
        .eq('status', 'active')
        .order('full_name')

      if (data) {
        setWorkers(data.map(e => ({
          employee_id: e.id,
          full_name: e.full_name,
          pt_code: e.pt_code,
          hourly_rate: e.weekly_wage / (e.weekly_hours || 40),
          selected: false,
          time_in: '08:00',
          time_out: '14:00',
        })))
      }
      setLoading(false)
    }
    loadEmployees()
  }, [])

  const selectedWorkers = workers.filter(w => w.selected)

  async function generateSaturdayPayroll() {
    if (selectedWorkers.length === 0) return
    setGenerating(true)
    haptic('strong')

    const res = await fetch('/api/payroll/saturday', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        date,
        employees: selectedWorkers.map(w => ({
          employee_id: w.employee_id,
          time_in: w.time_in,
          time_out: w.time_out,
        })),
      }),
    })

    const data = await res.json()
    if (data.success) {
      setRunId(data.runId)
      setResults(data.results)
      haptic('confirm')
    }
    setGenerating(false)
  }

  function toggleWorker(idx: number) {
    haptic('light')
    setWorkers(prev => prev.map((w, i) =>
      i === idx ? { ...w, selected: !w.selected } : w
    ))
  }

  function updateTime(idx: number, field: 'time_in' | 'time_out', value: string) {
    setWorkers(prev => prev.map((w, i) =>
      i === idx ? { ...w, [field]: value } : w
    ))
  }

  if (!user) return null

  // After generation — show results + sign/print actions
  if (results && runId) {
    return (
      <div className="space-y-6 animate-fade-in">
        <h1 className="text-2xl font-bold text-[var(--primary)]">
          Saturday Cash Payroll — {format(new Date(date), 'dd MMM yyyy')}
        </h1>
        <Card className="p-0 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-[var(--primary)] text-white">
              <tr>
                <th className="text-left p-3">Employee</th>
                <th className="text-right p-3">Hours</th>
                <th className="text-right p-3">OT</th>
                <th className="text-right p-3 font-bold">Cash Due</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r: any) => (
                <tr key={r.employee_id} className="border-t border-[var(--border)]">
                  <td className="p-3 font-medium">{r.full_name}</td>
                  <td className="text-right p-3">{r.ordinary_hours}h</td>
                  <td className="text-right p-3">{r.ot_hours > 0 ? `${r.ot_hours}h` : '—'}</td>
                  <td className="text-right p-3 font-bold">R{r.net.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 font-bold">
              <tr>
                <td className="p-3">Total</td>
                <td className="text-right p-3">{results.reduce((s: number, r: any) => s + r.ordinary_hours, 0)}h</td>
                <td className="text-right p-3">{results.reduce((s: number, r: any) => s + r.ot_hours, 0)}h</td>
                <td className="text-right p-3">R{results.reduce((s: number, r: any) => s + r.net, 0).toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>
        </Card>
        <div className="flex gap-3">
          <Button
            variant="primary"
            size="lg"
            icon={<Printer size={18} />}
            onClick={() => window.open(`/api/pdf/payslips-all?run=${runId}`, '_blank')}
          >
            Print Saturday Payslips
          </Button>
          <Button
            variant="secondary"
            size="lg"
            onClick={() => window.location.href = `/payroll/sign?run=${runId}`}
          >
            Go to Signing
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--primary)]">Saturday Cash Payroll</h1>
          <p className="text-sm text-[var(--muted)] mt-1">Select who worked and their hours</p>
        </div>
        <input
          type="date"
          value={date}
          onChange={e => setDate(e.target.value)}
          className="border border-[var(--border)] rounded-lg px-3 py-2 text-sm"
        />
      </div>

      <p className="text-sm text-[var(--muted)]">
        {selectedWorkers.length} employee{selectedWorkers.length !== 1 ? 's' : ''} selected
      </p>

      <div className="space-y-2">
        {workers.map((w, idx) => (
          <div
            key={w.employee_id}
            className={`flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer ${
              w.selected
                ? 'border-[var(--primary)] bg-blue-50'
                : 'border-[var(--border)] bg-white'
            }`}
            onClick={() => toggleWorker(idx)}
          >
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              w.selected ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-400'
            }`}>
              {w.selected ? <Check size={20} /> : <span className="text-sm font-bold">{w.pt_code}</span>}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">{w.full_name}</p>
              <p className="text-xs text-[var(--muted)]">R{w.hourly_rate.toFixed(2)}/hr</p>
            </div>
            {w.selected && (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <div className="flex items-center gap-1">
                  <Clock size={14} className="text-[var(--muted)]" />
                  <input
                    type="time"
                    value={w.time_in}
                    onChange={e => updateTime(idx, 'time_in', e.target.value)}
                    className="border border-[var(--border)] rounded px-2 py-1 text-sm w-24"
                  />
                  <span className="text-[var(--muted)]">→</span>
                  <input
                    type="time"
                    value={w.time_out}
                    onChange={e => updateTime(idx, 'time_out', e.target.value)}
                    className="border border-[var(--border)] rounded px-2 py-1 text-sm w-24"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {selectedWorkers.length > 0 && (
        <div className="sticky bottom-4">
          <Button
            variant="primary"
            size="lg"
            className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-lg py-4"
            onClick={generateSaturdayPayroll}
            disabled={generating}
          >
            {generating ? 'Generating...' : `Run Saturday Payroll (${selectedWorkers.length} workers)`}
          </Button>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/payroll-engine.ts src/app/api/payroll/saturday/route.ts src/app/(dashboard)/payroll/saturday/page.tsx
git commit -m "feat: Saturday cash payroll — select workers, generate, print, sign"
```

---

## Task 5: Haptics Utility

**Files:**
- Create: `src/lib/haptics.ts`

- [ ] **Step 1: Create haptics utility**

Create `src/lib/haptics.ts`:

```typescript
// Haptic feedback utility — uses Navigator.vibrate() on supported devices
// Falls back silently on desktop/unsupported browsers

type HapticType = 'light' | 'confirm' | 'strong';

const PATTERNS: Record<HapticType, number | number[]> = {
  light: 10,
  confirm: 30,
  strong: 50,
};

export function haptic(type: HapticType): void {
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
    navigator.vibrate(PATTERNS[type]);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/haptics.ts
git commit -m "feat: haptic feedback utility — light, confirm, strong patterns"
```

---

## Task 6: Anomaly Detection

**Files:**
- Create: `src/lib/anomalies.ts`
- Create: `src/components/ui/anomaly-badge.tsx`

- [ ] **Step 1: Create anomaly detection logic**

Create `src/lib/anomalies.ts`:

```typescript
import { PayrollResult } from './payroll-engine'

export type AnomalySeverity = 'red' | 'amber';

export interface Anomaly {
  type: string;
  label: string;
  severity: AnomalySeverity;
  detail: string;
}

export function detectAnomalies(
  result: PayrollResult,
  previousWeekNet?: number
): Anomaly[] {
  const flags: Anomaly[] = [];

  // Late dock applied
  if (result.late_minutes > 0) {
    flags.push({
      type: 'late',
      label: 'Late',
      severity: 'amber',
      detail: `${result.late_minutes} min docked (R${result.late_deduction.toFixed(2)})`,
    });
  }

  // Missing time in or out
  for (const day of result.breakdown.daily_attendance) {
    if ((day.status === 'present' || day.status === 'late') && day.hours_worked === 0) {
      flags.push({
        type: 'missing_time',
        label: 'Missing time',
        severity: 'red',
        detail: `${day.date}: present but 0 hours recorded`,
      });
    }
  }

  // Zero hours on working day
  const workingDays = result.breakdown.daily_attendance.filter(
    d => d.status === 'present' || d.status === 'late'
  );
  if (workingDays.length > 0 && result.ordinary_hours === 0) {
    flags.push({
      type: 'zero_hours',
      label: 'Zero hours',
      severity: 'red',
      detail: 'Marked present but 0 ordinary hours calculated',
    });
  }

  // High OT (>10 hours)
  if (result.ot_hours > 10) {
    flags.push({
      type: 'high_ot',
      label: 'High OT',
      severity: 'amber',
      detail: `${result.ot_hours} OT hours this week`,
    });
  }

  // Deductions exceed 40% of gross
  const totalDeductions = result.uif_employee + result.paye + result.loan_deduction
    + result.garnishee + result.petty_shortfall + result.late_deduction;
  if (result.gross > 0 && totalDeductions / result.gross > 0.4) {
    flags.push({
      type: 'high_deductions',
      label: 'High deductions',
      severity: 'red',
      detail: `Deductions are ${Math.round((totalDeductions / result.gross) * 100)}% of gross`,
    });
  }

  // Week-on-week swing (>15%)
  if (previousWeekNet !== undefined && previousWeekNet > 0) {
    const diff = Math.abs(result.net - previousWeekNet);
    const pct = (diff / previousWeekNet) * 100;
    if (pct > 15) {
      flags.push({
        type: 'wow_swing',
        label: 'Pay swing',
        severity: 'amber',
        detail: `Net ${result.net > previousWeekNet ? 'up' : 'down'} ${Math.round(pct)}% vs last week`,
      });
    }
  }

  return flags;
}
```

- [ ] **Step 2: Create anomaly badge component**

Create `src/components/ui/anomaly-badge.tsx`:

```typescript
import { Anomaly } from '@/lib/anomalies'

interface AnomalyBadgeProps {
  anomalies: Anomaly[];
  compact?: boolean;
}

export function AnomalyBadge({ anomalies, compact = false }: AnomalyBadgeProps) {
  if (anomalies.length === 0) return null

  const hasRed = anomalies.some(a => a.severity === 'red')
  const color = hasRed ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'

  if (compact) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
        {anomalies.length}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {anomalies.map((a, i) => (
        <span
          key={i}
          title={a.detail}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
            a.severity === 'red'
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}
        >
          {a.label}
        </span>
      ))}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/anomalies.ts src/components/ui/anomaly-badge.tsx
git commit -m "feat: anomaly detection engine + badge component"
```

---

## Task 7: Global Payslip Viewer

**Files:**
- Create: `src/components/ui/payslip-viewer.tsx`

- [ ] **Step 1: Create payslip viewer slide panel**

Create `src/components/ui/payslip-viewer.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { SlidePanel } from './slide-panel'
import { AnomalyBadge } from './anomaly-badge'
import { createClient } from '@/lib/supabase/client'
import { detectAnomalies, Anomaly } from '@/lib/anomalies'
import { formatCurrency } from '@/lib/utils'
import { ChevronDown } from 'lucide-react'

interface PayslipViewerProps {
  employeeId: string | null;
  employeeName: string;
  onClose: () => void;
}

interface PayslipData {
  id: string;
  payroll_run_id: string;
  ordinary_hours: number;
  ot_hours: number;
  ot_amount: number;
  gross: number;
  late_deduction: number;
  uif_employee: number;
  paye: number;
  loan_deduction: number;
  garnishee: number;
  petty_shortfall: number;
  net: number;
  signed_at: string | null;
  payroll_runs: {
    week_start: string;
    week_end: string;
    payroll_type: string;
  };
}

interface EmployeeInfo {
  weekly_wage: number;
  weekly_hours: number;
  hourly_rate: number;
}

export function PayslipViewer({ employeeId, employeeName, onClose }: PayslipViewerProps) {
  const supabase = createClient()
  const [payslips, setPayslips] = useState<PayslipData[]>([])
  const [selectedIdx, setSelectedIdx] = useState(0)
  const [empInfo, setEmpInfo] = useState<EmployeeInfo | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!employeeId) return
    setLoading(true)

    async function load() {
      const [{ data: slips }, { data: emp }] = await Promise.all([
        supabase
          .from('payslips')
          .select('*, payroll_runs(week_start, week_end, payroll_type)')
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('employees')
          .select('weekly_wage, weekly_hours')
          .eq('id', employeeId)
          .single(),
      ])

      if (slips) setPayslips(slips as any)
      if (emp) {
        setEmpInfo({
          weekly_wage: emp.weekly_wage,
          weekly_hours: emp.weekly_hours || 40,
          hourly_rate: emp.weekly_wage / (emp.weekly_hours || 40),
        })
      }
      setSelectedIdx(0)
      setLoading(false)
    }
    load()
  }, [employeeId])

  const slip = payslips[selectedIdx]
  const prevSlip = payslips[selectedIdx + 1]

  // Build anomaly-compatible result for detection
  const anomalies: Anomaly[] = slip ? detectAnomalies({
    employee_id: employeeId!,
    pt_code: '',
    full_name: employeeName,
    weekly_wage: empInfo?.weekly_wage || 0,
    hourly_rate: empInfo?.hourly_rate || 0,
    ordinary_hours: slip.ordinary_hours,
    ot_hours: slip.ot_hours,
    ot_amount: slip.ot_amount,
    late_minutes: 0,
    late_deduction: slip.late_deduction,
    gross: slip.gross,
    uif_employee: slip.uif_employee,
    uif_employer: 0,
    paye: slip.paye,
    loan_deduction: slip.loan_deduction,
    garnishee: slip.garnishee,
    petty_shortfall: slip.petty_shortfall,
    net: slip.net,
    friday_ot_rollover: [],
    breakdown: { daily_attendance: [], ot_entries: [], loan_entries: [] },
  }, prevSlip?.net) : []

  return (
    <SlidePanel
      open={!!employeeId}
      onClose={onClose}
      title={employeeName}
      width="max-w-lg"
    >
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-[var(--primary)] border-t-transparent" />
        </div>
      ) : !slip ? (
        <p className="text-[var(--muted)] text-center py-12">No payslips found</p>
      ) : (
        <div className="space-y-4">
          {/* Week selector */}
          <div className="relative">
            <select
              value={selectedIdx}
              onChange={e => setSelectedIdx(Number(e.target.value))}
              className="w-full appearance-none border border-[var(--border)] rounded-lg px-3 py-2 pr-8 text-sm font-medium bg-white"
            >
              {payslips.map((s, i) => (
                <option key={s.id} value={i}>
                  {s.payroll_runs.payroll_type === 'saturday_cash' ? '☀ Sat ' : ''}
                  {s.payroll_runs.week_start} → {s.payroll_runs.week_end}
                </option>
              ))}
            </select>
            <ChevronDown size={16} className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--muted)] pointer-events-none" />
          </div>

          {/* Anomaly flags */}
          {anomalies.length > 0 && <AnomalyBadge anomalies={anomalies} />}

          {/* Type badge */}
          {slip.payroll_runs.payroll_type === 'saturday_cash' && (
            <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700">
              Saturday Cash
            </span>
          )}

          {/* Earnings */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Earnings</h3>
            <Row label={`Ordinary (${slip.ordinary_hours}h × R${empInfo?.hourly_rate.toFixed(2)})`}
                 value={slip.ordinary_hours * (empInfo?.hourly_rate || 0)} />
            {slip.ot_hours > 0 && (
              <Row label={`Overtime (${slip.ot_hours}h × 1.5)`} value={slip.ot_amount} />
            )}
            {slip.late_deduction > 0 && (
              <Row label="Late deduction" value={-slip.late_deduction} negative />
            )}
            <div className="border-t border-[var(--border)] pt-2">
              <Row label="Gross" value={slip.gross} bold />
            </div>
          </div>

          {/* Deductions */}
          <div className="bg-gray-50 rounded-xl p-4 space-y-2">
            <h3 className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide">Deductions</h3>
            <Row label="UIF" value={-slip.uif_employee} negative />
            {slip.paye > 0 && <Row label="PAYE" value={-slip.paye} negative />}
            {slip.loan_deduction > 0 && <Row label="Loan" value={-slip.loan_deduction} negative />}
            {slip.garnishee > 0 && <Row label="Garnishee" value={-slip.garnishee} negative />}
            {slip.petty_shortfall > 0 && <Row label="Petty shortfall" value={-slip.petty_shortfall} negative />}
          </div>

          {/* Net */}
          <div className="bg-[var(--primary)] text-white rounded-xl p-4 flex items-center justify-between">
            <span className="font-semibold">Net Pay</span>
            <span className="text-2xl font-bold">{formatCurrency(slip.net)}</span>
          </div>

          {/* Signed status */}
          <p className="text-xs text-center text-[var(--muted)]">
            {slip.signed_at
              ? `Signed ${new Date(slip.signed_at).toLocaleDateString()}`
              : 'Not yet signed'}
          </p>
        </div>
      )}
    </SlidePanel>
  )
}

function Row({ label, value, bold, negative }: {
  label: string; value: number; bold?: boolean; negative?: boolean
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={negative ? 'text-red-600' : ''}>{label}</span>
      <span className={negative ? 'text-red-600' : ''}>
        {negative && value < 0 ? '-' : ''}R{Math.abs(value).toFixed(2)}
      </span>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/payslip-viewer.tsx
git commit -m "feat: global payslip viewer — tap any employee name, see full breakdown"
```

---

## Task 8: Payroll Review & Approval Page

**Files:**
- Create: `src/app/api/payroll/batch/route.ts`
- Create: `src/app/(dashboard)/payroll/review/page.tsx`
- Modify: `src/app/api/payroll/run/route.ts`

- [ ] **Step 1: Create batch management API**

Create `src/app/api/payroll/batch/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

// GET: fetch batch for a payroll run
export async function GET(req: NextRequest) {
  const supabase = createServiceClient();
  const runId = req.nextUrl.searchParams.get('run_id');

  if (!runId) {
    return NextResponse.json({ error: 'run_id required' }, { status: 400 });
  }

  const { data, error } = await supabase
    .from('payroll_batch')
    .select('*, employees(full_name, pt_code)')
    .eq('payroll_run_id', runId);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

// POST: create batch (all employees default approved)
export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const { run_id, employee_ids } = await req.json();

  const records = employee_ids.map((eid: string) => ({
    payroll_run_id: run_id,
    employee_id: eid,
    status: 'approved',
  }));

  const { error } = await supabase
    .from('payroll_batch')
    .upsert(records, { onConflict: 'payroll_run_id,employee_id' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

// PATCH: update individual employee status
export async function PATCH(req: NextRequest) {
  const supabase = createServiceClient();
  const { run_id, employee_id, status, pulled_reason } = await req.json();

  const { error } = await supabase
    .from('payroll_batch')
    .update({ status, pulled_reason: pulled_reason || null })
    .eq('payroll_run_id', run_id)
    .eq('employee_id', employee_id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
```

- [ ] **Step 2: Create payroll review page**

Create `src/app/(dashboard)/payroll/review/page.tsx`:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { hasPermission } from '@/lib/permissions'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { AnomalyBadge } from '@/components/ui/anomaly-badge'
import { PayslipViewer } from '@/components/ui/payslip-viewer'
import { detectAnomalies, Anomaly } from '@/lib/anomalies'
import { haptic } from '@/lib/haptics'
import { formatCurrency } from '@/lib/utils'
import { Check, X, AlertTriangle, Play, Eye } from 'lucide-react'
import { format, startOfWeek, endOfWeek } from 'date-fns'

interface ReviewEmployee {
  employee_id: string;
  full_name: string;
  pt_code: string;
  status: 'approved' | 'pulled' | 'pending';
  pulled_reason: string | null;
  anomalies: Anomaly[];
  ordinary_hours: number;
  ot_hours: number;
  gross: number;
  net: number;
}

export default function PayrollReviewPage() {
  const { user } = useAuth()
  const supabase = createClient()
  const [employees, setEmployees] = useState<ReviewEmployee[]>([])
  const [loading, setLoading] = useState(true)
  const [runId, setRunId] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [viewingEmployee, setViewingEmployee] = useState<{ id: string; name: string } | null>(null)

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')
  const weekEnd = format(endOfWeek(new Date(), { weekStartsOn: 1 }), 'yyyy-MM-dd')

  useEffect(() => {
    loadReview()
  }, [])

  async function loadReview() {
    setLoading(true)

    // Check for existing draft run this week
    const { data: runs } = await supabase
      .from('payroll_runs')
      .select('id, status')
      .eq('week_start', weekStart)
      .eq('payroll_type', 'weekly')
      .in('status', ['draft'])
      .limit(1)

    let currentRunId = runs?.[0]?.id

    if (!currentRunId) {
      // Calculate payroll to create draft
      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weekStart, weekEnd, draftOnly: true }),
      })
      const data = await res.json()
      currentRunId = data.runId

      // Create batch with all employees approved
      if (currentRunId && data.results) {
        await fetch('/api/payroll/batch', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            run_id: currentRunId,
            employee_ids: data.results.map((r: any) => r.employee_id),
          }),
        })
      }
    }

    setRunId(currentRunId)

    if (currentRunId) {
      // Load batch + payslip data
      const [batchRes, { data: payslips }, { data: prevPayslips }] = await Promise.all([
        fetch(`/api/payroll/batch?run_id=${currentRunId}`).then(r => r.json()),
        supabase
          .from('payslips')
          .select('*')
          .eq('payroll_run_id', currentRunId),
        // Previous week's payslips for week-on-week comparison
        supabase
          .from('payslips')
          .select('employee_id, net')
          .neq('payroll_run_id', currentRunId)
          .order('created_at', { ascending: false }),
      ])

      const prevNetMap = new Map<string, number>()
      if (prevPayslips) {
        for (const ps of prevPayslips) {
          if (!prevNetMap.has(ps.employee_id)) {
            prevNetMap.set(ps.employee_id, ps.net)
          }
        }
      }

      const slipMap = new Map(payslips?.map(s => [s.employee_id, s]) || [])

      const reviewList: ReviewEmployee[] = (batchRes || []).map((b: any) => {
        const slip = slipMap.get(b.employee_id)
        const anomalies = slip ? detectAnomalies({
          employee_id: b.employee_id,
          pt_code: b.employees?.pt_code || '',
          full_name: b.employees?.full_name || '',
          weekly_wage: 0,
          hourly_rate: 0,
          ordinary_hours: slip.ordinary_hours,
          ot_hours: slip.ot_hours,
          ot_amount: slip.ot_amount,
          late_minutes: 0,
          late_deduction: slip.late_deduction,
          gross: slip.gross,
          uif_employee: slip.uif_employee,
          uif_employer: 0,
          paye: slip.paye,
          loan_deduction: slip.loan_deduction,
          garnishee: slip.garnishee,
          petty_shortfall: slip.petty_shortfall,
          net: slip.net,
          friday_ot_rollover: [],
          breakdown: { daily_attendance: [], ot_entries: [], loan_entries: [] },
        }, prevNetMap.get(b.employee_id)) : []

        return {
          employee_id: b.employee_id,
          full_name: b.employees?.full_name || 'Unknown',
          pt_code: b.employees?.pt_code || '',
          status: b.status,
          pulled_reason: b.pulled_reason,
          anomalies,
          ordinary_hours: slip?.ordinary_hours || 0,
          ot_hours: slip?.ot_hours || 0,
          gross: slip?.gross || 0,
          net: slip?.net || 0,
        }
      })

      // Sort: flagged first, then alphabetical
      reviewList.sort((a, b) => {
        if (a.anomalies.length > 0 && b.anomalies.length === 0) return -1
        if (a.anomalies.length === 0 && b.anomalies.length > 0) return 1
        return a.full_name.localeCompare(b.full_name)
      })

      setEmployees(reviewList)
    }
    setLoading(false)
  }

  async function toggleEmployee(empId: string, currentStatus: string) {
    const newStatus = currentStatus === 'approved' ? 'pulled' : 'approved'
    haptic(newStatus === 'pulled' ? 'confirm' : 'light')

    // Optimistic update
    setEmployees(prev => prev.map(e =>
      e.employee_id === empId ? { ...e, status: newStatus as any } : e
    ))

    await fetch('/api/payroll/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: runId,
        employee_id: empId,
        status: newStatus,
      }),
    })
  }

  async function runFinalPayroll() {
    if (!runId) return
    setGenerating(true)
    haptic('strong')

    const approvedIds = employees
      .filter(e => e.status === 'approved')
      .map(e => e.employee_id)

    const res = await fetch('/api/payroll/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        weekStart,
        weekEnd,
        runId,
        approvedEmployeeIds: approvedIds,
        finalize: true,
      }),
    })

    const data = await res.json()
    if (data.success) {
      haptic('confirm')
      window.location.href = '/payroll/sign'
    }
    setGenerating(false)
  }

  if (!user || !hasPermission(user.role, 'run_payroll')) return null

  const approved = employees.filter(e => e.status === 'approved')
  const pulled = employees.filter(e => e.status === 'pulled')
  const flagged = employees.filter(e => e.anomalies.length > 0 && e.status === 'approved')

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--primary)]">Payroll Review</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Week of {weekStart} — {approved.length} approved, {flagged.length} flagged, {pulled.length} pulled
        </p>
      </div>

      {/* Summary strip */}
      <div className="flex gap-3">
        <div className="flex-1 bg-green-50 border border-green-200 rounded-xl p-3 text-center">
          <p className="text-2xl font-bold text-green-700">{approved.length}</p>
          <p className="text-xs text-green-600">Approved</p>
        </div>
        {flagged.length > 0 && (
          <div className="flex-1 bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-amber-700">{flagged.length}</p>
            <p className="text-xs text-amber-600">Flagged</p>
          </div>
        )}
        {pulled.length > 0 && (
          <div className="flex-1 bg-red-50 border border-red-200 rounded-xl p-3 text-center">
            <p className="text-2xl font-bold text-red-700">{pulled.length}</p>
            <p className="text-xs text-red-600">Pulled</p>
          </div>
        )}
      </div>

      {/* Employee list */}
      <div className="space-y-2">
        {employees.map(emp => (
          <div
            key={emp.employee_id}
            className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all ${
              emp.status === 'pulled'
                ? 'border-red-200 bg-red-50 opacity-60'
                : emp.anomalies.length > 0
                ? 'border-amber-200 bg-amber-50'
                : 'border-green-200 bg-white'
            }`}
          >
            {/* Approve/Pull toggle */}
            <button
              onClick={() => toggleEmployee(emp.employee_id, emp.status)}
              className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
                emp.status === 'approved'
                  ? 'bg-green-500 text-white'
                  : 'bg-red-100 text-red-500 border-2 border-red-300'
              }`}
            >
              {emp.status === 'approved' ? <Check size={20} /> : <X size={20} />}
            </button>

            {/* Employee info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setViewingEmployee({ id: emp.employee_id, name: emp.full_name })}
                  className="font-semibold text-[var(--primary)] hover:underline truncate text-left"
                >
                  {emp.full_name}
                </button>
                <span className="text-xs text-[var(--muted)]">{emp.pt_code}</span>
              </div>
              <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-0.5">
                <span>{emp.ordinary_hours}h</span>
                {emp.ot_hours > 0 && <span>+{emp.ot_hours}h OT</span>}
                <span className="font-semibold text-[var(--foreground)]">{formatCurrency(emp.net)}</span>
              </div>
              {emp.anomalies.length > 0 && (
                <div className="mt-1">
                  <AnomalyBadge anomalies={emp.anomalies} />
                </div>
              )}
            </div>

            {/* View payslip */}
            <button
              onClick={() => setViewingEmployee({ id: emp.employee_id, name: emp.full_name })}
              className="p-2 rounded-lg hover:bg-gray-100 text-[var(--muted)]"
            >
              <Eye size={18} />
            </button>
          </div>
        ))}
      </div>

      {/* Run Final Payroll */}
      <div className="sticky bottom-4">
        <Button
          variant="primary"
          size="lg"
          className="w-full bg-[var(--accent)] hover:bg-[var(--accent-hover)] text-white font-bold text-lg py-4"
          onClick={runFinalPayroll}
          disabled={generating || approved.length === 0}
          icon={<Play size={20} />}
        >
          {generating ? 'Generating...' : `Run Final Payroll (${approved.length} employees)`}
        </Button>
      </div>

      {/* Payslip viewer */}
      <PayslipViewer
        employeeId={viewingEmployee?.id || null}
        employeeName={viewingEmployee?.name || ''}
        onClose={() => setViewingEmployee(null)}
      />
    </div>
  )
}
```

- [ ] **Step 3: Update payroll run API to support draft + finalize flow**

In `src/app/api/payroll/run/route.ts`, update the POST handler to accept `draftOnly` and `finalize` flags:

At the top of the handler, extract the new params:

```typescript
const { weekStart, weekEnd, draftOnly, finalize, runId, approvedEmployeeIds } = await req.json();
```

If `finalize` is true, update the existing run instead of creating a new one:
- Delete payslips for pulled employees (those not in `approvedEmployeeIds`)
- Update run status to `generated`
- Call generate-payslips logic

If `draftOnly` is true:
- Create the run with status `draft`
- Don't auto-approve or auto-generate

- [ ] **Step 4: Commit**

```bash
git add src/app/api/payroll/batch/route.ts src/app/(dashboard)/payroll/review/page.tsx src/app/api/payroll/run/route.ts
git commit -m "feat: payroll review page — per-employee approval gate, anomaly flags, Run Final Payroll"
```

---

## Task 9: Individual Payslip Recalculation

**Files:**
- Create: `src/app/api/payroll/recalculate/route.ts`

- [ ] **Step 1: Create recalculation endpoint**

Create `src/app/api/payroll/recalculate/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { calculatePayroll } from '@/lib/payroll-engine';
import { format } from 'date-fns';

export async function POST(req: NextRequest) {
  const supabase = createServiceClient();
  const { payslip_id } = await req.json();

  if (!payslip_id) {
    return NextResponse.json({ error: 'payslip_id required' }, { status: 400 });
  }

  // Fetch existing payslip + run info
  const { data: payslip } = await supabase
    .from('payslips')
    .select('*, payroll_runs(week_start, week_end)')
    .eq('id', payslip_id)
    .single();

  if (!payslip) {
    return NextResponse.json({ error: 'Payslip not found' }, { status: 404 });
  }

  const weekStart = payslip.payroll_runs.week_start;
  const weekEnd = payslip.payroll_runs.week_end;

  // Fetch fresh data for this employee
  const [{ data: employee }, { data: attendance }, { data: otRequests }, { data: loans }] = await Promise.all([
    supabase.from('employees').select('*').eq('id', payslip.employee_id).single(),
    supabase.from('attendance').select('*').eq('employee_id', payslip.employee_id)
      .gte('date', weekStart).lte('date', weekEnd),
    supabase.from('overtime_requests').select('*').eq('employee_id', payslip.employee_id)
      .gte('date', weekStart).lte('date', weekEnd).eq('status', 'approved'),
    supabase.from('loans').select('*').eq('employee_id', payslip.employee_id).eq('status', 'active'),
  ]);

  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }

  // Check petty cash shortfall
  const { data: pettyOuts } = await supabase
    .from('petty_cash_outs')
    .select('id, amount')
    .eq('recipient_employee_id', payslip.employee_id)
    .eq('status', 'issued')
    .gte('date', weekStart)
    .lte('date', weekEnd);

  let pettyShortfall = 0;
  if (pettyOuts) {
    for (const po of pettyOuts) {
      const { data: slips } = await supabase
        .from('petty_cash_slips')
        .select('slip_amount')
        .eq('petty_cash_out_id', po.id);
      const returned = slips?.reduce((s, sl) => s + sl.slip_amount, 0) || 0;
      pettyShortfall += Math.max(0, po.amount - returned);
    }
  }

  // Check if last week of month
  const lastDay = new Date(weekEnd);
  const nextDay = new Date(lastDay);
  nextDay.setDate(nextDay.getDate() + 1);
  const isLastWeekOfMonth = lastDay.getMonth() !== nextDay.getMonth();

  // Recalculate
  const result = calculatePayroll({
    employee,
    attendance: attendance || [],
    overtimeRequests: otRequests || [],
    activeLoans: loans || [],
    pettyShortfall,
    isLastWeekOfMonth,
  });

  // Update payslip
  const { error: updateErr } = await supabase
    .from('payslips')
    .update({
      ordinary_hours: result.ordinary_hours,
      ot_hours: result.ot_hours,
      ot_amount: result.ot_amount,
      gross: result.gross,
      late_deduction: result.late_deduction,
      uif_employee: result.uif_employee,
      paye: result.paye,
      loan_deduction: result.loan_deduction,
      garnishee: result.garnishee,
      petty_shortfall: result.petty_shortfall,
      net: result.net,
    })
    .eq('id', payslip_id);

  if (updateErr) {
    return NextResponse.json({ error: 'Failed to update payslip' }, { status: 500 });
  }

  // Update run totals
  const { data: allSlips } = await supabase
    .from('payslips')
    .select('gross, net')
    .eq('payroll_run_id', payslip.payroll_run_id);

  if (allSlips) {
    await supabase
      .from('payroll_runs')
      .update({
        total_gross: allSlips.reduce((s, sl) => s + sl.gross, 0),
        total_net: allSlips.reduce((s, sl) => s + sl.net, 0),
      })
      .eq('id', payslip.payroll_run_id);
  }

  return NextResponse.json({ success: true, result });
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/payroll/recalculate/route.ts
git commit -m "feat: individual payslip recalculation — fix one without scrapping the run"
```

---

## Task 10: Realtime Hook

**Files:**
- Create: `src/lib/use-realtime.ts`

- [ ] **Step 1: Create Supabase Realtime hook**

Create `src/lib/use-realtime.ts`:

```typescript
'use client'

import { useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

type RealtimeCallback = (payload: any) => void;

// Subscribe to changes on a Supabase table
// Automatically cleans up on unmount
export function useRealtime(
  table: string,
  callback: RealtimeCallback,
  filter?: string // e.g. 'date=eq.2026-05-05'
) {
  useEffect(() => {
    const supabase = createClient()
    let channel = supabase
      .channel(`${table}-changes`)
      .on(
        'postgres_changes' as any,
        {
          event: '*',
          schema: 'public',
          table,
          ...(filter ? { filter } : {}),
        },
        (payload: any) => callback(payload)
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [table, filter])
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/use-realtime.ts
git commit -m "feat: Supabase Realtime hook for live counter updates"
```

---

## Task 11: Pulse Card Component

**Files:**
- Create: `src/components/ui/pulse-card.tsx`

- [ ] **Step 1: Create pulse card**

Create `src/components/ui/pulse-card.tsx`:

```typescript
import { ReactNode } from 'react'

interface PulseCardProps {
  children: ReactNode;
  pulse?: boolean;
  onClick?: () => void;
  className?: string;
}

export function PulseCard({ children, pulse, onClick, className = '' }: PulseCardProps) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full text-left rounded-xl border-2 p-4 transition-all ${
        pulse
          ? 'border-[var(--accent)] bg-amber-50 shadow-lg'
          : 'border-[var(--border)] bg-white hover:border-[var(--primary)] hover:shadow-md'
      } ${className}`}
    >
      {pulse && (
        <span className="absolute top-3 right-3 flex h-3 w-3">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--accent)] opacity-75" />
          <span className="relative inline-flex rounded-full h-3 w-3 bg-[var(--accent)]" />
        </span>
      )}
      {children}
    </button>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/pulse-card.tsx
git commit -m "feat: pulse card component — animated priority indicator"
```

---

## Task 12: Day-Aware Workflow Dashboard

**Files:**
- Modify: `src/app/(dashboard)/dashboard/page.tsx`
- Modify: `src/app/api/workflow/route.ts`

- [ ] **Step 1: Update workflow API to include review step + Saturday status**

In `src/app/api/workflow/route.ts`, update the response to include:

```typescript
// Add to the steps object:
review: {
  status: 'done' | 'active' | 'pending',
  approved: number,
  flagged: number,
  pulled: number,
  total: number,
},
saturday: {
  status: 'done' | 'not_applicable' | 'pending',
  runId?: string,
  workerCount?: number,
},
```

Query the `payroll_batch` table for review data. Query `payroll_runs` with `payroll_type = 'saturday_cash'` for Saturday status.

- [ ] **Step 2: Rewrite the dashboard page**

Replace `src/app/(dashboard)/dashboard/page.tsx` entirely:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/auth-context'
import { hasPermission } from '@/lib/permissions'
import { PulseCard } from '@/components/ui/pulse-card'
import { PayslipViewer } from '@/components/ui/payslip-viewer'
import { useRealtime } from '@/lib/use-realtime'
import { formatCurrency } from '@/lib/utils'
import {
  ClipboardCheck, Users, Calculator, PenTool,
  Printer, Banknote, AlertTriangle, Sun
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { format, startOfWeek, endOfWeek, getDay } from 'date-fns'

interface WorkflowState {
  register: { captured: number; total: number; status: 'done' | 'active' | 'pending' };
  review: { approved: number; flagged: number; total: number; status: 'done' | 'active' | 'pending' };
  payroll: { status: 'done' | 'active' | 'pending'; runId?: string };
  sign: { signed: number; total: number; status: 'done' | 'active' | 'pending' };
  print: { status: 'done' | 'active' | 'pending' };
  bank: { status: 'done' | 'active' | 'pending' };
  saturday: { status: 'done' | 'not_applicable' | 'pending'; workerCount?: number };
  alerts: number;
}

export default function DashboardPage() {
  const { user } = useAuth()
  const router = useRouter()
  const [wf, setWf] = useState<WorkflowState | null>(null)
  const supabase = createClient()

  const today = new Date()
  const dayOfWeek = getDay(today) // 0=Sun, 1=Mon, ..., 5=Fri, 6=Sat
  const isFriday = dayOfWeek === 5
  const isSaturday = dayOfWeek === 6
  const weekLabel = `${format(startOfWeek(today, { weekStartsOn: 1 }), 'dd MMM')} — ${format(endOfWeek(today, { weekStartsOn: 1 }), 'dd MMM yyyy')}`

  useEffect(() => {
    if (!user) return
    loadWorkflow()
  }, [user])

  // Live updates
  useRealtime('attendance', () => loadWorkflow(), `date=eq.${format(today, 'yyyy-MM-dd')}`)
  useRealtime('payslips', () => loadWorkflow())

  async function loadWorkflow() {
    const res = await fetch('/api/workflow')
    if (res.ok) {
      const data = await res.json()
      setWf(data)
    }
  }

  if (!user || !hasPermission(user.role, 'view_dashboard')) return null

  // Determine what pulses — first non-done step
  function getPulseStep(): string | null {
    if (!wf) return null
    if (wf.register.status !== 'done') return 'register'
    if (isFriday || isSaturday) {
      if (wf.review.status !== 'done') return 'review'
      if (wf.payroll.status !== 'done') return 'payroll'
      if (wf.sign.status !== 'done') return 'sign'
      if (wf.print.status !== 'done') return 'print'
      if (wf.bank.status !== 'done') return 'bank'
    }
    if (wf.saturday.status === 'pending') return 'saturday'
    if (wf.alerts > 0) return 'alerts'
    return null
  }

  const pulseStep = getPulseStep()

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-[var(--primary)]">
          Welcome back, {user.name?.split(' ')[0] || 'there'}
        </h1>
        <p className="text-sm text-[var(--muted)] mt-1">{weekLabel}</p>
      </div>

      {/* What's Next */}
      <div className="space-y-3">
        {/* Register */}
        {hasPermission(user.role, 'view_register') && wf && (
          <PulseCard
            pulse={pulseStep === 'register'}
            onClick={() => router.push('/register')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-blue-100 text-[var(--primary)] flex items-center justify-center">
                <ClipboardCheck size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Register</p>
                <p className="text-sm text-[var(--muted)]">
                  {wf.register.status === 'done'
                    ? `${wf.register.captured}/${wf.register.total} captured ✓`
                    : `${wf.register.captured}/${wf.register.total} captured`
                  }
                </p>
              </div>
              {wf.register.status === 'done' && (
                <span className="text-green-500 font-bold text-sm">Done</span>
              )}
            </div>
          </PulseCard>
        )}

        {/* Payroll Review (Friday) */}
        {hasPermission(user.role, 'run_payroll') && wf && (isFriday || wf.review.status !== 'pending') && (
          <PulseCard
            pulse={pulseStep === 'review'}
            onClick={() => router.push('/payroll/review')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center">
                <Users size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Payroll Review</p>
                <p className="text-sm text-[var(--muted)]">
                  {wf.review.approved} approved
                  {wf.review.flagged > 0 && `, ${wf.review.flagged} flagged`}
                </p>
              </div>
            </div>
          </PulseCard>
        )}

        {/* Run Final Payroll */}
        {hasPermission(user.role, 'run_payroll') && wf && wf.review.status === 'done' && wf.payroll.status !== 'done' && (
          <PulseCard
            pulse={pulseStep === 'payroll'}
            onClick={() => router.push('/payroll/review')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[var(--accent)]/20 text-[var(--accent)] flex items-center justify-center">
                <Calculator size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Run Final Payroll</p>
                <p className="text-sm text-[var(--muted)]">Review complete — ready to generate</p>
              </div>
            </div>
          </PulseCard>
        )}

        {/* Sign */}
        {hasPermission(user.role, 'sign_payslips') && wf && wf.sign.total > 0 && (
          <PulseCard
            pulse={pulseStep === 'sign'}
            onClick={() => router.push('/payroll/sign')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center">
                <PenTool size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Sign Payslips</p>
                <p className="text-sm text-[var(--muted)]">
                  {wf.sign.signed}/{wf.sign.total} signed
                </p>
              </div>
            </div>
          </PulseCard>
        )}

        {/* Saturday */}
        {hasPermission(user.role, 'view_payroll') && wf && (isFriday || isSaturday) && wf.saturday.status === 'pending' && (
          <PulseCard
            pulse={pulseStep === 'saturday'}
            onClick={() => router.push('/payroll/saturday')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center">
                <Sun size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Saturday Cash Payroll</p>
                <p className="text-sm text-[var(--muted)]">Not yet captured</p>
              </div>
            </div>
          </PulseCard>
        )}

        {/* Alerts */}
        {wf && wf.alerts > 0 && (
          <PulseCard
            pulse={pulseStep === 'alerts'}
            onClick={() => router.push('/alerts')}
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-red-100 text-red-600 flex items-center justify-center">
                <AlertTriangle size={20} />
              </div>
              <div className="flex-1">
                <p className="font-semibold">Alerts</p>
                <p className="text-sm text-[var(--muted)]">{wf.alerts} unresolved</p>
              </div>
            </div>
          </PulseCard>
        )}
      </div>

      {/* Weekly stepper - compact across bottom */}
      {hasPermission(user.role, 'view_payroll') && wf && (
        <div className="mt-6 pt-6 border-t border-[var(--border)]">
          <p className="text-xs font-semibold text-[var(--muted)] uppercase tracking-wide mb-3">This Week</p>
          <div className="flex items-center gap-1">
            {[
              { label: 'Reg', done: wf.register.status === 'done' },
              { label: 'Review', done: wf.review.status === 'done' },
              { label: 'Payroll', done: wf.payroll.status === 'done' },
              { label: 'Sign', done: wf.sign.status === 'done' },
              { label: 'Print', done: wf.print.status === 'done' },
              { label: 'Bank', done: wf.bank.status === 'done' },
            ].map((step, i, arr) => (
              <div key={step.label} className="flex items-center gap-1 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                  step.done
                    ? 'bg-green-500 text-white'
                    : 'bg-gray-200 text-gray-400'
                }`}>
                  {step.done ? '✓' : i + 1}
                </div>
                <span className="text-xs text-[var(--muted)] hidden sm:inline">{step.label}</span>
                {i < arr.length - 1 && (
                  <div className={`flex-1 h-0.5 ${step.done ? 'bg-green-500' : 'bg-gray-200'}`} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/dashboard/page.tsx src/app/api/workflow/route.ts
git commit -m "feat: day-aware dashboard — pulsing what's next, live counters, weekly stepper"
```

---

## Task 13: Register Full-Week Grid View

**Files:**
- Modify: `src/app/(dashboard)/register/page.tsx`

- [ ] **Step 1: Add week grid view to register page**

This is a significant rework of the register page. Add a `viewMode` state toggle: `'daily' | 'weekly'`. The daily view stays as-is (needed for data entry). The weekly view shows a grid:

**Grid layout:**
- Rows = employees (sorted alphabetically)
- Columns = Mon, Tue, Wed, Thu, Fri
- Each cell shows: status icon (✓ present, L late, A absent, etc.) + hours
- Colour coded: green=present, amber=late, red=absent, blue=leave/sick, grey=PH
- Tap any cell to jump to that day's daily view for editing

Add at the top of the register page, below the header:

```typescript
const [viewMode, setViewMode] = useState<'daily' | 'weekly'>('weekly')
```

Add toggle buttons:

```typescript
<div className="flex gap-2">
  <button
    onClick={() => setViewMode('weekly')}
    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
      viewMode === 'weekly' ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600'
    }`}
  >
    Week View
  </button>
  <button
    onClick={() => setViewMode('daily')}
    className={`px-3 py-1.5 rounded-lg text-sm font-medium ${
      viewMode === 'daily' ? 'bg-[var(--primary)] text-white' : 'bg-gray-100 text-gray-600'
    }`}
  >
    Day View
  </button>
</div>
```

For the weekly grid, fetch attendance for Mon-Fri of the selected week and render as a table. The existing daily capture UI shows when `viewMode === 'daily'`.

The weekly grid component:

```typescript
function WeekGrid({ weekStart, onSelectDay }: { weekStart: string; onSelectDay: (date: string) => void }) {
  const supabase = createClient()
  const [data, setData] = useState<Map<string, Map<string, any>>>(new Map()) // employee_id → date → attendance
  const [employees, setEmployees] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  const days = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(weekStart)
    d.setDate(d.getDate() + i)
    return format(d, 'yyyy-MM-dd')
  })
  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']

  useEffect(() => {
    async function load() {
      setLoading(true)
      const weekEnd = days[4]

      const [{ data: emps }, { data: att }] = await Promise.all([
        supabase.from('employees').select('id, full_name, pt_code').eq('status', 'active').order('full_name'),
        supabase.from('attendance').select('*').gte('date', weekStart).lte('date', weekEnd),
      ])

      setEmployees(emps || [])

      const map = new Map<string, Map<string, any>>()
      for (const a of att || []) {
        if (!map.has(a.employee_id)) map.set(a.employee_id, new Map())
        map.get(a.employee_id)!.set(a.date, a)
      }
      setData(map)
      setLoading(false)
    }
    load()
  }, [weekStart])

  if (loading) return <div className="animate-pulse text-center py-8 text-[var(--muted)]">Loading week...</div>

  const statusIcon: Record<string, string> = {
    present: '✓', late: 'L', absent: 'A', leave: 'LV', sick: 'S', ph: 'PH', short_time: 'ST',
  }
  const statusColor: Record<string, string> = {
    present: 'bg-green-100 text-green-700',
    late: 'bg-amber-100 text-amber-700',
    absent: 'bg-red-100 text-red-700',
    leave: 'bg-blue-100 text-blue-700',
    sick: 'bg-blue-100 text-blue-700',
    ph: 'bg-gray-100 text-gray-500',
    short_time: 'bg-gray-100 text-gray-500',
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--border)]">
            <th className="text-left p-2 font-semibold sticky left-0 bg-white z-10">Employee</th>
            {days.map((d, i) => (
              <th
                key={d}
                className="text-center p-2 font-semibold cursor-pointer hover:text-[var(--primary)]"
                onClick={() => onSelectDay(d)}
              >
                {dayLabels[i]}
                <br />
                <span className="text-xs font-normal text-[var(--muted)]">{format(new Date(d), 'dd')}</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {employees.map(emp => (
            <tr key={emp.id} className="border-b border-[var(--border)] hover:bg-gray-50">
              <td className="p-2 font-medium sticky left-0 bg-white z-10 truncate max-w-[150px]">
                <span className="text-xs text-[var(--muted)] mr-1">{emp.pt_code}</span>
                {emp.full_name}
              </td>
              {days.map(d => {
                const att = data.get(emp.id)?.get(d)
                if (!att) {
                  return (
                    <td key={d} className="text-center p-2">
                      <button
                        onClick={() => onSelectDay(d)}
                        className="w-10 h-10 rounded-lg bg-gray-50 border border-dashed border-gray-300 text-gray-300 text-xs flex items-center justify-center mx-auto hover:border-[var(--primary)] hover:text-[var(--primary)]"
                      >
                        —
                      </button>
                    </td>
                  )
                }
                return (
                  <td key={d} className="text-center p-2">
                    <button
                      onClick={() => onSelectDay(d)}
                      className={`w-10 h-10 rounded-lg text-xs font-bold flex items-center justify-center mx-auto ${statusColor[att.status] || 'bg-gray-100'}`}
                    >
                      {statusIcon[att.status] || '?'}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
```

- [ ] **Step 2: Wire the grid into the register page**

In the return block of the register page, conditionally render:

```typescript
{viewMode === 'weekly' ? (
  <WeekGrid
    weekStart={format(startOfWeek(new Date(selectedDate), { weekStartsOn: 1 }), 'yyyy-MM-dd')}
    onSelectDay={(date) => {
      setSelectedDate(date)
      setViewMode('daily')
    }}
  />
) : (
  // Existing daily capture UI
  ...
)}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/(dashboard)/register/page.tsx
git commit -m "feat: register full-week grid view — see Mon-Fri at a glance, tap to edit"
```

---

## Task 14: Navigation & Permissions Update

**Files:**
- Modify: `src/lib/permissions.ts`
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Add new permissions**

In `src/lib/permissions.ts`, add:

```typescript
// Payroll review
review_payroll: ['owner', 'bookkeeper'],

// Saturday
capture_saturday: ['owner', 'supervisor', 'signer'],
```

Add nav items in `getNavItems`:

```typescript
{ label: 'Review', href: '/payroll/review', icon: 'clipboard-check', permission: 'review_payroll' },
{ label: 'Saturday Pay', href: '/payroll/saturday', icon: 'banknotes', permission: 'capture_saturday' },
```

- [ ] **Step 2: Update sidebar navigation in layout**

In `src/app/(dashboard)/layout.tsx`, add the new icons to `iconMap` if needed and ensure the nav renders the new items.

Add `Sun` to the imports and iconMap:

```typescript
import { ..., Sun } from 'lucide-react'

const iconMap: Record<string, ReactNode> = {
  // ... existing ...
  sun: <Sun className="h-5 w-5" />,
}
```

Update the Saturday nav item icon to `'sun'`.

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts src/app/(dashboard)/layout.tsx
git commit -m "feat: add review + saturday permissions and nav items"
```

---

## Task 15: Visual Refresh

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update globals.css**

Remove gradient-related utilities and update the design language:

Remove or simplify:
- `.gradient-sidebar` — replace with solid `var(--sidebar-bg)`
- `.gradient-header` — remove
- `.card-hover` — simplify to border change only, no lift

Update:
- `.animate-pulse-blue` — keep, used for "what's next"

Add utility for the gold accent button:

```css
.btn-gold {
  background-color: var(--accent);
  color: white;
  font-weight: 700;
  transition: background-color 150ms;
}
.btn-gold:hover {
  background-color: var(--accent-hover);
}
```

The key change: remove all decorative gradient backgrounds from cards. Keep functional colours (green=done, red=problem, amber=warning). The sidebar stays solid royal blue. Gold is used sparingly for primary CTAs.

- [ ] **Step 2: Commit**

```bash
git add src/app/globals.css
git commit -m "style: visual refresh — kill gradients, clean hierarchy, gold accent CTA"
```

---

## Task 16: Wire Payslip Viewer Into All Pages

**Files:**
- Modify: `src/app/(dashboard)/register/page.tsx`
- Modify: `src/app/(dashboard)/payroll/page.tsx`
- Modify: `src/app/(dashboard)/staff/page.tsx`

- [ ] **Step 1: Add PayslipViewer to each page**

For each page, add the same pattern:

1. Import `PayslipViewer`:
```typescript
import { PayslipViewer } from '@/components/ui/payslip-viewer'
```

2. Add state:
```typescript
const [viewingEmployee, setViewingEmployee] = useState<{ id: string; name: string } | null>(null)
```

3. Make employee names clickable:
```typescript
<button
  onClick={() => setViewingEmployee({ id: emp.id, name: emp.full_name })}
  className="font-semibold text-[var(--primary)] hover:underline text-left"
>
  {emp.full_name}
</button>
```

4. Add the viewer at the bottom of the return:
```typescript
<PayslipViewer
  employeeId={viewingEmployee?.id || null}
  employeeName={viewingEmployee?.name || ''}
  onClose={() => setViewingEmployee(null)}
/>
```

Apply this to: register page, payroll page, staff list page.

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/register/page.tsx src/app/(dashboard)/payroll/page.tsx src/app/(dashboard)/staff/page.tsx
git commit -m "feat: wire payslip viewer into register, payroll, and staff pages"
```

---

## Task 17: Update Payroll Sign to Support Saturday Runs

**Files:**
- Modify: `src/app/(dashboard)/payroll/sign/page.tsx`

- [ ] **Step 1: Update sign page to accept run parameter**

Update the sign page to:
1. Check URL params for `?run=<runId>` — if present, load that specific run instead of the most recent
2. Show a badge indicating if this is a Saturday Cash run
3. The rest of the signing flow stays identical

Add at the top:

```typescript
import { useSearchParams } from 'next/navigation'

// In the component:
const searchParams = useSearchParams()
const runParam = searchParams.get('run')
```

When fetching the run, use `runParam` if available:

```typescript
const query = runParam
  ? supabase.from('payroll_runs').select('*').eq('id', runParam).single()
  : supabase.from('payroll_runs').select('*').order('run_at', { ascending: false }).limit(1).single()
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/payroll/sign/page.tsx
git commit -m "feat: sign page supports Saturday cash runs via ?run= param"
```

---

## Task 18: Update Print Page for Saturday

**Files:**
- Modify: `src/app/(dashboard)/payroll/print/page.tsx`

- [ ] **Step 1: Filter print output by payroll type**

Add the same `useSearchParams` pattern as the sign page. When printing a Saturday run, only show Saturday workers. Add a visual indicator:

```typescript
{run.payroll_type === 'saturday_cash' && (
  <span className="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-700 mb-4">
    Saturday Cash Payroll
  </span>
)}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/(dashboard)/payroll/print/page.tsx
git commit -m "feat: print page supports Saturday cash runs"
```

---

## Task 19: Integration Testing

**Files:** None (manual testing)

- [ ] **Step 1: Test late-coming rules**

On the register page, test these arrival times and verify docked minutes:
- 08:05 → 0
- 08:10 → 30
- 08:20 → 60
- 09:30 → 90
- 10:00 → 120
- 12:00 → 240

- [ ] **Step 2: Test payroll review flow**

1. Capture register for a full week
2. Go to `/payroll/review`
3. Verify all employees show as approved (green)
4. Verify anomalies are flagged
5. Pull one employee out — verify they show as pulled
6. Put them back in — verify they return to approved
7. Hit "Run Final Payroll" — verify only approved employees are processed

- [ ] **Step 3: Test Saturday payroll**

1. Go to `/payroll/saturday`
2. Select 3-4 employees
3. Set times (some with OT past 14:00)
4. Generate — verify amounts
5. Go to signing — verify Saturday payslips appear
6. Sign one — verify it records

- [ ] **Step 4: Test payslip viewer**

1. From register page, tap an employee name — verify slide panel opens
2. From payroll page, tap a name — verify same panel
3. Switch weeks in the dropdown — verify data changes
4. Verify anomaly badges show correctly

- [ ] **Step 5: Test dashboard**

1. On a weekday, verify register is the pulsing item
2. After capturing all attendance, verify pulse moves to next step
3. Verify live counter updates (open in two tabs, capture in one, watch the other)

- [ ] **Step 6: Commit any fixes**

```bash
git add -p  # stage only relevant fixes
git commit -m "fix: integration testing fixes"
```

---

## Summary

| Task | What | New Files | Modified Files |
|---|---|---|---|
| 1 | Database migration | migration SQL, types | — |
| 2 | Late-coming rules | — | payroll-engine |
| 3 | Friday 16:00 cutoff | — | payroll-engine, payroll API |
| 4 | Saturday payroll | API route, page | payroll-engine |
| 5 | Haptics utility | haptics.ts | — |
| 6 | Anomaly detection | anomalies.ts, badge | — |
| 7 | Payslip viewer | payslip-viewer.tsx | — |
| 8 | Payroll review page | batch API, review page | payroll run API |
| 9 | Individual recalc | recalculate API | — |
| 10 | Realtime hook | use-realtime.ts | — |
| 11 | Pulse card | pulse-card.tsx | — |
| 12 | Dashboard rewrite | — | dashboard page, workflow API |
| 13 | Register week grid | — | register page |
| 14 | Nav + permissions | — | permissions, layout |
| 15 | Visual refresh | — | globals.css |
| 16 | Wire payslip viewer | — | register, payroll, staff |
| 17 | Sign supports Saturday | — | sign page |
| 18 | Print supports Saturday | — | print page |
| 19 | Integration testing | — | fixes as needed |
