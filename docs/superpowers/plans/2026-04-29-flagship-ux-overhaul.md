# Flagship UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Transform Pullens Admin from a functional prototype into a flagship showpiece — smart defaults, role-based architecture, native app feel, polished UI.

**Architecture:** Four phases, each producing deployable software. Phase 1 (foundation) changes roles/permissions/types that everything depends on. Phase 2 (shared components) builds reusable UI primitives. Phase 3 (page-level) applies smart defaults and guardrails to every page. Phase 4 (polish) adds palette, animations, PWA, and mobile nav.

**Tech Stack:** Next.js 14+ (App Router), React, TypeScript, Tailwind CSS, Supabase (PostgreSQL), lucide-react

**Spec:** `docs/superpowers/specs/2026-04-29-flagship-ux-overhaul-design.md`

---

## Phase 1: Foundation (Roles, Permissions, Types)

Everything depends on this. Must be done first.

### Task 1: Update UserRole type

**Files:**
- Modify: `src/types/database.ts`

- [ ] **Step 1: Replace UserRole type**

```typescript
// In src/types/database.ts, replace the existing UserRole type:

// OLD:
// export type UserRole =
//   | 'head_admin'
//   | 'head_of_admin'
//   | 'head_of_sales'
//   | 'admin'
//   | 'bookkeeper'
//   | 'petty_cash';

// NEW:
export type UserRole =
  | 'owner'
  | 'supervisor'
  | 'bookkeeper'
  | 'attendance_clerk'
  | 'cash_clerk'
  | 'signer';
```

- [ ] **Step 2: Run build to find all breakages**

Run: `cd /c/Users/Annika/pullens-admin && npx next build 2>&1 | head -80`

Expected: Multiple type errors across files that reference old role names. Note every file path — these are the files we fix in subsequent tasks.

- [ ] **Step 3: Commit**

```bash
cd /c/Users/Annika/pullens-admin
git add src/types/database.ts
git commit -m "feat: update UserRole type to job-based roles (owner, supervisor, bookkeeper, attendance_clerk, cash_clerk, signer)"
```

---

### Task 2: Rewrite permissions matrix

**Files:**
- Modify: `src/lib/permissions.ts`

- [ ] **Step 1: Replace entire permissions.ts**

```typescript
// src/lib/permissions.ts
import { UserRole } from '@/types/database';

export const PERMISSIONS = {
  // Dashboard
  view_dashboard: ['owner', 'supervisor', 'bookkeeper'],

  // Staff
  view_staff_list: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk'],
  edit_employee: ['owner'],
  view_staff_names: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk'],

  // Register
  view_register: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk'],
  edit_register: ['owner', 'attendance_clerk'],
  override_register: ['owner'],

  // Payroll
  view_payroll: ['owner', 'bookkeeper'],
  run_payroll: ['owner', 'bookkeeper'],
  approve_payroll: ['owner'],
  mark_paid: ['owner', 'bookkeeper'],

  // Payslips
  view_payslips: ['owner', 'bookkeeper'],
  sign_payslips: ['owner', 'signer'],
  print_payslips: ['owner', 'bookkeeper'],
  bank_payroll: ['owner', 'bookkeeper'],

  // Loans
  view_loans: ['owner', 'supervisor', 'bookkeeper'],
  create_loan: ['owner', 'supervisor', 'bookkeeper'],

  // Warnings & disciplinary
  view_warnings: ['owner', 'supervisor'],
  issue_warning: ['owner', 'supervisor'],

  // HR Advisor
  view_hr_advisor: ['owner', 'supervisor'],

  // Petty cash
  view_petty_cash: ['owner', 'supervisor', 'bookkeeper', 'cash_clerk'],
  cash_out: ['owner', 'supervisor', 'bookkeeper', 'cash_clerk'],
  cash_in: ['owner', 'supervisor', 'cash_clerk'],

  // Leave
  view_leave: ['owner', 'supervisor', 'attendance_clerk'],
  record_leave: ['owner', 'supervisor'],

  // Documents
  view_documents: ['owner', 'supervisor', 'attendance_clerk'],
  upload_document: ['owner', 'supervisor'],
  view_medical_certs: ['owner', 'supervisor'],

  // Settings & admin
  view_settings: ['owner'],
  edit_settings: ['owner'],
  view_audit_log: ['owner', 'supervisor'],
  manage_users: ['owner'],

  // Exports
  view_exports: ['owner', 'supervisor', 'bookkeeper'],

  // Alerts
  view_alerts: ['owner', 'supervisor', 'bookkeeper', 'attendance_clerk', 'cash_clerk', 'signer'],

  // Overrides
  final_approve: ['owner'],
  petty_cash_override: ['owner'],
} as const satisfies Record<string, readonly UserRole[]>;

export type Permission = keyof typeof PERMISSIONS;

export function hasPermission(role: UserRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

// Role-based home routes
const HOME_ROUTES: Record<UserRole, string> = {
  owner: '/dashboard',
  supervisor: '/dashboard',
  bookkeeper: '/payroll',
  attendance_clerk: '/register',
  cash_clerk: '/petty-cash',
  signer: '/payroll/sign',
};

export function getHomeRoute(role: UserRole): string {
  return HOME_ROUTES[role];
}

export function getNavItems(role: UserRole) {
  const items: { label: string; href: string; icon: string; permission: Permission }[] = [
    { label: 'Dashboard', href: '/dashboard', icon: 'home', permission: 'view_dashboard' },
    { label: 'Staff', href: '/staff', icon: 'users', permission: 'view_staff_list' },
    { label: 'Register', href: '/register', icon: 'clipboard-check', permission: 'view_register' },
    { label: 'Payroll', href: '/payroll', icon: 'banknotes', permission: 'view_payroll' },
    { label: 'Sign Payslips', href: '/payroll/sign', icon: 'clipboard-check', permission: 'sign_payslips' },
    { label: 'Petty Cash', href: '/petty-cash', icon: 'wallet', permission: 'view_petty_cash' },
    { label: 'HR Advisor', href: '/hr-advisor', icon: 'scale', permission: 'view_hr_advisor' },
    { label: 'Alerts', href: '/alerts', icon: 'bell', permission: 'view_alerts' },
    { label: 'Exports', href: '/exports', icon: 'download', permission: 'view_exports' },
    { label: 'Settings', href: '/settings', icon: 'cog', permission: 'view_settings' },
  ];

  return items.filter((item) => hasPermission(role, item.permission));
}

export function canHandOutCash(role: UserRole): boolean {
  return hasPermission(role, 'cash_out') && role !== 'attendance_clerk';
}
```

