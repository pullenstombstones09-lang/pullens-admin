'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { cn, formatDate, formatTime } from '@/lib/utils';
import type { Attendance, AttendanceStatus } from '@/types/database';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';

interface AttendanceTabProps {
  employeeId: string;
}

const STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-emerald-400',
  late: 'bg-amber-400',
  absent: 'bg-red-400',
  leave: 'bg-blue-400',
  sick: 'bg-purple-400',
  ph: 'bg-sky-300',
  short_time: 'bg-stone-300',
};

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: 'Present',
  late: 'Late',
  absent: 'Absent',
  leave: 'Leave',
  sick: 'Sick',
  ph: 'Public Holiday',
  short_time: 'Short Time',
};

export default function AttendanceTab({ employeeId }: AttendanceTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [heatmapOffset, setHeatmapOffset] = useState(0); // 0 = current 90 days

  useEffect(() => {
    async function load() {
      setLoading(true);
      const from = new Date();
      from.setDate(from.getDate() - 180); // fetch 180 days to support paging
      const { data } = await supabase
        .from('attendance')
        .select('*')
        .eq('employee_id', employeeId)
        .gte('date', from.toISOString().slice(0, 10))
        .order('date', { ascending: false });
      setRecords((data ?? []) as Attendance[]);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  // 30-day rolling summary
  const summary = useMemo(() => {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffStr = cutoff.toISOString().slice(0, 10);
    const recent = records.filter((r) => r.date >= cutoffStr);
    return {
      present: recent.filter((r) => r.status === 'present').length,
      late: recent.filter((r) => r.status === 'late').length,
      absent: recent.filter((r) => r.status === 'absent').length,
      leave: recent.filter((r) => r.status === 'leave' || r.status === 'sick').length,
    };
  }, [records]);

  // Build heatmap grid (90 days)
  const heatmapDays = useMemo(() => {
    const days: { date: string; status: AttendanceStatus | null; dayOfWeek: number }[] = [];
    const start = new Date();
    start.setDate(start.getDate() - 89 - heatmapOffset * 90);

    const byDate = new Map<string, AttendanceStatus>();
    records.forEach((r) => byDate.set(r.date, r.status));

    for (let i = 0; i < 90; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const dateStr = d.toISOString().slice(0, 10);
      days.push({
        date: dateStr,
        status: byDate.get(dateStr) ?? null,
        dayOfWeek: d.getDay(),
      });
    }
    return days;
  }, [records, heatmapOffset]);

  // Selected day details
  const selectedRecord = useMemo(() => {
    if (!selectedDate) return null;
    return records.find((r) => r.date === selectedDate) ?? null;
  }, [records, selectedDate]);

  const handleDeleteAttendance = async (id: string) => {
    if (!confirm('Delete this attendance record? This cannot be undone.')) return;
    const { error } = await supabase.from('attendance').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete attendance record');
    } else {
      toast('success', 'Attendance record deleted');
      setRecords((prev) => prev.filter((r) => r.id !== id));
      setSelectedDate(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 rounded-xl bg-stone-200" />
        </div>
        <div className="animate-pulse">
          <div className="h-20 rounded-xl bg-stone-200" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary strip */}
      <Card padding="md">
        <CardTitle className="mb-3">Last 30 Days</CardTitle>
        <CardContent>
          <div className="grid grid-cols-4 gap-3 text-center">
            <div className="rounded-lg bg-emerald-50 p-3">
              <p className="text-xl font-bold text-emerald-700">{summary.present}</p>
              <p className="text-[10px] text-emerald-600 font-medium">Present</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3">
              <p className="text-xl font-bold text-amber-700">{summary.late}</p>
              <p className="text-[10px] text-amber-600 font-medium">Late</p>
            </div>
            <div className="rounded-lg bg-red-50 p-3">
              <p className="text-xl font-bold text-red-700">{summary.absent}</p>
              <p className="text-[10px] text-red-600 font-medium">Absent</p>
            </div>
            <div className="rounded-lg bg-blue-50 p-3">
              <p className="text-xl font-bold text-blue-700">{summary.leave}</p>
              <p className="text-[10px] text-blue-600 font-medium">Leave</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Heatmap */}
      <Card padding="md">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-[#1E40AF]" />
            <CardTitle>Attendance Heatmap</CardTitle>
          </div>
          <div className="flex gap-1">
            <button
              onClick={() => setHeatmapOffset((o) => o + 1)}
              className="h-8 w-8 rounded flex items-center justify-center text-stone-400 hover:bg-stone-100"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setHeatmapOffset((o) => Math.max(0, o - 1))}
              disabled={heatmapOffset === 0}
              className="h-8 w-8 rounded flex items-center justify-center text-stone-400 hover:bg-stone-100 disabled:opacity-30"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        <CardContent>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mb-3">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center gap-1">
                <span className={cn('h-2.5 w-2.5 rounded-sm', STATUS_COLORS[key as AttendanceStatus])} />
                <span className="text-[10px] text-stone-500">{label}</span>
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-[repeat(13,1fr)] gap-1">
            {heatmapDays.map((day) => {
              // Skip Sundays
              if (day.dayOfWeek === 0) return null;
              return (
                <button
                  key={day.date}
                  onClick={() => setSelectedDate(day.date)}
                  title={`${day.date}: ${day.status ?? 'No record'}`}
                  className={cn(
                    'aspect-square rounded-sm transition-all min-h-[20px]',
                    day.status ? STATUS_COLORS[day.status] : 'bg-stone-100',
                    selectedDate === day.date && 'ring-2 ring-[#1E40AF] ring-offset-1',
                    'hover:opacity-80'
                  )}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Selected day details */}
      {selectedDate && (
        <Card padding="md">
          <CardTitle className="mb-2">{formatDate(selectedDate)}</CardTitle>
          <CardContent>
            {selectedRecord ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Badge color={
                    selectedRecord.status === 'present' ? 'green' :
                    selectedRecord.status === 'late' ? 'amber' :
                    selectedRecord.status === 'absent' ? 'red' :
                    'blue'
                  }>
                    {STATUS_LABELS[selectedRecord.status]}
                  </Badge>
                  {selectedRecord.late_minutes > 0 && (
                    <span className="text-xs text-amber-600">{selectedRecord.late_minutes} min late</span>
                  )}
                </div>
                <div className="flex gap-4 text-sm text-stone-600">
                  <span>In: {formatTime(selectedRecord.time_in)}</span>
                  <span>Out: {formatTime(selectedRecord.time_out)}</span>
                </div>
                {selectedRecord.reason && (
                  <p className="text-xs text-stone-500">Reason: {selectedRecord.reason}</p>
                )}
                {user?.role === 'head_admin' && (
                  <button
                    onClick={() => handleDeleteAttendance(selectedRecord.id)}
                    title="Delete"
                    className="mt-2 inline-flex items-center gap-1.5 rounded-md p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                    </svg>
                    <span className="text-xs">Delete</span>
                  </button>
                )}
              </div>
            ) : (
              <p className="text-sm text-stone-400">No attendance record for this day</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
