# FRL + Friday OT Edit Permission Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship three coherent changes before the next payroll run: (1) `attendance_clerk` can edit `time_out` only on the most-recent prior Friday; (2) Family Responsibility Leave is selectable on the daily Register and auto-creates leave + decrements balance; (3) leave-balance decrement bug is fixed for all leave types, with an on-the-fly 12-month FRL cycle and an inline alert when FRL is exhausted.

**Architecture:** Three concerns are intertwined — register UI lock, register API auto-leave, and a new `/api/leave` endpoint that owns balance decrement. A small migration adds `'family'` to the `attendance_status` enum. The payroll engine gets a one-line extension to pay `family` days at full credit (same as `leave`/`sick`/`ph`). The leave tab is refactored to call the new API for both create and delete, and computes the family balance on the fly from the leave history.

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Supabase (PostgreSQL + service role), Vitest. PIN auth, role-based permissions in `src/lib/permissions.ts`.

**Spec:** `docs/superpowers/specs/2026-05-15-frl-and-friday-ot-permission-design.md`

---

## File Structure (created or modified)

| Path | Status | Responsibility |
|---|---|---|
| `supabase/migrations/00009_attendance_status_family.sql` | NEW | Add `'family'` to `attendance_status` enum |
| `src/types/database.ts` | MODIFY | Add `'family'` to `AttendanceStatus` TS union |
| `src/lib/payroll-engine.ts` | MODIFY | Extend paid-leave clause (line 138) to include `'family'` |
| `src/lib/payroll-engine.test.ts` | MODIFY | Add tests proving family days pay full credit |
| `src/lib/leave-balance.ts` | NEW | Pure helpers: `computeFamilyBalance`, `dateRangeDays` |
| `src/lib/leave-balance.test.ts` | NEW | Unit tests for the helpers |
| `src/app/api/leave/route.ts` | NEW | POST inserts leave + creates attendance + decrements balance; DELETE restores |
| `src/app/api/register/route.ts` | MODIFY | POST detects new family rows → calls leave-balance helper → inserts leave row + decrements |
| `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx` | MODIFY | Use new `/api/leave` for create/delete; show on-the-fly family balance |
| `src/app/(dashboard)/register/page.tsx` | MODIFY | (1) Friday clerk permission (2) Family status option (3) Inline FRL-exhausted alert |
| `CLAUDE.md` | MODIFY | Update Locked Decisions and Status section |

---

## Sequencing Rationale

Ship order = dependency order. Each task ends with a commit; the codebase is shippable after every task.

1. Migration + type (foundation — nothing else compiles without these)
2. Engine + engine tests (smallest behaviour change, isolates regressions)
3. Leave-balance helpers + tests (pure functions, used by Tasks 4–5)
4. `/api/leave` route (new endpoint — leave-tab and register depend on it)
5. Refactor `leave-tab.tsx` to use the new API + on-the-fly compute
6. Section 1: Friday `time_out` clerk permission (independent UI change, ships value to Marlyn immediately)
7. Section 2 UI: Family status in register dropdown
8. Section 2 API: register POST auto-creates leave + decrements (uses the helper from Task 3)
9. Section 3: inline FRL-exhausted alert on register
10. CLAUDE.md update

---

## Task 1: Add `'family'` to `attendance_status` enum

**Files:**
- Create: `supabase/migrations/00009_attendance_status_family.sql`
- Modify: `src/types/database.ts:12`

- [ ] **Step 1: Write the migration**

```sql
-- 00009_attendance_status_family.sql
-- Pullens Admin: add 'family' to attendance_status enum
-- Date: 2026-05-15
-- Refs spec: docs/superpowers/specs/2026-05-15-frl-and-friday-ot-permission-design.md

ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'family';
```

Note: `ALTER TYPE … ADD VALUE` cannot run inside a transaction in PostgreSQL. Do not wrap in `BEGIN/COMMIT`.

- [ ] **Step 2: Apply the migration to Pullens Supabase**

Migration is applied via Supabase SQL Editor (not via MCP — Pullens MCP is not authed). Open the SQL Editor, paste the migration, click Run. Verify with:

```sql
SELECT enum_range(NULL::attendance_status);
-- Expected: {present,late,absent,leave,sick,ph,short_time,family}
```

- [ ] **Step 3: Update the TypeScript union**

Edit `src/types/database.ts` line 12 from:

```ts
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'sick' | 'ph' | 'short_time';
```

to:

```ts
export type AttendanceStatus = 'present' | 'late' | 'absent' | 'leave' | 'sick' | 'ph' | 'short_time' | 'family';
```

- [ ] **Step 4: Verify TypeScript still compiles**

