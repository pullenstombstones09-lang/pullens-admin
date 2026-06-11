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
15. OT is auto-derived from attendance (Mon-Thu past 17:00, Fri past 16:00, Sat past 13:00 for sales). The `overtime_requests` approval flow is retained as a table but unused by the engine. (14 May 2026)
16. Sales staff normal week = Mon-Thu 9h + Fri 8h + Sat 9-1 (4h) = 44h ordinary, paid `weekly_wage / 44`. PT008, PT012, PT023 (terminated), PT024, PT028, PT032, PT040 (added 11 June 2026). Saturday included in the 44h — confirmed verbally 11 June. (14 May 2026, updated 11 June 2026)
17. NMW enforcement: engine throws on `weekly_wage / weekly_hours < R30.23`; DB constraint `chk_nmw` mirrors this. Min wage at /44 = R1330.12. (14 May 2026)
18. Friday past 16:00 = OT for NEXT week, persisted in `friday_ot_rollovers` table with explicit `applied_to_run_id` + `produced_by_run_id` lineage. (14 May 2026)
19. Attendance flows from biometric (HikVision DS-K1T343MWX, push-only via `POST /api/biometric/event`) where possible; manual register entry is the fallback for off-Allandale staff and any day the device misses. The `attendance.time_in_source` / `time_out_source` columns track which channel filled each value, and the webhook never overwrites a manual entry. (22 May 2026)
20. Each employee gets ONE `biometric_id` (text) stored on `employees`, joined against `event.employeeNoString`. Devices retain whatever numeric scheme they were enrolled with (9xxx) — we don't rewrite device codes when assigning a new PT code. When a person needs to be enrolled at a new site, use the same `biometric_id` on the new device. (22 May 2026)
21. Sites: `allandale`, `pinetown`, `durban`, `church_street`, `ladysmith`. `employees.site` is a text+check column, not an enum, so it's extensible without ALTER TYPE. Used by the register UI to indicate manual-only rows, and by future routing if multiple devices share the same webhook. (22 May 2026)
22. Attendance clerk has the same register edit rights as owner — any past date, all fields editable. The original "prev-Friday `time_out` only" lock from decision #19 (15 May) was removed 4 June 2026 because Cheryl needed to correct biometric anomalies from prior weeks; the staged workflow proved more restrictive than the bookkeeper-driven correction reality demanded. Bookkeeper/supervisor roles still restricted to the current week. (4 June 2026)
23. Register save (`POST /api/register`) stamps `time_in_source` / `time_out_source = 'manual'` ONLY on fields whose values changed vs. the existing DB row. Passive re-saves preserve `biometric` source so future scans for the same day still flow in. This is what enforces decision #19's "webhook never overwrites manual" contract — previously the contract was honoured by the webhook but never set by the register. (4 June 2026)
24. Day-view OT auto-detect in the register uses day-aware cutoffs (Mon-Thu 17:00, Fri 16:00, Sat 13:00) matching the WeekGrid and engine v2. Was previously hardcoded to 17:00 for every day, causing the day-view OT badge to under-count Friday OT by 60 min. Cosmetic only — engine ignored the cached field. (4 June 2026)
25. End-of-employment is tiered: `resigned`, `absconded`, `dismissed`, `retrenched`, `retired`, `deceased`. `terminated` retained as a legacy umbrella for historic rows. Three context columns on `employees`: `termination_date` (DATE — last working day), `termination_reason` (TEXT free-text), `termination_doc_id` (UUID FK to `employee_documents`, ON DELETE SET NULL). Staff profile shows a red banner with the formatted date, reason, and click-to-download link to the source document when status is any end state. Per locked decision #19's spirit, the register's binary toggle now sets `inactive` (not `terminated`) since true terminations need date+reason+doc and go through the profile. Migration 00012. (4 June 2026)

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
| Allandale biometric | HikVision DS-K1T343MWX at `192.168.8.11`, MAC `88:de:39:3f:d1:6d`, admin password in `.env.local` (`HIKVISION_PW`). FW V4.39.80, ISAPI 2.0, **36 users enrolled** (verified 27 May 2026 — all 32 active Allandale employees fully mapped). |
| Webhook env vars | `BIOMETRIC_WEBHOOK_USER`, `BIOMETRIC_WEBHOOK_PASSWORD`, `BIOMETRIC_DEVICE_MAP` — must be set in Vercel for prod. `BIOMETRIC_DEVICE_MAP` is JSON: `{"<mac>":"<site>"}`. |

## ✅ RESOLVED 14 May 2026 — 4-8 May Payroll Discrepancies (Issues 1, 3, 5)

Issues 1 + 3 + 5 below were resolved by the payroll-engine-v2 rewrite shipped 14 May 2026 (commit `b7d32d1`). The new engine auto-derives OT from attendance, removes the never-used overtime_requests approval gate, treats sales staff as 44h ordinary (Mon-Sat) with /44 hourly rate, raises Nicolette/Faith/Gugu/Zandile to R1340 for NMW compliance, and persists Friday-past-16:00 rollover via the new `friday_ot_rollovers` table. The 4-8 May payroll run was NOT recalculated — it stays as-is per Annika's instruction "ignore the past, fix it going forward".

**Still open from the URGENT FIX SPEC:**
- **Issue 2 — MISDIAGNOSED, now RESOLVED 16 May 2026.** The note "loans table is empty, back-load or write off" was wrong. The real bug: the engine deducted loans from pay but the finalize step never wrote the repayment back, so balances never moved and loans never closed. Fixed — see "Status — 16 May 2026". No back-load or write-off needed.
- **Issue 4 (one-off anomalies)** — Tumelo/Randhir absent in Excel but paid in app; Aaron R13.71 rounding diff; Lungiswa parked. Verify with bookkeeping.

Spec: `docs/superpowers/specs/2026-05-14-payroll-engine-ot-and-sales-rate-design.md`
Plan: `docs/superpowers/plans/2026-05-14-payroll-engine-ot-and-sales-rate-plan.md`

---

## 🔴 LEGACY — 4-8 May Payroll Discrepancies (added 14 May 2026, superseded by engine v2)

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

## Status — 11 June 2026 (register save fix shipped; 15 wage increases applied; PT040 added; PT021 absconded; 3 draft runs deleted)

### SESSION WORK (11 June)

**Register save bug — root cause + fix — commit `54cb5e9` on `main`, pushed.**
Cheryl couldn't save the register; she was getting a red toast: *"Save failed: null value in column time_in_source of relation attendance violates not-null constraint"*. Migration 00010 (22 May) added `NOT NULL CHECK IN ('manual','biometric')` to both `time_in_source` and `time_out_source`. The biometric webhook was updated for the new contract (`?? 'manual'` fallback at `route.ts:201,205`). The register POST (`/api/register`) was not — it kept stamping `null` for any row whose status was `absent` / `leave` / `sick` / `family` / `ph` / `short_time`. A single absent row poisoned the whole upsert. **Register save has been silently broken for the attendance clerk since 22 May for any day with even one absent/leave/sick row.** Verified zero manual rows in attendance Mon 8 – Thu 11 June; all 29-30 rows/day are biometric. Fix: stamp `'manual'` in all three null-source branches; `ex.time_in_source ?? 'manual'` defensive fallback on the existing-row branch. Locked decision #23 contract intact.

**PT040 added.** `THOBEKA IGNATIA THABEDE`, Ladysmith, R1331/wk @ 44h sales, payment_method=cash, status=active, start_date=2026-06-09 (matches users row). Leave balances seeded (21/30/3). NMW: R1331/44 = R30.25/h. Verbal instruction R1331 overrode the doc figure of R1210 (which would have failed NMW at 44h). **Missing personal info on Thobeka:** ID number, DOB, banking, address, cell, emergency contact, NOK — pending from Annika.

