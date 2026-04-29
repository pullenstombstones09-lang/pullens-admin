'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Printer, FileText, CheckCircle, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { formatCurrency } from '@/lib/utils'

interface PayrollRun {
  id: string
  week_start: string
  week_end: string
  status: string
}

interface PayslipRow {
  id: string
  employee_id: string
  net: number
  signed_at: string | null
  employees: {
    full_name: string
    pt_code: string
  } | null
}

function weekLabel(run: PayrollRun): string {
  const fmt = (d: string) =>
    new Date(d).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' })
  return `${fmt(run.week_start)} – ${fmt(run.week_end)}`
}

export default function PrintPayslipsPage() {
  const supabase = createClient()

  const [run, setRun] = useState<PayrollRun | null>(null)
  const [payslips, setPayslips] = useState<PayslipRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      const { data: runs } = await supabase
        .from('payroll_runs')
        .select('id, week_start, week_end, status')
        .order('created_at', { ascending: false })
        .limit(1)

      const latestRun = runs?.[0] ?? null
      setRun(latestRun)

      if (!latestRun) {
        setLoading(false)
        return
      }

      const { data: slips } = await supabase
        .from('payslips')
        .select('id, employee_id, net, signed_at, employees(full_name, pt_code)')
        .eq('payroll_run_id', latestRun.id)
        .order('employees(full_name)')

      setPayslips((slips as unknown as PayslipRow[]) ?? [])
      setLoading(false)
    }

    load()
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1E40AF] border-t-transparent" />
      </div>
    )
  }

  if (!run) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center space-y-3">
          <p className="text-sm font-medium text-gray-500">Payroll hasn&apos;t run yet</p>
          <a href="/payroll" className="text-sm font-semibold text-[#3B82F6] hover:underline">
            Run payroll &rarr;
          </a>
        </div>
      </div>
    )
  }

  const totalNet = payslips.reduce((sum, p) => sum + (p.net ?? 0), 0)
  const signedCount = payslips.filter((p) => p.signed_at).length

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Print Payslips</h1>
        <p className="text-gray-500 mt-1">{weekLabel(run)}</p>
        <p className="text-sm text-gray-400 mt-1">
          {signedCount} of {payslips.length} signed · Total net{' '}
          {formatCurrency(totalNet)}
        </p>
      </div>

      {/* Bulk action cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center">
              <Printer className="w-7 h-7 text-blue-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Print All Payslips</p>
              <p className="text-sm text-gray-500 mt-1">
                All {payslips.length} payslips in one PDF
              </p>
            </div>
            <Button
              className="w-full"
              onClick={() =>
                window.open(`/api/pdf/payslips-all?run=${run.id}`, '_blank')
              }
            >
              <Printer className="w-4 h-4 mr-2" />
              Open PDF
            </Button>
          </CardContent>
        </Card>

        <Card className="hover:shadow-md transition-shadow">
          <CardContent className="p-6 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-full bg-green-50 flex items-center justify-center">
              <FileText className="w-7 h-7 text-green-600" />
            </div>
            <div>
              <p className="font-semibold text-gray-900">Print Summary</p>
              <p className="text-sm text-gray-500 mt-1">
                Payroll summary sheet for this week
              </p>
            </div>
            <Button
              variant="secondary"
              className="w-full"
              onClick={() =>
                window.open(`/api/pdf/payroll-summary?run=${run.id}`, '_blank')
              }
            >
              <FileText className="w-4 h-4 mr-2" />
              Open PDF
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Individual payslips */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
          Individual Payslips
        </h2>
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          {payslips.length === 0 ? (
            <p className="text-center text-gray-400 py-8 text-sm">
              No payslips generated for this run yet.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-gray-600">
                    Employee
                  </th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">
                    Net Pay
                  </th>
                  <th className="text-center px-4 py-3 font-medium text-gray-600">
                    Signed
                  </th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {payslips.map((slip) => (
                  <tr key={slip.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">
                        {slip.employees?.full_name ?? '—'}
                      </span>
                      <span className="ml-2 text-xs text-gray-400">
                        {slip.employees?.pt_code}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-800">
                      {formatCurrency(slip.net ?? 0)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {slip.signed_at ? (
                        <CheckCircle className="w-4 h-4 text-green-500 inline-block" />
                      ) : (
                        <Clock className="w-4 h-4 text-amber-400 inline-block" />
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          window.open(
                            `/api/pdf/payslip?id=${slip.id}`,
                            '_blank'
                          )
                        }
                      >
                        <Printer className="w-3.5 h-3.5 mr-1.5" />
                        Print
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
