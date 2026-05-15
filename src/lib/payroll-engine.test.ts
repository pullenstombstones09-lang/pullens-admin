import { describe, it, expect } from 'vitest';
import { normalEndMinutesForDay, dailyQuotaHoursFor, calculatePayroll, type PayrollInput } from './payroll-engine';
import type { Employee, Attendance } from '@/types/database';

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

function makeEmployee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 'emp-1',
    pt_code: 'PT001',
    legacy_code: null,
    full_name: 'Test Employee',
    id_number: null,
    dob: null,
    gender: null,
    race: null,
    disability: false,
    cell: null,
    email: null,
    home_address: null,
    occupation: null,
    start_date: null,
    weekly_wage: 1209.20,
    weekly_hours: 40,
    payment_method: 'eft',
    bank_name: null,
    bank_acc: null,
    bank_branch: null,
    bank_type: null,
    emergency_name: null,
    emergency_rel: null,
    emergency_phone: null,
    nok_name: null,
    nok_rel: null,
    nok_phone: null,
    tax_number: null,
    uif_ref: null,
    garnishee: 0,
    eif_on_file: false,
    eif_signed: false,
    eif_date: null,
    status: 'active',
    photo_url: null,
    notes: null,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  } as Employee;
}

function makeAttendance(
  date: string,
  timeIn: string | null,
  timeOut: string | null,
  status: Attendance['status'] = 'present',
  lateMinutes = 0,
): Attendance {
  return {
    id: 'att-' + date,
    employee_id: 'emp-1',
    date,
    status,
    time_in: timeIn,
    time_out: timeOut,
    late_minutes: lateMinutes,
    reason: null,
    captured_by: null,
    captured_at: '2026-01-01T00:00:00Z',
  };
}

function normalWeek40h(): Attendance[] {
  return [
    makeAttendance('2026-05-18', '08:00', '17:00'), // Mon
    makeAttendance('2026-05-19', '08:00', '17:00'), // Tue
    makeAttendance('2026-05-20', '08:00', '17:00'), // Wed
    makeAttendance('2026-05-21', '08:00', '17:00'), // Thu
    makeAttendance('2026-05-22', '08:00', '16:00'), // Fri
  ];
}

function defaultInput(overrides: Partial<PayrollInput> = {}): PayrollInput {
  return {
    employee: makeEmployee(),
    attendance: normalWeek40h(),
    overtimeRequests: [],
    activeLoans: [],
    pettyShortfall: 0,
    isLastWeekOfMonth: false,
    prevWeekFridayRolloverMinutes: 0,
    ...overrides,
  };
}

describe('calculatePayroll — 40h staff', () => {
  it('full normal week pays exactly 40h ordinary, no OT', () => {
    const result = calculatePayroll(defaultInput());

    expect(result.ordinary_hours).toBe(40);
    expect(result.ot_hours).toBe(0);
    expect(result.ot_amount).toBe(0);
    expect(result.gross).toBeCloseTo(1209.20, 2);
    expect(result.next_week_friday_rollover_minutes).toBe(0);
  });

  it('Mon-Thu past 17:00 produces OT when weekly worked exceeds 40h', () => {
    const att = [
      makeAttendance('2026-05-18', '08:00', '18:50'),
      makeAttendance('2026-05-19', '08:00', '18:30'),
      makeAttendance('2026-05-20', '08:00', '17:00'),
      makeAttendance('2026-05-21', '08:00', '17:00'),
      makeAttendance('2026-05-22', '08:00', '16:00'),
    ];
    const result = calculatePayroll(defaultInput({ attendance: att }));

    expect(result.ordinary_hours).toBe(40);
    expect(result.ot_hours).toBeCloseTo(3.33, 2);
    expect(result.ot_amount).toBeCloseTo(3.33 * (1209.20 / 40) * 1.5, 1);
    expect(result.next_week_friday_rollover_minutes).toBe(0);
  });

  it('partial week below 40h pays past-end hours at ordinary rate, no OT premium', () => {
    const att = [
      makeAttendance('2026-05-18', '08:00', '17:00'),
      makeAttendance('2026-05-19', '08:00', '17:00'),
      makeAttendance('2026-05-20', '08:00', '20:00'),
      makeAttendance('2026-05-21', null, null, 'absent'),
      makeAttendance('2026-05-22', null, null, 'absent'),
    ];
    const result = calculatePayroll(defaultInput({ attendance: att }));

    expect(result.ordinary_hours).toBe(30);
    expect(result.ot_hours).toBe(0);
    expect(result.ot_amount).toBe(0);
  });

  it('Friday past 16:00 writes to next-week rollover, does not pay this week', () => {
    const att = [
      makeAttendance('2026-05-18', '08:00', '17:00'),
      makeAttendance('2026-05-19', '08:00', '17:00'),
      makeAttendance('2026-05-20', '08:00', '17:00'),
      makeAttendance('2026-05-21', '08:00', '17:00'),
      makeAttendance('2026-05-22', '08:00', '17:30'),
    ];
    const result = calculatePayroll(defaultInput({ attendance: att }));

    expect(result.ordinary_hours).toBe(40);
    expect(result.ot_hours).toBe(0);
    expect(result.next_week_friday_rollover_minutes).toBe(90);
  });

  it('prior weeks rollover adds to this weeks candidate OT', () => {
    const result = calculatePayroll(defaultInput({ prevWeekFridayRolloverMinutes: 90 }));

    expect(result.ordinary_hours).toBe(40);
    expect(result.ot_hours).toBeCloseTo(1.5, 2);
    expect(result.next_week_friday_rollover_minutes).toBe(0);
  });
});