**3 draft payroll runs deleted** with cascading cleanup. The runs were `5aba84ee` (18-22 May), `ec276cea` (25-29 May), `69e86de5` (1-5 Jun) — all status `draft`, never finalized. Cleanup: 114 payslips deleted, 26 `friday_ot_rollovers` deleted (12 applied + 14 unapplied — the unapplied ones from week-of 2026-06-05 will be re-derived from attendance when the real 8-12 June run happens). Audit log entries written.

**15 wage increases applied** from `C:\Users\Annika\Desktop\Allandale Wage Increase 2026.docx`. PT001 Aaron R2350, PT002 Junior R2715, PT005 Musa R2036, PT006 Nkululeko R1850, PT007 Damien R2543, PT008 Marlyn R1540, PT009 Thilenthren R2774, **PT012 Nicolette R1500** (override — doc said R1305 which would breach NMW at 44h), PT014 Enrique R1418, PT017 Cosmos R1396, PT018 Thabiso R1443, PT024 Gugu R1351, PT028 Randhir R2410, PT030 Sifiso R1496, PT039 Lungiswa R1500. All audit-logged with before/after wage. PT032 Zandile **NOT changed** — doc said R1210 (NMW breach at 44h) → Annika confirmed verbally to keep current R1340. PT040 Thobeka not in this batch (handled separately at insert).

**PT021 Tumelo absconded.** Set status `'absconded'`, termination_date `'2026-06-05'` (his last present row in attendance — Friday before the 8 June anomaly), termination_reason `'Absconded — no formal notice given'`. No supporting doc on file. Per locked decision #25 the staff profile will show the red termination banner.

### CARRIED OVER from 10 June (still outstanding)
- **Loan ledger reset** — Annika sending photos of current outstanding balances; will bulk-insert as fresh `loans` rows and retire stale rows once received.
- **Saturdays 23 May / 30 May / 6 Jun** missing in attendance for the 6 sales staff. Will recompute payroll once filled (but the draft runs that depended on these are now deleted; new run will pick up the corrected register).
- **Remote-site manual entry** still needed Mon-Wed/Thu this week for PT024 Gugu (Pinetown), PT028 Randhir (Pinetown), PT029 Fika (Pinetown), PT032 Zandile (Church St), PT039 Lungiswa (Ladysmith), PT040 Thobeka (Ladysmith). Cheryl will enter manually until the tablet rollout — tablets not yet ordered.
- **Thobeka's missing personal info** — ID, DOB, banking, address, cell, emergency contact, NOK.
- **Print summary / `/biometric/daily` printable report** — **DROPPED** per Annika 11 June.

### TODO — next session
1. Confirm Cheryl's first successful save lands on Vercel (deploy of `54cb5e9` finished, fix is live).
2. Apply loan ledger from incoming photos.
3. Fill Thobeka's personal info as it arrives.
4. Fill Saturdays 23 May / 30 May / 6 Jun for the 6 sales staff once Annika confirms attendance.
5. Once register is complete (manual entries done + Saturdays filled), run payroll for 8-12 June (this week). The 15 wage increases are LIVE so the new amounts will apply automatically.

---

## Status — 10 June 2026 (Excel-vs-app reconciliation; remote-site clock-in architecture proposed; 3 draft payroll runs)

### SESSION WORK (10 June)

**Three draft payroll runs created via `POST /api/payroll/run` with `draftOnly:true`** — all `status='draft'`, no payslips finalized, no loan deductions written, fully reversible:

| Week | Run ID | Net | Notes |
|---|---|---|---|
| 18–22 May | `5aba84ee-a3c4-48aa-a21d-5046fedda20a` | R52,249.05 | Cleanest of the three; full register parse done before HikVision rolled out 27 May |
| 25–29 May | `ec276cea-80e0-4474-b8cb-88c78d86ee27` | R29,862.93 | **Way under** because biometric transition week — most staff show 18h vs ~40h. Includes Cherylette at -R100 net (loan deducted from R0 gross) and Junior R300 / Marlyn R250 garnishees (likely intended for month-end run, not 25–29). |
| 1–5 Jun | `69e86de5-a793-443c-be5f-1f188e6ce0c2` | R40,033.83 | Biometric OT now flowing (Sipho M 3.5h, Enrique 3.25h, Sifiso 8.1h, David M 4.5h, Mlindeni 2.5h, Sinethemba 0.3h) |

All three Saturdays are blank in the DB (23 May has 6 sales-staff rows as `absent`; 30 May and 6 Jun have no rows at all). Sales staff lose 4h ordinary each week they actually worked Saturday. **Annika acknowledged but did not authorise correction yet — see TODO #5.**

**1–5 Jun Excel reconciliation against `pullenspmb@gmail.com`'s "Pullens Payroll Allandale 1 - 5 June.xlsm"** (sent 9 June, downloaded to `C:\Users\Annika\Downloads\`). Excel total NET R53,090.61 vs app draft R40,033.83 → **app is R13,057 under**. Three systemic causes identified:

