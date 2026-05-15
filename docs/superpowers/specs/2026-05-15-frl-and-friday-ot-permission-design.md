# Family Responsibility Leave + Friday OT Edit Permission — Design Spec

**Date:** 2026-05-15
**Author:** Annika (with Claude)
**Status:** Approved, ready for implementation plan
**Triggering session:** Pre-payroll change request — Annika needed FRL on the system and a permission tweak for Cheryl + Marlyn before running this week's payroll (week of 11-15 May 2026).

---

## 1. Problem Statement

Two unrelated-but-coincident asks landed before the 15 May payroll run:

1. **OT permission gap** — Friday past-16:00 hours roll into the *next* week's payroll via the `friday_ot_rollovers` table (introduced 14 May, engine v2). The two attendance clerks (Cheryl + Marlyn, both `attendance_clerk` role) cannot reach the prior Friday on the register because the date picker locks them to the current week's Monday onward. When Friday OT info arrives late (Monday morning), they have no way to enter it without the owner logging in.

2. **Family Responsibility Leave (FRL) not actually tracked** — schema, dropdown on staff profile, and balance card all already exist (`family_remaining` defaults to 3 per BCEA s27). But:
   - "Family Resp." is not a status option on the daily Register, so Marlyn cannot mark it from the register flow she actually uses.
   - The leave tab inserts leave rows but **never decrements `leave_balances`** — same bug exists for annual + sick. Balances drift silently from reality.
   - No alert when an employee exhausts FRL.
   - No 12-month BCEA cycle reset.

## 2. Out of Scope

- Engine OT calculation logic (already correct per v2 — Mon-Thu 17:00 / Fri 16:00 / Sat 13:00 sales).
- The `friday_ot_rollovers` table population from prior weeks. Annika's direction: the table-write logic in `payroll/run` and `payroll/recalc` routes is sufficient. **Open risk noted in §6** — if last week's run was under v1, no rollover row exists for `source_friday = 2026-05-08` and Marlyn's edit will not flow through this week's payroll on its own. Owner accepts this risk and will handle separately if it bites.
- Reverse logic when a `family` attendance row is changed/deleted (Phase 2).
- BCEA reason categories (birth/sick child/death of immediate family) — free-text reason field is enough for now.
- Cron-driven balance resets — replaced by on-the-fly computation in §5c.
- Backfill of existing stale `_remaining` values — they will self-correct as new leave is recorded.

## 3. Section 1 — Friday `time_out` Edit Permission for `attendance_clerk`

### 3.1 Behaviour
- `attendance_clerk` role can navigate to **the most-recent prior Friday** on the register.
  - "Most-recent prior Friday" = `startOfWeek(today, weekStartsOn: Monday) - 3 days`.
- On any other date before this Monday, the date picker rejects the change (existing toast: "You can only capture register for the current week").
- On dates within the current week, behaviour is unchanged.
- On the prior Friday itself, **only the `time_out` field is editable**. Status, `time_in`, `late_minutes`, and `reason` are disabled. The delete button (owner-only) remains owner-only.
- `owner` role behaviour is unchanged (full access with >7-day confirm modal).

### 3.2 Implementation
File: `src/app/(dashboard)/register/page.tsx`
- Replace the `min` calculation on the date input (currently `:810-813`) with a per-role helper:
  - `owner` → `undefined` (no min)
  - `attendance_clerk` → `prevFriday(today)`
  - other non-owner roles → `startOfWeek(today, Monday)` (current behaviour)
- Update the `onChange` guard (currently `:822-829`) to mirror: for `attendance_clerk`, allow `prevFriday(today)` OR any date in `[thisMonday, today]`. Reject anything in between (i.e., previous Sat/Sun) and anything older than `prevFriday(today)`.
- Compute `isPrevFridayForClerk = (selectedDate === prevFriday && user.role === 'attendance_clerk')`.
- Pass `disabled={isPrevFridayForClerk || editLocked}` to: status `<select>`, time_in `<TimePicker>`, late_minutes `<input>`, reason `<input>`.
- `time_out` `<TimePicker>` keeps its existing `disabled={!canEdit || editLocked}` (no clerk lockout).
- Add a small inline banner above the table when `isPrevFridayForClerk` is true: *"Previous Friday — Time Out only. Edit other fields on the day they occurred."*

### 3.3 Server-side enforcement
**Out of scope.** Lock is UI-only, consistent with how the existing date-picker restriction works today. If the spec is re-opened later for hardening, add server-side validation in `POST /api/register` that rejects writes to old dates from `attendance_clerk` users that change anything other than `time_out`.

## 4. Section 2 — Family Responsibility on the Register

