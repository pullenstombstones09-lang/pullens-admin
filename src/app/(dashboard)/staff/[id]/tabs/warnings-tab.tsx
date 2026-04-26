'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/lib/auth-context';
import { useToast } from '@/components/ui/toast';
import { formatDate } from '@/lib/utils';
import type { Warning } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  AlertTriangle,
  Clock,
  FileText,
  ExternalLink,
} from 'lucide-react';

interface WarningsTabProps {
  employeeId: string;
}

export default function WarningsTab({ employeeId }: WarningsTabProps) {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();
  const [warnings, setWarnings] = useState<Warning[]>([]);
  const [loading, setLoading] = useState(true);

  const loadWarnings = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('warnings')
      .select('*')
      .eq('employee_id', employeeId)
      .order('issued_date', { ascending: false });
    setWarnings((data ?? []) as Warning[]);
    setLoading(false);
  }, [supabase, employeeId]);

  useEffect(() => {
    loadWarnings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleDeleteWarning = async (id: string) => {
    if (!confirm('Delete this warning? This cannot be undone.')) return;
    const { error } = await supabase.from('warnings').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete warning');
    } else {
      toast('success', 'Warning deleted');
      setWarnings((prev) => prev.filter((w) => w.id !== id));
    }
  };

  const { active, expired } = useMemo(() => {
    const active: Warning[] = [];
    const expired: Warning[] = [];
    warnings.forEach((w) => {
      if (w.status === 'active') active.push(w);
      else expired.push(w);
    });
    return { active, expired };
  }, [warnings]);

  const daysUntilExpiry = (expiryDate: string | null): number | null => {
    if (!expiryDate) return null;
    const diff = new Date(expiryDate).getTime() - Date.now();
    return Math.ceil(diff / 86400000);
  };

  const categoryColor = (cat: string): 'amber' | 'red' | 'purple' => {
    if (cat === 'A') return 'amber';
    if (cat === 'B') return 'red';
    return 'purple';
  };

  const levelColor = (level: string): 'grey' | 'amber' | 'red' => {
    if (level === 'verbal') return 'grey';
    if (level === 'written') return 'amber';
    return 'red';
  };

  const WarningCard = ({ warning, dimmed = false }: { warning: Warning; dimmed?: boolean }) => {
    const days = daysUntilExpiry(warning.expiry_date);

    return (
      <Card padding="md" className={dimmed ? 'opacity-50' : undefined}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1.5">
              <Badge color={categoryColor(warning.category)}>
                Cat {warning.category}
              </Badge>
              <Badge color={levelColor(warning.level)}>
                {warning.level.charAt(0).toUpperCase() + warning.level.slice(1)}
              </Badge>
              {warning.status === 'active' && days !== null && (
                <span className="flex items-center gap-1 text-xs text-stone-500">
                  <Clock className="h-3 w-3" />
                  {days > 0 ? `${days}d remaining` : 'Expiring today'}
                </span>
              )}
              {warning.status === 'expired' && (
                <Badge color="grey">Expired</Badge>
              )}
              {warning.status === 'overturned' && (
                <Badge color="blue">Overturned</Badge>
              )}
            </div>

            <p className="text-sm font-medium text-[#1A1A2E]">{warning.offence}</p>
            {warning.description && (
              <p className="text-xs text-stone-500 mt-1 line-clamp-2">{warning.description}</p>
            )}

            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-stone-400">
              <span>Issued: {formatDate(warning.issued_date)}</span>
              {warning.expiry_date && <span>Expires: {formatDate(warning.expiry_date)}</span>}
              {warning.issued_by && <span>By: {warning.issued_by}</span>}
              {warning.witness && <span>Witness: {warning.witness}</span>}
            </div>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            {warning.signed_pdf_url && (
              <button
                onClick={() => window.open(warning.signed_pdf_url!, '_blank')}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                title="View signed PDF"
              >
                <ExternalLink className="h-4 w-4" />
              </button>
            )}
            {user?.role === 'head_admin' && (
              <button
                onClick={() => handleDeleteWarning(warning.id)}
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
    );
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <Card padding="md">
              <div className="space-y-2">
                <div className="h-4 w-40 rounded bg-stone-200" />
                <div className="h-3 w-64 rounded bg-stone-200" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  if (warnings.length === 0) {
    return (
      <div className="py-12 text-center">
        <AlertTriangle className="mx-auto h-12 w-12 text-stone-300 mb-3" />
        <p className="text-sm text-stone-500">No warnings on record</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Active warnings */}
      {active.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-[#1A1A2E] mb-3 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-red-500" />
            Active Warnings ({active.length})
          </h3>
          <div className="space-y-3">
            {active.map((w) => (
              <WarningCard key={w.id} warning={w} />
            ))}
          </div>
        </div>
      )}

      {/* Expired warnings */}
      {expired.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-stone-400 mb-3">
            Past Warnings ({expired.length})
          </h3>
          <div className="space-y-3">
            {expired.map((w) => (
              <WarningCard key={w.id} warning={w} dimmed />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