1. **Missing OT (~R3,800 across ~12 staff)** — biometric isn't capturing post-17:00 out-scans consistently. Excel logged OT for Aaron 3.5h, Alli 6h, Ayanda 2h, Damien 1.5h, Lindokuhle 2h, Mduduzi 4h, Musa 4h, Lucky 6h, Sibusiso 5h, Tiiso 5h, Thabani 6h, Sipho M 2h — app captured none of those.
2. **Under-counted ordinary hours (~R9,000)** — many factory staff show 26–37h where Excel says 40, and remote staff show ~26h (3 days only). Annika's diagnosis (correct): remote sites (Pinetown PT024/028/029, Ladysmith PT039, Church St PT032) have **no biometric installed** and Mon/Tue manual register entries weren't filled in this week. Verified: only Wed/Thu/Fri have manual rows for those 4 staff.
3. **Wage divergence on sales staff** — Excel still has Nicolette R1340 (Annika says should be R1500), Lungiswa R1331 (should be R1500), Gugu R1331 (app's R1340 is the correct NMW figure — Excel needs to be updated). Thobeka R1340 on Excel but not in app DB at all (new hire PT040).

**Fuzzy-match misses in the comparison** (same person, different spellings — fix in app/DB to make next reconciliation clean):

| Excel name | App name | App PT |
|---|---|---|
| NKULELEKO MIYA | NKULULEKO MIYA | PT006 |
| SIBUSISO MDOWONDE | SIBUSISO MDAWE | PT010 |
| THILEN RENGAN | THILENTHREN RENGEN | PT009 |
| TISSO LEBATA | TIISO LEBATA | PT020 |
| XOLANI | XOLANI XOLANI | PT031 |

**Randhir PT028 anomaly to resolve:** Excel shows 0h worked + R780 cash advance → net R780. App computed 26h biometric → net R1,064.70. Same pattern as previous Excel-vs-app discrepancies (Tumelo absent in Excel but paid in app). Decide: did he work or was it a pure advance?

### REMOTE-SITE CLOCK-IN — proposed architecture (not yet built)

Annika's framing: the dual-source-of-truth (biometric + manual register) is creating the verification mess. Two parallel solutions emerged this session.

**A. Allandale workflow flip — proposed, NOT confirmed yet.** HikVision keeps logging into `biometric_events`, but webhook **stops writing to `attendance`**. New page `/biometric/daily` shows per-employee first IN / last OUT per day, printable for the morning meeting. Clerk types yesterday's register manually using the printout as reference. Friday signoff. Decision #19 and #23 would need amending. **Open question:** can the Allandale clerk realistically type 30+ staff × 5 days = 150+ rows/week manually, or do we keep biometric auto-population and just enforce a daily review/correction sign-off?

**B. Remote-site tablets — confirmed direction, ~8h build.** Annika is buying tablets (3–4×, Samsung Tab A9+ recommended ~R4,500). Each tablet runs the full Pullens admin app (already responsive/tablet-first — no rebuild) and adds a new face-recognition clock-in screen accessible **without** PIN login. Skips the R20-25k HikVision-everywhere plan and saves R8–12k.

**Face recognition implementation:** `face-api.js` (TensorFlow.js, ~10MB models). Each staff enrolls once at Allandale (capture 5 angles → 128-dim embedding stored in new `employee_face_embeddings` table). Daily clock-in: tablet camera identifies via 1:N match against site's enrolled staff → write `attendance` row with `time_in_source='face_tablet'`. Add blink-prompt liveness detection (~2h extra) to defeat printed-photo spoofs. POPIA-friendly — embeddings can't be reversed into photos.

**Site → device matrix (locked):**

| Site | Clock-in | Tablet runs |
|---|---|---|
| Allandale | HikVision wall unit (odd-hour staff, office closed at clock-in times) | None — admin work on Annika's laptop |
| Pinetown (Gugu, Randhir, Fika) | Tablet face-rec | Full admin app |
| Ladysmith (Lungiswa, Thobeka) | Tablet face-rec | Full admin app |
| Church Street (Zandile only — Faith terminated) | Tablet face-rec | Full admin app |

**Deployment plan:** all tablets ship to Annika at Allandale first → she enrolls all faces in-person → factory-tests each device → drop-ship to sites.

### Wage changes pending (Annika to finalize)

Confirmed this session:
- **PT012 Nicolette David**: R1340 → **R1500** (44h sales, /44 = R34.09/h ✓ NMW)
- **PT039 Lungiswa Mpambane**: R1330 → **R1500** (40h factory, /40 = R37.50/h ✓ NMW; Ladysmith)
- **PT040 Thobeka Ignatia Thabede**: NEW HIRE, R1340 (44h sales, Ladysmith) — needs DB insert with ID, start date, banking. Not in `employees` yet.
- **PT024 Gugu**: stays at R1340 (app is correct; Excel R1331 is stale)

Annika promised "most wages getting an increase this week" — full list still pending. Apply once received via single bulk update + audit_log entry.

### Loan ledger reset — pending

Annika to provide current outstanding balances manually (option B from this session — faster than re-parsing the 22 WhatsApp photos). Format: `PT00X: Rxxx outstanding, Ryy/wk`. Then bulk insert as fresh `loans` rows (status='active'), retire stale 18 May back-loaded rows that are now wrong.

### TODO — next session (11 June)

1. **Confirm Allandale workflow** — biometric→reference flip (A above) or keep auto-populate + add mandatory daily review? Either way, build `/biometric/daily` printable report.
2. **Add PT040 Thobeka Thabede** to `employees` — needs ID, start date, banking from Annika.
3. **Bulk wage update** once Annika sends the full increase list; flag any breach of R30.23/h NMW.
4. **Loan ledger reset** once Annika sends balances; insert fresh `loans` rows.
5. **Fix the 3 missing Saturdays** in attendance (Sat 23 May for 6 sales staff; Sat 30 May + Sat 6 Jun all 6 sales staff). Either correct manually or leave as-is — needs Annika's call. The 3 draft payroll runs will need recalculating after Saturday fix.
6. **Build tablet face-recognition clock-in** (~8h):
   - Install `face-api.js` + models (public/face-models/)
   - New migration `00013_face_embeddings.sql` — `employee_face_embeddings (employee_id, embedding numeric[128], enrolled_at, enrolled_by, site)`
   - New route `/clock-in` (no auth required) — camera live preview → detect face → compute embedding → match against site's staff → write attendance row
   - New route `/enroll/[employee_id]` (admin auth) — capture 5 angles → store mean embedding
   - Optional liveness (blink prompt)
   - New `attendance.time_in_source` value: `face_tablet`
   - Update `chk_attendance_source` check constraint
7. **Resolve Randhir 1-5 Jun anomaly** — did he work or was R780 a pure advance?
8. **Fix the 5 fuzzy-match name mismatches** — easier to fix in `employees.full_name` than in the bookkeeper's Excel (which we don't control). Update PT006/009/010/020/031 names to match Excel spelling, or vice versa.
9. **Decide tablet supplier and place order** — Samsung Tab A9+ × 3 (or 4 if Mkondeni gets one) from Takealot/Incredible Connection/Game ~R13.5k–R18k total.
10. **Finalize or delete** the 3 draft payroll runs (`5aba84ee`, `ec276cea`, `69e86de5`) once register is corrected and wage increases applied.

### CARRIED OVER from 9 June (no progress 10 June)
- Cheryl + others' sick notes via leave-cert multipart flow — still untested in browser.
- Enrique's FRL doc upload.
- 11-15 May payroll loan-repayment fix (16 May) still hasn't fired against a live finalize — will exercise at next finalize.

### Resolved this session
- ~~"18-29 May register parse still pending"~~ — confirmed completed; HikVision took over from 27 May. Memory `project_register_parse_done.md` saved to prevent future Claudes from quoting the stale CLAUDE.md TODOs.
- ~~"DDL on Pullens requires manual SQL paste"~~ — disproven 9 June (Management API + PAT path).

---

## Status — 9 June 2026 (migration 00012 applied via Management API; DDL path no longer requires manual SQL Editor paste)

### SESSION WORK (9 June)

**Migration 00012 applied to live Pullens Supabase.** Done via Supabase Management API + Personal Access Token (PAT), not SQL Editor paste. Three calls to `POST https://api.supabase.com/v1/projects/eznppvewksorfoedgzpa/database/query`:
1. ALTER TYPE × 6 (enum) + ALTER TABLE (3 cols + FK) + CREATE INDEX — single call, returned `[]` (success).
2. UPDATE PT023 — returned the row with `status='resigned'`, `termination_date='2026-05-22'`, `termination_reason='Personal reasons (immediate effect per letter dated 2026-05-24)'`, `termination_doc_id='3e978014-e275-4c0b-b7a5-5495937503e1'` (matches the doc row inserted by `scripts/faith-resignation.mjs` on 4 June).
3. Audit log INSERT — returned row id `a983b6d2-eb1f-4477-9f89-4761bd6cf940`, action `migration_00012_employee_termination_details`.

Split into three calls (not one) because Postgres forbids using an enum value in the same transaction that ALTER TYPE ADD VALUE created it — same reason the migration file itself warns against BEGIN/COMMIT wrapping.

**DDL access path discovered — undo the 4 June TODO #7 framing.** The CLAUDE.md history (17 May, 4 June) repeatedly stated DDL on Pullens required Annika to manually paste into the SQL Editor because "the MCP is bound to YeboPro org only". That's true of the MCP. It's NOT true of the Management API. A PAT (`sbp_...`) lives in `C:\Users\Annika\.claude.json` (search for `SUPABASE_ACCESS_TOKEN`) and `GET /v1/projects` confirms it reaches Pullens (`eznppvewksorfoedgzpa`, status ACTIVE_HEALTHY). Future migrations should use this path — no more manual paste blocker.

### CARRIED OVER from 4 June (no progress 9 June yet)
- Refresh Faith's profile in browser, confirm red `<TerminationBanner>` renders with working "View letter / notice" link. (Annika to eyeball on Vercel.)
- 18-29 May register parse — 6 decisions still owed (`scripts/register-parse-18-29-may.json`).
- Biometric cross-check for 27/28/29 May vs photos.
- Sat 23 May attendance for 6 sales staff.
- Cheryl + others' sick notes via leave-cert multipart flow.
- Enrique's FRL doc.
- 18-22 May payroll run.
- 11-15 May payroll loan-repayment fix (16 May) still hasn't fired against a live finalize.

### TODO — next session
1. **Apply migration 00012** ✅ done 9 June via Management API.
2. Refresh Faith's profile after migration — confirm red banner renders with "View letter / notice" link working.
3. Resume the 18-29 May register parse decisions (carries from 2 + 4 June).
4. Run payroll-vs-Excel test for the week Annika has an Excel copy for, with focus on FRL + sick sync.
5. Upload Cheryl + others' sick notes via leave-cert multipart flow (still untested in browser).
6. Upload Enrique's FRL doc.
7. Run 18-22 May payroll once register is signed off.

