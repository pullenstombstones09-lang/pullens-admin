'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { cn, getInitials, formatDate, yearsOfService } from '@/lib/utils';
import type { Employee, Warning, Loan, LeaveBalance, PaymentMethod } from '@/types/database';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
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
  Pencil,
  X,
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

/* ─── Edit Employee Modal ─── */
interface EditModalProps {
  employee: Employee;
  onClose: () => void;
  onSaved: (updated: Employee) => void;
}

function EditEmployeeModal({ employee, onClose, onSaved }: EditModalProps) {
  const supabase = createClient();
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    full_name: employee.full_name ?? '',
    weekly_wage: employee.weekly_wage ?? 0,
    occupation: employee.occupation ?? '',
    id_number: employee.id_number ?? '',
    dob: employee.dob ?? '',
    gender: employee.gender ?? '',
    race: employee.race ?? '',
    disability: employee.disability ?? false,
    cell: employee.cell ?? '',
    email: employee.email ?? '',
    home_address: employee.home_address ?? '',
    start_date: employee.start_date ?? '',
    payment_method: employee.payment_method ?? 'cash',
    bank_name: employee.bank_name ?? '',
    bank_acc: employee.bank_acc ?? '',
    bank_branch: employee.bank_branch ?? '',
    bank_type: employee.bank_type ?? '',
    tax_number: employee.tax_number ?? '',
    uif_ref: employee.uif_ref ?? '',
    emergency_name: employee.emergency_name ?? '',
    emergency_rel: employee.emergency_rel ?? '',
    emergency_phone: employee.emergency_phone ?? '',
    nok_name: employee.nok_name ?? '',
    nok_rel: employee.nok_rel ?? '',
    nok_phone: employee.nok_phone ?? '',
    garnishee: employee.garnishee ?? 0,
    notes: employee.notes ?? '',
  });

  const set = (field: string, value: string | number) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSave = async () => {
    if (!form.full_name.trim()) {
      toast('error', 'Full name is required');
      return;
    }
    setSaving(true);
    const payload = {
      full_name: form.full_name.trim(),
      weekly_wage: Number(form.weekly_wage) || 0,
      occupation: form.occupation.trim() || null,
      id_number: form.id_number.trim() || null,
      dob: form.dob || null,
      gender: form.gender || null,
      race: form.race || null,
      disability: form.disability,
      cell: form.cell.trim() || null,
      email: form.email.trim() || null,
      home_address: form.home_address.trim() || null,
      start_date: form.start_date || null,
      payment_method: form.payment_method as PaymentMethod,
      bank_name: form.payment_method === 'eft' ? (form.bank_name.trim() || null) : null,
      bank_acc: form.payment_method === 'eft' ? (form.bank_acc.trim() || null) : null,
      bank_branch: form.payment_method === 'eft' ? (form.bank_branch.trim() || null) : null,
      bank_type: form.payment_method === 'eft' ? (form.bank_type.trim() || null) : null,
      tax_number: form.tax_number.trim() || null,
      uif_ref: form.uif_ref.trim() || null,
      emergency_name: form.emergency_name.trim() || null,
      emergency_rel: form.emergency_rel.trim() || null,
      emergency_phone: form.emergency_phone.trim() || null,
      nok_name: form.nok_name.trim() || null,
      nok_rel: form.nok_rel.trim() || null,
      nok_phone: form.nok_phone.trim() || null,
      garnishee: Number(form.garnishee) || 0,
      notes: form.notes.trim() || null,
    };

    const { error } = await supabase
      .from('employees')
      .update(payload)
      .eq('id', employee.id);

    setSaving(false);
    if (error) {
      toast('error', `Save failed: ${error.message}`);
      return;
    }
    toast('success', 'Employee updated');
    onSaved({ ...employee, ...payload } as Employee);
  };

  const inputCls =
    'w-full rounded-lg border border-stone-300 bg-white px-3 py-2.5 text-sm text-[#1A1A2E] min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#C4A35A]/40 focus:border-[#C4A35A] transition-colors';
  const labelCls = 'block text-xs font-medium text-stone-500 mb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg my-8 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100">
          <h2 className="text-lg font-bold text-[#1A1A2E]">Edit Employee</h2>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-stone-400 hover:text-stone-600 hover:bg-stone-100 transition-colors min-w-[48px] min-h-[48px] flex items-center justify-center"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 max-h-[70vh] overflow-y-auto space-y-4">
          {/* Two-col grid for short fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Full name</label>
              <input
                className={inputCls}
                value={form.full_name}
                onChange={(e) => set('full_name', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Weekly wage (R)</label>
              <input
                type="number"
                className={inputCls}
                value={form.weekly_wage}
                onChange={(e) => set('weekly_wage', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Occupation</label>
              <input
                className={inputCls}
                value={form.occupation}
                onChange={(e) => set('occupation', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>ID number</label>
              <input
                className={inputCls}
                value={form.id_number}
                onChange={(e) => set('id_number', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Date of birth</label>
              <input
                type="date"
                className={inputCls}
                value={form.dob}
                onChange={(e) => set('dob', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Gender</label>
              <select
                className={inputCls}
                value={form.gender}
                onChange={(e) => set('gender', e.target.value)}
              >
                <option value="">—</option>
                <option value="Male">Male</option>
                <option value="Female">Female</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Race</label>
              <select
                className={inputCls}
                value={form.race}
                onChange={(e) => set('race', e.target.value)}
              >
                <option value="">—</option>
                <option value="African">African</option>
                <option value="Coloured">Coloured</option>
                <option value="Indian">Indian</option>
                <option value="White">White</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Disability</label>
              <select
                className={inputCls}
                value={form.disability ? 'yes' : 'no'}
                onChange={(e) => set('disability', e.target.value === 'yes' ? true as unknown as string : false as unknown as string)}
              >
                <option value="no">No</option>
                <option value="yes">Yes</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Start date</label>
              <input
                type="date"
                className={inputCls}
                value={form.start_date}
                onChange={(e) => set('start_date', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Cell</label>
              <input
                className={inputCls}
                value={form.cell}
                onChange={(e) => set('cell', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                className={inputCls}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <label className={labelCls}>Home address</label>
              <input
                className={inputCls}
                value={form.home_address}
                onChange={(e) => set('home_address', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Payment method</label>
              <select
                className={inputCls}
                value={form.payment_method}
                onChange={(e) => set('payment_method', e.target.value)}
              >
                <option value="eft">EFT</option>
                <option value="cash">Cash</option>
              </select>
            </div>

            {form.payment_method === 'eft' && (
              <>
                <div>
                  <label className={labelCls}>Bank name</label>
                  <input
                    className={inputCls}
                    value={form.bank_name}
                    onChange={(e) => set('bank_name', e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelCls}>Bank account</label>
                  <input
                    className={inputCls}
                    value={form.bank_acc}
                    onChange={(e) => set('bank_acc', e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelCls}>Bank branch code</label>
                  <input
                    className={inputCls}
                    value={form.bank_branch}
                    onChange={(e) => set('bank_branch', e.target.value)}
                  />
                </div>

                <div>
                  <label className={labelCls}>Account type</label>
                  <select
                    className={inputCls}
                    value={form.bank_type}
                    onChange={(e) => set('bank_type', e.target.value)}
                  >
                    <option value="">—</option>
                    <option value="savings">Savings</option>
                    <option value="cheque">Cheque</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className={labelCls}>Tax number</label>
              <input
                className={inputCls}
                value={form.tax_number}
                onChange={(e) => set('tax_number', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>UIF reference</label>
              <input
                className={inputCls}
                value={form.uif_ref}
                onChange={(e) => set('uif_ref', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Emergency name</label>
              <input
                className={inputCls}
                value={form.emergency_name}
                onChange={(e) => set('emergency_name', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Emergency relationship</label>
              <input
                className={inputCls}
                value={form.emergency_rel}
                onChange={(e) => set('emergency_rel', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Emergency phone</label>
              <input
                className={inputCls}
                value={form.emergency_phone}
                onChange={(e) => set('emergency_phone', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Next of kin name</label>
              <input
                className={inputCls}
                value={form.nok_name}
                onChange={(e) => set('nok_name', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Next of kin relationship</label>
              <input
                className={inputCls}
                value={form.nok_rel}
                onChange={(e) => set('nok_rel', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Next of kin phone</label>
              <input
                className={inputCls}
                value={form.nok_phone}
                onChange={(e) => set('nok_phone', e.target.value)}
              />
            </div>

            <div>
              <label className={labelCls}>Garnishee amount (R)</label>
              <input
                type="number"
                className={inputCls}
                value={form.garnishee}
                onChange={(e) => set('garnishee', e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Notes</label>
            <textarea
              className={cn(inputCls, 'min-h-[80px] resize-y')}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              rows={3}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-stone-100">
          <button
            onClick={onClose}
            className="rounded-lg px-4 py-2.5 text-sm font-medium text-stone-600 hover:bg-stone-100 transition-colors min-h-[48px]"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="rounded-lg px-5 py-2.5 text-sm font-semibold text-white bg-[#C4A35A] hover:bg-[#b3923f] disabled:opacity-50 transition-colors min-h-[48px]"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [employee, setEmployee] = useState<Employee | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('overview');
  const [statusChips, setStatusChips] = useState<StatusChip[]>([]);
  const [editOpen, setEditOpen] = useState(false);

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

      try {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('employeeId', employee.id);

        const res = await fetch('/api/upload-photo', { method: 'POST', body: formData });
        const data = await res.json();

        if (!res.ok) {
          toast('error', data.error || 'Photo upload failed');
          return;
        }

        setEmployee({ ...employee, photo_url: data.photo_url });
        toast('success', 'Photo saved');
      } catch {
        toast('error', 'Photo upload failed');
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
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold text-[#1A1A2E] truncate leading-tight">
                  {employee.full_name}
                </h1>
                {user?.role === 'head_admin' && (
                  <button
                    onClick={() => setEditOpen(true)}
                    className="shrink-0 rounded-lg p-2 text-stone-400 hover:text-[#C4A35A] hover:bg-stone-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
                    title="Edit employee"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                )}
              </div>
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

      {/* Edit employee modal */}
      {editOpen && employee && (
        <EditEmployeeModal
          employee={employee}
          onClose={() => setEditOpen(false)}
          onSaved={(updated) => {
            setEmployee(updated);
            setEditOpen(false);
          }}
        />
      )}
    </div>
  );
}
