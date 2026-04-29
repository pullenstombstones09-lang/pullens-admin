'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  Settings as SettingsIcon,
  Building2,
  Banknote,
  Clock,
  CalendarClock,
  Wallet,
  Calendar,
  Users,
  Save,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  ScrollText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { UserRole, PublicHoliday, User } from '@/types/database';
import type { ReactNode } from 'react';

// ─── Settings section wrapper ───
function Section({
  title,
  icon,
  children,
  defaultOpen = true,
}: {
  title: string;
  icon: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card>
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-5 py-4 text-left min-h-[48px]"
      >
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#1E293B]/5">
            <span className="text-[#1E293B]">{icon}</span>
          </div>
          <h2 className="text-base font-semibold text-[#333333]">{title}</h2>
        </div>
        {open ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {open && <div className="px-5 pb-5 pt-1 border-t border-gray-100">{children}</div>}
    </Card>
  );
}

// Types for settings
interface CompanyDetails {
  legal_name: string;
  reg_number: string;
  coid_number: string;
  uif_ref: string;
  address: string;
  phone: string;
  tax_ref: string;
}

interface PayRules {
  nmw_hourly: number;
  ordinary_hours_week: number;
  ot_multiplier_weekday: number;
  ot_multiplier_sunday_ph: number;
  pay_cycle_day_start: number;
  pay_cycle_day_end: number;
}

interface LateRules {
  grace_minutes: number;
  tier1_minutes: number;
  tier1_dock_minutes: number;
  tier2_minutes: number;
  tier2_dock_minutes: number;
}

interface WorkHours {
  start_time: string;
  end_time_mon_thu: string;
  end_time_fri: string;
  break_duration_minutes: number;
}

interface PettyCashSettings {
  cutoff_day: string;
  cutoff_hour: number;
}

interface PayWeekSettings {
  mode: 'fixed' | 'custom';
  start_day: string;
  end_day: string;
  start_date: string;
  end_date: string;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [supabase] = useState(() => createClient());
  const [saving, setSaving] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);

  // ─── Company Details ───
  const [company, setCompany] = useState<CompanyDetails>({
    legal_name: 'Amazon Creek Trading (Pty) Ltd t/a Pullens Tombstones',
    reg_number: '2011/105461/23',
    coid_number: '990001280518',
    uif_ref: '2573997/9',
    address: '',
    phone: '',
    tax_ref: '',
  });

  // ─── Pay Rules ───
  const [payRules, setPayRules] = useState<PayRules>({
    nmw_hourly: 30.23,
    ordinary_hours_week: 45,
    ot_multiplier_weekday: 1.5,
    ot_multiplier_sunday_ph: 2.0,
    pay_cycle_day_start: 1,
    pay_cycle_day_end: 7,
  });

  // ─── Late Rules ───
  const [lateRules, setLateRules] = useState<LateRules>({
    grace_minutes: 5,
    tier1_minutes: 30,
    tier1_dock_minutes: 30,
    tier2_minutes: 60,
    tier2_dock_minutes: 60,
  });

  // ─── Work Hours ───
  const [workHours, setWorkHours] = useState<WorkHours>({
    start_time: '07:00',
    end_time_mon_thu: '16:30',
    end_time_fri: '15:30',
    break_duration_minutes: 30,
  });

  // ─── Petty Cash ───
  const [pettyCash, setPettyCash] = useState<PettyCashSettings>({
    cutoff_day: 'Thursday',
    cutoff_hour: 16,
  });

  // ─── Pay Week ───
  const [payWeek, setPayWeek] = useState<PayWeekSettings>({
    mode: 'fixed',
    start_day: 'Monday',
    end_day: 'Sunday',
    start_date: '',
    end_date: '',
  });

  // ─── Public Holidays ───
  const [holidays, setHolidays] = useState<PublicHoliday[]>([]);
  const [newHoliday, setNewHoliday] = useState({ date: '', name: '' });

  // ─── Users ───
  const [users, setUsers] = useState<
    Pick<User, 'id' | 'name' | 'role' | 'active'>[]
  >([]);
  const [editingUser, setEditingUser] = useState<string | null>(null);
  const [editRole, setEditRole] = useState<UserRole>('attendance_clerk');

  // ─── Load all settings ───
  const loadSettings = useCallback(async () => {
    // Load from settings table
    const { data: settings } = await supabase
      .from('settings')
      .select('key, value');

    if (settings) {
      const map = new Map(settings.map((s) => [s.key, s.value]));

      if (map.has('company_details')) {
        setCompany((prev) => ({ ...prev, ...(map.get('company_details') as Partial<CompanyDetails>) }));
      }
      if (map.has('pay_rules')) {
        setPayRules((prev) => ({ ...prev, ...(map.get('pay_rules') as Partial<PayRules>) }));
      }
      if (map.has('late_rules')) {
        setLateRules((prev) => ({ ...prev, ...(map.get('late_rules') as Partial<LateRules>) }));
      }
      if (map.has('work_hours')) {
        setWorkHours((prev) => ({ ...prev, ...(map.get('work_hours') as Partial<WorkHours>) }));
      }
      if (map.has('petty_cash_settings')) {
        setPettyCash((prev) => ({ ...prev, ...(map.get('petty_cash_settings') as Partial<PettyCashSettings>) }));
      }
      if (map.has('pay_week')) {
        setPayWeek((prev) => ({ ...prev, ...(map.get('pay_week') as Partial<PayWeekSettings>) }));
      }
    }

    // Load holidays
    const { data: hols } = await supabase
      .from('public_holidays')
      .select('date, name')
      .order('date', { ascending: true });
    setHolidays(hols || []);

    // Load users
    const { data: usrs } = await supabase
      .from('users')
      .select('id, name, role, active')
      .order('name');
    setUsers(usrs || []);
  }, [supabase]);

  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // ─── Save a settings section ───
  async function saveSetting(key: string, value: unknown) {
    setSaving(key);
    setSaveSuccess(null);

    const { error } = await supabase.from('settings').upsert(
      {
        key,
        value,
        updated_by: user?.id || null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

    if (!error) {
      setSaveSuccess(key);
      setTimeout(() => setSaveSuccess(null), 2000);
    }

    setSaving(null);
  }

  // ─── Holiday management ───
  async function addHoliday() {
    if (!newHoliday.date || !newHoliday.name) return;
    const { error } = await supabase
      .from('public_holidays')
      .insert({ date: newHoliday.date, name: newHoliday.name });
    if (!error) {
      setHolidays((prev) =>
        [...prev, { date: newHoliday.date, name: newHoliday.name }].sort(
          (a, b) => a.date.localeCompare(b.date)
        )
      );
      setNewHoliday({ date: '', name: '' });
    }
  }

  async function deleteHoliday(date: string) {
    const { error } = await supabase
      .from('public_holidays')
      .delete()
      .eq('date', date);
    if (!error) {
      setHolidays((prev) => prev.filter((h) => h.date !== date));
    }
  }

  // ─── User role update ───
  async function updateUserRole(userId: string, newRole: UserRole) {
    const { error } = await supabase
      .from('users')
      .update({ role: newRole })
      .eq('id', userId);
    if (!error) {
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setEditingUser(null);
    }
  }

  // ─── Reset PIN ───
  async function resetPin(userId: string) {
    const confirmed = window.confirm(
      'Reset this user\'s PIN to a temporary value? They will be forced to change it on next login.'
    );
    if (!confirmed) return;

    const res = await fetch('/api/auth/change-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: userId,
        new_pin: '0000',
        admin_reset: true,
      }),
    });

    if (res.ok) {
      alert('PIN reset to 0000. User will be required to change it on next login.');
    } else {
      alert('Failed to reset PIN.');
    }
  }

  // Access check
  if (user?.role !== 'owner') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md text-center">
          <div className="flex flex-col items-center gap-3 py-8 px-6">
            <SettingsIcon className="h-12 w-12 text-gray-300" />
            <h2 className="text-lg font-semibold text-[#333333]">Access Restricted</h2>
            <p className="text-sm text-gray-500">
              Settings are only accessible to the head administrator.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  const ROLES: { value: UserRole; label: string }[] = [
    { value: 'owner', label: 'Owner' },
    { value: 'supervisor', label: 'Supervisor' },
    { value: 'bookkeeper', label: 'Bookkeeper' },
    { value: 'attendance_clerk', label: 'Attendance Clerk' },
    { value: 'cash_clerk', label: 'Cash Clerk' },
    { value: 'signer', label: 'Signer' },
  ];

  const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 md:mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#333333] flex items-center gap-2">
            <SettingsIcon className="h-6 w-6 text-[#1E40AF]" />
            Settings
          </h1>
          <p className="text-sm text-gray-500 mt-1">System configuration — head admin only</p>
        </div>
        <a href="/settings/audit-log">
          <Button variant="ghost" size="sm" icon={<ScrollText className="h-4 w-4" />}>
            Audit Log
          </Button>
        </a>
      </div>

      <div className="flex flex-col gap-4">
        {/* ─── 1. Company Details ─── */}
        <Section title="Company Details" icon={<Building2 className="h-5 w-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <Input
              label="Legal name"
              value={company.legal_name}
              onChange={(e) => setCompany((p) => ({ ...p, legal_name: e.target.value }))}
            />
            <Input
              label="Registration number"
              value={company.reg_number}
              onChange={(e) => setCompany((p) => ({ ...p, reg_number: e.target.value }))}
            />
            <Input
              label="COID number"
              value={company.coid_number}
              onChange={(e) => setCompany((p) => ({ ...p, coid_number: e.target.value }))}
            />
            <Input
              label="UIF reference"
              value={company.uif_ref}
              onChange={(e) => setCompany((p) => ({ ...p, uif_ref: e.target.value }))}
            />
            <Input
              label="Tax reference"
              value={company.tax_ref}
              onChange={(e) => setCompany((p) => ({ ...p, tax_ref: e.target.value }))}
            />
            <Input
              label="Phone"
              value={company.phone}
              onChange={(e) => setCompany((p) => ({ ...p, phone: e.target.value }))}
            />
            <div className="sm:col-span-2">
              <Input
                label="Address"
                value={company.address}
                onChange={(e) => setCompany((p) => ({ ...p, address: e.target.value }))}
              />
            </div>
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveSetting('company_details', company)}
              loading={saving === 'company_details'}
              icon={<Save className="h-4 w-4" />}
            >
              {saveSuccess === 'company_details' ? 'Saved' : 'Save'}
            </Button>
          </div>
        </Section>

        {/* ─── 2. Pay Rules ─── */}
        <Section title="Pay Rules" icon={<Banknote className="h-5 w-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            <Input
              label="NMW hourly rate (R)"
              type="number"
              step="0.01"
              value={payRules.nmw_hourly}
              onChange={(e) =>
                setPayRules((p) => ({ ...p, nmw_hourly: parseFloat(e.target.value) || 0 }))
              }
            />
            <Input
              label="Ordinary hours/week"
              type="number"
              value={payRules.ordinary_hours_week}
              onChange={(e) =>
                setPayRules((p) => ({ ...p, ordinary_hours_week: parseInt(e.target.value) || 0 }))
              }
            />
            <Input
              label="OT multiplier (weekday)"
              type="number"
              step="0.1"
              value={payRules.ot_multiplier_weekday}
              onChange={(e) =>
                setPayRules((p) => ({
                  ...p,
                  ot_multiplier_weekday: parseFloat(e.target.value) || 0,
                }))
              }
            />
            <Input
              label="OT multiplier (Sun/PH)"
              type="number"
              step="0.1"
              value={payRules.ot_multiplier_sunday_ph}
              onChange={(e) =>
                setPayRules((p) => ({
                  ...p,
                  ot_multiplier_sunday_ph: parseFloat(e.target.value) || 0,
                }))
              }
            />
            <Input
              label="Pay cycle start (day)"
              type="number"
              min="1"
              max="7"
              value={payRules.pay_cycle_day_start}
              onChange={(e) =>
                setPayRules((p) => ({
                  ...p,
                  pay_cycle_day_start: parseInt(e.target.value) || 1,
                }))
              }
            />
            <Input
              label="Pay cycle end (day)"
              type="number"
              min="1"
              max="7"
              value={payRules.pay_cycle_day_end}
              onChange={(e) =>
                setPayRules((p) => ({
                  ...p,
                  pay_cycle_day_end: parseInt(e.target.value) || 7,
                }))
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveSetting('pay_rules', payRules)}
              loading={saving === 'pay_rules'}
              icon={<Save className="h-4 w-4" />}
            >
              {saveSuccess === 'pay_rules' ? 'Saved' : 'Save'}
            </Button>
          </div>
        </Section>

        {/* ─── 3. Late-Coming Rules ─── */}
        <Section title="Late-Coming Rules" icon={<Clock className="h-5 w-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mt-3">
            <Input
              label="Grace period (minutes)"
              type="number"
              value={lateRules.grace_minutes}
              onChange={(e) =>
                setLateRules((p) => ({ ...p, grace_minutes: parseInt(e.target.value) || 0 }))
              }
              hint="Minutes before late is triggered"
            />
            <Input
              label="Tier 1 threshold (minutes)"
              type="number"
              value={lateRules.tier1_minutes}
              onChange={(e) =>
                setLateRules((p) => ({ ...p, tier1_minutes: parseInt(e.target.value) || 0 }))
              }
              hint="6-30 minutes late"
            />
            <Input
              label="Tier 1 dock (minutes)"
              type="number"
              value={lateRules.tier1_dock_minutes}
              onChange={(e) =>
                setLateRules((p) => ({ ...p, tier1_dock_minutes: parseInt(e.target.value) || 0 }))
              }
              hint="Minutes docked from pay"
            />
            <Input
              label="Tier 2 threshold (minutes)"
              type="number"
              value={lateRules.tier2_minutes}
              onChange={(e) =>
                setLateRules((p) => ({ ...p, tier2_minutes: parseInt(e.target.value) || 0 }))
              }
              hint="31-60 minutes late"
            />
            <Input
              label="Tier 2 dock (minutes)"
              type="number"
              value={lateRules.tier2_dock_minutes}
              onChange={(e) =>
                setLateRules((p) => ({ ...p, tier2_dock_minutes: parseInt(e.target.value) || 0 }))
              }
              hint="Minutes docked from pay"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveSetting('late_rules', lateRules)}
              loading={saving === 'late_rules'}
              icon={<Save className="h-4 w-4" />}
            >
              {saveSuccess === 'late_rules' ? 'Saved' : 'Save'}
            </Button>
          </div>
        </Section>

        {/* ─── 4. Work Hours ─── */}
        <Section title="Work Hours" icon={<CalendarClock className="h-5 w-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-3">
            <Input
              label="Start time"
              type="time"
              value={workHours.start_time}
              onChange={(e) => setWorkHours((p) => ({ ...p, start_time: e.target.value }))}
            />
            <Input
              label="End time (Mon-Thu)"
              type="time"
              value={workHours.end_time_mon_thu}
              onChange={(e) => setWorkHours((p) => ({ ...p, end_time_mon_thu: e.target.value }))}
            />
            <Input
              label="End time (Fri)"
              type="time"
              value={workHours.end_time_fri}
              onChange={(e) => setWorkHours((p) => ({ ...p, end_time_fri: e.target.value }))}
            />
            <Input
              label="Break (minutes)"
              type="number"
              value={workHours.break_duration_minutes}
              onChange={(e) =>
                setWorkHours((p) => ({
                  ...p,
                  break_duration_minutes: parseInt(e.target.value) || 0,
                }))
              }
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveSetting('work_hours', workHours)}
              loading={saving === 'work_hours'}
              icon={<Save className="h-4 w-4" />}
            >
              {saveSuccess === 'work_hours' ? 'Saved' : 'Save'}
            </Button>
          </div>
        </Section>

        {/* ─── 5. Petty Cash ─── */}
        <Section title="Petty Cash" icon={<Wallet className="h-5 w-5" />}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
            <div>
              <label className="text-sm font-medium text-[#333333] mb-1.5 block">Cutoff day</label>
              <div className="relative">
                <select
                  value={pettyCash.cutoff_day}
                  onChange={(e) =>
                    setPettyCash((p) => ({ ...p, cutoff_day: e.target.value }))
                  }
                  className={cn(
                    'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-10 text-sm text-[#333333]',
                    'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]',
                    'min-h-[48px] appearance-none'
                  )}
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <Input
              label="Cutoff hour (24h)"
              type="number"
              min="0"
              max="23"
              value={pettyCash.cutoff_hour}
              onChange={(e) =>
                setPettyCash((p) => ({
                  ...p,
                  cutoff_hour: parseInt(e.target.value) || 0,
                }))
              }
              hint="e.g. 16 = 4:00 PM"
            />
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveSetting('petty_cash_settings', pettyCash)}
              loading={saving === 'petty_cash_settings'}
              icon={<Save className="h-4 w-4" />}
            >
              {saveSuccess === 'petty_cash_settings' ? 'Saved' : 'Save'}
            </Button>
          </div>
        </Section>

        {/* ─── 6. Pay Week ─── */}
        <Section title="Pay Week" icon={<CalendarClock className="h-5 w-5" />} defaultOpen={false}>
          <div className="mt-3 space-y-4">
            {/* Mode toggle */}
            <div className="flex gap-2">
              <button
                onClick={() => setPayWeek((p) => ({ ...p, mode: 'fixed' }))}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[48px]',
                  payWeek.mode === 'fixed'
                    ? 'bg-[#1E293B] text-white'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                )}
              >
                Fixed days
              </button>
              <button
                onClick={() => setPayWeek((p) => ({ ...p, mode: 'custom' }))}
                className={cn(
                  'rounded-full px-4 py-2 text-sm font-medium transition-colors min-h-[48px]',
                  payWeek.mode === 'custom'
                    ? 'bg-[#1E293B] text-white'
                    : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
                )}
              >
                Custom dates
              </button>
            </div>

            {payWeek.mode === 'fixed' ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">Week starts on</label>
                  <div className="relative">
                    <select
                      value={payWeek.start_day}
                      onChange={(e) => setPayWeek((p) => ({ ...p, start_day: e.target.value }))}
                      className={cn(
                        'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-10 text-sm text-[#333333]',
                        'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]',
                        'min-h-[48px] appearance-none'
                      )}
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">Week ends on</label>
                  <div className="relative">
                    <select
                      value={payWeek.end_day}
                      onChange={(e) => setPayWeek((p) => ({ ...p, end_day: e.target.value }))}
                      className={cn(
                        'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-10 text-sm text-[#333333]',
                        'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]',
                        'min-h-[48px] appearance-none'
                      )}
                    >
                      {DAYS.map((d) => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Input
                  label="Week start date"
                  type="date"
                  value={payWeek.start_date}
                  onChange={(e) => setPayWeek((p) => ({ ...p, start_date: e.target.value }))}
                />
                <Input
                  label="Week end date"
                  type="date"
                  value={payWeek.end_date}
                  onChange={(e) => setPayWeek((p) => ({ ...p, end_date: e.target.value }))}
                />
              </div>
            )}
          </div>
          <div className="mt-4 flex justify-end">
            <Button
              onClick={() => saveSetting('pay_week', payWeek)}
              loading={saving === 'pay_week'}
              icon={<Save className="h-4 w-4" />}
            >
              {saveSuccess === 'pay_week' ? 'Saved' : 'Save'}
            </Button>
          </div>
        </Section>

        {/* ─── 7. Public Holidays ─── */}
        <Section title="Public Holidays" icon={<Calendar className="h-5 w-5" />}>
          <div className="mt-3">
            {/* Add new */}
            <div className="flex flex-col sm:flex-row gap-3 mb-4">
              <Input
                label="Date"
                type="date"
                value={newHoliday.date}
                onChange={(e) => setNewHoliday((p) => ({ ...p, date: e.target.value }))}
                className="flex-1"
              />
              <Input
                label="Holiday name"
                value={newHoliday.name}
                onChange={(e) => setNewHoliday((p) => ({ ...p, name: e.target.value }))}
                placeholder="e.g. Freedom Day"
                className="flex-1"
              />
              <div className="flex items-end">
                <Button
                  onClick={addHoliday}
                  disabled={!newHoliday.date || !newHoliday.name}
                  icon={<Plus className="h-4 w-4" />}
                  size="lg"
                >
                  Add
                </Button>
              </div>
            </div>

            {/* List */}
            {holidays.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No public holidays configured</p>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                        Date
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                        Name
                      </th>
                      <th className="w-12" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {holidays.map((h) => (
                      <tr key={h.date} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm text-[#333333]">{formatDate(h.date)}</td>
                        <td className="px-4 py-3 text-sm text-[#333333]">{h.name}</td>
                        <td className="px-4 py-3">
                          <button
                            onClick={() => deleteHoliday(h.date)}
                            className="rounded p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors min-w-[36px] min-h-[36px] flex items-center justify-center"
                            title="Remove holiday"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>

        {/* ─── 7. User Management ─── */}
        <Section title="User Management" icon={<Users className="h-5 w-5" />}>
          <div className="mt-3">
            {users.length === 0 ? (
              <p className="text-sm text-gray-400 py-4 text-center">No users found</p>
            ) : (
              <div className="rounded-lg border border-gray-200 overflow-hidden">
                <table className="w-full">
                  <thead>
                    <tr className="bg-gray-50">
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                        Name
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                        Role
                      </th>
                      <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                        Status
                      </th>
                      <th className="text-right text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-2.5">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50/50">
                        <td className="px-4 py-3 text-sm font-medium text-[#333333]">{u.name}</td>
                        <td className="px-4 py-3">
                          {editingUser === u.id ? (
                            <div className="flex items-center gap-2">
                              <div className="relative">
                                <select
                                  value={editRole}
                                  onChange={(e) => setEditRole(e.target.value as UserRole)}
                                  className="h-9 rounded-lg border border-gray-300 bg-white px-2 pr-8 text-sm appearance-none"
                                >
                                  {ROLES.map((r) => (
                                    <option key={r.value} value={r.value}>
                                      {r.label}
                                    </option>
                                  ))}
                                </select>
                                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400 pointer-events-none" />
                              </div>
                              <Button
                                variant="primary"
                                size="sm"
                                onClick={() => updateUserRole(u.id, editRole)}
                              >
                                Save
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setEditingUser(null)}
                              >
                                Cancel
                              </Button>
                            </div>
                          ) : (
                            <Badge
                              color={
                                u.role === 'owner'
                                  ? 'purple'
                                  : u.role === 'supervisor'
                                    ? 'blue'
                                    : 'grey'
                              }
                            >
                              {u.role.replace(/_/g, ' ')}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge color={u.active ? 'green' : 'red'}>
                            {u.active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1">
                            {editingUser !== u.id && (
                              <button
                                onClick={() => {
                                  setEditingUser(u.id);
                                  setEditRole(u.role as UserRole);
                                }}
                                className="rounded px-2 py-1.5 text-xs font-medium text-[#1E40AF] hover:bg-[#1E40AF]/10 transition-colors min-h-[36px]"
                              >
                                Edit Role
                              </button>
                            )}
                            <button
                              onClick={() => resetPin(u.id)}
                              className="rounded px-2 py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-100 transition-colors min-h-[36px]"
                            >
                              Reset PIN
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Section>
      </div>
    </div>
  );
}
