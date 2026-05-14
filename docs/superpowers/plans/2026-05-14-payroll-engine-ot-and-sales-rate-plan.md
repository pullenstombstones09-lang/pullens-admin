# Payroll Engine OT + Sales Rate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken OT-via-approval-requests payroll path with attendance-derived OT, fix the sales staff hourly rate divisor (45 → 44), raise four sales staff wages to clear NMW, and persist Friday-after-16:00 rollover.

**Architecture:** Single-file pure-function rewrite of `payroll-engine.ts`; one new Supabase migration adding `friday_ot_rollovers` table and updating the NMW check constraint; minimal changes to the two payroll API routes to read/write rollovers. Vitest added as the unit-test runner (project has none today).

**Tech Stack:** TypeScript 5, Vitest 2.x, Supabase Postgres, Next.js 16 App Router.

**Spec:** `docs/superpowers/specs/2026-05-14-payroll-engine-ot-and-sales-rate-design.md` (commit `04a13d2`).

---

## File Structure

| File | New / Modify | Responsibility |
|---|---|---|
| `package.json` | Modify | Add `vitest`, `@vitest/coverage-v8` devDeps + `test` script |
| `vitest.config.ts` | Create | Vitest config (node environment, TS paths) |
| `supabase/migrations/00006_ot_engine_v2.sql` | Create | Schema-only migration: new `friday_ot_rollovers` table, replace `chk_nmw` constraint, set sales staff `weekly_hours = 44` |
| `supabase/migrations/00007_sales_wage_uplift.sql` | Create | Wage updates for PT012/PT023/PT024/PT032 to R1340. **Deploy AFTER 11-15 May payroll is finalised** (see Pre-Deployment Sequence below). |
| `src/types/database.ts` | Modify | Add `FridayOtRollover` interface |
| `src/lib/payroll-engine.ts` | Rewrite | New `calculatePayroll`, new helpers `normalEndMinutesForDay` and `dailyQuotaHoursFor`, NMW guard, return shape adds `next_week_friday_rollover_minutes` |
| `src/lib/payroll-engine.test.ts` | Create | 10 unit tests covering all rule branches |
| `src/app/api/payroll/run/route.ts` | Modify | Load prior week's unapplied rollovers → pass to engine → write new rollover rows → stamp consumed rollovers as applied |
| `src/app/api/payroll/recalculate/route.ts` | Modify | On run delete: delete rollovers produced by this run, reset rollovers consumed by this run |

---

## Pre-Deployment Sequence

The 11-15 May payroll is paid on Monday 18 May. The new engine and wages are effective for week 18-22 May (paid Monday 25 May). Two ordering rules:

1. **Migration 00006 (schema + weekly_hours)** is safe to deploy any time — it doesn't change wages, only the structural divisor. Existing 11-15 May payroll run is already finalised in the DB, so changing `weekly_hours` post-hoc on `employees` does NOT recompute that run's payslips.
2. **Migration 00007 (sales wage uplift to R1340)** MUST be deployed AFTER the 11-15 May payroll has been generated and paid. If deployed before, the 18 May payroll run (for week 11-15) would pay R1340 retroactively to Nicolette/Faith/Gugu/Zandile — which Annika has not approved.

**Deployment order:**
1. Tasks 1-7 of this plan deploy schema + new engine (safe pre-18 May).
2. Run 11-15 May payroll on Monday 18 May using the new engine. Sales staff still on old wages — pay normal for that week.
3. Apply migration 00007 sometime Mon 18 May → Sun 24 May.
4. Run 18-22 May payroll on Monday 25 May. New wages and new engine both active.

---

## Task 1: Add Vitest Test Runner

**Files:**
- Modify: `package.json`
- Create: `vitest.config.ts`

- [ ] **Step 1: Install vitest as a devDependency**

```bash
cd C:\Users\Annika\Projects\pullens-admin
npm install --save-dev vitest@^2.1.0
```

Expected: `package.json` `devDependencies` now includes `vitest`. No errors.

- [ ] **Step 2: Add the test script to `package.json`**

In the `"scripts"` object, add:

```json
"test": "vitest run",
"test:watch": "vitest"
```

Final `scripts` block should look like:

```json
"scripts": {
  "dev": "cross-env NODE_OPTIONS=--max-old-space-size=4096 next dev",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test": "vitest run",
  "test:watch": "vitest"
}
```

- [ ] **Step 3: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
```

- [ ] **Step 4: Verify the runner boots with a placeholder test**

Create `src/lib/__smoke__.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';

