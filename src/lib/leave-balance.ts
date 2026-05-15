// Pullens Admin — leave balance helpers (BCEA s27 compliant for FRL)

export const FRL_ANNUAL_LIMIT = 3;

interface LeaveRecord {
  leave_type: string;
  from_date: string;
  to_date: string;
  days: number;
}

/** Inclusive day count between two YYYY-MM-DD dates, excluding Sundays (matches existing leave-tab logic). */
export function dateRangeDays(from: string, to: string): number {
  let count = 0;
  const cur = new Date(from + 'T00:00:00');
  const end = new Date(to + 'T00:00:00');
  while (cur <= end) {
    if (cur.getDay() !== 0) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

/**
 * Compute family responsibility leave remaining as 3 - (family days taken in the last 365 days).
 * Source of truth: the leave history. The leave_balances column is treated as a stale cache.
 * Clamped at 0 (cannot go negative even if owner overrode the cap).
 */
export function computeFamilyBalance(leaves: LeaveRecord[], asOf: Date = new Date()): number {
  const horizon = new Date(asOf);
  horizon.setDate(horizon.getDate() - 365);
  let used = 0;
  for (const l of leaves) {
    if (l.leave_type !== 'family') continue;
    const taken = new Date(l.from_date + 'T00:00:00');
    if (taken < horizon) continue;
    used += l.days;
  }
  return Math.max(0, FRL_ANNUAL_LIMIT - used);
}
