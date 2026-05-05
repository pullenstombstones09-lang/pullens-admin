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

**Session work (5-6 May):** Major payroll workflow redesign — approval gate, Saturday cash payroll, day-aware dashboard, register overhaul.

**Payroll workflow redesign (20 commits):**
- Per-employee approval gate — all default approved, anomalies auto-flagged, "Run Final Payroll" button
- Saturday cash payroll — separate run type, select workers, generate, sign, print
- Individual payslip recalculation — fix one without scrapping the run
- Friday 16:00 cutoff — OT after 4pm rolls into next week
- OT only after 40 hours total for the week
- Payslip viewer — tap any employee name on any page → slide panel with full breakdown + anomaly flags
- Anomaly detection: late dock, missing time, zero hours, high OT, high deductions, week-on-week pay swing

**Late-coming rules (updated):**
- 08:00-08:05: grace
- 08:06-08:15: dock 30 min
- 08:16-09:00: dock 60 min
- 09:01+: actual minutes missed (no supervisor override, owner can manually edit)

**Dashboard (rewritten):**
- Day-aware — knows what day it is, shows what needs doing
- Pulsing "what's next" indicator on the priority action
- Live counters via Supabase Realtime (attendance + payslips)
- Compact weekly stepper (Reg → Review → Payroll → Sign → Print → Bank)
- Role-gated — each user sees only their actions

**Register (major rework):**
- Weekly grid view (default) — tick/cross per employee per day
- Split tick/cross buttons on empty cells for quick capture
- Tap tick = present (auto-enters standard times), tap cross = absent
- Late/OT/leave/sick/PH show as coloured blocks at a glance
- Clear Day + Clear All buttons
- Day View button switches to daily capture for fine-tuning
- Daily view unchanged — TimePicker, auto-late detection, OT calc

**New payroll pages:**
- `/payroll/review` — per-employee approval with anomaly badges
- `/payroll/saturday` — Saturday cash payroll capture + generate

**Visual refresh:**
- Royal blue (#1E40AF) primary everywhere — killed all charcoal (#1E293B) backgrounds
- Gold (#C4A35A) accent for CTAs and badges
- Favicon: gold P on royal blue (32px + 192px)
- Manifest + themeColor set to #1E40AF
- Removed gradient cards and decorative animations
- Added .btn-gold utility class
- Haptic feedback (Navigator.vibrate) on key actions

**Users:**
- Cheryl added as attendance_clerk (same as Marlyn)
- 7 admin users total: Annika, Nisha, Veshi, Marlyn, Cheryl, Lee-Ann, Kam

**New files:**
- `src/lib/haptics.ts` — vibration feedback utility
- `src/lib/anomalies.ts` — anomaly detection engine
- `src/lib/use-realtime.ts` — Supabase Realtime hook
- `src/components/ui/payslip-viewer.tsx` — global payslip slide panel
- `src/components/ui/anomaly-badge.tsx` — red/amber flag badges
- `src/components/ui/pulse-card.tsx` — animated priority card
- `src/app/api/payroll/batch/route.ts` — approval batch management
- `src/app/api/payroll/recalculate/route.ts` — single payslip recalc
- `src/app/api/payroll/saturday/route.ts` — Saturday cash payroll
- `src/app/(dashboard)/payroll/review/page.tsx` — approval gate page
- `src/app/(dashboard)/payroll/saturday/page.tsx` — Saturday capture page
- `supabase/migrations/00005_payroll_batch_and_saturday.sql` — payroll_batch table + payroll_type enum

### SQL MIGRATIONS — DONE
- 00001-00004: original schema (done 29 April)
- 00005: payroll_batch + payroll_type (run 5 May via Supabase SQL Editor)

### KNOWN BUGS (parked)
- Client component hydration fails on Vercel (login page was server component workaround)
- Seed route creates duplicate user rows on re-run (upsert ID is null when auth user exists)
- Loans/ folder with WhatsApp images is in git — reference photos for loan accounts, leave as-is

### NOT YET DONE
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