describe('smoke', () => {
  it('runs', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test`
Expected: `1 passed`, exit 0.

- [ ] **Step 5: Delete the smoke file and commit**

```bash
del src\lib\__smoke__.test.ts
git add package.json package-lock.json vitest.config.ts
git commit -m "chore: add vitest for unit tests"
```

---

## Task 2: Migration 00006 — Schema + weekly_hours

**Files:**
- Create: `supabase/migrations/00006_ot_engine_v2.sql`

- [ ] **Step 1: Write the migration**

```sql
-- 00006_ot_engine_v2.sql
-- Pullens Admin: OT engine v2 schema changes
-- Date: 2026-05-14
-- Refs spec: docs/superpowers/specs/2026-05-14-payroll-engine-ot-and-sales-rate-design.md

BEGIN;

-- 1. Replace the NMW check constraint to use the employee's own weekly_hours
ALTER TABLE employees DROP CONSTRAINT IF EXISTS chk_nmw;
ALTER TABLE employees ADD CONSTRAINT chk_nmw
  CHECK (weekly_wage = 0 OR weekly_wage >= 30.23 * COALESCE(weekly_hours, 40));

-- 2. Update sales staff weekly_hours 45 -> 44
UPDATE employees
SET weekly_hours = 44
WHERE pt_code IN ('PT008', 'PT012', 'PT023', 'PT024', 'PT028', 'PT032')
  AND weekly_hours = 45;

-- 3. New table for Friday-after-16:00 rollover audit trail
CREATE TABLE friday_ot_rollovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  source_friday DATE NOT NULL,
  rollover_minutes INTEGER NOT NULL CHECK (rollover_minutes >= 0),
  applied_to_run_id UUID REFERENCES payroll_runs(id) ON DELETE SET NULL,
  applied_at TIMESTAMPTZ,
  produced_by_run_id UUID REFERENCES payroll_runs(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, source_friday)
);

CREATE INDEX idx_friday_rollover_unapplied
  ON friday_ot_rollovers (employee_id, source_friday)
  WHERE applied_to_run_id IS NULL;

COMMIT;
```

- [ ] **Step 2: Apply the migration to the Pullens Supabase**

Because the Supabase MCP is YeboPro-only (per project CLAUDE.md), apply via the SQL Editor in the Supabase dashboard, OR via this script:

```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8').split('\n').reduce((a,l)=>{const m=l.match(/^([^=#]+)=(.*)\$/);if(m)a[m[1].trim()]=m[2].trim().replace(/^['\"]|['\"]\$/g,'');return a;},{});
(async () => {
  const sql = fs.readFileSync('supabase/migrations/00006_ot_engine_v2.sql','utf8');
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/exec_sql', {
    method: 'POST',
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ sql })
  });
  console.log(r.status, await r.text());
})();
"
```

If `exec_sql` RPC does not exist, paste the file contents into Supabase SQL Editor manually. Expected: `BEGIN`, `ALTER`, `UPDATE 6`, `CREATE TABLE`, `CREATE INDEX`, `COMMIT`.

- [ ] **Step 3: Verify in DB**

```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8').split('\n').reduce((a,l)=>{const m=l.match(/^([^=#]+)=(.*)\$/);if(m)a[m[1].trim()]=m[2].trim().replace(/^['\"]|['\"]\$/g,'');return a;},{});
(async () => {
  const r1 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/employees?weekly_hours=eq.44&select=pt_code,weekly_hours', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  console.log('44h staff:', await r1.json());
  const r2 = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/friday_ot_rollovers?limit=1', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  console.log('rollover table status:', r2.status);
})();
"
```

Expected: 6 sales staff returned with `weekly_hours: 44`, and rollover table responds with status 200 and `[]`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/00006_ot_engine_v2.sql
git commit -m "feat(db): migration 00006 — friday_ot_rollovers table, sales staff weekly_hours 45 to 44, NMW check constraint per weekly_hours"
```

---

## Task 3: Add `FridayOtRollover` Type

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Add the interface after the existing `OvertimeRequest` interface**

Find the line `export interface OvertimeRequest {` and insert the new interface immediately after that interface's closing brace:

```typescript
export interface FridayOtRollover {
  id: string;
  employee_id: string;
  source_friday: string;          // ISO date
  rollover_minutes: number;
  applied_to_run_id: string | null;
  applied_at: string | null;
  produced_by_run_id: string | null;
  created_at: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/database.ts
git commit -m "types: add FridayOtRollover interface"
```

---

## Task 4: Engine Helpers — TDD

**Files:**
- Test: `src/lib/payroll-engine.test.ts`
- Modify: `src/lib/payroll-engine.ts`

These pure helpers gate the rewrite that follows.

- [ ] **Step 1: Write failing tests for `normalEndMinutesForDay`**

Create `src/lib/payroll-engine.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { normalEndMinutesForDay, dailyQuotaHoursFor } from './payroll-engine';

describe('normalEndMinutesForDay', () => {
  // 1=Mon ... 7=Sun (we use JS getDay: 0=Sun, 1=Mon, 5=Fri, 6=Sat)
  it('returns 17:00 (1020) for Monday through Thursday', () => {
    expect(normalEndMinutesForDay(1, 40)).toBe(17 * 60);
    expect(normalEndMinutesForDay(2, 40)).toBe(17 * 60);
    expect(normalEndMinutesForDay(3, 40)).toBe(17 * 60);
    expect(normalEndMinutesForDay(4, 40)).toBe(17 * 60);
  });

  it('returns 16:00 (960) for Friday', () => {
    expect(normalEndMinutesForDay(5, 40)).toBe(16 * 60);
    expect(normalEndMinutesForDay(5, 44)).toBe(16 * 60);
  });

  it('returns 13:00 (780) for Saturday for 44h sales staff', () => {
    expect(normalEndMinutesForDay(6, 44)).toBe(13 * 60);
  });

  it('returns null for Saturday for 40h factory staff (Sat handled by saturday_cash run)', () => {
    expect(normalEndMinutesForDay(6, 40)).toBeNull();
  });

  it('returns null for Sunday for any employee', () => {
    expect(normalEndMinutesForDay(0, 40)).toBeNull();
    expect(normalEndMinutesForDay(0, 44)).toBeNull();
  });
});

describe('dailyQuotaHoursFor', () => {
  it('Mon-Thu = 9h regardless of weekly hours', () => {
    expect(dailyQuotaHoursFor(1, 40)).toBe(9);
    expect(dailyQuotaHoursFor(4, 44)).toBe(9);
  });

  it('Fri = 8h regardless of weekly hours', () => {
    expect(dailyQuotaHoursFor(5, 40)).toBe(8);
    expect(dailyQuotaHoursFor(5, 44)).toBe(8);
  });

  it('Sat = 4h for 44h staff, 0 for 40h staff', () => {
    expect(dailyQuotaHoursFor(6, 44)).toBe(4);
    expect(dailyQuotaHoursFor(6, 40)).toBe(0);
  });

  it('Sunday = 0 always', () => {
    expect(dailyQuotaHoursFor(0, 40)).toBe(0);
    expect(dailyQuotaHoursFor(0, 44)).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests — confirm they fail with "not exported" or similar**

Run: `npm test`
Expected: import error or "function is not a function" — the helpers don't exist yet.

- [ ] **Step 3: Implement the helpers**

Open `src/lib/payroll-engine.ts`. Find the existing exports (just below the imports/interfaces, before `calculateLateMinutes`). Insert:

```typescript
/**
 * The "normal end of working day" in minutes-from-midnight.
 * Returns null for days an employee does not normally work
 * (Sundays for everyone; Saturdays for 40h factory staff).
 */
