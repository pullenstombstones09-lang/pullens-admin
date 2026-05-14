@AGENTS.md

# Pullens Admin — Project CLAUDE.md

## Accounts (check these at session start)
- **Claude Code:** annikas82@gmail.com
- **GitHub:** annika-dev
- **Vercel team:** pullenstombstones09-langs-projects
- **Supabase:** annikas82@gmail.com → Pullens org (eznppvewksorfoedgzpa)

## Skills & Tools
- **Playwright** — webapp testing via `document-skills:webapp-testing` skill
- **Supabase MCP** — note: MCP is authed to YeboPro org only, cannot access Pullens Supabase. Use service role key + REST API instead.
- **Superpowers** — systematic debugging, TDD, code review

## What This Is

Internal HR + Payroll + Petty Cash + HR Advisor dashboard for Pullens Tombstones (Amazon Creek Trading (Pty) Ltd). Replaces the old Google Sheets + Apps Script system entirely. Profile-first, tablet-first, compliant by default.

## Tech Stack

| Layer | Choice |
|---|---|
| Frontend | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 |
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
9. OT only kicks in after 40 hours total for the week (45 for sales staff)
10. Saturday payroll is a separate cash run (type: saturday_cash)
11. Per-employee approval gate before payroll generates (default all approved)
12. Royal blue (#1E40AF) primary + gold (#C4A35A) accent — no charcoal
13. Payroll runs from ONE place only — the Payroll page. Review page is for editing/previewing only.
14. One standard payslip PDF design used everywhere (Print All, Signing, Individual preview)

## Key Infrastructure

| Resource | Value |
|---|---|
| Supabase project ref | `eznppvewksorfoedgzpa` |
| Supabase URL | `https://eznppvewksorfoedgzpa.supabase.co` |
| Supabase org | Separate from YeboPro (Annika created new org) |
| GitHub repo | `https://github.com/annika-dev/pullens-admin` |
| Vercel project | `pullens-admin` on team `pullenstombstones09-langs-projects` |
| Vercel URL | `https://pullens-admin.vercel.app` |
| Anthropic API key | Set in Vercel env vars (sk-ant-api03-8O1...) |
| Local env | `.env.local` has all real keys |
| Duplicate Vercel project | `pullens-admin-i4dp` exists — can be deleted, just wastes build minutes |

## 🔴 URGENT FIX SPEC — 4-8 May Payroll Discrepancies (added 14 May 2026)

**Source of truth for comparison:** `C:\Users\Annika\Downloads\V12_ALLANDALE NEW 4 - 8 MAY.xlsm` (Excel) vs payroll_run `4e62b415-3cc9-44c7-81c9-f44708124c7a` in Supabase (app, status=generated, run_at 2026-05-11). App paid total net **R51,291.71** vs Excel's ~R47,500. The 38 payslips diverge in three systemic ways plus several one-offs. **App was NOT recalculated or modified — payslips remain as generated 11 May.**

### Issue 1 — Overtime hours absent from the app run
Excel logged OT for 8 employees this week; app shows 0 OT for all of them. Either the attendance register never had Friday-after-16:00 / >40h captured, OR the payroll engine isn't pulling OT from the register correctly. Affected employees and their Excel OT hours:

| PT Code | Name | Excel OT hrs |
|---|---|---|
| PT010 | Sibusiso Mdawe | 6.00 |
| PT013 | Alli Yessa | 6.25 |
| PT014 | Enrique Munien | 1.25 |
| PT017 | Cosmos Mkhize | 3.25 |
| PT025 | Sinethemba Kweshube | 6.25 |
| PT030 | Sifiso Ndlela | 7.75 |
| PT033 | David Mtshali | 1.25 |
| PT038 | Nhlanhla "Lucky" Ndlovu | 5.50 |

**To do:** check attendance register for week 4-8 May for these staff. If hours are there, payroll engine OT detection is broken (decision #9: OT after 40h / 45h). If hours are missing, register data entry skipped them.

### Issue 2 — Loan deductions not applied
Excel deducted loans from 13 employees totalling ~R1,800. App applied loans to only 3, and amounts don't match Excel. App-missed loan deductions:

| PT Code | Name | Excel L- (R) |
|---|---|---|
| PT003 | Sipho Mthembu | 30 |
| PT006 | Nkululeko Miya | 200 |
| PT011 | Lindokuhle Khanyile | 100 |
| PT015 | Cherylette Rengan | 100 |
| PT018 | Thabiso Msindo | 150 |
| PT019 | Ayanda Mhlongo | 20 |
| PT023 | Faith Nxele | 200 |
| PT026 | Philani Mkhize | 200 |
| PT031 | Xolani | 100 |
| PT032 | Zandile Mchunu | 100 |
| PT034 | Mlindeni Lamula | 200 |
| PT036 | Philani Rasta | 100 |

App also has its own loans not in Excel: Junior R100, Enrique R75 (Excel had R100). Root cause likely the `loans` table is not populated — Excel loan ledger never migrated into the app.

**To do:** (a) confirm whether loans table is populated for these employees, (b) decide whether the historic Excel loans should be back-loaded or written off, (c) once decided, recalculate the 4-8 May run.

### Issue 3 — 45-hour sales staff: hourly-rate divisor mismatch
**Conflict between locked decisions #9 and what Excel actually does.** Decision #9 says "OT only kicks in after 40 hours total for the week (45 for sales staff)" — app implements rate = weekly_wage ÷ 45 for sales staff. Excel divides by 40 for everyone.

Impact for 4-8 May (sales staff who worked their normal hours):

| PT Code | Name | Wage | App rate (÷45) | Excel rate (÷40) | App paid | Excel paid |
|---|---|---|---|---|---|---|
| PT008 | Marlyn Naidoo | 1451.13 | R32.25/h | R36.28/h | 1284.98 | 1436.62 |
| PT012 | Nicolette David | 1250.00 | R27.78/h | R31.25/h | 1106.88 | 1237.50 |
| PT023 | Faith Nxele | 1210.00 | R26.89/h | R30.25/h | 1071.46 | 1010.00 |
| PT024 | Gugu Cele | 1210.00 | R26.89/h | R30.25/h | 1071.46 | 1197.90 |
| PT028 | Randhir Singh | 1820.00 | R40.44/h | R45.50/h | 1611.61 | 0 (absent) |
| PT032 | Zandile Mchunu | 1300.00 | R28.89/h | R32.50/h | 1151.15 | 1057.30 |

**Two problems:**
1. **NMW breach** — Nicolette R27.78, Faith/Gugu R26.89, Zandile R28.89 are ALL below national minimum wage R30.23/hr (March 2026, per CLAUDE.md). This is a legal exposure.
2. **Pay drop vs Excel** — sales staff used to Excel amounts will see their take-home drop ~11%.

**Decision needed from Annika before fixing:**
- **Option A:** Keep app's wage÷45 logic and raise sales wages so wage÷45 ≥ NMW (e.g. Nicolette wage needs to be ≥ R1,360 for compliance).
- **Option B:** Change rate logic to wage÷40 for everyone, and the 41st-45th hours are paid as additional hours at ordinary rate (no premium until >45h).
- **Option C:** Change rate logic so sales staff get wage÷40 for first 40h and wage÷40 for hrs 41-45 (still ordinary), OT premium >45h. This matches Excel behaviour and the spirit of decision #9.

### Issue 4 — Specific one-offs to verify
- **Tumelo Lebofa (PT021):** App paid R464.19 for 15.5h. Excel paid R0. Was he at work? Attendance register vs reality.
- **Randhir Singh (PT028):** App paid R1,611.61 for 40.25h. Excel paid R0 (absent). Same question.
- **Lungiswa Mpambane (PT039):** In app, not in Excel. Confirm she's a real employee and Excel just hadn't been updated. Already on parked list — anomaly noted.
- **Aaron (PT001):** Hours diff 37.50 (app) vs 37.25 (Excel). App overpaid R13.71. Trivial, but indicates rounding inconsistency.

### Issue 5 — Hours rounding inconsistency
App rounds attendance to ~5-minute increments (0.083h); Excel rounds to 15-min (0.25h). Decide on a single rule and apply in the register. Recommended: 15-min rounding matches the BCEA late-rule grace bands (decision #4).

### What to do when resuming
1. **Do NOT auto-recalculate the 4-8 May run yet.** Decisions #9 (sales rate divisor) and the loan back-load question both need Annika's call. Recalculating would lock in whichever direction is chosen.
2. Open this section, work top-down: Issue 1 (OT data) → Issue 2 (loans table state) → Issue 3 (sales staff decision) → Issues 4-5 (one-offs + rounding).
3. Once decisions are made, use the existing **Recalculate** button on the Payroll page (it deletes old run + payslips and regenerates). Already built per 7 May session notes.
4. After fix, run a parity test against the V13 spreadsheet for one more week before considering Excel retired.

### Files involved
- Payroll engine: `src/lib/payroll-engine.ts`
- Payroll API: `src/app/api/payroll/run/route.ts`, `src/app/api/payroll/recalculate/route.ts`
- Loans table: schema in `supabase/migrations/00002_create_core_tables.sql`
- Attendance: register page `src/app/(dashboard)/register/`

---

## Status — 11 May 2026 (session complete)

### SESSION WORK (11 May)

**Dev server fix:**
- `npm run dev` was crashing with OOM — fixed by adding `cross-env NODE_OPTIONS=--max-old-space-size=4096` to dev script in `package.json`
- Root cause: stale Node processes accumulating in memory

**PIN login fix:**
- PIN keypad was unresponsive — root cause was inline `<script>` in server component not firing reliably in Next.js 16 + Turbopack
- Rewrote `src/app/login/pin/page.tsx` as a client component with React state + `useSearchParams` wrapped in `<Suspense>`

**Payroll date selector fix:**
- Attendance check was hardcoded to current week — now uses selected `weekStart`/`weekEnd` dates
- Date picker was hidden entirely when no attendance found — now always visible with inline warning below instead
- Owner can now navigate to any past week and run payroll regardless of current week attendance state

**Undo toast fix:**
- `UndoToast` was calling `setUndo(null)` inside a `setElapsed` updater — React setState-in-render warning
- Fixed by moving `onExpire()` call into a separate `useEffect`

**Git remote fix:**
- Remote was authenticating as `yebokhaya` — fixed to `annika-dev@github.com/pullenstombstones09-lang/pullens-admin.git`
- Commits pushed: `5054ec6`, `049ef8a`

---

## Status — 7 May 2026 (session complete)

### CURRENT BUILD — main branch, deployed to Vercel

**Session work (7 May):** Payroll workflow polish, PDF fixes, banking page, payslip redesign, stale data alert, add employee fixes.

**Commits:** 9b93133 through e77ce8d

**Login screen fix:**
- Filtered to 7 admin users only (OS users no longer appear)
- Uses hardcoded ADMIN_NAMES list in `/api/auth/users` route
- OS users (Ali, Faith, Gugu, Sipho, Zandi, Randhir) are in shared Supabase but filtered out

**PDF fixes:**
- Em dash (—) crash in jsPDF fixed — replaced with hyphens in all PDF routes
- Null safety on all payslip fields
- Removed `payment_method` column reference (doesn't exist in DB)
- `createServiceRoleSupabase` now uses `createClient` from `@supabase/supabase-js` (true RLS bypass)

**Payslip PDF redesign (modern):**
- Proportional logo (40x20mm, not stretched)
- Pay period in readable format (Mon 05 May 2026)
- Employee info in clean grey card, two-column grid
- Royal blue table headers, alternating row stripes
- Net pay: white text on blue rounded box
- Employer UIF as italic footnote
- Signature lines at bottom
- One design used in Print All, Signing, and Individual preview

**Payroll workflow redesign:**
- Week calculation fixed: Mon-Fri (was wrong Fri-Thu)
- Workflow steps always visible, always clickable, show green tick when done
- Print step marks as printed on first tap, shows "Tap to reprint" after
- Workflow persists across navigation (loads existing run for current week)
- Removed duplicate "Print All Payslips" button and bottom action row
- Removed "Sign Payslips" from sidebar (accessible from workflow only)
- Tap employee row → opens individual payslip PDF in new tab (replaced checkboxes)
- Dashboard week progress reordered: Reg → Review → Payroll → Print → Bank → Sign

**Banking page fixes:**
- Employees start unticked (Lee-Ann ticks as she processes)
- Cash/EFT badge next to each employee (blue = EFT, amber = Cash)

**Payroll API fixes:**
- All payroll routes switched to `createServiceRoleSupabase` (RLS was blocking)
- Saturday payroll: fixed response key mismatch, added uif_employer, fixed print URL
- PH attendance records get crypto.randomUUID() (was null id crash)
- Register save: new records get crypto.randomUUID()
- Stale data alert: if attendance updated after payroll calculated, orange alert with Recalculate button
- Recalculate deletes old run + payslips, generates fresh — one payroll per week only

**Add Employee fixes:**
- Leave balances: fixed column names (annual_remaining, sick_remaining, family_remaining)
- Staff Type selector: Normal (40hr Mon-Fri) or Sales (45hr Mon-Sat)
- weekly_hours saved to employee on creation
- payment_method column added to DB (ALTER TABLE run manually)

**HR Advisor:**
- Advisor output now displays on employee Disciplinary tab (recommendation, action, legal basis)
- Generated PDF forms + digital signatures still TODO (noted in memory)

**45-hour sales staff:**
- 6 employees set to weekly_hours=45: Marlyn, Nicolette, Randhir, Gugu, Faith, Zandile
- Register already shows Saturday column for 45hr staff
- Saturday attendance (9:00-13:00) must be entered for correct payroll calc

**PWA install banner:**
- Shows once on first login (localStorage dismissed)
- Native install prompt on Android/Chrome, share instructions on iOS
- Manifest start_url changed to /dashboard

**Pullens OS note:**
- Added TODO in OS CLAUDE.md: create separate Supabase project before next build
- OS shares Supabase project with Admin — causes user leakage on login

### SQL MIGRATIONS — DONE
- 00001-00004: original schema (done 29 April)
- 00005: payroll_batch + payroll_type (run 5 May via Supabase SQL Editor)

### KNOWN BUGS (parked)
- Client component hydration fails on Vercel (login page was server component workaround)
- Seed route creates duplicate user rows on re-run (upsert ID is null when auth user exists)
- Loans/ folder with WhatsApp images is in git — reference photos for loan accounts, leave as-is

### NOT YET DONE
- [ ] **HR Advisor forms** — generated warning/hearing PDFs need save to employee profile + digital signature capture (employee + issuer + witness)
- [ ] **Petty cash overhaul** — daily view, monthly category breakdown, tick-to-square, month-over-month reporting
- [ ] **Monthly reporting** — payroll/attendance/petty cash summaries per month
- [ ] Payslip compliance: add leave balance, YTD totals (DO NOT TOUCH PAYE CALCULATION)
- [ ] Garnishee: add 25% net pay cap per Magistrates' Courts Act s65J
- [ ] Document template engine (filling HR pack Word templates)
- [ ] Thursday 16:00 petty cash cron trigger (Vercel cron)
- [ ] V12 parity testing (parallel run with old spreadsheet)
- [ ] Custom domain (admin.pullens.co.za) — non-blocking
- [ ] Clean up test pages (/test, /test2, /test3) and screenshot PNGs from repo
- [x] Worktree cleanup — `payroll-workflow-redesign` branch deleted 14 May 2026 (orphan dir, ref, reflog, config block, remote-tracking ref all removed)
- [ ] Delete duplicate Vercel project `pullens-admin-i4dp`
- [ ] Lungiswa Mpambane anomaly — verify attendance entered for correct week dates (Mon 5 May - Fri 9 May)

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
│   │   ├── login/page.tsx        # PIN login
│   │   ├── change-pin/page.tsx   # Force PIN change
│   │   ├── api/
│   │   │   ├── auth/             # login, logout, change-pin, users routes
│   │   │   ├── payroll/          # run, generate-payslips, saturday, batch, recalculate, bank
│   │   │   ├── petty-cash/       # cutoff route
│   │   │   ├── hr-advisor/       # advise route (Claude API)
│   │   │   ├── alerts/           # GET alerts route
│   │   │   ├── exports/          # ccma-case route
│   │   │   ├── pdf/              # payslip, payslips-all, payroll-summary, warning, hearing-notice
│   │   │   ├── cleanup/          # Wipe test data (secret-protected)
│   │   │   └── seed/             # Initial data seed (run once)
│   │   └── (dashboard)/          # Protected routes (AuthProvider)
│   │       ├── layout.tsx        # Sidebar + AuthProvider + ToastProvider + PWA banner
│   │       ├── dashboard/        # Home dashboard with week progress
│   │       ├── staff/            # Staff list + [id] profile (8 tabs)
│   │       ├── register/         # Daily attendance + weekly view (6 days for 45hr staff)
│   │       ├── payroll/          # Payroll run + workflow steps + print + bank + sign + saturday
│   │       ├── petty-cash/       # Cash flows + modals
│   │       ├── hr-advisor/       # AI compliance engine
│   │       ├── alerts/           # 16 notification types
│   │       ├── exports/          # Compliance exports
│   │       └── settings/         # Settings + audit log
│   ├── components/
│   │   ├── ui/                   # card, button, badge, input, toast, workflow-stepper
│   │   ├── alert-badge.tsx       # Sidebar alert counter
│   │   └── pwa-install-banner.tsx # Add to Home Screen prompt
│   ├── lib/
│   │   ├── supabase/client.ts    # Browser Supabase client
│   │   ├── supabase/server.ts    # Server client + service role (true RLS bypass)
│   │   ├── auth-context.tsx      # AuthProvider (dashboard only)
│   │   ├── payroll-engine.ts     # Payroll calculation (exact V12 formula)
│   │   ├── pdf-generator.ts      # Warning, hearing notice, payslip PDF (modern design)
│   │   ├── pdf-generator-all.ts  # Bulk payslip PDF (multi-page)
│   │   ├── permissions.ts        # 6-role permission matrix + nav items
│   │   ├── seed-employees.ts     # 38 employee seed data
│   │   └── utils.ts              # formatCurrency, formatDate, getInitials, etc.
│   └── types/
│       └── database.ts           # TypeScript types for all 23 tables
```

## Supabase MCP Access

The Supabase MCP is authenticated to YeboPro org only. It CANNOT access this project (different org). To run SQL, use the service role key via curl/fetch against the REST API.

## Seed Data Notes

- Seed was run successfully via POST /api/seed with secret "pullens-initial-seed-2026"
- All 38 employees imported from _seed_employees.csv
- DOBs derived from SA ID numbers where possible
- Missing: start dates for many employees (left blank per Annika's instruction)
- Missing: banking for PT010, PT012, PT018, PT037, PT038
- Missing: EIFs for PT021, PT022, PT023, PT024, PT031, PT036
- Passport holders: PT013 (Alli Yessa), PT021 (Tumelo Lebofa)
- No ID at all: PT022 (Thabani Ximba), PT031 (Xolani Xolani), PT036 (Philani Rasta)
- 45hr sales staff: PT008 (Marlyn), PT012 (Nicolette), PT023 (Faith), PT024 (Gugu), PT028 (Randhir), PT032 (Zandile)