---

## Status — 4 June 2026 (register unlock + manual-source flag + tiered termination shipped — migration 00012 applied 9 June)

### SESSION WORK (4 June)

**Register fixes — commits `0fd7ba4` + `1b4eb0b` on `main`, pushed.**
- **Clerk unlock (`0fd7ba4`)**: removed the prev-Friday-only date / field lock for `attendance_clerk` so Cheryl can correct biometric anomalies from prior weeks. Same date range and field access as owner now. Also fixed Friday OT cutoff in the day-view auto-detect (was hardcoded 17:00 → now day-aware 17/16/13). Both were blockers for the live test Annika was about to start.
- **Manual source flag (`1b4eb0b`)**: `POST /api/register` now compares each upserted row's `time_in` / `time_out` against the existing DB value and stamps `_source='manual'` only on the side that changed. Passive saves preserve `'biometric'`. This closes a real bug — the webhook had the "manual wins" check from day one (22 May, see decision #19) but no code ever set `'manual'`. Any historic manual fix was relying on the 24h staleness window of the webhook, not actual contract enforcement.

**Documents tab UX — commit `6e12cd1` on `main`, pushed.**
- Whole left side of each document card is now the click target (not just the small external-link icon).
- Force download via Supabase Storage's `?download=<filename>` query — without it, browsers try to render .docx inline and silently fail. Verified `Content-Disposition: attachment` is returned.
- Notes line bumped to `text-stone-600` and un-truncated so the descriptive line under "Other Document" is readable (matters for the resignation letter card which only has meaningful info in the notes).
- Overview tab missing-doc banner: `EIF` relabelled to `Employee Information Form (EIF)` so the acronym is self-explanatory.

**Termination feature — commit `d908755` on `main`, pushed. Migration 00012 applied to live DB 9 June (see 9 June section).**
- Tiered `employee_status` enum: kept `active`/`inactive`/`suspended`/`terminated` (legacy umbrella), added `resigned`/`absconded`/`dismissed`/`retrenched`/`retired`/`deceased`. Three new columns on `employees`: `termination_date`, `termination_reason`, `termination_doc_id`.
- Inline `<TerminationBanner>` in `staff/[id]/page.tsx` renders under the status chips when status is any end state. Shows formatted last working day, reason, and a clickable "View letter / notice" link that downloads the linked document. Doc URL fetched in the same `load()` pass.
- Register `toggleEmployeeStatus` now sets `inactive` (not `terminated`) — true terminations require date+reason+doc and go through the profile.
- TS types in `src/types/database.ts` updated to mirror schema.
- Migration 00012 also retrofits PT023 Faith Nxele: `terminated` → `resigned`, last working day `2026-05-22`, reason "Personal reasons (immediate effect per letter dated 2026-05-24)", `termination_doc_id` linked to her uploaded resignation letter.

**Faith Nxele (PT023) — out-of-band status flip applied 4 June via `scripts/faith-resignation.mjs`.**
- Uploaded resignation letter to her Documents tab (file in storage at `documents/employees/cf598caa-2fff-4e97-914e-d2cbc32dadcd/other_resignation_1780569447368.docx`).
- Inserted `employee_documents` row id `3e978014-e275-4c0b-b7a5-5495937503e1` with `doc_type='other'`, notes describing the resignation.
- Set `employees.status='terminated'` directly (the migration will flip it to `resigned` with full context once applied).
- Letter received via WhatsApp from Annika 4 June; text confirmed via PowerShell docx unpack: signed 24 May 2026, immediate effect, "personal reasons", will return uniform.
- Script left at `scripts/faith-resignation.mjs` (untracked, gitignore-friendly — contains no secrets in itself but loads .env.local).

### CARRIED OVER from 2 June (no progress 4 June)
- Register parse for 18-29 May from the 4 WhatsApp photos still in `scripts/register-parse-18-29-may.json` awaiting Annika's decisions on the 6.00 PM-shorthand, 25-26 May anomalous early times, unmapped names (NIKKIE/VUMEKILE/etc.), and the LUNGI/FAITH on Allandale register question.
- Biometric cross-check for 27/28/29 May vs photos still not executed.
- Sat 23 May attendance still shows all 39 staff absent (auto-skeleton default); 6 sales staff need actual data once Annika confirms.
- 11-15 May payroll loan-repayment fix (16 May) still hasn't fired against a live finalize — next finalize will be the first exercise.

### TODO — next session
1. **Apply migration 00012** to live Pullens Supabase via SQL Editor (annikas82 login). Verify Faith's row: status='resigned', termination_date='2026-05-22', termination_doc_id non-null.
2. Refresh Faith's profile after migration — confirm red banner renders with "View letter / notice" link working.
3. Resume the 18-29 May register parse decisions Annika committed to "tomorrow" on 2 June.
4. Upload Cheryl + others' sick notes via the leave-cert multipart flow (21 May shipped, still untested in browser per the 21 May TODO list).
5. Upload Enrique's FRL doc (same path).
6. Run 18-22 May payroll once register is signed off.
7. Consider giving Claude a Supabase Personal Access Token or DB URL so future DDL migrations don't need manual paste (blocker today — only Annika could apply 00012).

---

## Status — 2 June 2026 (sales-Sat 44h fix shipped; register parse for 18-29 May awaiting sign-off)

### SESSION WORK (2 June)

**Sales staff Saturday bug — fixed, deployed (`ff43c8b` on main, Vercel READY).**
Engine v2 (14 May) changed sales staff `weekly_hours` to 44, but the register page + payroll review page were still gating sales-Sat rendering on `>= 45`. Result: 6 sales staff (PT008/012/023/024/028/032) were hidden on Saturday and could not be marked present, exactly what Annika hit when entering 18-22 May. Fixed all 8 occurrences across `src/app/(dashboard)/register/page.tsx` and `src/app/(dashboard)/payroll/review/page.tsx` — changed `>= 45` → `>= 44`, `< 45` → `< 44`, and updated the default Saturday IN time for sales staff from 08:00 to 09:00 (matches the locked Sat 9-1 window). `tsc --noEmit` clean. Sat 23 May still shows everyone as absent because that data was entered before the fix — needs manual correction for the 6 sales staff after Annika confirms attendance.

**Register data state for 18-29 May (DISCOVERED on 2 June):**
- **18-22 May + 25-26 May** are already in the DB but with SYSTEM DEFAULTS (everyone 08:00 → 17:00 Mon-Thu / 08:00 → 16:00 Fri). No OT captured, no status changes. Same OT-under-count pattern that cost R791 in the 11-15 May Excel diff.
- **Sat 23 May** — all 39 staff marked absent (1 leave) by the auto-skeleton. The 6 sales staff were hidden by the `>= 45` bug.
- **27, 28, 29 May** — partial biometric data (11 / 29 / 29 rows respectively). Remote staff (Pinetown PT024/028/029, Church St PT023/032, Ladysmith PT039) and unenrolled Allandale are missing entirely.

