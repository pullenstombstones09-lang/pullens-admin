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
  Pencil,
  Check,
  X,
} from 'lucide-react';
import { SlidePanel } from '@/components/ui/slide-panel';
import { useUndo } from '@/components/ui/undo-toast';

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
  const [editingDeduction, setEditingDeduction] = useState<string | null>(null);
  const [deductionValue, setDeductionValue] = useState('');

  // New loan form state
  const [showNewLoan, setShowNewLoan] = useState(false);
  const [newLoan, setNewLoan] = useState({ amount: '', purpose: '', weekly_deduction: '', from_petty: false });
  const [savingLoan, setSavingLoan] = useState(false);
  const { showUndo } = useUndo();

  const fetchLoans = async () => {
    const { data: loanData } = await supabase
      .from('loans')
      .select('*')
      .eq('employee_id', employeeId)
      .order('date_advanced', { ascending: false });

    const allLoans = (loanData ?? []) as Loan[];

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
  };

  useEffect(() => {
    async function load() {
      setLoading(true);
      await fetchLoans();
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

  const weeksRemaining = (loan: Loan): number => {
    if (loan.weekly_deduction <= 0) return 0;
    return Math.ceil(loan.outstanding / loan.weekly_deduction);
  };

  const handleDeleteLoan = async (id: string) => {
    if (!confirm('Delete this loan? This cannot be undone.')) return;
    await supabase.from('loan_deductions').delete().eq('loan_id', id);
    const { error } = await supabase.from('loans').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete loan');
    } else {
      toast('success', 'Loan deleted');
      setLoans((prev) => prev.filter((l) => l.id !== id));
    }
  };

  const handleEditDeduction = (loan: Loan) => {
    setEditingDeduction(loan.id);
    setDeductionValue(String(loan.weekly_deduction));
  };

  const handleSaveDeduction = async (loanId: string) => {
    const val = Number(deductionValue);
    if (isNaN(val) || val < 0) {
      toast('error', 'Enter a valid amount');
      return;
    }
    const { error } = await supabase
      .from('loans')
      .update({ weekly_deduction: val })
      .eq('id', loanId);

    if (error) {
      toast('error', 'Failed to update: ' + error.message);
    } else {
      setLoans(prev => prev.map(l => l.id === loanId ? { ...l, weekly_deduction: val } : l));
      toast('success', `Deduction updated to ${formatCurrency(val)}/week`);
    }
    setEditingDeduction(null);
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
        <Button variant="primary" size="md" onClick={() => setShowNewLoan(true)} icon={<Plus className="h-4 w-4" />}>
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
              <h3 className="text-sm font-semibold text-[#1E293B] mb-3 flex items-center gap-2">
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
                            <p className="text-lg font-bold text-[#1E293B]">
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
                          {user?.role === 'owner' && (
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
                          className="h-full rounded-full bg-[#1E40AF] transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-xs text-stone-500 mb-3">
                        {editingDeduction === loan.id ? (
                          <div className="flex items-center gap-1.5">
                            <span className="text-stone-400">R</span>
                            <input
                              type="number"
                              min="0"
                              step="50"
                              value={deductionValue}
                              onChange={(e) => setDeductionValue(e.target.value)}
                              onKeyDown={(e) => { if (e.key === 'Enter') handleSaveDeduction(loan.id); if (e.key === 'Escape') setEditingDeduction(null); }}
                              className="w-20 h-7 rounded border border-stone-300 px-2 text-xs text-[#1E293B] focus:outline-none focus:ring-1 focus:ring-[#3B82F6]"
                              autoFocus
                            />
                            <span className="text-stone-400">/week</span>
                            <button onClick={() => handleSaveDeduction(loan.id)} className="p-1 rounded hover:bg-emerald-50 text-emerald-600 min-w-[28px] min-h-[28px] flex items-center justify-center">
                              <Check className="h-3.5 w-3.5" />
                            </button>
                            <button onClick={() => setEditingDeduction(null)} className="p-1 rounded hover:bg-stone-100 text-stone-400 min-w-[28px] min-h-[28px] flex items-center justify-center">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => handleEditDeduction(loan)}
                            className="flex items-center gap-1 hover:text-[#3B82F6] transition-colors"
                            title="Edit weekly deduction"
                          >
                            {formatCurrency(loan.weekly_deduction)}/week
                            <Pencil className="h-3 w-3 opacity-40" />
                          </button>
                        )}
                        <span>{weeks > 0 ? `~${weeks} week${weeks === 1 ? '' : 's'} remaining` : 'Final week'}</span>
                      </div>

                      {/* Repayment schedule toggle */}
                      <button
                        onClick={() => setExpandedLoan(isExpanded ? null : loan.id)}
                        className="flex items-center gap-1 text-xs text-[#1E40AF] font-medium min-h-[36px]"
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
                        {user?.role === 'owner' && (
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

      <SlidePanel open={showNewLoan} onClose={() => setShowNewLoan(false)} title="New Loan">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Amount (R)</label>
            <input type="number" value={newLoan.amount}
              onChange={(e) => setNewLoan(prev => ({ ...prev, amount: e.target.value }))}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
              placeholder="e.g. 500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Purpose</label>
            <input type="text" value={newLoan.purpose}
              onChange={(e) => setNewLoan(prev => ({ ...prev, purpose: e.target.value }))}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
              placeholder="e.g. Advance, Transport" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Weekly Deduction (R)</label>
            <input type="number" value={newLoan.weekly_deduction}
              onChange={(e) => setNewLoan(prev => ({ ...prev, weekly_deduction: e.target.value }))}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
              placeholder="e.g. 100" />
            {newLoan.amount && newLoan.weekly_deduction && parseFloat(newLoan.weekly_deduction) > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                ~{Math.ceil(parseFloat(newLoan.amount) / parseFloat(newLoan.weekly_deduction))} weeks to repay
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="fromPetty" checked={newLoan.from_petty}
              onChange={(e) => setNewLoan(prev => ({ ...prev, from_petty: e.target.checked }))}
              className="w-5 h-5 rounded accent-[#1E40AF]" />
            <label htmlFor="fromPetty" className="text-sm text-gray-700">From petty cash</label>
          </div>
          <button
            disabled={!newLoan.amount || !newLoan.weekly_deduction || savingLoan}
            onClick={async () => {
              setSavingLoan(true);
              const amount = parseFloat(newLoan.amount);
              const { data, error } = await supabase.from('loans').insert({
                employee_id: employeeId,
                amount,
                outstanding: amount,
                weekly_deduction: parseFloat(newLoan.weekly_deduction),
                purpose: newLoan.purpose || null,
                date_advanced: new Date().toISOString().split('T')[0],
                status: 'active',
                auto_generated_from_petty: newLoan.from_petty,
              }).select().single();

              setSavingLoan(false);
              if (!error && data) {
                setShowNewLoan(false);
                setNewLoan({ amount: '', purpose: '', weekly_deduction: '', from_petty: false });
                fetchLoans();
                showUndo('Loan added', async () => {
                  await supabase.from('loans').delete().eq('id', data.id);
                  fetchLoans();
                });
              }
            }}
            className="w-full h-11 rounded-lg bg-[#1E40AF] text-white font-semibold text-sm hover:bg-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingLoan ? 'Saving...' : 'Add Loan'}
          </button>
        </div>
      </SlidePanel>
    </div>
  );
}