### 4.1 Behaviour
- "Family Resp." appears as a status option in the register's day view dropdown.
- Selecting it for an employee+date saves an attendance row with `status = 'family'`, behaves like Leave/Sick (no time_in/time_out fields shown).
- On save, the API also creates a `leave` row of type `family` AND decrements `family_remaining` by 1.
- If the save would drive `family_remaining < 0`, the API returns 409 and the row is rejected with a toast: *"X has no family responsibility leave remaining for this cycle."*
- An `?override=true` flag on the API call lets `owner` push through anyway (negative balance allowed).
- Engine pays the day at full credit hours (same as `'leave'`/`'sick'`/`'ph'`).

### 4.2 Implementation

**4.2a. Database migration `00009_attendance_status_family.sql`**
```sql
BEGIN;
ALTER TYPE attendance_status ADD VALUE IF NOT EXISTS 'family';
COMMIT;
```
*Note: `ADD VALUE` cannot run inside a transaction in older Postgres, but Supabase pg14+ supports it. If the migration fails on transaction wrap, drop the BEGIN/COMMIT.*

**4.2b. Register UI** — `src/app/(dashboard)/register/page.tsx`
- `STATUS_OPTIONS` (`:46-54`): add `{ value: 'family', label: 'Family Resp.' }`.
- `STATUS_COLORS` (`:56-64`): add `family: 'bg-teal-50 text-teal-700 border-teal-300'`.
- `BADGE_COLORS` (`:66-74`): add `family: 'blue'`. (Reusing the `'blue'` badge colour is fine — the cell-level `STATUS_COLORS` teal is what visually distinguishes Family from Leave; the badge appears in the day-view summary where the label "Family" already disambiguates.)
- "Clear times when status changes to non-working" branch (`:575`): add `'family'` to the list `['absent', 'sick', 'leave', 'short_time']`.
- Time-in / time-out cell render guards (`:1073`, `:1086`): add `'family'` to the no-time-status list so cells render an em-dash.
- WeekGrid (`:347`): family days render in blue with label `FAMILY` (matches existing leave/sick treatment).

**4.2c. `POST /api/register` enhancement** — `src/app/api/register/route.ts`
- After the `attendance.upsert(records)` call, scan saved records for any with `status === 'family'` that did **not** previously have `status === 'family'` (i.e., genuinely new family days).
- For each new family day:
  1. Read current `leave_balances` for that employee. If `family_remaining < 1` and not `override=true`, abort the entire save (return 409, employee name + date in error). Either nothing saves or everything saves — no partial state.
  2. Insert into `leave`: `{ employee_id, leave_type: 'family', from_date: date, to_date: date, days: 1, reason: 'Recorded from register', approved_by: user.name, approved_at: now() }`.
  3. Update `leave_balances` set `family_remaining = family_remaining - 1` where `employee_id = …`.
- Atomic intent: do the precheck for all rows first, then writes. If any precheck fails, abort before any writes.

**4.2d. Engine** — `src/lib/payroll-engine.ts`
- Line 138: extend the paid-leave clause to `if (day.status === 'leave' || day.status === 'sick' || day.status === 'ph' || day.status === 'family')`.

## 5. Section 3 — Leave Balance Tracking (Bug Fix + FRL Alert + Cycle)

### 5.1 What this section fixes
The leave balance decrement bug exists today for **annual, sick, and family** leave types — they never decrement on save. Section 3 fixes the underlying bug and adds the FRL-specific UX Annika asked for.

### 5.2 5a — Decrement on save (all leave types)

**Two write paths today:**
1. `handleSaveLeave` in `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx` (`:118-179`)
2. `POST /api/register` (after Section 2 lands)

**Plan:**
- Move the `leave-tab` insert to a new endpoint `POST /api/leave` so the decrement logic lives server-side and is shared with `/api/register`.
- The endpoint receives `{ employee_id, leave_type, from_date, to_date, reason, override? }`, computes `days` (excluding Sundays — same logic as `getDatesInRange`), inserts the leave row, creates attendance rows, and decrements the matching `_remaining` column by `days`.
- Refusal rule for **family** only: if `family_remaining - days < 0` and not `override=true`, return 409. Annual and sick can go negative (existing behaviour — Annika has the discretion to grant beyond entitlement).
- The undo handler (`:165-178`) calls `DELETE /api/leave/:id`, which restores the balance and removes attendance rows. Rebuild this around the new endpoint.

### 5.3 5b — Inline alert when FRL exhausted

In `src/app/(dashboard)/register/page.tsx`:
- Fetch each employee's `family_remaining` alongside the existing register data.
- When the status dropdown for a row is opened (or whenever `status === 'family'` is selected), if `family_remaining <= 0` show a red inline banner on that row: *"No family responsibility leave remaining for this cycle. Owner override required."*
- The save will be rejected by the API anyway; the inline alert just makes it visible at the point of action.

