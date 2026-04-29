'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/components/ui/toast';
import { cn, getInitials, formatCurrency } from '@/lib/utils';
import { startOfWeek } from 'date-fns';
import { calculateLateMinutes } from '@/lib/payroll-engine';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TimePicker } from '@/components/ui/time-picker';
import { useUndo } from '@/components/ui/undo-toast';
import type { Employee, AttendanceStatus } from '@/types/database';
import {
  CalendarDays,
  CheckCircle,
  Save,
  Clock,
  Users,
  Download,
} from 'lucide-react';
import Link from 'next/link';

// ---------- types ----------

interface RegisterRow {
  employee_id: string;
  pt_code: string;
  full_name: string;
  photo_url: string | null;
  weekly_wage: number;
  emp_status: string; // employee status (active/terminated)
  status: AttendanceStatus;
  time_in: string;
  time_out: string;
  late_minutes: number;
  late_deduction: number;
  ot_minutes: number;
  reason: string;
  existing_id: string | null; // attendance record id if already saved
}

const STATUS_OPTIONS: { value: AttendanceStatus; label: string }[] = [
  { value: 'present', label: 'Present' },
  { value: 'late', label: 'Late' },
  { value: 'absent', label: 'Absent' },
  { value: 'leave', label: 'Leave' },
  { value: 'sick', label: 'Sick' },
  { value: 'ph', label: 'Public Holiday' },
  { value: 'short_time', label: 'Short Time' },
];

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-50 text-emerald-700 border-emerald-300',
  late: 'bg-amber-50 text-amber-700 border-amber-300',
  absent: 'bg-red-50 text-red-700 border-red-300',
  leave: 'bg-blue-50 text-blue-700 border-blue-300',
  sick: 'bg-purple-50 text-purple-700 border-purple-300',
  ph: 'bg-indigo-50 text-indigo-700 border-indigo-300',
  short_time: 'bg-gray-100 text-gray-600 border-gray-300',
};

const BADGE_COLORS: Record<AttendanceStatus, 'green' | 'amber' | 'red' | 'blue' | 'purple' | 'grey' | 'yellow'> = {
  present: 'green',
  late: 'amber',
  absent: 'red',
  leave: 'blue',
  sick: 'purple',
  ph: 'blue',
  short_time: 'grey',
};

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function computeLateDeduction(lateMinutes: number, weeklyWage: number): number {
  const hourlyRate = weeklyWage / 40;
  return Math.round((lateMinutes / 60) * hourlyRate * 100) / 100;
}

// ---------- component ----------

