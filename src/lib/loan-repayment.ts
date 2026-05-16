// Loan repayment ledger math.
//
// The payroll engine (src/lib/payroll-engine.ts, "7. Loans") already computes
// how much to deduct from net pay: for each active loan, min(weekly_deduction,
// outstanding). It does NOT persist the repayment. This module reproduces that
// exact per-loan split so the finalize step can write it back: record the
// deduction in loan_deductions, reduce loans.outstanding, and close the loan
// when it reaches zero. Same formula as the engine → the sum here always
// equals the payslip's stored loan_deduction.

export interface LoanLike {
  id: string;
  weekly_deduction: number;
  outstanding: number;
}

export interface LoanRepayment {
  loan_id: string;
  amount_deducted: number;
  new_outstanding: number;
  close: boolean;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/**
 * Per-loan repayment effects for one finalized week.
 * Mirrors the engine's loan loop exactly: deduct min(weekly_deduction,
 * outstanding) per active loan, skip anything that nets <= 0, round to cents,
 * close the loan when the balance hits zero.
 */
export function computeLoanRepayments(loans: LoanLike[]): LoanRepayment[] {
  const repayments: LoanRepayment[] = [];
  for (const loan of loans) {
    const amount = round2(Math.min(loan.weekly_deduction, loan.outstanding));
    if (amount <= 0) continue;
    const newOutstanding = round2(loan.outstanding - amount);
    repayments.push({
      loan_id: loan.id,
      amount_deducted: amount,
      new_outstanding: newOutstanding,
      close: newOutstanding <= 0,
    });
  }
  return repayments;
}
