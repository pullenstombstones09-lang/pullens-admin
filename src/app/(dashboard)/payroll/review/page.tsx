'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { format, startOfWeek, addDays, lastDayOfMonth } from 'date-fns';
import { Check, X, Clock, AlertTriangle, Play, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { createClient } from '@/lib/supabase/client';
import { calculatePayroll, calculateLateMinutes, type PayrollInput, type PayrollResult } from '@/lib/payroll-engine';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { TimePicker } from '@/components/ui/time-picker';
import type { Employee, Attendance, AttendanceStatus, Loan, OvertimeRequest } from '@/types/database';

// ── Types ────────────────────────────────────────────────────────────────────

interface EmployeePayRow {
  employee: Employee;
  attendance: Map<string, Attendance>; // date -> record
  payroll: PayrollResult | null;
  loans: Loan[];
}

interface EditingCell {
  employeeId: string;
  date: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function toDateString(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

function getMondayOfWeek(dateStr: string): Date {
  return startOfWeek(new Date(dateStr + 'T00:00:00'), { weekStartsOn: 1 });
}

function getWeekDates(monday: Date): string[] {
  return Array.from({ length: 6 }, (_, i) => toDateString(addDays(monday, i)));
}

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
  { value: 'sick', label: 'Sick' },
  { value: 'ph', label: 'PH' },
];

function isLastWeekOfMonth(monday: Date): boolean {
  const friday = addDays(monday, 4);
  const lastDay = lastDayOfMonth(friday);
  const lastFri = new Date(lastDay);
  while (lastFri.getDay() !== 5) lastFri.setDate(lastFri.getDate() - 1);
  return friday.getTime() === lastFri.getTime() ||
    (monday <= lastFri && friday >= lastFri);
}

function getDefaultTimesForDay(dayIdx: number): { time_in: string; time_out: string } {
  if (dayIdx === 5) return { time_in: '08:00', time_out: '13:00' }; // Saturday
  if (dayIdx === 4) return { time_in: '08:00', time_out: '16:00' }; // Friday
  return { time_in: '08:00', time_out: '17:00' }; // Mon-Thu
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function PayrollReviewPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  // Week state
  const today = new Date();
  const [weekMonday, setWeekMonday] = useState<Date>(
    startOfWeek(today, { weekStartsOn: 1 })
  );
  const weekDates = getWeekDates(weekMonday);
  const weekStart = weekDates[0]; // Monday
  const weekEnd = weekDates[4]; // Friday
  const satDate = weekDates[5]; // Saturday

  // Data state
  const [rows, setRows] = useState<EmployeePayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);

  // Inline edit state
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editStatus, setEditStatus] = useState<AttendanceStatus>('present');
  const [editTimeIn, setEditTimeIn] = useState('08:00');
  const [editTimeOut, setEditTimeOut] = useState('17:00');
  const [editSaving, setEditSaving] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Loan edit state
  const [editingLoan, setEditingLoan] = useState<string | null>(null); // employeeId
  const [loanEdits, setLoanEdits] = useState<Map<string, number>>(new Map()); // loanId -> new weekly_deduction
  const [loanSaving, setLoanSaving] = useState(false);
  const loanPopoverRef = useRef<HTMLDivElement>(null);

  // ── Close popover on outside click ──────────────────────────────────────
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setEditing(null);
      }
      if (loanPopoverRef.current && !loanPopoverRef.current.contains(e.target as Node)) {
        setEditingLoan(null);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Load data ──────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Fetch employees, attendance, loans, OT in parallel
      const [empRes, attRes, loanRes, otRes] = await Promise.all([
        supabase
          .from('employees')
          .select('*')
          .eq('status', 'active')
          .order('full_name'),
        supabase
          .from('attendance')
          .select('*')
          .gte('date', weekStart)
          .lte('date', satDate),
        supabase
          .from('loans')
          .select('*')
          .eq('status', 'active'),
        supabase
          .from('overtime_requests')
          .select('*')
          .gte('date', weekStart)
          .lte('date', weekEnd)
          .eq('status', 'approved'),
      ]);

      if (empRes.error) throw new Error(empRes.error.message);
      if (attRes.error) throw new Error(attRes.error.message);

      const employees = (empRes.data || []) as Employee[];
      const attendance = (attRes.data || []) as Attendance[];
      const loans = (loanRes.data || []) as Loan[];
      const otRequests = (otRes.data || []) as OvertimeRequest[];

      // Index attendance by employee
      const attMap = new Map<string, Map<string, Attendance>>();
      for (const a of attendance) {
        if (!attMap.has(a.employee_id)) attMap.set(a.employee_id, new Map());
        attMap.get(a.employee_id)!.set(a.date, a);
      }

      // Index loans by employee
      const loanMap = new Map<string, Loan[]>();
      for (const l of loans) {
        if (!loanMap.has(l.employee_id)) loanMap.set(l.employee_id, []);
        loanMap.get(l.employee_id)!.push(l);
      }

      // Index OT by employee
      const otMap = new Map<string, OvertimeRequest[]>();
      for (const ot of otRequests) {
        if (!otMap.has(ot.employee_id)) otMap.set(ot.employee_id, []);
        otMap.get(ot.employee_id)!.push(ot);
      }

      const isLWOM = isLastWeekOfMonth(weekMonday);

      // Build rows with payroll calculation
      const newRows: EmployeePayRow[] = employees.map((emp) => {
        const empAtt = attMap.get(emp.id) || new Map<string, Attendance>();
        const empLoans = loanMap.get(emp.id) || [];
        const empOt = otMap.get(emp.id) || [];

        // Build attendance array for payroll engine (filter Sat for 40hr staff)
        const attArray: Attendance[] = [];
        for (const [date, record] of empAtt) {
          const dayOfWeek = new Date(date + 'T00:00:00').getDay();
          if (dayOfWeek === 6 && (emp.weekly_hours || 40) < 45) continue;
          attArray.push(record);
        }

        const input: PayrollInput = {
          employee: emp,
          attendance: attArray,
          overtimeRequests: empOt,
          activeLoans: empLoans,
          pettyShortfall: 0,
          isLastWeekOfMonth: isLWOM,
        };

        let payroll: PayrollResult | null = null;
        try {
          payroll = calculatePayroll(input);
        } catch (e) {
          console.error(`Payroll calc failed for ${emp.full_name}:`, e);
        }

        return { employee: emp, attendance: empAtt, payroll, loans: empLoans };
      });

      setRows(newRows);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [weekStart, weekEnd, satDate]);

  useEffect(() => {
    if (!authLoading && user) {
      if (!hasPermission(user.role, 'review_payroll')) {
        router.replace('/payroll');
        return;
      }
      loadData();
    }
  }, [authLoading, user, router, loadData]);

  // ── Recalculate single employee payroll ─────────────────────────────────
  function recalcEmployee(row: EmployeePayRow): PayrollResult | null {
    const attArray: Attendance[] = [];
    for (const [date, record] of row.attendance) {
      const dayOfWeek = new Date(date + 'T00:00:00').getDay();
      if (dayOfWeek === 6 && (row.employee.weekly_hours || 40) < 45) continue;
      attArray.push(record);
    }

    try {
      return calculatePayroll({
        employee: row.employee,
        attendance: attArray,
        overtimeRequests: [],
        activeLoans: row.loans,
        pettyShortfall: 0,
        isLastWeekOfMonth: isLastWeekOfMonth(weekMonday),
      });
    } catch {
      return null;
    }
  }

  // ── Open cell editor ────────────────────────────────────────────────────
  function openEditor(employeeId: string, date: string, dayIdx: number) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (!row) return;

    const att = row.attendance.get(date);
    if (att) {
      setEditStatus(att.status);
      setEditTimeIn((att.time_in || '').slice(0, 5) || '08:00');
      setEditTimeOut((att.time_out || '').slice(0, 5) || '17:00');
    } else {
      const defaults = getDefaultTimesForDay(dayIdx);
      setEditStatus('present');
      setEditTimeIn(defaults.time_in);
      setEditTimeOut(defaults.time_out);
    }

    setEditing({ employeeId, date });
  }

  // ── Save cell edit ──────────────────────────────────────────────────────
  async function saveEdit() {
    if (!editing) return;
    setEditSaving(true);

    const { employeeId, date } = editing;
    const noTimeStatuses: AttendanceStatus[] = ['absent', 'leave', 'sick', 'ph', 'short_time'];
    const clearTimes = noTimeStatuses.includes(editStatus);

    // Auto-calculate late minutes
    let lateMin = 0;
    if (!clearTimes && (editStatus === 'present' || editStatus === 'late')) {
      lateMin = calculateLateMinutes(editTimeIn);
    }

    const finalStatus = lateMin > 0 ? 'late' : (editStatus === 'late' ? 'present' : editStatus);

    const record = {
      employee_id: employeeId,
      date,
      status: finalStatus,
      time_in: clearTimes ? null : editTimeIn,
      time_out: clearTimes ? null : editTimeOut,
      late_minutes: clearTimes ? 0 : lateMin,
      reason: null,
    };

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ date, records: [record] }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Save failed');
      }

      // Update local state
      setRows((prev) =>
        prev.map((row) => {
          if (row.employee.id !== employeeId) return row;

          const newAtt = new Map(row.attendance);
          newAtt.set(date, {
            id: '', // will be refreshed
            employee_id: employeeId,
            date,
            status: finalStatus as AttendanceStatus,
            time_in: clearTimes ? null : editTimeIn,
            time_out: clearTimes ? null : editTimeOut,
            late_minutes: clearTimes ? 0 : lateMin,
            reason: null,
            captured_by: null,
            captured_at: new Date().toISOString(),
          });

          const updatedRow = { ...row, attendance: newAtt };
          updatedRow.payroll = recalcEmployee(updatedRow);
          return updatedRow;
        })
      );

      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
    } finally {
      setEditSaving(false);
    }
  }

  // ── Open loan editor ─────────────────────────────────────────────────
  function openLoanEditor(employeeId: string) {
    const row = rows.find((r) => r.employee.id === employeeId);
    if (!row || row.loans.length === 0) return;
    const edits = new Map<string, number>();
    row.loans.forEach((l) => edits.set(l.id, l.weekly_deduction));
    setLoanEdits(edits);
    setEditingLoan(employeeId);
  }

  // ── Save loan edits ────────────────────────────────────────────────
  async function saveLoanEdits() {
    if (!editingLoan) return;
    setLoanSaving(true);

    try {
      for (const [loanId, newDeduction] of loanEdits) {
        await supabase
          .from('loans')
          .update({ weekly_deduction: newDeduction })
          .eq('id', loanId);
      }

      // Update local state and recalculate
      setRows((prev) =>
        prev.map((row) => {
          if (row.employee.id !== editingLoan) return row;
          const updatedLoans = row.loans.map((l) => ({
            ...l,
            weekly_deduction: loanEdits.get(l.id) ?? l.weekly_deduction,
          }));
          const updatedRow = { ...row, loans: updatedLoans };
          updatedRow.payroll = recalcEmployee(updatedRow);
          return updatedRow;
        })
      );

      setEditingLoan(null);
    } catch {
      setError('Failed to save loan changes');
    } finally {
      setLoanSaving(false);
    }
  }

  // ── Run Final Payroll ──────────────────────────────────────────────────
  async function runFinalPayroll() {
    setRunning(true);
    setError(null);

    try {
      const res = await fetch('/api/payroll/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ week_start: weekStart, week_end: weekEnd }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to run payroll');
      }

      router.push('/payroll');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Payroll run failed');
      setRunning(false);
    }
  }

  // ── Week navigation ─────────────────────────────────────────────────────
  function prevWeek() {
    setWeekMonday((m) => addDays(m, -7));
  }
  function nextWeek() {
    setWeekMonday((m) => addDays(m, 7));
  }

  // ── Derived totals ──────────────────────────────────────────────────────
  const totals = rows.reduce(
    (acc, r) => {
      if (!r.payroll) return acc;
      acc.hrs += r.payroll.ordinary_hours;
      acc.late += r.payroll.late_minutes;
      acc.ot += r.payroll.ot_hours;
      acc.gross += r.payroll.gross;
      acc.loans += r.payroll.loan_deduction;
      acc.deductions += r.payroll.uif_employee + r.payroll.paye + r.payroll.loan_deduction + r.payroll.garnishee + r.payroll.petty_shortfall;
      acc.net += r.payroll.net;
      return acc;
    },
    { hrs: 0, late: 0, ot: 0, gross: 0, loans: 0, deductions: 0, net: 0 }
  );

  // ── Anomaly detection ──────────────────────────────────────────────────
  function hasAnomaly(row: EmployeePayRow): boolean {
    if (!row.payroll) return true;
    if (row.payroll.net < 0) return true;
    if (row.payroll.ordinary_hours === 0) return true;
    // Missing attendance days
    const expectedDays = (row.employee.weekly_hours || 40) >= 45 ? 6 : 5;
    if (row.attendance.size < expectedDays) return true;
    return false;
  }

  // ── Render helpers ─────────────────────────────────────────────────────

  function renderDayCell(row: EmployeePayRow, date: string, dayIdx: number) {
    const is45hr = (row.employee.weekly_hours || 40) >= 45;
    const isSat = dayIdx === 5;

    // Saturday greyed out for 40hr staff
    if (isSat && !is45hr) {
      return (
        <td key={date} className="px-1 py-1 text-center">
          <div className="w-10 h-8 rounded bg-gray-100 flex items-center justify-center mx-auto">
            <span className="text-gray-300 text-xs">--</span>
          </div>
        </td>
      );
    }

    const att = row.attendance.get(date);
    const isEditing = editing?.employeeId === row.employee.id && editing?.date === date;

    let cellContent: React.ReactNode;
    let cellBg = '';

    if (!att) {
      // No record
      cellContent = <span className="text-gray-300 text-xs">--</span>;
      cellBg = 'bg-gray-50 border border-dashed border-gray-200';
    } else {
      switch (att.status) {
        case 'present':
          cellBg = 'bg-emerald-500';
          cellContent = (
            <Check size={14} className="text-white" strokeWidth={3} />
          );
          break;
        case 'late':
          cellBg = 'bg-amber-400';
          cellContent = (
            <span className="text-white text-[9px] font-bold">
              -{att.late_minutes}m
            </span>
          );
          break;
        case 'absent':
          cellBg = 'bg-red-500';
          cellContent = <X size={14} className="text-white" strokeWidth={3} />;
          break;
        case 'leave':
        case 'sick':
          cellBg = 'bg-blue-500';
          cellContent = (
            <span className="text-white text-[9px] font-bold">
              {att.status === 'sick' ? 'SK' : 'LV'}
            </span>
          );
          break;
        case 'ph':
          cellBg = 'bg-purple-500';
          cellContent = (
            <span className="text-white text-[9px] font-bold">PH</span>
          );
          break;
        default:
          cellBg = 'bg-gray-400';
          cellContent = (
            <span className="text-white text-[9px] font-bold">ST</span>
          );
      }
    }

    return (
      <td key={date} className="px-1 py-1 text-center relative">
        <button
          onClick={() => openEditor(row.employee.id, date, dayIdx)}
          className={`w-10 h-8 rounded flex items-center justify-center mx-auto cursor-pointer hover:opacity-80 transition-opacity ${cellBg}`}
        >
          {cellContent}
        </button>

        {/* Inline edit popover */}
        {isEditing && (
          <div
            ref={popoverRef}
            className="absolute z-50 top-full left-1/2 -translate-x-1/2 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl p-3 w-56"
            style={{ minWidth: 220 }}
          >
            <div className="text-xs font-semibold text-gray-500 mb-2">
              {DAY_LABELS[dayIdx]} {format(new Date(date + 'T00:00:00'), 'd MMM')}
            </div>

            {/* Status */}
            <select
              value={editStatus}
              onChange={(e) => setEditStatus(e.target.value as AttendanceStatus)}
              className="w-full h-10 rounded-lg border border-gray-300 px-2 text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30"
            >
              {STATUS_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Times — only for present/late */}
            {!['absent', 'leave', 'sick', 'ph', 'short_time'].includes(editStatus) && (
              <div className="space-y-2 mb-2">
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Time In</label>
                  <TimePicker
                    value={editTimeIn}
                    onChange={setEditTimeIn}
                  />
                </div>
                <div>
                  <label className="text-[10px] text-gray-500 block mb-0.5">Time Out</label>
                  <TimePicker
                    value={editTimeOut}
                    onChange={setEditTimeOut}
                  />
                </div>
                {/* Auto-calculated late */}
                {calculateLateMinutes(editTimeIn) > 0 && (
                  <div className="text-xs text-amber-600 font-medium">
                    Late: {calculateLateMinutes(editTimeIn)} min dock
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-2 mt-2">
              <button
                onClick={() => setEditing(null)}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={saveEdit}
                disabled={editSaving}
                className="flex-1 h-10 rounded-lg text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] transition-colors disabled:opacity-50 min-h-[48px]"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        )}
      </td>
    );
  }

  // ── Loading / Error / Auth guard ────────────────────────────────────────

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-400 text-sm">
        Loading payroll review...
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-red-700 text-sm">
          <span className="font-semibold">Error: </span>{error}
        </div>
        <Button variant="secondary" size="sm" className="mt-4" onClick={loadData}>
          Retry
        </Button>
      </div>
    );
  }

  const weekLabel = `${format(weekMonday, 'd MMM')} - ${format(addDays(weekMonday, 5), 'd MMM yyyy')}`;
  const canRunPayroll = user ? hasPermission(user.role, 'run_payroll') : false;

  // Anomaly rows
  const anomalyRows = rows.filter(hasAnomaly);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-gray-900 tracking-tight">Payroll Review</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {rows.length} employees &middot; Total net: {formatCurrency(totals.net)}
          </p>
        </div>

        {/* Week selector */}
        <div className="flex items-center gap-2">
          <button
            onClick={prevWeek}
            className="h-10 w-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors min-w-[48px] min-h-[48px]"
          >
            <ChevronLeft size={18} />
          </button>
          <div className="text-sm font-semibold text-gray-700 min-w-[160px] text-center">
            {weekLabel}
          </div>
          <button
            onClick={nextWeek}
            className="h-10 w-10 rounded-lg bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors min-w-[48px] min-h-[48px]"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* The Grid */}
      <Card padding="none">
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="sticky left-0 z-20 bg-gray-50 px-3 py-3 text-left font-semibold text-gray-700 whitespace-nowrap min-w-[160px]">
                  Name
                </th>
                {weekDates.map((d, i) => (
                  <th key={d} className="px-1 py-3 text-center font-semibold text-gray-700 whitespace-nowrap w-12">
                    <div className="text-xs">{DAY_LABELS[i]}</div>
                    <div className="text-[10px] text-gray-400 font-normal">
                      {format(new Date(d + 'T00:00:00'), 'dd')}
                    </div>
                  </th>
                ))}
                <th className="px-2 py-3 text-right font-semibold text-gray-700 whitespace-nowrap w-14">Hrs</th>
                <th className="px-2 py-3 text-right font-semibold text-gray-700 whitespace-nowrap w-14">Late</th>
                <th className="px-2 py-3 text-right font-semibold text-gray-700 whitespace-nowrap w-14">OT</th>
                <th className="px-2 py-3 text-right font-semibold text-gray-700 whitespace-nowrap w-20">Gross</th>
                <th className="px-2 py-3 text-right font-semibold text-gray-700 whitespace-nowrap w-20">Loans</th>
                <th className="px-2 py-3 text-right font-semibold text-gray-700 whitespace-nowrap w-20">Deduct</th>
                <th className="px-2 py-3 text-right font-semibold text-gray-700 whitespace-nowrap w-20">Net</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => {
                const p = row.payroll;
                const anomaly = hasAnomaly(row);
                const totalDeductions = p
                  ? p.uif_employee + p.paye + p.loan_deduction + p.garnishee + p.petty_shortfall
                  : 0;

                return (
                  <tr
                    key={row.employee.id}
                    className={`border-b border-gray-100 transition-colors ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    } ${anomaly ? 'border-l-4 border-l-amber-400' : ''}`}
                  >
                    {/* Name — sticky */}
                    <td className={`sticky left-0 z-10 px-3 py-2 whitespace-nowrap ${
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'
                    }`}>
                      <div className="flex items-center gap-2">
                        <div>
                          <p className="font-semibold text-sm text-gray-900 truncate max-w-[130px]">
                            {row.employee.full_name}
                          </p>
                          <p className="text-[10px] text-gray-400 font-mono">{row.employee.pt_code}</p>
                        </div>
                      </div>
                    </td>

                    {/* Day cells */}
                    {weekDates.map((d, i) => renderDayCell(row, d, i))}

                    {/* Hours */}
                    <td className="px-2 py-2 text-right font-mono text-xs text-gray-700">
                      {p ? p.ordinary_hours.toFixed(1) : '--'}
                    </td>

                    {/* Late */}
                    <td className={`px-2 py-2 text-right font-mono text-xs ${
                      p && p.late_minutes > 0 ? 'text-amber-600 font-semibold' : 'text-gray-400'
                    }`}>
                      {p ? (p.late_minutes > 0 ? `${p.late_minutes}m` : '--') : '--'}
                    </td>

                    {/* OT */}
                    <td className={`px-2 py-2 text-right font-mono text-xs ${
                      p && p.ot_hours > 0 ? 'text-[#1E40AF] font-semibold' : 'text-gray-400'
                    }`}>
                      {p ? (p.ot_hours > 0 ? p.ot_hours.toFixed(1) : '--') : '--'}
                    </td>

                    {/* Gross */}
                    <td className="px-2 py-2 text-right font-mono text-xs text-gray-700">
                      {p ? formatCurrency(p.gross) : '--'}
                    </td>

                    {/* Loans */}
                    <td className="px-2 py-2 text-right relative">
                      {row.loans.length > 0 ? (
                        <button
                          onClick={() => openLoanEditor(row.employee.id)}
                          className={`font-mono text-xs font-semibold hover:underline transition-colors ${
                            p && p.loan_deduction > 0 ? 'text-amber-600' : 'text-gray-400'
                          }`}
                          title="Edit loan deductions"
                        >
                          {p && p.loan_deduction > 0 ? `-${formatCurrency(p.loan_deduction)}` : 'R0'}
                        </button>
                      ) : (
                        <span className="font-mono text-xs text-gray-300">--</span>
                      )}

                      {/* Loan edit popover */}
                      {editingLoan === row.employee.id && (
                        <div
                          ref={loanPopoverRef}
                          className="absolute z-50 top-full right-0 mt-1 bg-white rounded-xl border border-gray-200 shadow-xl p-4 w-72"
                        >
                          <p className="text-xs font-semibold text-gray-700 mb-3">
                            Loans — {row.employee.full_name}
                          </p>
                          <div className="space-y-3">
                            {row.loans.map((loan) => (
                              <div key={loan.id} className="space-y-1">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-500">{loan.purpose || 'Loan'}</span>
                                  <span className="text-gray-700 font-medium">
                                    {formatCurrency(loan.outstanding)} left
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-400">R</span>
                                  <input
                                    type="number"
                                    min="0"
                                    step="50"
                                    value={loanEdits.get(loan.id) ?? loan.weekly_deduction}
                                    onChange={(e) => {
                                      const val = parseFloat(e.target.value) || 0;
                                      setLoanEdits((prev) => {
                                        const next = new Map(prev);
                                        next.set(loan.id, val);
                                        return next;
                                      });
                                    }}
                                    className="flex-1 h-9 rounded-lg border border-gray-300 px-2 text-xs font-mono text-gray-800 focus:outline-none focus:ring-2 focus:ring-[#1E40AF]/30"
                                  />
                                  <span className="text-xs text-gray-400">/week</span>
                                </div>
                              </div>
                            ))}
                          </div>
                          <div className="flex gap-2 mt-4">
                            <button
                              onClick={() => setEditingLoan(null)}
                              className="flex-1 h-10 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveLoanEdits}
                              disabled={loanSaving}
                              className="flex-1 h-10 rounded-lg text-sm font-medium text-white bg-[#1E40AF] hover:bg-[#1E3A8A] transition-colors disabled:opacity-50"
                            >
                              {loanSaving ? 'Saving...' : 'Save'}
                            </button>
                          </div>
                        </div>
                      )}
                    </td>

                    {/* Deductions */}
                    <td className={`px-2 py-2 text-right font-mono text-xs ${
                      totalDeductions > 0 ? 'text-red-600' : 'text-gray-400'
                    }`}>
                      {p ? (totalDeductions > 0 ? `-${formatCurrency(totalDeductions)}` : '--') : '--'}
                    </td>

                    {/* Net */}
                    <td className="px-2 py-2 text-right font-mono text-sm font-bold text-gray-900">
                      {p ? formatCurrency(p.net) : '--'}
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Summary footer */}
            <tfoot>
              <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                <td className="sticky left-0 z-10 bg-gray-100 px-3 py-3 text-sm text-gray-700">
                  Totals
                </td>
                {/* Empty day cells */}
                {weekDates.map((d) => (
                  <td key={d} className="px-1 py-3" />
                ))}
                <td className="px-2 py-3 text-right font-mono text-xs text-gray-700">
                  {totals.hrs.toFixed(1)}
                </td>
                <td className={`px-2 py-3 text-right font-mono text-xs ${
                  totals.late > 0 ? 'text-amber-600' : 'text-gray-400'
                }`}>
                  {totals.late > 0 ? `${totals.late}m` : '--'}
                </td>
                <td className={`px-2 py-3 text-right font-mono text-xs ${
                  totals.ot > 0 ? 'text-[#1E40AF]' : 'text-gray-400'
                }`}>
                  {totals.ot > 0 ? totals.ot.toFixed(1) : '--'}
                </td>
                <td className="px-2 py-3 text-right font-mono text-xs text-gray-700">
                  {formatCurrency(totals.gross)}
                </td>
                <td className={`px-2 py-3 text-right font-mono text-xs ${
                  totals.loans > 0 ? 'text-amber-600' : 'text-gray-400'
                }`}>
                  {totals.loans > 0 ? `-${formatCurrency(totals.loans)}` : '--'}
                </td>
                <td className="px-2 py-3 text-right font-mono text-xs text-red-600">
                  {totals.deductions > 0 ? `-${formatCurrency(totals.deductions)}` : '--'}
                </td>
                <td className="px-2 py-3 text-right font-mono text-sm font-bold text-gray-900">
                  {formatCurrency(totals.net)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>

      {/* Anomaly warnings */}
      {anomalyRows.length > 0 && (
        <Card padding="sm">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle size={16} className="text-amber-500" />
            <span className="text-sm font-semibold text-gray-700">
              {anomalyRows.length} anomal{anomalyRows.length === 1 ? 'y' : 'ies'} detected
            </span>
          </div>
          <ul className="space-y-1">
            {anomalyRows.map((row) => {
              const reasons: string[] = [];
              if (!row.payroll) reasons.push('Payroll calculation failed');
              else {
                if (row.payroll.net < 0) reasons.push('Negative net pay');
                if (row.payroll.ordinary_hours === 0) reasons.push('Zero hours');
              }
              const expectedDays = (row.employee.weekly_hours || 40) >= 45 ? 6 : 5;
              if (row.attendance.size < expectedDays) {
                reasons.push(`Missing attendance (${row.attendance.size}/${expectedDays} days)`);
              }
              return (
                <li key={row.employee.id} className="text-xs text-gray-600 flex items-start gap-2 py-1">
                  <span className="font-medium text-gray-800 min-w-[120px]">{row.employee.full_name}</span>
                  <span className="text-amber-600">{reasons.join(', ')}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Run Final Payroll button */}
      {canRunPayroll && (
        <div className="pt-2 pb-6">
          <Button
            size="lg"
            className="w-full bg-[#C4A35A] hover:bg-[#b3933f] active:bg-[#a08430] text-white shadow-[0_1px_2px_rgba(0,0,0,0.1),0_2px_8px_rgba(196,163,90,0.35)] min-h-[48px]"
            icon={<Play size={18} />}
            loading={running}
            disabled={rows.length === 0}
            onClick={runFinalPayroll}
          >
            Run Final Payroll - {rows.length} employees &middot; {formatCurrency(totals.net)}
          </Button>
        </div>
      )}
    </div>
  );
}
