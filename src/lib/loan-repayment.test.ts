import { describe, it, expect } from 'vitest';
import { computeLoanRepayments, type LoanLike } from './loan-repayment';

const loan = (over: Partial<LoanLike> & { id: string }): LoanLike => ({
  weekly_deduction: 100,
  outstanding: 500,
  ...over,
});

describe('computeLoanRepayments — mirrors payroll-engine loan loop exactly', () => {
  it('deducts the weekly amount when balance is larger; loan stays open', () => {
    const [r] = computeLoanRepayments([loan({ id: 'a', weekly_deduction: 100, outstanding: 380 })]);
    expect(r).toEqual({ loan_id: 'a', amount_deducted: 100, new_outstanding: 280, close: false });
  });

  it('deducts only the remaining balance on the final week and closes the loan', () => {
    const [r] = computeLoanRepayments([loan({ id: 'b', weekly_deduction: 100, outstanding: 60 })]);
    expect(r).toEqual({ loan_id: 'b', amount_deducted: 60, new_outstanding: 0, close: true });
  });

  it('closes exactly when weekly deduction equals the outstanding balance', () => {
    const [r] = computeLoanRepayments([loan({ id: 'c', weekly_deduction: 100, outstanding: 100 })]);
    expect(r).toEqual({ loan_id: 'c', amount_deducted: 100, new_outstanding: 0, close: true });
  });

  it('skips loans with zero or negative outstanding (no deduction recorded)', () => {
    expect(computeLoanRepayments([loan({ id: 'd', outstanding: 0 })])).toEqual([]);
    expect(computeLoanRepayments([loan({ id: 'e', outstanding: -25 })])).toEqual([]);
  });

  it('skips loans with zero weekly deduction', () => {
    expect(computeLoanRepayments([loan({ id: 'f', weekly_deduction: 0, outstanding: 500 })])).toEqual([]);
  });

  it('handles multiple loans independently, summing to the engine loan_deduction', () => {
    const rows = computeLoanRepayments([
      loan({ id: 'g', weekly_deduction: 100, outstanding: 300 }),
      loan({ id: 'h', weekly_deduction: 200, outstanding: 150 }),
    ]);
    expect(rows).toEqual([
      { loan_id: 'g', amount_deducted: 100, new_outstanding: 200, close: false },
      { loan_id: 'h', amount_deducted: 150, new_outstanding: 0, close: true },
    ]);
    const total = rows.reduce((s, r) => s + r.amount_deducted, 0);
    expect(total).toBe(250);
  });

  it('rounds money to 2 decimals (cents), never carries float drift', () => {
    const [r] = computeLoanRepayments([loan({ id: 'i', weekly_deduction: 33.333, outstanding: 100.005 })]);
    expect(r.amount_deducted).toBe(33.33);
    expect(r.new_outstanding).toBe(66.68);
    expect(r.close).toBe(false);
  });
});
