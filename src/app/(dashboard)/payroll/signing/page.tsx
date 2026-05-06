'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { cn, formatCurrency, formatDate, getInitials } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidePanel } from '@/components/ui/slide-panel';
import type { Payslip, Employee, PayrollRun } from '@/types/database';
import {
  CheckCircle,
  PenTool,
  Printer,
  Check,
  ClipboardCheck,
} from 'lucide-react';

// ---------- types ----------

interface PayslipWithEmployee extends Payslip {
  employee: Pick<Employee, 'full_name' | 'pt_code' | 'id_number' | 'occupation' | 'photo_url'>;
}

// ---------- allowed roles ----------

const ALLOWED_ROLES = ['owner', 'supervisor', 'attendance_clerk', 'signer'] as const;

function canAccess(role: string): boolean {
  return (ALLOWED_ROLES as readonly string[]).includes(role);
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
    ctx.strokeStyle = '#1a1a1a';
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
    <div className="space-y-4">
      <p className="text-base font-bold text-[#333]">
        Employee Signature
      </p>
      <div className="rounded-lg border-2 border-dashed border-gray-300 bg-white p-1">
        <canvas
          ref={canvasRef}
          width={500}
          height={200}
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
      <div className="flex items-center gap-3">
        <Button
          size="lg"
          loading={saving}
          disabled={!hasStrokes}
          icon={<Check className="h-5 w-5" />}
          onClick={handleSave}
          className="flex-1 text-lg"
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

// ---------- payslip display (inline) ----------

function PayslipDisplay({
  slip,
  run,
}: {
  slip: PayslipWithEmployee;
  run: PayrollRun | null;
}) {
  return (
    <div className="mx-auto max-w-[700px] rounded-xl border border-gray-200 bg-white p-6 shadow-[0_2px_8px_rgba(0,0,0,0.06)]">
      {/* Header */}
      <div className="mb-5 border-b border-gray-200 pb-4">
        <h2 className="text-lg font-black text-[#333] tracking-tight">
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
          <InfoRow label="Employee" value={slip.employee.full_name} />
          <InfoRow label="PT Code" value={slip.employee.pt_code} />
          <InfoRow label="ID Number" value={slip.employee.id_number ?? '\u2014'} />
          <InfoRow label="Occupation" value={slip.employee.occupation ?? '\u2014'} />
        </div>
        <div className="space-y-1.5 text-right">
          {run && (
            <>
              <InfoRow label="Pay Period" value={`${run.week_start} to ${run.week_end}`} align="right" />
              <InfoRow label="Pay Date" value={formatDate(run.run_at)} align="right" />
            </>
          )}
        </div>
      </div>

      {/* Earnings */}
      <div className="mb-4">
        <h3 className="mb-2 text-xs font-bold text-[#333] uppercase tracking-wider">
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
        <h3 className="mb-2 text-xs font-bold text-[#333] uppercase tracking-wider">
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
      <div className="rounded-lg bg-[#1E40AF] px-5 py-4 flex items-center justify-between">
        <span className="text-sm font-bold text-white uppercase tracking-wider">
          Net Pay
        </span>
        <span className="text-xl font-black text-white">
          {formatCurrency(slip.net)}
        </span>
      </div>

      {/* Employer UIF */}
      <p className="mt-3 text-[10px] text-gray-400 text-center">
        Employer UIF contribution: {formatCurrency(slip.uif_employer)} &middot;
        BCEA Section 33 compliant payslip
      </p>

      {/* Existing signature */}
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

function InfoRow({
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

// ---------- employee row ----------

function EmployeeRow({
  slip,
  onSign,
}: {
  slip: PayslipWithEmployee;
  onSign: () => void;
}) {
  const isSigned = !!slip.signed_at;
  const initials = getInitials(slip.employee.full_name);

  return (
    <div
      className={cn(
        'flex items-center gap-4 rounded-xl border bg-white px-4 py-3 transition-colors',
        isSigned
          ? 'border-emerald-200 bg-emerald-50/30'
          : 'border-gray-200 hover:border-[#C4A35A]/40'
      )}
    >
      {/* Avatar */}
      <div className="shrink-0">
        {slip.employee.photo_url ? (
          <img
            src={slip.employee.photo_url}
            alt={slip.employee.full_name}
            className="h-12 w-12 rounded-full object-cover border-2 border-white shadow-sm"
          />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1E40AF] text-white font-bold text-sm shadow-sm">
            {initials}
          </div>
        )}
      </div>

      {/* Name + PT code */}
      <div className="flex-1 min-w-0">
        <p className="text-base font-bold text-[#333] truncate">
          {slip.employee.full_name}
        </p>
        <p className="text-sm text-gray-500">
          {slip.employee.pt_code}
        </p>
      </div>

      {/* Net pay */}
      <div className="shrink-0 text-right mr-2">
        <p className="text-base font-bold font-mono text-[#333]">
          {formatCurrency(slip.net)}
        </p>
      </div>

      {/* Status / action */}
      <div className="shrink-0">
        {isSigned ? (
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
            <CheckCircle className="h-6 w-6 text-emerald-600" />
          </div>
        ) : (
          <button
            onClick={onSign}
            className="flex h-12 items-center gap-2 rounded-lg bg-[#C4A35A] px-5 text-white font-bold text-sm hover:bg-[#b3943f] active:bg-[#a08536] transition-colors min-h-[48px] min-w-[48px] shadow-sm"
          >
            <PenTool className="h-4 w-4" />
            Sign
          </button>
        )}
      </div>
    </div>
  );
}

// ---------- main page ----------

export default function PayslipSigningPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const { toast } = useToast();

  const [payslips, setPayslips] = useState<PayslipWithEmployee[]>([]);
  const [run, setRun] = useState<PayrollRun | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSlip, setSelectedSlip] = useState<PayslipWithEmployee | null>(null);
  const [savingSignature, setSavingSignature] = useState(false);

  const listRef = useRef<HTMLDivElement>(null);

  const signedCount = payslips.filter((p) => !!p.signed_at).length;
  const totalCount = payslips.length;

  // Fetch the latest payroll run and its payslips
  const fetchData = useCallback(async () => {
    setLoading(true);

    // Get most recent generated or approved run
    const { data: latestRun } = await supabase
      .from('payroll_runs')
      .select('*')
      .in('status', ['generated', 'approved'])
      .order('run_at', { ascending: false })
      .limit(1)
      .single();

    if (!latestRun) {
      setLoading(false);
      return;
    }

    setRun(latestRun as PayrollRun);

    // Fetch payslips with employee data
    const { data: slips } = await supabase
      .from('payslips')
      .select('*, employee:employees(full_name, pt_code, id_number, occupation, photo_url)')
      .eq('payroll_run_id', latestRun.id)
      .order('created_at');

    const mapped = (slips ?? []).map((s: Record<string, unknown>) => ({
      ...s,
      employee: Array.isArray(s.employee) ? s.employee[0] : s.employee,
    })) as PayslipWithEmployee[];

    setPayslips(mapped);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle signature submission
  async function handleSignature(dataUrl: string) {
    if (!selectedSlip || !run) return;
    setSavingSignature(true);

    const signedAt = new Date().toISOString();
    const weekLabel = run.week_end?.replace(/-/g, '') ?? 'unknown';
    const storagePath = `signatures/${selectedSlip.employee_id}/payslip-${weekLabel}.png`;

    // Convert data URL to blob
    const blobRes = await fetch(dataUrl);
    const blob = await blobRes.blob();
    const sigFile = new File([blob], 'signature.png', { type: 'image/png' });

    const uploadForm = new FormData();
    uploadForm.append('file', sigFile);
    uploadForm.append('path', storagePath);

    const uploadRes = await fetch('/api/upload-file', { method: 'POST', body: uploadForm });
    const uploadData = await uploadRes.json();

    let signatureUrl: string;
    if (!uploadRes.ok) {
      console.error('Storage upload failed, using data URL fallback:', uploadData.error);
      signatureUrl = dataUrl;
    } else {
      signatureUrl = uploadData.url;
    }

    // Update payslip record
    const { error } = await supabase
      .from('payslips')
      .update({ signature_url: signatureUrl, signed_at: signedAt })
      .eq('id', selectedSlip.id);

    if (error) {
      toast('error', `Signature save failed: ${error.message}`);
      setSavingSignature(false);
      return;
    }

    // Save to employee documents (if storage upload worked)
    if (uploadRes.ok) {
      await supabase.from('employee_documents').insert({
        employee_id: selectedSlip.employee_id,
        doc_type: 'payslip_signature',
        file_url: signatureUrl,
        uploaded_at: signedAt,
      });
    }

    // Auto-file signed payslip PDF into employee folder
    try {
      const pdfRes = await fetch(`/api/pdf/payslip?id=${selectedSlip.id}`);
      if (pdfRes.ok) {
        const pdfBlob = await pdfRes.blob();
        const pdfWeekLabel = run.week_end?.replace(/-/g, '') || 'unknown';
        const pdfFile = new File([pdfBlob], `payslip-${pdfWeekLabel}-signed.pdf`, { type: 'application/pdf' });
        const pdfForm = new FormData();
        pdfForm.append('file', pdfFile);
        pdfForm.append('path', `documents/${selectedSlip.employee_id}/payslips/week-${run.week_end || 'unknown'}-signed.pdf`);
        await fetch('/api/upload-file', { method: 'POST', body: pdfForm });
      }
    } catch (e) {
      // Non-blocking — signature is already saved
      console.error('Auto-file PDF failed:', e);
    }

    toast('success', `Signature captured for ${selectedSlip.employee.full_name}`);

    // Close panel
    setSelectedSlip(null);
    setSavingSignature(false);

    // Refresh data
    await fetchData();

    // Auto-scroll to next unsigned after a brief render tick
    requestAnimationFrame(() => {
      const container = listRef.current;
      if (!container) return;
      const nextUnsigned = container.querySelector('[data-unsigned="true"]');
      if (nextUnsigned) {
        nextUnsigned.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // ---------- render ----------

  if (!user) return null;

  if (!canAccess(user.role)) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1E40AF] border-t-transparent" />
      </div>
    );
  }

  if (!run) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <ClipboardCheck className="h-12 w-12 text-gray-300" />
        <p className="text-base text-gray-500 font-medium">No payroll run ready for signing.</p>
        <p className="text-sm text-gray-400">Generate or approve a payroll run first.</p>
      </div>
    );
  }

  const progressPct = totalCount > 0 ? Math.round((signedCount / totalCount) * 100) : 0;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1E40AF] text-white">
            <ClipboardCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[#333] tracking-tight">
              Payslip Signing
            </h1>
            <p className="text-sm text-gray-500">
              {run.week_start} to {run.week_end}
            </p>
          </div>
        </div>

        {/* Progress summary */}
        <div className="mt-4 rounded-xl bg-white border border-gray-100 shadow-sm px-5 py-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">
              {signedCount} of {totalCount} signed
            </span>
            <Badge color={progressPct === 100 ? 'green' : progressPct > 50 ? 'blue' : 'amber'}>
              {progressPct}%
            </Badge>
          </div>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all duration-700',
                progressPct === 100 ? 'bg-emerald-500' : 'bg-[#1E40AF]'
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* Employee checklist */}
      <div ref={listRef} className="flex-1 space-y-2 overflow-y-auto pb-28">
        {payslips.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-gray-500">No payslips found for this run.</p>
          </div>
        ) : (
          payslips.map((slip) => (
            <div key={slip.id} data-unsigned={!slip.signed_at ? 'true' : 'false'}>
              <EmployeeRow
                slip={slip}
                onSign={() => setSelectedSlip(slip)}
              />
            </div>
          ))
        )}
      </div>

      {/* Bottom bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-200 bg-white/95 backdrop-blur-sm px-4 py-3 md:left-64">
        <div className="flex items-center gap-4 max-w-3xl mx-auto">
          {/* Mini progress bar */}
          <div className="flex-1">
            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
              <div
                className={cn(
                  'h-full rounded-full transition-all duration-500',
                  progressPct === 100 ? 'bg-emerald-500' : 'bg-[#1E40AF]'
                )}
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {signedCount}/{totalCount} signed
            </p>
          </div>

          {/* Print all signed */}
          <Button
            variant="primary"
            size="lg"
            icon={<Printer className="h-5 w-5" />}
            disabled={signedCount === 0}
            onClick={() => {
              window.open(`/api/pdf/payslips-all?run=${run.id}`, '_blank');
            }}
          >
            Print All Signed
          </Button>
        </div>
      </div>

      {/* Slide panel — payslip + signature */}
      <SlidePanel
        open={!!selectedSlip}
        onClose={() => setSelectedSlip(null)}
        title={selectedSlip?.employee.full_name ?? 'Payslip'}
        width="max-w-2xl"
      >
        {selectedSlip && (
          <div className="space-y-6 pb-8">
            <PayslipDisplay slip={selectedSlip} run={run} />

            {/* Signature canvas — only if not already signed */}
            {!selectedSlip.signature_url ? (
              <div className="mx-auto max-w-[700px]">
                <Card>
                  <SignatureCanvas
                    onSave={handleSignature}
                    saving={savingSignature}
                  />
                </Card>
              </div>
            ) : (
              <div className="mx-auto max-w-[700px] text-center py-4">
                <Badge color="green" className="text-sm px-4 py-1">
                  <CheckCircle className="h-4 w-4 mr-1 inline" />
                  Already signed {selectedSlip.signed_at ? formatDate(selectedSlip.signed_at) : ''}
                </Badge>
              </div>
            )}
          </div>
        )}
      </SlidePanel>
    </div>
  );
}
