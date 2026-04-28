'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { PayrollRun, PayrollStatus } from '@/types/database';
import type { PayrollResult } from '@/lib/payroll-engine';
import {
  Calculator,
  Printer,
  FileStack,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  FileText,
  PenTool,
  Trash2,
} from 'lucide-react';
import Link from 'next/link';

// ---------- helpers ----------

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getCurrentWeek(offset: number = 0): { weekStart: string; weekEnd: string } {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const dow = now.getDay();
  const daysToFri = (dow + 2) % 7;
  const fri = new Date(now);
  fri.setDate(now.getDate() - daysToFri);
  const thu = new Date(fri);
  thu.setDate(fri.getDate() + 6);
  return { weekStart: toDateString(fri), weekEnd: toDateString(thu) };
}

function weekLabel(start: string, end: string): string {
  const s = new Date(start + 'T00:00:00');
  const e = new Date(end + 'T00:00:00');
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' });
  return `${fmt(s)} – ${fmt(e)} ${e.getFullYear()}`;
}

const STATUS_BADGE: Record<PayrollStatus, { color: 'amber' | 'blue' | 'green' | 'purple'; label: string }> = {
  draft: { color: 'amber', label: 'Draft' },
  generated: { color: 'blue', label: 'Generated' },
  approved: { color: 'green', label: 'Approved' },
  paid: { color: 'purple', label: 'Paid' },
};

// ---------- component ----------