- [ ] **Step 2: Run build to verify permissions compiles**

Run: `cd /c/Users/Annika/pullens-admin && npx tsc --noEmit 2>&1 | grep "permissions" | head -20`

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat: rewrite permissions matrix for new role system with home routes"
```

---

### Task 3: Fix all role references across the codebase

**Files:**
- Modify: every file that references old role names (`head_admin`, `head_of_admin`, `head_of_sales`, `admin`, `petty_cash`)

- [ ] **Step 1: Find all files referencing old roles**

Run: `cd /c/Users/Annika/pullens-admin && grep -rn "head_admin\|head_of_admin\|head_of_sales\|'admin'\|petty_cash" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "\.d\.ts"`

- [ ] **Step 2: Replace old role names in each file**

Apply these replacements across all matched files:
- `'head_admin'` → `'owner'`
- `'head_of_admin'` → `'supervisor'`
- `'head_of_sales'` → `'supervisor'`
- `'admin'` (as a role value, not the word "admin" in other contexts) → `'attendance_clerk'`
- `'petty_cash'` (as a role value) → `'cash_clerk'`
- `role === 'head_admin'` → `role === 'owner'`
- `user?.role === 'head_admin'` → `user?.role === 'owner'`
- `.replace(/_/g, " ")` display strings will auto-update since the new names are human-readable

**Be careful:** Don't replace `'admin'` in strings like `"head_admin"` (already handled), route paths, or CSS class names. Only replace when it's used as a role value.

- [ ] **Step 3: Update auth-context.tsx — add home route redirect**

In `src/lib/auth-context.tsx`, find the login success handler and add redirect to role-based home:

```typescript
// After successful login, redirect to role-based home
import { getHomeRoute } from '@/lib/permissions';

// In the login function, after setting user state:
const homeRoute = getHomeRoute(userData.role);
window.location.href = homeRoute;
```

- [ ] **Step 4: Update seed data if it contains old role names**

Check `src/lib/seed-employees.ts` and `src/app/api/seed/route.ts` for hardcoded role values. Update to new names.

- [ ] **Step 5: Run build — should compile clean**

Run: `cd /c/Users/Annika/pullens-admin && npx next build 2>&1 | tail -20`

Expected: Build succeeds with no type errors.

- [ ] **Step 6: Commit**

```bash
git add -u src/
git commit -m "feat: migrate all role references to new system (owner, supervisor, bookkeeper, attendance_clerk, cash_clerk, signer)"
```

---

### Task 4: Database migration for roles

**Files:**
- Create: `supabase/migrations/00005_role_migration.sql`
- Create: `supabase/migrations/00006_alert_dismissals.sql`

- [ ] **Step 1: Write role migration SQL**

```sql
-- supabase/migrations/00005_role_migration.sql
-- Migrate user_role enum from org-chart titles to job-based roles
-- PostgreSQL cannot rename two values to the same target, so we rebuild the enum

BEGIN;

-- 1. Create new enum
CREATE TYPE user_role_new AS ENUM (
  'owner',
  'supervisor',
  'bookkeeper',
  'attendance_clerk',
  'cash_clerk',
  'signer'
);

-- 2. Update users table
ALTER TABLE users
  ALTER COLUMN role DROP DEFAULT,
  ALTER COLUMN role TYPE user_role_new
    USING CASE role::text
      WHEN 'head_admin' THEN 'owner'::user_role_new
      WHEN 'head_of_admin' THEN 'supervisor'::user_role_new
      WHEN 'head_of_sales' THEN 'supervisor'::user_role_new
      WHEN 'admin' THEN 'attendance_clerk'::user_role_new
      WHEN 'bookkeeper' THEN 'bookkeeper'::user_role_new
      WHEN 'petty_cash' THEN 'cash_clerk'::user_role_new
      ELSE 'attendance_clerk'::user_role_new
    END,
  ALTER COLUMN role SET DEFAULT 'attendance_clerk'::user_role_new;

-- 3. Drop old enum, rename new
DROP TYPE IF EXISTS user_role;
ALTER TYPE user_role_new RENAME TO user_role;

-- 4. Add last_login_at for login tracking
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_login_at timestamptz;

COMMIT;
```

- [ ] **Step 2: Write alert dismissals migration**

```sql
-- supabase/migrations/00006_alert_dismissals.sql
-- Persist alert dismissals to DB instead of localStorage

CREATE TABLE IF NOT EXISTS alert_dismissals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES users(id) ON DELETE CASCADE,
  alert_key text NOT NULL,
  dismissed_at timestamptz DEFAULT now(),
  UNIQUE(user_id, alert_key)
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_alert_dismissals_user
  ON alert_dismissals(user_id);
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/00005_role_migration.sql supabase/migrations/00006_alert_dismissals.sql
git commit -m "feat: add SQL migrations for role enum rebuild and alert_dismissals table"
```

**NOTE:** These migrations must be run manually in Supabase SQL Editor before deploying Phase 1 code. Run 00005 first, then 00006.

---

## Phase 2: Shared Components

Reusable UI primitives that pages depend on. Build before touching pages.

### Task 5: Confirmation modal component

**Files:**
- Create: `src/components/ui/confirmation-modal.tsx`

- [ ] **Step 1: Create the confirmation modal**

```typescript
// src/components/ui/confirmation-modal.tsx
'use client'

