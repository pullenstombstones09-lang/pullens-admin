'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn, getInitials } from '@/lib/utils';
import { Card, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { AttendanceStatus } from '@/types/database';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';

// ---------- helpers ----------

interface WeekEmployee {
  id: string;
  pt_code: string;
  full_name: string;
  photo_url: string | null;
}

interface CellData {
  status: AttendanceStatus | null;
  attendance_id: string | null;
}

type WeekGrid = Record<string, Record<string, CellData>>; // employee_id -> date -> cell

const STATUS_CELL_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-400 text-white',
  late: 'bg-amber-400 text-white',
  absent: 'bg-red-500 text-white',
  leave: 'bg-blue-400 text-white',
  sick: 'bg-purple-400 text-white',
  ph: 'bg-indigo-400 text-white',
  short_time: 'bg-gray-400 text-white',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'P',
  late: 'L',
  absent: 'A',
  leave: 'Lv',
  sick: 'S',
  ph: 'PH',
  short_time: 'ST',
};

function getWeekDates(baseDate: Date): string[] {
  // Pullens week: Saturday to Friday
  // Find the most recent Saturday on or before baseDate
  const d = new Date(baseDate);
  const dow = d.getDay(); // 0=Sun, 6=Sat
  // days back to Saturday: if dow=6 (Sat) => 0, dow=0 (Sun) => 1, dow=1 (Mon) => 2, etc.
  const daysBack = (dow + 1) % 7;
  d.setDate(d.getDate() - daysBack);

  const dates: string[] = [];
  for (let i = 0; i < 7; i++) {
    const day = new Date(d);
    day.setDate(d.getDate() + i);
    dates.push(toDateString(day));
  }
  // 7 days: Sat, Sun, Mon, Tue, Wed, Thu, Fri
  return dates;
}