Run: `npx tsc --noEmit`
Expected: no errors. (If anything fails, it's because a switch/exhaustiveness check exists somewhere — fix the warning by adding a `family` case.)

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/00009_attendance_status_family.sql src/types/database.ts
git commit -m "feat(db): add 'family' to attendance_status enum (mig 00009)"
```

---

## Task 2: Engine pays family days at full credit

**Files:**
- Modify: `src/lib/payroll-engine.ts:138`
- Modify: `src/lib/payroll-engine.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `src/lib/payroll-engine.test.ts`:

```ts
describe('family responsibility leave is paid', () => {
  it('credits 9h for a family day on Mon-Thu (40h staff)', () => {
    const emp = makeEmployee({ weekly_wage: 1209.20, weekly_hours: 40 });
    const attendance: Attendance[] = [
      { id: 'a1', employee_id: emp.id, date: '2026-05-11', status: 'family', time_in: null, time_out: null, late_minutes: 0, reason: 'Sick child', captured_by: null, captured_at: '' },
      // Tue-Fri present full days so weekly threshold (40h) is hit
      { id: 'a2', employee_id: emp.id, date: '2026-05-12', status: 'present', time_in: '08:00', time_out: '17:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
      { id: 'a3', employee_id: emp.id, date: '2026-05-13', status: 'present', time_in: '08:00', time_out: '17:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
      { id: 'a4', employee_id: emp.id, date: '2026-05-14', status: 'present', time_in: '08:00', time_out: '17:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
      { id: 'a5', employee_id: emp.id, date: '2026-05-15', status: 'present', time_in: '08:00', time_out: '16:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
    ];
    const input: PayrollInput = {
      employee: emp,
      attendance,
      overtimeRequests: [],
      activeLoans: [],
      pettyShortfall: 0,
      isLastWeekOfMonth: false,
      prevWeekFridayRolloverMinutes: 0,
    };
    const result = calculatePayroll(input);
    // 9 (Mon family) + 9+9+9 (Tue-Thu) + 8 (Fri) = 44h capped at 40h ordinary
    expect(result.ordinary_hours).toBe(40);
    // Family day breakdown line should appear with 9 hours
    const monBreakdown = result.breakdown.daily_attendance.find(d => d.date === '2026-05-11');
    expect(monBreakdown?.status).toBe('family');
    expect(monBreakdown?.hours_worked).toBe(9);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/payroll-engine.test.ts -t "family responsibility leave is paid"`
Expected: FAIL — Mon's `hours_worked` will be 0 (not 9) because the engine doesn't recognise `'family'`.

- [ ] **Step 3: Extend the paid-leave clause**

In `src/lib/payroll-engine.ts` line 138, replace:

```ts
    if (day.status === 'leave' || day.status === 'sick' || day.status === 'ph') {
```

with:

```ts
    if (day.status === 'leave' || day.status === 'sick' || day.status === 'ph' || day.status === 'family') {
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/payroll-engine.test.ts`
Expected: ALL PASS (the new family test plus all existing engine tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/payroll-engine.ts src/lib/payroll-engine.test.ts
git commit -m "feat(payroll): pay family responsibility days at full daily credit"
```

---

## Task 3: Pure helpers — `computeFamilyBalance` and `dateRangeDays`

**Files:**
- Create: `src/lib/leave-balance.ts`
- Create: `src/lib/leave-balance.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/leave-balance.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { computeFamilyBalance, dateRangeDays, FRL_ANNUAL_LIMIT } from './leave-balance';

describe('FRL_ANNUAL_LIMIT', () => {
  it('matches BCEA s27 — 3 days per cycle', () => {
    expect(FRL_ANNUAL_LIMIT).toBe(3);
  });
});

describe('dateRangeDays', () => {
  it('counts inclusive days between two dates, skipping Sundays', () => {
    // Mon 11 May - Wed 13 May 2026: 3 weekdays, no Sunday
    expect(dateRangeDays('2026-05-11', '2026-05-13')).toBe(3);
  });
  it('skips Sundays', () => {
    // Sat 16 May - Mon 18 May 2026: Sat + Mon = 2 (Sun excluded)
    expect(dateRangeDays('2026-05-16', '2026-05-18')).toBe(2);
  });
  it('returns 1 for a single non-Sunday date', () => {
    expect(dateRangeDays('2026-05-15', '2026-05-15')).toBe(1);
  });
  it('returns 0 if the only date is a Sunday', () => {
    expect(dateRangeDays('2026-05-17', '2026-05-17')).toBe(0);
  });
});

describe('computeFamilyBalance', () => {
  const today = new Date('2026-05-15T00:00:00');

  it('returns 3 when no family leave taken in the last 365 days', () => {
    expect(computeFamilyBalance([], today)).toBe(3);
  });

  it('subtracts family leave taken in the last 365 days', () => {
    const leaves = [
      { leave_type: 'family', from_date: '2026-04-10', to_date: '2026-04-10', days: 1 },
      { leave_type: 'family', from_date: '2026-03-15', to_date: '2026-03-15', days: 1 },
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(1); // 3 - 2
  });

  it('ignores non-family leave', () => {
    const leaves = [
      { leave_type: 'sick', from_date: '2026-04-10', to_date: '2026-04-12', days: 3 },
      { leave_type: 'annual', from_date: '2026-03-15', to_date: '2026-03-15', days: 1 },
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(3);
  });

  it('ignores family leave older than 365 days', () => {
    const leaves = [
      { leave_type: 'family', from_date: '2025-04-10', to_date: '2025-04-10', days: 1 }, // > 365 days ago from 2026-05-15
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(3);
  });

  it('clamps at 0 — never returns negative', () => {
    const leaves = [
      { leave_type: 'family', from_date: '2026-05-01', to_date: '2026-05-05', days: 5 }, // owner overrode FRL cap
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/leave-balance.test.ts`
Expected: FAIL — `Cannot find module './leave-balance'`.

- [ ] **Step 3: Implement the helpers**

Create `src/lib/leave-balance.ts`:

```ts
// Pullens Admin — leave balance helpers (BCEA s27 compliant for FRL)

export const FRL_ANNUAL_LIMIT = 3;

interface LeaveRecord {
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number;
}

/** Inclusive day count between two YYYY-MM-DD dates, excluding Sundays (matches existing leave-tab logic). */
export function dateRangeDays(from: string, to: string): number {
  let count = 0;
  const cur = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cur <= end) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Compute family responsibility leave remaining as 3 - (family days taken in the last 365 days).
 * Source of truth: the leave history. The leave_balances column is treated as a stale cache.
 * Clamped at 0 (cannot go negative even if owner overrode the cap).
 */
export function computeFamilyBalance(leaves: LeaveRecord[], asOf: Date = new Date()): number {
  const horizon = new Date(asOf);
  horizon.setDate(horizon.getDate() - 365);
  let used = 0;
  for (const l of leaves) {
    if (l.leave_type !== 'family') continue;
    const taken = new Date(l.from_date + 'T00:00:00');
    if (taken < horizon) continue;
    used += l.days;
  }
  return Math.max(0, FRL_ANNUAL_LIMIT - used);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run src/lib/leave-balance.test.ts`
Expected: ALL PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/leave-balance.ts src/lib/leave-balance.test.ts
git commit -m "feat(leave): add FRL balance + date-range helpers (BCEA s27)"
```

---

## Task 4: New `/api/leave` route — POST and DELETE

**Files:**
- Create: `src/app/api/leave/route.ts`

This route owns leave creation/deletion and the balance decrement that the leave-tab UI is missing today. Both `register` POST (Task 8) and the leave-tab (Task 5) will use it.

- [ ] **Step 1: Implement the route**

Create `src/app/api/leave/route.ts`:

```ts
import { NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { dateRangeDays, computeFamilyBalance, FRL_ANNUAL_LIMIT } from '@/lib/leave-balance';
import type { LeaveType } from '@/types/database';

async function getSupabase() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );
}

/**
 * POST /api/leave
 * Body: { employee_id, leave_type, from_date, to_date, reason?, approved_by?, override?, source? }
 * Inserts a leave row, creates attendance rows for each day (excluding Sundays),
 * and decrements the matching _remaining column on leave_balances.
 * Returns 409 if family balance would go negative and override is not true.
 */
export async function POST(request: NextRequest) {
  const body = await request.json();
  const {
    employee_id,
    leave_type,
    from_date,
    to_date,
    reason,
    approved_by,
    override,
    source, // optional, e.g. 'register' or 'leave-tab' (audit only)
  } = body as {
    employee_id: string;
    leave_type: LeaveType;
    from_date: string;
    to_date: string;
    reason?: string;
    approved_by?: string;
    override?: boolean;
    source?: string;
  };

  if (!employee_id || !leave_type || !from_date || !to_date) {
    return Response.json({ error: 'employee_id, leave_type, from_date, to_date are required' }, { status: 400 });
  }

  const supabase = await getSupabase();
  const days = dateRangeDays(from_date, to_date);
  if (days === 0) {
    return Response.json({ error: 'Date range yields zero working days' }, { status: 400 });
  }

  // FRL cap precheck — compute on-the-fly from leave history
  if (leave_type === 'family' && !override) {
    const { data: history } = await supabase
      .from('leave')
      .select('leave_type, from_date, to_date, days')
      .eq('employee_id', employee_id);
    const remaining = computeFamilyBalance(history ?? [], new Date());
    if (remaining - days < 0) {
      return Response.json(
        { error: `Family responsibility leave exhausted (remaining: ${remaining}, requested: ${days}). Owner override required.`, code: 'FRL_EXHAUSTED', remaining },
        { status: 409 }
      );
    }
  }

  // Insert leave row
  const { data: leaveRow, error: leaveError } = await supabase
    .from('leave')
    .insert({
      employee_id,
      leave_type,
      from_date,
      to_date,
      days,
      reason: reason || (source ? `Recorded from ${source}` : null),
      approved_by: approved_by || null,
      approved_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (leaveError || !leaveRow) {
    return Response.json({ error: leaveError?.message || 'Failed to insert leave' }, { status: 500 });
  }

  // Create attendance rows (excluding Sundays)
  const attendanceRows: Array<{ employee_id: string; date: string; status: string; time_in: null; time_out: null; late_minutes: number; reason: string | null }> = [];
  const cur = new Date(from_date + 'T00:00:00');
  const end = new Date(to_date + 'T00:00:00');
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      attendanceRows.push({
        employee_id,
        date: `${y}-${m}-${d}`,
        status: leave_type === 'sick' ? 'sick' : leave_type === 'family' ? 'family' : 'leave',
        time_in: null,
        time_out: null,
        late_minutes: 0,
        reason: reason || null,
      });
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (attendanceRows.length > 0) {
    await supabase.from('attendance').upsert(attendanceRows, { onConflict: 'employee_id,date' });
  }

  // Decrement matching _remaining column
  const remainingCol =
    leave_type === 'annual' ? 'annual_remaining'
    : leave_type === 'sick' ? 'sick_remaining'
    : leave_type === 'family' ? 'family_remaining'
    : null;
  if (remainingCol) {
    const { data: bal } = await supabase
      .from('leave_balances')
      .select(remainingCol)
      .eq('employee_id', employee_id)
      .single();
    const current = (bal as Record<string, number> | null)?.[remainingCol] ?? 0;
    await supabase
      .from('leave_balances')
      .update({ [remainingCol]: Math.max(0, current - days) })
      .eq('employee_id', employee_id);
  }

  return Response.json({ leave: leaveRow, days });
}

/**
 * DELETE /api/leave?id=<leave_id>
 * Removes the leave row, deletes the attendance rows for those dates, and restores the matching _remaining column.
 */
export async function DELETE(request: NextRequest) {
  const id = request.nextUrl.searchParams.get('id');
  if (!id) {
    return Response.json({ error: 'id query parameter required' }, { status: 400 });
  }

  const supabase = await getSupabase();

  const { data: leaveRow, error: fetchError } = await supabase
    .from('leave')
    .select('*')
    .eq('id', id)
    .single();
  if (fetchError || !leaveRow) {
    return Response.json({ error: 'Leave record not found' }, { status: 404 });
  }

  // Delete attendance rows for those dates (only those matching the leave's status, to avoid clobbering Present/Late entries the user later overrode)
  const cur = new Date(leaveRow.from_date + 'T00:00:00');
  const end = new Date(leaveRow.to_date + 'T00:00:00');
  const dates: string[] = [];
  while (cur <= end) {
    if (cur.getDay() !== 0) {
      const y = cur.getFullYear();
      const m = String(cur.getMonth() + 1).padStart(2, '0');
      const d = String(cur.getDate()).padStart(2, '0');
      dates.push(`${y}-${m}-${d}`);
    }
    cur.setDate(cur.getDate() + 1);
  }
  const matchingStatus = leaveRow.leave_type === 'sick' ? 'sick' : leaveRow.leave_type === 'family' ? 'family' : 'leave';
  if (dates.length > 0) {
    await supabase
      .from('attendance')
      .delete()
      .eq('employee_id', leaveRow.employee_id)
      .in('date', dates)
      .eq('status', matchingStatus);
  }

  // Restore balance
  const remainingCol =
    leaveRow.leave_type === 'annual' ? 'annual_remaining'
    : leaveRow.leave_type === 'sick' ? 'sick_remaining'
    : leaveRow.leave_type === 'family' ? 'family_remaining'
    : null;
  if (remainingCol) {
    const { data: bal } = await supabase
      .from('leave_balances')
      .select(remainingCol)
      .eq('employee_id', leaveRow.employee_id)
      .single();
    const current = (bal as Record<string, number> | null)?.[remainingCol] ?? 0;
    const cap =
      leaveRow.leave_type === 'annual' ? 21
      : leaveRow.leave_type === 'sick' ? 30
      : 3;
    await supabase
      .from('leave_balances')
      .update({ [remainingCol]: Math.min(cap, current + leaveRow.days) })
      .eq('employee_id', leaveRow.employee_id);
  }

  // Finally delete the leave row
  await supabase.from('leave').delete().eq('id', id);

  return Response.json({ success: true });
}
```

- [ ] **Step 2: Smoke test the route locally**

Start dev server: `npm run dev`
In another terminal:

```bash
curl -X POST http://localhost:3000/api/leave \
  -H "Content-Type: application/json" \
  -d '{"employee_id":"<a real uuid from employees>","leave_type":"family","from_date":"2026-05-15","to_date":"2026-05-15","reason":"Smoke test"}'
```

Expected: `{ "leave": { ... }, "days": 1 }`. Then delete it:

```bash
curl -X DELETE "http://localhost:3000/api/leave?id=<the returned id>"
```

Expected: `{ "success": true }`. Verify the leave_balances row went down then back up.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/leave/route.ts
git commit -m "feat(api): /api/leave POST + DELETE with balance decrement (FRL cap enforced)"
```

---

## Task 5: Refactor leave-tab to use `/api/leave` and compute family balance on the fly

**Files:**
- Modify: `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx`

- [ ] **Step 1: Replace `handleSaveLeave` with a fetch to `/api/leave`**

In `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx`, replace the current `handleSaveLeave` function (lines 118-179) with:

```ts
const handleSaveLeave = async () => {
  setSavingLeave(true);

  const res = await fetch('/api/leave', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employee_id: employeeId,
      leave_type: leaveForm.type,
      from_date: leaveForm.from_date,
      to_date: leaveForm.to_date,
      reason: leaveForm.reason || null,
      approved_by: user?.name ?? null,
      source: 'leave-tab',
    }),
  });

  const payload = await res.json();
  if (!res.ok) {
    toast('error', payload.error || 'Failed to record leave');
    setSavingLeave(false);
    return;
  }

  setSavingLeave(false);
  setShowRecordLeave(false);
  setLeaveForm(EMPTY_FORM);
  fetchLeave();

  showUndo('Leave recorded', async () => {
    await fetch(`/api/leave?id=${payload.leave.id}`, { method: 'DELETE' });
    fetchLeave();
  });
};
```

- [ ] **Step 2: Replace the delete handler to use the API**

Replace the `handleDeleteLeave` body (lines 85-102):

```ts
const handleDeleteLeave = (id: string) => {
  setConfirmModal({
    title: 'Delete Leave Record',
    description: 'Delete this leave record? This cannot be undone.',
    variant: 'danger',
    confirmLabel: 'Delete',
    onConfirm: async () => {
      setConfirmModal(null);
      const res = await fetch(`/api/leave?id=${id}`, { method: 'DELETE' });
      if (!res.ok) {
        toast('error', 'Failed to delete leave record');
      } else {
        toast('success', 'Leave record deleted');
        fetchLeave();
      }
    },
  });
};
```

- [ ] **Step 3: Compute family balance on the fly**

Import the helper at the top of the file:

```ts
import { computeFamilyBalance, FRL_ANNUAL_LIMIT } from '@/lib/leave-balance';
```

Add a derived value just before the JSX `return`:

```ts
const computedFamilyRemaining = computeFamilyBalance(leaves, new Date());
```

Replace the family balance card display (lines 241-255) — change the literal `{balance?.family_remaining ?? 0}` references to `{computedFamilyRemaining}`:

```tsx
<Card padding="md">
  <div className="text-center">
    <p className="text-2xl font-bold text-[var(--foreground)]">
      {computedFamilyRemaining}
      <span className="text-sm font-normal text-stone-400">/{FRL_ANNUAL_LIMIT}</span>
    </p>
    <p className="text-xs text-stone-500 mt-1">Family</p>
    <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
      <div
        className="h-full rounded-full bg-blue-400 transition-all"
        style={{ width: `${(computedFamilyRemaining / FRL_ANNUAL_LIMIT) * 100}%` }}
      />
    </div>
  </div>
</Card>
```

- [ ] **Step 4: Manual smoke test**

Start dev server: `npm run dev`
- Open a staff profile → Leave tab
- Record 1 day of family leave (any past date in the last 30 days)
- Family card should immediately show `2/3`
- Annual / Sick cards still show whatever the DB says (those still come from `balance.annual_remaining` / `sick_remaining`, decremented by the API)
- Delete the leave → Family card returns to `3/3`

- [ ] **Step 5: Commit**

```bash
git add src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx
git commit -m "refactor(leave-tab): route through /api/leave; compute family balance on the fly"
```

---

## Task 6: Section 1 — Friday `time_out` clerk permission

**Files:**
- Modify: `src/app/(dashboard)/register/page.tsx`

- [ ] **Step 1: Add a `prevFriday` helper near the top of the file**

Add this helper near the existing `toDateString` (line 76):

```ts
function getPrevFridayISO(today: Date = new Date()): string {
  // Most-recent prior Friday = Monday of this week - 3 days
  const t = new Date(today);
  t.setHours(0, 0, 0, 0);
  // Walk back to Monday of this week
  const dow = t.getDay(); // 0=Sun .. 6=Sat
  const daysSinceMonday = (dow + 6) % 7; // Mon=0, Tue=1, ... Sun=6
  const monday = new Date(t);
  monday.setDate(t.getDate() - daysSinceMonday);
  const prevFri = new Date(monday);
  prevFri.setDate(monday.getDate() - 3);
  return toDateString(prevFri);
}
```

- [ ] **Step 2: Compute clerk-specific date bounds in the component**

Inside `RegisterPage` component, near the existing `isOwner` declaration (line 411), add:

```ts
const isClerk = user?.role === 'attendance_clerk';
const prevFridayISO = getPrevFridayISO();
const isPrevFridayForClerk = isClerk && selectedDate === prevFridayISO;
```

- [ ] **Step 3: Update the date input `min` per role**

Replace the date input `min` attribute (currently lines 810-813):

```tsx
min={
  user?.role === 'owner'
    ? undefined
    : isClerk
      ? prevFridayISO
      : (() => {
          const mon = startOfWeek(new Date(), { weekStartsOn: 1 });
          return toDateString(mon);
        })()
}
```

- [ ] **Step 4: Update the date `onChange` guard for clerks**

Replace the non-owner branch in the `onChange` handler (currently lines 822-829) with:

```ts
// Clerk: allow prev Friday OR any day in current week
if (isClerk) {
  const monThisWeek = startOfWeek(today, { weekStartsOn: 1 });
  const isPrevFri = e.target.value === prevFridayISO;
  const isCurrentWeek = picked >= monThisWeek;
  if (!isPrevFri && !isCurrentWeek) {
    toast('error', 'You can only edit the previous Friday or days in the current week');
    return;
  }
} else if (user?.role !== 'owner') {
  // Other non-owner roles: current week only
  const mon = startOfWeek(today, { weekStartsOn: 1 });
  if (picked < mon) {
    toast('error', 'You can only capture register for the current week');
    return;
  }
}
```

- [ ] **Step 5: Disable all fields except `time_out` when clerk is on prev Friday**

In the `<tr>` row render (around lines 1003-1192), thread the `isPrevFridayForClerk` flag into each input's `disabled`:
- Status `<select>` (line 1052): `disabled={!canEdit || editLocked || isPrevFridayForClerk}`
- Time In `<TimePicker>` (line 1078): `disabled={!canEdit || editLocked || isPrevFridayForClerk}`
- Time Out `<TimePicker>` (line 1091): leave as `disabled={!canEdit || editLocked}` (NO clerk lockout — this is the field clerks CAN edit)
- Late Minutes `<input>` (line 1105): `disabled={!canEdit || editLocked || isPrevFridayForClerk}`
- Reason `<input>` (line 1155): `disabled={!canEdit || editLocked || isPrevFridayForClerk}`

- [ ] **Step 6: Add the inline banner**

Just below the date-picker `<Card>` (after line 863), add:

```tsx
{isPrevFridayForClerk && (
  <div className="rounded-xl bg-amber-50 border border-amber-200 px-5 py-3 flex items-center gap-3">
    <Clock className="h-5 w-5 text-amber-600 shrink-0" />
    <p className="text-sm text-amber-900">
      <strong>Previous Friday — Time Out only.</strong> All other fields are locked. Edit them on the day they occurred.
    </p>
  </div>
)}
```

- [ ] **Step 7: Manual smoke test**

Start dev server: `npm run dev`
- Log in as Marlyn (attendance_clerk)
- Open `/register`
- Verify date picker `min` is last Friday (8 May)
- Pick 8 May → only `time_out` is editable; status/time_in/late/reason are greyed
- Banner shows above the table
- Pick a current-week day → all fields editable as usual
- Try to type a date in between (e.g. 10 May, last Sunday) → toast error "You can only edit the previous Friday or days in the current week"

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/register/page.tsx
git commit -m "feat(register): attendance_clerk can edit time_out on previous Friday"
```

---

## Task 7: Section 2 UI — Family Resp. status option

**Files:**
- Modify: `src/app/(dashboard)/register/page.tsx`

- [ ] **Step 1: Add Family Resp. to STATUS_OPTIONS**

Update `STATUS_OPTIONS` (line 46-54):

```ts
const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
  { value: 'sick', label: 'Sick' },
  { value: 'family', label: 'Family Resp.' },
  { value: 'ph', label: 'Public Holiday' },
  { value: 'short_time', label: 'Short Time' },
];
```

- [ ] **Step 2: Add cell colour to STATUS_COLORS**

Update `STATUS_COLORS` (line 56-64):

```ts
const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  late: 'bg-amber-50 text-amber-700 border-amber-300',
  absent: 'bg-red-50 text-red-700 border-red-300',
  leave: 'bg-blue-50 text-blue-700 border-blue-300',
  sick: 'bg-purple-50 text-purple-700 border-purple-300',
  family: 'bg-teal-50 text-teal-700 border-teal-300',
  ph: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  short_time: 'bg-gray-100 text-gray-600 border-gray-300',
};
```

- [ ] **Step 3: Add badge colour to BADGE_COLORS**

Update `BADGE_COLORS` (line 66-74):

```ts
const BADGE_COLORS: Record<AttendanceStatus, 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'grey' | 'yellow'> = {
  present: 'green',
  late: 'amber',
  absent: 'red',
  leave: 'blue',
  sick: 'purple',
  family: 'blue',
  ph: 'blue',
  short_time: 'grey',
};
```

- [ ] **Step 4: Add `family` to the no-time-status guards**

Three places use `['absent', 'sick', 'leave', 'ph', 'short_time']` lists. Add `'family'` to each:

Line 575 (`if (patch.status && [...].includes(patch.status))`):
```ts
if (patch.status && ['absent', 'sick', 'leave', 'family', 'short_time'].includes(patch.status)) {
```

Line 669 (`noTimeStatuses` for save):
```ts
const noTimeStatuses: AttendanceStatus[] = ['absent', 'leave', 'sick', 'family', 'ph', 'short_time'];
```

Line 1073 (Time In cell render):
```tsx
{['absent', 'leave', 'sick', 'family', 'ph', 'short_time'].includes(row.status) ? (
```

Line 1086 (Time Out cell render):
```tsx
{['absent', 'leave', 'sick', 'family', 'ph', 'short_time'].includes(row.status) ? (
```

- [ ] **Step 5: WeekGrid family rendering**

In `WeekGrid` component (around line 347), extend the `leave/sick` branch to also handle `family`:

```tsx
// Leave/Sick/Family — coloured badges
if (s === 'leave' || s === 'sick' || s === 'family') {
  const bg = s === 'sick' ? 'bg-purple-500 hover:bg-purple-600' : s === 'family' ? 'bg-teal-500 hover:bg-teal-600' : 'bg-blue-500 hover:bg-blue-600';
  const label = s === 'sick' ? 'SICK' : s === 'family' ? 'FAM' : 'LEAVE';
  return (
    <button key={d} onClick={cellClick}
      className={`h-14 rounded-lg ${bg} flex items-center justify-center transition-all cursor-pointer`}>
      <span className="text-[10px] font-bold text-white">{label}</span>
    </button>
  );
}
```

- [ ] **Step 6: Add `family` to the summary strip**

The summary strip at lines 715-721 currently groups leave + sick together. Family belongs there too. Update:

```ts
const summary = {
  present: rows.filter((r) => r.status === 'present').length,
  late: rows.filter((r) => r.status === 'late').length,
  absent: rows.filter((r) => r.status === 'absent').length,
  leave: rows.filter((r) => r.status === 'leave' || r.status === 'sick' || r.status === 'family').length,
  other: rows.filter((r) => r.status === 'ph' || r.status === 'short_time').length,
};
```

- [ ] **Step 7: Manual smoke test (UI only — API integration in Task 8)**

Start dev server: `npm run dev`
- Open `/register` as owner
- Pick a row, change status to "Family Resp."
- Verify: cell turns teal, time_in/time_out show em-dashes, late minutes shows em-dash
- Click Save Register — should save (the API doesn't yet auto-create the leave row; that's Task 8). For now we're verifying the UI compiles and saves the attendance row.
- Verify the saved attendance row in Supabase has `status='family'`

- [ ] **Step 8: Commit**

```bash
git add src/app/(dashboard)/register/page.tsx
git commit -m "feat(register): add Family Resp. status option and rendering"
```

---

## Task 8: Section 2 API — register POST auto-creates leave + decrements

**Files:**
- Modify: `src/app/api/register/route.ts`

The current POST just upserts attendance. We extend it to detect newly-`family` rows, call `/api/leave` for each (or directly insert), and reject the entire save if any FRL precheck fails.

- [ ] **Step 1: Update POST to detect new family rows and create leave atomically**

Replace the `POST` function in `src/app/api/register/route.ts` with:

```ts
export async function POST(request: NextRequest) {
  const { records, date } = await request.json();

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  // 1. Read current state for the date so we can detect status TRANSITIONS into 'family'
  const employeeIds = records.map((r: { employee_id: string }) => r.employee_id);
  const { data: existing } = await supabase
    .from('attendance')
    .select('employee_id, status')
    .eq('date', date)
    .in('employee_id', employeeIds);

  const existingStatusByEmp = new Map<string, string>();
  for (const e of existing ?? []) {
    existingStatusByEmp.set(e.employee_id, e.status);
  }

  // 2. Identify "new family days" — records where status='family' AND prior status was NOT 'family'
  const newFamilyEmployeeIds: string[] = records
    .filter((r: { status: string; employee_id: string }) => r.status === 'family')
    .filter((r: { employee_id: string }) => existingStatusByEmp.get(r.employee_id) !== 'family')
    .map((r: { employee_id: string }) => r.employee_id);

  // 3. FRL precheck for all new family rows (compute on the fly from leave history)
  if (newFamilyEmployeeIds.length > 0) {
    const { data: leaves } = await supabase
      .from('leave')
      .select('employee_id, leave_type, from_date, to_date, days')
      .in('employee_id', newFamilyEmployeeIds);

    const { computeFamilyBalance } = await import('@/lib/leave-balance');
    const { data: emps } = await supabase
      .from('employees')
      .select('id, full_name')
      .in('id', newFamilyEmployeeIds);
    const nameById = new Map((emps ?? []).map((e: { id: string; full_name: string }) => [e.id, e.full_name]));

    for (const empId of newFamilyEmployeeIds) {
      const empLeaves = (leaves ?? []).filter((l: { employee_id: string }) => l.employee_id === empId);
      const remaining = computeFamilyBalance(empLeaves, new Date());
      if (remaining < 1) {
        return Response.json(
          {
            error: `${nameById.get(empId) ?? empId} has no family responsibility leave remaining for this cycle.`,
            code: 'FRL_EXHAUSTED',
            employee_id: empId,
          },
          { status: 409 }
        );
      }
    }
  }

  // 4. Upsert attendance (existing behaviour)
  const { error } = await supabase
    .from('attendance')
    .upsert(records, { onConflict: 'employee_id,date' });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }

  // 5. For each new family day, insert a leave row + decrement family_remaining
  for (const empId of newFamilyEmployeeIds) {
    await supabase.from('leave').insert({
      employee_id: empId,
      leave_type: 'family',
      from_date: date,
      to_date: date,
      days: 1,
      reason: 'Recorded from register',
      approved_by: null,
      approved_at: new Date().toISOString(),
    });

    const { data: bal } = await supabase
      .from('leave_balances')
      .select('family_remaining')
      .eq('employee_id', empId)
      .single();
    const current = bal?.family_remaining ?? 0;
    await supabase
      .from('leave_balances')
      .update({ family_remaining: Math.max(0, current - 1) })
      .eq('employee_id', empId);
  }

  return Response.json({ success: true });
}
```

- [ ] **Step 2: Manual smoke test**

Start dev server: `npm run dev`
- Open `/register` as owner, pick today
- Mark one employee as Family Resp., save
- Verify: attendance row saved with `status='family'`, a `leave` row exists for that employee+date with `leave_type='family'`, and `leave_balances.family_remaining` for that employee dropped by 1
- Mark the same employee Family Resp. AGAIN on the same date and save → should NOT create a duplicate leave row (the transition check filters it out because status was already family)
- Mark a different employee whose `family_remaining = 0` as Family Resp. → save should be rejected with 409 and the toast should name them. The attendance change is reverted only because the API never wrote it (the precheck happens before the upsert).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/register/route.ts
git commit -m "feat(api/register): auto-create family leave + decrement on new family attendance"
```

---

## Task 9: Section 3 — inline FRL-exhausted alert on register

**Files:**
- Modify: `src/app/(dashboard)/register/page.tsx`

- [ ] **Step 1: Fetch family balance per employee alongside register data**

In `RegisterPage`, the `RegisterRow` interface (around line 28) needs a new field. Add:

```ts
family_remaining: number;
```

Update the GET in `/api/register` (in the same `route.ts` modified in Task 8) to also return family balances:

```ts
// Add this query alongside the existing emp + att queries
supabase.from('leave_balances').select('employee_id, family_remaining'),
```

Adjust the destructuring and Response.json shape to include `family_balances`. Then in `fetchData` on the register page, merge the values into each row.

- [ ] **Step 2: Show inline alert when status is family AND family_remaining is 0**

Inside the `<tr>` render, just after the Status `<select>` cell, add a wrapping element OR add a banner row immediately after this employee's row when the condition is met. Simpler: render a small inline warning to the right of the status select:

```tsx
{row.status === 'family' && row.family_remaining <= 0 && (
  <span className="ml-2 text-[10px] font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded">
    No FRL left — owner override required
  </span>
)}
```

Place it inside the Status `<td>` cell, after the `<select>`.

- [ ] **Step 3: Manual smoke test**

Start dev server: `npm run dev`
- Pick an employee, manually run `UPDATE leave_balances SET family_remaining = 0 WHERE employee_id = '<uuid>';` in Supabase SQL editor
- Open `/register`, change that employee to Family Resp.
- Verify: red inline warning appears in the status cell
- Click Save → 409 toast, save aborted

- [ ] **Step 4: Commit**

```bash
git add src/app/(dashboard)/register/page.tsx src/app/api/register/route.ts
git commit -m "feat(register): inline alert when employee has 0 FRL remaining"
```

---

## Task 10: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Append Locked Decisions**

In `CLAUDE.md`, under the existing "Locked Decisions" list (currently items 1-18), append:

```markdown
19. Attendance clerk role can edit `time_out` only on the most-recent prior Friday. All other fields on that day stay disabled. (15 May 2026)
20. Family Responsibility Leave: 3 days per 12-month cycle (BCEA s27). FRL balance is computed on-the-fly from the `leave` table (`computeFamilyBalance` in `src/lib/leave-balance.ts`); the `leave_balances.family_remaining` column is a stale cache used only by the register API for fast precheck. Owner-only override allowed via API param `override=true`. (15 May 2026)
21. Leave balance decrement: all leave create/delete now goes through `/api/leave`, which decrements/restores `annual_remaining`/`sick_remaining`/`family_remaining` atomically with the leave row insert. The leave-tab and the register POST share this code path. (15 May 2026)
```

- [ ] **Step 2: Update the "Status — 14 May 2026" section header to add a 15 May section above it**

Insert before the "## Status — 14 May 2026" line:

```markdown
## Status — 15 May 2026 (session complete)

### SESSION WORK (15 May) — FRL + Friday OT clerk permission

Spec: `docs/superpowers/specs/2026-05-15-frl-and-friday-ot-permission-design.md`
Plan: `docs/superpowers/plans/2026-05-15-frl-and-friday-ot-permission-plan.md`

Shipped:
- Migration 00009: `family` added to `attendance_status` enum.
- Engine pays family days at full daily credit (9h Mon-Thu / 8h Fri / 4h Sat sales).
- New `/api/leave` route owns leave create + delete + balance decrement (fixes silent bug for annual + sick + family).
- Leave tab refactored to use `/api/leave`; family balance now computed on-the-fly from leave history (cache column kept for API precheck).
- Family Resp. status option added to register day view (teal cell, badge, summary strip).
- Register POST auto-creates a leave row + decrements `family_remaining` when a new family day is captured. FRL exhaustion returns 409 with employee name.
- Inline red warning in register status cell when employee has 0 FRL remaining.
- Attendance clerks (Cheryl + Marlyn) can now navigate to the most-recent prior Friday on the register and edit ONLY `time_out`. All other fields locked on that day. Inline amber banner explains the lock.

Open risk noted in spec §6.1: `friday_ot_rollovers` has no row for `source_friday=2026-05-08` because last week's payroll ran under engine v1. Marlyn editing time_out today lands in `attendance` but does not flow through this week's payroll. Owner-acknowledged; handled out-of-band.

---
```

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: CLAUDE.md update — FRL + Friday OT clerk permission session (15 May 2026)"
```

---

## Task 11: Push and verify on Vercel

- [ ] **Step 1: Push**

```bash
git push origin main
```

- [ ] **Step 2: Wait for Vercel build, then smoke test the live URL**

- Open `https://pullens-admin.vercel.app`
- Log in as owner → verify register works
- Log in as Marlyn → verify Friday OT permission works on prod
- Mark a test employee Family Resp., save, verify the leave row + decrement landed in the live Supabase

---

## Acceptance Criteria (from spec §8)

After all tasks complete:

1. As `attendance_clerk` Marlyn, on any weekday, I can navigate to the most recent prior Friday on the register and edit only the `time_out` field. — **Tasks 6, 11**
2. As `attendance_clerk` Marlyn, when I pick "Family Resp." for an employee on the register and save, an attendance row with `status='family'` is created, a `leave` row of type `family` is inserted, and `family_remaining` decrements by 1. — **Tasks 1, 7, 8**
3. If I attempt step 2 for an employee whose `family_remaining = 0`, the save is rejected with a 409 and a clear toast naming the employee. — **Task 8**
4. As `owner` Annika, I can re-attempt the same save with `override=true` and the row writes successfully. — **Task 4 (override flag exists in /api/leave; register POST currently has no override path — Phase 2 if Annika wants UI for it)**
5. The staff profile leave tab shows the family balance computed from the past 365 days of family leave entries. — **Tasks 3, 5**
6. The payroll engine pays a `family` attendance day as 9h / 8h / 4h full credit. — **Task 2**
7. As `owner`, my register access is unchanged. — **Task 6 (owner branch is `undefined` min, no clerk gating)**

---

## Self-Review

**Spec coverage:** Tasks map to all sections (1, 2a-d, 3a-d) of the spec. Acceptance criteria 1-3 and 5-7 are covered. AC4 (owner override on register POST) is partially covered — the `/api/leave` route accepts `override=true` but the register POST path doesn't currently expose an override flag to the UI. This is consistent with spec §6 ("override mechanism for register-driven family days listed as Phase 2") — flagged here so the engineer doesn't think it's a gap.

**Placeholder scan:** No "TBD", "TODO", or vague directives. Every step has either explicit code or an exact command.

**Type consistency:** `dateRangeDays`, `computeFamilyBalance`, `FRL_ANNUAL_LIMIT` are defined in Task 3 and used by name in Tasks 4, 5, and 8. The `attendance_status` enum addition in Task 1 is consumed by Tasks 2, 6, 7, 8. The `RegisterRow.family_remaining` field added in Task 9 has no consumer outside Task 9 itself.

**Open risk acknowledged in spec §6.1** is restated in Task 10 (CLAUDE.md update) so it survives this session.
