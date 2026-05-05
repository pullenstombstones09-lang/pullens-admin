# Pullens Admin — Payroll & Workflow Redesign Spec

**Date:** 5 May 2026
**Author:** Annika + Claude
**Status:** Draft — pending review

---

## 1. Pay Week Structure

### Weekly Payroll (Bank Transfer)

- Pay week runs **Monday 00:00 → Friday 16:00**
- Friday after 16:00 is classified as **overtime** and rolls into the **following week's** payroll
- Payroll generated Friday morning — system assumes all active staff finish at 16:00 that Friday
- Payroll run type: `weekly`

### Saturday Payroll (Cash)

- Separate payroll run, type: `saturday_cash`
- Nisha or Vikash selects which employees worked Saturday (tick from employee list)
- Default hours: 08:00–14:00 (6 hours at normal daily rate based on employee's existing hourly rate)
- After 14:00 = overtime at standard OT multiplier
- Generates its own payslips — each must be **signed by the employee** as proof of cash payment
- Print function shows **only Saturday workers** — no full staff list noise

### Individual Payslip Editing

- Any payslip can be recalculated individually by editing the underlying register entry
- Change one employee's time → recalculate that payslip only → rest of the run stays untouched
- No need to scrap and regenerate the entire payroll run

---

## 2. Payroll Approval Flow

### Per-Employee Approval Gate

Payroll generation does not auto-process all employees. Instead:

1. Register captured daily as normal
2. Friday morning: **Payroll Review** screen shows all employees
3. Everyone **defaults to approved** (green tick) — no need to tick 38 people manually
4. System auto-flags anomalies (see Section 4) — flagged employees highlighted
5. Owner/bookkeeper reviews flagged employees, fixes register entries or **pulls individuals out** of the batch
6. Pulled-out employees can be edited and **put back in** at any time before generation
7. **"Run Final Payroll"** button — big, clear, unmistakable. Only processes approved employees

### Why This Approach

- Replaces a spreadsheet where Annika had line-by-line control — this preserves that control
- At 38 employees, per-person approval is feasible and prevents "scrap the whole run" situations
- Default-approved means no extra work on clean weeks — only deal with problems
- Saturday payroll already requires selecting individuals — same UX pattern

---

## 3. Payslip Viewer

### Access From Anywhere

- Tap any employee name on **any screen** (register, payroll review, staff list, dashboard) → slide panel opens
- No page navigation — overlays current screen
- Dropdown to select any past week — not limited to current/latest run

### Full Breakdown

Each payslip displays:

| Line | Detail |
|---|---|
| Ordinary hours | hrs × hourly rate |
| Late dock | minutes docked (with day) |
| Overtime | hrs × multiplier × hourly rate |
| **Gross** | |
| UIF | employee contribution |
| PAYE | if applicable |
| Loan deduction | amount + purpose |
| Petty shortfall | if applicable |
| Garnishee | last week of month only |
| **Net** | |

Below the summary: **daily attendance breakdown** — each day showing time in, time out, status, hours worked, any dock applied.

### Saturday Payslips

- Same breakdown format, tagged as `Saturday Cash`
- Signed/unsigned status visible
- Printable — only Saturday workers on the print output

---

## 4. Anomaly Flags

Automatic flags shown as badges next to employee names on the Payroll Review screen:

| Flag | Severity | Trigger |
|---|---|---|
| Late dock applied | Amber | Any day with late minutes > 0 |
| Missing time in or out | Red | Present/late status but no time recorded |
| Zero hours on working day | Red | Present status but 0 hours calculated |
| High overtime | Amber | OT exceeds 10 hours in the week |
| High deductions | Red | Total deductions exceed 40% of gross |
| Week-on-week swing | Amber | Net pay differs > 15% from previous week |

Flags surface **before** "Run Final Payroll" — the review screen is the quality gate.

---

## 5. Late-Coming Rule

Replaces the current tiered system in `payroll-engine.ts`.

| Arrival Time | Dock |
|---|---|
| 08:00–08:05 | Nothing (5-minute grace) |
| 08:06–08:15 | 30 minutes |
| 08:16–09:00 | 60 minutes |
| 09:01+ | Actual time missed (auto-calculated, no supervisor override) |

- Example: arrive 10:15 → dock 135 minutes (2 hours 15 minutes)
- Example: arrive 12:00 → dock 240 minutes (4 hours)
- **Owner override**: can manually edit any individual's dock from the register at any time

---

## 6. Workflow Dashboard

### Day-Aware Live Checklist

The dashboard knows what day it is and shows the current priority action. Not static metric cards — a live checklist that updates as work completes.

| Day / State | Dashboard Shows |
|---|---|
| Monday–Thursday | "Register: 24/38 captured" → tap to go to register |
| Friday morning | "Payroll Review: 3 flagged, 35 approved" → tap to review |
| Friday after payroll runs | "4 payslips unsigned" → tap to signing |
| Friday/Saturday | "Saturday: not yet captured" → tap to select Saturday workers |
| Any day | Active alerts, unresolved anomalies, pending loans |

Each item is a **single tap to the action** — a button, not a card you read.

### Pulsing "What's Next"

- The highest-priority action has a subtle pulse animation
- Only one item pulses at a time
- When that task completes, the pulse shifts to the next priority automatically
- Everything else stays still — the pulse draws your eye to what matters now

---

## 7. Connected Navigation — Weekly Stepper

A horizontal progress bar visible across all payroll-related pages:

```
Register → Review → Run Final Payroll → Sign → Print → Bank
   ✓         ●            ○              ○      ○       ○
```

- ✓ Green tick = completed
- ● Blue dot = current step
- ○ Empty circle = not yet reached
- Tap any completed or current step to jump there
- Cannot skip ahead (e.g., can't sign before payroll runs)

### Register: Full Week View

Register shows Monday–Friday for all employees in a grid — see the whole week at a glance, spot gaps immediately without clicking day by day.

---

## 8. Role-Based Views

Each role sees only what they need on dashboard and navigation:

| Role | Sees |
|---|---|
| **Owner (Annika)** | Everything — full stepper, all dashboard items, all nav |
| **Bookkeeper (Leeann)** | Payroll, print, bank, review, stepper |
| **Signer (Nisha/Veshi)** | Sign Payslips, Saturday Capture |
| **Attendance Clerk (Marlyn/Cheryl)** | Register status only |
| **Cash Clerk (Kam)** | Petty Cash only |

---

## 9. Visual Refresh

### What Goes

- Gradient-filled metric cards
- Generic card shadows everywhere
- Decorative animations that don't mean anything
- Busy layouts with equal visual weight on everything
- Charcoal colour scheme

### What Replaces It

- **Royal blue (#1E40AF)** — sidebar, headers, active states, primary actions
- **Gold (#C4A35A)** — accent badges, highlights, key action buttons (e.g., "Run Final Payroll"), status indicators
- **Clean white workspace** — content area is white/light grey, no decoration
- **Clear hierarchy** — big numbers where they matter, quiet text where they don't
- **Functional colour only** — red = problem, amber = check this, green = done. No colour for decoration
- **48px touch targets** — every button and tap area is tablet-friendly
- **One font weight system** — bold for headings and key numbers, regular for everything else
- **Purposeful whitespace** — sections breathe, nothing floats in empty space

### Haptics

Subtle vibration feedback on tablet/phone:

- Light tap on button press
- Confirmation tap on approve/pull employee from batch
- Strong tap on "Run Final Payroll"
- Confirmation tap on payslip signing

### Liveness

The app feels alive and responsive:

- Real-time counters update as register gets captured (e.g., "24/38" ticks up without page refresh)
- Payslip signing count updates live as signatures come in
- Subtle transitions when items change state (approved ↔ pulled, unsigned → signed)
- Pulsing "what's next" shifts automatically as tasks complete
- No full page reloads — state changes happen in place

---

## 10. Database Changes Required

### New/Modified Tables

- `payroll_runs`: add `payroll_type` column — enum `'weekly' | 'saturday_cash'`
- New `payroll_batch` table — tracks per-employee approval status for each payroll run (`employee_id`, `payroll_run_id`, `status: approved | pulled | pending`, `pulled_reason`). Separate table preferred over array column for queryability and audit trail
- `attendance`: Friday after 16:00 OT logic — handled at calculation time, not stored differently

### Payroll Engine Changes

- `calculateLateMinutes()`: update tiers (08:06–08:15 = 30, 08:16–09:00 = 60, 09:01+ = actual)
- `calculatePayroll()`: handle Friday 16:00 cutoff — split Friday hours into ordinary (up to 16:00) and OT (after 16:00, rolls to next week)
- New function: `calculateSaturdayPayroll()` — 6-hour base (08:00–14:00), OT after 14:00
- Individual recalculation endpoint — recalculate one payslip without touching the rest

---

## 11. Out of Scope

These items are parked and not part of this spec:

- Petty cash overhaul
- Monthly reporting
- Payslip compliance (PAYE ref, leave balance, YTD totals)
- Garnishee 25% cap enforcement
- Document template engine
- Custom domain
- V12 parity testing