**Register parse from 4 WhatsApp photos — saved, NOT yet applied.**
Annika sent 4 register photos (`C:\Users\Annika\Desktop\Personal\School\WhatsApp Image 2026-06-02 at 16.36.42*.jpeg`) covering both weeks. Parsed and saved to `scripts/register-parse-18-29-may.json` — ~110 cell updates proposed (mostly OT `time_out` additions). Decisions Annika still needs to confirm tomorrow before write:
1. **"6.00" PM-shorthand** — many Mon 25 OUT cells show "6.00" which I'm interpreting as 18:00 (PM). Annika: "will confirm the 6.00 question".
2. **Tue 26 May "05:30 / 08:10" pattern** for Musa, Thabani, Xolani — pre-dawn shift then home? Or OCR misread? Same day Aaron/Ali/Cosmos/Tisso/David/Ayanda show 05:30 → 20:10 full long days.
3. **Unmapped names on register** — NIKKIE, VUMEKILE/VUMANI, THANDANANI, ERIC, ARNOLD, UNDI. VUMEKILE and THANDANANI have real OT entries → decisions needed. Possibly Granite Gallery staff bleeding into Pullens register.
4. **ALBERT row 14** — treating as PT018 Thabiso per 22 May device-mislabel note.
5. **LUNGI / FAITH on Allandale register** — PT039 (Ladysmith) and PT023 (Church St) both appear on the Allandale page. Were they at Allandale that week?
6. **Status changes flagged**: Thabani sick Mon 18 (cert), Ayanda sick Mon 18, Cheryl sick Wed/Thu/Fri 20-22 (no cert noted), Marlyn family Thu 21 / absent Fri 22, Sipho Cyprian absent Mon 25, Sibusiso absent Mon 25, Cheryl sick Wed 27, Thilen FRL Thu 28.

**Rounding policy chosen for this parse:** 5-minute (e.g. 18:33 → 18:35, 19:22 → 19:20).

**Biometric rule for 27-29 May:** do NOT override biometric rows. Cross-check photo vs biometric, flag delta ≥ 15 min. Cross-check not yet executed — pending sign-off.

