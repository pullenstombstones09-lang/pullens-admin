// Pullens Admin — Payroll calculation engine (spec section 8)
// Exact formula from the rebuild spec, matching V12 spreadsheet logic.

import { Attendance, Employee, Loan, OvertimeRequest } from '@/types/database';

export interface PayrollInput {
  employee: Employee;
  attendance: Attendance[];        // 6 working days (Fri-Thu)
  overtimeRequests: OvertimeRequest[]; // approved OT for the week
  activeLoans: Loan[];             // loans with status = 'active'
  pettyShortfall: number;          // auto-generated from petty cash cutoff
  isLastWeekOfMonth: boolean;      // garnishee only deducted in last pay week
  prevWeekFridayRolloverMinutes: number;  // rollover from prior week's Friday past 16:00
}

export interface PayrollResult {
  employee_id: string;
  pt_code: string;
  full_name: string;
  weekly_wage: number;
  hourly_rate: number;
  ordinary_hours: number;
  ot_hours: number;
  ot_amount: number;
  late_minutes: number;
  late_deduction: number;
  gross: number;
  uif_employee: number;
  uif_employer: number;
  paye: number;
  loan_deduction: number;
  garnishee: number;
  petty_shortfall: number;
  net: number;
  breakdown: PayrollBreakdown;
  friday_ot_rollover: { date: string; minutes: number; employee_id: string }[];
  next_week_friday_rollover_minutes: number;
}

export interface PayrollBreakdown {
  daily_attendance: {
    date: string;
    status: string;
    hours_worked: number;
    late_minutes: number;
  }[];
  ot_entries: {
    date: string;
    hours: number;
    multiplier: number;
    amount: number;
  }[];
  loan_entries: {
    loan_id: string;
    amount: number;
    purpose: string | null;
    auto_from_petty: boolean;
  }[];
}

/**
 * The "normal end of working day" in minutes-from-midnight.
 * Returns null for days an employee does not normally work
 * (Sundays for everyone; Saturdays for 40h factory staff).
 */
export function normalEndMinutesForDay(
  jsDayOfWeek: number,  // 0=Sun, 1=Mon, ..., 6=Sat
  weeklyHours: number   // 40 (factory) or 44 (sales)
): number | null {
  if (jsDayOfWeek >= 1 && jsDayOfWeek <= 4) return 17 * 60;  // Mon-Thu 17:00
  if (jsDayOfWeek === 5) return 16 * 60;                      // Fri 16:00
  if (jsDayOfWeek === 6 && weeklyHours === 44) return 13 * 60; // Sat 13:00 (sales only)
  return null;
}

/**
 * Credit hours for a leave/sick/PH day (counts toward weekly threshold).
 * Mon-Thu = 9h, Fri = 8h, Sat = 4h (sales only), Sun = 0.
 */
export function dailyQuotaHoursFor(
  jsDayOfWeek: number,
  weeklyHours: number
): number {
  if (jsDayOfWeek >= 1 && jsDayOfWeek <= 4) return 9;
  if (jsDayOfWeek === 5) return 8;
  if (jsDayOfWeek === 6 && weeklyHours === 44) return 4;
  return 0;
}