export function normalEndMinutesForDay(
  jsDayOfWeek: number,  // 0=Sun, 1=Mon, ..., 6=Sat
  weeklyHours: number   // 40 (factory) or 44 (sales)
): number | null {
  if (jsDayOfWeek >= 1 && jsDayOfWeek <= 4) return 17 * 60;  // Mon-Thu 17:00
  if (jsDayOfWeek === 5) return 16 * 60;                      // Fri 16:00
  if (jsDayOfWeek === 6 && weeklyHours === 44) return 13 * 60; // Sat 13:00 (sales only)
  return null;
}

/**
 * Credit hours for a leave/sick/PH day (counts toward weekly threshold).
 * Mon-Thu = 9h, Fri = 8h, Sat = 4h (sales only), Sun = 0.
 */
export function dailyQuotaHoursFor(
  jsDayOfWeek: number,
  weeklyHours: number
): number {
  if (jsDayOfWeek >= 1 && jsDayOfWeek <= 4) return 9;
  if (jsDayOfWeek === 5) return 8;
  if (jsDayOfWeek === 6 && weeklyHours === 44) return 4;
  return 0;
}
```

- [ ] **Step 4: Run tests — confirm pass**

Run: `npm test`
Expected: 9 passing.

- [ ] **Step 5: Commit**

```bash
git add src/lib/payroll-engine.ts src/lib/payroll-engine.test.ts
git commit -m "feat(payroll): add normalEndMinutesForDay + dailyQuotaHoursFor helpers"
```

---

## Task 5: Rewrite `calculatePayroll` — TDD

**Files:**
- Modify: `src/lib/payroll-engine.ts`
- Modify: `src/lib/payroll-engine.test.ts`

This is the core rewrite. Tests first.

- [ ] **Step 1: Write test fixtures (shared helpers at top of test file)**

Append to `src/lib/payroll-engine.test.ts`:

```typescript
import { calculatePayroll, type PayrollInput } from './payroll-engine';
import type { Employee, Attendance } from '@/types/database';

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    pt_code: 'PT001',
    legacy_code: null,
    full_name: 'Test Employee',
    id_number: null,
    dob: null,
    gender: null,
    race: null,
    disability: false,
    cell: null,
    email: null,
    home_address: null,
    occupation: null,
    start_date: null,
    weekly_wage: 1209.20,
    weekly_hours: 40,
    payment_method: 'eft',
    bank_name: null,
    bank_acc: null,
    bank_branch: null,
    bank_type: null,
    emergency_name: null,
    emergency_rel: null,
    emergency_phone: null,
    nok_name: null,
    nok_rel: null,
    nok_phone: null,
    tax_number: null,
    uif_ref: null,
    garnishee: 0,
    eif_on_file: false,
    eif_signed: false,
    eif_date: null,
    status: 'active',
    photo_url: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Employee;
}

function makeAttendance(
  date: string,
  timeIn: string | null,
  timeOut: string | null,
  status: Attendance['status'] = 'present',
  lateMinutes = 0,
): Attendance {
  return {
    id: 'att-' + date,
    employee_id: 'emp-1',
    date,
    status,
    time_in: timeIn,
    time_out: timeOut,
    late_minutes: lateMinutes,
    reason: null,
    captured_by: null,
    captured_at: '2026-01-01T00:00:00Z',
  };
}

// Standard 40h-staff full week (Mon-Fri all normal hours, no OT)
function normalWeek40h(): Attendance[] {
  return [
    makeAttendance('2026-05-18', '08:00', '17:00'), // Mon
    makeAttendance('2026-05-19', '08:00', '17:00'), // Tue
    makeAttendance('2026-05-20', '08:00', '17:00'), // Wed
    makeAttendance('2026-05-21', '08:00', '17:00'), // Thu
    makeAttendance('2026-05-22', '08:00', '16:00'), // Fri
  ];
}