**Sidebar alert deferred** (Phase 2). Listed in §6.

### 5.4 5c — On-the-fly 12-month FRL cycle (BCEA s27)

Skip the `family_cycle_started_at` column + cron approach. Instead:
- The leave tab loads the employee's leave history (already does — `:69-73`).
- Compute `family_remaining = 3 - count(family leave taken in [today - 365 days, today])`.
- Display this computed number on the family balance card. Storage column (`family_remaining` in `leave_balances`) becomes a stale cache used only by the API for fast precheck — refreshed every time leave is saved or removed.

**Implication:** owner-driven manual edits to `family_remaining` will be silently overridden the next time leave is recorded. Acceptable because nobody should be hand-editing balances. If we ever expose a "manual adjust" UI, this becomes a real conflict to resolve — out of scope here.

**Consistency note:** the API in §5.2 uses the cached `family_remaining` for the precheck, while the leave tab displays the computed value. To keep them in sync, the API must always re-write `family_remaining` to match the computed value (3 − count of family leave in the last 365 days, post-write) inside the same write that creates the new leave row. So storage and compute never drift by more than the duration of a single request.

### 5.5 5d — Backfill

**Skipped.** Existing `_remaining` values in `leave_balances` may be stale (likely all employees still show 21/30/3 because the bug masked all decrements). They will self-correct the next time leave is saved or removed for each employee. If a discrepancy bites in a payroll run, owner can manually fix the affected employee from Settings.

## 6. Open Risks & Phase 2 Items

1. **Friday rollover gap, source_friday = 2026-05-08:** the `friday_ot_rollovers` table has no row for last Friday because last week's payroll ran under v1. Marlyn editing time_out today will land in `attendance` but won't flow into this week's payroll on its own. Owner-acknowledged risk; handled out-of-band.
2. **Family attendance row edit/delete reverse logic:** if a clerk marks Family by mistake and corrects the status, the leave row + decrement remain. Owner cleans up via the leave tab.
3. **BCEA reason categories** for FRL (birth of child, sick child, death of immediate family) — free-text only for now.
4. **Sidebar alert badge** for "X has 0 family/sick days remaining" — listed but not built.
5. **Server-side enforcement** of the time_out-only Friday clerk lock — UI-only today.
6. **Drop `_remaining` columns entirely and compute all balances on the fly** — cleaner long-term design, deliberately deferred to avoid scope creep mid-payroll.

## 7. Files Touched (Implementation Plan Hand-Off)

| File | Change |
|---|---|
| `supabase/migrations/00009_attendance_status_family.sql` | NEW — add `'family'` to enum |
| `src/lib/payroll-engine.ts` | Extend paid-leave clause to include `'family'` |
| `src/app/(dashboard)/register/page.tsx` | Date min per-role; field-level lock on prev Friday; FRL status option/colours; inline FRL-exhausted banner |
| `src/app/api/register/route.ts` | Detect new `family` rows on save; create leave + decrement balance; return 409 if exhausted |
| `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx` | Re-route insert/delete through new `/api/leave`; compute `family_remaining` on the fly from leave history |
| `src/app/api/leave/route.ts` | NEW — POST inserts leave + decrements balance + creates attendance; DELETE restores balance + removes attendance |
| `CLAUDE.md` | Update "Locked Decisions" with FRL handling + Friday clerk permission rule |

## 8. Acceptance Criteria

1. As `attendance_clerk` Marlyn, on any weekday, I can navigate to the most recent prior Friday on the register and edit only the `time_out` field. All other inputs on that day are visibly disabled. The save succeeds and updates `attendance.time_out` for that date.
2. As `attendance_clerk` Marlyn, when I pick "Family Resp." for an employee on the register and save, an attendance row with `status='family'` is created, a `leave` row of type `family` is inserted, and `family_remaining` decrements by 1.
3. If I attempt step 2 for an employee whose `family_remaining = 0`, the save is rejected with a 409 and a clear toast naming the employee. No attendance row is written.
4. As `owner` Annika, I can re-attempt the same save with `override=true` and the row writes successfully (`family_remaining` goes to -1, audit trail intact).
5. The staff profile leave tab shows the family balance computed from the past 365 days of family leave entries — not the cached column. If I take 1 family day today, the card reads 2/3.
6. The payroll engine pays a `family` attendance day as 9h (Mon-Thu) / 8h (Fri) / 4h (Sat sales) full credit toward the weekly threshold, identical to existing `'leave'`.
7. As `owner`, my register access is unchanged.
