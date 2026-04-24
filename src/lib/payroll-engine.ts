// Pullens Admin — Payroll calculation engine (spec section 8)
// Exact formula from the rebuild spec, matching V12 spreadsheet logic.

import { Attendance, Employee, Loan, OvertimeRequest } from '@/types/database';

export interface PayrollInput {
  employee: Employee;
  attendance: Attendance[];        // 6 working days (Fri-Thu)
  overtimeRequests: OvertimeRequest[]; // approved OT for the week
  activeLoans: Loan[];             // loans with status = 'active'
  pettyShortfall: number;          // auto-generated from petty cash cutoff
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

// Late-coming rules (spec section 7 + section 11)
// 08:00-08:05: on time (grace)
// 08:06-08:30: dock 30 min
// 08:31-09:00: dock 1 hour (60 min)
// 09:00+: supervisor decides (default: full day unpaid = 8.25hrs × 60 = 495 min)
export function calculateLateMinutes(timeIn: string | null, supervisorOverride?: number): number {
  if (!timeIn) return 0;

  const [hours, minutes] = timeIn.split(':').map(Number);
  const totalMinutes = hours * 60 + minutes;
  const eightOClock = 8 * 60; // 480

  if (totalMinutes <= eightOClock + 5) return 0;        // grace period
  if (totalMinutes <= eightOClock + 30) return 30;       // tier 1: dock 30 min
  if (totalMinutes <= eightOClock + 60) return 60;       // tier 2: dock 1 hour
  // After 09:00: supervisor decides
  return supervisorOverride ?? 495; // default full day
}

// Working hours per day (excluding breaks)
// Mon-Thu: 08:00-17:00 minus 45min breaks = 8.25 hours
// Fri: 08:00-16:00 minus 45min breaks = 7.25 hours (but we use 8hrs for calculation)
// Actually spec says 40hrs/week for 5 days = 8hrs/day average
// The 0.25 comes from the break structure. Let's match V12:
// Default 8.25 hrs/day if present, 40 hrs/week cap for ordinary
const DEFAULT_DAILY_HOURS = 8.25;

export function calculatePayroll(input: PayrollInput): PayrollResult {
  const { employee, attendance, overtimeRequests, activeLoans, pettyShortfall } = input;

  // Step 1: hourly rate
  const hourlyRate = employee.weekly_wage / 40;

  // Step 2: ordinary hours from attendance (cap at 40)
  let ordinaryHours = 0;
  const dailyBreakdown: PayrollBreakdown['daily_attendance'] = [];

  if (attendance.length === 0) {
    // No attendance records = default 40 hours (spec)
    ordinaryHours = 40;
  } else {
    for (const day of attendance) {
      let hoursWorked = 0;

      if (day.status === 'present' || day.status === 'late') {
        if (day.time_in && day.time_out) {
          hoursWorked = calculateHoursWorked(day.time_in, day.time_out);
        } else {
          hoursWorked = DEFAULT_DAILY_HOURS;
        }
      }
      // leave, sick, ph count as paid hours (ordinary)
      else if (day.status === 'leave' || day.status === 'sick' || day.status === 'ph') {
        hoursWorked = DEFAULT_DAILY_HOURS;
      }
      // absent, short_time = 0

      dailyBreakdown.push({
        date: day.date,
        status: day.status,
        hours_worked: hoursWorked,
        late_minutes: day.late_minutes,
      });

      ordinaryHours += hoursWorked;
    }
  }

  // Cap ordinary hours at 40
  ordinaryHours = Math.min(ordinaryHours, 40);

  // Step 3: late deduction
  const totalLateMinutes = attendance.reduce((sum, d) => sum + d.late_minutes, 0);
  const lateDeduction = round2((totalLateMinutes / 60) * hourlyRate);

  // Step 4: overtime
  let otHours = 0;
  let otAmount = 0;
  const otEntries: PayrollBreakdown['ot_entries'] = [];

  for (const ot of overtimeRequests) {
    if (ot.status !== 'approved') continue;
    const amount = round2(ot.hours * hourlyRate * ot.rate_multiplier);
    otHours += ot.hours;
    otAmount += amount;
    otEntries.push({
      date: ot.date,
      hours: ot.hours,
      multiplier: ot.rate_multiplier,
      amount,
    });
  }

  // Step 5: gross
  const grossBasic = round2(hourlyRate * ordinaryHours);
  const gross = round2(grossBasic + otAmount - lateDeduction);

  // Step 6: UIF (1% employee, 1% employer, capped)
  // UIF earnings ceiling: R17,712/month = R4,428/week
  // Max UIF deduction per week: R4,428 × 0.01 = R44.28
  const uifBase = Math.min(gross, 4428);
  const uifEmployee = round2(uifBase * 0.01);
  const uifEmployer = round2(uifBase * 0.01);

  // Step 7: PAYE (rare at Pullens wage levels)
  // Weekly threshold for 2026: roughly R1,731/week (R90,000/year ÷ 52)
  // Most Pullens staff are well below this
  const paye = calculateWeeklyPAYE(gross);

  // Step 8: Loan deductions
  let loanDeduction = 0;
  const loanEntries: PayrollBreakdown['loan_entries'] = [];

  for (const loan of activeLoans) {
    const deductAmount = Math.min(loan.weekly_deduction, loan.outstanding);
    if (deductAmount > 0) {
      loanDeduction += deductAmount;
      loanEntries.push({
        loan_id: loan.id,
        amount: deductAmount,
        purpose: loan.purpose,
        auto_from_petty: loan.auto_generated_from_petty,
      });
    }
  }
  loanDeduction = round2(loanDeduction);

  // Step 9: Garnishee
  const garnishee = employee.garnishee;

  // Step 10: Net
  const net = round2(gross - uifEmployee - paye - loanDeduction - garnishee - pettyShortfall);

  return {
    employee_id: employee.id,
    pt_code: employee.pt_code,
    full_name: employee.full_name,
    weekly_wage: employee.weekly_wage,
    hourly_rate: round2(hourlyRate),
    ordinary_hours: round2(ordinaryHours),
    ot_hours: round2(otHours),
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
    breakdown: {
      daily_attendance: dailyBreakdown,
      ot_entries: otEntries,
      loan_entries: loanEntries,
    },
  };
}

function calculateHoursWorked(timeIn: string, timeOut: string): number {
  const [inH, inM] = timeIn.split(':').map(Number);
  const [outH, outM] = timeOut.split(':').map(Number);
  const totalMinutes = (outH * 60 + outM) - (inH * 60 + inM);
  // Subtract 45 min breaks (30 lunch + 15 tea)
  const worked = Math.max(0, totalMinutes - 45);
  return round2(worked / 60);
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
