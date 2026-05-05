'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfWeek, endOfWeek } from 'date-fns';
import { Check, X, AlertTriangle, Play, Eye } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/client';
import { detectAnomalies, type Anomaly } from '@/lib/anomalies';
import { haptic } from '@/lib/haptics';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AnomalyBadge } from '@/components/ui/anomaly-badge';
import { PayslipViewer } from '@/components/ui/payslip-viewer';
import type { PayrollResult } from '@/lib/payroll-engine';

interface EmployeeRow {
  id: string;
  full_name: string;
  pt_code: string;
  status: 'approved' | 'pulled';
  pulled_reason: string | null;
  payslip: PayslipResult | null;
  anomalies: Anomaly[];
}

interface PayslipResult {
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
  breakdown: { daily_attendance: { date: string; status: string; hours_worked: number; late_minutes: number }[]; ot_entries: unknown[]; loan_entries: unknown[] };
  friday_ot_rollover: { date: string; minutes: number; employee_id: string }[];
}

export default function PayrollReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // Week bounds (Mon–Sun, current week)
  const today = new Date();
  const weekStart = format(startOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekEnd = format(endOfWeek(today, { weekStartsOn: 1 }), 'yyyy-MM-dd');
  const weekLabel = `${format(startOfWeek(today, { weekStartsOn: 1 }), 'd MMM')} – ${format(endOfWeek(today, { weekStartsOn: 1 }), 'd MMM yyyy')}`;

  const [runId, setRunId] = useState<string | null>(null);
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // PayslipViewer state
  const [viewerEmployeeId, setViewerEmployeeId] = useState<string | null>(null);
  const [viewerEmployeeName, setViewerEmployeeName] = useState('');

  // Pull-reason modal
  const [pullTarget, setPullTarget] = useState<EmployeeRow | null>(null);
  const [pullReason, setPullReason] = useState('');

  const openViewer = (id: string, name: string) => {
    setViewerEmployeeId(id);
    setViewerEmployeeName(name);
  };

  const closeViewer = () => {
    setViewerEmployeeId(null);
    setViewerEmployeeName('');
  };

  // ── Bootstrap: create or reuse a draft payroll run, then build batch ──────
  const bootstrap = useCallback(async () => {
    setPageLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      // 1. Look for existing draft run for this week
      const { data: existingRun } = await supabase
        .from('payroll_runs')
        .select('id')
        .eq('week_start', weekStart)
        .eq('week_end', weekEnd)
        .eq('status', 'draft')
        .maybeSingle();

      let currentRunId: string;

      if (existingRun) {
        currentRunId = existingRun.id;
      } else {
        // 2. Create a draft run via the run API
        const runRes = await fetch('/api/payroll/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ week_start: weekStart, week_end: weekEnd, draftOnly: true }),
        });
        if (!runRes.ok) {
          const err = await runRes.json();
          throw new Error(err.error || 'Failed to create draft run');
        }
        const runData = await runRes.json();
        currentRunId = runData.run_id;
      }

      setRunId(currentRunId);

      // 3. Fetch all active employees
      const { data: employees, error: empErr } = await supabase
        .from('employees')
        .select('id, full_name, pt_code')
        .eq('status', 'active')
        .order('pt_code');

      if (empErr) throw new Error(empErr.message);
      if (!employees || employees.length === 0) throw new Error('No active employees found');

      const employeeIds = employees.map((e) => e.id);

      // 4. Create batch (idempotent upsert — all approved by default)
      const batchRes = await fetch('/api/payroll/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ run_id: currentRunId, employee_ids: employeeIds }),
      });
      if (!batchRes.ok) {
        const err = await batchRes.json();
        throw new Error(err.error || 'Failed to create batch');
      }

      // 5. Fetch batch statuses
      const batchFetch = await fetch(`/api/payroll/batch?run_id=${currentRunId}`);
      const batchData: { employee_id: string; status: 'approved' | 'pulled'; pulled_reason: string | null }[] = await batchFetch.json();
      const batchMap = new Map(batchData.map((b) => [b.employee_id, b]));

      // 6. Fetch payslips for this run to compute anomalies
      const { data: payslips } = await supabase
        .from('payslips')
        .select('*')
        .eq('payroll_run_id', currentRunId);

      const payslipMap = new Map<string, PayslipResult>();
      if (payslips) {
        for (const ps of payslips) {
          // Build a PayrollResult-compatible object for anomaly detection
          payslipMap.set(ps.employee_id, {
            employee_id: ps.employee_id,
            pt_code: '',
            full_name: '',
            weekly_wage: 0,
            hourly_rate: 0,
            ordinary_hours: ps.ordinary_hours ?? 0,
            ot_hours: ps.ot_hours ?? 0,
            ot_amount: ps.ot_amount ?? 0,
            late_minutes: ps.late_deduction > 0 ? 1 : 0,
            late_deduction: ps.late_deduction ?? 0,
            gross: ps.gross ?? 0,
            uif_employee: ps.uif_employee ?? 0,
            uif_employer: 0,
            paye: ps.paye ?? 0,
            loan_deduction: ps.loan_deduction ?? 0,
            garnishee: ps.garnishee ?? 0,
            petty_shortfall: ps.petty_shortfall ?? 0,
            net: ps.net ?? 0,
            breakdown: { daily_attendance: [], ot_entries: [], loan_entries: [] },
            friday_ot_rollover: [],
          });
        }
      }

      // 7. Compose rows
      const composed: EmployeeRow[] = employees.map((emp) => {
        const batch = batchMap.get(emp.id);
        const payslip = payslipMap.get(emp.id) ?? null;
        const anomalies = payslip ? detectAnomalies(payslip as PayrollResult) : [];
        return {
          id: emp.id,
          full_name: emp.full_name,
          pt_code: emp.pt_code,
          status: batch?.status ?? 'approved',
          pulled_reason: batch?.pulled_reason ?? null,
          payslip,
          anomalies,
        };
      });

      // Flagged employees sort to top
      composed.sort((a, b) => {
        const aFlagged = a.anomalies.length > 0 ? -1 : 0;
        const bFlagged = b.anomalies.length > 0 ? -1 : 0;
        if (aFlagged !== bFlagged) return aFlagged - bFlagged;
        return a.pt_code.localeCompare(b.pt_code);
      });

      setRows(composed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setPageLoading(false);
    }
  }, [weekStart, weekEnd]);

  useEffect(() => {
    if (!authLoading && user) {
      if (!hasPermission(user.role, 'approve_payroll')) {
        router.replace('/payroll');
        return;
      }
      bootstrap();
    }
  }, [authLoading, user, router, bootstrap]);

  // ── Toggle approve/pull ────────────────────────────────────────────────────
  const toggleStatus = async (row: EmployeeRow, newStatus: 'approved' | 'pulled', reason?: string) => {
    if (!runId) return;
    haptic(newStatus === 'pulled' ? 'strong' : 'confirm');

    // Optimistic update
    setRows((prev) =>
      prev.map((r) =>
        r.id === row.id
          ? { ...r, status: newStatus, pulled_reason: reason ?? null }
          : r
      )
    );

    await fetch('/api/payroll/batch', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        run_id: runId,
        employee_id: row.id,
        status: newStatus,
        pulled_reason: reason ?? null,
      }),
    });
  };

  const handlePullClick = (row: EmployeeRow) => {
    setPullTarget(row);
    setPullReason('');
  };

  const confirmPull = async () => {
    if (!pullTarget) return;
    await toggleStatus(pullTarget, 'pulled', pullReason || undefined);
    setPullTarget(null);
    setPullReason('');
  };

  // ── Run Final Payroll ──────────────────────────────────────────────────────
  const runFinalPayroll = async () => {
    if (!runId) return;
    setRunning(true);
    haptic('strong');

    const approvedIds = rows.filter((r) => r.status === 'approved').map((r) => r.id);

    try {
      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          week_start: weekStart,
          week_end: weekEnd,
          finalize: true,
          run_id: runId,
          approvedEmployeeIds: approvedIds,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to finalise payroll');
      }

      router.push('/payroll/sign');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run payroll');
      setRunning(false);
    }
  };

  // ── Derived counts ─────────────────────────────────────────────────────────
  const approvedCount = rows.filter((r) => r.status === 'approved').length;
  const pulledCount = rows.filter((r) => r.status === 'pulled').length;
  const flaggedCount = rows.filter((r) => r.anomalies.length > 0).length;
  const approvedNet = rows
    .filter((r) => r.status === 'approved')
    .reduce((sum, r) => sum + (r.payslip?.net ?? 0), 0);

  // ── Render ─────────────────────────────────────────────────────────────────
  if (authLoading || pageLoading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading payroll review…
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          <span className="font-semibold">Error: </span>{error}
        </div>
        <Button variant="secondary" size="sm" className="mt-4" onClick={bootstrap}>
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Payroll Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">{weekLabel}</p>
        </div>
        <Button
          size="lg"
          className="bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_8px_rgba(245,158,11,0.35)] shrink-0"
          icon={<Play size={18} />}
          loading={running}
          disabled={approvedCount === 0}
          onClick={runFinalPayroll}
        >
          Run Final Payroll
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="sm" className="text-center">
          <p className="text-2xl font-bold text-green-700">{approvedCount}</p>
          <p className="text-xs text-gray-500 mt-0.5">Approved</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className={`text-2xl font-bold ${flaggedCount > 0 ? 'text-amber-600' : 'text-gray-400'}`}>
            {flaggedCount}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Flagged</p>
        </Card>
        <Card padding="sm" className="text-center">
          <p className={`text-2xl font-bold ${pulledCount > 0 ? 'text-red-600' : 'text-gray-400'}`}>
            {pulledCount}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">Pulled</p>
        </Card>
      </div>

      {/* Net total */}
      <Card padding="sm">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-500">Approved net payout</span>
          <span className="text-lg font-bold text-[#1E40AF]">{formatCurrency(approvedNet)}</span>
        </div>
      </Card>

      {/* Employee list */}
      <div className="space-y-2">
        {rows.map((row) => {
          const isFlagged = row.anomalies.length > 0;
          const isPulled = row.status === 'pulled';

          return (
            <Card
              key={row.id}
              padding="none"
              className={`overflow-hidden transition-all duration-150 ${
                isPulled ? 'opacity-60' : ''
              } ${isFlagged && !isPulled ? 'border-l-4 border-l-amber-400' : ''}`}
            >
              <div className="flex items-center gap-3 px-4 py-3">
                {/* Status indicator */}
                <div
                  className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
                    isPulled
                      ? 'bg-red-100 text-red-600'
                      : 'bg-green-100 text-green-700'
                  }`}
                >
                  {isPulled ? <X size={16} strokeWidth={2.5} /> : <Check size={16} strokeWidth={2.5} />}
                </div>

                {/* Name + badges */}
                <div className="flex-1 min-w-0">
                  <button
                    onClick={() => openViewer(row.id, row.full_name)}
                    className="text-sm font-semibold text-gray-900 hover:text-[#1E40AF] transition-colors text-left leading-tight"
                  >
                    {row.full_name}
                  </button>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-gray-400">{row.pt_code}</span>
                    {isFlagged && (
                      <AnomalyBadge anomalies={row.anomalies} compact />
                    )}
                    {isPulled && row.pulled_reason && (
                      <span className="text-xs text-red-500 truncate">{row.pulled_reason}</span>
                    )}
                  </div>
                </div>

                {/* Net pay */}
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold ${isPulled ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
                    {row.payslip ? formatCurrency(row.payslip.net) : '—'}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1 shrink-0">
                  {/* Eye */}
                  <button
                    onClick={() => openViewer(row.id, row.full_name)}
                    className="p-2 rounded-lg text-gray-400 hover:text-[#1E40AF] hover:bg-blue-50 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                    title="View payslip"
                  >
                    <Eye size={16} />
                  </button>

                  {/* Toggle approve/pull */}
                  {isPulled ? (
                    <button
                      onClick={() => toggleStatus(row, 'approved')}
                      className="p-2 rounded-lg text-green-600 hover:bg-green-50 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                      title="Re-approve"
                    >
                      <Check size={16} strokeWidth={2.5} />
                    </button>
                  ) : (
                    <button
                      onClick={() => handlePullClick(row)}
                      className="p-2 rounded-lg text-red-500 hover:bg-red-50 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
                      title="Pull from payroll"
                    >
                      <X size={16} strokeWidth={2.5} />
                    </button>
                  )}
                </div>
              </div>

              {/* Anomaly detail strip */}
              {isFlagged && !isPulled && (
                <div className="px-4 pb-3 pt-0">
                  <AnomalyBadge anomalies={row.anomalies} />
                </div>
              )}
            </Card>
          );
        })}
      </div>

      {/* Bottom Run button */}
      <div className="pt-2 pb-6">
        <Button
          size="lg"
          className="w-full bg-amber-500 hover:bg-amber-600 active:bg-amber-700 text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_8px_rgba(245,158,11,0.35)]"
          icon={<Play size={18} />}
          loading={running}
          disabled={approvedCount === 0}
          onClick={runFinalPayroll}
        >
          Run Final Payroll — {approvedCount} employees · {formatCurrency(approvedNet)}
        </Button>
      </div>

      {/* PayslipViewer slide panel */}
      <PayslipViewer
        employeeId={viewerEmployeeId}
        employeeName={viewerEmployeeName}
        onClose={closeViewer}
      />

      {/* Pull reason modal */}
      {pullTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <p className="font-semibold text-gray-900">Pull from payroll?</p>
                <p className="text-sm text-gray-500">{pullTarget.full_name}</p>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1.5">Reason (optional)</label>
              <input
                type="text"
                value={pullReason}
                onChange={(e) => setPullReason(e.target.value)}
                placeholder="e.g. Bank details missing"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30 focus:border-[#1E40AF]"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') confirmPull();
                  if (e.key === 'Escape') setPullTarget(null);
                }}
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                className="flex-1"
                onClick={() => setPullTarget(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                onClick={confirmPull}
              >
                Pull
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
