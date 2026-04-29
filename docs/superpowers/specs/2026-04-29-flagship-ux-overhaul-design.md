# Pullens Admin — Flagship UX Overhaul Design Spec

**Date:** 2026-04-29
**Status:** Approved
**Scope:** System-wide UX overhaul — smart defaults, role-based architecture, alert system, native app feel, motion design, palette refresh
**Supersedes:** 2026-04-28-system-overhaul-design.md (partial — this spec covers UX/flow only, not payroll engine or data layer changes)

---

## Guiding Principle

> The system should feel like a senior office manager who hands you a clipboard with everything filled in and says "just check these three things."

Every page opens ready to work. Users only handle exceptions. The system knows who you are, what day it is, and what needs doing.

---

## 1. Roles & Permissions

### 1.1 Role Definitions

Six roles. Each maps to one job in the system, not an org chart title.

```
owner              Full system access, settings, overrides, approvals
supervisor         People management — staff, warnings, leave, HR advisor, view register
bookkeeper         Money management — payroll run, print, bank, loans, view register
attendance_clerk   Register capture — today + yesterday only
cash_clerk         Petty cash — in/out recording, view own transactions
signer             Sign payslips — tablet-optimised, nothing else
```

### 1.2 Permission Matrix

| Feature | owner | supervisor | bookkeeper | attendance_clerk | cash_clerk | signer |
|---|---|---|---|---|---|---|
| Dashboard (full) | yes | yes | yes | — | — | — |
| Staff profiles | edit | view | view names | view names | — | — |
| Register | edit + override | view | view | edit (today+yesterday) | — | — |
| Payroll run | yes | — | yes | — | — | — |
| Payroll sign | yes | — | — | — | — | yes |
| Payroll print | yes | — | yes | — | — | — |
| Payroll bank | yes | — | yes | — | — | — |
| Petty cash | yes | view | view | — | edit | — |
| Warnings | yes | yes | — | — | — | — |
| Leave | yes | yes | — | — | — | — |
| HR Advisor | yes | yes | — | — | — | — |
| Loans | yes | view | yes | — | — | — |
| Alerts | all | own role | own role | own role | own role | own role |
| Settings | yes | — | — | — | — | — |
| Exports | yes | yes | yes | — | — | — |

### 1.3 Migration from Current Roles

| Old role | New role |
|---|---|
| `head_admin` | `owner` |
| `head_of_admin` | `supervisor` |
| `head_of_sales` | `supervisor` |
| `bookkeeper` | `bookkeeper` |
| `admin` | `attendance_clerk` |
| `petty_cash` | `cash_clerk` |
| (new) | `signer` |

Update `UserRole` type in `types/database.ts`, `permissions.ts`, `auth-context.tsx`, all role checks across the app, and the `users` table enum in Supabase.

---

## 2. Role-Aware Home Screens

Each role lands on their primary job. No navigation required to start working.

| Role | Home route | What they see |
|---|---|---|
| owner | `/dashboard` | Week progress stepper, blockers across all areas, metric cards |
| supervisor | `/dashboard` | Staff alerts (warnings due, probation ending, leave requests) |
| bookkeeper | `/payroll` | Current week status — whichever step is next (run/print/bank) |
| attendance_clerk | `/register` | Today's register, pre-filled and ready to save |
| cash_clerk | `/petty-cash` | Petty cash form, ready to record |
| signer | `/payroll/sign` | Unsigned payslip count + "Start Signing" button |

### Implementation

`auth-context.tsx` or the dashboard layout determines the redirect based on `user.role` after login. No intermediate dashboard for roles that have a single job.

---

## 3. Smart Defaults

The register pattern applied to every page: default to the common case, user only handles exceptions.

### 3.1 Register (confirmed design from this session)

- New rows default to `present`, times based on day + employee type:
  - Mon–Thu: 08:00–17:00 (all staff)
  - Friday: 08:00–16:00 (all staff)
  - Saturday, 45hr staff (`employee.weekly_hours >= 45`): 08:00–13:00 (present)
  - Saturday, 40hr staff (`employee.weekly_hours < 45`): absent, no times (not scheduled)
