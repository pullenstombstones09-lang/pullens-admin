@AGENTS.md

# Pullens Admin — Project CLAUDE.md

## What This Is

Internal HR + Payroll + Petty Cash + HR Advisor dashboard for Pullens Tombstones (Amazon Creek Trading (Pty) Ltd). Replaces the old Google Sheets + Apps Script system entirely. Profile-first, tablet-first, compliant by default.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 14+ (App Router), React, TypeScript, Tailwind CSS |
| Database | Supabase (PostgreSQL) — RLS, real-time |
| Auth | Supabase Auth — PIN login, bcrypt hashed |
| Storage | Supabase Storage — photos, PDFs, documents |
| Hosting | Vercel — auto-deploy from GitHub |
| AI | Claude API (claude-sonnet-4-6) — HR Advisor only |
| Icons | lucide-react (SVG only, no emoji) |

## Business Entity

- Legal: Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones
- Reg: 2011/105461/23, COID: 990001280518, UIF: 2573997/9
- 38 employees, 7 admin users (Cheryl added 5 May 2026)

## Locked Decisions

1. Separate from YeboPro — own Supabase org, own repo, own Vercel project
2. PIN auth — 4-digit, bcrypt hashed, force-change on first login
3. Payroll formula — matches V12 spreadsheet exactly
4. Late rules — grace 5min, 08:06-08:15=dock 30, 08:16-09:00=dock 60, 09:01+=actual minutes missed (owner can override)
5. Petty cash cutoff — Thursday 16:00 SAST
6. NMW — R30.23/hr (March 2026)
7. Profile-first UI, Tablet-first (48px touch targets)
8. Pay week = Monday 00:00 → Friday 16:00. Friday after 16:00 = OT, rolls into next week
9. OT only kicks in after 40 hours total for the week
10. Saturday payroll is a separate cash run (type: saturday_cash)
11. Per-employee approval gate before payroll generates (default all approved)
12. Royal blue (#1E40AF) primary + gold (#C4A35A) accent — no charcoal

## Key Infrastructure

| Resource | Value |
|---|---|
| Supabase project ref | `eznppvewksorfoedgzpa` |
| Supabase URL | `https://eznppvewksorfoedgzpa.supabase.co` |
| Supabase org | Separate from YeboPro (Annika created new org) |
| GitHub repo | `https://github.com/pullenstombstones09-lang/pullens-admin` |
| Vercel project | `pullens-admin` on team `pullenstombstones09-langs-projects` |
| Vercel URL | `https://pullens-admin.vercel.app` |
| Anthropic API key | Set in Vercel env vars (sk-ant-api03-8O1...) |
| Local env | `.env.local` has all real keys |

## Status — 6 May 2026 (session complete)

### CURRENT BUILD — main branch, deployed to Vercel

**Session work (6 May):** Register tab redesign, payslip PDF fix, loans in payroll review, Vercel build fix.

**Commits:** 13edc6f, 0998f72

**Register redesign:**
- Two tabs at top: "Day View" (default) | "Week View"
- Day View = primary capture tool — date picker, "Mark All Present" button, time entry, status dropdowns, auto-late/OT calc, save
- Week View = read-only at-a-glance — colour blocks with text (green+times=present, amber+time/-min=late, red+ABS=absent, blue+SICK/LEAVE, purple+PH, grey+ST, OT badge)
- No tick/cross SVG icons, no clear day, no clear all on week view
- Tap any cell in week view → switches to Day View for that employee + that day
- Mark All Present stamps all active employees with standard times (skips leave/sick/PH)
- Removed dead code: quickToggle, clearDay, clearAll from WeekGrid

**Payslip PDF hourly rate fix:**
- Bug: hourly rate was hardcoded as `weekly_wage / 40` — wrong for 45hr staff
- Fix: now uses `weekly_wage / weekly_hours` across all 3 PDF generators
- Added `weekly_hours` to PayslipPdfData interface
- Both `/api/pdf/payslip` and `/api/pdf/payslips-all` now fetch actual `weekly_wage` + `weekly_hours` from employee record

**Loans column in Payroll Review:**
- New "Loans" column between Gross and Deduct in the review grid
- Shows loan deduction amount per employee (amber text)
- Tap amount → popover showing all active loans with purpose, outstanding balance, editable weekly deduction
- Save updates loan in Supabase and instantly recalculates that employee's payroll
- Totals row includes loans total
- Loans tab on staff profile remains the full record (create, history, close)

**Vercel build fix:**
- 6 API routes had module-level `createClient()` calls — fails during Vercel's page data collection step
- Moved all `createClient()` inside route handler functions: change-pin, upload-photo, upload-file, seed-loans, seed-employees, migrate-weekly-hours

**Prior session work (5-6 May) — already on main:**
- Per-employee approval gate, Saturday cash payroll, individual payslip recalc
- Friday 16:00 cutoff, OT only after 40hrs
- Payslip viewer slide panel, anomaly detection
- Day-aware dashboard with workflow stepper + Realtime
- Royal blue (#1E40AF) + gold (#C4A35A) theming
- 7 admin users: Annika, Nisha, Veshi, Marlyn, Cheryl, Lee-Ann, Kam

### SQL MIGRATIONS — DONE
- 00001-00004: original schema (done 29 April)
- 00005: payroll_batch + payroll_type (run 5 May via Supabase SQL Editor)

### KNOWN BUGS (parked)
- Client component hydration fails on Vercel (login page was server component workaround)
- Seed route creates duplicate user rows on re-run (upsert ID is null when auth user exists)
- Loans/ folder with WhatsApp images is in git — reference photos for loan accounts, leave as-is

### NOT YET DONE
- [ ] **Payslip pay period formatting** — show "Pay Period: Mon 04 May — Fri 08 May 2026" in readable format, not raw date strings
- [ ] **Petty cash overhaul** — daily view, monthly category breakdown, tick-to-square, month-over-month reporting
- [ ] **Monthly reporting** — payroll/attendance/petty cash summaries per month
- [ ] Payslip compliance: add PAYE ref, leave balance, YTD totals (DO NOT TOUCH PAYE CALCULATION)
- [ ] Garnishee: add 25% net pay cap per Magistrates' Courts Act s65J
- [ ] Document template engine (filling HR pack Word templates)
- [ ] Thursday 16:00 petty cash cron trigger (Vercel cron)
- [ ] V12 parity testing (parallel run with old spreadsheet)
- [ ] Custom domain (admin.pullens.co.za) — non-blocking
- [ ] Clean up test pages (/test, /test2, /test3) and screenshot PNGs from repo
- [ ] Worktree cleanup — `payroll-workflow-redesign` branch can be deleted after merge confirmed

## File Structure

```
pullens-admin/
├── .env.local                    # Real keys (gitignored)
├── .env.local.example            # Template
├── CLAUDE.md                     # This file
├── supabase/migrations/          # 5 SQL migration files
│   ├── 00001_create_enums_and_extensions.sql
│   ├── 00002_create_core_tables.sql
│   ├── 00003_rls_policies.sql
│   ├── 00004_seed_holidays_and_settings.sql
│   └── 00005_payroll_batch_and_saturday.sql
├── src/
│   ├── proxy.ts                  # Next.js 16 proxy (replaces middleware.ts)
│   ├── app/
│   │   ├── layout.tsx            # Root layout (Inter font, metadata)
│   │   ├── globals.css           # Tailwind v4 + custom vars
│   │   ├── login/page.tsx        # PIN login (rewritten, still buggy)
│   │   ├── change-pin/page.tsx   # Force PIN change
│   │   ├── test/page.tsx         # Debug: server component (works)
│   │   ├── test2/page.tsx        # Debug: client component (works)
│   │   ├── test3/page.tsx        # Debug: useRouter test
│   │   ├── api/
│   │   │   ├── auth/             # login, logout, change-pin routes
│   │   │   ├── payroll/          # run, generate-payslips routes
│   │   │   ├── petty-cash/       # cutoff route
│   │   │   ├── hr-advisor/       # advise route (Claude API)
│   │   │   ├── alerts/           # GET alerts route
│   │   │   ├── exports/          # ccma-case route
│   │   │   ├── pdf/              # payslip, payslips-all, payroll-summary, warning, hearing-notice
│   │   │   ├── cleanup/          # Wipe test data (secret-protected)
│   │   │   └── seed/             # Initial data seed (run once)
│   │   └── (dashboard)/          # Protected routes (AuthProvider)
│   │       ├── layout.tsx        # Sidebar + AuthProvider + ToastProvider
│   │       ├── dashboard/        # Home dashboard
│   │       ├── staff/            # Staff list + [id] profile (8 tabs)
│   │       ├── register/         # Daily attendance + weekly view
│   │       ├── payroll/          # Payroll run + payslip viewer
│   │       ├── petty-cash/       # Cash flows + modals
│   │       ├── hr-advisor/       # AI compliance engine
│   │       ├── alerts/           # 16 notification types
│   │       ├── exports/          # Compliance exports
│   │       └── settings/         # Settings + audit log
│   ├── components/
│   │   ├── ui/                   # card, button, badge, input, toast
│   │   └── alert-badge.tsx       # Sidebar alert counter
│   ├── lib/
│   │   ├── supabase/client.ts    # Browser Supabase client
│   │   ├── supabase/server.ts    # Server Supabase client + service role
│   │   ├── auth-context.tsx      # AuthProvider (dashboard only)
│   │   ├── payroll-engine.ts     # Payroll calculation (exact V12 formula)
│   │   ├── permissions.ts        # 6-role permission matrix
│   │   ├── seed-employees.ts     # 38 employee seed data
│   │   └── utils.ts              # formatCurrency, formatDate, getInitials, etc.
│   └── types/
│       └── database.ts           # TypeScript types for all 23 tables
```

## Supabase MCP Access

The Supabase MCP is authenticated to YeboPro org only. It CANNOT access this project (different org). To run SQL, either:
1. Reconnect MCP to include the Pullens org
2. Use Supabase SQL Editor in the dashboard manually
3. Use the service role key directly via fetch/curl

## Seed Data Notes

- Seed was run successfully via POST /api/seed with secret "pullens-initial-seed-2026"
- All 38 employees imported from _seed_employees.csv
- DOBs derived from SA ID numbers where possible
- Missing: start dates for many employees (left blank per Annika's instruction)
- Missing: banking for PT010, PT012, PT018, PT037, PT038
- Missing: EIFs for PT021, PT022, PT023, PT024, PT031, PT036
- Passport holders: PT013 (Alli Yessa), PT021 (Tumelo Lebofa)
- No ID at all: PT022 (Thabani Ximba), PT031 (Xolani Xolani), PT036 (Philani Rasta)