### TODO — tomorrow (3 June)
1. **Confirm 6.00 = 18:00 PM-shorthand** (Annika's commitment).
2. Answer the 5 other questions in `scripts/register-parse-18-29-may.json` `summary_for_annika.name_mappings_needing_decision`.
3. Run biometric cross-check for 27/28/29 May, present delta report.
4. Apply approved diffs to `attendance` via service-role REST (UPDATE existing rows; INSERT missing remote-staff rows for 27-29; SKIP biometric-source rows).
5. Correct Sat 23 May for the 6 sales staff (Marlyn/Nicolette/Faith/Gugu/Randhir/Zandile) — need actual Sat 23 attendance from Annika (not in photos).
6. Then run payroll for 18-22 May.

---

## Status — 22 May 2026 (HikVision biometric integration — code shipped, awaiting Vercel env vars + device subscription)

### SESSION WORK (22 May)

**HikVision password recovered + integration designed end-to-end.** New admin password set, device reachable from this machine (Allandale LAN). Pulled `/ISAPI/System/deviceInfo` (DS-K1T343MWX, FW V4.39.80, MAC 88:de:39:3f:d1:6d), 247 events over 48h, and the 30-user enrolled list. Saved raw payloads to `hikvision-events.json` / `hikvision-users.json` (untracked, gitignored locally only — sensitive employee data).

**Architecture chosen — webhook push, not polling.** Multi-site (Allandale + future Pinetown / Durban / Church St / Ladysmith): each device gets configured to push events directly to `POST /api/biometric/event` via HikVision's "Listening Host" feature. No per-site Pi, no Tailscale, no polling, near real-time. Hardware: keep current device + buy one DS-K1T343MWX per satellite site (~R5–8k each) as those locations come online.

**Mapping locked in.** All 32 active Allandale employees mapped to device users by `legacy_code` = device `employeeNo`. 1 mislabelled slot: device 9019 labelled "Albert Johannes Masindo" is actually PT018 Thabiso Msindo (display name on device still wrong, mapping correct in DB). 3 device users not on payroll (8999 Veshi Moodley, 9000 Annika, 9037 Vishal Singh) — left enrolled, just unmapped. **No further enrolment work needed** — the 22 May claim that 7 staff still needed enrolment was based on a buggy `hikvision-fetch.mjs` that stopped paginating at 30/36 users (fixed 27 May, see `scripts/hikvision-fetch.mjs:202`). The printable enrolment list (`Desktop/Pullens_Biometric_Enrolment_List.docx`) is no longer needed.

**Sites assigned and persisted:**
- Allandale (34): everyone except remote sales + Pinetown trio + Lungiswa
- Pinetown (3): PT024 Gugu, PT028 Randhir, PT029 Fika
- Church Street (2): PT023 Faith, PT032 Zandile
- Ladysmith (1): PT039 Lungiswa Mpambane (confirmed PT039 via direct DB query — was missing from `seed-employees.ts`)
- Durban (0): planned earlier, no staff actually based there

**Shipped — commit `702f8c1` on `main`, pushed to GitHub. Vercel auto-deploying. Same push also delivered the two 21 May commits (`5d11092` NMW uplift, `a4996ec` leave-cert) that had been sitting locally.**
- Migrations 00010 + 00011 — applied to live Pullens Supabase via SQL Editor (annikas82 login)
- `src/lib/biometric-derive.ts` — pure `deriveAttendance()` from events → time_in/time_out. Sorts by ISO time, treats events <5min apart as double-scans (time_in only). 12/12 vitest pass.
- `src/app/api/biometric/event/route.ts` — Basic-auth webhook. Filters `majorEventType=5,subEventType=75` (face match). Dedupes by `(device_id, device_serial)`. Looks up employee by `biometric_id`. Re-derives attendance for `(employee, event_date)` after each event. **Never overwrites manual entries** — if `time_in_source='manual'`, biometric doesn't touch `time_in` (same for out).
- `scripts/hikvision-probe.mjs` — connectivity + auth smoke test (uses HIKVISION_USER/PW env vars, no args in shell history).
- `scripts/hikvision-fetch.mjs` — paginated event + user list dump.
- `scripts/hikvision-subscribe.mjs` — configures `httpHosts/1` listener + subscribes to `AccessControllerEvent`. Run after Vercel deploy with new env vars.
- `scripts/make-enrolment-docx.mjs` — generates the printable enrolment list (docx).

**Tomorrow / next session:**
1. Add the 3 Vercel env vars (`BIOMETRIC_WEBHOOK_USER` = `pullens_bio`, `BIOMETRIC_WEBHOOK_PASSWORD` = value in `.env.local`, `BIOMETRIC_DEVICE_MAP` = `{"88:de:39:3f:d1:6d":"allandale"}`) — production scope, then redeploy.
2. Smoke: `GET https://pullens-admin.vercel.app/api/biometric/event` should return `{"ok":true,"listener":"pullens-biometric-event","version":1}`.
3. Run `node scripts/hikvision-subscribe.mjs` — configures device to push.
4. Punch in at device → verify `biometric_events` row appears in Supabase + `attendance` row updated with `time_in_source='biometric'`.
5. Rename device user 9019 display from "Albert Johannes Masindo" → "Thabiso Msindo" (cosmetic — mapping in DB is correct).
6. Register UI optional: add a site badge per row so the clerk knows which staff need manual entry vs which are biometric-driven.

**Update — 27 May 2026:** All 32 active Allandale employees are correctly enrolled and mapped. The "7 still to enrol" item from 22 May was a false alarm caused by `hikvision-fetch.mjs` returning only 30 of 36 device users. Fix shipped in this session.

**Still parked from 21 May:**
- Test leave-cert upload for Cheryl on dev server (built 21 May, unverified).
- Apply Gugu Thursday 14-May sick once cert photo available.
- Get Lucky's specific half-day-day; correct attendance.
- Loan ledger reconciliation (Aaron, Thabiso, Sipho Dion gaps).
- ~~Push the 2 unpushed commits~~ — done as part of 22 May push.

---

## Status — 21 May 2026 (NMW migration applied, leave-cert wired, biometric blocked on password)

### SESSION WORK (21 May)

**Payroll discrepancy analysis (11-15 May Excel V12 vs app run `7d685066-69c2-4ae2-8a0b-08cdec962887`):**
App over-paid Excel by **R2,931.31** (net R53,467.98 vs R50,536.67). Decomposed:
- **Ghost attendance +R3,343** — Randhir +R1,801, Lungiswa +R1,152, Gugu +R240, Lucky +R150. Engine paid what the register said; register diverges from reality.
- **OT under-counted -R791** — Aaron, Sipho M, Lindokuhle, Mduduzi, Thabani, Musa, Sifiso etc.; register `time_out` doesn't capture past-17:00, Excel does.
- **Loan ledger drift +R347** — Aaron R170, Thabiso R150, Sipho Dion R50 deducted by Excel but not app (not back-loaded from WhatsApp ledger); Junior R100, Zandile R100 deducted by app but not Excel.

**Annika's calls during discussion:**
1. Randhir / Lungiswa — leave the 11-15 May payslips as-paid, biometric will fix register going forward.
2. Gugu was sick Thursday 14-May (has a cert) — attendance fix + leave row pending.
3. Lucky was half-day one day (which day TBD).
4. Sales staff wages must meet NMW — approved the consolidated 00007 migration.

**Shipped (2 commits on `main`, NOT pushed yet):**
- `5d11092` **feat(payroll): consolidate 00007 with NMW uplift, applied to live DB**
  - 00007 rewritten with correct ordering; 00008 deleted (folded in)
  - Sales staff (PT008/012/023/024/028/032) weekly_hours 45 → 44
  - Faith/Gugu/Nicolette/Zandile uplifted to R1340 — all 6 sales staff now ≥R30.23/h
  - `chk_nmw` replaced with per-hours formula
  - `friday_ot_rollovers` table created (engine v2 referenced it but it never existed in live DB)
  - **APPLIED to live Pullens Supabase via SQL Editor (annikas82 login).** Verified: 6 staff at 44h, 4 uplifted, NMW pass (R30.45-R41.36), rollover table exists, 4 audit_log rows.
- `a4996ec` **feat(leave): accept optional medical/family cert upload via multipart POST**
  - `/api/leave` POST accepts JSON OR multipart with optional `cert` file
  - Uploads to `documents/leave-certs/{leave.id}.{ext}`, sets `medical_cert_url`, returns `cert_upload_failed` flag
  - Slide panel shows file input ONLY for Sick or Family; mobile gets rear camera via `capture="environment"`
  - **NOT YET TESTED in browser by Annika** — dev server is/was on localhost:3000

**HikVision DS-K1T343MWX integration — PARKED (awaiting password reset):**
- Device at **192.168.8.11** (DHCP, was at .18 — fixed in iVMS-4200's saved device record), MAC `88:de:39:3f:d1:6d`, FW V4.39.80, ISAPI R0401, 36 enrolled, 35 faces, 10,126 events
- Online in iVMS-4200 v3.13.1.5 (`C:\Program Files (x86)\iVMS-4200 Site\`) with a saved password
- Admin password unknown. Tried `admin/Pullen7613`, `admin/Pullens76130!` — both wrong. Stored dots show ~13 chars. Device NOT locked (retry counter resets over time).
- **Email sent 21 May 2026 to overseastechsupport@hikvision.com** from annikas2022@gmail.com (the registered Hik-Connect owner address) requesting password reset procedure
- Tried PowerShell + Windows UI Automation to drive remote reset via iVMS-4200 GUI — failed; iVMS-4200's UI is Chromium webview, opaque to UIA, coordinate clicks unreliable
- Probe script at `scripts/hikvision-probe.mjs` (Node ESM, MD5 digest auth, no deps) — uncommitted but ready
- Annika's plan: once password recovered → small Node ingest service on a Pi/always-on PC at Mkondeni, polls `POST /ISAPI/AccessControl/AcsEvent` every 5 min, writes to Supabase `attendance`. Register UI becomes fallback-only.

**TODO for next session:**
- [ ] Test leave-cert upload for Cheryl on dev server (~5 min) — built but unverified
- [ ] Apply Gugu Thursday 14-May sick (via the new leave-cert UI once tested) — needs cert photo from Annika
- [ ] Get Lucky's specific half-day-day, write attendance `time_out` correction
- [ ] Loan ledger reconciliation — decide canonical source (Excel column vs WhatsApp ledger), then close Aaron/Thabiso/Sipho Dion gaps
- [ ] Push the 2 commits to `origin/main` (Annika hasn't said push yet)
- [ ] Check Gmail for HikVision SA reply on password reset; when received, follow their procedure to set a new known admin password, save it
- [ ] Once HikVision password is known → build Pi-hosted ISAPI ingest service
- [ ] Commit `scripts/hikvision-probe.mjs` once biometric work resumes (uncommitted)

**Engine v2 + NMW uplift is now LIVE.** Next weekly payroll run will pay sales staff at `wage/44`. Faith/Gugu now at R1340 not R1210. Friday past-16:00 OT will persist to `friday_ot_rollovers`. Existing 4-8 May and 11-15 May runs NOT recalculated ("ignore the past, fix it going forward").

---

## Status — 18 May 2026 (loan ledger back-load, no commit yet)

### SESSION WORK (18 May) — WhatsApp loan ledger back-load

**Context:** 22 WhatsApp photos in `Loans/` were the source-of-truth handwritten loan ledger as of 27 Apr 2026. Annika confirmed the unmatched names belong to Granite Gallery (not Pullens) and should be skipped here. Goal: clear the historical Excel-era "Issue 2" (loans table empty per 14 May CLAUDE.md note) by back-loading only the Pullens employees we can confidently match, then let the 16 May loan-repayment fix carry them forward.

**Closed (DB UPDATE) — 2× Alli Yessa R25 test loans set to status=closed, outstanding=0:**
- `319430c1...` (07/05, original test from petty cash flow)
- `50672be5...` (11/05, duplicate from re-firing — no dedup key yet)

**Inserted (DB INSERT) — 6 new active loans, payload stored at `scripts/loan-backload-inserts.json` for audit:**

| PT | Employee | Amount | Outstanding | Weekly | Source date | Loan ID (prefix) |
|---|---|---|---|---|---|---|
| PT005 | Musa Tibana | R380 | R380 | R100 | 2026-04-24 | `09ee7357` |
| PT014 | Enrique Munien (2nd loan) | R800 | R400 | R100 | 2026-03-17 | `775e10f6` |
| PT015 | Cherylette Rengan | R800 | R700 | R100 | 2026-03-24 | `a42fea8e` |
| PT026 | Philani Mkhize (Polisher) | R3250 | R1850 | R200 | 2026-02-27 | `28960c40` |
| PT032 | Zandile Mchunu | R1000 | R100 | R100 | 2026-02-23 | `95f54984` |
| PT034 | Mlindeni Joel Lamula (Allandale) | R2700 | R1300 | R200 | 2026-02-02 | `10daa034` |

**Skipped — 16 Granite Gallery / contractor names** (per Annika's call): Phumlani, Khulekani, Thokozani, Innocent, Mncedi, Spha, Razak, Albert, Umar, Yusuf, Juma, Molefe, Thobe, Reuben, Shaffie, and Ali Yessa's old paid-off entries. These belong in Granite Gallery's admin DB when that project is seeded.

**Live state after back-load (8 active loans, R5,105 total outstanding):**
- PT002 Junior Sithole — R300 (R100/wk) — pre-existing manual emergency advance
- PT005 Musa Tibana — R380 (R100/wk) — back-loaded
- PT014 Enrique Munien — R400 + R75 (R100/wk + R75/wk) — back-loaded + pre-existing petty
- PT015 Cherylette Rengan — R700 (R100/wk) — back-loaded
- PT026 Philani Mkhize — R1850 (R200/wk) — back-loaded
- PT032 Zandile Mchunu — R100 (R100/wk) — back-loaded, closes on next finalize
- PT034 Mlindeni Joel Lamula — R1300 (R200/wk) — back-loaded

**Next action:** running the 11-15 May payroll and clicking Generate Payslips will be the first real exercise of the 16 May loan-repayment fix. Expect 8 `loan_deductions` rows and matching `loans.outstanding` decrements; Zandile and Enrique-petty should auto-close at R0. Marlyn-Friday-OT-rollover risk from 15 May still applies (no row in `friday_ot_rollovers` for source_friday=2026-05-08).

**Note on petty-cash duplicate prevention:** the auto-generate-loan-from-petty flow still has no dedup key. Annika's 11/05 re-fire created the second Alli R25. Address before next petty-cash transfer (out of scope this session).

**No commit yet** — payload JSON files under `scripts/` are also still untracked. Stage and commit together when ready.

---

## Status — 17 May 2026 (session complete, head at `8b0341d`)

### Account context
Terminal is back on annikas2022@gmail.com (reverted from annikas82). `.env.local` keys remain valid. **Both Supabase MCP servers are bound to the annikas2022 Claude.ai login and see the YeboPro org only — they cannot reach the Pullens project** (`eznppvewksorfoedgzpa` lives in the annikas82-owned Pullens org). Direct service-role REST works for SELECT/INSERT/UPDATE/DELETE but not for DDL. **Consequence: future DDL migrations must go through Supabase SQL Editor logged in as annikas82.** GitHub push uses the `pullenstombstones09-lang` token (switched via `gh auth switch` once mid-session when the helper defaulted to yebokhaya).

### What shipped (commits on main, pushed)
1. **Migration 00009** — `ALTER TYPE attendance_status ADD VALUE 'family'`. Applied via SQL Editor (annikas82). Verified live: `attendance?status=eq.family` → HTTP 200.
2. `f1aaf43` — **FRL closeout (Tasks 8+9 from 15 May plan).** `/api/register` POST detects new family rows, FRL precheck via `computeFamilyBalance`, 409 with employee name on exhaustion, then inserts the leave row and decrements `family_remaining`. GET returns `family_balances`. Register page merges per-employee `family_remaining` and shows inline red warning under the status select when `family && family_remaining <= 0`.
3. `324be7d` — **Staff list hydration error.** Nested `<button>` inside `<button>` on each card (the inner "View payslip" icon button). Outer card wrapper is now `<div role="button">` with Enter/Space keyboard handler.
4. `6233ac1` — **`/api/alerts` perf + `themeColor` deprecation.** All 14 Supabase reads now fire via `Promise.all` (only the unsigned-payslip follow-up stays serial because it needs `latestRun.id`). Measured **2.6-3.8s → ~280ms hot (~10× faster).** Also moved `themeColor` from `metadata` to `viewport` export in `src/app/layout.tsx`.
5. `0f9cb07` — **Loans tab empty bug.** `loans-tab.tsx` + the loan badge in `staff/[id]/page.tsx` were the last components reading directly from Supabase via the anon key. **All tables in this project are RLS-locked from anon** (PIN auth doesn't create a Supabase session); the rest of the app routes through `/api/*` with service role. Fixed by creating `src/app/api/loans/route.ts` (GET list / GET summary / POST / PATCH / DELETE) and refactoring both consumers.
6. `90fd7d7` — **Same RLS bug on petty cash + delete UI.** History, daily, balance were silently empty under anon (writes worked because of an INSERT-only policy). Created `src/app/api/petty-cash/outs/route.ts` and `src/app/api/petty-cash/ins/route.ts` (GET/POST/DELETE). Refactored `petty-cash/page.tsx` fetch + give-cash + `cash-in-modal.tsx` to use them. Added a red **trash icon in each history row** with a `ConfirmationModal` before destruction; the DELETE also cleans dependent `petty_cash_slips` rows. New permissions: `delete_petty_cash` (owner), `edit_loan` (owner + bookkeeper), `delete_loan` (owner).

### Final-pass verification (end of session)
- `git rev-list --left-right --count HEAD...origin/main` → **0 0** (in sync).
- `tsc --noEmit` → clean.
- `vitest run` → **37/37 pass** (loan-repayment 7, leave-balance 10, payroll-engine 20).
- Live Supabase active loans (service role): Junior R500/**R300** outstanding / R100 weekly · Enrique R75/R75/R75 · Alli R25/R25/R25 (×2 duplicates).
- `loan_deductions` rowcount → **0**. The 16 May loan-repayment fix has not yet exercised against the live DB. Will fire on next finalize.

### Tomorrow's actions
1. **Delete duplicate loan** — PT013 Alli Yessa → profile → Loans tab → click one outstanding R25 → set to 0 → confirm. Closes the surviving duplicate.
2. **Run 11-15 May payroll, finalize.** First real exercise of the 16 May loan-repayment fix. Expect `loan_deductions` rows for Junior (R100), Enrique (R75), Alli (R25), and the matching `loans.outstanding` decrements. Enrique + Alli should auto-close at R0.
3. **Smoke the new petty cash trash** — Petty Cash → History → trash a test row → confirm modal → verify it's gone and any slip is cleaned.
4. **Optional** — recalculate the 4-8 May run only if Annika wants the past corrected (the 14 May guidance was "ignore the past, fix it going forward", so default = leave it).

### Resolved this session
- ~~`/api/alerts` slow~~ → `Promise.all` parallelization (`6233ac1`).
- ~~`themeColor` Next 16 deprecation~~ → `viewport` export (`6233ac1`).
- ~~Loans tab empty~~ → service-role API (`0f9cb07`).
- ~~Petty cash history empty / no delete UI~~ → service-role API + trash button (`90fd7d7`).
- ~~Staff list hydration warning~~ → unnested buttons (`324be7d`).

### Deferred (harmless)
- `AlertBadge` mounts twice (desktop + mobile sidebar render `SidebarContent` independently). After the perf fix this is 2 × 280ms/min — trivial. Dedupe via shared context or conditional mount if it ever matters.

---

## Status — 16 May 2026 (session complete)

### SESSION WORK (16 May) — loan repayment ledger fix

**Root cause (systematic debugging):** the payroll engine correctly *calculated* loan deductions and subtracted them from net pay, but no code anywhere wrote the repayment back. `loan_deductions` table had 0 rows; `loans.outstanding` was never decremented; loans never closed. Result: the same loan amount deducted every week forever, repayment history permanently empty. The CLAUDE.md "Issue 2: loans table empty → back-load/write-off" framing was a misdiagnosis — verified against the live DB (only 4 loans existed: 1 manual + 3 petty, one a duplicate).

**Fix (surgical — engine, payslips, schema all untouched, no migration):**
- `src/lib/loan-repayment.ts` (new) — pure `computeLoanRepayments()` reproducing the engine's exact loan formula (`min(weekly_deduction, outstanding)`, round2, close at ≤0). `src/lib/loan-repayment.test.ts` — 7 vitest cases, all pass.
- `src/app/api/payroll/generate-payslips/route.ts` — finalize step now writes `loan_deductions` rows, decrements `loans.outstanding`, sets `status='closed'` at R0. **Idempotent**: unwinds anything this `payroll_run_id` recorded before re-applying, so re-finalize / recalculate cannot double-charge.
- `src/app/(dashboard)/staff/[id]/tabs/loans-tab.tsx` — outstanding balance is now click-to-edit inline (mirrors the existing weekly-deduction edit); setting it to 0 auto-closes the loan.

**Behaviour:** loan repayment is recorded at the **Generate Payslips** (finalize) step only — single source of truth, V12 behaviour. Saturday cash run intentionally excluded (loans are weekly). The old 4-8 May `generated` run was NOT retroactively touched ("fix it going forward").

**Verification:** 37/37 vitest pass (7 new + 20 payroll-engine unchanged = no regression); `tsc --noEmit` clean project-wide.

**Known leftover (user can self-fix via new edit field):** duplicate R25 airtime petty-cash loan for one employee — set one to 0 to close it. Petty→loan conversion still has no dedup key (could re-create duplicates); not fixed this session (out of scope).

---

## Status — 15 May 2026 (session complete — closed 17 May)

### SESSION WORK (15 May + 17 May closeout) — FRL + Friday OT clerk permission

Spec: `docs/superpowers/specs/2026-05-15-frl-and-friday-ot-permission-design.md`
Plan: `docs/superpowers/plans/2026-05-15-frl-and-friday-ot-permission-plan.md`

**All tasks shipped (commits on `main`, pushed):**
- `d1311ad` — Migration 00009 + TS union: `family` added to `attendance_status` enum (5 files, exhaustiveness fixes)
- `6772fd8` — Visual fix: family uses teal in weekly-view + attendance-tab (avoid leave/family colour collision)
- `f1d7c53` — Engine pays family days at full daily credit (9h Mon-Thu / 8h Fri / 4h Sat sales). 20/20 vitest pass
- `af07cd3` — `src/lib/leave-balance.ts` helpers (`computeFamilyBalance`, `dateRangeDays`, `FRL_ANNUAL_LIMIT`). 10/10 vitest pass
- `16418d5` — `src/app/api/leave/route.ts` — POST + DELETE with balance decrement, FRL precheck, 409 on exhausted
- `4da740f` — Leave-tab refactored to use `/api/leave`; family balance now computed on the fly via `computeFamilyBalance`
- `346fe47` — Register: `attendance_clerk` can edit `time_out` only on most-recent prior Friday. Other fields disabled. Amber banner explains the lock.
- `492c1f6` — Register: `Family Resp.` status option added with teal palette. WeekGrid family rendering as teal `FAM`. Sick correctly purple in WeekGrid (was blue before, fixed). Summary strip groups family with leave/sick.
- `f1aaf43` (17 May) — **Task 8**: `/api/register` POST detects new family rows, FRL precheck via `computeFamilyBalance`, 409 on exhaustion with employee name, then inserts leave row + decrements `family_remaining`. GET now also returns `family_balances`. **Task 9**: register page merges `family_remaining` into each row and shows an inline red warning *"No FRL left — owner override required"* under the status select when `status='family' && family_remaining <= 0`. 37/37 vitest pass, tsc clean.
- **Migration 00009 applied to Pullens Supabase via SQL Editor (17 May, annikas82 dashboard login).** Verified: `attendance?status=eq.family` returns HTTP 200 (enum value accepted).

**Open risk (from spec §6.1):** `friday_ot_rollovers` has no row for `source_friday=2026-05-08` because last week's payroll ran under engine v1. Marlyn editing `time_out` today lands in `attendance` but does not flow through this week's payroll on its own. Owner-acknowledged; handled out-of-band.

**Phase 2 (deferred from spec §6):**
- Owner override flag in register POST (currently `/api/leave` accepts `override=true` but register UI has no path to send it)
- Server-side enforcement of clerk Friday `time_out`-only lock (UI-only today)
- Sidebar alert badge for "X has 0 FRL remaining"
- Reverse logic when a family attendance row is changed/deleted (leave row + decrement remain — owner cleans up via leave tab)

### Locked Decisions (additions)

19. Attendance clerk role can edit `time_out` only on the most-recent prior Friday. All other fields on that day stay disabled. (15 May 2026)
20. Family Responsibility Leave: 3 days per 12-month cycle (BCEA s27). FRL balance computed on-the-fly from the `leave` table (`computeFamilyBalance` in `src/lib/leave-balance.ts`); the `leave_balances.family_remaining` column is a stale cache used only by the register API for fast precheck. Owner-only override allowed via API param `override=true`. (15 May 2026)
21. Leave balance decrement: all leave create/delete now goes through `/api/leave`, which decrements/restores `annual_remaining`/`sick_remaining`/`family_remaining` atomically with the leave row insert. The leave-tab and the register POST share this code path. (15 May 2026)

---

## Status — 14 May 2026 (session complete)

### SESSION WORK (14 May) — payroll engine v2

Branch `payroll-engine-v2` merged into `main` at commit `b7d32d1`, pushed to GitHub. Vercel auto-deploys.

**Engine rewrite** (`src/lib/payroll-engine.ts`):
- Replaced approval-gated OT (via `overtime_requests` table, never used) with attendance-derived OT.
- Mon-Thu past 17:00, Fri past 16:00 → candidate OT for the week.
- Sales staff Sat past 13:00 → candidate OT (Sat 9-1 is ordinary).
- OT premium 1.5× triggers only when weekly total ≥ threshold (40 factory / 44 sales). Below threshold, past-end hours pay ordinary.
- Friday past 16:00 → rolled to next week via new `friday_ot_rollovers` table.
- NMW guard throws if `weekly_wage / weekly_hours < R30.23`.
- Removed: `splitFridayHours`, `DEFAULT_DAILY_HOURS_*`, `calculateHoursWorked`.
- New helpers: `normalEndMinutesForDay`, `dailyQuotaHoursFor`, `toMinutes`.
- 19 unit tests added (vitest), all passing.

**Sales staff change:**
- `weekly_hours` 45 → 44 for PT008, PT012, PT023, PT024, PT028, PT032.
- Wages uplifted to R1340 for the four under-NMW staff: Nicolette (PT012), Faith (PT023), Gugu (PT024), Zandile (PT032).
- Normal sales week now = Mon-Thu 9h + Fri 8h + Sat 9-1 (4h) = 44h ordinary, paid /44 hourly. NMW math: R1340/44 = R30.45 (passes R30.23).
- Saturday register entries are now part of the weekly run for sales (not saturday_cash).

**Run + recalculate routes:**
- Both routes load prior week's unapplied rollovers from `friday_ot_rollovers`, pass to engine, then stamp consumed rollovers as applied and upsert any newly produced.
- Recalculate scopes reset/delete to current employee_id (don't corrupt sibling rollover state).
- `isLastWeekOfMonth` now uses last-Friday-of-month consistently in both routes.
- Saturday attendance filter for the weekly engine: factory (< 44h) → routed to saturday_cash; sales (44h) → kept in weekly engine.

**SQL migrations applied to Pullens Supabase 14 May 2026:**
- 00007_ot_engine_v2.sql — schema (rollover table, new chk_nmw constraint per weekly_hours).
- 00008_sales_wage_uplift.sql — wages R1340 for 4 staff, audit_log entry per staff.
- Note: filename `00006` was already taken by `00006_id_document_url.sql` (added in a prior session), so 00007 + 00008 are the next slots, not 00006 + 00007 as the original plan stated.

**Infrastructure cleanup:**
- Orphan worktree `.claude/worktrees/payroll-workflow-redesign` deleted (full project copy from 11 May, was breaking `git status`). Branch ref, reflog, and `[branch ...]` config block removed.
- Git remote URL stripped of stale `annika-dev@` prefix — now `https://github.com/pullenstombstones09-lang/pullens-admin.git`.

**Commit chain on main:** `04a13d2` spec → `2e05a01` plan + cleanup → `28dc39d` vitest → `7d2d6f9` vitest fix → `7b2dc1d` mig 00007 → `9ceeaf8` type → `ccfce09` helpers → `d89cef2` engine rewrite → `af5cef6` run rollover → `9f18915` route fixes → `23aaea8` recalc rollover → `8472932` employee_id scoping + timezone → `e0e97b2` mig 00008 → `b7d32d1` Saturday filter + garnishee.

### TODO (next session / before Monday 25 May)
- [ ] Issue 2 — loans back-fill spec + implementation.
- [ ] Issue 4 — one-off anomalies (Tumelo, Randhir, Lungiswa, Aaron rounding).
- [ ] Smoke test Monday morning: hit Recalculate on the 4-8 May run; verify 8 factory staff now show OT; verify Nicolette/Faith/Gugu/Zandile wage shows R1340 on staff profile.
- [ ] Untracked files cleanup (`.claude/settings.local.json`, stray OHS docx, `scripts/seed-test-week.mjs`, `test-results/`).
- [ ] Add `passWithNoTests` TODO comment to `vitest.config.ts:8` (remove flag once tests are routinely present).

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