- Day detection: `new Date(selectedDate + 'T00:00:00').getDay()` — Fri=5, Sat=6
- Remove "Mark All Present" button — redundant
- Remove "Clear All" button — redundant
- When status changes to absent/sick/leave → auto-clear time_in, time_out, late_minutes, ot_minutes
- When status changes back to present → auto-restore default times (day-aware)
- Late/OT auto-detection from times stays as-is
- Edit window: today + yesterday for `attendance_clerk`, older dates = `owner` only
- Auto-advance after save goes to **today** (not next uncaptured day)

### 3.2 Payroll Bank

- All employees default to **ticked** (paid)
- Bookkeeper unticks exceptions (missing banking, unpaid leave, etc.)
- "Mark Week Complete" button always visible but disabled with reason if not all resolved: "2 employees unticked — resolve or confirm unpaid"
- Add "Untick All" for edge cases (batch re-check)

### 3.3 Payroll Run

- Auto-selects current pay week
- "Run Payroll" button disabled with inline blocker if register incomplete: "3 days missing attendance — Capture now →"
- Results table loads with all employees, no selection needed

### 3.4 Payroll Sign

- First unsigned payslip auto-loaded, canvas ready
- Auto-advance on sign (already works)
- Progress bar: "12/38 signed" at top

### 3.5 Petty Cash

- Form opens empty — no default category (was defaulting to "Diesel" for no reason)
- Required fields marked with `*`
- "Recipient" field: show placeholder "Select or type name"

### 3.6 Login

- Fetch user list from `users` table — no hardcoded array
- Show user buttons dynamically
- Most recent login highlighted (store last user in localStorage)
- PIN input auto-focuses after user selection

---

## 4. Alert & Notification System

Three tiers. Alerts are the nervous system of the app, not an afterthought page.

### 4.1 Tiers

| Tier | Purpose | Where it renders | Persistence | Example |
|---|---|---|---|---|
| **Blocker** | Can't proceed until resolved | Inline on the action page, disables the action button | Computed live from data | "Register incomplete for Mon, Tue — capture before payroll" |
| **Warning** | Should address soon | Banner at top of relevant page + sidebar badge count | DB-persisted dismissal | "Petty cash cutoff in 2 hours" |
| **Info** | Awareness only | Alerts page + sidebar badge | DB-persisted dismissal | "Probation ending for Thabo next week" |

### 4.2 Blocker Rules

Blockers are not stored — they are computed from the current state of the data.

| Action | Blocker condition | Message |
|---|---|---|
| Run Payroll | Register incomplete for any day in pay week | "{N} days missing attendance — Capture now →" |
| Mark Week Complete (bank) | Any employees unticked | "{N} employees unresolved" |
| Generate export | No data for selected period | "No payroll data for {month}" |

Blocker UI: inline card directly above or below the action button. Red-amber left border with slow pulse. Contains the message + a link to resolve it.

### 4.3 Warning Rules

| Warning | Shown on | Trigger |
|---|---|---|
| Petty cash cutoff approaching | Petty cash page | Thursday after 14:00 |
| Unsigned payslips | Payroll page, dashboard | Payroll run exists + unsigned count > 0 |
| Payroll not yet run | Dashboard | Friday + no payroll run for current week |
| Missing banking details | Payroll bank page | Employee has no bank account on file |

Warning UI: coloured banner at top of relevant page. Dismissable. Dismiss persisted to `alert_dismissals` table (user_id, alert_key, dismissed_at). Reappears next occurrence.

### 4.4 Info Alerts

Existing alert types (probation ending, EIF missing, birthday, etc.) remain. Changes:
- Persist dismissals to DB instead of localStorage
- Owner sees all alerts across all roles
- Other roles see only alerts relevant to their permissions
- Empty state: "All clear this week" with green check icon

### 4.5 Eliminated Patterns

| Old pattern | Replacement |
|---|---|
| `window.confirm()` | Styled confirmation modal (centre on desktop, bottom sheet on mobile) |
| `window.alert()` | Toast notification |
| `console.error` (silent failure) | Red error toast with actionable message |
| localStorage alert dismissal | DB table `alert_dismissals` |
| Hidden disabled buttons | Visible + greyed + tooltip with reason |

---

## 5. Feedback & Confirmation System

### 5.1 Toast Notifications

Every user action gets visible feedback.

| Action result | Toast style | Content pattern |
|---|---|---|
| Success | Green, slide from right | "{What} saved/recorded/completed" |
| Error | Red, slide from right, persists until dismissed | "{What} failed — {why}. {What to do}" |
| Undo available | Blue, slide from right, 10s timer | "{What} saved. [Undo]" |

