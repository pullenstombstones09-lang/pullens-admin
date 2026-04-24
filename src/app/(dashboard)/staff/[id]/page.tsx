'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn, getInitials, formatDate, yearsOfService } from '@/lib/utils';
import type { Employee, Warning, Loan, LeaveBalance } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  Camera,
  LayoutGrid,
  Receipt,
  FileText,
  CalendarCheck,
  AlertTriangle,
  Banknote,
  Palmtree,
  Scale,
} from 'lucide-react';

import OverviewTab from './tabs/overview-tab';
import PayslipsTab from './tabs/payslips-tab';
import DocumentsTab from './tabs/documents-tab';
import AttendanceTab from './tabs/attendance-tab';
import WarningsTab from './tabs/warnings-tab';
import LoansTab from './tabs/loans-tab';
import LeaveTab from './tabs/leave-tab';
import DisciplinaryTab from './tabs/disciplinary-tab';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutGrid },
  { key: 'payslips', label: 'Payslips', icon: Receipt },
  { key: 'documents', label: 'Documents', icon: FileText },
  { key: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { key: 'warnings', label: 'Warnings', icon: AlertTriangle },
  { key: 'loans', label: 'Loans', icon: Banknote },
  { key: 'leave', label: 'Leave', icon: Palmtree },
  { key: 'disciplinary', label: 'Disciplinary', icon: Scale },
] as const;

type TabKey = (typeof TABS)[number]['key'];

interface StatusChip {
  label: string;
  color: 'green' | 'red' | 'amber' | 'blue' | 'purple' | 'yellow' | 'grey';
}

