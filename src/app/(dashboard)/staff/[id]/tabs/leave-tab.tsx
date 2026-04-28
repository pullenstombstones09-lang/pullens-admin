'use client';

import { useCallback, useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import type { Leave, LeaveBalance, LeaveType } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { SlidePanel } from '@/components/ui/slide-panel';
import { useUndo } from '@/components/ui/undo-toast';
import { Palmtree, Plus, Calendar } from 'lucide-react';

interface LeaveTabProps {
  employeeId: string;
}

const LEAVE_TYPE_LABELS: Record<LeaveType, string> = {
  annual: 'Annual',
  sick: 'Sick',
  family: 'Family Resp.',
  parental: 'Parental',
  unpaid: 'Unpaid',
};

const LEAVE_TYPE_COLORS: Record<LeaveType, 'green' | 'red' | 'blue' | 'purple' | 'grey'> = {
  annual: 'green',
  sick: 'red',
  family: 'blue',
  parental: 'purple',
  unpaid: 'grey',
};

const EMPTY_FORM = { type: 'annual', from_date: '', to_date: '', reason: '' };

export default function LeaveTab({ employeeId }: LeaveTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const { showUndo } = useUndo();

  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  // Record leave panel
  const [showRecordLeave, setShowRecordLeave] = useState(false);
  const [leaveForm, setLeaveForm] = useState(EMPTY_FORM);
  const [savingLeave, setSavingLeave] = useState(false);

  const fetchLeave = useCallback(async () => {
    const [balRes, leaveRes] = await Promise.all([
      supabase
        .from('leave_balances')
        .select('*')
        .eq('employee_id', employeeId)
        .single(),
      supabase
        .from('leave')
        .select('*')
        .eq('employee_id', employeeId)
        .order('from_date', { ascending: false }),
    ]);

    setBalance((balRes.data as LeaveBalance) ?? null);
    setLeaves((leaveRes.data ?? []) as Leave[]);
  }, [employeeId, supabase]);

  useEffect(() => {
    setLoading(true);
    fetchLeave().finally(() => setLoading(false));
  }, [fetchLeave]);

  const handleDeleteLeave = async (id: string) => {
    if (!confirm('Delete this leave record? This cannot be undone.')) return;
    const { error } = await supabase.from('leave').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete leave record');
    } else {
      toast('success', 'Leave record deleted');
      setLeaves((prev) => prev.filter((l) => l.id !== id));
    }
  };

  /** Count non-Sunday days between two date strings (inclusive) */
  function getDatesInRange(from: string, to: string): string[] {
    const dates: string[] = [];
    const current = new Date(from);
    const end = new Date(to);
    while (current <= end) {
      if (current.getDay() !== 0) {
        dates.push(current.toISOString().split('T')[0]);
      }
      current.setDate(current.getDate() + 1);
    }
    return dates;
  }

  const handleSaveLeave = async () => {
    setSavingLeave(true);

    const dates = getDatesInRange(leaveForm.from_date, leaveForm.to_date);
    const days = dates.length;

    const { data, error } = await supabase
      .from('leave')
      .insert({
        employee_id: employeeId,
        leave_type: leaveForm.type as LeaveType,
        from_date: leaveForm.from_date,
        to_date: leaveForm.to_date,
        days,
        reason: leaveForm.reason || null,
        approved_by: user?.name ?? null,
        approved_at: new Date().toISOString(),
      })
      .select()
      .single();

    if (error || !data) {
      toast('error', 'Failed to record leave');
      setSavingLeave(false);
      return;
    }

    // Create attendance records for leave days (skip Sundays)
    if (dates.length > 0) {
      await supabase.from('attendance').upsert(
        dates.map((d) => ({
          employee_id: employeeId,
          date: d,
          status: leaveForm.type === 'sick' ? 'sick' : 'leave',
          time_in: null,
          time_out: null,
          late_minutes: 0,
        })),
        { onConflict: 'employee_id,date' }
      );
    }

    setSavingLeave(false);
    setShowRecordLeave(false);
    setLeaveForm(EMPTY_FORM);
    fetchLeave();

    showUndo('Leave recorded', async () => {
      await supabase.from('leave').delete().eq('id', data.id);
      if (dates.length > 0) {
        for (const d of dates) {
          await supabase
            .from('attendance')
            .delete()
            .eq('employee_id', employeeId)
            .eq('date', d)
            .in('status', ['leave', 'sick']);
        }
      }
      fetchLeave();
    });
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-24 rounded-xl bg-stone-200" />
        </div>
        <div className="animate-pulse space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-16 rounded-xl bg-stone-200" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Balance cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card padding="md">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#1E293B]">
              {balance?.annual_remaining ?? 0}
              <span className="text-sm font-normal text-stone-400">/21</span>
            </p>
            <p className="text-xs text-stone-500 mt-1">Annual</p>
            <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-emerald-400 transition-all"
                style={{ width: `${((balance?.annual_remaining ?? 0) / 21) * 100}%` }}
              />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#1E293B]">
              {balance?.sick_remaining ?? 0}
              <span className="text-sm font-normal text-stone-400">/30</span>
            </p>
            <p className="text-xs text-stone-500 mt-1">Sick</p>
            <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-red-400 transition-all"
                style={{ width: `${((balance?.sick_remaining ?? 0) / 30) * 100}%` }}
              />
            </div>
          </div>
        </Card>

        <Card padding="md">
          <div className="text-center">
            <p className="text-2xl font-bold text-[#1E293B]">
              {balance?.family_remaining ?? 0}
              <span className="text-sm font-normal text-stone-400">/3</span>
            </p>
            <p className="text-xs text-stone-500 mt-1">Family</p>
            <div className="mt-2 h-1.5 rounded-full bg-stone-100 overflow-hidden">
              <div
                className="h-full rounded-full bg-blue-400 transition-all"
                style={{ width: `${((balance?.family_remaining ?? 0) / 3) * 100}%` }}
              />
            </div>
          </div>
        </Card>
      </div>

      {/* Record leave button */}
      <Button variant="primary" size="md" onClick={() => setShowRecordLeave(true)} icon={<Plus className="h-4 w-4" />}>
        Record Leave
      </Button>

      {/* Leave history */}
      {leaves.length === 0 ? (
        <div className="py-12 text-center">
          <Palmtree className="mx-auto h-12 w-12 text-stone-300 mb-3" />
          <p className="text-sm text-stone-500">No leave records</p>
        </div>
      ) : (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold text-stone-400">Leave History</h3>
          {leaves.map((leave) => (
            <Card key={leave.id} padding="md">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-stone-100">
                    <Calendar className="h-5 w-5 text-stone-500" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <Badge color={LEAVE_TYPE_COLORS[leave.leave_type]}>
                        {LEAVE_TYPE_LABELS[leave.leave_type]}
                      </Badge>
                      <span className="text-xs font-semibold text-stone-600">
                        {leave.days} day{leave.days !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <p className="text-xs text-stone-500">
                      {formatDate(leave.from_date)}
                      {leave.from_date !== leave.to_date && ` — ${formatDate(leave.to_date)}`}
                    </p>
                    {leave.reason && (
                      <p className="text-xs text-stone-400 mt-0.5">{leave.reason}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {leave.medical_cert_url && (
                    <button
                      onClick={() => window.open(leave.medical_cert_url!, '_blank')}
                      className="text-xs text-[#3B82F6] font-medium whitespace-nowrap min-h-[36px] flex items-center"
                    >
                      View cert
                    </button>
                  )}
                  {user?.role === 'head_admin' && (
                    <button
                      onClick={() => handleDeleteLeave(leave.id)}
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
      )}

      {/* Record Leave slide panel */}
      <SlidePanel open={showRecordLeave} onClose={() => setShowRecordLeave(false)} title="Record Leave">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Leave Type</label>
            <select
              value={leaveForm.type}
              onChange={(e) => setLeaveForm((prev) => ({ ...prev, type: e.target.value }))}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
            >
              <option value="annual">Annual Leave</option>
              <option value="sick">Sick Leave</option>
              <option value="family">Family Responsibility</option>
              <option value="unpaid">Unpaid Leave</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={leaveForm.from_date}
              onChange={(e) => setLeaveForm((prev) => ({ ...prev, from_date: e.target.value }))}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={leaveForm.to_date}
              onChange={(e) => setLeaveForm((prev) => ({ ...prev, to_date: e.target.value }))}
              min={leaveForm.from_date || undefined}
              className="w-full h-11 rounded-lg border border-gray-300 px-3 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea
              value={leaveForm.reason}
              onChange={(e) => setLeaveForm((prev) => ({ ...prev, reason: e.target.value }))}
              rows={3}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none resize-none"
              placeholder="Optional reason"
            />
          </div>

          <button
            disabled={!leaveForm.from_date || !leaveForm.to_date || savingLeave}
            onClick={handleSaveLeave}
            className="w-full h-11 rounded-lg bg-[#1E40AF] text-white font-semibold text-sm hover:bg-[#1E3A8A] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {savingLeave ? 'Saving...' : 'Record Leave'}
          </button>
        </div>
      </SlidePanel>
    </div>
  );
}
