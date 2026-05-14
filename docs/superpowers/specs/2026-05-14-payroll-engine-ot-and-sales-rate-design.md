# Payroll Engine — OT Detection + Sales Rate Fix

**Date:** 2026-05-14
**Author:** Annika + Claude (Opus 4.7)
**Status:** Draft, awaiting Annika's review

## Background

The 11 May 2026 payroll run (week 4-8 May) showed eight 40h-staff with full Mon-Thu past-17:00 attendance recorded but zero OT paid. Root cause in `src/lib/payroll-engine.ts`: the engine sums per-day attendance hours, caps the sum at the weekly limit (line 146), then only treats explicitly-approved `overtime_requests` rows as OT. Attendance-excess hours past the cap are silently discarded. The `overtime_requests` table has never been populated in production — staff worked OT, no one filed requests, and the engine paid 0h OT.

Separate but interacting bug: sales staff hourly rate is computed as `weekly_wage / 45`. With current sales wages (R1210-R1300/week for four employees) this produces R26.89-R28.89/hr — below the March 2026 NMW of R30.23/hr. Legal exposure.

This spec replaces the OT detection rule and corrects the sales rate divisor. Past payroll runs are out of scope — Annika has chosen to leave the 4-8 May run as-is and fix going forward only.

## Out of Scope

- Recalculation of past payroll runs (4-8 May or earlier).
- Loan deduction back-fill / migration (Issue 2 — separate spec).
- One-off attendance anomalies (Tumelo, Randhir, Lungiswa — Issue 4).
- Attendance rounding policy (Issue 5 — separate decision, defaults to current 5-min behaviour).
- Saturday `saturday_cash` payroll for factory staff — unchanged.

## Locked Rules (confirmed with Annika 14 May 2026)

### Normal Week — 40h Factory Staff
- Mon-Thu: 08:00 → 17:00 (9h clock each day)
- Fri: 08:00 → 16:00 (8h clock)
- Total clock = 44h, **paid 40h ordinary flat** (4h unpaid breaks absorbed, no per-day break math)
- Hourly rate = weekly_wage / 40
- Weekly OT threshold = 40h

### Normal Week — 44h Sales Staff (PT008, PT012, PT023, PT024, PT028, PT032)
- Mon-Thu: 08:00 → 17:00 (9h clock each day)
- Fri: 08:00 → 16:00 (8h clock)
- Sat: 09:00 → 13:00 (4h clock, sales staff only)
- Total clock = 48h, **paid 44h ordinary flat**
- Hourly rate = weekly_wage / 44
- Weekly OT threshold = 44h
- **Change from current code:** `DEFAULT_DAILY_HOURS_45 = 9` and `weekly_hours = 45` are wrong. Should be `weekly_hours = 44`.

### OT Detection Rule
1. For each day, identify "normal end of day" by date type:
   - Mon-Thu: 17:00
   - Fri: 16:00
   - Sat (sales only): 13:00
2. Hours clocked past normal end = **candidate OT** for that day.
3. Sum total weekly worked hours = ordinary clock hours + candidate OT.
4. If `weekly_worked >= threshold` (40 or 44): all candidate OT pays at **1.5×** premium.
5. If `weekly_worked < threshold`: candidate OT pays at **ordinary rate** (no premium). Example: a 4-day, 35h week with one long day past 17:00 pays everything ordinary.

