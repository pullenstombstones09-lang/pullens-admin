'use client';

import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn, formatDate } from '@/lib/utils';
import { createClient } from '@/lib/supabase/client';
import {
  Download,
  FileSpreadsheet,
  FileText,
  Shield,
  Scale,
  Loader2,
  CheckCircle,
  ChevronDown,
} from 'lucide-react';
import type { Employee } from '@/types/database';

interface ExportCard {
  id: string;
  title: string;
  code: string;
  description: string;
  icon: React.ReactNode;
  periodType: 'month' | 'year' | 'employee';
}

const EXPORT_CARDS: ExportCard[] = [
  {
    id: 'uif',
    title: 'UI-19 — Monthly UIF Declaration',
    code: 'UI-19',
    description:
      'Monthly declaration of employee earnings and UIF contributions, submitted to the Department of Employment and Labour.',
    icon: <FileSpreadsheet className="h-6 w-6" />,
    periodType: 'month',
  },
  {
    id: 'emp201',
    title: 'EMP201 — Monthly PAYE Summary',
    code: 'EMP201',
    description:
      'Monthly employer declaration of PAYE, UIF, and SDL to SARS. Due by the 7th of the following month.',
    icon: <FileText className="h-6 w-6" />,
    periodType: 'month',
  },
  {
    id: 'emp501',
    title: 'EMP501 — Annual PAYE Reconciliation',
    code: 'EMP501',
    description:
      'Annual reconciliation of all PAYE, UIF, and SDL for the tax year. Submitted via SARS e@syFile.',
    icon: <FileSpreadsheet className="h-6 w-6" />,
    periodType: 'year',
  },
  {
    id: 'roe',
    title: 'Return of Earnings — Annual COIDA',
    code: 'ROE',
    description:
      'Annual return of earnings to the Compensation Fund (COIDA). Due by 31 March each year.',
    icon: <Shield className="h-6 w-6" />,
    periodType: 'year',
  },
  {
    id: 'ccma',
    title: 'CCMA Case File',
    code: 'CCMA',
    description:
      'Generate a complete disciplinary case file: contract, all warnings, hearing notices, outcomes, and signed receipts.',
    icon: <Scale className="h-6 w-6" />,
    periodType: 'employee',
  },
];

function getMonthOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' });
    options.push({ value, label });
  }
  return options;
}

function getYearOptions(): { value: string; label: string }[] {
  const currentYear = new Date().getFullYear();
  return Array.from({ length: 5 }, (_, i) => {
    const y = currentYear - i;
    return { value: String(y), label: `${y}` };
  });
}

