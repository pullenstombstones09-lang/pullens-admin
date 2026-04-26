'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import type { Leave, LeaveBalance, LeaveType } from '@/types/database';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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

export default function LeaveTab({ employeeId }: LeaveTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [balance, setBalance] = useState<LeaveBalance | null>(null);
  const [leaves, setLeaves] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

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
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleRecordLeave = () => {
    // Placeholder — will be wired to a modal/form
    alert('Record leave form coming soon');
  };

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
            <p className="text-2xl font-bold text-[#1A1A2E]">
              {balance?.annual_remaining ?? 0}
              <span className="text-sm font-normal text-stone-400">/21</span>
            </p>
            <p className="text-xs text-stone-500 mt-1">Annual</p>
            {/* Progress ring */}
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
            <p className="text-2xl font-bold text-[#1A1A2E]">
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
            <p className="text-2xl font-bold text-[#1A1A2E]">
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
      <Button variant="primary" size="md" onClick={handleRecordLeave} icon={<Plus className="h-4 w-4" />}>
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
                      className="text-xs text-[#C4A35A] font-medium whitespace-nowrap min-h-[36px] flex items-center"
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
    </div>
  );
}