function defaultInput(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    employee: makeEmployee(),
    attendance: normalWeek40h(),
    overtimeRequests: [],
    activeLoans: [],
    pettyShortfall: 0,
    isLastWeekOfMonth: false,
    prevWeekFridayRolloverMinutes: 0,
    ...overrides,
  };
}
```

- [ ] **Step 2: Test 1 — full normal week, no OT (40h staff)**

```typescript
describe('calculatePayroll — 40h staff', () => {
  it('full normal week pays exactly 40h ordinary, no OT', () => {
    const result = calculatePayroll(defaultInput());

    expect(result.ordinary_hours).toBe(40);
    expect(result.ot_hours).toBe(0);
    expect(result.ot_amount).toBe(0);
    expect(result.gross).toBeCloseTo(1209.20, 2);
    expect(result.next_week_friday_rollover_minutes).toBe(0);
  });
});
```

- [ ] **Step 3: Run — confirm fail (missing field or signature mismatch)**

Run: `npm test`
Expected: TypeScript or runtime error because `prevWeekFridayRolloverMinutes` isn't on the input type yet, and `next_week_friday_rollover_minutes` isn't on the result yet.

- [ ] **Step 4: Update the `PayrollInput` and `PayrollResult` types in `src/lib/payroll-engine.ts`**

Find `export interface PayrollInput`. Add the new field:

```typescript
export interface PayrollInput {
  employee: Employee;
  attendance: Attendance[];
  overtimeRequests: OvertimeRequest[];  // kept for backward compat, not used by engine
  activeLoans: Loan[];
  pettyShortfall: number;
  isLastWeekOfMonth: boolean;
  prevWeekFridayRolloverMinutes: number;  // NEW: rollover from prior week's Friday past 16:00
}
```

Find `export interface PayrollResult`. Add the new field at the end (after `friday_ot_rollover`):

```typescript
export interface PayrollResult {
  // ... existing fields ...
  friday_ot_rollover: { date: string; minutes: number; employee_id: string }[];
  next_week_friday_rollover_minutes: number;  // NEW: total minutes to carry forward
}
```

- [ ] **Step 5: Rewrite the `calculatePayroll` function body**

Replace the entire body of `calculatePayroll` (keep the signature) with:

```typescript
export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { employee, attendance, activeLoans, pettyShortfall, prevWeekFridayRolloverMinutes } = input;

  // 1. Threshold + hourly rate
  const threshold = employee.weekly_hours === 44 ? 44 : 40;
  const hourlyRate = employee.weekly_wage / threshold;

  // 2. NMW guard — fail loudly rather than pay below R30.23/hr
  if (employee.weekly_wage > 0 && hourlyRate < 30.23) {
    throw new Error(
      `NMW breach for ${employee.pt_code} ${employee.full_name}: ` +
      `R${hourlyRate.toFixed(2)}/hr (weekly_wage ${employee.weekly_wage} / ${threshold}h) < R30.23 NMW. ` +
      `Fix employee.weekly_wage before running payroll.`
    );
  }

  // 3. Walk attendance days
  let ordinaryClockMinutes = 0;
  let candidateOtMinutes = 0;
  let nextWeekRolloverMinutes = 0;
  const dailyBreakdown: PayrollBreakdown['daily_attendance'] = [];
  let totalLateMinutes = 0;

  for (const day of attendance) {
    const jsDay = new Date(day.date + 'T00:00:00').getDay(); // 0=Sun ... 6=Sat
    const normalEnd = normalEndMinutesForDay(jsDay, threshold);

    // Leave / sick / PH day → credit daily quota, no OT
    if (day.status === 'leave' || day.status === 'sick' || day.status === 'ph') {
      const credit = dailyQuotaHoursFor(jsDay, threshold);
      ordinaryClockMinutes += credit * 60;
      dailyBreakdown.push({ date: day.date, status: day.status, hours_worked: credit, late_minutes: 0 });
      continue;
    }

    // Absent / no clock data
    if (day.status === 'absent' || !day.time_in || !day.time_out) {
      dailyBreakdown.push({ date: day.date, status: day.status, hours_worked: 0, late_minutes: day.late_minutes });
      totalLateMinutes += day.late_minutes;
      continue;
    }

    // Days we don't pay through the weekly engine (Sun, and Sat for 40h staff)
    if (normalEnd === null) {
      dailyBreakdown.push({ date: day.date, status: day.status, hours_worked: 0, late_minutes: 0 });
      continue;
    }

    totalLateMinutes += day.late_minutes;

    const inMin = toMinutes(day.time_in);
    const outMin = toMinutes(day.time_out);

    if (jsDay === 5) {
      // Friday — clamp to 16:00, rest rolls over
      const ordinaryEnd = Math.min(outMin, normalEnd);
      const dayOrdinary = Math.max(0, ordinaryEnd - inMin);
      ordinaryClockMinutes += dayOrdinary;
      nextWeekRolloverMinutes += Math.max(0, outMin - normalEnd);
      dailyBreakdown.push({
        date: day.date, status: day.status,
        hours_worked: round2(dayOrdinary / 60), late_minutes: day.late_minutes,
      });
    } else {
      // Mon-Thu (or Sat for sales) — past normal end = candidate OT this week
      const ordinaryEnd = Math.min(outMin, normalEnd);
      const dayOrdinary = Math.max(0, ordinaryEnd - inMin);
      ordinaryClockMinutes += dayOrdinary;
      const dayOt = Math.max(0, outMin - normalEnd);
      candidateOtMinutes += dayOt;
      dailyBreakdown.push({
        date: day.date, status: day.status,
        hours_worked: round2((dayOrdinary + dayOt) / 60),
        late_minutes: day.late_minutes,
      });
    }
  }

  // 4. Add prior week's Friday rollover into this week's candidate OT
  candidateOtMinutes += prevWeekFridayRolloverMinutes;

  const ordinaryClockHours = round2(ordinaryClockMinutes / 60);
  const candidateOtHours = round2(candidateOtMinutes / 60);
  const weeklyWorked = round2(ordinaryClockHours + candidateOtHours);

  // 5. Apply threshold rule
  let ordinaryHoursPaid: number;
  let otHoursPaid: number;
  let otAmount: number;
  const otEntries: PayrollBreakdown['ot_entries'] = [];

  if (weeklyWorked >= threshold) {
    ordinaryHoursPaid = Math.min(ordinaryClockHours, threshold);
    otHoursPaid = candidateOtHours;
    otAmount = round2(otHoursPaid * hourlyRate * 1.5);
    if (otHoursPaid > 0) {
      otEntries.push({ date: 'derived', hours: otHoursPaid, multiplier: 1.5, amount: otAmount });
    }
  } else {
    ordinaryHoursPaid = weeklyWorked;
    otHoursPaid = 0;
    otAmount = 0;
  }

  // 6. Gross / UIF / PAYE
  const lateDeduction = round2((totalLateMinutes / 60) * hourlyRate);
  const grossBasic = round2(hourlyRate * ordinaryHoursPaid);
  const gross = round2(grossBasic + otAmount - lateDeduction);

  const uifBase = Math.min(gross, 4428);
  const uifEmployee = round2(uifBase * 0.01);
  const uifEmployer = round2(uifBase * 0.01);
  const paye = calculateWeeklyPAYE(gross);

  // 7. Loans
  let loanDeduction = 0;
  const loanEntries: PayrollBreakdown['loan_entries'] = [];
  for (const loan of activeLoans) {
    const deductAmount = Math.min(loan.weekly_deduction, loan.outstanding);
    if (deductAmount > 0) {
      loanDeduction += deductAmount;
      loanEntries.push({
        loan_id: loan.id, amount: deductAmount,
        purpose: loan.purpose, auto_from_petty: loan.auto_generated_from_petty,
      });
    }
  }
  loanDeduction = round2(loanDeduction);

  const garnishee = input.isLastWeekOfMonth ? employee.garnishee : 0;
  const net = round2(gross - uifEmployee - paye - loanDeduction - garnishee - pettyShortfall);

  return {
    employee_id: employee.id,
    pt_code: employee.pt_code,
    full_name: employee.full_name,
    weekly_wage: employee.weekly_wage,
    hourly_rate: round2(hourlyRate),
    ordinary_hours: round2(ordinaryHoursPaid),
    ot_hours: round2(otHoursPaid),
    ot_amount: round2(otAmount),
    late_minutes: totalLateMinutes,
    late_deduction: lateDeduction,
    gross,
    uif_employee: uifEmployee,
    uif_employer: uifEmployer,
    paye,
    loan_deduction: loanDeduction,
    garnishee,
    petty_shortfall: pettyShortfall,
    net,
    breakdown: { daily_attendance: dailyBreakdown, ot_entries: otEntries, loan_entries: loanEntries },
    friday_ot_rollover: nextWeekRolloverMinutes > 0
      ? [{ date: 'next-week', minutes: nextWeekRolloverMinutes, employee_id: employee.id }]
      : [],
    next_week_friday_rollover_minutes: nextWeekRolloverMinutes,
  };
}

