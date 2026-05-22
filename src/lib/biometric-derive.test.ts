import { describe, it, expect } from 'vitest';
import { deriveAttendance, isoToLocalTime, isoToLocalDate } from './biometric-derive';

const ev = (t: string) => ({ event_time: t });

describe('deriveAttendance', () => {
  it('empty events → all null', () => {
    expect(deriveAttendance([])).toEqual({
      time_in: null,
      time_out: null,
      time_in_source: null,
      time_out_source: null,
      event_count: 0,
    });
  });

  it('single event → time_in only', () => {
    const r = deriveAttendance([ev('2026-05-22T07:55:12+02:00')]);
    expect(r.time_in).toBe('07:55:12');
    expect(r.time_out).toBeNull();
    expect(r.time_in_source).toBe('biometric');
    expect(r.time_out_source).toBeNull();
    expect(r.event_count).toBe(1);
  });

  it('two events with > 5 min gap → time_in + time_out', () => {
    const r = deriveAttendance([
      ev('2026-05-22T07:55:00+02:00'),
      ev('2026-05-22T17:02:33+02:00'),
    ]);
    expect(r.time_in).toBe('07:55:00');
    expect(r.time_out).toBe('17:02:33');
    expect(r.time_in_source).toBe('biometric');
    expect(r.time_out_source).toBe('biometric');
    expect(r.event_count).toBe(2);
  });

  it('two events within 5 min → treat as double-scan, time_in only', () => {
    const r = deriveAttendance([
      ev('2026-05-22T07:55:00+02:00'),
      ev('2026-05-22T07:57:01+02:00'),
    ]);
    expect(r.time_in).toBe('07:55:00');
    expect(r.time_out).toBeNull();
    expect(r.time_out_source).toBeNull();
    expect(r.event_count).toBe(2);
  });

  it('multiple events spread across day → first / last', () => {
    const r = deriveAttendance([
      ev('2026-05-22T08:01:00+02:00'),
      ev('2026-05-22T12:31:00+02:00'),
      ev('2026-05-22T13:02:00+02:00'),
      ev('2026-05-22T17:05:00+02:00'),
    ]);
    expect(r.time_in).toBe('08:01:00');
    expect(r.time_out).toBe('17:05:00');
    expect(r.event_count).toBe(4);
  });

  it('out-of-order events → sorted correctly', () => {
    const r = deriveAttendance([
      ev('2026-05-22T17:00:00+02:00'),
      ev('2026-05-22T07:55:00+02:00'),
      ev('2026-05-22T12:30:00+02:00'),
    ]);
    expect(r.time_in).toBe('07:55:00');
    expect(r.time_out).toBe('17:00:00');
  });

  it('exactly 5 min gap → treated as double-scan (boundary case)', () => {
    const r = deriveAttendance([
      ev('2026-05-22T08:00:00+02:00'),
      ev('2026-05-22T08:04:59+02:00'),
    ]);
    expect(r.time_out).toBeNull();
  });

  it('5 min + 1 sec gap → time_out emitted', () => {
    const r = deriveAttendance([
      ev('2026-05-22T08:00:00+02:00'),
      ev('2026-05-22T08:05:01+02:00'),
    ]);
    expect(r.time_out).toBe('08:05:01');
  });
});

describe('isoToLocalTime', () => {
  it('extracts HH:MM:SS from a +02:00 timestamp', () => {
    expect(isoToLocalTime('2026-05-20T16:59:36+02:00')).toBe('16:59:36');
  });

  it('handles midnight', () => {
    expect(isoToLocalTime('2026-05-20T00:00:00+02:00')).toBe('00:00:00');
  });

  it('handles late evening', () => {
    expect(isoToLocalTime('2026-05-20T23:59:59+02:00')).toBe('23:59:59');
  });
});

describe('isoToLocalDate', () => {
  it('extracts YYYY-MM-DD from a +02:00 timestamp', () => {
    expect(isoToLocalDate('2026-05-20T16:59:36+02:00')).toBe('2026-05-20');
  });
});
