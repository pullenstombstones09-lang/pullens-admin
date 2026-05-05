import { PayrollResult } from './payroll-engine'

export type AnomalySeverity = 'red' | 'amber';

export interface Anomaly {
  type: string;
  label: string;
  severity: AnomalySeverity;
  detail: string;
}

export function detectAnomalies(
  result: PayrollResult,
  previousWeekNet?: number
): Anomaly[] {
  const flags: Anomaly[] = [];

  // Late dock applied
  if (result.late_minutes > 0) {
    flags.push({
      type: 'late',
      label: 'Late',
      severity: 'amber',
      detail: `${result.late_minutes} min docked (R${result.late_deduction.toFixed(2)})`,
    });
  }

  // Missing time in or out
  for (const day of result.breakdown.daily_attendance) {
    if ((day.status === 'present' || day.status === 'late') && day.hours_worked === 0) {
      flags.push({
        type: 'missing_time',
        label: 'Missing time',
        severity: 'red',
        detail: `${day.date}: present but 0 hours recorded`,
      });
    }
  }

  // Zero hours on working day
  const workingDays = result.breakdown.daily_attendance.filter(
    d => d.status === 'present' || d.status === 'late'
  );
  if (workingDays.length > 0 && result.ordinary_hours === 0) {
    flags.push({
      type: 'zero_hours',
      label: 'Zero hours',
      severity: 'red',
      detail: 'Marked present but 0 ordinary hours calculated',
    });
  }

  // High OT (>10 hours)
  if (result.ot_hours > 10) {
    flags.push({
      type: 'high_ot',
      label: 'High OT',
      severity: 'amber',
      detail: `${result.ot_hours} OT hours this week`,
    });
  }

  // Deductions exceed 40% of gross
  const totalDeductions = result.uif_employee + result.paye + result.loan_deduction
    + result.garnishee + result.petty_shortfall + result.late_deduction;
  if (result.gross > 0 && totalDeductions / result.gross > 0.4) {
    flags.push({
      type: 'high_deductions',
      label: 'High deductions',
      severity: 'red',
      detail: `Deductions are ${Math.round((totalDeductions / result.gross) * 100)}% of gross`,
    });
  }

  // Week-on-week swing (>15%)
  if (previousWeekNet !== undefined && previousWeekNet > 0) {
    const diff = Math.abs(result.net - previousWeekNet);
    const pct = (diff / previousWeekNet) * 100;
    if (pct > 15) {
      flags.push({
        type: 'wow_swing',
        label: 'Pay swing',
        severity: 'amber',
        detail: `Net ${result.net > previousWeekNet ? 'up' : 'down'} ${Math.round(pct)}% vs last week`,
      });
    }
  }

  return flags;
}
