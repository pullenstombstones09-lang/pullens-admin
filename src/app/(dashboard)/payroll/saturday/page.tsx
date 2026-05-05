'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { cn, formatCurrency } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { haptic } from '@/lib/haptics';
import type { Employee } from '@/types/database';
import { CheckCircle2, Clock, Printer, PenTool, Users } from 'lucide-react';

// ── Types ──────────────────────────────────────────────────────────────────

interface WorkerRow extends Employee {
  selected: boolean;
  time_in: string;
  time_out: string;
}

interface SaturdayResult {
  employee_id: string;
  full_name: string;
  pt_code: string;
  hours: number;
  ot_hours: number;
  cash_due: number;
}

interface SaturdayResponse {
  run_id: string;
  results: SaturdayResult[];
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function calcHours(timeIn: string, timeOut: string): number {
  const [ih, im] = timeIn.split(':').map(Number);
  const [oh, om] = timeOut.split(':').map(Number);
  return Math.max(0, (oh * 60 + om - (ih * 60 + im)) / 60);
}

// ── Page ────────────────────────────────────────────────────────────────────

export default function SaturdayPayrollPage() {
  const { user, loading: authLoading } = useAuth();

  const [date, setDate] = useState<string>(todayString());
  const [workers, setWorkers] = useState<WorkerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [runId, setRunId] = useState<string | null>(null);
  const [results, setResults] = useState<SaturdayResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Load active employees
  useEffect(() => {
    async function load() {
      setLoading(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('employees')
        .select('*')
        .eq('status', 'active')
        .order('pt_code');
      if (error) {
        setError('Failed to load employees.');
      } else {
        setWorkers(
          (data ?? []).map((emp) => ({
            ...emp,
            selected: false,
            time_in: '08:00',
            time_out: '14:00',
          }))
        );
      }
      setLoading(false);
    }
    load();
  }, []);

  const toggleWorker = useCallback((id: string) => {
    haptic('light');
    setWorkers((prev) =>
      prev.map((w) => (w.id === id ? { ...w, selected: !w.selected } : w))
    );
  }, []);

  const updateTime = useCallback(
    (id: string, field: 'time_in' | 'time_out', value: string) => {
      setWorkers((prev) =>
        prev.map((w) => (w.id === id ? { ...w, [field]: value } : w))
      );
    },
    []
  );

  const selectedWorkers = workers.filter((w) => w.selected);

  const handleGenerate = useCallback(async () => {
    if (selectedWorkers.length === 0) return;
    haptic('strong');
    setGenerating(true);
    setError(null);

    try {
      const res = await fetch('/api/payroll/saturday', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          employees: selectedWorkers.map((w) => ({
            employee_id: w.id,
            time_in: w.time_in,
            time_out: w.time_out,
          })),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `Server error ${res.status}`);
      }

      const data: SaturdayResponse = await res.json();
      haptic('confirm');
      setRunId(data.run_id);
      setResults(data.results);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred.');
    } finally {
      setGenerating(false);
    }
  }, [date, selectedWorkers]);

  // ── Loading / auth guard ───────────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-[--muted] text-sm">Loading…</div>
      </div>
    );
  }

  // ── Post-generation results view ───────────────────────────────────────

  if (runId && results.length > 0) {
    const total = results.reduce((sum, r) => sum + r.cash_due, 0);

    return (
      <div className="max-w-2xl mx-auto space-y-6 animate-fade-in-up pb-24">
        {/* Header */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <CheckCircle2 className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[--foreground]">Saturday Cash Payroll</h1>
            <p className="text-sm text-[--muted]">{new Date(date + 'T00:00:00').toLocaleDateString('en-ZA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {/* Results table */}
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-4 py-3 font-semibold text-[--muted]">Employee</th>
                  <th className="text-right px-4 py-3 font-semibold text-[--muted]">Hours</th>
                  <th className="text-right px-4 py-3 font-semibold text-[--muted]">OT</th>
                  <th className="text-right px-4 py-3 font-semibold text-[--muted]">Cash Due</th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr
                    key={r.employee_id}
                    className={cn('border-b border-gray-50', i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50')}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-[--foreground]">{r.full_name}</div>
                      <div className="text-xs text-[--muted]">{r.pt_code}</div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--foreground]">
                      {r.hours.toFixed(1)}h
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-[--foreground]">
                      {r.ot_hours > 0 ? `${r.ot_hours.toFixed(1)}h` : '—'}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold text-[--foreground]">
                      {formatCurrency(r.cash_due)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 bg-gray-50">
                  <td className="px-4 py-3 font-bold text-[--foreground]" colSpan={3}>
                    Total ({results.length} workers)
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums font-bold text-[--foreground]">
                    {formatCurrency(total)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>

        {/* Action buttons */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            variant="secondary"
            size="lg"
            className="flex-1"
            icon={<Printer className="w-5 h-5" />}
            onClick={() => window.open(`/api/pdf/saturday-payslips?run_id=${runId}`, '_blank')}
          >
            Print Saturday Payslips
          </Button>
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<PenTool className="w-5 h-5" />}
            onClick={() => { window.location.href = '/payroll/sign'; }}
          >
            Go to Signing
          </Button>
        </div>
      </div>
    );
  }

  // ── Pre-generation capture view ────────────────────────────────────────

  const hourlyRate = (emp: WorkerRow) =>
    emp.weekly_hours > 0 ? emp.weekly_wage / emp.weekly_hours : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-4 pb-32 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[--foreground]">Saturday Cash Payroll</h1>
          <p className="text-sm text-[--muted] mt-0.5">
            {selectedWorkers.length === 0
              ? 'Tap workers to select'
              : `${selectedWorkers.length} worker${selectedWorkers.length === 1 ? '' : 's'} selected`}
          </p>
        </div>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="text-sm border border-[--border] rounded-lg px-3 py-2 bg-white text-[--foreground] focus:outline-none focus:ring-2 focus:ring-[--info]"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Employee list */}
      <div className="space-y-2">
        {workers.map((worker) => (
          <div
            key={worker.id}
            role="button"
            tabIndex={0}
            onClick={() => toggleWorker(worker.id)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleWorker(worker.id); } }}
            className={cn(
              'rounded-xl border-2 bg-white transition-all duration-150 cursor-pointer select-none',
              'focus-visible:outline-2 focus-visible:outline-[--info] focus-visible:outline-offset-2',
              worker.selected
                ? 'border-[#1E40AF] shadow-[0_0_0_1px_#1E40AF20]'
                : 'border-gray-200 hover:border-gray-300'
            )}
          >
            {/* Row top — always visible */}
            <div className="flex items-center gap-3 px-4 py-3">
              {/* Check indicator */}
              <div
                className={cn(
                  'flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all duration-150',
                  worker.selected
                    ? 'border-[#1E40AF] bg-[#1E40AF]'
                    : 'border-gray-300 bg-white'
                )}
              >
                {worker.selected && <CheckCircle2 className="w-4 h-4 text-white" strokeWidth={2.5} />}
              </div>

              {/* Name + code + rate */}
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-[--foreground] truncate">{worker.full_name}</div>
                <div className="text-xs text-[--muted]">
                  {!worker.selected && <span>{worker.pt_code} · </span>}
                  {formatCurrency(hourlyRate(worker))}/hr
                </div>
              </div>

              {/* Hours preview when selected */}
              {worker.selected && (
                <div className="text-xs text-[#1E40AF] font-medium">
                  {calcHours(worker.time_in, worker.time_out).toFixed(1)}h
                </div>
              )}
            </div>

            {/* Time inputs — only when selected */}
            {worker.selected && (
              <div
                className="border-t border-blue-100 px-4 py-3 flex items-center gap-4 bg-blue-50/40"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="w-4 h-4 text-[--muted] flex-shrink-0" />
                  <label className="text-xs text-[--muted] w-8">In</label>
                  <input
                    type="time"
                    value={worker.time_in}
                    onChange={(e) => updateTime(worker.id, 'time_in', e.target.value)}
                    className="flex-1 min-w-0 text-sm border border-[--border] rounded-lg px-2 py-1.5 bg-white text-[--foreground] focus:outline-none focus:ring-2 focus:ring-[--info]"
                  />
                </div>
                <div className="flex items-center gap-2 flex-1">
                  <Clock className="w-4 h-4 text-[--muted] flex-shrink-0" />
                  <label className="text-xs text-[--muted] w-8">Out</label>
                  <input
                    type="time"
                    value={worker.time_out}
                    onChange={(e) => updateTime(worker.id, 'time_out', e.target.value)}
                    className="flex-1 min-w-0 text-sm border border-[--border] rounded-lg px-2 py-1.5 bg-white text-[--foreground] focus:outline-none focus:ring-2 focus:ring-[--info]"
                  />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sticky bottom CTA */}
      <div className="fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-sm border-t border-[--border] p-4">
        <div className="max-w-2xl mx-auto">
          <button
            className={cn(
              'btn-gold w-full h-14 rounded-xl text-base flex items-center justify-center gap-2',
              'disabled:opacity-50 disabled:pointer-events-none',
              'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[--accent]'
            )}
            disabled={selectedWorkers.length === 0 || generating}
            onClick={handleGenerate}
          >
            <Users className="w-5 h-5" />
            {generating
              ? 'Generating…'
              : `Run Saturday Payroll (${selectedWorkers.length} worker${selectedWorkers.length === 1 ? '' : 's'})`}
          </button>
        </div>
      </div>
    </div>
  );
}