// Helper — clock string "HH:MM" or "HH:MM:SS" to minutes-from-midnight
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
```

Remove the obsolete `splitFridayHours` function and `DEFAULT_DAILY_HOURS_40` / `DEFAULT_DAILY_HOURS_45` constants (they're replaced by the helpers above).

Keep: `calculateLateMinutes`, `calculateWeeklyPAYE`, `round2`, `calculateSaturdayPayroll`, `validateAgainstV12`.

- [ ] **Step 6: Run Test 1 — expect pass**

Run: `npm test`
Expected: smoke tests + helpers + test 1 all green.

- [ ] **Step 7: Test 2 — Mon-Thu past 17:00 produces OT (PT010 fixture)**

```typescript
it('Mon-Thu past 17:00 produces OT when weekly worked exceeds 40h', () => {
  const att = [
    makeAttendance('2026-05-18', '08:00', '18:50'), // Mon 1h50 past 17
    makeAttendance('2026-05-19', '08:00', '18:30'), // Tue 1h30 past 17
    makeAttendance('2026-05-20', '08:00', '17:00'), // Wed
    makeAttendance('2026-05-21', '08:00', '17:00'), // Thu
    makeAttendance('2026-05-22', '08:00', '16:00'), // Fri
  ];

  const result = calculatePayroll(defaultInput({ attendance: att }));

  expect(result.ordinary_hours).toBe(40);
  expect(result.ot_hours).toBeCloseTo(3.33, 2);     // 110+90 minutes = 200/60
  expect(result.ot_amount).toBeCloseTo(3.33 * (1209.20/40) * 1.5, 1);
  expect(result.next_week_friday_rollover_minutes).toBe(0);
});
```

- [ ] **Step 8: Test 3 — partial week, <40h with past-end day → no premium**

```typescript
it('partial week below 40h pays past-end hours at ordinary rate, no OT premium', () => {
  const att = [
    makeAttendance('2026-05-18', '08:00', '17:00'),     // 9h
    makeAttendance('2026-05-19', '08:00', '17:00'),     // 9h
    makeAttendance('2026-05-20', '08:00', '20:00'),     // 12h (3h past 17:00)
    makeAttendance('2026-05-21', null, null, 'absent'), // 0
    makeAttendance('2026-05-22', null, null, 'absent'), // 0
  ];

  const result = calculatePayroll(defaultInput({ attendance: att }));

  // 9+9+9 ordinary + 3 candidate OT = 30 ordinary + 3 past-end = 33h total worked. <40 → all ordinary.
  expect(result.ordinary_hours).toBe(33);
  expect(result.ot_hours).toBe(0);
  expect(result.ot_amount).toBe(0);
});
```

- [ ] **Step 9: Test 4 — Friday past 16:00 produces next-week rollover**

```typescript
it('Friday past 16:00 writes to next-week rollover, does not pay this week', () => {
  const att = [
    makeAttendance('2026-05-18', '08:00', '17:00'),
    makeAttendance('2026-05-19', '08:00', '17:00'),
    makeAttendance('2026-05-20', '08:00', '17:00'),
    makeAttendance('2026-05-21', '08:00', '17:00'),
    makeAttendance('2026-05-22', '08:00', '17:30'),   // Fri ran 1.5h past 16
  ];

  const result = calculatePayroll(defaultInput({ attendance: att }));

  expect(result.ordinary_hours).toBe(40);
  expect(result.ot_hours).toBe(0);
  expect(result.next_week_friday_rollover_minutes).toBe(90);
});
```

- [ ] **Step 10: Test 5 — prior week's rollover consumed this week**

```typescript
it('prior weeks rollover adds to this weeks candidate OT', () => {
  const result = calculatePayroll(defaultInput({
    prevWeekFridayRolloverMinutes: 90,  // 1.5h
  }));

  expect(result.ordinary_hours).toBe(40);
  expect(result.ot_hours).toBeCloseTo(1.5, 2);
  expect(result.next_week_friday_rollover_minutes).toBe(0);
});
```

- [ ] **Step 11: Test 6 — sales staff (44h) full normal week**

```typescript
describe('calculatePayroll — 44h sales staff', () => {
  it('full normal week pays 44h ordinary, no OT', () => {
    const emp = makeEmployee({ pt_code: 'PT012', weekly_hours: 44, weekly_wage: 1340 });
    const att = [
      makeAttendance('2026-05-18', '08:00', '17:00'),
      makeAttendance('2026-05-19', '08:00', '17:00'),
      makeAttendance('2026-05-20', '08:00', '17:00'),
      makeAttendance('2026-05-21', '08:00', '17:00'),
      makeAttendance('2026-05-22', '08:00', '16:00'),
      makeAttendance('2026-05-23', '09:00', '13:00'), // Sat
    ];

    const result = calculatePayroll(defaultInput({ employee: emp, attendance: att }));

    expect(result.ordinary_hours).toBe(44);
    expect(result.ot_hours).toBe(0);
    expect(result.gross).toBeCloseTo(1340, 2);
  });
});
```

- [ ] **Step 12: Test 7 — sales staff Saturday past 13:00**

```typescript
it('sales staff Saturday past 13:00 produces this-week OT', () => {
  const emp = makeEmployee({ pt_code: 'PT012', weekly_hours: 44, weekly_wage: 1340 });
  const att = [
    makeAttendance('2026-05-18', '08:00', '17:00'),
    makeAttendance('2026-05-19', '08:00', '17:00'),
    makeAttendance('2026-05-20', '08:00', '17:00'),
    makeAttendance('2026-05-21', '08:00', '17:00'),
    makeAttendance('2026-05-22', '08:00', '16:00'),
    makeAttendance('2026-05-23', '09:00', '14:00'),  // Sat 1h past 13:00
  ];

  const result = calculatePayroll(defaultInput({ employee: emp, attendance: att }));

  expect(result.ordinary_hours).toBe(44);
  expect(result.ot_hours).toBeCloseTo(1, 2);
});
```

- [ ] **Step 13: Test 8 — sick day counts toward weekly threshold**

```typescript
it('a sick day credits 9h ordinary and counts toward the threshold', () => {
  const att = [
    makeAttendance('2026-05-18', null, null, 'sick'), // Mon sick
    makeAttendance('2026-05-19', '08:00', '17:00'),
    makeAttendance('2026-05-20', '08:00', '17:00'),
    makeAttendance('2026-05-21', '08:00', '17:00'),
    makeAttendance('2026-05-22', '08:00', '16:00'),
  ];

  const result = calculatePayroll(defaultInput({ attendance: att }));

  expect(result.ordinary_hours).toBe(40);
  expect(result.ot_hours).toBe(0);
});
```

- [ ] **Step 14: Test 9 — late + OT same day**

```typescript
it('late deduction and same-day OT both apply', () => {
  const att = [
    makeAttendance('2026-05-18', '08:20', '18:30', 'late', 60), // 60min docked, 1.5h past 17
    makeAttendance('2026-05-19', '08:00', '17:00'),
    makeAttendance('2026-05-20', '08:00', '17:00'),
    makeAttendance('2026-05-21', '08:00', '17:00'),
    makeAttendance('2026-05-22', '08:00', '16:00'),
  ];

  const result = calculatePayroll(defaultInput({ attendance: att }));

  expect(result.late_minutes).toBe(60);
  expect(result.late_deduction).toBeCloseTo(1209.20 / 40, 2);
  expect(result.ot_hours).toBeCloseTo(1.5, 2);
});
```

- [ ] **Step 15: Test 10 — NMW guard throws**

```typescript
it('engine throws if employee wage divided by weekly_hours is below NMW', () => {
  const emp = makeEmployee({ weekly_wage: 1000, weekly_hours: 40 }); // R25/h
  expect(() => calculatePayroll(defaultInput({ employee: emp }))).toThrow(/NMW breach/);
});
```

- [ ] **Step 16: Run all tests — expect 9 helper + 10 engine = 19 passing**

Run: `npm test`
Expected: all green.

- [ ] **Step 17: Commit**

```bash
git add src/lib/payroll-engine.ts src/lib/payroll-engine.test.ts
git commit -m "feat(payroll): attendance-derived OT engine + NMW guard + Friday rollover"
```

---

## Task 6: Wire Rollover Into Run Route

**Files:**
- Modify: `src/app/api/payroll/run/route.ts`

- [ ] **Step 1: Read current state of `run/route.ts`**

Open the file. Locate the section where it loops over employees and calls `calculatePayroll` for each.

- [ ] **Step 2: Before the loop, fetch unapplied rollovers for the previous Friday**

Insert (before the per-employee loop):

```typescript
// Find previous Friday relative to this run's week_start (Monday)
const weekStartDate = new Date(weekStart + 'T00:00:00');
const prevFriday = new Date(weekStartDate);
prevFriday.setDate(weekStartDate.getDate() - 3);  // Mon -> previous Fri
const prevFridayISO = prevFriday.toISOString().split('T')[0];