### Friday Past 16:00 Rollover (preserves CLAUDE.md decision #8)
- Friday clock-out past 16:00 for **40h factory staff only** does not pay in the current week.
- It rolls into **next week's OT bucket** as candidate OT (counted at OT rate if next week reaches 40h).
- Sales staff Friday past 16:00 = same rollover treatment.
- Rationale: factory pay weeks end Friday 16:00 sharp (decision #8). Late Friday work belongs to the next pay cycle.

### Sick / Leave / Public Holiday Days
- Count as a full normal day (9h Mon-Thu, 8h Fri) toward the weekly threshold and ordinary pay.
- Mirrors BCEA spirit — paid leave time counts as time worked for OT-threshold purposes.

### Lateness
- Existing late-deduction logic unchanged (5-min grace, 30/60/actual-minutes tiers — `calculateLateMinutes` in engine).
- Late minutes do **not** reduce candidate OT calc — they reduce gross pay separately via `late_deduction`.

## Engine Pseudocode

```text
function computePayroll(employee, attendance_week, prev_week_friday_rollover):
  threshold = (employee.weekly_hours === 44) ? 44 : 40
  hourly_rate = employee.weekly_wage / threshold

  ordinary_clock_hours = 0
  candidate_ot_minutes = 0
  next_week_rollover_minutes = 0

  for each day in attendance_week:
    if day.status in ['leave', 'sick', 'ph']:
      ordinary_clock_hours += dailyQuotaFor(day.date, employee)
      continue
    if day.status === 'absent' or no clock_in:
      continue

    day_of_week = weekday(day.date)              // 1=Mon, 5=Fri, 6=Sat
    normal_end_min = normalEndForDay(day_of_week, employee)
    clock_in_min   = toMinutes(day.time_in)
    clock_out_min  = toMinutes(day.time_out)

    if day_of_week === 5:                        // Friday
      // Hours up to 16:00 count this week. Past 16:00 rolls to next week.
      ordinary_clock_hours += (min(clock_out_min, normal_end_min) - clock_in_min) / 60
      next_week_rollover_minutes += max(0, clock_out_min - normal_end_min)
    else:
      // Hours up to normal end → ordinary; past normal end → candidate OT this week.
      ordinary_clock_hours += (min(clock_out_min, normal_end_min) - clock_in_min) / 60
      candidate_ot_minutes += max(0, clock_out_min - normal_end_min)

  // Add prior week's Friday past-16:00 rollover as candidate OT this week
  candidate_ot_minutes += prev_week_friday_rollover

  candidate_ot_hours = candidate_ot_minutes / 60
  weekly_worked = ordinary_clock_hours + candidate_ot_hours

  if weekly_worked >= threshold:
    // OT premium triggers
    ordinary_hours_paid = min(ordinary_clock_hours, threshold)
    ot_hours_paid       = candidate_ot_hours
    ot_amount           = ot_hours_paid * hourly_rate * 1.5
  else:
    // Below threshold — pay everything ordinary, no premium
    ordinary_hours_paid = weekly_worked
    ot_hours_paid       = 0
    ot_amount           = 0

  gross_basic    = hourly_rate * ordinary_hours_paid
  late_deduction = (totalLateMinutes / 60) * hourly_rate
  gross          = gross_basic + ot_amount - late_deduction

  // ... UIF, PAYE, loans, garnishee, petty unchanged ...

  return {
    ordinary_hours: ordinary_hours_paid,
    ot_hours: ot_hours_paid,
    ot_amount,
    gross, net, ...,
    next_week_friday_rollover_minutes   // persist for next run
  }
```

**Note on the simplification:** because `ordinary_clock_hours` now only accumulates clock time *up to* the day's normal end (rather than full clock-in/out time), and OT minutes go into a separate bucket, the engine doesn't need a special "full week vs partial week" branch. A full normal week for a 40h staff produces `ordinary_clock_hours = 4×9 + 8 = 44`, `candidate_ot_hours = 0`, then `min(44, 40) = 40` paid ordinary — matches the flat-rate rule. A partial week produces what was actually clocked, no OT premium until 40h.

### Helper definitions
- `dailyQuotaFor(date, employee)`: returns 9h for Mon-Thu, 8h for Fri, 4h for Sat (sales only). For leave/sick/PH days used to credit the weekly threshold.
- `normalEndForDay(day_of_week, employee)`:
  - Mon-Thu: 17:00 (1020 min)
  - Fri: 16:00 (960 min)
  - Sat: 13:00 (780 min) — sales staff only; 40h staff Saturdays handled by `saturday_cash` run, not weekly engine.
  - Sun: not handled by weekly engine.

## Friday Rollover Persistence

**Mechanism:** new table `friday_ot_rollovers`:

```sql
CREATE TABLE friday_ot_rollovers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  employee_id UUID NOT NULL REFERENCES employees(id) ON DELETE CASCADE,
  source_friday DATE NOT NULL,         -- the Friday the OT was earned
  rollover_minutes INTEGER NOT NULL,
  applied_to_run_id UUID REFERENCES payroll_runs(id),
  applied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (employee_id, source_friday)
);
```

**Flow:**
1. When this week's payroll is generated, engine writes one row per employee with Friday past-16:00 minutes (if any), `applied_to_run_id = NULL`.
2. When next week's payroll is generated, engine reads all unapplied rollovers for each employee where `source_friday < this_week_start`, adds minutes to `candidate_ot_minutes`, and stamps `applied_to_run_id` + `applied_at` on those rows.
3. Recalculate flow: when a run is deleted and recalculated, rollovers it consumed must be reset to NULL (so they can be reapplied). When a run is deleted that *produced* rollover rows, those rows are deleted.

**Why a dedicated table vs reusing `overtime_requests`:** rollover is automatic, not approval-gated. Keeping them separate avoids polluting OT requests (which we may revive for unusual manual OT later) and gives a clean audit trail of "who carried what hours forward".

## Sales Staff Wage Raises (NMW Compliance)

To satisfy NMW R30.23/hr under wage ÷ 44 rule, sales staff weekly_wage must be ≥ R1330.12. Annika has chosen to round all four affected wages to **R1340** for clean payroll and a small buffer above the legal floor (R1340 / 44 = R30.45/hr).

| PT Code | Name | Current wage | New wage | Raise |
|---|---|---|---|---|
| PT008 | Marlyn Naidoo | R1451.13 | R1451.13 | none |
| PT012 | Nicolette David | R1250.00 | R1340.00 | +R90.00 |
| PT023 | Faith Nxele | R1210.00 | R1340.00 | +R130.00 |
| PT024 | Gugu Cele | R1210.00 | R1340.00 | +R130.00 |
| PT028 | Randhir Singh | R1820.00 | R1820.00 | none |
| PT032 | Zandile Mchunu | R1300.00 | R1340.00 | +R40.00 |

Total uplift across the four staff: **+R390.00 / week** (~R1,690 / month).

**Effective date:** Monday **18 May 2026** — first new payroll engine production run will be the week 18-22 May.

**Implementation:** `UPDATE employees SET weekly_wage = 1340.00 WHERE pt_code IN ('PT012','PT023','PT024','PT032')` baked into migration 00006.

## Schema Changes

1. **`employees.weekly_hours`:** the six sales staff currently set to 45 → update to 44.
2. **`employees.weekly_wage` CHECK constraint:** currently `>= 1209.20` (= NMW × 40). For sales staff (44h) the floor is R1330.12. Replace with:
   ```sql
   ALTER TABLE employees DROP CONSTRAINT chk_nmw;
   ALTER TABLE employees ADD CONSTRAINT chk_nmw
     CHECK (weekly_wage = 0 OR weekly_wage >= 30.23 * COALESCE(weekly_hours, 40));
   ```
3. **New table `friday_ot_rollovers`** (definition above).
4. **Migration file:** `supabase/migrations/00006_ot_engine_v2.sql` containing the above + sales wage updates as `UPDATE` statements.

## Files Affected

- `src/lib/payroll-engine.ts` — rewrite `calculatePayroll` per pseudocode; remove `DEFAULT_DAILY_HOURS_*` constants, `splitFridayHours` becomes simpler; remove dependence on `overtime_requests` for OT detection (keep table; unused by engine going forward).
- `src/lib/payroll-engine.test.ts` — new file. Test cases listed below.
- `src/app/api/payroll/run/route.ts` — pass `prev_week_friday_rollover` from new table into engine; write new rollover rows after run.
- `src/app/api/payroll/recalculate/route.ts` — reset consumed rollovers on recalc; delete produced rollovers when deleting a run.
- `supabase/migrations/00006_ot_engine_v2.sql` — schema + sales wage updates.
- `src/types/database.ts` — add `friday_ot_rollover` type, update `weekly_hours` literal types.

## Test Cases

Pure-function tests on `calculatePayroll`:

1. **Full normal week, no OT** — 40h factory, all 5 days clocked exactly normal hours → 40h ordinary, 0h OT, paid weekly_wage flat.
2. **Full normal week + Mon-Thu OT** — PT010 fixture: Mon 18:50, Tue 18:30 → 40h ordinary + 3.33h OT at 1.5×.
3. **Partial week, hours <40, with past-end day** — 3 days clocked 9h + 1 day 12h (3h past) = 39h total < 40 → 39h ordinary, 0h OT (premium does NOT trigger).
4. **Friday rollover write** — Fri clock-out 17:30 → 90 rollover minutes written to `friday_ot_rollovers` for next week.
5. **Friday rollover consume** — prior week 90 min in `friday_ot_rollovers`, current week clocked exactly 40h → 40h ordinary + 1.5h OT (the rolled-over Friday minutes pay this week).
6. **Sales staff (44h), full normal week** — Mon-Thu 9h + Fri 8h + Sat 4h = 48h clock → 44h ordinary, 0h OT, paid weekly_wage flat.
7. **Sales staff Saturday past 13:00** — Sat clock-out 14:00 → 1h candidate OT (current week, not rollover).
8. **Sick day in week** — 4 days clocked normal + 1 sick day → counts as full week, 40h ordinary, 0h OT.
9. **Late + OT same day** — Mon clock-in 08:20, clock-out 18:30 → late deduction 30 min, candidate OT 1.5h (clock-out 18:30 vs 17:00).
10. **NMW guard** — engine refuses to run if any employee's wage ÷ weekly_hours < R30.23 (defensive — schema constraint should already catch this).

## Risks & Open Questions

- **Friday rollover edge case:** if the prior week's payroll run was deleted/recalculated, what happens to rollovers it produced? Spec says: delete them. But that means a deleted run cannot be "restored" without re-generating the rollover. Acceptable, recalculate flow is the canonical reset path.
- **Engine refusal on NMW breach:** test 10 says engine throws. Alternative: engine warns but still runs. Recommendation: throw. Better to fail loudly than pay below NMW.
- **Sales wage uplift effective date:** locked at Monday 18 May 2026 (decision recorded above).

## Acceptance Criteria

1. Engine unit tests pass all 10 cases above.
2. Migration 00006 runs cleanly in dev Supabase and production.
3. Sales staff wage updates visible on staff list and payroll preview.
4. A dry-run payroll for the current week using existing attendance produces sensible OT for the 8 employees affected on 4-8 May (we expect smaller OT numbers than Excel — they don't have to match V12).
5. Friday rollover round-trip verified: run payroll for week N, observe row in `friday_ot_rollovers`, run payroll for week N+1, observe row marked `applied`.
