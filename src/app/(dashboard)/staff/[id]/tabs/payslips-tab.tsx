'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { ConfirmationModal } from '@/components/ui/confirmation-modal';
import { formatCurrency, formatDate, getWeekNumber } from '@/lib/utils';
import type { Payslip, PayrollRun } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Check, Minus, Filter } from 'lucide-react';

interface PayslipsTabProps {
  employeeId: string;
}

interface PayslipWithWeek extends Payslip {
  week_end: string;
  week_number: number;
}

export default function PayslipsTab({ employeeId }: PayslipsTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [payslips, setPayslips] = useState<PayslipWithWeek[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterYear, setFilterYear] = useState<number>(new Date().getFullYear());
  const [filterMonth, setFilterMonth] = useState<number | null>(null);
  const [confirmModal, setConfirmModal] = useState<{
    title: string
    description: string
    variant: 'danger' | 'default'
    confirmLabel: string
    onConfirm: () => void
  } | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);

      // Fetch payslips with their payroll run info
      const { data: slips } = await supabase
        .from('payslips')
        .select('*, payroll_runs!inner(week_end)')
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false });

      const mapped: PayslipWithWeek[] = (slips ?? []).map((s: Record<string, unknown>) => {
        const run = s.payroll_runs as { week_end: string };
        const weekEnd = run?.week_end ?? '';
        return {
          ...(s as unknown as Payslip),
          week_end: weekEnd,
          week_number: weekEnd ? getWeekNumber(new Date(weekEnd)) : 0,
        };
      });

      setPayslips(mapped);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // Available years
  const years = useMemo(() => {
    const set = new Set<number>();
    payslips.forEach((p) => {
      if (p.week_end) set.add(new Date(p.week_end).getFullYear());
    });
    if (set.size === 0) set.add(new Date().getFullYear());
    return Array.from(set).sort((a, b) => b - a);
  }, [payslips]);

  // Filtered payslips
  const filtered = useMemo(() => {
    return payslips.filter((p) => {
      if (!p.week_end) return false;
      const d = new Date(p.week_end);
      if (d.getFullYear() !== filterYear) return false;
      if (filterMonth !== null && d.getMonth() !== filterMonth) return false;
      return true;
    });
  }, [payslips, filterYear, filterMonth]);

  const handleDownload = (pdfUrl: string | null) => {
    if (pdfUrl) window.open(pdfUrl, '_blank');
  };

  const handleBulkDownload = () => {
    filtered.forEach((p) => {
      if (p.pdf_url) window.open(p.pdf_url, '_blank');
    });
  };

  const handleDeletePayslip = (id: string) => {
    setConfirmModal({
      title: 'Delete Payslip',
      description: 'Delete this payslip? This cannot be undone.',
      variant: 'danger',
      confirmLabel: 'Delete',
      onConfirm: async () => {
        setConfirmModal(null);
        const { error } = await supabase.from('payslips').delete().eq('id', id);
        if (error) {
          toast('error', 'Failed to delete payslip');
        } else {
          toast('success', 'Payslip deleted');
          setPayslips((prev) => prev.filter((p) => p.id !== id));
        }
      },
    });
  };

  const MONTHS = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
    'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <Card padding="md">
              <div className="flex justify-between">
                <div className="h-4 w-24 rounded bg-stone-200" />
                <div className="h-4 w-16 rounded bg-stone-200" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      <ConfirmationModal
        open={confirmModal !== null}
        onClose={() => setConfirmModal(null)}
        onConfirm={() => { confirmModal?.onConfirm(); }}
        title={confirmModal?.title ?? ''}
        description={confirmModal?.description ?? ''}
        variant={confirmModal?.variant ?? 'default'}
        confirmLabel={confirmModal?.confirmLabel ?? 'Confirm'}
      />
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Filter className="h-4 w-4 text-stone-400" />

        {/* Year selector */}
        <select
          value={filterYear}
          onChange={(e) => setFilterYear(Number(e.target.value))}
          className="h-10 rounded-lg border border-stone-300 bg-white px-3 text-sm text-stone-700 min-w-[100px]"
        >
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>

        {/* Month chips */}
        <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
          <button
            onClick={() => setFilterMonth(null)}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
              filterMonth === null
                ? 'bg-[#1E293B] text-white'
                : 'bg-white text-stone-600 border border-stone-200'
            }`}
          >
            All
          </button>
          {MONTHS.map((m, i) => (
            <button
              key={m}
              onClick={() => setFilterMonth(i)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px] ${
                filterMonth === i
                  ? 'bg-[#1E293B] text-white'
                  : 'bg-white text-stone-600 border border-stone-200'
              }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk download */}
      {filtered.length > 0 && (
        <div className="mb-4">
          <Button variant="ghost" size="sm" onClick={handleBulkDownload} icon={<Download className="h-4 w-4" />}>
            Download all ({filtered.length})
          </Button>
        </div>
      )}

      {/* Table — cards on mobile, table on desktop */}
      {filtered.length === 0 ? (
        <div className="py-12 text-center">
          <p className="text-sm text-stone-500">No payslips for this period</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-200 text-left">
                  <th className="py-3 px-3 text-xs font-medium text-stone-500 uppercase">Week</th>
                  <th className="py-3 px-3 text-xs font-medium text-stone-500 uppercase">Week Ending</th>
                  <th className="py-3 px-3 text-xs font-medium text-stone-500 uppercase text-right">Gross</th>
                  <th className="py-3 px-3 text-xs font-medium text-stone-500 uppercase text-right">Net</th>
                  <th className="py-3 px-3 text-xs font-medium text-stone-500 uppercase text-center">Signed</th>
                  <th className="py-3 px-3 text-xs font-medium text-stone-500 uppercase"></th>
                  {user?.role === 'owner' && (
                    <th className="py-3 px-3 text-xs font-medium text-stone-500 uppercase"></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p.id} className="border-b border-stone-100 hover:bg-stone-50 transition-colors">
                    <td className="py-3 px-3 font-mono text-stone-600">W{p.week_number}</td>
                    <td className="py-3 px-3 text-stone-700">{formatDate(p.week_end)}</td>
                    <td className="py-3 px-3 text-right text-stone-700">{formatCurrency(p.gross)}</td>
                    <td className="py-3 px-3 text-right font-semibold text-[#1E293B]">{formatCurrency(p.net)}</td>
                    <td className="py-3 px-3 text-center">
                      {p.signed_at ? (
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      ) : (
                        <Minus className="h-4 w-4 text-stone-300 mx-auto" />
                      )}
                    </td>
                    <td className="py-3 px-3 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(p.pdf_url)}
                        disabled={!p.pdf_url}
                        icon={<Download className="h-3.5 w-3.5" />}
                      >
                        PDF
                      </Button>
                    </td>
                    {user?.role === 'owner' && (
                      <td className="py-3 px-3 text-right">
                        <button
                          onClick={() => handleDeletePayslip(p.id)}
                          title="Delete"
                          className="rounded-md p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {filtered.map((p) => (
              <Card key={p.id} padding="md">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-stone-500">W{p.week_number}</span>
                    <span className="text-xs text-stone-400">{formatDate(p.week_end)}</span>
                  </div>
                  {p.signed_at ? (
                    <Badge color="green">Signed</Badge>
                  ) : (
                    <Badge color="grey">Unsigned</Badge>
                  )}
                </div>
                <div className="flex items-end justify-between">
                  <div>
                    <p className="text-xs text-stone-500">Gross: {formatCurrency(p.gross)}</p>
                    <p className="text-lg font-bold text-[#1E293B]">{formatCurrency(p.net)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDownload(p.pdf_url)}
                      disabled={!p.pdf_url}
                      icon={<Download className="h-4 w-4" />}
                    >
                      PDF
                    </Button>
                    {user?.role === 'owner' && (
                      <button
                        onClick={() => handleDeletePayslip(p.id)}
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
        </>
      )}
    </div>
  );
}