const { data: rollovers } = await supabase
  .from('friday_ot_rollovers')
  .select('id, employee_id, rollover_minutes')
  .eq('source_friday', prevFridayISO)
  .is('applied_to_run_id', null);

const rolloverByEmp = new Map<string, { id: string; minutes: number }>();
for (const r of rollovers ?? []) {
  rolloverByEmp.set(r.employee_id, { id: r.id, minutes: r.rollover_minutes });
}
```

- [ ] **Step 3: When calling `calculatePayroll`, pass the rollover**

Find the existing call. Add `prevWeekFridayRolloverMinutes`:

```typescript
const result = calculatePayroll({
  employee,
  attendance: employeeAttendance,
  overtimeRequests: [],
  activeLoans: employeeLoans,
  pettyShortfall,
  isLastWeekOfMonth,
  prevWeekFridayRolloverMinutes: rolloverByEmp.get(employee.id)?.minutes ?? 0,
});
```

- [ ] **Step 4: After the run is inserted and we have `payrollRun.id`, write the new rollover rows and stamp consumed ones**

Insert (after `payrollRun` is created and payslips are inserted):

```typescript
// Stamp consumed rollovers as applied
const consumedIds = Array.from(rolloverByEmp.values()).map(r => r.id);
if (consumedIds.length > 0) {
  await supabase
    .from('friday_ot_rollovers')
    .update({ applied_to_run_id: payrollRun.id, applied_at: new Date().toISOString() })
    .in('id', consumedIds);
}

