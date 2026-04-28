"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/components/ui/toast";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDate, cn } from "@/lib/utils";
import {
  Scale,
  AlertTriangle,
  CheckCircle,
  FileText,
  Clock,
  ChevronDown,
  ChevronUp,
  ShieldAlert,
  Loader2,
} from "lucide-react";
import type { Employee, Incident } from "@/types/database";

const COMMON_INCIDENTS = [
  { value: "late_coming", label: "Late coming" },
  { value: "absent_without_leave", label: "Absent without leave" },
  { value: "drunk_at_work", label: "Drunk at work" },
  { value: "theft", label: "Theft" },
  { value: "fighting", label: "Fighting" },
  { value: "insubordination", label: "Insubordination" },
  { value: "poor_performance", label: "Poor performance" },
  { value: "other", label: "Other" },
];

const LEVEL_BADGE: Record<string, { color: "green" | "amber" | "red" | "purple"; label: string }> = {
  verbal: { color: "green", label: "Verbal Warning" },
  written: { color: "amber", label: "Written Warning" },
  final: { color: "red", label: "Final Warning" },
  hearing: { color: "purple", label: "Disciplinary Hearing" },
};

const CATEGORY_BADGE: Record<string, { color: "blue" | "amber" | "red"; label: string }> = {
  A: { color: "blue", label: "Category A" },
  B: { color: "amber", label: "Category B" },
  C: { color: "red", label: "Category C" },
};

interface AdvisorResponse {
  classification: {
    category: string;
    misconduct_type: string;
    description: string;
  };
  legal_framework: string[];
  steps: string[];
  documents: string[];
  ccma_risk: string;
  recommended_level: string;
}

