'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils';
import type { Incident, Hearing, Warning } from '@/types/database';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Scale,
  FileDown,
  AlertTriangle,
  Gavel,
  FileWarning,
} from 'lucide-react';

interface DisciplinaryTabProps {
  employeeId: string;
}

type TimelineEvent = {
  id: string;
  date: string;
  type: 'incident' | 'warning' | 'hearing';
  title: string;
  description: string | null;
  badge: { label: string; color: 'red' | 'amber' | 'blue' | 'purple' | 'green' | 'grey' };
  pdfUrl: string | null;
  meta: Record<string, string>;
};

export default function DisciplinaryTab({ employeeId }: DisciplinaryTabProps) {
  const supabase = createClient();
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);

      const [incidentRes, warningRes, hearingRes] = await Promise.all([
        supabase
          .from('incidents')
          .select('*')
          .eq('employee_id', employeeId)
          .order('incident_date', { ascending: false }),
        supabase
          .from('warnings')
          .select('*')
          .eq('employee_id', employeeId)
          .order('issued_date', { ascending: false }),
        supabase
          .from('hearings')
          .select('*')
          .eq('employee_id', employeeId)
          .order('hearing_date', { ascending: false }),
      ]);

      const events: TimelineEvent[] = [];

      // Incidents
      ((incidentRes.data ?? []) as Incident[]).forEach((inc) => {
        events.push({
          id: inc.id,
          date: inc.incident_date,
          type: 'incident',
          title: `Incident: ${inc.classification ?? 'Unclassified'}`,
          description: inc.description,
          badge: { label: inc.resolved ? 'Resolved' : 'Open', color: inc.resolved ? 'green' : 'red' },
          pdfUrl: null,
          meta: {
            ...(inc.resolution ? { Resolution: inc.resolution } : {}),
          },
        });
      });

      // Warnings
      ((warningRes.data ?? []) as Warning[]).forEach((w) => {
        const levelLabel = w.level.charAt(0).toUpperCase() + w.level.slice(1);
        events.push({
          id: w.id,
          date: w.issued_date,
          type: 'warning',
          title: `${levelLabel} Warning (Cat ${w.category})`,
          description: w.offence,
          badge: {
            label: w.status.charAt(0).toUpperCase() + w.status.slice(1),
            color: w.status === 'active' ? 'amber' : w.status === 'expired' ? 'grey' : 'blue',
          },
          pdfUrl: w.signed_pdf_url,
          meta: {
            ...(w.issued_by ? { 'Issued by': w.issued_by } : {}),
            ...(w.expiry_date ? { Expires: formatDate(w.expiry_date) } : {}),
          },
        });
      });

      // Hearings
      ((hearingRes.data ?? []) as Hearing[]).forEach((h) => {
        const outcomeLabel = h.outcome
          ? h.outcome.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
          : 'Pending';
        events.push({
          id: h.id,
          date: h.hearing_date,
          type: 'hearing',
          title: `Hearing: ${h.charge}`,
          description: null,
          badge: {
            label: outcomeLabel,
            color: h.outcome === 'dismissal' ? 'red' : h.outcome ? 'purple' : 'grey',
          },
          pdfUrl: h.signed_pdf_url,
          meta: {
            ...(h.chairperson ? { Chairperson: h.chairperson } : {}),
            'Notice date': formatDate(h.notice_date),
            ...(h.outcome_date ? { 'Outcome date': formatDate(h.outcome_date) } : {}),
          },
        });
      });

      // Sort by date descending
      events.sort((a, b) => b.date.localeCompare(a.date));

      setTimeline(events);
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [employeeId]);

  const handleGenerateCCMA = () => {
    // Placeholder — will generate a compiled CCMA case file
    alert('CCMA case file generation coming soon');
  };

  const TypeIcon = ({ type }: { type: string }) => {
    if (type === 'incident') return <AlertTriangle className="h-4 w-4 text-amber-500" />;
    if (type === 'hearing') return <Gavel className="h-4 w-4 text-purple-500" />;
    return <FileWarning className="h-4 w-4 text-red-500" />;
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="animate-pulse">
            <Card padding="md">
              <div className="space-y-2">
                <div className="h-4 w-48 rounded bg-stone-200" />
                <div className="h-3 w-64 rounded bg-stone-200" />
              </div>
            </Card>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div>
      {/* CCMA button */}
      <div className="mb-5">
        <Button
          variant="secondary"
          size="md"
          onClick={handleGenerateCCMA}
          icon={<FileDown className="h-4 w-4" />}
        >
          Generate CCMA Case File
        </Button>
      </div>

      {timeline.length === 0 ? (
        <div className="py-12 text-center">
          <Scale className="mx-auto h-12 w-12 text-stone-300 mb-3" />
          <p className="text-sm text-stone-500">No disciplinary history</p>
        </div>
      ) : (
        <div className="relative">
          {/* Timeline line */}
          <div className="absolute left-[19px] top-2 bottom-2 w-px bg-stone-200" />

          <div className="space-y-4">
            {timeline.map((event) => (
              <div key={`${event.type}-${event.id}`} className="relative flex gap-4 pl-0">
                {/* Timeline dot */}
                <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white border border-stone-200 shadow-sm">
                  <TypeIcon type={event.type} />
                </div>

                {/* Content */}
                <Card padding="md" className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <Badge color={event.badge.color}>{event.badge.label}</Badge>
                        <span className="text-xs text-stone-400">{formatDate(event.date)}</span>
                      </div>
                      <p className="text-sm font-medium text-[#1A1A2E]">{event.title}</p>
                    </div>

                    {event.pdfUrl && (
                      <button
                        onClick={() => window.open(event.pdfUrl!, '_blank')}
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded text-stone-400 hover:bg-stone-100 hover:text-stone-600 transition-colors"
                      >
                        <FileDown className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {event.description && (
                    <p className="text-xs text-stone-500 mb-2 line-clamp-3">{event.description}</p>
                  )}

                  {Object.keys(event.meta).length > 0 && (
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400">
                      {Object.entries(event.meta).map(([key, value]) => (
                        <span key={key}>
                          {key}: <span className="text-stone-600">{value}</span>
                        </span>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
