'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { hasPermission } from '@/lib/permissions';
import { cn, getInitials, formatDate } from '@/lib/utils';
import type { Employee, Warning, Leave, EmployeeDocument } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  ArrowUpDown,
  Download,
  Printer,
  Users,
  ChevronRight,
} from 'lucide-react';

type SortKey = 'pt_code' | 'full_name' | 'start_date' | 'occupation';

interface StatusFlags {
  finalWarning: boolean;
  writtenWarning: boolean;
  docMissing: boolean;
  onLeave: boolean;
  probationEnding: boolean;
  birthday: boolean;
}

interface EmployeeWithFlags extends Employee {
  flags: StatusFlags;
}

const REQUIRED_DOCS: string[] = ['id_copy', 'contract', 'eif', 'bank'];

export default function StaffListPage() {
  const router = useRouter();
  const { user } = useAuth();
  const supabase = createClient();

  const [employees, setEmployees] = useState<EmployeeWithFlags[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [occupationFilter, setOccupationFilter] = useState<string>('All');
  const [sortKey, setSortKey] = useState<SortKey>('pt_code');

  const fetchData = useCallback(async () => {
    setLoading(true);

    const today = new Date().toISOString().slice(0, 10);
    const in14 = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    const [empRes, warnRes, leaveRes, docRes] = await Promise.all([
      supabase.from('employees').select('*').eq('status', 'active'),
      supabase.from('warnings').select('employee_id, level, status').eq('status', 'active'),
      supabase.from('leave').select('employee_id, from_date, to_date').lte('from_date', today).gte('to_date', today),
      supabase.from('employee_documents').select('employee_id, doc_type'),
    ]);

    const emps = (empRes.data ?? []) as Employee[];
    const warnings = (warnRes.data ?? []) as Pick<Warning, 'employee_id' | 'level' | 'status'>[];
    const leaves = (leaveRes.data ?? []) as Pick<Leave, 'employee_id' | 'from_date' | 'to_date'>[];
    const docs = (docRes.data ?? []) as Pick<EmployeeDocument, 'employee_id' | 'doc_type'>[];

    // Build lookup maps
    const warningsByEmp = new Map<string, string[]>();
    warnings.forEach((w) => {
      const arr = warningsByEmp.get(w.employee_id) ?? [];
      arr.push(w.level);
      warningsByEmp.set(w.employee_id, arr);
    });

    const onLeaveSet = new Set(leaves.map((l) => l.employee_id));

    const docsByEmp = new Map<string, Set<string>>();
    docs.forEach((d) => {
      const s = docsByEmp.get(d.employee_id) ?? new Set();
      s.add(d.doc_type);
      docsByEmp.set(d.employee_id, s);
    });

    const enriched: EmployeeWithFlags[] = emps.map((emp) => {
      const empWarnings = warningsByEmp.get(emp.id) ?? [];
      const empDocs = docsByEmp.get(emp.id) ?? new Set<string>();

      // Probation: within first 3 months, ending in 14 days
      let probationEnding = false;
      if (emp.start_date) {
        const probEnd = new Date(emp.start_date);
        probEnd.setMonth(probEnd.getMonth() + 3);
        const probEndStr = probEnd.toISOString().slice(0, 10);
        probationEnding = probEndStr >= today && probEndStr <= in14;
      }

      // Birthday check
      let birthday = false;
      if (emp.dob) {
        const dob = new Date(emp.dob);
        const todayDate = new Date(today);
        const tomorrow = new Date(todayDate);
        tomorrow.setDate(tomorrow.getDate() + 1);
        birthday =
          (dob.getMonth() === todayDate.getMonth() && dob.getDate() === todayDate.getDate()) ||
          (dob.getMonth() === tomorrow.getMonth() && dob.getDate() === tomorrow.getDate());
      }

      return {
        ...emp,
        flags: {
          finalWarning: empWarnings.includes('final'),
          writtenWarning: empWarnings.includes('written'),
          docMissing: REQUIRED_DOCS.some((dt) => !empDocs.has(dt)),
          onLeave: onLeaveSet.has(emp.id),
          probationEnding,
          birthday,
        },
      };
    });

    setEmployees(enriched);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Derive unique occupations
  const occupations = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.occupation) set.add(e.occupation);
    });
    return Array.from(set).sort();
  }, [employees]);

  // Filter + sort
  const filtered = useMemo(() => {
    let list = employees;

    // Search
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) =>
          e.full_name.toLowerCase().includes(q) ||
          e.pt_code.toLowerCase().includes(q) ||
          (e.occupation && e.occupation.toLowerCase().includes(q)) ||
          (e.id_number && e.id_number.includes(q))
      );
    }

    // Occupation filter
    if (occupationFilter !== 'All') {
      list = list.filter((e) => e.occupation === occupationFilter);
    }

    // Sort
    const sorted = [...list].sort((a, b) => {
      switch (sortKey) {
        case 'pt_code':
          return a.pt_code.localeCompare(b.pt_code, undefined, { numeric: true });
        case 'full_name':
          return a.full_name.localeCompare(b.full_name);
        case 'start_date':
          return (a.start_date ?? '').localeCompare(b.start_date ?? '');
        case 'occupation':
          return (a.occupation ?? '').localeCompare(b.occupation ?? '');
        default:
          return 0;
      }
    });

    return sorted;
  }, [employees, search, occupationFilter, sortKey]);

  const isManagement = user ? hasPermission(user.role, 'edit_employee') : false;

  const handleExportCSV = () => {
    const headers = ['PT Code', 'Name', 'Occupation', 'ID Number', 'Cell', 'Start Date'];
    const rows = filtered.map((e) => [
      e.pt_code,
      e.full_name,
      e.occupation ?? '',
      e.id_number ?? '',
      e.cell ?? '',
      e.start_date ?? '',
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `pullens-staff-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintContacts = () => {
    const content = filtered
      .map((e) => `${e.pt_code} | ${e.full_name} | ${e.cell ?? 'No cell'} | ${e.occupation ?? ''}`)
      .join('\n');
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(
        `<html><head><title>Staff Contact List</title><style>body{font-family:monospace;font-size:13px;padding:24px;white-space:pre-wrap;}</style></head><body>PULLENS TOMBSTONES — STAFF CONTACT LIST\n${new Date().toLocaleDateString('en-ZA')}\n${'='.repeat(60)}\n\n${content}</body></html>`
      );
      win.document.close();
      win.print();
    }
  };

  // Skeleton cards
  const SkeletonCard = () => (
    <div className="animate-pulse">
      <Card padding="md">
        <div className="flex items-center gap-4">
          <div className="h-12 w-12 rounded-full bg-stone-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-stone-200" />
            <div className="h-3 w-24 rounded bg-stone-200" />
          </div>
        </div>
      </Card>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F5F3EF]">
      {/* Page header */}
      <div className="sticky top-0 z-20 bg-[#F5F3EF]/95 backdrop-blur-sm pb-4 pt-6 px-4 md:px-8">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[#1A1A2E]">
              <Users className="h-5 w-5 text-[#C4A35A]" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#1A1A2E]">Staff</h1>
              <p className="text-sm text-stone-500">
                {loading ? '...' : `${filtered.length} employee${filtered.length !== 1 ? 's' : ''}`}
              </p>
            </div>
          </div>

          {isManagement && (
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handlePrintContacts}
                icon={<Printer className="h-4 w-4" />}
              >
                <span className="hidden sm:inline">Print</span>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleExportCSV}
                icon={<Download className="h-4 w-4" />}
              >
                <span className="hidden sm:inline">CSV</span>
              </Button>
            </div>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400 pointer-events-none" />
          <Input
            placeholder="Search name, PT code, occupation, ID..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Filter chips */}
        <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
          <button
            onClick={() => setOccupationFilter('All')}
            className={cn(
              'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors min-h-[36px]',
              occupationFilter === 'All'
                ? 'bg-[#1A1A2E] text-white'
                : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
            )}
          >
            All
          </button>
          {occupations.map((occ) => (
            <button
              key={occ}
              onClick={() => setOccupationFilter(occ)}
              className={cn(
                'shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors min-h-[36px]',
                occupationFilter === occ
                  ? 'bg-[#1A1A2E] text-white'
                  : 'bg-white text-stone-600 border border-stone-200 hover:bg-stone-50'
              )}
            >
              {occ}
            </button>
          ))}
        </div>

        {/* Sort */}
        <div className="flex items-center gap-2 mt-3">
          <ArrowUpDown className="h-3.5 w-3.5 text-stone-400" />
          <span className="text-xs text-stone-500">Sort:</span>
          {(
            [
              { key: 'pt_code', label: 'PT Code' },
              { key: 'full_name', label: 'A-Z' },
              { key: 'start_date', label: 'Start Date' },
              { key: 'occupation', label: 'Occupation' },
            ] as { key: SortKey; label: string }[]
          ).map((s) => (
            <button
              key={s.key}
              onClick={() => setSortKey(s.key)}
              className={cn(
                'text-xs px-2 py-1 rounded transition-colors',
                sortKey === s.key
                  ? 'text-[#C4A35A] font-semibold'
                  : 'text-stone-500 hover:text-stone-700'
              )}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* Employee list */}
      <div className="px-4 md:px-8 pb-8">
        {loading ? (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 9 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="mx-auto h-12 w-12 text-stone-300 mb-3" />
            <p className="text-stone-500 text-sm">No employees found</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((emp) => (
              <button
                key={emp.id}
                onClick={() => router.push(`/staff/${emp.id}`)}
                className="text-left w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#C4A35A] rounded-xl"
              >
                <Card padding="md" className="cursor-pointer">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="relative shrink-0">
                      {emp.photo_url ? (
                        <img
                          src={emp.photo_url}
                          alt={emp.full_name}
                          className="h-12 w-12 rounded-full object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#1A1A2E] text-sm font-bold text-[#C4A35A]">
                          {getInitials(emp.full_name)}
                        </div>
                      )}
                      {/* Status dots */}
                      <div className="absolute -bottom-1 -right-1 flex gap-0.5">
                        {emp.flags.finalWarning && (
                          <span className="h-2.5 w-2.5 rounded-full bg-red-500 ring-2 ring-white" title="Final warning active" />
                        )}
                        {emp.flags.writtenWarning && !emp.flags.finalWarning && (
                          <span className="h-2.5 w-2.5 rounded-full bg-amber-500 ring-2 ring-white" title="Written warning active" />
                        )}
                        {emp.flags.docMissing && (
                          <span className="h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-white" title="Document missing" />
                        )}
                        {emp.flags.onLeave && (
                          <span className="h-2.5 w-2.5 rounded-full bg-blue-500 ring-2 ring-white" title="On leave today" />
                        )}
                        {emp.flags.probationEnding && (
                          <span className="h-2.5 w-2.5 rounded-full bg-purple-500 ring-2 ring-white" title="Probation ending soon" />
                        )}
                        {emp.flags.birthday && (
                          <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" title="Birthday" />
                        )}
                      </div>
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#1A1A2E] truncate">
                        {emp.full_name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs font-mono text-[#C4A35A]">{emp.pt_code}</span>
                        {emp.occupation && (
                          <span className="text-xs text-stone-500 truncate">{emp.occupation}</span>
                        )}
                      </div>
                    </div>

                    <ChevronRight className="h-4 w-4 text-stone-300 shrink-0" />
                  </div>
                </Card>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