export default function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [statusChips, setStatusChips] = useState<StatusChip[]>([]);

  useEffect(() => {
    async function load() {
      setLoading(true);
      const today = new Date().toISOString().slice(0, 10);
      const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

      const [empRes, warnRes, loanRes, leaveBalRes, leaveRes] = await Promise.all([
        supabase.from('employees').select('*').eq('id', id).single(),
        supabase.from('warnings').select('level, status').eq('employee_id', id).eq('status', 'active'),
        supabase.from('loans').select('outstanding, status').eq('employee_id', id).eq('status', 'active'),
        supabase.from('leave_balances').select('*').eq('employee_id', id).single(),
        supabase.from('leave').select('from_date, to_date').eq('employee_id', id).lte('from_date', today).gte('to_date', today),
      ]);

      const emp = empRes.data as Employee | null;
      if (!emp) {
        setLoading(false);
        return;
      }
      setEmployee(emp);

      // Build status chips
      const chips: StatusChip[] = [];

      if (emp.status === 'active') {
        chips.push({ label: 'Active', color: 'green' });
      } else {
        chips.push({ label: emp.status, color: 'grey' });
      }

      // On leave
      if ((leaveRes.data ?? []).length > 0) {
        chips.push({ label: 'On Leave', color: 'blue' });
      }

      // Probation
      if (emp.start_date) {
        const probEnd = new Date(emp.start_date);
        probEnd.setMonth(probEnd.getMonth() + 3);
        const probEndStr = probEnd.toISOString().slice(0, 10);
        if (probEndStr >= today && probEndStr <= in14) {
          chips.push({ label: 'Probation ending', color: 'purple' });
        }
      }

      // Active warnings
      const warnings = warnRes.data ?? [];
      if (warnings.some((w: { level: string }) => w.level === 'final')) {
        chips.push({ label: 'Final warning', color: 'red' });
      } else if (warnings.some((w: { level: string }) => w.level === 'written')) {
        chips.push({ label: 'Written warning', color: 'amber' });
      }

      // Garnishee
      if (emp.garnishee > 0) {
        chips.push({ label: 'Garnishee', color: 'red' });
      }

      // Outstanding loan
      const loans = loanRes.data ?? [];
      if (loans.length > 0) {
        chips.push({ label: 'Outstanding loan', color: 'amber' });
      }

      setStatusChips(chips);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handlePhotoUpload = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.capture = 'environment';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file || !employee) return;

      const ext = file.name.split('.').pop();
      const path = `employee-photos/${employee.id}.${ext}`;
      const { error } = await supabase.storage.from('documents').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('documents').getPublicUrl(path);
        await supabase.from('employees').update({ photo_url: urlData.publicUrl }).eq('id', employee.id);
        setEmployee({ ...employee, photo_url: urlData.publicUrl });
      }
    };
    input.click();
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F5F3EF]">
        <div className="p-4 md:p-8">
          {/* Skeleton header */}
          <div className="animate-pulse">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-8 w-8 rounded bg-stone-200" />
              <div className="h-5 w-24 rounded bg-stone-200" />
            </div>
            <div className="flex items-center gap-5">
              <div className="h-20 w-20 rounded-full bg-stone-200" />
              <div className="space-y-2">
                <div className="h-6 w-48 rounded bg-stone-200" />
                <div className="h-4 w-32 rounded bg-stone-200" />
                <div className="h-4 w-40 rounded bg-stone-200" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen bg-[#F5F3EF] flex items-center justify-center">
        <div className="text-center">
          <p className="text-stone-500 mb-4">Employee not found</p>
          <button onClick={() => router.push('/staff')} className="text-[#C4A35A] text-sm font-medium">
            Back to staff list
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      {/* Profile header — always visible */}
      <div className="sticky top-0 z-20 bg-[#F5F3EF]/95 backdrop-blur-sm border-b border-stone-200">
        <div className="px-4 md:px-8 pt-4 pb-3">
          {/* Back button */}
          <button
            onClick={() => router.push('/staff')}
            className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 mb-3 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4" />
            Staff List
          </button>

          <div className="flex items-start gap-4">
            {/* Photo */}
            <button
              onClick={handlePhotoUpload}
              className="relative group shrink-0"
              title="Tap to update photo"
            >
              {employee.photo_url ? (
                <img
                  src={employee.photo_url}
                  alt={employee.full_name}
                  className="h-20 w-20 rounded-full object-cover ring-2 ring-white shadow-md"
                />
              ) : (
                <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[#1A1A2E] text-lg font-bold text-[#C4A35A] ring-2 ring-white shadow-md">
                  {getInitials(employee.full_name)}
                </div>
              )}
              <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera className="h-5 w-5 text-white" />
              </div>
            </button>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-[#1A1A2E] truncate leading-tight">
                {employee.full_name}
              </h1>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-1">
                <span className="text-sm font-mono text-[#C4A35A] font-semibold">{employee.pt_code}</span>
                {employee.id_number && (
                  <span className="text-xs text-stone-500">{employee.id_number}</span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 mt-0.5">
                {employee.occupation && (
                  <span className="text-sm text-stone-600">{employee.occupation}</span>
                )}
                {employee.start_date && (
                  <span className="text-xs text-stone-400">
                    Started {formatDate(employee.start_date)} ({yearsOfService(employee.start_date)})
                  </span>
                )}
              </div>

              {/* Status chips */}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {statusChips.map((chip, i) => (
                  <Badge key={i} color={chip.color}>
                    {chip.label}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Tab bar */}
        <div className="flex overflow-x-auto scrollbar-none border-t border-stone-100">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  'flex items-center gap-1.5 px-4 py-3 text-xs font-medium whitespace-nowrap transition-colors min-h-[48px] shrink-0',
                  'border-b-2',
                  activeTab === tab.key
                    ? 'border-[#C4A35A] text-[#C4A35A]'
                    : 'border-transparent text-stone-500 hover:text-stone-700'
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab content */}
      <div className="px-4 md:px-8 py-6">
        {activeTab === 'overview' && <OverviewTab employeeId={id} />}
        {activeTab === 'payslips' && <PayslipsTab employeeId={id} />}
        {activeTab === 'documents' && <DocumentsTab employeeId={id} />}
        {activeTab === 'attendance' && <AttendanceTab employeeId={id} />}
        {activeTab === 'warnings' && <WarningsTab employeeId={id} />}
        {activeTab === 'loans' && <LoansTab employeeId={id} />}
        {activeTab === 'leave' && <LeaveTab employeeId={id} />}
        {activeTab === 'disciplinary' && <DisciplinaryTab employeeId={id} />}
      </div>
    </div>
  );
}