// Write new rollover rows (one per employee whose Friday went past 16:00)
const newRollovers = payslipResults
  .filter(r => r.next_week_friday_rollover_minutes > 0)
  .map(r => {
    // The Friday that produced the rollover is week_start + 4 days
    const friday = new Date(weekStartDate);
    friday.setDate(weekStartDate.getDate() + 4);
    return {
      employee_id: r.employee_id,
      source_friday: friday.toISOString().split('T')[0],
      rollover_minutes: r.next_week_friday_rollover_minutes,
      produced_by_run_id: payrollRun.id,
    };
  });
if (newRollovers.length > 0) {
  await supabase.from('friday_ot_rollovers').upsert(newRollovers, {
    onConflict: 'employee_id,source_friday',
  });
}
```

- [ ] **Step 5: Run the test suite (engine tests are still the source of truth)**

Run: `npm test`
Expected: still all green.

- [ ] **Step 6: Lint**

Run: `npm run lint`
Expected: clean (any pre-existing warnings are fine, no new errors).

- [ ] **Step 7: Commit**

```bash
git add src/app/api/payroll/run/route.ts
git commit -m "feat(payroll): persist friday rollover in run route"
```

---

## Task 7: Recalculate Route — Rollover Lifecycle

**Files:**
- Modify: `src/app/api/payroll/recalculate/route.ts`

When a run is recalculated, the old run is deleted. We must:
1. Delete rollovers produced by the run being deleted.
2. Reset rollovers that were consumed by the run being deleted (so they can flow into the new run).

- [ ] **Step 1: Read current state of `recalculate/route.ts`**

Open the file. Locate the section where the old `payroll_run` is deleted.

- [ ] **Step 2: Before deleting the old run, reset its consumed rollovers and delete its produced ones**

Insert (immediately before the `await supabase.from('payroll_runs').delete()...` call):

```typescript
// Reset rollovers this run consumed → they become unapplied again
await supabase
  .from('friday_ot_rollovers')
  .update({ applied_to_run_id: null, applied_at: null })
  .eq('applied_to_run_id', oldRunId);

// Delete rollovers this run produced (the recalc will produce fresh ones)
await supabase
  .from('friday_ot_rollovers')
  .delete()
  .eq('produced_by_run_id', oldRunId);