export default function PayrollPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const { toast } = useToast();

  const initWeek = getCurrentWeek(0);
  const [customStart, setCustomStart] = useState(initWeek.weekStart);
  const [customEnd, setCustomEnd] = useState(initWeek.weekEnd);
  const [calculating, setCalculating] = useState(false);
  const [results, setResults] = useState<PayrollResult[] | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [history, setHistory] = useState<PayrollRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [anomalies, setAnomalies] = useState<string[]>([]);

  // Selection + inline loan edit state
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [editingLoan, setEditingLoan] = useState<string | null>(null);
  const [loanValue, setLoanValue] = useState('');
  const [banked, setBanked] = useState<Set<string>>(new Set());

  const weekStart = customStart;
  const weekEnd = customEnd;
  const canRun = user ? hasPermission(user.role, 'run_payroll') : false;
  const canApprove = user ? hasPermission(user.role, 'approve_payroll') : false;

  // Selection helpers
  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!results) return;
    if (selected.size === results.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(results.map((r: any) => r.employee_id)));
    }
  };

  // Fetch payroll history
  const fetchHistory = useCallback(async () => {
    setLoadingHistory(true);
    const { data } = await supabase
      .from('payroll_runs')
      .select('*')
      .order('week_start', { ascending: false })
      .limit(20);
    setHistory((data ?? []) as PayrollRun[]);
    setLoadingHistory(false);
  }, [supabase]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  // ---------- delete payroll run ----------

  async function handleDeleteRun(runId: string) {
    if (!confirm('Delete this payroll run and all its payslips? This cannot be undone.')) return;

    const supabase = createClient();

    // Must delete loan_deductions first (FK RESTRICT, won't cascade)
    const { error: loanErr } = await supabase
      .from('loan_deductions')
      .delete()
      .eq('payroll_run_id', runId);

    if (loanErr) {
      toast('error', 'Failed to clear loan deductions: ' + loanErr.message);
      return;
    }

    const { error: runErr } = await supabase
      .from('payroll_runs')
      .delete()
      .eq('id', runId);

    if (runErr) {
      toast('error', 'Failed to delete payroll run: ' + runErr.message);
      return;
    }

    toast('success', 'Payroll run deleted');
    fetchHistory();
  }

  // ---------- discard current draft ----------

  async function handleDiscardDraft() {
    if (!runId) return;
    if (!confirm('Discard this payroll calculation? This will delete the draft run.')) return;
    await handleDeleteRun(runId);
    setResults(null);
    setRunId(null);
    setAnomalies([]);
    setSelected(new Set());
  }

  // ---------- calculate payroll ----------

  async function handleCalculate() {
    if (!canRun) return;
    setCalculating(true);
    setResults(null);
    setAnomalies([]);
    setSelected(new Set());

    try {
      // Attendance validation gate
      const { data: employees } = await supabase
        .from('employees')
        .select('id, full_name')
        .eq('status', 'active');

      const { data: attendance } = await supabase
        .from('attendance')
        .select('employee_id')
        .gte('date', weekStart)
        .lte('date', weekEnd);

      if (employees && attendance) {
        const withAttendance = new Set(attendance.map((a: { employee_id: string }) => a.employee_id));
        const missing = employees.filter((e: { id: string }) => !withAttendance.has(e.id));

        if (missing.length > 0) {
          const names = missing.map((e: { full_name: string }) => e.full_name).join(', ');
          const proceed = window.confirm(
            `${missing.length} employee${missing.length === 1 ? '' : 's'} ha${missing.length === 1 ? 's' : 've'} no attendance recorded:\n\n${names}\n\nContinue anyway?`
          );
          if (!proceed) {
            setCalculating(false);
            return;
          }
        }
      }

      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart, week_end: weekEnd }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Payroll calculation failed');
      }

      const data = await res.json();
      const payrollResults = data.results as PayrollResult[];
      setResults(payrollResults);
      setRunId(data.run_id);

      // Detect anomalies
      const issues: string[] = [];
      for (const r of payrollResults) {
        if (r.net < 0) issues.push(`${r.full_name}: negative net ${formatCurrency(r.net)}`);
        if (r.ordinary_hours === 0) issues.push(`${r.full_name}: no hours worked`);
        if (r.gross === 0) issues.push(`${r.full_name}: zero gross pay`);
      }
      setAnomalies(issues);

      // Auto-approve + generate payslips in one step
      if (canApprove && data.run_id) {
        await supabase
          .from('payroll_runs')
          .update({ status: 'approved' })
          .eq('id', data.run_id);

        await fetch('/api/payroll/generate-payslips', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ payroll_run_id: data.run_id }),
        });
      }

      toast('success', `Payroll calculated for ${weekLabel(weekStart, weekEnd)}`);
      fetchHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast('error', message);
    } finally {
      setCalculating(false);
    }
  }

  // ---------- totals ----------

  const totals = results
    ? {
        ordinaryHours: results.reduce((s, r) => s + r.ordinary_hours, 0),
        otHours: results.reduce((s, r) => s + r.ot_hours, 0),
        gross: results.reduce((s, r) => s + r.gross, 0),
        lateDeduction: results.reduce((s, r) => s + r.late_deduction, 0),
        uif: results.reduce((s, r) => s + r.uif_employee, 0),
        paye: results.reduce((s, r) => s + r.paye, 0),
        loans: results.reduce((s, r) => s + r.loan_deduction, 0),
        garnishee: results.reduce((s, r) => s + r.garnishee, 0),
        petty: results.reduce((s, r) => s + r.petty_shortfall, 0),
        net: results.reduce((s, r) => s + r.net, 0),
      }
    : null;

  // ---------- render ----------

  if (!user) return null;
  if (!hasPermission(user.role, 'view_payroll')) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-black text-[#1E293B] tracking-tight">
          Payroll
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Weekly payroll processing
        </p>
      </div>

      {/* Run Payroll */}
      <Card>
        <CardHeader>
          <CardTitle>Run Payroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Week selector */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  const s = new Date(customStart + 'T00:00:00');
                  const e = new Date(customEnd + 'T00:00:00');
                  s.setDate(s.getDate() - 7);
                  e.setDate(e.getDate() - 7);
                  setCustomStart(toDateString(s));
                  setCustomEnd(toDateString(e));
                }}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-[#333] hover:bg-gray-200 transition-colors min-h-[48px]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-12 min-h-[48px] rounded-lg border border-gray-300 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
                <span className="text-gray-400">–</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-12 min-h-[48px] rounded-lg border border-gray-300 px-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40"
                />
              </div>

              <button
                onClick={() => {
                  const s = new Date(customStart + 'T00:00:00');
                  const e = new Date(customEnd + 'T00:00:00');
                  s.setDate(s.getDate() + 7);
                  e.setDate(e.getDate() + 7);
                  setCustomStart(toDateString(s));
                  setCustomEnd(toDateString(e));
                }}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-[#333] hover:bg-gray-200 transition-colors min-h-[48px]"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {canRun && (
              <Button
                size="lg"
                loading={calculating}
                icon={<Calculator className="h-4 w-4" />}
                onClick={handleCalculate}
              >
                Calculate Payroll
              </Button>
            )}
          </div>

          {/* Anomalies */}
          {anomalies.length > 0 && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <p className="text-sm font-semibold text-amber-800">
                  Anomalies ({anomalies.length})
                </p>
              </div>
              <ul className="space-y-1">
                {anomalies.map((a, i) => (
                  <li key={i} className="text-xs text-amber-700 flex items-start gap-1.5">
                    <span className="shrink-0 mt-0.5">&#x2022;</span>
                    {a}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Results */}
          {results && (
            <>
              {/* Status + actions bar */}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2 rounded-lg bg-green-50 border border-green-200 px-4 py-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-semibold text-green-800">
                      Calculated — {results.length} employees
                    </span>
                  </div>
                  {user?.role === 'head_admin' && (
                    <button
                      onClick={handleDiscardDraft}
                      className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 hover:border-red-300 transition-colors"
                      title="Discard this payroll calculation"
                    >
                      <Trash2 className="h-4 w-4" />
                      Discard
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={<Printer className="h-4 w-4" />}
                    onClick={() => window.open(`/api/pdf/payroll-summary?run=${runId}`, '_blank')}
                  >
                    Print Summary
                  </Button>
                  <Button
                    variant="secondary"
                    size="lg"
                    icon={<FileStack className="h-4 w-4" />}
                    onClick={() => window.open(`/api/pdf/payslips-all?run=${runId}`, '_blank')}
                  >
                    Print All Payslips
                  </Button>
                </div>
              </div>

              {/* Results table — full detail on screen */}
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-[#1E293B] text-white">
                      <th className="px-3 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={selected.size === results.length && results.length > 0}
                          onChange={toggleSelectAll}
                          className="w-5 h-5 rounded accent-[#1E40AF]"
                        />
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">PT</th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">Name</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Hrs</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">OT</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Gross</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Loan</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Deductions</th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">Net</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => {
                      const hasAnomaly = r.net < 0 || r.ordinary_hours === 0 || r.gross === 0;
                      const totalDeductions = r.uif_employee + r.paye + r.late_deduction +
                        r.loan_deduction + r.garnishee + r.petty_shortfall;
                      return (
                        <tr
                          key={r.employee_id}
                          className={cn(
                            'border-b border-gray-100 transition-colors',
                            selected.has(r.employee_id) && 'bg-blue-50/60',
                            !selected.has(r.employee_id) && hasAnomaly && 'bg-red-50/60',
                            !selected.has(r.employee_id) && !hasAnomaly && (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')
                          )}
                        >
                          <td className="px-3 py-3">
                            <input
                              type="checkbox"
                              checked={selected.has(r.employee_id)}
                              onChange={() => toggleSelect(r.employee_id)}
                              className="w-5 h-5 rounded accent-[#1E40AF]"
                            />
                          </td>
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">{r.pt_code}</td>
                          <td className="px-3 py-2 font-medium text-[#333] whitespace-nowrap">
                            {r.full_name}
                            {hasAnomaly && (
                              <AlertTriangle className="inline-block ml-1.5 h-3.5 w-3.5 text-red-500" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">{r.ordinary_hours.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {r.ot_hours > 0 ? r.ot_hours.toFixed(1) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs font-medium">
                            {formatCurrency(r.gross)}
                          </td>
                          <td className="px-3 py-3 text-sm">
                            {editingLoan === r.employee_id ? (
                              <input
                                type="number"
                                value={loanValue}
                                autoFocus
                                onChange={(e) => setLoanValue(e.target.value)}
                                onKeyDown={async (e) => {
                                  if (e.key === 'Enter') {
                                    const supabase = createClient();
                                    await supabase
                                      .from('loans')
                                      .update({ weekly_deduction: parseFloat(loanValue) })
                                      .eq('employee_id', r.employee_id)
                                      .eq('status', 'active');
                                    r.loan_deduction = parseFloat(loanValue);
                                    setEditingLoan(null);
                                  }
                                  if (e.key === 'Escape') setEditingLoan(null);
                                }}
                                onBlur={() => setEditingLoan(null)}
                                className="w-20 h-9 rounded border border-[#3B82F6] px-2 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
                              />
                            ) : (
                              <span
                                onClick={() => { setEditingLoan(r.employee_id); setLoanValue(r.loan_deduction?.toString() || '0'); }}
                                className={r.loan_deduction > 0 ? 'cursor-pointer text-[#1E40AF] underline decoration-dotted' : 'text-gray-400'}
                                title="Click to edit"
                              >
                                {r.loan_deduction > 0 ? `R${r.loan_deduction.toFixed(2)}` : '—'}
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                            {totalDeductions > 0 ? formatCurrency(totalDeductions) : '—'}
                          </td>
                          <td className={cn(
                            'px-3 py-2 text-right font-mono text-xs font-bold',
                            r.net < 0 ? 'text-red-600' : 'text-[#1E293B]'
                          )}>
                            {formatCurrency(r.net)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals */}
                    {totals && (
                      <tr className="border-t-2 border-[#1E293B] bg-[#F8FAFC] font-bold">
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3 text-sm text-[#1E293B]">
                          TOTAL ({results.length})
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">{totals.ordinaryHours.toFixed(1)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">{totals.otHours.toFixed(1)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(totals.gross)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">{formatCurrency(totals.loans)}</td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {formatCurrency(totals.lateDeduction + totals.uif + totals.paye + totals.loans + totals.garnishee + totals.petty)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-[#1E293B]">
                          {formatCurrency(totals.net)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Sticky action bar */}
      {results && results.length > 0 && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 flex items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)] rounded-b-xl mt-4">
          <span className="text-sm text-gray-500">
            {selected.size} of {results.length} selected
          </span>
          <div className="flex items-center gap-3 flex-wrap">
            <Button
              variant="secondary"
              size="md"
              onClick={() => window.open(`/api/pdf/payroll-summary?run=${runId}`, '_blank')}
              icon={<FileText size={16} />}
            >
              Print Summary
            </Button>
            <Button
              variant="primary"
              size="md"
              disabled={selected.size === 0}
              onClick={() => {
                const ids = Array.from(selected).join(',');
                window.open(`/api/pdf/payslips-all?run=${runId}&employees=${ids}`, '_blank');
              }}
              icon={<Printer size={16} />}
            >
              Print Selected ({selected.size})
            </Button>
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                const params = new URLSearchParams();
                if (runId) params.set('run', runId);
                if (selected.size > 0 && selected.size < results.length) {
                  params.set('employees', Array.from(selected).join(','));
                }
                window.location.href = `/payroll/payslip-viewer?${params}`;
              }}
              icon={<PenTool size={16} />}
            >
              View &amp; Sign
            </Button>
          </div>
        </div>
      )}

      {/* Banking Section */}
      {results && results.length > 0 && (
        <div className="rounded-xl border border-gray-100/60 bg-white shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] p-6 mt-6">
          <h2 className="text-lg font-bold text-[#1E293B] mb-4">Banking — Tick Off Payments</h2>
          <div className="space-y-2">
            {results.map((r: any) => (
              <div key={r.employee_id}
                className="flex items-center justify-between py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="flex items-center gap-3">
                  <input type="checkbox"
                    checked={banked.has(r.employee_id)}
                    onChange={async () => {
                      const next = new Set(banked)
                      if (next.has(r.employee_id)) {
                        next.delete(r.employee_id)
                      } else {
                        next.add(r.employee_id)
                      }
                      setBanked(next)
                      await fetch('/api/payroll/bank', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ run_id: runId, employee_ids: [r.employee_id] }),
                      })
                    }}
                    className="w-5 h-5 rounded accent-[#10B981]" />
                  <span className="text-sm font-medium text-[#1E293B]">{r.full_name}</span>
                </div>
                <span className="text-sm font-bold text-[#1E293B]">R{r.net?.toFixed(2)}</span>
              </div>
            ))}
          </div>
          {banked.size === results.length && results.length > 0 && (
            <button
              onClick={async () => {
                await fetch('/api/payroll/bank', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ run_id: runId, employee_ids: Array.from(banked) }),
                })
              }}
              className="w-full h-11 mt-4 rounded-lg bg-[#1E40AF] text-white font-semibold text-sm hover:bg-[#1E3A8A] animate-pulse-blue transition-colors"
            >
              Mark Week Complete
            </button>
          )}
        </div>
      )}

      {/* Payroll History */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#3B82F6] border-t-transparent" />
            </div>
          ) : history.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">
              No payroll runs yet.
            </p>
          ) : (
            <div className="space-y-2">
              {history.map((run) => {
                const badge = STATUS_BADGE[run.status];
                return (
                  <div
                    key={run.id}
                    className={cn(
                      'flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3',
                      'hover:border-[#3B82F6]/40 hover:shadow-sm transition-all min-h-[56px]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#333]">
                          {weekLabel(run.week_start, run.week_end)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDate(run.run_at)}
                          {run.total_net != null && (
                            <> &middot; Net {formatCurrency(run.total_net)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={badge.color}>{badge.label}</Badge>
                      <button
                        onClick={() => window.open(`/api/pdf/payroll-summary?run=${run.id}`, '_blank')}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#333] transition-colors"
                        title="Print Summary"
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => window.open(`/api/pdf/payslips-all?run=${run.id}`, '_blank')}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-gray-400 hover:bg-gray-100 hover:text-[#333] transition-colors"
                        title="Print All Payslips"
                      >
                        <FileStack className="h-4 w-4" />
                      </button>
                      {user?.role === 'head_admin' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteRun(run.id); }}
                          className="p-2 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                          title="Delete payroll run"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