### 5.2 Confirmation Modals

Replace all `window.confirm()` with styled modals.

| Trigger | Modal content |
|---|---|
| Delete payroll run | "Delete payroll run for week of {date}? This removes all payslips and signatures. [Cancel] [Delete]" |
| Discard draft | "Discard payroll draft? Calculated data will be lost. [Cancel] [Discard]" |
| Delete attendance record | "Remove {name}'s attendance for {date}? [Cancel] [Remove]" |
| Delete HR incident | "Delete this incident? Advice and paperwork will be removed. [Cancel] [Delete]" |
| Change NMW/OT rates | "Changing {setting} from {old} to {new}. Affects all future payroll calculations. [Cancel] [Confirm]" |
| Change user role | "Change {name} from {old role} to {new role}. This changes their system access. [Cancel] [Confirm]" |
| Reset PIN | "Reset {name}'s PIN to temporary PIN? They'll be required to change it on next login. [Cancel] [Reset]" |

Modal UI:
- Desktop: centred, backdrop blur, scale-in animation
- Mobile: bottom sheet, slides up from bottom
- Destructive actions: red confirm button
- Non-destructive: primary colour confirm button

### 5.3 Disabled State Communication

Never hide a button. Show it greyed with a reason.

| Element | Disabled reason format |
|---|---|
| Run Payroll button | Small text below: "Complete register first →" |
| Mark Week Complete | Small text below: "2 employees unresolved" |
| Generate export | Small text below: "Select an employee first" |
| Save Register (attendance_clerk, old date) | Small text below: "Only today and yesterday can be edited" |
| Edit register (after save, non-owner) | Small text below: "Saved — owner can unlock" |

---

## 6. Time & Context Awareness

The system knows the business rhythm and acts on it.

### 6.1 Day-Aware Defaults

| Context | System behaviour |
|---|---|
| Monday–Thursday | Register time_out defaults to 17:00 |
| Friday | Register time_out defaults to 16:00 |
| Sunday | Skip in auto-advance (no work) |
| Saturday (45hr staff) | Present, 08:00–13:00 (ordinary hours, half day) |
| Saturday (40hr staff) | Absent by default (not scheduled — any attendance is OT) |

### 6.2 Business Rhythm Nudges

| Timing | What happens |
|---|---|
| Thursday 14:00+ | Warning banner on petty cash page: "Cutoff at 16:00 today" |
| Friday morning | Bookkeeper home: "Payroll ready to run" (if register complete) |
| Monday morning | attendance_clerk home: fresh week, today's register open |
| Last week of month | Info alert: "Garnishee deductions apply this pay week" |
| After payroll run | Register for that pay week locks for all except owner |

### 6.3 Edit Windows

| Role | Register edit window |
|---|---|
| attendance_clerk | Today + yesterday only |
| owner | Any date (with confirmation prompt for dates > 7 days old) |
| All others | View only |

---

## 7. Empty States

Every dead-end has a next action.

| Page / state | Message | Action |
|---|---|---|
| Print — no payslips | "Payroll hasn't run yet" | "Run payroll →" link to `/payroll` |
| Bank — no payslips | "Payroll hasn't run yet" | "Run payroll →" link to `/payroll` |
| Sign — all signed | "All payslips signed for this week" | "View payroll →" link to `/payroll` |
| Bank — all complete | "Week complete — all payments processed" | Green check, "Next pay run: {date}" |
| Alerts — none | "All clear this week" | Green check icon, no action needed |
| Staff search — no match | "No employees match '{query}'" | "Clear search" button |
| Exports — feature not ready | Remove the button entirely | Don't show buttons for features that don't work |
| Register — no employees | "No active employees found" | "Check staff list →" link to `/staff` |

---

## 8. Palette

Derived from the Pullens logo: charcoal text, SA flag accent. Professional, grounded, not flashy.

### 8.1 Colour Tokens

| Token | Value | Use |
|---|---|---|
| `--primary` | `#1E293B` (charcoal slate) | Sidebar, headers, primary buttons |
| `--primary-hover` | `#334155` | Button hover, active states |
| `--accent` | `#C4A35A` (gold) | Active sidebar item, badges, owner actions, highlights |
| `--accent-hover` | `#B8943E` | Gold button hover |
| `--success` | `#10B981` | Present, saved, complete, ticked |
| `--warning` | `#F59E0B` | Late, unsigned, approaching deadline |
| `--danger` | `#EF4444` | Absent, errors, destructive actions |
| `--info` | `#3B82F6` | Links, info alerts, leave, PH |
| `--background` | `#F8FAFC` | Page background |
| `--card` | `#FFFFFF` | Cards, modals, panels |
| `--muted` | `#64748B` | Secondary text, disabled states, placeholders |
| `--border` | `#E2E8F0` | Card borders, dividers |