export default function RegisterPage() {
  const { user } = useAuth();
  const supabase = createClient();
  const { toast } = useToast();

  const [selectedDate, setSelectedDate] = useState(toDateString(new Date()));
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedForDate, setSavedForDate] = useState(false);
  const [showSavedOverlay, setShowSavedOverlay] = useState(false);

  const [showInactive, setShowInactive] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [publicHoliday, setPublicHoliday] = useState<string | null>(null);
  const { showUndo } = useUndo();

  const isAdmin = user?.role === 'owner';
  const canEdit = user ? hasPermission(user.role, 'edit_register') : false;
  // Staff can't edit after save, only owner can override
  const editLocked = savedForDate && !isAdmin;

  // Fetch employees + existing attendance for the selected date
  const fetchData = useCallback(async () => {
    setLoading(true);

    const res = await fetch(`/api/register?date=${selectedDate}&showInactive=${showInactive}`);
    const data = await res.json();

    const employees = (data.employees ?? []) as Employee[];
    const attendance = (data.attendance ?? []) as Array<{
      id: string;
      employee_id: string;
      status: AttendanceStatus;
      time_in: string | null;
      time_out: string | null;
      late_minutes: number;
      reason: string | null;
    }>;

    const attMap = new Map(attendance.map((a) => [a.employee_id, a]));

    // Check if selected date is a public holiday
    const { data: holiday } = await supabase
      .from('public_holidays')
      .select('name')
      .eq('date', selectedDate)
      .maybeSingle();

    setPublicHoliday(holiday?.name || null);

    const hasExistingRecords = attendance.length > 0;

    // If it's a public holiday with no records yet, auto-create PH records
    if (holiday && !hasExistingRecords) {
      const activeEmps = employees.filter(e => e.status === 'active');
      const phRows = activeEmps.map(emp => ({
        employee_id: emp.id,
        date: selectedDate,
        status: 'ph' as AttendanceStatus,
        time_in: null,
        time_out: null,
        late_minutes: 0,
        reason: holiday.name,
      }));

      if (phRows.length > 0) {
        await supabase.from('attendance').upsert(phRows, { onConflict: 'employee_id,date' });

        // Re-fetch attendance after auto-save
        const res2 = await fetch(`/api/register?date=${selectedDate}&showInactive=${showInactive}`);
        const data2 = await res2.json();
        const savedAttendance = (data2.attendance ?? []) as Array<{
          id: string;
          employee_id: string;
          status: AttendanceStatus;
          time_in: string | null;
          time_out: string | null;
          late_minutes: number;
          reason: string | null;
        }>;
        savedAttendance.forEach(a => attMap.set(a.employee_id, a));
      }
    }

    const newRows: RegisterRow[] = employees.map((emp) => {
      const existing = attMap.get(emp.id);
      if (existing) {
        return {
          employee_id: emp.id,
          pt_code: emp.pt_code,
          full_name: emp.full_name,
          photo_url: emp.photo_url,
          weekly_wage: emp.weekly_wage,
          emp_status: emp.status,
          status: existing.status,
          time_in: (existing.time_in ?? '').slice(0, 5),
          time_out: (existing.time_out ?? '').slice(0, 5),
          late_minutes: existing.late_minutes,
          late_deduction: computeLateDeduction(existing.late_minutes, emp.weekly_wage),
          ot_minutes: (() => {
            if (!existing.time_out) return 0;
            const t = (existing.time_out ?? '').slice(0, 5);
            const [h, m] = t.split(':').map(Number);
            return (h * 60 + m) > 17 * 60 ? (h * 60 + m) - 17 * 60 : 0;
          })(),
          reason: existing.reason ?? '',
          existing_id: existing.id,
        };
      }
      return {
        employee_id: emp.id,
        pt_code: emp.pt_code,
        full_name: emp.full_name,
        photo_url: emp.photo_url,
        weekly_wage: emp.weekly_wage,
        emp_status: emp.status,
        status: 'present',
        time_in: '',
        time_out: '',
        late_minutes: 0,
        late_deduction: 0,
        ot_minutes: 0,
        reason: '',
        existing_id: null,
      };
    });

    setRows(newRows);
    // If any records already exist, this date has been saved before
    setSavedForDate(newRows.some(r => r.existing_id !== null));
    setLoading(false);
  }, [selectedDate, showInactive]);

  async function toggleEmployeeStatus(employeeId: string, currentStatus: string) {
    const newStatus = currentStatus === 'active' ? 'terminated' : 'active';
    const res = await fetch('/api/register', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ employeeId, status: newStatus }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast('error', `Failed to update: ${data.error}`);
    } else {
      toast('success', newStatus === 'active' ? 'Employee restored to register' : 'Employee removed from register');
      fetchData();
    }
  }

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------- row update helpers ----------

  function updateRow(idx: number, patch: Partial<RegisterRow>) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx], ...patch };

      // Auto-detect late from time_in (time drives status)
      if (row.time_in && (row.status === 'present' || row.status === 'late')) {
        const calcMinutes = calculateLateMinutes(row.time_in);
        if (calcMinutes > 0) {
          // Auto-change status to late
          row.status = 'late' as AttendanceStatus;
          if (calcMinutes < 495) {
            row.late_minutes = calcMinutes;
          } else if (!patch.late_minutes && row.late_minutes === 0) {
            row.late_minutes = calcMinutes;
          }
        } else {
          // On time — set to present
          if (row.status === 'late') row.status = 'present' as AttendanceStatus;
          row.late_minutes = 0;
        }
      } else if (row.status !== 'late') {
        row.late_minutes = 0;
      }

      row.late_deduction = computeLateDeduction(row.late_minutes, row.weekly_wage);

      // Auto-detect overtime from time_out (after 17:00)
      if (row.time_out && (row.status === 'present' || row.status === 'late')) {
        const [h, m] = row.time_out.split(':').map(Number);
        const totalMin = h * 60 + m;
        const fivePM = 17 * 60;
        row.ot_minutes = totalMin > fivePM ? totalMin - fivePM : 0;
      } else {
        row.ot_minutes = 0;
      }

      next[idx] = row;
      return next;
    });
  }

  // ---------- mark all / unmark all ----------

  function markAllPresent() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        status: 'present' as AttendanceStatus,
        time_in: '08:00',
        time_out: '17:00',
        late_minutes: 0,
        late_deduction: 0,
        ot_minutes: 0,
        reason: '',
      }))
    );
  }

  function unmarkAll() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        status: 'present' as AttendanceStatus,
        time_in: '',
        time_out: '',
        late_minutes: 0,
        late_deduction: 0,
        ot_minutes: 0,
        reason: '',
      }))
    );
  }

  // ---------- delete record ----------

  async function deleteRecord(attendanceId: string, employeeName: string) {
    if (!confirm(`Delete attendance record for ${employeeName} on ${formatDateLabel(selectedDate)}? This cannot be undone.`)) return;

    const res = await fetch('/api/register', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attendanceId }),
    });
    const data = await res.json();
    if (!res.ok) {
      toast('error', `Delete failed: ${data.error}`);
    } else {
      toast('success', `Record deleted for ${employeeName}`);
      fetchData();
    }
  }

  // ---------- auto-advance ----------

  const advanceToNextDay = useCallback(async () => {
    const current = new Date(selectedDate + 'T00:00:00');

    // Try the next 7 days to find one without attendance data
    for (let i = 1; i <= 7; i++) {
      const next = new Date(current);
      next.setDate(next.getDate() + i);

      // Skip Sundays (day 0)
      if (next.getDay() === 0) continue;

      // Don't go past today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (next > today) break;

      const dateStr = toDateString(next);

      // Check if this day already has attendance
      const { count } = await supabase
        .from('attendance')
        .select('*', { count: 'exact', head: true })
        .eq('date', dateStr);

      if ((count || 0) === 0) {
        setSelectedDate(dateStr);
        return;
      }
    }
    // All days captured — stay on current day
  }, [selectedDate, supabase]);

  // ---------- save ----------

  async function saveRegister() {
    if (!canEdit) return;
    setSaving(true);

    const previousRows = JSON.parse(JSON.stringify(rows));

    const records = rows.map((row) => ({
      ...(row.existing_id ? { id: row.existing_id } : {}),
      employee_id: row.employee_id,
      date: selectedDate,
      status: row.status,
      time_in: row.time_in || null,
      time_out: row.time_out || null,
      late_minutes: row.late_minutes,
      reason: row.reason || null,
      captured_by: user?.id ?? null,
    }));

    const res = await fetch('/api/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ records, date: selectedDate }),
    });
    const data = await res.json();

    if (!res.ok) {
      toast('error', `Save failed: ${data.error}`);
    } else {
      setSavedForDate(true);
      setShowSavedOverlay(true);
      setTimeout(() => setShowSavedOverlay(false), 2000);
      await fetchData();
      showUndo('Register saved', async () => {
        setRows(previousRows);
      });
      // Auto-advance to next uncaptured weekday after 1.5s
      setAdvancing(true);
      setTimeout(() => {
        advanceToNextDay();
        setAdvancing(false);
      }, 1500);
    }

    setSaving(false);
  }

  // ---------- summary ----------

  const summary = {
    present: rows.filter((r) => r.status === 'present').length,
    late: rows.filter((r) => r.status === 'late').length,
    absent: rows.filter((r) => r.status === 'absent').length,
    leave: rows.filter((r) => r.status === 'leave' || r.status === 'sick').length,
    other: rows.filter((r) => r.status === 'ph' || r.status === 'short_time').length,
  };

  // ---------- render ----------

  if (!user) return null;
  if (!hasPermission(user.role, 'view_register')) {
    return (
      <div className="flex h-full items-center justify-center p-6">
        <p className="text-sm text-gray-500">You do not have access to this page.</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black text-[#1E293B] tracking-tight">
            Daily Register
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Attendance capture &mdash; {rows.length} staff
          </p>
        </div>

        <div className="flex items-center gap-2">
          <a
            href={`/api/pdf/dol-register?month=${selectedDate.slice(0, 7)}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
              'bg-white text-[#333] border border-gray-200 hover:bg-gray-50 transition-colors min-h-[48px] shadow-sm'
            )}
          >
            <Download className="h-4 w-4" />
            DOL Register
          </a>
          <Link
            href="/register/weekly-view"
            className={cn(
              'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
              'bg-[#1E293B] text-white hover:bg-[#2a2a4e] transition-colors min-h-[48px]'
            )}
          >
            <CalendarDays className="h-4 w-4" />
            Weekly View
          </Link>
        </div>
      </div>

      {/* Date picker + actions */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <label htmlFor="register-date" className="text-sm font-medium text-[#333] whitespace-nowrap">
              Date
            </label>
            <input
              id="register-date"
              type="date"
              value={selectedDate}
              max={toDateString(new Date())}
              min={user?.role !== 'owner' ? (() => {
                const mon = startOfWeek(new Date(), { weekStartsOn: 1 })
                return toDateString(mon)
              })() : undefined}
              onChange={(e) => {
                const picked = new Date(e.target.value + 'T00:00:00')
                const today = new Date()
                today.setHours(0, 0, 0, 0)
                if (picked > today) {
                  alert('Cannot capture register for a future date')
                  return
                }
                // Non-admin: only current week
                if (user?.role !== 'owner') {
                  const mon = startOfWeek(today, { weekStartsOn: 1 })
                  if (picked < mon) {
                    alert('You can only capture register for the current week')
                    return
                  }
                }
                // Admin going far back: confirm
                const diffDays = Math.floor((today.getTime() - picked.getTime()) / (1000 * 60 * 60 * 24))
                if (diffDays > 7 && user?.role === 'owner') {
                  if (!confirm(`This date is ${diffDays} days ago. Are you sure?`)) return
                }
                setSelectedDate(e.target.value)
              }}
              className={cn(
                'h-12 min-h-[48px] rounded-lg border border-gray-300 px-3.5 text-sm text-[#333]',
                'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]'
              )}
            />
            {advancing && (
              <span className="text-sm text-[#3B82F6] font-medium animate-pulse">
                Moving to next day...
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && !publicHoliday && (
              <>
                <Button
                  variant="primary"
                  size="lg"
                  icon={<CheckCircle className="h-4 w-4" />}
                  onClick={markAllPresent}
                >
                  Mark All Present
                </Button>
                <Button
                  variant="ghost"
                  size="lg"
                  onClick={unmarkAll}
                >
                  Clear All
                </Button>
              </>
            )}
          </div>
        </div>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        {[
          { label: 'Present', count: summary.present, color: 'bg-emerald-500' },
          { label: 'Late', count: summary.late, color: 'bg-amber-500' },
          { label: 'Absent', count: summary.absent, color: 'bg-red-500' },
          { label: 'Leave/Sick', count: summary.leave, color: 'bg-blue-500' },
          { label: 'PH/Short', count: summary.other, color: 'bg-gray-400' },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-3 rounded-lg bg-white px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.06)]"
          >
            <div className={cn('h-3 w-3 rounded-full shrink-0', item.color)} />
            <div>
              <p className="text-lg font-bold text-[#1E293B] leading-none">{item.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Save button — top */}
      {canEdit && !editLocked && (
        <div className="flex justify-end">
          <Button
            size="lg"
            loading={saving}
            icon={<Save className="h-4 w-4" />}
            onClick={saveRegister}
          >
            {savedForDate ? 'Update Register' : 'Save Register'}
          </Button>
        </div>
      )}

      {/* Public holiday banner */}
      {publicHoliday && (
        <div className="rounded-xl bg-blue-50 border border-blue-200 px-5 py-4 flex items-center gap-3">
          <span className="text-2xl">🏖</span>
          <div>
            <p className="text-sm font-bold text-[#1E293B]">Public Holiday — {publicHoliday}</p>
            <p className="text-xs text-gray-500">All staff automatically marked as PH. Counted as paid day in payroll.</p>
          </div>
        </div>
      )}

      {/* Attendance table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3B82F6] border-t-transparent" />
        </div>
      ) : (
        <>
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="px-3 py-3 text-left font-semibold text-[#333] whitespace-nowrap w-[220px]">
                    Employee
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-[#333] whitespace-nowrap w-[80px]">
                    PT Code
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-[#333] whitespace-nowrap w-[150px]">
                    Status
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-[#333] whitespace-nowrap w-[100px]">
                    Time In
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-[#333] whitespace-nowrap w-[100px]">
                    Time Out
                  </th>
                  <th className="px-3 py-3 text-right font-semibold text-[#333] whitespace-nowrap w-[90px]">
                    Late Min
                  </th>
                  <th className="px-3 py-3 text-right font-semibold text-[#333] whitespace-nowrap w-[100px]">
                    Deduction
                  </th>
                  <th className="px-3 py-3 text-right font-semibold text-[#333] whitespace-nowrap w-[80px]">
                    OT Min
                  </th>
                  <th className="px-3 py-3 text-left font-semibold text-[#333] whitespace-nowrap">
                    Reason / Note
                  </th>
                  {user?.role === 'owner' && (
                    <th className="px-2 py-3 text-center font-semibold text-[#333] whitespace-nowrap w-[50px]">
                    </th>
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((row, idx) => {
                  const isAfterNine = row.time_in && (() => {
                    const [h, m] = row.time_in.split(':').map(Number);
                    return h * 60 + m > 9 * 60;
                  })();

                  return (
                    <tr
                      key={row.employee_id}
                      className={cn(
                        'border-b border-gray-100 transition-colors',
                        idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                      )}
                    >
                      {/* Name + avatar */}
                      <td className="px-3 py-2">
                        <div className="flex items-center gap-2.5 min-h-[48px]">
                          {row.photo_url ? (
                            <img
                              src={row.photo_url}
                              alt=""
                              className="h-9 w-9 rounded-full object-cover shrink-0"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1E293B] text-white text-xs font-bold shrink-0">
                              {getInitials(row.full_name)}
                            </div>
                          )}
                          <span className={cn("font-medium truncate", row.emp_status === 'active' ? 'text-[#333]' : 'text-gray-400 line-through')}>
                            {row.full_name}
                          </span>
                        </div>
                      </td>

                      {/* PT Code */}
                      <td className="px-3 py-2">
                        <span className="text-xs font-mono text-gray-500">
                          {row.pt_code}
                        </span>
                      </td>

                      {/* Status dropdown */}
                      <td className="px-3 py-2">
                        <select
                          value={row.status}
                          disabled={!canEdit || editLocked}
                          onChange={(e) =>
                            updateRow(idx, { status: e.target.value as AttendanceStatus })
                          }
                          className={cn(
                            'h-10 min-h-[44px] w-full rounded-lg border px-2 text-sm font-medium',
                            'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40',
                            'disabled:cursor-not-allowed disabled:opacity-60',
                            STATUS_COLORS[row.status]
                          )}
                        >
                          {STATUS_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Time In */}
                      <td className="px-3 py-2">
                        <TimePicker
                          value={row.time_in || ''}
                          disabled={!canEdit || editLocked}
                          onChange={(val) => updateRow(idx, { time_in: val })}
                        />
                      </td>

                      {/* Time Out */}
                      <td className="px-3 py-2">
                        <TimePicker
                          value={row.time_out || ''}
                          disabled={!canEdit || editLocked}
                          onChange={(val) => updateRow(idx, { time_out: val })}
                        />
                      </td>

                      {/* Late Minutes */}
                      <td className="px-3 py-2 text-right">
                        {row.status === 'late' ? (
                          isAfterNine ? (
                            <input
                              type="number"
                              min={0}
                              value={row.late_minutes}
                              disabled={!canEdit || editLocked}
                              onChange={(e) =>
                                updateRow(idx, {
                                  late_minutes: parseInt(e.target.value) || 0,
                                })
                              }
                              className={cn(
                                'h-10 min-h-[44px] w-20 rounded-lg border border-amber-300 bg-amber-50 px-2 text-sm text-right font-mono',
                                'focus:outline-none focus:ring-2 focus:ring-amber-400/40',
                                'disabled:cursor-not-allowed disabled:opacity-60'
                              )}
                              title="After 09:00 — supervisor discretion"
                            />
                          ) : (
                            <span className="font-mono text-amber-700 font-medium">
                              {row.late_minutes}
                            </span>
                          )
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>

                      {/* Late Deduction */}
                      <td className="px-3 py-2 text-right">
                        {row.late_deduction > 0 ? (
                          <span className="font-mono text-red-600 text-xs font-medium">
                            -{formatCurrency(row.late_deduction)}
                          </span>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>

                      {/* OT Minutes */}
                      <td className="px-3 py-2 text-right">
                        {row.ot_minutes > 0 ? (
                          <span className="font-mono text-[#1E40AF] text-xs font-semibold">
                            +{row.ot_minutes}
                          </span>
                        ) : (
                          <span className="text-gray-300">&mdash;</span>
                        )}
                      </td>

                      {/* Reason */}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.reason}
                          disabled={!canEdit || editLocked}
                          placeholder={
                            row.status === 'absent' || row.status === 'late'
                              ? 'Reason required'
                              : ''
                          }
                          onChange={(e) =>
                            updateRow(idx, { reason: e.target.value })
                          }
                          className={cn(
                            'h-10 min-h-[44px] w-full rounded-lg border border-gray-300 px-2 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40',
                            'placeholder:text-gray-400',
                            'disabled:cursor-not-allowed disabled:opacity-60',
                            (row.status === 'absent' || row.status === 'late') &&
                              !row.reason &&
                              'border-amber-300 bg-amber-50/50'
                          )}
                        />
                      </td>

                      {/* Delete — owner only */}
                      {user?.role === 'owner' && (
                        <td className="px-2 py-2 text-center">
                          {row.existing_id && (
                            <button
                              onClick={() => deleteRecord(row.existing_id!, row.full_name)}
                              title="Delete record"
                              className="rounded-md p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                            >
                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                              </svg>
                            </button>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save button */}
          {canEdit && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-4">
              <div className="flex items-center gap-3">
                <p className="text-xs text-gray-500">
                  {rows.length} employees &middot; {formatDateLabel(selectedDate)}
                </p>
                {savedForDate && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M20 6L9 17l-5-5"/></svg>
                    Saved
                  </span>
                )}
              </div>
              {!editLocked && (
                <Button
                  size="lg"
                  loading={saving}
                  icon={<Save className="h-4 w-4" />}
                  onClick={saveRegister}
                >
                  {savedForDate ? 'Update Register' : 'Save Register'}
                </Button>
              )}
            </div>
          )}
        </Card>

      {/* Add/Remove employees — owner only */}
      {user?.role === 'owner' && (
        <Card padding="sm">
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-[#1E293B] select-none py-2">
              Add or Remove Employees from Register
            </summary>
            <div className="mt-3 space-y-2 max-h-[400px] overflow-y-auto">
              {rows.map((row) => (
                <div
                  key={row.employee_id}
                  className="flex items-center justify-between px-3 py-2 rounded-lg hover:bg-gray-50"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-gray-400">{row.pt_code}</span>
                    <span className={cn("text-sm font-medium", row.emp_status === 'active' ? 'text-[#333]' : 'text-gray-400 line-through')}>
                      {row.full_name}
                    </span>
                  </div>
                  <button
                    onClick={() => toggleEmployeeStatus(row.employee_id, row.emp_status)}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-xs font-medium transition-colors min-h-[36px]',
                      row.emp_status === 'active'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-emerald-50 text-emerald-600 hover:bg-emerald-100'
                    )}
                  >
                    {row.emp_status === 'active' ? 'Remove' : 'Restore'}
                  </button>
                </div>
              ))}
            </div>
          </details>
        </Card>
      )}
      </>
      )}

      {/* Saved overlay */}
      {showSavedOverlay && (
        <div className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
          <div
            className="rounded-2xl px-10 py-8 text-center shadow-2xl"
            style={{
              background: 'rgba(255,255,255,0.97)',
              animation: 'fadeInUp 200ms ease-out',
            }}
          >
            <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
            <p className="text-xl font-bold text-[#1E293B]">Register Saved</p>
            <p className="text-sm text-gray-500 mt-1">{formatDateLabel(selectedDate)}</p>
          </div>
        </div>
      )}
    </div>
  );
}