```

- [ ] **Step 3: Test**

Run: `npm test`
Expected: all green.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/payroll/recalculate/route.ts
git commit -m "feat(payroll): rollover lifecycle on recalculate"
```

---

## Task 8: Migration 00007 — Sales Wage Uplift

**Files:**
- Create: `supabase/migrations/00007_sales_wage_uplift.sql`

**DO NOT APPLY this migration until after the 11-15 May payroll run has been finalised** (see Pre-Deployment Sequence at top).

- [ ] **Step 1: Write the migration**

```sql
-- 00007_sales_wage_uplift.sql
-- Pullens Admin: NMW-compliant wage uplift for 44h sales staff
-- Effective: Monday 18 May 2026 (apply AFTER 11-15 May payroll run is finalised)

BEGIN;

UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT012'; -- Nicolette
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT023'; -- Faith
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT024'; -- Gugu
UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code = 'PT032'; -- Zandile

-- Audit note
INSERT INTO audit_log (action, entity_type, entity_id, after_state)
SELECT
  'wage_uplift_nmw_2026_05_18',
  'employee',
  id,
  jsonb_build_object('pt_code', pt_code, 'new_weekly_wage', 1340.00, 'effective', '2026-05-18')
FROM employees
WHERE pt_code IN ('PT012','PT023','PT024','PT032');

COMMIT;
```

- [ ] **Step 2: Commit the migration file (do not apply yet)**

```bash
git add supabase/migrations/00007_sales_wage_uplift.sql
git commit -m "feat(db): migration 00007 — sales wage uplift to R1340 (pending Mon 18 May)"
```

- [ ] **Step 3: When the time comes (after Mon 18 May payroll done), apply via Supabase SQL Editor**

Paste the contents of `supabase/migrations/00007_sales_wage_uplift.sql` into the dashboard SQL Editor. Run.

Verify:

```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8').split('\n').reduce((a,l)=>{const m=l.match(/^([^=#]+)=(.*)\$/);if(m)a[m[1].trim()]=m[2].trim().replace(/^['\"]|['\"]\$/g,'');return a;},{});
(async () => {
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/employees?pt_code=in.(PT012,PT023,PT024,PT032)&select=pt_code,weekly_wage,weekly_hours', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  console.log(await r.json());
})();
"
```

Expected: four rows, all `weekly_wage: 1340.00`, all `weekly_hours: 44`.

---

## Task 9: End-to-End Smoke Test Against Current Week

**Files:** none — pure verification.

- [ ] **Step 1: Start the dev server**

```bash
npm run dev
```

Expected: dev server up at `http://localhost:3000`. No type errors in console.

- [ ] **Step 2: Log in as Annika (owner role), navigate to Payroll**

URL: `http://localhost:3000/payroll`

- [ ] **Step 3: Pick a past week with attendance (e.g. 4-8 May) and click "Run Payroll"**

Confirm the run completes without throwing. Click into the eight affected staff (PT010, PT013, PT014, PT017, PT025, PT030, PT033, PT038) and confirm their payslips now show non-zero OT hours.

- [ ] **Step 4: Click "Recalculate" on that same week**

Confirm the run is re-generated, payslips repopulate, and no errors.

- [ ] **Step 5: Check `friday_ot_rollovers` table**

```bash
node -e "
const fs = require('fs');
const env = fs.readFileSync('.env.local','utf8').split('\n').reduce((a,l)=>{const m=l.match(/^([^=#]+)=(.*)\$/);if(m)a[m[1].trim()]=m[2].trim().replace(/^['\"]|['\"]\$/g,'');return a;},{});
(async () => {
  const r = await fetch(env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/friday_ot_rollovers?select=*&order=created_at.desc&limit=10', {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY }
  });
  console.log(JSON.stringify(await r.json(), null, 2));
})();
"
```

Expected: zero or more rows depending on whether any staff clocked past Fri 16:00. No errors.

- [ ] **Step 6: Stop dev server. Commit any incidental fixes**

```bash
git add <any modified files>
git commit -m "chore: end-to-end smoke fixes (if any)"
```

---

## Self-Review Summary

**Spec coverage:**
- Rule (40h / 44h, Mon-Sat hours, threshold): Tasks 4 + 5 (helpers + engine).
- Friday rollover persistence: Tasks 2 (schema) + 6 (run route) + 7 (recalc route).
- Sales staff weekly_hours 45 → 44: Task 2 (migration UPDATE).
- Sales wage uplift to R1340: Task 8 (separate migration, gated by date).
- NMW check constraint per weekly_hours: Task 2.
- Engine NMW guard: Task 5 step 5 + test 10.
- 10 test cases from spec: Task 5 covers all 10.
- Sick/leave/PH counts toward threshold: Task 5 step 13 (test 8).

**No placeholders.** Every code step contains full, copy-pasteable code.

**Type consistency.** Helpers `normalEndMinutesForDay` / `dailyQuotaHoursFor`, types `PayrollInput.prevWeekFridayRolloverMinutes` / `PayrollResult.next_week_friday_rollover_minutes`, table `friday_ot_rollovers` columns are referenced identically in tasks 2, 3, 4, 5, 6, 7.

**Out of scope (not in plan):** loan back-fill (Issue 2 — separate spec), one-off anomalies (Issue 4), attendance rounding (Issue 5), past payroll runs (Annika explicit: ignore the past).