### 8.2 Sidebar

- Background: `--primary` (charcoal slate) solid, no gradient
- Text: white
- Active item: `--accent` (gold) left bar + white text on slightly lighter charcoal
- Hover: subtle lighten
- Logo at top, gold "P" favicon maintained

### 8.3 Status Colours (unchanged logic, refined values)

| Status | Background | Text | Border |
|---|---|---|---|
| present | `emerald-50` | `emerald-700` | `emerald-300` |
| late | `amber-50` | `amber-700` | `amber-300` |
| absent | `red-50` | `red-700` | `red-300` |
| leave | `blue-50` | `blue-700` | `blue-300` |
| sick | `purple-50` | `purple-700` | `purple-300` |
| ph | `indigo-50` | `indigo-700` | `indigo-300` |
| short_time | `gray-100` | `gray-600` | `gray-300` |

---

## 9. UI Life — Motion & Micro-interactions

### 9.1 Transitions

| Element | Animation | Duration |
|---|---|---|
| Page load | Cards fade-in-up, staggered | 150ms per card |
| Save success | Green pulse ripple on button, toast slides in | 200ms |
| Status change (register) | Row background crossfades to new status colour | 200ms ease |
| Sidebar active item | Gold accent bar slides to current item | 150ms ease |
| Checkbox tick | Scale-up pop on check | 100ms |
| Button hover | Lift translateY(-2px) + shadow deepens | 150ms |
| Button press | Scale(0.97) | 50ms |
| Toast in | Slide from right | 200ms ease-out |
| Toast out | Fade + slide right | 150ms |
| Modal open | Backdrop fade + modal scale 0.95→1 (desktop) / slide up (mobile) | 200ms |
| Modal close | Reverse of open | 150ms |
| Blocker alert | Subtle left-border pulse (red/amber) | 2s continuous |
| Loading | Skeleton shimmer | Continuous |
| Dashboard numbers | Count-up animation on metrics | 400ms ease-out |
| Progress bars | Width animates on update | 300ms |
| Empty → data | Content fades in, no layout jump | 200ms |
| Validation error | Input field horizontal shake | 200ms, 3 oscillations |

### 9.2 Principles

- Everything that changes state has a transition — nothing pops or jumps
- Skeletons over spinners — pages always show structure while loading
- Fast: nothing over 400ms. Work tool, not marketing site.
- Purposeful: animation communicates state change, not decoration

---

## 10. Native App Feel

### 10.1 Interaction Model

| Pattern | Current (web default) | Target (native feel) |
|---|---|---|
| Navigation | Route change with white flash | Smooth transition, no flash |
| Touch feedback | None | Ripple/highlight on every tappable element |
| Scroll | Stops dead | Momentum scroll, rubber-band at edges (CSS: `-webkit-overflow-scrolling: touch`) |
| Forms | Keyboard covers content | Auto-scroll to keep active field visible |
| Modals | Appear/disappear | Bottom sheet on mobile, centred on desktop |
| Loading | Blank → content | Skeleton shimmer matching exact layout |
| Tab switching | Sidebar click → route load | Bottom tab bar on mobile, instant switch, state preserved |

### 10.2 Mobile Navigation

- **Mobile (< 768px):** Bottom tab bar with 3-5 items based on role. No hamburger menu.
  - attendance_clerk: Register | Alerts
  - cash_clerk: Petty Cash | Alerts
  - signer: Sign | Alerts
  - bookkeeper: Payroll | Register | Alerts
  - supervisor: Dashboard | Staff | Alerts
  - owner: Dashboard | Register | Payroll | Petty Cash | More (overflow menu)
- **Tablet (768-1024px):** Collapsible sidebar, same as current but with icons-only collapsed state
- **Desktop (> 1024px):** Full sidebar with labels

### 10.3 Touch Targets

- Minimum 48px height on all interactive elements
- 44px minimum on secondary actions (already in spec)
- 12px minimum spacing between adjacent touch targets

