import { describe, it, expect } from 'vitest';
import { computeFamilyBalance, dateRangeDays, FRL_ANNUAL_LIMIT } from './leave-balance';

describe('FRL_ANNUAL_LIMIT', () => {
  it('matches BCEA s27 — 3 days per cycle', () => {
    expect(FRL_ANNUAL_LIMIT).toBe(3);
  });
});

describe('dateRangeDays', () => {
  it('counts inclusive days between two dates, skipping Sundays', () => {
    // Mon 11 May - Wed 13 May 2026: 3 weekdays, no Sunday
    expect(dateRangeDays('2026-05-11', '2026-05-13')).toBe(3);
  });
  it('skips Sundays', () => {
    // Sat 16 May - Mon 18 May 2026: Sat + Mon = 2 (Sun excluded)
    expect(dateRangeDays('2026-05-16', '2026-05-18')).toBe(2);
  });
  it('returns 1 for a single non-Sunday date', () => {
    expect(dateRangeDays('2026-05-15', '2026-05-15')).toBe(1);
  });
  it('returns 0 if the only date is a Sunday', () => {
    expect(dateRangeDays('2026-05-17', '2026-05-17')).toBe(0);
  });
});

describe('computeFamilyBalance', () => {
  const today = new Date('2026-05-15T00:00:00');

  it('returns 3 when no family leave taken in the last 365 days', () => {
    expect(computeFamilyBalance([], today)).toBe(3);
  });

  it('subtracts family leave taken in the last 365 days', () => {
    const leaves = [
      { leave_type: 'family', from_date: '2026-04-10', to_date: '2026-04-10', days: 1 },
      { leave_type: 'family', from_date: '2026-03-15', to_date: '2026-03-15', days: 1 },
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(1); // 3 - 2
  });

  it('ignores non-family leave', () => {
    const leaves = [
      { leave_type: 'sick', from_date: '2026-04-10', to_date: '2026-04-12', days: 3 },
      { leave_type: 'annual', from_date: '2026-03-15', to_date: '2026-03-15', days: 1 },
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(3);
  });

  it('ignores family leave older than 365 days', () => {
    const leaves = [
      { leave_type: 'family', from_date: '2025-04-10', to_date: '2025-04-10', days: 1 }, // > 365 days ago from 2026-05-15
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(3);
  });

  it('clamps at 0 — never returns negative', () => {
    const leaves = [
      { leave_type: 'family', from_date: '2026-05-01', to_date: '2026-05-05', days: 5 }, // owner overrode FRL cap
    ];
    expect(computeFamilyBalance(leaves, today)).toBe(0);
  });
});