// Late-coming rules (updated May 2026)
// 08:00-08:05: on time (5-minute grace)
// 08:06-08:15: dock 30 min
// 08:16-09:00: dock 60 min
// 09:01+: dock actual minutes missed (auto, no supervisor override)
// Owner can still manually override any individual dock from the register
export function calculateLateMinutes(timeIn: string | null, manualOverride?: number): number {
  if (manualOverride !== undefined) return manualOverride;
  if (!timeIn) return 0;

  const [hours, minutes] = timeIn.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const eightOClock = 8 * 60; // 480

  if (totalMinutes <= eightOClock + 5) return 0;         // grace period
  if (totalMinutes <= eightOClock + 15) return 30;        // tier 1: dock 30 min
  if (totalMinutes <= eightOClock + 60) return 60;        // tier 2: dock 60 min
  // After 09:00: dock actual minutes missed from 08:00
  return totalMinutes - eightOClock;
}

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { employee, attendance, activeLoans, pettyShortfall, prevWeekFridayRolloverMinutes } = input;

  // 1. Threshold + hourly rate
  const threshold = employee.weekly_hours === 44 ? 44 : 40;
  const hourlyRate = employee.weekly_wage / threshold;

  // 2. NMW guard — fail loudly rather than pay below R30.23/hr
  if (employee.weekly_wage > 0 && hourlyRate < 30.23) {
    throw new Error(
      `NMW breach for ${employee.pt_code} ${employee.full_name}: ` +
      `R${hourlyRate.toFixed(2)}/hr (weekly_wage ${employee.weekly_wage} / ${threshold}h) < R30.23 NMW. ` +
      `Fix employee.weekly_wage before running payroll.`
    );
  }

  // 3. Walk attendance days
  let ordinaryClockMinutes = 0;
  let candidateOtMinutes = 0;
  let nextWeekRolloverMinutes = 0;
  const dailyBreakdown: PayrollBreakdown['daily_attendance'] = [];
  let totalLateMinutes = 0;

  for (const day of attendance) {
    const jsDay = new Date(day.date + 'T00:00:00').getDay();
    const normalEnd = normalEndMinutesForDay(jsDay, threshold);

    if (day.status === 'leave' || day.status === 'sick' || day.status === 'ph' || day.status === 'family') {
      const credit = dailyQuotaHoursFor(jsDay, threshold);
      ordinaryClockMinutes += credit * 60;
      dailyBreakdown.push({ date: day.date, status: day.status, hours_worked: credit, late_minutes: 0 });
      continue;
    }

    if (day.status === 'absent' || !day.time_in || !day.time_out) {
      dailyBreakdown.push({ date: day.date, status: day.status, hours_worked: 0, late_minutes: day.late_minutes });
      totalLateMinutes += day.late_minutes;
      continue;
    }

    if (normalEnd === null) {
      dailyBreakdown.push({ date: day.date, status: day.status, hours_worked: 0, late_minutes: 0 });
      continue;
    }

    totalLateMinutes += day.late_minutes;

    const inMin = toMinutes(day.time_in);
    const outMin = toMinutes(day.time_out);

    if (jsDay === 5) {
      // Friday: past 16:00 goes to next-week rollover, not this-week OT
      const ordinaryEnd = Math.min(outMin, normalEnd);
      const dayOrdinary = Math.max(0, ordinaryEnd - inMin);
      ordinaryClockMinutes += dayOrdinary;
      nextWeekRolloverMinutes += Math.max(0, outMin - normalEnd);
      dailyBreakdown.push({
        date: day.date, status: day.status,
        hours_worked: round2(dayOrdinary / 60), late_minutes: day.late_minutes,
      });
    } else {
      // Mon-Thu and Saturday (44h sales): past normal end is candidate OT
      const ordinaryEnd = Math.min(outMin, normalEnd);
      const dayOrdinary = Math.max(0, ordinaryEnd - inMin);
      ordinaryClockMinutes += dayOrdinary;
      const dayOt = Math.max(0, outMin - normalEnd);
      candidateOtMinutes += dayOt;
      dailyBreakdown.push({
        date: day.date, status: day.status,
        hours_worked: round2((dayOrdinary + dayOt) / 60),
        late_minutes: day.late_minutes,
      });
    }
  }

  // 4. Add prior week's rollover to candidate OT
  candidateOtMinutes += prevWeekFridayRolloverMinutes;

  const ordinaryClockHours = round2(ordinaryClockMinutes / 60);
  const candidateOtHours = round2(candidateOtMinutes / 60);
  const weeklyWorked = round2(ordinaryClockHours + candidateOtHours);

  // 5. Threshold rule
  let ordinaryHoursPaid: number;
  let otHoursPaid: number;
  let otAmount: number;
  const otEntries: PayrollBreakdown['ot_entries'] = [];

  if (weeklyWorked >= threshold) {
    ordinaryHoursPaid = Math.min(ordinaryClockHours, threshold);
    otHoursPaid = candidateOtHours;
    otAmount = round2(otHoursPaid * hourlyRate * 1.5);
    if (otHoursPaid > 0) {
      otEntries.push({ date: 'derived', hours: otHoursPaid, multiplier: 1.5, amount: otAmount });
    }
  } else {
    ordinaryHoursPaid = weeklyWorked;
    otHoursPaid = 0;
    otAmount = 0;
  }

  // 6. Gross / UIF / PAYE
  const lateDeduction = round2((totalLateMinutes / 60) * hourlyRate);
  const grossBasic = round2(hourlyRate * ordinaryHoursPaid);
  const gross = round2(grossBasic + otAmount - lateDeduction);

  // UIF earnings ceiling: R17,712/month = R4,428/week
  const uifBase = Math.min(gross, 4428);
  const uifEmployee = round2(uifBase * 0.01);
  const uifEmployer = round2(uifBase * 0.01);
  const paye = calculateWeeklyPAYE(gross);

  // 7. Loans
  let loanDeduction = 0;
  const loanEntries: PayrollBreakdown['loan_entries'] = [];
  for (const loan of activeLoans) {
    const deductAmount = Math.min(loan.weekly_deduction, loan.outstanding);
    if (deductAmount > 0) {
      loanDeduction += deductAmount;
      loanEntries.push({
        loan_id: loan.id, amount: deductAmount,
        purpose: loan.purpose, auto_from_petty: loan.auto_generated_from_petty,
      });
    }
  }
  loanDeduction = round2(loanDeduction);

  const garnishee = input.isLastWeekOfMonth ? employee.garnishee : 0;
  const net = round2(gross - uifEmployee - paye - loanDeduction - garnishee - pettyShortfall);

  return {
    employee_id: employee.id,
    pt_code: employee.pt_code,
    full_name: employee.full_name,
    weekly_wage: employee.weekly_wage,
    hourly_rate: round2(hourlyRate),
    ordinary_hours: round2(ordinaryHoursPaid),
    ot_hours: round2(otHoursPaid),
    ot_amount: round2(otAmount),
    late_minutes: totalLateMinutes,
    late_deduction: lateDeduction,
    gross,
    uif_employee: uifEmployee,
    uif_employer: uifEmployer,
    paye,
    loan_deduction: loanDeduction,
    garnishee,
    petty_shortfall: pettyShortfall,
    net,
    breakdown: { daily_attendance: dailyBreakdown, ot_entries: otEntries, loan_entries: loanEntries },
    friday_ot_rollover: nextWeekRolloverMinutes > 0
      ? [{ date: 'next-week', minutes: nextWeekRolloverMinutes, employee_id: employee.id }]
      : [],
    next_week_friday_rollover_minutes: nextWeekRolloverMinutes,
  };
}