### 10.4 PWA Configuration

- `manifest.json`: app name "Pullens Admin", theme colour `#1E293B`, background `#F8FAFC`
- Icons: Pullens logo at 192px and 512px
- `display: "standalone"` — opens without browser chrome
- Splash screen: Pullens logo centred on charcoal background
- Service worker: cache static assets, show offline banner when disconnected, queue saves for retry
- "Add to Home Screen" prompt on first login (dismissable, don't nag)

### 10.5 Offline Resilience

- Cache the app shell (layout, sidebar, CSS, JS)
- When offline: show last-loaded data with amber "Offline" banner at top
- Saves queued in IndexedDB, synced when connection returns
- Toast on reconnect: "Back online — {N} changes synced"

---

## 11. Database Changes Required

### 11.1 Role Migration

```sql
-- Update UserRole enum
ALTER TYPE user_role RENAME VALUE 'head_admin' TO 'owner';
ALTER TYPE user_role RENAME VALUE 'head_of_admin' TO 'supervisor';
ALTER TYPE user_role RENAME VALUE 'head_of_sales' TO 'supervisor';
ALTER TYPE user_role RENAME VALUE 'admin' TO 'attendance_clerk';
ALTER TYPE user_role RENAME VALUE 'petty_cash' TO 'cash_clerk';
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'signer';
```

Note: PostgreSQL does not support renaming two values to the same target. Actual migration will need to:
1. Add new enum type with correct values
2. Migrate data
3. Drop old type
4. Rename new type

### 11.2 Alert Dismissals Table

```sql
CREATE TABLE IF NOT EXISTS alert_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  dismissed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, alert_key)
);
```

### 11.3 Login Tracking

No new table needed — use `users.last_login_at` (add column if not exists):

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;
```

---

## 12. Files Affected

### Core changes (permissions, roles, types):
- `src/types/database.ts` — update `UserRole` type
- `src/lib/permissions.ts` — rewrite with new roles + permission matrix
- `src/lib/auth-context.tsx` — role-based home redirect
- `src/app/(dashboard)/layout.tsx` — role-aware sidebar, bottom tab bar on mobile, skeleton loading

### Page-level changes:
- `src/app/login/page.tsx` — dynamic user list from DB, last-user highlight
- `src/app/(dashboard)/register/page.tsx` — smart defaults, edit window, remove bulk buttons
- `src/app/(dashboard)/payroll/page.tsx` — blocker system, confirmation modals
- `src/app/(dashboard)/payroll/sign/page.tsx` — error toasts, progress bar
- `src/app/(dashboard)/payroll/print/page.tsx` — empty state with action
- `src/app/(dashboard)/payroll/bank/page.tsx` — default all ticked, disabled state hints
- `src/app/(dashboard)/petty-cash/page.tsx` — remove default category, required field markers
- `src/app/(dashboard)/hr-advisor/page.tsx` — confirmation modal for delete
- `src/app/(dashboard)/alerts/page.tsx` — DB-persisted dismissals, tier filtering
- `src/app/(dashboard)/exports/page.tsx` — remove non-functional buttons, empty states
- `src/app/(dashboard)/settings/page.tsx` — confirmation modals for dangerous changes
- `src/app/(dashboard)/dashboard/page.tsx` — role-aware content, skeleton loading

### New shared components:
- `src/components/ui/confirmation-modal.tsx` — styled modal (desktop centre / mobile bottom sheet)
- `src/components/ui/blocker-card.tsx` — inline blocker with pulse border
- `src/components/ui/warning-banner.tsx` — dismissable contextual warning
- `src/components/ui/skeleton.tsx` — shimmer skeleton primitives
- `src/components/ui/bottom-tab-bar.tsx` — mobile navigation
- `src/components/ui/ripple.tsx` — touch ripple effect

### Config:
- `public/manifest.json` — PWA manifest
- `src/app/globals.css` — updated palette, animation keyframes
- `next.config.ts` — PWA headers if needed

### Migration:
- `supabase/migrations/00005_role_migration.sql`
- `supabase/migrations/00006_alert_dismissals.sql`

---

## 13. Out of Scope

These are explicitly NOT part of this spec:
- Payroll engine formula changes
- Payslip compliance additions (PAYE ref, YTD)
- Garnishee 25% cap
- Document template engine
- Custom domain
- V12 parity testing
- Supabase RLS migration
- New features not described above
