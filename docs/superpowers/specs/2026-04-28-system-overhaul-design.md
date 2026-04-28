# Pullens Admin — System Overhaul Design Spec

**Date:** 2026-04-28
**Status:** Draft
**Scope:** Complete UX overhaul, flow fixes, broken feature completion, visual refresh

---

## 1. The Weekly Cycle (Guided Flow)

The entire system serves one repeating cycle. A workflow stepper across the top of every page shows where the week is at:

```
① Register  →  ② Payroll  →  ③ Review & Sign  →  ④ Print & File  →  ⑤ Bank
```

- Each step shows status: grey (not started), blue pulse (active), green check (done)
- Clicking a step navigates to that page
- Dashboard becomes "This Week" view showing the stepper + summary cards for each step
- Resets each Monday automatically (based on payroll week start)

### Step details:

**① Register (Marlyn, daily Mon–Sat)**
- Capture attendance: status, time in, time out
- Option to upload photo of manual paper register (camera or file picker)
- Photo saved to Supabase Storage, linked to that day's register
- Clean table layout — one row per employee, no clutter

**② Payroll (Annika/bookkeeper, end of week)**
- "Run Payroll" calculates from register data
- Shows results table: employee, hours, gross, deductions, net
- Loan amounts visible inline — click to edit weekly deduction amount
- Status: draft → reviewed → approved

**③ Review & Sign (tablet, each employee)**
- Payslip viewer with left/right navigation between employees
- Tick-box list: select which payslips to view/print (select all option)
- Signature capture on tablet (canvas, touch-optimised)
- Alert badge shows count of unsigned payslips
- On sign: payslip PDF auto-saved to employee's documents folder in Supabase Storage

**④ Print & File**
- Print selected payslips (tick boxes from step 3)
- Print individual payslip
- Print payroll summary (for Leeann)
- All PDFs open in new tab for browser print

**⑤ Bank (Leeann)**
- Summary view: employee name + net pay + tick box
- Leeann ticks off as she processes each EFT
- "Mark Week Complete" button when all ticked

---

## 2. Register Page — Clean Up

### Current problems:
- Layout is cramped and untidy
- Native HTML time inputs are small on tablet
- No photo capture for manual registers

### Design:

**Layout:** Clean card-per-section, not one massive table
- Date picker prominent at top
- Summary strip: Present (green), Late (amber), Absent (red), Leave (blue) — big number + label
- Employee rows in a clean table with generous row height (56px min)
- Columns: Name | Status (dropdown) | Time In | Time Out | Late | Notes

**Time picker:** Replace native `<input type="time">` with a tap-friendly time selector
- Two large columns: hours (06–20) and minutes (00, 05, 10, 15... 55)
- Tap to select, not scroll/type
- Opens as a dropdown panel below the input
- Shows selected time in HH:MM format in the field
- Pre-fill 08:00/17:00 for "Mark All Present"

**Photo capture:**
- "Upload Register Photo" button at top of page
- Opens camera (on tablet) or file picker (on desktop)
- Photo saved to Supabase Storage: `registers/{date}/photo.jpg`
- Thumbnail shown next to the date when a photo exists
- This is for reference only — Marlyn still captures data manually into the form

**Undo:** After saving the register, show a 10-second toast: "Register saved. [Undo]" — clicking undo reverts to the previous values. After 10 seconds, it's committed. This replaces the edit-lock for the current session.

---

## 3. Staff Profiles — Show Real Information

### Current problems:
- Overview tab shows attendance snippets and loan balance only
- All employee data buried in head_admin edit modal
- Non-admins can't see anything useful
- Missing data (banking, EIF, start dates) invisible

### Design:

**Profile header (all roles can see):**
- Large avatar (or initials circle) + full name + PT code + occupation
- Status pills: Active/Inactive, Probation, Final Warning, Garnishee
- Quick-info row: Cell | Email | Start Date | Years of Service

