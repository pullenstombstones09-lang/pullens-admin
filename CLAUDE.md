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
- 38 employees, 6 admin users

## Locked Decisions

1. Separate from YeboPro — own Supabase org, own repo, own Vercel project
2. PIN auth — 4-digit, bcrypt hashed, force-change on first login
3. Payroll formula — matches V12 spreadsheet exactly
4. Late rules — grace 5min, 6-30=dock 30, 31-60=dock 60, 60+=supervisor
5. Petty cash cutoff — Thursday 16:00 SAST
6. NMW — R30.23/hr (March 2026)
7. Profile-first UI, Tablet-first (48px touch targets)

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

## Status — 28 April 2026

### SYSTEM OVERHAUL (branch: overhaul/system-ux-v2, 21 commits)

Full UX overhaul completed 2026-04-28. Design spec: `docs/superpowers/specs/2026-04-28-system-overhaul-design.md`. Plan: `docs/superpowers/plans/2026-04-28-system-overhaul.md`.

**Visual refresh:**
- Royal blue palette (#1E40AF primary, #3B82F6 light, #F8FAFC background) — replaces old beige/navy/gold
- Pulsing animations, hover lift on cards, gradient sidebar
- All pages colour-swept (24+ files updated)

**New shared components:**
- `workflow-stepper.tsx` — 5-step weekly cycle (Register→Payroll→Sign→Print→Bank) with API status
- `undo-toast.tsx` — 10-second countdown toast with undo callback, provider + hook
- `time-picker.tsx` — tap-friendly hour/minute grid (replaces native time input)
- `slide-panel.tsx` — right-side slide-out panel for forms
- `progress-ring.tsx` — SVG donut ring for data completeness
- `employee-info-card.tsx` — sectioned employee info with inline edit

**Dashboard:** Rebuilt as "This Week" view — workflow stepper, 4 metric cards (Lark-style), quick action buttons

**Sidebar:** Royal blue gradient, white text, compact stepper at top, UndoProvider wraps all pages

**Register:** TimePicker replaces native inputs, photo upload button (needs storage bucket), undo on save

**Payroll:** Tick boxes per employee, inline loan deduction editing, sticky action bar (Print Selected, Print Summary, View & Sign)

**Payslip viewer:** Employee dropdown nav, signing progress bar, auto-advance after sign, auto-file PDF to employee documents

**Staff profiles:** Employee info card visible to all roles (personal, contact, employment, banking, compliance), inline edit for head_admin, warning banner for missing data notes

**Staff list:** Completeness ring per employee (red/amber/green), sort by data completeness

**Working features (were stubs):**
- New Loan form (slide panel, undo, weeks-to-repay calc)
- Record Leave form (slide panel, creates attendance records, undo)
- CCMA Case File generator (calls /api/exports/ccma-case, opens PDF)

**HR Advisor:** User attribution from cookie, specific error messages (401/400/429), DB save failure warning

**Banking step:** Leeann tick-off API + UI, "Mark Week Complete" button, banked_at column (needs SQL migration)

### NEEDS SQL MIGRATION (run in Supabase SQL Editor)
```sql
INSERT INTO storage.buckets (id, name, public) VALUES ('registers', 'registers', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('documents', 'documents', true) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public) VALUES ('signatures', 'signatures', true) ON CONFLICT (id) DO NOTHING;
ALTER TABLE payslips ADD COLUMN IF NOT EXISTS banked_at timestamptz;
```

### PREVIOUS BUILD (26 April, main branch)
- All original features intact (auth, register, payroll engine, petty cash, HR advisor, alerts, exports, settings)
- 38 employees seeded, 6 users, test data cleared
- Auth: cookie-based, no PIN in cookie, service role key bypasses RLS
- Vercel auto-deploy broken — use `vercel deploy --prod`

### KNOWN BUGS (parked)
- Client component hydration fails on Vercel (login page was server component workaround)
- Seed route creates duplicate user rows on re-run (upsert ID is null when auth user exists)

### NOT YET DONE
- [ ] **Petty cash overhaul** — daily view, monthly category breakdown, tick-to-square, month-over-month
- [ ] **Monthly reporting** — payroll/attendance/petty cash summaries per month
- [ ] Run SQL migration (storage buckets + banked_at) — see above
- [ ] Merge overhaul/system-ux-v2 → main after testing
- [ ] Delete capability on all pages (HR incidents, warnings, loans, notes) — head_admin + confirm
- [ ] Payslip compliance: add PAYE ref, leave balance, YTD totals (DO NOT TOUCH PAYE CALCULATION)
- [ ] Garnishee: add 25% net pay cap per Magistrates' Courts Act s65J
- [ ] Document template engine (filling HR pack Word templates)
- [ ] Thursday 16:00 petty cash cron trigger (Vercel cron)
- [ ] V12 parity testing (parallel run with old spreadsheet)
- [ ] Custom domain (admin.pullens.co.za) — non-blocking
- [ ] Clean up test pages (/test, /test2, /test3) and screenshot PNGs from repo

## File Structure

```
pullens-admin/
├── .env.local                    # Real keys (gitignored)
├── .env.local.example            # Template
├── CLAUDE.md                     # This file
├── supabase/migrations/          # 4 SQL migration files
│   ├── 00001_create_enums_and_extensions.sql
│   ├── 00002_create_core_tables.sql
│   ├── 00003_rls_policies.sql
│   └── 00004_seed_holidays_and_settings.sql
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