// Helper — clock string "HH:MM" or "HH:MM:SS" to minutes-from-midnight
function toMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

// SARS 2026 PAYE weekly calculation (simplified)
// Tax-free threshold: ~R95,750/year = R1,841.35/week
// Rate: 18% on first bracket (R1 - R237,100/year)
function calculateWeeklyPAYE(weeklyGross: number): number {
  const weeklyThreshold = 1841.35;
  if (weeklyGross <= weeklyThreshold) return 0;

  const taxable = weeklyGross - weeklyThreshold;
  // 18% marginal rate for the first bracket
  const tax = round2(taxable * 0.18);

  // Primary rebate: R17,235/year = R331.44/week
  const rebate = 331.44;
  return round2(Math.max(0, tax - rebate));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface SaturdayPayrollInput {
  employee: Employee;
  timeIn: string;
  timeOut: string;
}

export function calculateSaturdayPayroll(input: SaturdayPayrollInput): PayrollResult {
  const { employee, timeIn, timeOut } = input;
  const weeklyHours = employee.weekly_hours || 40;
  const hourlyRate = round2(employee.weekly_wage / weeklyHours);

  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);

  const twoPm = 14 * 60;
  const inMinutes = inH * 60 + inM;
  const outMinutes = outH * 60 + outM;

  let ordinaryMinutes = Math.min(totalMinutes, twoPm - inMinutes);
  ordinaryMinutes = Math.max(0, ordinaryMinutes);
  const ordinaryHours = round2(ordinaryMinutes / 60);

  let otMinutes = 0;
  if (outMinutes > twoPm) {
    otMinutes = outMinutes - twoPm;
  }
  const otHours = round2(otMinutes / 60);
  const otAmount = round2(otHours * hourlyRate * 1.5);

  const grossBasic = round2(hourlyRate * ordinaryHours);
  const gross = round2(grossBasic + otAmount);
  const net = gross; // Saturday cash — no deductions (handled on weekly payroll)

  return {
    employee_id: employee.id,
    pt_code: employee.pt_code,
    full_name: employee.full_name,
    weekly_wage: employee.weekly_wage,
    hourly_rate: hourlyRate,
    ordinary_hours: ordinaryHours,
    ot_hours: otHours,
    ot_amount: otAmount,
    late_minutes: 0,
    late_deduction: 0,
    gross,
    uif_employee: 0,
    uif_employer: 0,
    paye: 0,
    loan_deduction: 0,
    garnishee: 0,
    petty_shortfall: 0,
    net,
    friday_ot_rollover: [],
    next_week_friday_rollover_minutes: 0,
    breakdown: {
      daily_attendance: [{
        date: new Date().toISOString().split('T')[0],
        status: 'present',
        hours_worked: ordinaryHours + otHours,
        late_minutes: 0,
      }],
      ot_entries: otHours > 0 ? [{
        date: new Date().toISOString().split('T')[0],
        hours: otHours,
        multiplier: 1.5,
        amount: otAmount,
      }] : [],
      loan_entries: [],
    },
  };
}

// Validate payroll result against V12 (spec section 8: V12 parity testing)
export function validateAgainstV12(
  newResult: PayrollResult,
  v12Net: number,
  tolerance: number = 1
): { match: boolean; difference: number } {
  const diff = round2(Math.abs(newResult.net - v12Net));
  return {
    match: diff <= tolerance,
    difference: diff,
  };
}