import { useEffect, useRef, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'
import { Button } from './button'

interface ConfirmationModalProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  variant?: 'danger' | 'default'
  loading?: boolean
  icon?: ReactNode
}

export function ConfirmationModal({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'default',
  loading = false,
  icon,
}: ConfirmationModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null)

  // Close on Escape
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open, onClose])

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] animate-[fadeIn_150ms_ease-out]" />

      {/* Modal — bottom sheet on mobile, centred on desktop */}
      <div className={cn(
        'relative z-10 w-full sm:max-w-[420px] bg-white rounded-t-2xl sm:rounded-2xl',
        'shadow-[0_8px_32px_rgba(0,0,0,0.2)]',
        'p-6 space-y-4',
        // Mobile: slide up. Desktop: scale in.
        'animate-[slideUp_200ms_ease-out] sm:animate-[scaleIn_200ms_ease-out]'
      )}>
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Icon */}
        {icon && (
          <div className={cn(
            'flex h-12 w-12 items-center justify-center rounded-full',
            variant === 'danger' ? 'bg-red-100' : 'bg-blue-100'
          )}>
            {icon}
          </div>
        )}

        {/* Content */}
        <div>
          <h3 className="text-lg font-bold text-[#1E293B]">{title}</h3>
          <p className="mt-1.5 text-sm text-gray-500 leading-relaxed">{description}</p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            size="lg"
            onClick={onClose}
            className="flex-1"
          >
            {cancelLabel}
          </Button>
          <Button
            variant={variant === 'danger' ? 'danger' : 'primary'}
            size="lg"
            loading={loading}
            onClick={onConfirm}
            className="flex-1"
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add slideUp and scaleIn keyframes to globals.css**

In `src/app/globals.css`, add after the existing keyframes:

```css
@keyframes slideUp {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/confirmation-modal.tsx src/app/globals.css
git commit -m "feat: add confirmation modal component (bottom sheet mobile, centred desktop)"
```

---

### Task 6: Blocker card component

**Files:**
- Create: `src/components/ui/blocker-card.tsx`

- [ ] **Step 1: Create the blocker card**

```typescript
// src/components/ui/blocker-card.tsx
'use client'

import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface BlockerCardProps {
  message: string
  actionLabel?: string
  actionHref?: string
  severity?: 'error' | 'warning'
}

export function BlockerCard({
  message,
  actionLabel,
  actionHref,
  severity = 'warning',
}: BlockerCardProps) {
  return (
    <div className={cn(
      'flex items-start gap-3 rounded-xl border-l-4 bg-white px-4 py-3.5',
      'shadow-[0_1px_3px_rgba(0,0,0,0.04)]',
      severity === 'error'
        ? 'border-l-red-500 bg-red-50/50'
        : 'border-l-amber-500 bg-amber-50/50',
      'animate-[blocker-pulse_2s_ease-in-out_infinite]'
    )}>
      <AlertTriangle className={cn(
        'h-5 w-5 shrink-0 mt-0.5',
        severity === 'error' ? 'text-red-500' : 'text-amber-500'
      )} />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#1E293B]">{message}</p>
        {actionLabel && actionHref && (
          <Link
            href={actionHref}
            className={cn(
              'inline-block mt-1 text-sm font-semibold',
              severity === 'error' ? 'text-red-600 hover:text-red-700' : 'text-amber-600 hover:text-amber-700'
            )}
          >
            {actionLabel} &rarr;
          </Link>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add blocker-pulse keyframe to globals.css**

```css
@keyframes blocker-pulse {
  0%, 100% { border-left-color: inherit; }
  50% { border-left-color: transparent; }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/blocker-card.tsx src/app/globals.css
git commit -m "feat: add blocker card component with pulse animation"
```

---

### Task 7: Skeleton shimmer component

**Files:**
- Create: `src/components/ui/skeleton.tsx`

- [ ] **Step 1: Create skeleton primitives**

```typescript
// src/components/ui/skeleton.tsx
import { cn } from '@/lib/utils'

interface SkeletonProps {
  className?: string
}

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn(
      'rounded-lg bg-gray-200 animate-shimmer',
      'bg-[length:200%_100%]',
      'bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200',
      className
    )} />
  )
}

export function SkeletonText({ lines = 3, className }: SkeletonProps & { lines?: number }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton
          key={i}
          className={cn('h-4', i === lines - 1 ? 'w-3/4' : 'w-full')}
        />
      ))}
    </div>
  )
}

