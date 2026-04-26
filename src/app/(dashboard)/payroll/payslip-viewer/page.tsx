'use client';

import { useEffect, useState, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency, formatDate } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { Payslip, Employee, PayrollRun } from '@/types/database';
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  Printer,
  PenTool,
  Check,
} from 'lucide-react';
import Link from 'next/link';

// ---------- types ----------

interface PayslipWithEmployee extends Payslip {
  employee: Pick<Employee, 'full_name' | 'pt_code' | 'id_number' | 'occupation'>;
}

// ---------- signature canvas ----------

function SignatureCanvas({
  onSave,
  saving,
}: {
  onSave: (dataUrl: string) => void;
  saving: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [drawing, setDrawing] = useState(false);
  const [hasStrokes, setHasStrokes] = useState(false);

  function getPos(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  }

  function startDraw(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) {
    e.preventDefault();
    setDrawing(true);
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  }

  function draw(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) {
    if (!drawing) return;
    e.preventDefault();
    const ctx = canvasRef.current!.getContext('2d')!;
    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.strokeStyle = '#1A1A2E';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    setHasStrokes(true);
  }

  function endDraw() {
    setDrawing(false);
  }

  function clearCanvas() {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasStrokes(false);
  }

  function handleSave() {
    if (!hasStrokes) return;
    const dataUrl = canvasRef.current!.toDataURL('image/png');
    onSave(dataUrl);
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium text-[#333]">
        Employee Signature
      </p>
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-1">
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          className="w-full touch-none cursor-crosshair rounded"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>
      <div className="flex items-center gap-2">
        <Button
          size="lg"
          loading={saving}
          disabled={!hasStrokes}
          icon={<Check className="h-4 w-4" />}
          onClick={handleSave}
        >
          Submit Signature
        </Button>
        <Button variant="ghost" size="lg" onClick={clearCanvas}>
          Clear
        </Button>
      </div>
    </div>
  );
}

// ---------- payslip display ----------

function PayslipDisplay({
  slip,
  run,
}: {
  slip: PayslipWithEmployee;
  run: PayrollRun | null;
}) {
  return (
    <div
      className="mx-auto max-w-[700px] rounded-xl border border-gray-200 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)] print:shadow-none print:border-none"
      id="payslip-print"
    >
      {/* Header */}
      <div className="mb-5 border-b border-gray-200 pb-4">
        <h2 className="text-lg font-black text-[#1A1A2E] tracking-tight">
          PULLENS TOMBSTONES
        </h2>
        <p className="text-xs text-gray-500">
          Amazon Creek Trading (Pty) Ltd &middot; t/a Pullens Tombstones
        </p>
        <p className="text-xs text-gray-500">
          65 Boom Street, Pietermaritzburg, 3201 &middot; Tel: 033 345 1609
        </p>
        <p className="text-xs text-gray-500">
          Reg: 2011/105461/23 &middot; COID: 990001280518 &middot; UIF: 2573997/9
        </p>
      </div>

      {/* Employee + Period */}
      <div className="mb-5 grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Row label="Employee" value={slip.employee.full_name} />
          <Row label="PT Code" value={slip.employee.pt_code} />
          <Row label="ID Number" value={slip.employee.id_number ?? '—'} />
          <Row label="Occupation" value={slip.employee.occupation ?? '—'} />
        </div>
        <div className="space-y-1.5 text-right">
          {run && (
            <>
              <Row label="Pay Period" value={`${run.week_start} to ${run.week_end}`} align="right" />
              <Row label="Pay Date" value={formatDate(run.run_at)} align="right" />
            </>
          )}
        </div>
      </div>

      {/* Earnings */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-bold text-[#1A1A2E] uppercase tracking-wider">
          Earnings
        </h3>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Hours</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">Ordinary Time</td>
                <td className="px-3 py-2 text-right font-mono">{slip.ordinary_hours.toFixed(1)}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(slip.gross - slip.ot_amount + slip.late_deduction)}
                </td>
              </tr>
              {slip.ot_hours > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">Overtime</td>
                  <td className="px-3 py-2 text-right font-mono">{slip.ot_hours.toFixed(1)}</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(slip.ot_amount)}
                  </td>
                </tr>
              )}
              {slip.late_deduction > 0 && (
                <tr className="border-b border-gray-100 text-red-600">
                  <td className="px-3 py-2">Late Deduction</td>
                  <td className="px-3 py-2" />
                  <td className="px-3 py-2 text-right font-mono">
                    -{formatCurrency(slip.late_deduction)}
                  </td>
                </tr>
              )}
              <tr className="bg-gray-50 font-bold">
                <td className="px-3 py-2">Gross Pay</td>
                <td className="px-3 py-2" />
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(slip.gross)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Deductions */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-bold text-[#1A1A2E] uppercase tracking-wider">
          Deductions
        </h3>
        <div className="rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-3 py-2 text-left text-xs font-semibold text-gray-600">Description</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-gray-600">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="px-3 py-2">UIF (Employee 1%)</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(slip.uif_employee)}
                </td>
              </tr>
              {slip.paye > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">PAYE</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(slip.paye)}
                  </td>
                </tr>
              )}
              {slip.loan_deduction > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">Loan Repayment</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(slip.loan_deduction)}
                  </td>
                </tr>
              )}
              {slip.garnishee > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">Garnishee Order</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(slip.garnishee)}
                  </td>
                </tr>
              )}
              {slip.petty_shortfall > 0 && (
                <tr className="border-b border-gray-100">
                  <td className="px-3 py-2">Petty Cash Shortfall</td>
                  <td className="px-3 py-2 text-right font-mono">
                    {formatCurrency(slip.petty_shortfall)}
                  </td>
                </tr>
              )}
              <tr className="bg-gray-50 font-bold">
                <td className="px-3 py-2">Total Deductions</td>
                <td className="px-3 py-2 text-right font-mono">
                  {formatCurrency(
                    slip.uif_employee +
                      slip.paye +
                      slip.loan_deduction +
                      slip.garnishee +
                      slip.petty_shortfall
                  )}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Net Pay */}
      <div className="rounded-lg bg-[#1A1A2E] px-5 py-4 flex items-center justify-between">
        <span className="text-sm font-bold text-white uppercase tracking-wider">
          Net Pay
        </span>
        <span className="text-xl font-black text-[#C4A35A]">
          {formatCurrency(slip.net)}
        </span>
      </div>

      {/* Employer UIF contribution (BCEA requirement) */}
      <p className="mt-3 text-[10px] text-gray-400 text-center">
        Employer UIF contribution: {formatCurrency(slip.uif_employer)} &middot;
        BCEA Section 33 compliant payslip
      </p>

      {/* Signature area */}
      {slip.signature_url && (
        <div className="mt-4 border-t border-gray-200 pt-3">
          <p className="text-xs text-gray-500 mb-1">Employee Signature:</p>
          <img
            src={slip.signature_url}
            alt="Signature"
            className="h-16 object-contain"
          />
          <p className="text-[10px] text-gray-400 mt-1">
            Signed {slip.signed_at ? formatDate(slip.signed_at) : ''}
          </p>
        </div>
      )}
    </div>
  );
}