**Employee Info card (visible to all roles, editable by head_admin only):**
- Personal: Gender, Race, DOB, ID Number, Home Address
- Contact: Cell, Email, Emergency Name + Phone
- Employment: Start Date, Occupation, Weekly Hours, Weekly Wage, Payment Method
- Banking: Bank Name, Account Number (masked), Branch Code
- Compliance: Tax Number, UIF Ref, EIF on File (yes/no badge)
- Notes: Displayed as a yellow alert banner if notes contain keywords like "missing", "still to capture", "not yet"

**Data completeness indicator:**
- Small progress ring on each employee card in staff list
- Shows % of required fields filled (name, ID, banking, EIF, emergency contact, start date)
- Red ring = <50%, Amber = 50-80%, Green = 80%+
- Staff list sortable/filterable by completeness

**Edit:** Pencil icon on each section (head_admin only). Inline edit, not modal. Save per section.

---

## 4. Working Features (Replace Stubs)

### 4a. New Loan Form
- Opens as a slide-out panel (not modal, not page nav)
- Fields: Amount (R), Purpose (text), Weekly Deduction (R), Date Advanced (auto-today)
- "From petty cash" toggle (links to petty cash record)
- Save creates loan record with status=active, outstanding=amount
- Undo: 10-second toast after creation: "Loan added. [Undo]"

### 4b. Record Leave
- Slide-out panel
- Fields: Leave Type (annual/sick/family/unpaid), Start Date, End Date, Reason
- Shows remaining balance for selected type
- Save creates leave record, updates leave_balances, creates attendance records for the date range
- Undo: 10-second toast

### 4c. CCMA Case File Generator
- Button generates a PDF compilation:
  - Employee details + employment history
  - All warnings (with dates, descriptions, signed status)
  - All incidents (with HR Advisor output)
  - Attendance summary (late count, absent count for last 6 months)
  - Timeline view of progressive discipline
- Uses existing PDF routes, combines into one document
- Opens in new tab for download/print

---

## 5. HR Advisor — Fix & Verify

### Issues to fix:
1. **Model name:** Verify `claude-sonnet-4-6` is valid, update if needed
2. **User attribution:** Extract user from `pullens-user` cookie, save as `advised_by`
3. **Error messages:** Replace vague "Internal server error" with specific messages:
   - "AI service unavailable — try again in a moment"
   - "Could not understand AI response — try rephrasing"