export function SkeletonCard({ className }: SkeletonProps) {
  return (
    <div className={cn('rounded-xl bg-white p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04)] space-y-3', className)}>
      <Skeleton className="h-5 w-1/3" />
      <Skeleton className="h-8 w-1/2" />
      <Skeleton className="h-4 w-2/3" />
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4, className }: SkeletonProps & { rows?: number; cols?: number }) {
  return (
    <div className={cn('rounded-xl bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04)] overflow-hidden', className)}>
      {/* Header */}
      <div className="flex gap-4 px-4 py-3 bg-gray-50/80 border-b border-gray-200">
        {Array.from({ length: cols }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {/* Rows */}
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-4 px-4 py-3 border-b border-gray-100">
          {Array.from({ length: cols }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Add shimmer keyframe to globals.css**

```css
@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/skeleton.tsx src/app/globals.css
git commit -m "feat: add skeleton shimmer components (base, text, card, table)"
```

---

### Task 8: Warning banner component

**Files:**
- Create: `src/components/ui/warning-banner.tsx`

- [ ] **Step 1: Create warning banner**

```typescript
// src/components/ui/warning-banner.tsx
'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, Info, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'

interface WarningBannerProps {
  alertKey: string
  userId: string
  message: string
  severity?: 'warning' | 'info'
  dismissable?: boolean
}

const icons = {
  warning: <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />,
  info: <Info className="h-5 w-5 text-blue-500 shrink-0" />,
}

const styles = {
  warning: 'bg-amber-50 border-amber-200',
  info: 'bg-blue-50 border-blue-200',
}

export function WarningBanner({
  alertKey,
  userId,
  message,
  severity = 'warning',
  dismissable = true,
}: WarningBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  async function handleDismiss() {
    setDismissed(true)
    const supabase = createClient()
    await supabase.from('alert_dismissals').upsert(
      { user_id: userId, alert_key: alertKey, dismissed_at: new Date().toISOString() },
      { onConflict: 'user_id,alert_key' }
    )
  }

  if (dismissed) return null

  return (
    <div className={cn(
      'flex items-center gap-3 rounded-xl border px-4 py-3',
      'animate-[fadeIn_200ms_ease-out]',
      styles[severity]
    )}>
      {icons[severity]}
      <p className="flex-1 text-sm font-medium text-[#1E293B]">{message}</p>
      {dismissable && (
        <button
          onClick={handleDismiss}
          className="shrink-0 rounded-lg p-1.5 text-gray-400 hover:text-gray-600 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/warning-banner.tsx
git commit -m "feat: add warning banner component with DB-persisted dismissals"
```

---

### Task 9: Update toast for error persistence

**Files:**
- Modify: `src/components/ui/toast.tsx`

- [ ] **Step 1: Make error toasts persist until dismissed**

In `src/components/ui/toast.tsx`, update the `addToast` function:

```typescript
// Replace the addToast callback:
const addToast = useCallback(
  (type: ToastType, message: string) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, type, message }]);
    // Error toasts persist until manually dismissed
    if (type !== 'error') {
      setTimeout(() => dismiss(id), 4000);
    }
  },
  [dismiss]
);
```

- [ ] **Step 2: Commit**

```bash
git add src/components/ui/toast.tsx
git commit -m "feat: error toasts now persist until manually dismissed"
```

---

### Task 10: Update globals.css with new palette

**Files:**
- Modify: `src/app/globals.css`

- [ ] **Step 1: Replace CSS custom properties**

```css
/* Replace the existing :root block: */
:root {
  --background: #F8FAFC;
  --foreground: #1E293B;
  --primary: #1E293B;
  --primary-hover: #334155;
  --accent: #C4A35A;
  --accent-hover: #B8943E;
  --success: #10B981;
  --warning: #F59E0B;
  --danger: #EF4444;
  --info: #3B82F6;
  --card: #FFFFFF;
  --muted: #64748B;
  --border: #E2E8F0;
  --sidebar-bg: #1E293B;
}
```

- [ ] **Step 2: Update sidebar gradient class**

Find any `.gradient-sidebar` or `gradient-sidebar` class usage in globals.css or layout.tsx and change from blue gradient to solid charcoal:

```css
.gradient-sidebar {
  background: var(--sidebar-bg);
}
```

- [ ] **Step 3: Add all new animation keyframes**

Ensure these keyframes exist in globals.css (some may already be present — don't duplicate):

```css
@keyframes slideInRight {
  from { opacity: 0; transform: translateX(100%); }
  to { opacity: 1; transform: translateX(0); }
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes fadeInUp {
  from { opacity: 0; transform: translateY(12px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(100%); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scaleIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}

@keyframes blocker-pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

@keyframes shimmer {
  0% { background-position: 200% 0; }
  100% { background-position: -200% 0; }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-4px); }
  50% { transform: translateX(4px); }
  75% { transform: translateX(-4px); }
}

@keyframes countUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

.animate-shimmer {
  animation: shimmer 1.5s ease-in-out infinite;
}

.animate-shake {
  animation: shake 200ms ease-out;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: update palette to charcoal+gold, add animation keyframes"
```

---

## Phase 3: Page-Level Changes

Apply smart defaults, guardrails, feedback, and empty states to every page.

### Task 11: Register — smart defaults

**Files:**
- Modify: `src/app/(dashboard)/register/page.tsx`
- Modify: `src/app/api/register/route.ts`

- [ ] **Step 1: Update API to return employee weekly_hours**

In `src/app/api/register/route.ts`, update the employee select:

```typescript
// Change this line:
// .select('id, pt_code, full_name, photo_url, weekly_wage, status')
// To:
.select('id, pt_code, full_name, photo_url, weekly_wage, weekly_hours, status')
```

- [ ] **Step 2: Update RegisterRow type to include weekly_hours**

In `src/app/(dashboard)/register/page.tsx`, add to the RegisterRow interface:

```typescript
interface RegisterRow {
  // ... existing fields ...
  weekly_hours: number; // 40 or 45
}
```

- [ ] **Step 3: Replace default row creation with smart defaults**

Replace the block that creates default rows for employees without existing attendance (around line 210-226):

```typescript
// Helper: get default times for a given date and employee
function getDefaultTimes(dateStr: string, weeklyHours: number): {
  status: AttendanceStatus;
  time_in: string;
  time_out: string;
} {
  const day = new Date(dateStr + 'T00:00:00').getDay(); // 0=Sun, 5=Fri, 6=Sat

  // Saturday: only 45hr staff work
  if (day === 6) {
    if (weeklyHours >= 45) {
      return { status: 'present', time_in: '08:00', time_out: '13:00' };
    }
    return { status: 'absent', time_in: '', time_out: '' };
  }

  // Sunday: nobody works
  if (day === 0) {
    return { status: 'absent', time_in: '', time_out: '' };
  }

  // Friday: everyone knocks off at 16:00
  if (day === 5) {
    return { status: 'present', time_in: '08:00', time_out: '16:00' };
  }

  // Mon-Thu: standard 08:00-17:00
  return { status: 'present', time_in: '08:00', time_out: '17:00' };
}

// Then in the newRows mapping, for employees WITHOUT existing records:
return {
  employee_id: emp.id,
  pt_code: emp.pt_code,
  full_name: emp.full_name,
  photo_url: emp.photo_url,
  weekly_wage: emp.weekly_wage,
  weekly_hours: emp.weekly_hours ?? 40,
  emp_status: emp.status,
  ...getDefaultTimes(selectedDate, emp.weekly_hours ?? 40),
  late_minutes: 0,
  late_deduction: 0,
  ot_minutes: 0,
  reason: '',
  existing_id: null,
};
```

- [ ] **Step 4: Remove "Mark All Present" and "Clear All" buttons**

Delete the `markAllPresent()` and `unmarkAll()` functions (lines ~300-328).

Remove the button JSX (lines ~543-561) — the two buttons inside the `{canEdit && !publicHoliday && (...)}` block.

- [ ] **Step 5: Auto-clear times when status changes to absent/sick/leave, auto-restore when back to present**

In the `updateRow` function, add logic:

```typescript
function updateRow(idx: number, patch: Partial<RegisterRow>) {
  setRows((prev) => {
    const next = [...prev];
    const row = { ...next[idx], ...patch };

    // When status changes to non-working, clear times
    if (patch.status && ['absent', 'sick', 'leave', 'short_time'].includes(patch.status)) {
      row.time_in = '';
      row.time_out = '';
      row.late_minutes = 0;
      row.ot_minutes = 0;
    }

    // When status changes back to present, restore day-aware defaults
    if (patch.status === 'present') {
      const defaults = getDefaultTimes(selectedDate, row.weekly_hours);
      row.time_in = defaults.time_in;
      row.time_out = defaults.time_out;
    }

    // ... rest of existing auto-detect logic for late/OT ...
```

- [ ] **Step 6: Update edit window logic**

Replace the `editLocked` line:

```typescript
// OLD: const editLocked = savedForDate && !isAdmin;
// NEW: edit window = today + yesterday for attendance_clerk, any date for owner
const isOwner = user?.role === 'owner';
const today = new Date();
today.setHours(0, 0, 0, 0);
const selected = new Date(selectedDate + 'T00:00:00');
const diffDays = Math.floor((today.getTime() - selected.getTime()) / (1000 * 60 * 60 * 24));
const withinEditWindow = diffDays <= 1; // today or yesterday
const editLocked = canEdit ? (!withinEditWindow && !isOwner) : true;
```

- [ ] **Step 7: Change auto-advance to go to today**

In the `advanceToNextDay` function, replace the logic with:

```typescript
const advanceToNextDay = useCallback(async () => {
  const todayStr = toDateString(new Date());
  if (selectedDate !== todayStr) {
    setSelectedDate(todayStr);
  }
}, [selectedDate]);
```

- [ ] **Step 8: Add disabled state explanation**

Where the save button is rendered with `editLocked`, add hint text:

```typescript
{editLocked && canEdit && (
  <p className="text-xs text-gray-400 mt-1">
    {isOwner ? '' : diffDays > 1 ? 'Only today and yesterday can be edited' : 'Saved — owner can unlock'}
  </p>
)}
```

- [ ] **Step 9: Replace all isAdmin checks with isOwner**

Search the register page for `isAdmin` and replace with `isOwner`, updating the variable declaration.

- [ ] **Step 10: Run build and verify**

Run: `cd /c/Users/Annika/pullens-admin && npx next build 2>&1 | tail -20`

- [ ] **Step 11: Commit**

```bash
git add src/app/\(dashboard\)/register/page.tsx src/app/api/register/route.ts
git commit -m "feat: register smart defaults — day-aware times, auto-clear on absence, edit window today+yesterday"
```

---

### Task 12: Bank page — default all ticked + empty states

**Files:**
- Modify: `src/app/(dashboard)/payroll/bank/page.tsx`

- [ ] **Step 1: Default all employees to ticked**

In the `useEffect` load function, change the pre-populate logic:

```typescript
// OLD: Pre-populate ticked from banked_at
// const alreadyBanked = new Set(
//   rows.filter((r) => r.banked_at !== null).map((r) => r.employee_id)
// )

// NEW: Default ALL to ticked. User unticks exceptions.
const allEmployeeIds = new Set(rows.map((r) => r.employee_id))
setTicked(allEmployeeIds)
```

- [ ] **Step 2: Show "Mark Week Complete" always, disabled with reason when not all ticked**

Replace the conditional render of Mark Week Complete button:

```typescript
{/* Mark Week Complete — always visible */}
{!isComplete && (
  <div className="space-y-1">
    <Button
      variant="primary"
      size="lg"
      loading={completing}
      disabled={!allTicked}
      icon={<CheckCircle size={18} />}
      onClick={handleMarkComplete}
      className="w-full"
    >
      Mark Week Complete
    </Button>
    {!allTicked && (
      <p className="text-xs text-center text-gray-400">
        {payslips.length - ticked.size} employee{payslips.length - ticked.size !== 1 ? 's' : ''} unticked — resolve or confirm unpaid
      </p>
    )}
  </div>
)}
```

- [ ] **Step 3: Add error toast on tick failure**

Import `useToast` and add error feedback:

```typescript
import { useToast } from '@/components/ui/toast'

// Inside component:
const { toast } = useToast()

// In the catch block of handleTick:
catch {
  // Revert on failure
  setTicked((prev) => {
    const next = new Set(prev)
    wasTickedBefore ? next.add(employeeId) : next.delete(employeeId)
    return next
  })
  toast('error', 'Failed to update banking status — check connection and retry')
}
```

- [ ] **Step 4: Replace empty state with actionable message**

Replace the "No payslips found" empty state:

```typescript
if (!run || payslips.length === 0) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center space-y-3">
        <Landmark size={36} className="mx-auto text-gray-300" />
        <p className="text-sm font-medium text-gray-500">Payroll hasn&apos;t run yet</p>
        <a href="/payroll" className="text-sm font-semibold text-[#3B82F6] hover:underline">
          Run payroll &rarr;
        </a>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Replace error state with retry**

```typescript
if (error) {
  return (
    <div className="flex h-full items-center justify-center p-6">
      <div className="text-center space-y-3">
        <p className="text-sm text-red-500">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm font-semibold text-[#3B82F6] hover:underline"
        >
          Retry
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 6: Replace loading spinner with skeleton**

```typescript
import { SkeletonTable } from '@/components/ui/skeleton'

// Replace loading state:
if (loading) {
  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-2xl">
      <SkeletonCard />
      <SkeletonTable rows={8} cols={3} />
    </div>
  )
}
```

Import `SkeletonCard` from the skeleton component too.

- [ ] **Step 7: Commit**

```bash
git add src/app/\(dashboard\)/payroll/bank/page.tsx
git commit -m "feat: bank page — default all ticked, disabled state hints, empty states with actions, error toasts"
```

---

### Task 13: Replace all window.confirm/alert across the app

**Files:**
- Modify: `src/app/(dashboard)/payroll/page.tsx`
- Modify: `src/app/(dashboard)/hr-advisor/page.tsx`
- Modify: `src/app/(dashboard)/settings/page.tsx`
- Modify: `src/app/(dashboard)/register/page.tsx`

- [ ] **Step 1: Audit all window.confirm and window.alert usages**

Run: `cd /c/Users/Annika/pullens-admin && grep -rn "window\.confirm\|window\.alert\|confirm(" src/app/ --include="*.tsx" | grep -v node_modules`

- [ ] **Step 2: For each file, add state for the confirmation modal and replace the native dialog**

Pattern to follow for each replacement:

```typescript
// Add to component state:
const [confirmModal, setConfirmModal] = useState<{
  title: string
  description: string
  variant: 'danger' | 'default'
  confirmLabel: string
  onConfirm: () => void
} | null>(null)

// Replace window.confirm('Are you sure?') with:
setConfirmModal({
  title: 'Delete payroll run',
  description: 'Delete payroll run for week of May 5? This removes all payslips and signatures.',
  variant: 'danger',
  confirmLabel: 'Delete',
  onConfirm: () => {
    // ... the action that was inside the if(confirm(...)) block
    setConfirmModal(null)
  },
})

// Add modal to JSX:
<ConfirmationModal
  open={confirmModal !== null}
  onClose={() => setConfirmModal(null)}
  onConfirm={() => confirmModal?.onConfirm()}
  title={confirmModal?.title ?? ''}
  description={confirmModal?.description ?? ''}
  variant={confirmModal?.variant ?? 'default'}
  confirmLabel={confirmModal?.confirmLabel ?? 'Confirm'}
/>
```

Apply this pattern to:
- **Payroll page**: delete run, discard draft, attendance validation
- **HR Advisor page**: delete incident
- **Settings page**: reset PIN (replace `alert()` with toast), dangerous setting changes
- **Register page**: delete record

- [ ] **Step 3: Run build and verify**

Run: `cd /c/Users/Annika/pullens-admin && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Verify no window.confirm/alert remain**

Run: `cd /c/Users/Annika/pullens-admin && grep -rn "window\.confirm\|window\.alert\|[^.]confirm(" src/app/ --include="*.tsx" | grep -v node_modules | grep -v ConfirmationModal`

Expected: No matches.

- [ ] **Step 5: Commit**

```bash
git add -u src/app/
git commit -m "feat: replace all window.confirm/alert with styled confirmation modals"
```

---

### Task 14: Login page — dynamic user list

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Convert to client component and fetch users from DB**

Replace the entire login page:

```typescript
// src/app/login/page.tsx
'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { cn } from '@/lib/utils'
import { Skeleton } from '@/components/ui/skeleton'

interface LoginUser {
  id: string
  name: string
  role: string
}

export default function LoginPage() {
  const [users, setUsers] = useState<LoginUser[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUser, setLastUser] = useState<string | null>(null)

  useEffect(() => {
    // Get last logged in user from localStorage
    setLastUser(localStorage.getItem('pullens-last-user'))

    // Fetch users from DB
    fetch('/api/auth/users')
      .then(res => res.json())
      .then(data => {
        setUsers(data.users ?? [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#1E293B] font-[Inter,system-ui,sans-serif]">
      <div className="w-full max-w-[420px] relative z-10">
        {/* Branding */}
        <div className="text-center mb-8 animate-[fadeInUp_400ms_ease-out]">
          <div className="flex justify-center mb-6 bg-white/10 backdrop-blur-sm rounded-2xl p-4 mx-auto w-fit">
            <Image src="/logo.png" alt="Pullens Tombstones" width={200} height={100} className="object-contain" />
          </div>
          <h1 className="text-[28px] font-black tracking-[0.15em] text-white leading-none">
            PULLENS ADMIN
          </h1>
          <p className="text-[13px] font-semibold mt-1.5 text-[#C4A35A] tracking-[0.3em]">
            CAST IN STONE
          </p>
        </div>

        {/* Glass card */}
        <div className="rounded-2xl p-6 bg-white/[0.05] border border-white/[0.1] shadow-[0_8px_32px_rgba(0,0,0,0.4)] backdrop-blur-sm animate-[fadeInUp_500ms_ease-out]">
          <p className="text-center text-sm mb-5 text-white/60">
            Select your name to sign in
          </p>

          <div className="grid grid-cols-2 gap-3">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-[48px] rounded-xl bg-white/10" />
              ))
            ) : (
              users.map((user) => (
                <a
                  key={user.id}
                  href={`/login/pin?name=${encodeURIComponent(user.name)}`}
                  onClick={() => localStorage.setItem('pullens-last-user', user.name)}
                  className={cn(
                    'flex items-center justify-center min-h-[48px] px-4 py-3',
                    'rounded-xl text-lg font-medium',
                    'border no-underline cursor-pointer',
                    'transition-all duration-200 ease-out',
                    'active:scale-[0.97]',
                    user.name === lastUser
                      ? 'bg-[#C4A35A]/20 border-[#C4A35A]/40 text-[#C4A35A] ring-1 ring-[#C4A35A]/20'
                      : 'bg-white/[0.08] border-white/[0.08] text-white hover:bg-white/[0.15] hover:border-white/[0.15]'
                  )}
                >
                  {user.name}
                </a>
              ))
            )}
          </div>
        </div>

        <p className="text-center text-xs mt-6 text-white/20">
          Pullen&apos;s Tombstones &middot; Est. 1982
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create API route to fetch users**

Create `src/app/api/auth/users/route.ts`:

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll() {},
      },
    }
  )

  const { data, error } = await supabase
    .from('users')
    .select('id, name, role')
    .order('name')

  if (error) {
    return Response.json({ error: error.message }, { status: 500 })
  }

  return Response.json({ users: data ?? [] })
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx src/app/api/auth/users/route.ts
git commit -m "feat: login page — dynamic user list from DB, last-user highlight, skeleton loading"
```

---

### Task 15: Payroll sign — error toasts on failure

**Files:**
- Modify: `src/app/(dashboard)/payroll/sign/page.tsx`

- [ ] **Step 1: Add toast import and error handling**

Add `import { useToast } from '@/components/ui/toast'` and `const { toast } = useToast()`.

Find the signature upload error handler (the `catch` or error check after uploading signature) and add:

```typescript
toast('error', 'Signature upload failed — please sign again')
```

- [ ] **Step 2: Replace loading spinner with skeleton**

Replace the loading state with `SkeletonCard`.

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/payroll/sign/page.tsx
git commit -m "feat: payroll sign — error toasts on signature failure, skeleton loading"
```

---

### Task 16: Petty cash — form defaults and required fields

**Files:**
- Modify: `src/app/(dashboard)/petty-cash/page.tsx`

- [ ] **Step 1: Change default category from "Diesel" to empty/placeholder**

Find the category state initialisation and change to empty string. Update the category dropdown to include a placeholder option:

```typescript
<option value="" disabled>Select category</option>
```

- [ ] **Step 2: Mark required fields with asterisk**

Add `*` to required field labels:

```typescript
<label>Recipient <span className="text-red-500">*</span></label>
<label>Amount <span className="text-red-500">*</span></label>
<label>Category <span className="text-red-500">*</span></label>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/petty-cash/page.tsx
git commit -m "feat: petty cash — no default category, required field markers"
```

---

### Task 17: Settings — confirmation modals for dangerous changes

**Files:**
- Modify: `src/app/(dashboard)/settings/page.tsx`

- [ ] **Step 1: Wrap NMW, OT rate, and role changes in confirmation modals**

Already handled in Task 13. This task is to verify the settings page specifically has modals for:
- Changing NMW rate
- Changing OT multipliers
- Changing user roles
- Reset PIN (replace `alert()` with success toast)

- [ ] **Step 2: Replace alert() for PIN reset with toast**

```typescript
// OLD: alert(`PIN reset to 0000 for ${user.name}`)
// NEW: toast('success', `PIN reset for ${user.name} — temporary PIN set`)
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/settings/page.tsx
git commit -m "feat: settings — confirmation modals for dangerous changes, toast for PIN reset"
```

---

### Task 18: Alerts page — DB-persisted dismissals

**Files:**
- Modify: `src/app/(dashboard)/alerts/page.tsx`

- [ ] **Step 1: Replace localStorage dismissal logic with Supabase**

Find all `localStorage.getItem` / `localStorage.setItem` calls related to alert dismissals and replace:

```typescript
// Load dismissed alerts from DB instead of localStorage
const { data: dismissals } = await supabase
  .from('alert_dismissals')
  .select('alert_key')
  .eq('user_id', user.id)

const dismissedKeys = new Set((dismissals ?? []).map(d => d.alert_key))

// Dismiss an alert:
async function dismissAlert(alertKey: string) {
  await supabase.from('alert_dismissals').upsert(
    { user_id: user.id, alert_key: alertKey },
    { onConflict: 'user_id,alert_key' }
  )
  // Update local state
}

// Restore dismissed:
async function restoreDismissed() {
  await supabase
    .from('alert_dismissals')
    .delete()
    .eq('user_id', user.id)
  // Refresh
}
```

- [ ] **Step 2: Update empty state**

```typescript
// Replace "No alerts" with:
<div className="text-center py-12 space-y-2">
  <CheckCircle className="h-10 w-10 mx-auto text-emerald-400" />
  <p className="text-sm font-medium text-gray-500">All clear this week</p>
</div>
```

- [ ] **Step 3: Commit**

```bash
git add src/app/\(dashboard\)/alerts/page.tsx
git commit -m "feat: alerts — DB-persisted dismissals, 'all clear' empty state"
```

---

### Task 19: Empty states across remaining pages

**Files:**
- Modify: `src/app/(dashboard)/payroll/print/page.tsx`
- Modify: `src/app/(dashboard)/exports/page.tsx`

- [ ] **Step 1: Print page — add action link on empty state**

```typescript
// Replace "No payroll run found" with:
<div className="text-center space-y-3">
  <p className="text-sm font-medium text-gray-500">Payroll hasn&apos;t run yet</p>
  <a href="/payroll" className="text-sm font-semibold text-[#3B82F6] hover:underline">
    Run payroll &rarr;
  </a>
</div>
```

- [ ] **Step 2: Print page — replace loading text with skeleton**

```typescript
import { SkeletonTable } from '@/components/ui/skeleton'

// Replace "Loading..." text with:
<SkeletonTable rows={6} cols={3} />
```

- [ ] **Step 3: Exports page — remove non-functional buttons**

Find any buttons that show "Phase 2" results. Either remove them entirely or disable them with text: "Coming soon".

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/payroll/print/page.tsx src/app/\(dashboard\)/exports/page.tsx
git commit -m "feat: empty states with action links on print and exports pages"
```

---

### Task 20: Sidebar — charcoal palette + gold active item

**Files:**
- Modify: `src/app/(dashboard)/layout.tsx`

- [ ] **Step 1: Update sidebar colours**

In the `SidebarContent` component, update:
- Title "PULLENS ADMIN" subtitle colour: `text-blue-200` → `text-[#C4A35A]`
- Active nav item: replace `bg-white/15` with gold accent:

```typescript
isActive
  ? 'bg-white/10 text-white font-semibold border-l-2 border-l-[#C4A35A] pl-2.5'
  : 'text-white/60 hover:text-white hover:bg-white/5 hover:pl-3.5'
```

- Divider: `bg-white/10` stays
- Logout hover: keep `hover:text-red-400`

- [ ] **Step 2: Update mobile top bar**

Change header border from blue to charcoal accent:

```typescript
// OLD: border-b-2 border-[#3B82F6]/20
// NEW: border-b border-[#E2E8F0]
```

And title colour:

```typescript
// OLD: text-[#1E3A8A]
// NEW: text-[#1E293B]
```

- [ ] **Step 3: Replace loading spinner with skeleton**

```typescript
if (loading) {
  return (
    <div className="flex h-screen flex-col items-center justify-center bg-[#F8FAFC] gap-4">
      <div className="relative">
        <div className="h-10 w-10 animate-spin rounded-full border-[3px] border-[#C4A35A]/20 border-t-[#C4A35A]" />
      </div>
      <p className="text-xs font-semibold tracking-[0.2em] text-[#1E293B]/30 uppercase">Loading</p>
    </div>
  )
}
```

- [ ] **Step 4: Commit**

```bash
git add src/app/\(dashboard\)/layout.tsx
git commit -m "feat: sidebar — charcoal palette, gold active accent, updated loading state"
```

---

## Phase 4: Polish

### Task 21: Button and card hover/press animations

**Files:**
- Modify: `src/components/ui/button.tsx`
- Modify: `src/components/ui/card.tsx`

- [ ] **Step 1: Add press animation to Button**

Update Button className to include hover lift and press:

```typescript
// Add to the base classes:
'hover:-translate-y-[1px] hover:shadow-lg',
'active:scale-[0.97] active:translate-y-0',
```

- [ ] **Step 2: Add hover lift to Card when hoverable**

Update Card hoverable class:

```typescript
hoverable && 'transition-all duration-150 hover:-translate-y-[2px] hover:shadow-[0_4px_16px_rgba(0,0,0,0.08)]',
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.tsx src/components/ui/card.tsx
git commit -m "feat: button hover lift + press scale, card hover elevation"
```

---

### Task 22: PWA manifest and service worker

**Files:**
- Create: `public/manifest.json`
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Create PWA manifest**

```json
{
  "name": "Pullens Admin",
  "short_name": "Pullens",
  "description": "HR & Payroll Management — Pullens Tombstones",
  "start_url": "/login",
  "display": "standalone",
  "background_color": "#F8FAFC",
  "theme_color": "#1E293B",
  "icons": [
    {
      "src": "/logo.png",
      "sizes": "192x192",
      "type": "image/png"
    },
    {
      "src": "/logo.png",
      "sizes": "512x512",
      "type": "image/png"
    }
  ]
}
```

- [ ] **Step 2: Add manifest link to root layout**

In `src/app/layout.tsx`, add to the `<head>`:

```typescript
<link rel="manifest" href="/manifest.json" />
<meta name="theme-color" content="#1E293B" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

- [ ] **Step 3: Commit**

```bash
git add public/manifest.json src/app/layout.tsx
git commit -m "feat: PWA manifest — standalone mode, charcoal theme, Pullens branding"
```

---

### Task 23: Update all hardcoded blue references to palette tokens

**Files:**
- Multiple files across `src/app/(dashboard)/`

- [ ] **Step 1: Find all hardcoded blue values**

Run: `cd /c/Users/Annika/pullens-admin && grep -rn "#1E40AF\|#3B82F6\|#1E3A8A\|#60A5FA" src/app/ --include="*.tsx" | grep -v node_modules | wc -l`

- [ ] **Step 2: Replace systematically**

| Old value | New value | Context |
|---|---|---|
| `#1E40AF` (primary blue) | `#1E293B` (charcoal) | Primary buttons, headers |
| `#3B82F6` (light blue) | `#C4A35A` (gold) or `#3B82F6` (keep for info/links) | Accents — gold for active states, keep blue for info |
| `#1E3A8A` (dark blue) | `#1E293B` (charcoal) | Sidebar, dark backgrounds |
| `#60A5FA` (glow blue) | `#C4A35A` (gold) | Pulsing states, glows |

**Be selective:** Not every blue should change. Info badges, links, and "leave" status should stay blue. Only primary/accent blues change to charcoal/gold.

- [ ] **Step 3: Run build**

Run: `cd /c/Users/Annika/pullens-admin && npx next build 2>&1 | tail -20`

- [ ] **Step 4: Commit**

```bash
git add -u src/
git commit -m "feat: palette sweep — charcoal primary, gold accents across all pages"
```

---

### Task 24: Final build verification and cleanup

- [ ] **Step 1: Full build**

Run: `cd /c/Users/Annika/pullens-admin && npx next build 2>&1`

Expected: Clean build, no errors.

- [ ] **Step 2: Verify no old role names remain**

Run: `cd /c/Users/Annika/pullens-admin && grep -rn "head_admin\|head_of_admin\|head_of_sales\|'admin'" src/ --include="*.ts" --include="*.tsx" | grep -v node_modules | grep -v "// OLD"`

Expected: No matches (except possibly in comments explaining migration).

- [ ] **Step 3: Verify no window.confirm/alert remain**

Run: `cd /c/Users/Annika/pullens-admin && grep -rn "window\.confirm\|window\.alert" src/ --include="*.ts" --include="*.tsx"`

Expected: No matches.

- [ ] **Step 4: Commit any final fixes**

```bash
git add -u
git commit -m "chore: final build verification and cleanup"
```

---

## Execution Notes

**Run SQL migrations BEFORE deploying Phase 1:**
1. Run `00005_role_migration.sql` in Supabase SQL Editor
2. Run `00006_alert_dismissals.sql` in Supabase SQL Editor
3. Deploy code

**Phase order matters:**
- Phase 1 (Tasks 1-4): Foundation — must go first
- Phase 2 (Tasks 5-10): Shared components — must go before Phase 3
- Phase 3 (Tasks 11-20): Page changes — can be parallelised per-page
- Phase 4 (Tasks 21-24): Polish — can go last

**Testing:** After each phase, run `npx next build` and manually test login + the changed pages.