function Row({
  label,
  value,
  align = 'left',
}: {
  label: string;
  value: string;
  align?: 'left' | 'right';
}) {
  return (
    <div className={cn('flex gap-2', align === 'right' && 'justify-end')}>
      <span className="text-xs text-gray-500">{label}:</span>
      <span className="text-xs font-medium text-[#333]">{value}</span>
    </div>
  );
}

// ---------- main page ----------

export default function PayslipViewerPageWrapper() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center h-64"><div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#C4A35A]" /></div>}>
      <PayslipViewerPage />
    </Suspense>
  );
}

function PayslipViewerPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const { toast } = useToast();
  const searchParams = useSearchParams();
  const runId = searchParams.get('run');

  const [payslips, setPayslips] = useState<PayslipWithEmployee[]>([]);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [savingSignature, setSavingSignature] = useState(false);

  const fetchPayslips = useCallback(async () => {
    if (!runId) return;
    setLoading(true);

    const [runRes, slipRes] = await Promise.all([
      supabase.from('payroll_runs').select('*').eq('id', runId).single(),
      supabase
        .from('payslips')
        .select('*, employee:employees(full_name, pt_code, id_number, occupation)')
        .eq('payroll_run_id', runId)
        .order('created_at'),
    ]);

    if (runRes.data) setRun(runRes.data as PayrollRun);

    const slips = (slipRes.data ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      employee: Array.isArray(s.employee) ? s.employee[0] : s.employee,
    })) as PayslipWithEmployee[];

    setPayslips(slips);
    setLoading(false);
  }, [supabase, runId]);

  useEffect(() => {
    fetchPayslips();
  }, [fetchPayslips]);

  // ---------- signature submit ----------

  async function handleSignature(dataUrl: string) {
    const slip = payslips[currentIdx];
    if (!slip) return;
    setSavingSignature(true);

    // In production, upload to Supabase Storage. For now, store the data URL directly.
    const { error } = await supabase
      .from('payslips')
      .update({
        signature_url: dataUrl,
        signed_at: new Date().toISOString(),
      })
      .eq('id', slip.id);

    if (error) {
      toast('error', `Signature save failed: ${error.message}`);
    } else {
      toast('success', `Signature captured for ${slip.employee.full_name}`);
      await fetchPayslips();
    }

    setSavingSignature(false);
  }

  // ---------- render ----------

  if (!user) return null;
  if (!hasPermission(user.role, 'view_payslips')) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  if (!runId) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-gray-500">No payroll run selected.</p>
      </div>
    );
  }

  const currentSlip = payslips[currentIdx] ?? null;

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/payroll"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#333] shadow-sm hover:bg-gray-50 transition-colors min-h-[48px] min-w-[48px]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-[#1A1A2E] tracking-tight">
              Payslip Viewer
            </h1>
            {run && (
              <p className="mt-0.5 text-sm text-gray-500">
                {run.week_start} to {run.week_end} &middot; {payslips.length} payslips
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="lg"
            icon={<Printer className="h-4 w-4" />}
            onClick={() => {
              if (!currentSlip) return;
              window.open(`/api/pdf/payslip?id=${currentSlip.id}`, '_blank');
            }}
          >
            Print Payslip
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C4A35A] border-t-transparent" />
        </div>
      ) : payslips.length === 0 ? (
        <div className="text-center py-16">
          <p className="text-sm text-gray-500">No payslips found for this run.</p>
        </div>
      ) : (
        <>
          {/* Navigation between payslips */}
          <div className="flex items-center justify-center gap-3">
            <button
              disabled={currentIdx === 0}
              onClick={() => setCurrentIdx((i) => i - 1)}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg transition-colors min-h-[48px]',
                currentIdx === 0
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-white text-[#333] shadow-sm hover:bg-gray-50'
              )}
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
            <div className="text-center min-w-[180px]">
              <p className="text-sm font-semibold text-[#1A1A2E]">
                {currentSlip?.employee.full_name}
              </p>
              <p className="text-xs text-gray-500">
                {currentIdx + 1} of {payslips.length}
              </p>
            </div>
            <button
              disabled={currentIdx === payslips.length - 1}
              onClick={() => setCurrentIdx((i) => i + 1)}
              className={cn(
                'flex h-12 w-12 items-center justify-center rounded-lg transition-colors min-h-[48px]',
                currentIdx === payslips.length - 1
                  ? 'bg-gray-100 text-gray-300 cursor-not-allowed'
                  : 'bg-white text-[#333] shadow-sm hover:bg-gray-50'
              )}
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          </div>

          {/* Payslip */}
          {currentSlip && <PayslipDisplay slip={currentSlip} run={run} />}

          {/* Signature area — only show if not yet signed */}
          {currentSlip && !currentSlip.signature_url && (
            <div className="mx-auto max-w-[700px]">
              <Card>
                <SignatureCanvas
                  onSave={handleSignature}
                  saving={savingSignature}
                />
              </Card>
            </div>
          )}
        </>
      )}
    </div>
  );
}
