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
  FileText,
  Printer,
  CheckCircle,
  AlertTriangle,
  Clock,
  ChevronRight,
  Eye,
} from 'lucide-react';
import Link from 'next/link';

// ---------- helpers ----------

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Get the current Pullens week boundaries (Fri-Thu).
 *  Returns [friday, thursday] as date strings. */
function getCurrentWeek(offset: number = 0): { weekStart: string; weekEnd: string } {
  const now = new Date();
  now.setDate(now.getDate() + offset * 7);
  const dow = now.getDay(); // 0=Sun
  // Go back to Friday
  const daysToFri = (dow + 2) % 7;
  const fri = new Date(now);
  fri.setDate(now.getDate() - daysToFri);
  const thu = new Date(fri);
  thu.setDate(fri.getDate() + 6);
  return {
    weekStart: toDateString(fri),
    weekEnd: toDateString(thu),
  };
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

  const [weekOffset, setWeekOffset] = useState(0);
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [useCustomDates, setUseCustomDates] = useState(false);
  const [calculating, setCalculating] = useState(false);
  const [generatingSlips, setGeneratingSlips] = useState(false);
  const [results, setResults] = useState<PayrollResult[] | null>(null);
  const [runId, setRunId] = useState<string | null>(null);
  const [history, setHistory] = useState<PayrollRun[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [anomalies, setAnomalies] = useState<string[]>([]);

  const defaultWeek = getCurrentWeek(weekOffset);
  const weekStart = useCustomDates && customStart ? customStart : defaultWeek.weekStart;
  const weekEnd = useCustomDates && customEnd ? customEnd : defaultWeek.weekEnd;
  const canRun = user ? hasPermission(user.role, 'run_payroll') : false;
  const canApprove = user ? hasPermission(user.role, 'approve_payroll') : false;

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

  // ---------- calculate payroll ----------

  async function handleCalculate() {
    if (!canRun) return;
    setCalculating(true);
    setResults(null);
    setAnomalies([]);

    try {
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
      setResults(data.results as PayrollResult[]);
      setRunId(data.run_id);

      // Detect anomalies
      const issues: string[] = [];
      for (const r of data.results as PayrollResult[]) {
        if (r.net < 0) {
          issues.push(`${r.full_name} (${r.pt_code}): negative net ${formatCurrency(r.net)}`);
        }
        if (r.ordinary_hours === 0 && r.late_minutes === 0) {
          issues.push(`${r.full_name} (${r.pt_code}): no attendance recorded`);
        }
      }
      setAnomalies(issues);

      toast('success', `Payroll calculated for ${weekLabel(weekStart, weekEnd)}`);
      fetchHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast('error', message);
    } finally {
      setCalculating(false);
    }
  }

  // ---------- generate payslips ----------

  async function handleGeneratePayslips() {
    if (!runId) return;
    setGeneratingSlips(true);

    try {
      const res = await fetch('/api/payroll/generate-payslips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payroll_run_id: runId }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Payslip generation failed');
      }

      toast('success', 'Payslips generated successfully');
      fetchHistory();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      toast('error', message);
    } finally {
      setGeneratingSlips(false);
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
        <h1 className="text-xl font-black text-[#1A1A2E] tracking-tight">
          Payroll
        </h1>
        <p className="mt-0.5 text-sm text-gray-500">
          Weekly payroll processing &mdash; Friday to Thursday
        </p>
      </div>

      {/* Run Payroll section */}
      <Card>
        <CardHeader>
          <CardTitle>Run Payroll</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Week selector */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setWeekOffset((w) => w - 1)}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-[#333] hover:bg-gray-200 transition-colors min-h-[48px]"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <div className="text-center min-w-[200px]">
                <p className="text-sm font-semibold text-[#1A1A2E]">
                  {weekLabel(weekStart, weekEnd)}
                </p>
                <button
                  onClick={() => setUseCustomDates(!useCustomDates)}
                  className="text-xs text-[#C4A35A] hover:underline mt-0.5"
                >
                  {useCustomDates ? 'Use standard weeks' : 'Pick custom dates'}
                </button>
              </div>
              <button
                onClick={() => setWeekOffset((w) => w + 1)}
                className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-[#333] hover:bg-gray-200 transition-colors min-h-[48px]"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>

            {useCustomDates && (
              <div className="flex items-center gap-2">
                <label className="text-xs text-gray-500">From</label>
                <input
                  type="date"
                  value={customStart}
                  onChange={(e) => setCustomStart(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40"
                />
                <label className="text-xs text-gray-500">To</label>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(e) => setCustomEnd(e.target.value)}
                  className="h-10 rounded-lg border border-gray-300 px-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40"
                />
              </div>
            )}

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
                  Anomalies Detected ({anomalies.length})
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

          {/* Results table */}
          {results && (
            <>
              <div className="overflow-x-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-[#1A1A2E] text-white">
                      <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">
                        PT
                      </th>
                      <th className="px-3 py-2.5 text-left text-xs font-semibold whitespace-nowrap">
                        Name
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        Ord Hrs
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        OT Hrs
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        Gross
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        Late
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        UIF
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        PAYE
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        Loan
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        Garni
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        Petty
                      </th>
                      <th className="px-3 py-2.5 text-right text-xs font-semibold whitespace-nowrap">
                        Net
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, idx) => {
                      const hasAnomaly = r.net < 0 || (r.ordinary_hours === 0 && r.late_minutes === 0);
                      return (
                        <tr
                          key={r.employee_id}
                          className={cn(
                            'border-b border-gray-100 transition-colors',
                            hasAnomaly && 'bg-red-50/60',
                            !hasAnomaly && (idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40')
                          )}
                        >
                          <td className="px-3 py-2 font-mono text-xs text-gray-500">
                            {r.pt_code}
                          </td>
                          <td className="px-3 py-2 font-medium text-[#333] whitespace-nowrap">
                            {r.full_name}
                            {hasAnomaly && (
                              <AlertTriangle className="inline-block ml-1.5 h-3.5 w-3.5 text-red-500" />
                            )}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {r.ordinary_hours.toFixed(1)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs">
                            {r.ot_hours > 0 ? r.ot_hours.toFixed(1) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs font-medium">
                            {formatCurrency(r.gross)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-red-600">
                            {r.late_deduction > 0
                              ? `-${formatCurrency(r.late_deduction)}`
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                            {formatCurrency(r.uif_employee)}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                            {r.paye > 0 ? formatCurrency(r.paye) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                            {r.loan_deduction > 0
                              ? formatCurrency(r.loan_deduction)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                            {r.garnishee > 0 ? formatCurrency(r.garnishee) : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-xs text-gray-500">
                            {r.petty_shortfall > 0
                              ? formatCurrency(r.petty_shortfall)
                              : '—'}
                          </td>
                          <td
                            className={cn(
                              'px-3 py-2 text-right font-mono text-xs font-bold',
                              r.net < 0 ? 'text-red-600' : 'text-[#1A1A2E]'
                            )}
                          >
                            {formatCurrency(r.net)}
                          </td>
                        </tr>
                      );
                    })}

                    {/* Totals row */}
                    {totals && (
                      <tr className="border-t-2 border-[#1A1A2E] bg-[#F5F3EF] font-bold">
                        <td className="px-3 py-3" />
                        <td className="px-3 py-3 text-sm text-[#1A1A2E]">
                          TOTAL ({results.length} staff)
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {totals.ordinaryHours.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {totals.otHours.toFixed(1)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {formatCurrency(totals.gross)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-red-600">
                          {totals.lateDeduction > 0
                            ? `-${formatCurrency(totals.lateDeduction)}`
                            : '—'}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {formatCurrency(totals.uif)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {formatCurrency(totals.paye)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {formatCurrency(totals.loans)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {formatCurrency(totals.garnishee)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs">
                          {formatCurrency(totals.petty)}
                        </td>
                        <td className="px-3 py-3 text-right font-mono text-xs text-[#1A1A2E]">
                          {formatCurrency(totals.net)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Button
                  size="lg"
                  loading={generatingSlips}
                  icon={<FileText className="h-4 w-4" />}
                  onClick={handleGeneratePayslips}
                >
                  Generate Payslips
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  icon={<Printer className="h-4 w-4" />}
                  onClick={() => window.print()}
                >
                  Print All {results.length} Payslips
                </Button>
                {canApprove && runId && (
                  <Button
                    variant="ghost"
                    size="lg"
                    icon={<CheckCircle className="h-4 w-4" />}
                    onClick={async () => {
                      await supabase
                        .from('payroll_runs')
                        .update({ status: 'approved' })
                        .eq('id', runId);
                      toast('success', 'Payroll approved');
                      fetchHistory();
                    }}
                  >
                    Approve Payroll
                  </Button>
                )}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Payroll History */}
      <Card>
        <CardHeader>
          <CardTitle>Payroll History</CardTitle>
        </CardHeader>
        <CardContent>
          {loadingHistory ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-6 w-6 animate-spin rounded-full border-3 border-[#C4A35A] border-t-transparent" />
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
                  <Link
                    key={run.id}
                    href={`/payroll/payslip-viewer?run=${run.id}`}
                    className={cn(
                      'flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3',
                      'hover:border-[#C4A35A]/40 hover:shadow-sm transition-all min-h-[56px]'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <Clock className="h-4 w-4 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-[#333]">
                          {weekLabel(run.week_start, run.week_end)}
                        </p>
                        <p className="text-xs text-gray-500">
                          Run {formatDate(run.run_at)}
                          {run.total_net != null && (
                            <> &middot; Net {formatCurrency(run.total_net)}</>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge color={badge.color}>{badge.label}</Badge>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
