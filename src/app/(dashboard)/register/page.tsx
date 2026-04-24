'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { useToast } from '@/components/ui/toast';
import { cn, getInitials, formatCurrency } from '@/lib/utils';
import { calculateLateMinutes } from '@/lib/payroll-engine';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { Employee, AttendanceStatus } from '@/types/database';
import {
  CalendarDays,
  CheckCircle,
  Save,
  Clock,
  Users,
} from 'lucide-react';
import Link from 'next/link';

// ---------- types ----------

interface RegisterRow {
  employee_id: string;
  pt_code: string;
  full_name: string;
  photo_url: string | null;
  weekly_wage: number;
  status: AttendanceStatus;
  time_in: string;
  time_out: string;
  late_minutes: number;
  late_deduction: number;
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

  const canEdit = user ? hasPermission(user.role, 'edit_register') : false;

  // Fetch employees + existing attendance for the selected date
  const fetchData = useCallback(async () => {
    setLoading(true);

    const [empResult, attResult] = await Promise.all([
      supabase
        .from('employees')
        .select('id, pt_code, full_name, photo_url, weekly_wage, status')
        .eq('status', 'active')
        .order('pt_code'),
      supabase
        .from('attendance')
        .select('*')
        .eq('date', selectedDate),
    ]);

    const employees = (empResult.data ?? []) as Employee[];
    const attendance = (attResult.data ?? []) as Array<{
      id: string;
      employee_id: string;
      status: AttendanceStatus;
      time_in: string | null;
      time_out: string | null;
      late_minutes: number;
      reason: string | null;
    }>;

    const attMap = new Map(attendance.map((a) => [a.employee_id, a]));

    const newRows: RegisterRow[] = employees.map((emp) => {
      const existing = attMap.get(emp.id);
      if (existing) {
        return {
          employee_id: emp.id,
          pt_code: emp.pt_code,
          full_name: emp.full_name,
          photo_url: emp.photo_url,
          weekly_wage: emp.weekly_wage,
          status: existing.status,
          time_in: existing.time_in ?? '',
          time_out: existing.time_out ?? '',
          late_minutes: existing.late_minutes,
          late_deduction: computeLateDeduction(existing.late_minutes, emp.weekly_wage),
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
        status: 'present',
        time_in: '',
        time_out: '',
        late_minutes: 0,
        late_deduction: 0,
        reason: '',
        existing_id: null,
      };
    });

    setRows(newRows);
    setLoading(false);
  }, [supabase, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ---------- row update helpers ----------

  function updateRow(idx: number, patch: Partial<RegisterRow>) {
    setRows((prev) => {
      const next = [...prev];
      const row = { ...next[idx], ...patch };

      // auto-calculate late minutes when status=late and time_in changes
      if (row.status === 'late' && row.time_in) {
        const calcMinutes = calculateLateMinutes(row.time_in);
        // If after 09:00, calcMinutes = 495 (supervisor discretion) — keep manual value if already set
        if (calcMinutes < 495) {
          row.late_minutes = calcMinutes;
        } else if (!patch.late_minutes && row.late_minutes === 0) {
          row.late_minutes = calcMinutes;
        }
      } else if (row.status !== 'late') {
        row.late_minutes = 0;
      }

      row.late_deduction = computeLateDeduction(row.late_minutes, row.weekly_wage);
      next[idx] = row;
      return next;
    });
  }

  // ---------- mark all present ----------

  function markAllPresent() {
    setRows((prev) =>
      prev.map((row) => ({
        ...row,
        status: 'present' as AttendanceStatus,
        time_in: '08:00',
        time_out: '17:00',
        late_minutes: 0,
        late_deduction: 0,
        reason: '',
      }))
    );
  }

  // ---------- save ----------

  async function saveRegister() {
    if (!canEdit) return;
    setSaving(true);

    const upserts = rows.map((row) => ({
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

    const { error } = await supabase
      .from('attendance')
      .upsert(upserts, { onConflict: 'employee_id,date' });

    if (error) {
      toast('error', `Save failed: ${error.message}`);
    } else {
      toast('success', `Register saved for ${formatDateLabel(selectedDate)}`);
      await fetchData();
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
          <h1 className="text-xl font-black text-[#1A1A2E] tracking-tight">
            Daily Register
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Attendance capture &mdash; {rows.length} staff
          </p>
        </div>

        <Link
          href="/register/weekly-view"
          className={cn(
            'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium',
            'bg-[#1A1A2E] text-white hover:bg-[#2a2a4e] transition-colors min-h-[48px]'
          )}
        >
          <CalendarDays className="h-4 w-4" />
          Weekly View
        </Link>
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
              onChange={(e) => setSelectedDate(e.target.value)}
              className={cn(
                'h-12 min-h-[48px] rounded-lg border border-gray-300 px-3.5 text-sm text-[#333]',
                'focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40 focus:border-[#C4A35A]'
              )}
            />
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {canEdit && (
              <Button
                variant="secondary"
                size="lg"
                icon={<CheckCircle className="h-4 w-4" />}
                onClick={markAllPresent}
              >
                Mark All Present (08:00-17:00)
              </Button>
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
              <p className="text-lg font-bold text-[#1A1A2E] leading-none">{item.count}</p>
              <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Attendance table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C4A35A] border-t-transparent" />
        </div>
      ) : (
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
                  <th className="px-3 py-3 text-left font-semibold text-[#333] whitespace-nowrap">
                    Reason / Note
                  </th>
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
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#1A1A2E] text-white text-xs font-bold shrink-0">
                              {getInitials(row.full_name)}
                            </div>
                          )}
                          <span className="font-medium text-[#333] truncate">
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
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(idx, { status: e.target.value as AttendanceStatus })
                          }
                          className={cn(
                            'h-10 min-h-[44px] w-full rounded-lg border px-2 text-sm font-medium',
                            'focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40',
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
                        <input
                          type="time"
                          value={row.time_in}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(idx, { time_in: e.target.value })
                          }
                          className={cn(
                            'h-10 min-h-[44px] w-full rounded-lg border border-gray-300 px-2 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40',
                            'disabled:cursor-not-allowed disabled:opacity-60'
                          )}
                        />
                      </td>

                      {/* Time Out */}
                      <td className="px-3 py-2">
                        <input
                          type="time"
                          value={row.time_out}
                          disabled={!canEdit}
                          onChange={(e) =>
                            updateRow(idx, { time_out: e.target.value })
                          }
                          className={cn(
                            'h-10 min-h-[44px] w-full rounded-lg border border-gray-300 px-2 text-sm',
                            'focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40',
                            'disabled:cursor-not-allowed disabled:opacity-60'
                          )}
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
                              disabled={!canEdit}
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

                      {/* Reason */}
                      <td className="px-3 py-2">
                        <input
                          type="text"
                          value={row.reason}
                          disabled={!canEdit}
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
                            'focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40',
                            'placeholder:text-gray-400',
                            'disabled:cursor-not-allowed disabled:opacity-60',
                            (row.status === 'absent' || row.status === 'late') &&
                              !row.reason &&
                              'border-amber-300 bg-amber-50/50'
                          )}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Save button */}
          {canEdit && (
            <div className="flex items-center justify-between border-t border-gray-200 px-4 py-4">
              <p className="text-xs text-gray-500">
                {rows.length} employees &middot; {formatDateLabel(selectedDate)}
              </p>
              <Button
                size="lg"
                loading={saving}
                icon={<Save className="h-4 w-4" />}
                onClick={saveRegister}
              >
                Save Register
              </Button>
            </div>
          )}
        </Card>
      )}
    </div>
  );
}
