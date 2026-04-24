'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  Bell,
  ShieldAlert,
  Clock,
  FileWarning,
  Heart,
  Cake,
  FileText,
  Car,
  AlertTriangle,
  Wallet,
  TrendingDown,
  Calendar,
  Award,
  UserCheck,
  ClipboardList,
  RefreshCw,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

type Severity = 'red' | 'amber' | 'yellow' | 'blue' | 'green';

interface AlertItem {
  id: string;
  type: string;
  severity: Severity;
  title: string;
  description: string;
  employee_id: string | null;
  employee_name: string | null;
  action_url: string | null;
  created_at: string;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { border: string; bg: string; label: string; badgeColor: 'red' | 'amber' | 'yellow' | 'blue' | 'green' }
> = {
  red: { border: 'border-l-red-500', bg: 'bg-red-50/50', label: 'Critical', badgeColor: 'red' },
  amber: { border: 'border-l-amber-500', bg: 'bg-amber-50/30', label: 'Warning', badgeColor: 'amber' },
  yellow: { border: 'border-l-yellow-400', bg: 'bg-yellow-50/30', label: 'Notice', badgeColor: 'yellow' },
  blue: { border: 'border-l-blue-500', bg: 'bg-blue-50/30', label: 'Info', badgeColor: 'blue' },
  green: { border: 'border-l-emerald-500', bg: 'bg-emerald-50/30', label: 'Good', badgeColor: 'green' },
};

const TYPE_ICONS: Record<string, ReactNode> = {
  medical_expired: <ShieldAlert className="h-5 w-5" />,
  medical_expiring: <Heart className="h-5 w-5" />,
  verbal_expiring: <Clock className="h-5 w-5" />,
  written_expiring: <FileWarning className="h-5 w-5" />,
  final_expiring: <AlertTriangle className="h-5 w-5" />,
  probation_ending: <UserCheck className="h-5 w-5" />,
  payslip_unsigned: <ClipboardList className="h-5 w-5" />,
  loan_paid_off: <Award className="h-5 w-5" />,
  birthday: <Cake className="h-5 w-5" />,
  contract_expired: <FileText className="h-5 w-5" />,
  contract_expiring: <FileText className="h-5 w-5" />,
  licence_expiring: <Car className="h-5 w-5" />,
  doc_missing: <FileWarning className="h-5 w-5" />,
  late_pattern: <Clock className="h-5 w-5" />,
  petty_shortfall: <Wallet className="h-5 w-5" />,
  tin_variance: <TrendingDown className="h-5 w-5" />,
  public_holiday: <Calendar className="h-5 w-5" />,
};

const SEVERITY_ICON_COLORS: Record<Severity, string> = {
  red: 'text-red-600',
  amber: 'text-amber-600',
  yellow: 'text-yellow-600',
  blue: 'text-blue-600',
  green: 'text-emerald-600',
};

const FILTER_OPTIONS: { value: Severity | 'all'; label: string; color: string }[] = [
  { value: 'all', label: 'All', color: 'bg-[#1A1A2E] text-white' },
  { value: 'red', label: 'Critical', color: 'bg-red-500 text-white' },
  { value: 'amber', label: 'Warning', color: 'bg-amber-500 text-white' },
  { value: 'yellow', label: 'Notice', color: 'bg-yellow-400 text-[#333]' },
  { value: 'blue', label: 'Info', color: 'bg-blue-500 text-white' },
  { value: 'green', label: 'Good', color: 'bg-emerald-500 text-white' },
];

export default function AlertsPage() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Severity | 'all'>('all');
  const [refreshing, setRefreshing] = useState(false);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : []);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAlerts();
  }, [fetchAlerts]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAlerts();
  };

  const filtered = filter === 'all' ? alerts : alerts.filter((a) => a.severity === filter);

  // Severity counts for filter badges
  const counts: Record<string, number> = { all: alerts.length };
  for (const a of alerts) {
    counts[a.severity] = (counts[a.severity] || 0) + 1;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#C4A35A] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 lg:p-8 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#333333] flex items-center gap-2">
            <Bell className="h-6 w-6 text-[#C4A35A]" />
            Alerts
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {alerts.length} active alert{alerts.length === 1 ? '' : 's'}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleRefresh}
          loading={refreshing}
          icon={<RefreshCw className="h-4 w-4" />}
        >
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <Filter className="h-4 w-4 text-gray-400" />
          <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">Filter by severity</span>
        </div>
        <div className="flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((opt) => {
            const isActive = filter === opt.value;
            const count = counts[opt.value] || 0;
            return (
              <button
                key={opt.value}
                onClick={() => setFilter(opt.value)}
                className={cn(
                  'inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-medium transition-all min-h-[36px]',
                  isActive
                    ? opt.color
                    : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
                )}
              >
                {opt.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center rounded-full h-5 min-w-[20px] px-1 text-[10px] font-bold',
                    isActive ? 'bg-white/25 text-inherit' : 'bg-gray-100 text-gray-500'
                  )}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Alert list */}
      {filtered.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16">
          <Bell className="h-12 w-12 text-gray-300 mb-3" />
          <p className="text-gray-500 font-medium">
            {filter === 'all' ? 'No active alerts' : `No ${SEVERITY_CONFIG[filter as Severity]?.label.toLowerCase()} alerts`}
          </p>
          <p className="text-gray-400 text-sm mt-1">Everything looks good</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {filtered.map((alert) => {
            const config = SEVERITY_CONFIG[alert.severity];
            const icon = TYPE_ICONS[alert.type] || <Bell className="h-5 w-5" />;
            const iconColor = SEVERITY_ICON_COLORS[alert.severity];

            return (
              <Card
                key={alert.id}
                padding="none"
                className={cn(
                  'border-l-4 overflow-hidden',
                  config.border,
                  config.bg
                )}
              >
                <div className="flex items-start gap-3 p-4 sm:p-5">
                  {/* Icon */}
                  <div
                    className={cn(
                      'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg',
                      alert.severity === 'red' && 'bg-red-100',
                      alert.severity === 'amber' && 'bg-amber-100',
                      alert.severity === 'yellow' && 'bg-yellow-100',
                      alert.severity === 'blue' && 'bg-blue-100',
                      alert.severity === 'green' && 'bg-emerald-100'
                    )}
                  >
                    <span className={iconColor}>{icon}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-semibold text-[#333333] leading-tight">
                          {alert.title}
                        </h3>
                        <p className="text-sm text-gray-500 mt-0.5">{alert.description}</p>
                      </div>
                      <Badge color={config.badgeColor} className="shrink-0">
                        {config.label}
                      </Badge>
                    </div>

                    {/* Employee name + action */}
                    <div className="flex items-center justify-between mt-3 gap-2">
                      {alert.employee_name ? (
                        <span className="text-xs font-medium text-[#1A1A2E] bg-[#1A1A2E]/5 rounded px-2 py-1">
                          {alert.employee_name}
                        </span>
                      ) : (
                        <span />
                      )}
                      {alert.action_url && (
                        <Link href={alert.action_url}>
                          <Button variant="ghost" size="sm">
                            View
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
