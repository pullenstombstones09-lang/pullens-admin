import { describe, it, expect } from 'vitest';
import { normalEndMinutesForDay, dailyQuotaHoursFor } from './payroll-engine';

describe('normalEndMinutesForDay', () => {
  // 1=Mon ... 7=Sun (we use JS getDay: 0=Sun, 1=Mon, 5=Fri, 6=Sat)
  it('returns 17:00 (1020) for Monday through Thursday', () => {
    expect(normalEndMinutesForDay(1, 40)).toBe(17 * 60);
    expect(normalEndMinutesForDay(2, 40)).toBe(17 * 60);
    expect(normalEndMinutesForDay(3, 40)).toBe(17 * 60);
    expect(normalEndMinutesForDay(4, 40)).toBe(17 * 60);
  });

  it('returns 16:00 (960) for Friday', () => {
    expect(normalEndMinutesForDay(5, 40)).toBe(16 * 60);
    expect(normalEndMinutesForDay(5, 44)).toBe(16 * 60);
  });

  it('returns 13:00 (780) for Saturday for 44h sales staff', () => {
    expect(normalEndMinutesForDay(6, 44)).toBe(13 * 60);
  });

  it('returns null for Saturday for 40h factory staff (Sat handled by saturday_cash run)', () => {
    expect(normalEndMinutesForDay(6, 40)).toBeNull();
  });

  it('returns null for Sunday for any employee', () => {
    expect(normalEndMinutesForDay(0, 40)).toBeNull();
    expect(normalEndMinutesForDay(0, 44)).toBeNull();
  });
});

describe('dailyQuotaHoursFor', () => {
  it('Mon-Thu = 9h regardless of weekly hours', () => {
    expect(dailyQuotaHoursFor(1, 40)).toBe(9);
    expect(dailyQuotaHoursFor(4, 44)).toBe(9);
  });

  it('Fri = 8h regardless of weekly hours', () => {
    expect(dailyQuotaHoursFor(5, 40)).toBe(8);
    expect(dailyQuotaHoursFor(5, 44)).toBe(8);
  });

  it('Sat = 4h for 44h staff, 0 for 40h staff', () => {
    expect(dailyQuotaHoursFor(6, 44)).toBe(4);
    expect(dailyQuotaHoursFor(6, 40)).toBe(0);
  });

  it('Sunday = 0 always', () => {
    expect(dailyQuotaHoursFor(0, 40)).toBe(0);
    expect(dailyQuotaHoursFor(0, 44)).toBe(0);
  });
});