describe('calculatePayroll — 44h sales staff', () => {
  it('full normal week pays 44h ordinary, no OT', () => {
    const emp = makeEmployee({ pt_code: 'PT012', weekly_hours: 44, weekly_wage: 1340 });
    const att = [
      makeAttendance('2026-05-18', '08:00', '17:00'),
      makeAttendance('2026-05-19', '08:00', '17:00'),
      makeAttendance('2026-05-20', '08:00', '17:00'),
      makeAttendance('2026-05-21', '08:00', '17:00'),
      makeAttendance('2026-05-22', '08:00', '16:00'),
      makeAttendance('2026-05-23', '09:00', '13:00'),
    ];
    const result = calculatePayroll(defaultInput({ employee: emp, attendance: att }));

    expect(result.ordinary_hours).toBe(44);
    expect(result.ot_hours).toBe(0);
    expect(result.gross).toBeCloseTo(1340, 2);
  });

  it('sales staff Saturday past 13:00 produces this-week OT', () => {
    const emp = makeEmployee({ pt_code: 'PT012', weekly_hours: 44, weekly_wage: 1340 });
    const att = [
      makeAttendance('2026-05-18', '08:00', '17:00'),
      makeAttendance('2026-05-19', '08:00', '17:00'),
      makeAttendance('2026-05-20', '08:00', '17:00'),
      makeAttendance('2026-05-21', '08:00', '17:00'),
      makeAttendance('2026-05-22', '08:00', '16:00'),
      makeAttendance('2026-05-23', '09:00', '14:00'),
    ];
    const result = calculatePayroll(defaultInput({ employee: emp, attendance: att }));

    expect(result.ordinary_hours).toBe(44);
    expect(result.ot_hours).toBeCloseTo(1, 2);
  });
});

describe('calculatePayroll — leave / late / NMW guard', () => {
  it('a sick day credits 9h ordinary and counts toward the threshold', () => {
    const att = [
      makeAttendance('2026-05-18', null, null, 'sick'),
      makeAttendance('2026-05-19', '08:00', '17:00'),
      makeAttendance('2026-05-20', '08:00', '17:00'),
      makeAttendance('2026-05-21', '08:00', '17:00'),
      makeAttendance('2026-05-22', '08:00', '16:00'),
    ];
    const result = calculatePayroll(defaultInput({ attendance: att }));

    expect(result.ordinary_hours).toBe(40);
    expect(result.ot_hours).toBe(0);
  });

  it('late deduction and same-day OT both apply', () => {
    const att = [
      makeAttendance('2026-05-18', '08:20', '18:30', 'late', 60),
      makeAttendance('2026-05-19', '08:00', '17:00'),
      makeAttendance('2026-05-20', '08:00', '17:00'),
      makeAttendance('2026-05-21', '08:00', '17:00'),
      makeAttendance('2026-05-22', '08:00', '16:00'),
    ];
    const result = calculatePayroll(defaultInput({ attendance: att }));

    expect(result.late_minutes).toBe(60);
    expect(result.late_deduction).toBeCloseTo(1209.20 / 40, 2);
    expect(result.ot_hours).toBeCloseTo(1.5, 2);
  });

  it('engine throws if employee wage divided by weekly_hours is below NMW', () => {
    const emp = makeEmployee({ weekly_wage: 1000, weekly_hours: 40 });
    expect(() => calculatePayroll(defaultInput({ employee: emp }))).toThrow(/NMW breach/);
  });
});

describe('family responsibility leave is paid', () => {
  it('credits 9h for a family day on Mon-Thu (40h staff)', () => {
    const emp = makeEmployee({ weekly_wage: 1209.20, weekly_hours: 40 });
    const attendance: Attendance[] = [
      { id: 'a1', employee_id: emp.id, date: '2026-05-11', status: 'family', time_in: null, time_out: null, late_minutes: 0, reason: 'Sick child', captured_by: null, captured_at: '' },
      // Tue-Fri present full days so weekly threshold (40h) is hit
      { id: 'a2', employee_id: emp.id, date: '2026-05-12', status: 'present', time_in: '08:00', time_out: '17:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
      { id: 'a3', employee_id: emp.id, date: '2026-05-13', status: 'present', time_in: '08:00', time_out: '17:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
      { id: 'a4', employee_id: emp.id, date: '2026-05-14', status: 'present', time_in: '08:00', time_out: '17:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
      { id: 'a5', employee_id: emp.id, date: '2026-05-15', status: 'present', time_in: '08:00', time_out: '16:00', late_minutes: 0, reason: null, captured_by: null, captured_at: '' },
    ];
    const input: PayrollInput = {
      employee: emp,
      attendance,
      overtimeRequests: [],
      activeLoans: [],
      pettyShortfall: 0,
      isLastWeekOfMonth: false,
      prevWeekFridayRolloverMinutes: 0,
    };
    const result = calculatePayroll(input);
    // 9 (Mon family) + 9+9+9 (Tue-Thu) + 8 (Fri) = 44h capped at 40h ordinary
    expect(result.ordinary_hours).toBe(40);
    // Family day breakdown line should appear with 9 hours
    const monBreakdown = result.breakdown.daily_attendance.find(d => d.date === '2026-05-11');
    expect(monBreakdown?.status).toBe('family');
    expect(monBreakdown?.hours_worked).toBe(9);
  });
});