4. **Silent DB failures:** If incident insert fails, show warning toast (advice still shows but warn that it wasn't saved)
5. **Test end-to-end** on deployed Vercel instance

---

## 6. Payroll Flow — Seamless Print & Sign

### Current problems:
- No way to select specific employees for printing
- Signature on tablet may not be accessible from payroll flow
- No auto-filing of signed payslips

### Design:

**Payroll results page (after calculation):**
- Table with tick boxes per employee row
- "Select All" checkbox in header
- Each row: ☐ | Name | PT Code | Hours | Gross | Deductions | Net
- Loan column shows current weekly deduction — click to edit inline (saves to loans table)
- Bottom action bar:
  - "Print Selected Payslips" (only ticked employees)
  - "Print Summary" (always all employees)
  - "View & Sign Payslips" → navigates to payslip viewer with only selected employees

**Payslip viewer (step 3 of weekly flow):**
- Dropdown at top: select employee (filtered to current run)
- Or left/right arrows to navigate
- Payslip details displayed
- Signature canvas below (large, full-width, touch-optimised)
- "Sign & Save" button:
  1. Saves signature image to Supabase Storage
  2. Updates payslip record with signature_url + signed_at
  3. Auto-generates PDF payslip
  4. Saves PDF to employee documents folder: `documents/{employee_id}/payslips/week-{date}.pdf`
  5. Clears unsigned alert
  6. Auto-advances to next unsigned payslip
- Progress bar: "12/38 signed"

---

## 7. Visual Refresh

### Palette:
| Role | Colour | Use |
|------|--------|-----|
| Primary | #1E40AF (Royal Blue) | Headers, active states, primary buttons, stepper |
| Primary Light | #3B82F6 | Hover, secondary, charts |
| Primary Glow | #60A5FA | Pulsing active step, loading states |
| Accent Gold | #C4A35A | Logo accent, highlights, badges |
| Success | #10B981 | Present, signed, complete |
| Warning | #F59E0B | Late, missing, unsigned |
| Danger | #EF4444 | Absent, overdue, errors |
| Background | #F8FAFC | Clean white-blue (replaces beige) |
| Cards | #FFFFFF | White, rounded-xl, layered shadow |
| Text | #1E293B | Slate dark |

### Energy:
- Pulsing blue dot on active workflow step
- fadeInUp on card mount (staggered 100ms per card)
- Gradient blue sidebar + header
- Hover lift on all interactive cards (translateY -2px, shadow boost)
- Donut charts for attendance counts on dashboard
- Big bold metric numbers (32px+) on summary cards
- Employee avatars with coloured status rings
- Pill badges for all statuses (not plain text)
- Smooth transitions on all state changes (200ms ease)

### Sidebar:
- Royal blue gradient background
- White text + icons
- Active page: white pill highlight
- Workflow stepper integrated at top of sidebar
- Pullens logo at top, gold "P" favicon maintained

---

## 8. Undo Philosophy

Not everywhere — only where non-technical users (Marlyn, Leeann) might be scared to act.

**Where undo applies:**
- Register save → 10-second toast with undo (reverts to pre-save state)
- New loan created → 10-second toast with undo (deletes the loan)
- Leave recorded → 10-second toast with undo (deletes the leave + restores balance)
- Attendance record deleted → 10-second toast with undo (re-inserts the record)

**Where undo does NOT apply:**
- Payroll run (recalculate instead)
- Signatures (re-sign instead)
- Employee profile edits (edit again)
- HR Advisor consultations (already logged)

**Implementation:** Soft-delete pattern where relevant (set `deleted_at` timestamp instead of hard delete). Undo re-nullifies `deleted_at`. After 10 seconds, hard delete via setTimeout or keep soft-deleted.

---

## 9. File / Folder Structure for Changes

All changes are within existing files or new components in existing directories:

- `src/app/globals.css` — new colour variables, animations
- `src/components/ui/` — new: `time-picker.tsx`, `workflow-stepper.tsx`, `undo-toast.tsx`
- `src/app/(dashboard)/layout.tsx` — add workflow stepper to sidebar
- `src/app/(dashboard)/dashboard/page.tsx` — rebuild as "This Week" view
- `src/app/(dashboard)/register/page.tsx` — clean up layout, add photo upload, add time picker
- `src/app/(dashboard)/payroll/page.tsx` — add tick boxes, inline loan edit, action bar
- `src/app/(dashboard)/payroll/payslip-viewer/page.tsx` — add dropdown nav, auto-file, progress bar
- `src/app/(dashboard)/staff/[id]/page.tsx` — add info card, inline edit sections
- `src/app/(dashboard)/staff/[id]/tabs/overview-tab.tsx` — rebuild with employee info
- `src/app/(dashboard)/staff/[id]/tabs/loans-tab.tsx` — implement New Loan form
- `src/app/(dashboard)/staff/[id]/tabs/leave-tab.tsx` — implement Record Leave form
- `src/app/(dashboard)/staff/[id]/tabs/disciplinary-tab.tsx` — implement CCMA generator
- `src/app/api/hr-advisor/advise/route.ts` — fix model, attribution, error handling
- `src/app/api/register/route.ts` — add photo upload endpoint
- New: `src/app/api/payroll/bank/route.ts` — banking tick-off endpoint

---

## 10. Prerequisites (Must Do First)

- **Supabase Storage buckets:** Create `registers`, `documents`, `signatures` buckets. Photo upload (section 2) and payslip auto-filing (section 6) depend on this.
- **Verify Anthropic API key works** on Vercel before touching HR Advisor code.

---

## 11. Out of Scope (Not in This Build)

- Custom domain (admin.pullens.co.za)
- Document template engine (Word templates)
- V12 parity testing
- Supabase RLS migration (still using service role key)
- Thursday petty cash cron
- Garnishee 25% cap enforcement
- Payslip compliance additions (PAYE ref, YTD totals)