export default function HRAdvisorPage() {
  const supabase = createClient();
  const { user } = useAuth();
  const { toast } = useToast();

  const [employees, setEmployees] = useState<Employee[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [employeeId, setEmployeeId] = useState("");
  const [incidentType, setIncidentType] = useState("");
  const [freeText, setFreeText] = useState("");
  const [advising, setAdvising] = useState(false);

  // Response state
  const [response, setResponse] = useState<AdvisorResponse | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // History expand
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);

  const handleDeleteIncident = async (id: string) => {
    if (!confirm('Delete this incident? This cannot be undone.')) return;
    const { error } = await supabase.from('incidents').delete().eq('id', id);
    if (error) {
      toast('error', 'Failed to delete incident');
    } else {
      toast('success', 'Incident deleted');
      setIncidents((prev) => prev.filter((i) => i.id !== id));
    }
  };

  const fetchData = useCallback(async () => {
    setLoading(true);

    const { data: emps } = await supabase
      .from("employees")
      .select("*")
      .eq("status", "active")
      .order("full_name");

    const { data: incs } = await supabase
      .from("incidents")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(50);

    if (emps) setEmployees(emps as Employee[]);
    if (incs) setIncidents(incs as Incident[]);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleAdvise(e: React.FormEvent) {
    e.preventDefault();

    if (!employeeId) {
      toast("error", "Select a staff member");
      return;
    }

    const description =
      incidentType === "other" || !incidentType
        ? freeText.trim()
        : `${COMMON_INCIDENTS.find((i) => i.value === incidentType)?.label || incidentType}${freeText.trim() ? `: ${freeText.trim()}` : ""}`;

    if (!description) {
      toast("error", "Describe what happened");
      return;
    }

    const emp = employees.find((e) => e.id === employeeId);
    setSelectedEmployee(emp || null);
    setAdvising(true);
    setResponse(null);

    try {
      const res = await fetch("/api/hr-advisor/advise", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employee_id: employeeId,
          incident_description: description,
          incident_type: incidentType || "other",
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Failed to get advice");
      }

      const data = await res.json();
      setResponse(data);
      if (data._warning) {
        toast("error", data._warning);
      }
      await fetchData(); // Refresh incidents list
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Something went wrong");
    }

    setAdvising(false);
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-[#3B82F6] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 lg:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E293B]">
          <Scale className="h-6 w-6 text-[#3B82F6]" />
        </div>
        <div>
          <h1 className="text-2xl font-black text-[#1E293B]">HR Advisor</h1>
          <p className="text-sm text-gray-500">
            SA Labour Law compliance engine
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* --- LEFT: FORM --- */}
        <div className="lg:col-span-2">
          <Card padding="lg">
            <CardHeader>
              <CardTitle>Report an Incident</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleAdvise} className="flex flex-col gap-4">
                {/* Employee picker */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">
                    Which staff member?
                  </label>
                  <select
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-[#333333] min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]"
                  >
                    <option value="">Select employee...</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.full_name} ({emp.pt_code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Incident type */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">
                    What happened?
                  </label>
                  <select
                    value={incidentType}
                    onChange={(e) => setIncidentType(e.target.value)}
                    className="h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 text-sm text-[#333333] min-h-[48px] focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]"
                  >
                    <option value="">Pick a type or type below...</option>
                    {COMMON_INCIDENTS.map((i) => (
                      <option key={i.value} value={i.value}>
                        {i.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Free-text description */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-[#333333]">
                    Details
                  </label>
                  <textarea
                    value={freeText}
                    onChange={(e) => setFreeText(e.target.value)}
                    rows={4}
                    placeholder="Describe the incident in detail..."
                    className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-3 text-sm text-[#333333] placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6] resize-none"
                  />
                </div>

                <Button
                  type="submit"
                  variant="secondary"
                  size="lg"
                  loading={advising}
                  icon={<Scale className="h-5 w-5" />}
                  className="mt-2"
                >
                  Advise
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>

        {/* --- RIGHT: RESPONSE --- */}
        <div className="lg:col-span-3 flex flex-col gap-4">
          {advising && (
            <Card padding="lg">
              <div className="flex flex-col items-center gap-3 py-8">
                <Loader2 className="h-8 w-8 animate-spin text-[#3B82F6]" />
                <p className="text-sm font-medium text-gray-500">
                  Consulting SA labour law...
                </p>
              </div>
            </Card>
          )}

          {response && !advising && (
            <>
              {/* Classification */}
              <Card padding="lg">
                <div className="flex items-start gap-4">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1E293B] shrink-0">
                    <ShieldAlert className="h-6 w-6 text-[#3B82F6]" />
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-2">
                      {CATEGORY_BADGE[response.classification.category] && (
                        <Badge
                          color={
                            CATEGORY_BADGE[response.classification.category].color
                          }
                        >
                          {CATEGORY_BADGE[response.classification.category].label}
                        </Badge>
                      )}
                      {LEVEL_BADGE[response.recommended_level] && (
                        <Badge
                          color={
                            LEVEL_BADGE[response.recommended_level].color
                          }
                        >
                          {LEVEL_BADGE[response.recommended_level].label}
                        </Badge>
                      )}
                    </div>
                    <h3 className="text-base font-bold text-[#1E293B]">
                      {response.classification.misconduct_type}
                    </h3>
                    <p className="mt-1 text-sm text-gray-600">
                      {response.classification.description}
                    </p>
                    {selectedEmployee && (
                      <p className="mt-2 text-xs text-gray-400">
                        Employee: {selectedEmployee.full_name} &middot;
                        Started: {selectedEmployee.start_date ? formatDate(selectedEmployee.start_date) : "Unknown"} &middot;
                        Role: {selectedEmployee.occupation || "—"}
                      </p>
                    )}
                  </div>
                </div>
              </Card>

              {/* Legal framework */}
              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Legal Framework</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {response.legal_framework.map((item, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 text-sm text-[#333333]"
                      >
                        <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[#3B82F6] shrink-0" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* Step-by-step procedure */}
              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Step-by-Step Procedure</CardTitle>
                </CardHeader>
                <CardContent>
                  <ol className="flex flex-col gap-3">
                    {response.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3 text-sm">
                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#1E293B] text-xs font-bold text-white shrink-0">
                          {i + 1}
                        </span>
                        <span className="text-[#333333] pt-0.5">{step}</span>
                      </li>
                    ))}
                  </ol>
                </CardContent>
              </Card>

              {/* Documents needed */}
              <Card padding="lg">
                <CardHeader>
                  <CardTitle>Documents Needed</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-2">
                    {response.documents.map((doc, i) => (
                      <li
                        key={i}
                        className="flex items-center gap-2 text-sm text-[#333333]"
                      >
                        <FileText className="h-4 w-4 text-gray-400 shrink-0" />
                        {doc}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>

              {/* CCMA exposure warning */}
              <div className="rounded-xl border-2 border-red-200 bg-red-50 px-5 py-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-6 w-6 text-red-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-sm font-bold text-red-800">
                      CCMA Exposure Warning
                    </h4>
                    <p className="mt-1 text-sm text-red-700">
                      {response.ccma_risk}
                    </p>
                  </div>
                </div>
              </div>

              {/* Generate paperwork button */}
              <Button
                variant="primary"
                size="lg"
                icon={<FileText className="h-5 w-5" />}
                onClick={async () => {
                  if (!response || !selectedEmployee) return;
                  try {
                    const level = response.recommended_level;
                    if (level === 'hearing') {
                      // Generate hearing notice PDF
                      const res = await fetch('/api/pdf/hearing-notice', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          employee_id: selectedEmployee.id,
                          override: {
                            charges: [response.classification.description],
                            hearing_date: '_______________',
                            hearing_time: '09:00',
                            venue: 'Pullens Tombstones — Main Office, PMB',
                            chairperson: 'To be confirmed',
                            notice_date: new Date().toISOString().slice(0, 10),
                            issued_by: user?.name || 'Management',
                            prior_warnings: response.documents?.filter((d: string) => d.toLowerCase().includes('warning')),
                          },
                        }),
                      });
                      if (!res.ok) throw new Error('Failed to generate PDF');
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    } else {
                      // Generate warning form PDF
                      const expiryMonths = level === 'verbal' ? 3 : level === 'written' ? 6 : 12;
                      const today = new Date();
                      const expiry = new Date(today);
                      expiry.setMonth(expiry.getMonth() + expiryMonths);

                      const res = await fetch('/api/pdf/warning', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          employee_id: selectedEmployee.id,
                          override: {
                            level,
                            category: response.classification.category,
                            offence: response.classification.misconduct_type,
                            description: response.classification.description,
                            date: new Date().toISOString().slice(0, 10),
                            expiry_date: expiry.toISOString().slice(0, 10),
                            issued_by: user?.name || 'Management',
                          },
                        }),
                      });
                      if (!res.ok) throw new Error('Failed to generate PDF');
                      const blob = await res.blob();
                      const url = URL.createObjectURL(blob);
                      window.open(url, '_blank');
                    }
                  } catch {
                    toast('error', 'Failed to generate paperwork');
                  }
                }}
                className="self-start"
              >
                Generate Paperwork
              </Button>
            </>
          )}

          {!response && !advising && (
            <Card padding="lg">
              <div className="flex flex-col items-center gap-3 py-12 text-center">
                <Scale className="h-10 w-10 text-gray-300" />
                <p className="text-sm text-gray-400">
                  Select a staff member and describe the incident, then tap
                  Advise to get SA labour law guidance.
                </p>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* --- HISTORY --- */}
      <div className="mt-8">
        <h2 className="text-lg font-bold text-[#1E293B] mb-4">
          Past Incidents
        </h2>
        <Card padding="none">
          <div className="divide-y divide-gray-100">
            {incidents.length === 0 && (
              <p className="px-5 py-8 text-center text-sm text-gray-400">
                No past incidents
              </p>
            )}
            {incidents.map((inc) => {
              const isExpanded = expandedIncident === inc.id;
              const output = inc.advisor_output as AdvisorResponse | null;

              return (
                <div key={inc.id}>
                  <button
                    onClick={() =>
                      setExpandedIncident(isExpanded ? null : inc.id)
                    }
                    className="flex w-full items-center gap-3 px-5 py-4 text-left transition-colors hover:bg-gray-50 min-h-[56px]"
                  >
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-50 shrink-0">
                      <Clock className="h-5 w-5 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[#333333] truncate">
                        {inc.description}
                      </p>
                      <p className="text-xs text-gray-400">
                        {formatDate(inc.incident_date || inc.created_at)}
                        {inc.classification && (
                          <span className="ml-2">&middot; {inc.classification}</span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {inc.resolved && (
                        <CheckCircle className="h-4 w-4 text-emerald-500" />
                      )}
                      {user?.role === 'head_admin' && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDeleteIncident(inc.id); }}
                          title="Delete"
                          className="rounded-md p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 transition-colors"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                          </svg>
                        </button>
                      )}
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      )}
                    </div>
                  </button>

                  {isExpanded && output && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {output.classification?.category &&
                          CATEGORY_BADGE[output.classification.category] && (
                            <Badge
                              color={
                                CATEGORY_BADGE[output.classification.category]
                                  .color
                              }
                            >
                              {
                                CATEGORY_BADGE[output.classification.category]
                                  .label
                              }
                            </Badge>
                          )}
                        {output.recommended_level &&
                          LEVEL_BADGE[output.recommended_level] && (
                            <Badge
                              color={
                                LEVEL_BADGE[output.recommended_level].color
                              }
                            >
                              {LEVEL_BADGE[output.recommended_level].label}
                            </Badge>
                          )}
                      </div>
                      {output.steps && (
                        <ol className="flex flex-col gap-1 text-sm text-gray-600">
                          {output.steps.slice(0, 5).map((s, i) => (
                            <li key={i}>
                              {i + 1}. {s}
                            </li>
                          ))}
                          {output.steps.length > 5 && (
                            <li className="text-gray-400">
                              +{output.steps.length - 5} more steps
                            </li>
                          )}
                        </ol>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      </div>
    </div>
  );
}
