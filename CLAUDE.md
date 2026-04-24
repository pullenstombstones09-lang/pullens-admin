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

## Status — 24 April 2026

### DONE
- [x] Next.js 16 project scaffolded (App Router, TypeScript, Tailwind)
- [x] All dependencies installed (supabase, bcryptjs, date-fns, lucide-react, @anthropic-ai/sdk)
- [x] 4 SQL migrations written and applied (23 tables, 15 enums, RLS policies, triggers)
- [x] 38 employees seeded via /api/seed (all OK)
- [x] 6 users seeded (Annika PIN 4682, others PIN 0000 with force_pin_change)
- [x] Leave balances initialized (38 employees)
- [x] Public holidays 2026-2028 seeded
- [x] Default settings seeded
- [x] Auth system (PIN login, proxy.ts, session management, force PIN change)
- [x] App layout (sidebar nav, dashboard, 7 UI components)
- [x] Staff list + employee profiles (all 8 tabs)
- [x] Daily register (attendance capture + weekly grid view)
- [x] Payroll engine (exact formula from spec) + payroll page + payslip viewer
- [x] Petty cash (cash in/out, slip return, Thursday 16:00 cutoff)
- [x] HR Advisor (Claude API, SA labour law system prompt)
- [x] Alerts (16 notification types)
- [x] Exports (UI-19, EMP201, EMP501, ROE, CCMA case file)
- [x] Settings + audit log viewer
- [x] GitHub repo pushed (all code committed)
- [x] Vercel deployment configured (env vars set)
- [x] Build passes clean (TypeScript, no errors)

### BLOCKING BUG — Login page hangs on Vercel
- The login page HTML renders correctly server-side (confirmed via curl)
- All JS chunks load (200 status, correct content)
- Static server component pages work (/test)
- Basic client components work (/test2 — useState + button click)
- But the login page appears to hang — buttons visible but not interactive
- Login page was rewritten: removed useRouter, removed useCallback, used inline styles
- Still hangs after rewrite
- **Next step to debug:** Check if the Tailwind CSS import in globals.css is causing hydration mismatch. The `@import "tailwindcss"` syntax is Tailwind v4 — verify it's compatible with Next.js 16 Turbopack on Vercel. Try removing globals.css import from the login page or testing with zero CSS.
- **Alternative:** Test with `next dev` locally on Annika's PC to see if it works locally
- **Alternative:** Check browser console (F12) for specific JS errors during hydration
- Test pages to clean up: /test, /test2, /test3

### NOT YET DONE
- [ ] Fix login page hydration issue
- [ ] Verify full login → dashboard flow works end-to-end
- [ ] PDF payslip generation (currently stub — returns success but no actual PDF)
- [ ] Document template engine (filling HR pack Word templates with placeholders)
- [ ] Camera/file upload integration for documents and petty cash slips
- [ ] Supabase Storage bucket setup (photos, payslips, documents, hr_templates)
- [ ] Thursday 16:00 petty cash cron trigger (pg_cron needs Pro, use Vercel cron instead)
- [ ] V12 parity testing (parallel run with old spreadsheet)
- [ ] LibreOffice alternative for .docx→PDF conversion on Vercel (see spec flag #2)
- [ ] Custom domain (admin.pullens.co.za) — non-blocking
- [ ] Clean up test pages (/test, /test2, /test3)

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
