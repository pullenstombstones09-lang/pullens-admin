'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import {
  ScrollText,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  Filter,
  RefreshCw,
  ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';
import type { AuditLog } from '@/types/database';

const PAGE_SIZE = 25;

const ENTITY_TYPES = [
  'employee',
  'attendance',
  'payroll_run',
  'payslip',
  'warning',
  'hearing',
  'incident',
  'loan',
  'leave',
  'petty_cash_in',
  'petty_cash_out',
  'document',
  'medical_cert',
  'setting',
  'user',
];

const ACTION_COLORS: Record<string, 'green' | 'blue' | 'amber' | 'red' | 'grey'> = {
  create: 'green',
  insert: 'green',
  update: 'blue',
  delete: 'red',
  approve: 'green',
  reject: 'red',
  login: 'grey',
  logout: 'grey',
  reset_pin: 'amber',
};

function getActionColor(action: string): 'green' | 'blue' | 'amber' | 'red' | 'grey' {
  const lower = action.toLowerCase();
  for (const [key, color] of Object.entries(ACTION_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return 'grey';
}

export default function AuditLogViewer() {
  const { user } = useAuth();
  const [supabase] = useState(() => createClient());
  const [logs, setLogs] = useState<(AuditLog & { user_name?: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [showFilters, setShowFilters] = useState(false);

  // Filters
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterUser, setFilterUser] = useState('');
  const [filterEntity, setFilterEntity] = useState('');

  // Users for dropdown
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    async function loadUsers() {
      const { data } = await supabase.from('users').select('id, name').order('name');
      setUsers(data || []);
    }
    loadUsers();
  }, [supabase]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);

    let query = supabase
      .from('audit_log')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (dateFrom) {
      query = query.gte('created_at', `${dateFrom}T00:00:00`);
    }
    if (dateTo) {
      query = query.lte('created_at', `${dateTo}T23:59:59`);
    }
    if (filterUser) {
      query = query.eq('user_id', filterUser);
    }
    if (filterEntity) {
      query = query.eq('entity_type', filterEntity);
    }

    const { data, count } = await query;

    // Enrich with user names
    const enriched = (data || []).map((log) => {
      const u = users.find((usr) => usr.id === log.user_id);
      return { ...log, user_name: u?.name || log.user_id || 'System' };
    });

    setLogs(enriched);
    setTotalCount(count || 0);
    setLoading(false);
  }, [supabase, page, dateFrom, dateTo, filterUser, filterEntity, users]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  // Access check
  if (user && user.role !== 'head_admin' && user.role !== 'head_of_admin' && user.role !== 'head_of_sales') {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Card className="max-w-md text-center">
          <div className="flex flex-col items-center gap-3 py-8 px-6">
            <ScrollText className="h-12 w-12 text-gray-300" />
            <h2 className="text-lg font-semibold text-[#333333]">Access Restricted</h2>
            <p className="text-sm text-gray-500">
              The audit log is restricted to administrators.
            </p>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <Link href="/settings">
            <button className="rounded-lg p-2 text-gray-500 hover:bg-gray-100 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center">
              <ArrowLeft className="h-5 w-5" />
            </button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-[#333333] flex items-center gap-2">
              <ScrollText className="h-6 w-6 text-[#1E40AF]" />
              Audit Log
            </h1>
            <p className="text-sm text-gray-500 mt-0.5">
              {totalCount} record{totalCount === 1 ? '' : 's'} found
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            icon={<Filter className="h-4 w-4" />}
          >
            Filters
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setPage(0);
              fetchLogs();
            }}
            icon={<RefreshCw className="h-4 w-4" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card className="mb-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-4">
            <Input
              label="From date"
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(0);
              }}
            />
            <Input
              label="To date"
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(0);
              }}
            />
            <div>
              <label className="text-sm font-medium text-[#333333] mb-1.5 block">User</label>
              <div className="relative">
                <select
                  value={filterUser}
                  onChange={(e) => {
                    setFilterUser(e.target.value);
                    setPage(0);
                  }}
                  className={cn(
                    'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-10 text-sm text-[#333333]',
                    'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]',
                    'min-h-[48px] appearance-none'
                  )}
                >
                  <option value="">All users</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium text-[#333333] mb-1.5 block">Entity type</label>
              <div className="relative">
                <select
                  value={filterEntity}
                  onChange={(e) => {
                    setFilterEntity(e.target.value);
                    setPage(0);
                  }}
                  className={cn(
                    'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-10 text-sm text-[#333333]',
                    'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]',
                    'min-h-[48px] appearance-none'
                  )}
                >
                  <option value="">All types</option>
                  {ENTITY_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
              </div>
            </div>
          </div>
          <div className="px-4 pb-3 flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setDateFrom('');
                setDateTo('');
                setFilterUser('');
                setFilterEntity('');
                setPage(0);
              }}
            >
              Clear filters
            </Button>
          </div>
        </Card>
      )}

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#1E40AF] border-t-transparent" />
        </div>
      ) : logs.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <ScrollText className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">No audit log entries found</p>
          <p className="text-gray-400 text-sm mt-1">Adjust your filters and try again</p>
        </Card>
      ) : (
        <>
          <Card padding="none" className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Timestamp
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      User
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Action
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Entity
                    </th>
                    <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wider px-4 py-3">
                      Entity ID
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50/50">
                      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('en-ZA', {
                          day: '2-digit',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#333333] font-medium whitespace-nowrap">
                        {log.user_name}
                      </td>
                      <td className="px-4 py-3">
                        <Badge color={getActionColor(log.action)}>
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                        {log.entity_type.replace(/_/g, ' ')}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400 font-mono whitespace-nowrap">
                        {log.entity_id ? log.entity_id.slice(0, 8) + '...' : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 px-1">
              <p className="text-sm text-gray-500">
                Page {page + 1} of {totalPages}
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(0, p - 1))}
                  disabled={page === 0}
                  icon={<ChevronLeft className="h-4 w-4" />}
                >
                  Previous
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1}
                  icon={<ChevronRight className="h-4 w-4" />}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