function toDateString(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function dayLabel(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' });
}

function weekRangeLabel(dates: string[]): string {
  if (dates.length === 0) return '';
  const s = new Date(dates[0] + 'T00:00:00');
  const e = new Date(dates[dates.length - 1] + 'T00:00:00');
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
  return `${fmt(s)} – ${fmt(e)}`;
}

// ---------- component ----------

export default function WeeklyViewPage() {
  const { user } = useAuth();
  const supabase = createClient();

  const [weekOffset, setWeekOffset] = useState(0);
  const [employees, setEmployees] = useState<WeekEmployee[]>([]);
  const [grid, setGrid] = useState<WeekGrid>({});
  const [loading, setLoading] = useState(true);

  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() + weekOffset * 7);
  const weekDates = getWeekDates(baseDate);

  const fetchData = useCallback(async () => {
    setLoading(true);

    const [empRes, attRes] = await Promise.all([
      supabase
        .from('employees')
        .select('id, pt_code, full_name, photo_url')
        .eq('status', 'active')
        .order('pt_code'),
      supabase
        .from('attendance')
        .select('id, employee_id, date, status')
        .gte('date', weekDates[0])
        .lte('date', weekDates[weekDates.length - 1]),
    ]);

    const emps = (empRes.data ?? []) as WeekEmployee[];
    const att = (attRes.data ?? []) as Array<{
      id: string;
      employee_id: string;
      date: string;
      status: AttendanceStatus;
    }>;

    const newGrid: WeekGrid = {};
    for (const emp of emps) {
      newGrid[emp.id] = {};
      for (const date of weekDates) {
        newGrid[emp.id][date] = { status: null, attendance_id: null };
      }
    }
    for (const a of att) {
      if (newGrid[a.employee_id]) {
        newGrid[a.employee_id][a.date] = {
          status: a.status,
          attendance_id: a.id,
        };
      }
    }

    setEmployees(emps);
    setGrid(newGrid);
    setLoading(false);
  }, [supabase, weekDates[0]]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchData();
  }, [fetchData]);

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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/register"
            className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-[#333] shadow-sm hover:bg-gray-50 transition-colors min-h-[48px] min-w-[48px]"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-[#1E293B] tracking-tight">
              Weekly View
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {weekRangeLabel(weekDates)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setWeekOffset((w) => w - 1)}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[#333] shadow-sm hover:bg-gray-50 transition-colors min-h-[48px]"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={() => setWeekOffset(0)}
            className={cn(
              'h-12 min-h-[48px] rounded-lg px-4 text-sm font-medium transition-colors',
              weekOffset === 0
                ? 'bg-[#1E40AF] text-white'
                : 'bg-white text-[#333] shadow-sm hover:bg-gray-50'
            )}
          >
            This Week
          </button>
          <button
            onClick={() => setWeekOffset((w) => w + 1)}
            className="flex h-12 w-12 items-center justify-center rounded-lg bg-white text-[#333] shadow-sm hover:bg-gray-50 transition-colors min-h-[48px]"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap gap-2">
        {(Object.entries(STATUS_CELL_COLORS) as [AttendanceStatus, string][]).map(
          ([status, cls]) => (
            <div
              key={status}
              className={cn(
                'flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium',
                cls
              )}
            >
              {STATUS_LABELS[status]}
              <span className="opacity-80 capitalize">
                {status.replace('_', ' ')}
              </span>
            </div>
          )
        )}
        <div className="flex items-center gap-1.5 rounded-md border border-dashed border-gray-300 px-2 py-1 text-xs text-gray-400">
          — No record
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1E40AF] border-t-transparent" />
        </div>
      ) : (
        <Card padding="none">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/80">
                  <th className="sticky left-0 z-10 bg-gray-50/80 px-3 py-3 text-left font-semibold text-[#333] min-w-[180px]">
                    Employee
                  </th>
                  {weekDates.map((date) => {
                    const isWeekend =
                      new Date(date + 'T00:00:00').getDay() === 0 ||
                      new Date(date + 'T00:00:00').getDay() === 6;
                    return (
                      <th
                        key={date}
                        className={cn(
                          'px-2 py-3 text-center font-semibold text-[#333] whitespace-nowrap min-w-[70px]',
                          isWeekend && 'bg-gray-100/60'
                        )}
                      >
                        {dayLabel(date)}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, idx) => (
                  <tr
                    key={emp.id}
                    className={cn(
                      'border-b border-gray-100',
                      idx % 2 === 0 ? 'bg-white' : 'bg-gray-50/40'
                    )}
                  >
                    <td className="sticky left-0 z-10 bg-inherit px-3 py-1.5">
                      <div className="flex items-center gap-2 min-h-[44px]">
                        {emp.photo_url ? (
                          <img
                            src={emp.photo_url}
                            alt=""
                            className="h-7 w-7 rounded-full object-cover shrink-0"
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#1E293B] text-white text-[10px] font-bold shrink-0">
                            {getInitials(emp.full_name)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-[#333] truncate">
                            {emp.full_name}
                          </p>
                          <p className="text-[10px] font-mono text-gray-400">
                            {emp.pt_code}
                          </p>
                        </div>
                      </div>
                    </td>
                    {weekDates.map((date) => {
                      const cell = grid[emp.id]?.[date];
                      const isWeekend =
                        new Date(date + 'T00:00:00').getDay() === 0 ||
                        new Date(date + 'T00:00:00').getDay() === 6;

                      return (
                        <td
                          key={date}
                          className={cn(
                            'px-1 py-1.5 text-center',
                            isWeekend && 'bg-gray-50/60'
                          )}
                        >
                          <Link
                            href={`/register?date=${date}`}
                            className={cn(
                              'flex h-10 w-full items-center justify-center rounded-md text-xs font-bold transition-all',
                              'hover:scale-105 hover:shadow-sm min-h-[40px]',
                              cell?.status
                                ? STATUS_CELL_COLORS[cell.status]
                                : 'border border-dashed border-gray-200 text-gray-300'
                            )}
                          >
                            {cell?.status ? STATUS_LABELS[cell.status] : '—'}
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
