'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { formatCurrency, formatDate } from '@/lib/utils';
import type { Loan, LoanDeduction } from '@/types/database';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Banknote,
  Plus,
  ChevronDown,
  ChevronUp,
  TrendingDown,
} from 'lucide-react';

interface LoansTabProps {
  employeeId: string;
}

interface LoanWithDeductions extends Loan {
  deductions: LoanDeduction[];
}

export default function LoansTab({ employeeId }: LoansTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [loans, setLoans] = useState<LoanWithDeductions[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedLoan, setExpandedLoan] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const { data: loanData } = await supabase
        .from('loans')
        .select('*')
        .eq('employee_id', employeeId)
        .order('date_advanced', { ascending: false });

      const allLoans = (loanData ?? []) as Loan[];

      // Fetch deductions for all loans
      const loanIds = allLoans.map((l) => l.id);
      let deductions: LoanDeduction[] = [];
      if (loanIds.length > 0) {
        const { data: dedData } = await supabase
          .from('loan_deductions')
          .select('*')
          .in('loan_id', loanIds)
          .order('deducted_at', { ascending: true });
        deductions = (dedData ?? []) as LoanDeduction[];
      }

      const dedByLoan = new Map<string, LoanDeduction[]>();
      deductions.forEach((d) => {
        const arr = dedByLoan.get(d.loan_id) ?? [];
        arr.push(d);
        dedByLoan.set(d.loan_id, arr);
      });

      const enriched: LoanWithDeductions[] = allLoans.map((l) => ({
        ...l,
        deductions: dedByLoan.get(l.id) ?? [],
      }));

      setLoans(enriched);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const { active, closed } = useMemo(() => {
    const active: LoanWithDeductions[] = [];
    const closed: LoanWithDeductions[] = [];
    loans.forEach((l) => {
      if (l.status === 'active') active.push(l);
      else closed.push(l);
    });
    return { active, closed };
  }, [loans]);

  const handleNewLoan = () => {
    // Placeholder — will be wired to a modal/form
    alert('New loan form coming soon');
  };

  const weeksRemaining = (loan: Loan): number => {
    if (loan.weekly_deduction <= 0) return 0;
    return Math.ceil(loan.outstanding / loan.weekly_deduction);
  };

  const handleDeleteLoan = async (id: string) => {
    if (!confirm('Delete this loan? This cannot be undone.')) return;
    // Delete deductions first, then the loan
    await supabase.from('loan_deductions').delete().eq('loan_id', id);
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete loan');
    } else {
      toast('success', 'Loan deleted');
      setLoans((prev) => prev.filter((l) => l.id !== id));
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 2 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <Card padding="md">
              <div className="h-4 w-40 rounded bg-stone-200 mb-2" />
              <div className="h-6 w-24 rounded bg-stone-200" />
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* New loan button */}
      <div className="mb-5">
        <Button variant="primary" size="md" onClick={handleNewLoan} icon={<Plus className="h-4 w-4" />}>
          New Loan
        </Button>
      </div>

      {loans.length === 0 ? (
        <div className="py-12 text-center">
          <Banknote className="mx-auto h-12 w-12 text-stone-300 mb-3" />
          <p className="text-sm text-stone-500">No loan history</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active loans */}
          {active.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Active Loans ({active.length})
              </h3>
              <div className="space-y-3">
                {active.map((loan) => {
                  const isExpanded = expandedLoan === loan.id;
                  const weeks = weeksRemaining(loan);
                  const progress = loan.amount > 0 ? ((loan.amount - loan.outstanding) / loan.amount) * 100 : 0;

                  return (
                    <Card key={loan.id} padding="md">
                      <div className="flex items-start justify-between gap-3 mb-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-lg font-bold text-[#1A1A2E]">
                              {formatCurrency(loan.outstanding)}
                            </p>
                            <Badge color="amber">Outstanding</Badge>
                          </div>
                          <p className="text-xs text-stone-500">
                            Advanced {formatDate(loan.date_advanced)} — {formatCurrency(loan.amount)} total
                          </p>
                          {loan.purpose && (
                            <p className="text-xs text-stone-400 mt-0.5">{loan.purpose}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {loan.auto_generated_from_petty && (
                            <Badge color="purple">From petty cash</Badge>
                          )}
                          {user?.role === 'head_admin' && (
                            <button
                              onClick={() => handleDeleteLoan(loan.id)}
                              title="Delete"
                              className="rounded-md p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Progress bar */}
                      <div className="h-2 rounded-full bg-stone-100 overflow-hidden mb-2">
                        <div
                          className="h-full rounded-full bg-[#C4A35A] transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-xs text-stone-500 mb-3">
                        <span>{formatCurrency(loan.weekly_deduction)}/week</span>
                        <span>{weeks > 0 ? `~${weeks} week${weeks === 1 ? '' : 's'} remaining` : 'Final week'}</span>
                      </div>

                      {/* Repayment schedule toggle */}
                      <button
                        onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                        className="flex items-center gap-1 text-xs text-[#C4A35A] font-medium min-h-[36px]"
                      >
                        {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                        {isExpanded ? 'Hide' : 'Show'} repayment history
                      </button>

                      {isExpanded && loan.deductions.length > 0 && (
                        <div className="mt-3 border-t border-stone-100 pt-3">
                          <div className="space-y-1.5">
                            {loan.deductions.map((d) => (
                              <div key={d.id} className="flex justify-between text-xs">
                                <span className="text-stone-500">{formatDate(d.deducted_at)}</span>
                                <span className="font-medium text-stone-700">-{formatCurrency(d.amount_deducted)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      {isExpanded && loan.deductions.length === 0 && (
                        <p className="mt-3 text-xs text-stone-400">No deductions recorded yet</p>
                      )}
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {/* Closed loans */}
          {closed.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-stone-400 mb-3">
                Closed Loans ({closed.length})
              </h3>
              <div className="space-y-3">
                {closed.map((loan) => (
                  <Card key={loan.id} padding="md" className="opacity-50">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-600">
                            {formatCurrency(loan.amount)}
                          </p>
                          <Badge color="green">Closed</Badge>
                        </div>
                        <p className="text-xs text-stone-400 mt-0.5">
                          {formatDate(loan.date_advanced)}
                          {loan.purpose && ` — ${loan.purpose}`}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <TrendingDown className="h-4 w-4 text-emerald-400" />
                        {user?.role === 'head_admin' && (
                          <button
                            onClick={() => handleDeleteLoan(loan.id)}
                            title="Delete"
                            className="rounded-md p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                          >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