export default function ExportsPage() {
  const [employees, setEmployees] = useState<Pick<Employee, 'id' | 'full_name' | 'pt_code'>[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<Record<string, string>>({});
  const [selectedYear, setSelectedYear] = useState<Record<string, string>>({});
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [generating, setGenerating] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, { success: boolean; data?: unknown; error?: string }>>({});
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  const monthOptions = getMonthOptions();
  const yearOptions = getYearOptions();

  useEffect(() => {
    async function loadEmployees() {
      const supabase = createClient();
      const { data } = await supabase
        .from('employees')
        .select('id, full_name, pt_code')
        .eq('status', 'active')
        .order('full_name');
      setEmployees(data || []);
    }
    loadEmployees();
  }, []);

  const filteredEmployees = employees.filter(
    (e) =>
      e.full_name.toLowerCase().includes(employeeSearch.toLowerCase()) ||
      e.pt_code.toLowerCase().includes(employeeSearch.toLowerCase())
  );

  const selectedEmpName = employees.find((e) => e.id === selectedEmployee)?.full_name || '';

  async function handleGenerate(cardId: string) {
    setGenerating(cardId);
    setResults((prev) => ({ ...prev, [cardId]: undefined as unknown as { success: boolean } }));

    try {
      if (cardId === 'ccma') {
        if (!selectedEmployee) {
          setResults((prev) => ({
            ...prev,
            [cardId]: { success: false, error: 'Select an employee first' },
          }));
          setGenerating(null);
          return;
        }

        const res = await fetch('/api/exports/ccma-case', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ employee_id: selectedEmployee }),
        });

        if (res.ok) {
          const data = await res.json();
          setResults((prev) => ({ ...prev, [cardId]: { success: true, data } }));
        } else {
          const err = await res.json();
          setResults((prev) => ({
            ...prev,
            [cardId]: { success: false, error: err.error || 'Generation failed' },
          }));
        }
      } else {
        // For UIF, EMP201, EMP501, ROE — placeholder until Phase 2
        const period =
          EXPORT_CARDS.find((c) => c.id === cardId)?.periodType === 'month'
            ? selectedMonth[cardId] || monthOptions[0]?.value
            : selectedYear[cardId] || yearOptions[0]?.value;

        // Simulate generation delay
        await new Promise((resolve) => setTimeout(resolve, 1500));

        setResults((prev) => ({
          ...prev,
          [cardId]: {
            success: true,
            data: {
              message: `Export generation queued for ${period}. PDF/Excel output is Phase 2.`,
              period,
            },
          },
        }));
      }
    } catch {
      setResults((prev) => ({
        ...prev,
        [cardId]: { success: false, error: 'Network error' },
      }));
    } finally {
      setGenerating(null);
    }
  }

  return (
    <div className="max-w-5xl mx-auto">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-2xl font-bold text-[#333333] flex items-center gap-2">
          <Download className="h-6 w-6 text-[#1E40AF]" />
          Compliance Exports
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Generate statutory returns and compliance documents
        </p>
      </div>

      {/* Export cards */}
      <div className="flex flex-col gap-4">
        {EXPORT_CARDS.map((card) => {
          const isGenerating = generating === card.id;
          const result = results[card.id];

          return (
            <Card key={card.id}>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#1E293B]/5">
                    <span className="text-[#1E293B]">{card.icon}</span>
                  </div>
                  <div>
                    <CardTitle>{card.title}</CardTitle>
                    <Badge color="blue" className="mt-1">
                      {card.code}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-500 mb-4">{card.description}</p>

                <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                  {/* Period selector */}
                  {card.periodType === 'month' && (
                    <div className="flex-1 max-w-xs">
                      <label className="text-sm font-medium text-[#333333] mb-1.5 block">
                        Month
                      </label>
                      <div className="relative">
                        <select
                          value={selectedMonth[card.id] || monthOptions[0]?.value}
                          onChange={(e) =>
                            setSelectedMonth((prev) => ({ ...prev, [card.id]: e.target.value }))
                          }
                          className={cn(
                            'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-10 text-sm text-[#333333]',
                            'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]',
                            'min-h-[48px] appearance-none'
                          )}
                        >
                          {monthOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {card.periodType === 'year' && (
                    <div className="flex-1 max-w-xs">
                      <label className="text-sm font-medium text-[#333333] mb-1.5 block">
                        Year
                      </label>
                      <div className="relative">
                        <select
                          value={selectedYear[card.id] || yearOptions[0]?.value}
                          onChange={(e) =>
                            setSelectedYear((prev) => ({ ...prev, [card.id]: e.target.value }))
                          }
                          className={cn(
                            'h-12 w-full rounded-lg border border-gray-300 bg-white px-3.5 pr-10 text-sm text-[#333333]',
                            'focus:outline-none focus:ring-2 focus:ring-[#3B82F6]/40 focus:border-[#3B82F6]',
                            'min-h-[48px] appearance-none'
                          )}
                        >
                          {yearOptions.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                        <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
                      </div>
                    </div>
                  )}

                  {card.periodType === 'employee' && (
                    <div className="flex-1 max-w-sm relative">
                      <label className="text-sm font-medium text-[#333333] mb-1.5 block">
                        Employee
                      </label>
                      <Input
                        value={selectedEmployee ? selectedEmpName : employeeSearch}
                        onChange={(e) => {
                          setEmployeeSearch(e.target.value);
                          setSelectedEmployee('');
                          setShowDropdown(true);
                        }}
                        onFocus={() => setShowDropdown(true)}
                        placeholder="Search by name or PT code..."
                      />
                      {showDropdown && !selectedEmployee && employeeSearch.length > 0 && (
                        <div className="absolute z-20 mt-1 w-full rounded-lg border border-gray-200 bg-white shadow-lg max-h-48 overflow-y-auto">
                          {filteredEmployees.length === 0 ? (
                            <p className="px-3 py-2 text-sm text-gray-400">No matches</p>
                          ) : (
                            filteredEmployees.map((emp) => (
                              <button
                                key={emp.id}
                                onClick={() => {
                                  setSelectedEmployee(emp.id);
                                  setEmployeeSearch('');
                                  setShowDropdown(false);
                                }}
                                className="w-full text-left px-3 py-2.5 text-sm hover:bg-gray-50 transition-colors min-h-[44px] flex items-center gap-2"
                              >
                                <span className="font-medium text-[#333333]">{emp.full_name}</span>
                                <span className="text-gray-400 text-xs">{emp.pt_code}</span>
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Generate button */}
                  {card.id === 'ccma' ? (
                    <Button
                      variant="primary"
                      size="lg"
                      onClick={() => handleGenerate(card.id)}
                      loading={isGenerating}
                      icon={isGenerating ? undefined : <FileText className="h-4 w-4" />}
                      disabled={!selectedEmployee}
                    >
                      Generate Case File
                    </Button>
                  ) : (
                    <Button
                      variant="secondary"
                      size="lg"
                      disabled
                      icon={<Download className="h-4 w-4" />}
                    >
                      Coming soon
                    </Button>
                  )}
                </div>

                {/* Result feedback */}
                {result && (
                  <div
                    className={cn(
                      'mt-4 rounded-lg border px-4 py-3 text-sm',
                      result.success
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        : 'border-red-200 bg-red-50 text-red-700'
                    )}
                  >
                    {result.success ? (
                      <div className="flex items-start gap-2">
                        <CheckCircle className="h-4 w-4 mt-0.5 shrink-0" />
                        <div>
                          <p className="font-medium">Generated successfully</p>
                          {card.id === 'ccma' && result.data ? (
                            <p className="mt-1 text-xs text-emerald-600">
                              Case file includes {((result.data as Record<string, unknown[]>).warnings?.length) ?? 0} warning(s),{' '}
                              {((result.data as Record<string, unknown[]>).hearings?.length) ?? 0} hearing(s),{' '}
                              {((result.data as Record<string, unknown[]>).documents?.length) ?? 0} document(s).
                            </p>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <p>{result.error}</p>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
