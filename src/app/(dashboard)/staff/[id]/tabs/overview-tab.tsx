'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatCurrency } from '@/lib/utils';
import { Card, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { EmployeeInfoCard } from '@/components/ui/employee-info-card';
import {
  CalendarCheck,
  Banknote,
  AlertTriangle,
  Palmtree,
  Receipt,
  FileWarning,
} from 'lucide-react';

interface OverviewTabProps {
  employeeId: string;
  employee: any;
  userRole: string | undefined;
  setEmployee: (updater: (prev: any) => any) => void;
}

interface OverviewData {
  attendance: { present: number; late: number; absent: number; leave: number };
  loanBalance: number;
  activeWarnings: number;
  leaveBalance: { annual: number; sick: number; family: number };
  lastPayslipNet: number | null;
  missingDocs: string[];
}

const REQUIRED_DOCS = [
  { key: 'id_copy', label: 'ID Copy' },
  { key: 'contract', label: 'Contract' },
  { key: 'eif', label: 'EIF' },
  { key: 'bank', label: 'Banking Details' },
];

export default function OverviewTab({ employeeId, employee, userRole, setEmployee }: OverviewTabProps) {
  const supabase = createClient();
  const [data, setData] = useState<OverviewData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const today = new Date();
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() - today.getDay() - 2); // Approx start of work week (Fri)
      const weekStartStr = weekStart.toISOString().slice(0, 10);
      const todayStr = today.toISOString().slice(0, 10);

      const [attendRes, loanRes, warnRes, leaveBalRes, payslipRes, docRes] = await Promise.all([
        supabase
          .from('attendance')
          .select('status')
          .eq('employee_id', employeeId)
          .gte('date', weekStartStr)
          .lte('date', todayStr),
        supabase
          .from('loans')
          .select('outstanding')
          .eq('employee_id', employeeId)
          .eq('status', 'active'),
        supabase
          .from('warnings')
          .select('id')
          .eq('employee_id', employeeId)
          .eq('status', 'active'),
        supabase
          .from('leave_balances')
          .select('annual_remaining, sick_remaining, family_remaining')
          .eq('employee_id', employeeId)
          .single(),
        supabase
          .from('payslips')
          .select('net')
          .eq('employee_id', employeeId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('employee_documents')
          .select('doc_type')
          .eq('employee_id', employeeId),
      ]);

      const attendance = (attendRes.data ?? []) as { status: string }[];
      const att = {
        present: attendance.filter((a) => a.status === 'present').length,
        late: attendance.filter((a) => a.status === 'late').length,
        absent: attendance.filter((a) => a.status === 'absent').length,
        leave: attendance.filter((a) => a.status === 'leave' || a.status === 'sick').length,
      };

      const loans = (loanRes.data ?? []) as { outstanding: number }[];
      const loanBalance = loans.reduce((sum, l) => sum + l.outstanding, 0);

      const leaveBal = leaveBalRes.data ?? { annual_remaining: 0, sick_remaining: 0, family_remaining: 0 };

      const docsOnFile = new Set((docRes.data ?? []).map((d: { doc_type: string }) => d.doc_type));
      const missingDocs = REQUIRED_DOCS.filter((rd) => !docsOnFile.has(rd.key)).map((rd) => rd.label);

      setData({
        attendance: att,
        loanBalance,
        activeWarnings: (warnRes.data ?? []).length,
        leaveBalance: {
          annual: leaveBal.annual_remaining,
          sick: leaveBal.sick_remaining,
          family: leaveBal.family_remaining,
        },
        lastPayslipNet: payslipRes.data?.net ?? null,
        missingDocs,
      });
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  if (loading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <Card padding="md">
              <div className="h-4 w-24 rounded bg-stone-200 mb-3" />
              <div className="h-8 w-16 rounded bg-stone-200" />
            </Card>
          </div>
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <EmployeeInfoCard
        employee={employee}
        canEdit={userRole === 'owner'}
        onUpdate={async (updates) => {
          await supabase.from('employees').update(updates).eq('id', employee.id);
          setEmployee((prev: any) => ({ ...prev, ...updates }));
        }}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {/* This week's attendance */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <CalendarCheck className="h-4 w-4 text-[#1E40AF]" />
          <CardTitle>This Week</CardTitle>
        </div>
        <CardContent>
          <div className="grid grid-cols-4 gap-2 text-center">
            <div>
              <p className="text-lg font-bold text-emerald-600">{data.attendance.present}</p>
              <p className="text-[10px] text-stone-500">Present</p>
            </div>
            <div>
              <p className="text-lg font-bold text-amber-600">{data.attendance.late}</p>
              <p className="text-[10px] text-stone-500">Late</p>
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{data.attendance.absent}</p>
              <p className="text-[10px] text-stone-500">Absent</p>
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{data.attendance.leave}</p>
              <p className="text-[10px] text-stone-500">Leave</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Loan balance */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Banknote className="h-4 w-4 text-[#1E40AF]" />
          <CardTitle>Loan Balance</CardTitle>
        </div>
        <CardContent>
          <p className={`text-2xl font-bold ${data.loanBalance > 0 ? 'text-amber-600' : 'text-stone-400'}`}>
            {data.loanBalance > 0 ? formatCurrency(data.loanBalance) : 'None'}
          </p>
        </CardContent>
      </Card>

      {/* Active warnings */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle className="h-4 w-4 text-[#1E40AF]" />
          <CardTitle>Warnings</CardTitle>
        </div>
        <CardContent>
          <p className={`text-2xl font-bold ${data.activeWarnings > 0 ? 'text-red-600' : 'text-stone-400'}`}>
            {data.activeWarnings > 0 ? data.activeWarnings : 'Clean'}
          </p>
          <p className="text-xs text-stone-500 mt-1">Active warnings</p>
        </CardContent>
      </Card>

      {/* Leave balance */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Palmtree className="h-4 w-4 text-[#1E40AF]" />
          <CardTitle>Leave Balance</CardTitle>
        </div>
        <CardContent>
          <div className="space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Annual</span>
              <span className="font-semibold">{data.leaveBalance.annual}/21</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Sick</span>
              <span className="font-semibold">{data.leaveBalance.sick}/30</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-stone-600">Family</span>
              <span className="font-semibold">{data.leaveBalance.family}/3</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Last payslip */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <Receipt className="h-4 w-4 text-[#1E40AF]" />
          <CardTitle>Last Payslip</CardTitle>
        </div>
        <CardContent>
          <p className="text-2xl font-bold text-[#1E293B]">
            {data.lastPayslipNet !== null ? formatCurrency(data.lastPayslipNet) : '---'}
          </p>
          <p className="text-xs text-stone-500 mt-1">Net pay</p>
        </CardContent>
      </Card>

      {/* Missing documents */}
      <Card padding="md">
        <div className="flex items-center gap-2 mb-3">
          <FileWarning className="h-4 w-4 text-[#1E40AF]" />
          <CardTitle>Documents</CardTitle>
        </div>
        <CardContent>
          {data.missingDocs.length === 0 ? (
            <p className="text-sm text-emerald-600 font-medium">All on file</p>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {data.missingDocs.map((doc) => (
                <Badge key={doc} color="red">
                  Missing: {doc}
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
}
