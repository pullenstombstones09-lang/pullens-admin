'use client'

import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { SlidePanel } from './slide-panel'
import { AnomalyBadge } from './anomaly-badge'
import { createClient } from '@/lib/supabase/client'
import { detectAnomalies, Anomaly } from '@/lib/anomalies'
import { formatCurrency } from '@/lib/utils'

interface PayslipViewerProps {
  employeeId: string | null
  employeeName: string
  onClose: () => void
}

interface PayslipData {
  id: string
  payroll_run_id: string
  ordinary_hours: number
  ot_hours: number
  ot_amount: number
  gross: number
  late_deduction: number
  uif_employee: number
  paye: number
  loan_deduction: number
  garnishee: number
  petty_shortfall: number
  net: number
  signed_at: string | null
  payroll_runs: {
    week_start: string
    week_end: string
    payroll_type: string
  }
}

interface EmployeeInfo {
  weekly_wage: number
  weekly_hours: number
  hourly_rate: number
}

function Row({ label, value, bold, negative }: {
  label: string; value: number; bold?: boolean; negative?: boolean
}) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? 'font-bold' : ''}`}>
      <span className={negative ? 'text-red-600' : ''}>{label}</span>
      <span className={negative ? 'text-red-600' : ''}>
        {negative && value < 0 ? '-' : ''}R{Math.abs(value).toFixed(2)}
      </span>
    </div>
  )
}

export function PayslipViewer({ employeeId, employeeName, onClose }: PayslipViewerProps) {
  const [payslips, setPayslips] = useState<PayslipData[]>([])
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [employeeInfo, setEmployeeInfo] = useState<EmployeeInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)

  useEffect(() => {
    if (!employeeId) {
      setPayslips([])
      setSelectedIndex(0)
      setEmployeeInfo(null)
      return
    }

    setLoading(true)
    const supabase = createClient()

    Promise.all([
      supabase
        .from('payslips')
        .select(`
          id,
          payroll_run_id,
          ordinary_hours,
          ot_hours,
          ot_amount,
          gross,
          late_deduction,
          uif_employee,
          paye,
          loan_deduction,
          garnishee,
          petty_shortfall,
          net,
          signed_at,
          payroll_runs (
            week_start,
            week_end,
            payroll_type
          )
        `)
        .eq('employee_id', employeeId)
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('employees')
        .select('weekly_wage, weekly_hours, hourly_rate')
        .eq('id', employeeId)
        .single(),
    ]).then(([payslipsResult, employeeResult]) => {
      if (payslipsResult.data) {
        // payroll_runs comes back as object (single join), cast accordingly
        setPayslips(payslipsResult.data as unknown as PayslipData[])
        setSelectedIndex(0)
      }
      if (employeeResult.data) {
        setEmployeeInfo(employeeResult.data as EmployeeInfo)
      }
      setLoading(false)
    })
  }, [employeeId])

  const isOpen = !!employeeId
  const payslip = payslips[selectedIndex] ?? null

  // Build a PayrollResult-compatible object for anomaly detection
  const anomalies: Anomaly[] = payslip
    ? detectAnomalies(
        {
          employee_id: employeeId ?? '',
          pt_code: '',
          full_name: employeeName,
          weekly_wage: employeeInfo?.weekly_wage ?? 0,
          hourly_rate: employeeInfo?.hourly_rate ?? 0,
          ordinary_hours: payslip.ordinary_hours,
          ot_hours: payslip.ot_hours,
          ot_amount: payslip.ot_amount,
          late_minutes: payslip.late_deduction > 0 ? 1 : 0, // non-zero triggers flag
          late_deduction: payslip.late_deduction,
          gross: payslip.gross,
          uif_employee: payslip.uif_employee,
          uif_employer: 0,
          paye: payslip.paye,
          loan_deduction: payslip.loan_deduction,
          garnishee: payslip.garnishee,
          petty_shortfall: payslip.petty_shortfall,
          net: payslip.net,
          breakdown: {
            daily_attendance: [],
            ot_entries: [],
            loan_entries: [],
          },
          friday_ot_rollover: [],
          next_week_friday_rollover_minutes: 0,
        },
        payslips[selectedIndex + 1]?.net
      )
    : []

  function formatWeekLabel(ps: PayslipData) {
    const start = new Date(ps.payroll_runs.week_start)
    const end = new Date(ps.payroll_runs.week_end)
    const fmt = (d: Date) =>
      d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short' })
    return `${fmt(start)} – ${fmt(end)}`
  }

  return (
    <SlidePanel
      open={isOpen}
      onClose={onClose}
      title={`Payslip — ${employeeName}`}
      width="max-w-lg"
    >
      {loading && (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
          Loading payslips…
        </div>
      )}

      {!loading && payslips.length === 0 && (
        <div className="flex items-center justify-center py-12 text-gray-400 text-sm">
          No payslips found for this employee.
        </div>
      )}

      {!loading && payslip && (
        <div className="space-y-5">
          {/* Week selector */}
          <div className="relative">
            <button
              onClick={() => setDropdownOpen(prev => !prev)}
              className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-100"
            >
              <span>{formatWeekLabel(payslip)}</span>
              <ChevronDown size={16} className={`transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            {dropdownOpen && (
              <div className="absolute left-0 right-0 top-full z-10 mt-1 rounded-lg border border-gray-200 bg-white shadow-lg">
                {payslips.map((ps, i) => (
                  <button
                    key={ps.id}
                    onClick={() => { setSelectedIndex(i); setDropdownOpen(false) }}
                    className={`flex w-full items-center justify-between px-4 py-2.5 text-sm hover:bg-gray-50 ${
                      i === selectedIndex ? 'font-semibold text-[#1E40AF]' : 'text-gray-700'
                    } ${i === 0 ? 'rounded-t-lg' : ''} ${i === payslips.length - 1 ? 'rounded-b-lg' : ''}`}
                  >
                    <span>{formatWeekLabel(ps)}</span>
                    {ps.payroll_runs.payroll_type === 'saturday_cash' && (
                      <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-700">
                        Sat Cash
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Badges row */}
          <div className="flex flex-wrap items-center gap-2">
            {payslip.payroll_runs.payroll_type === 'saturday_cash' && (
              <span className="rounded-full bg-yellow-100 px-3 py-0.5 text-xs font-semibold text-yellow-700 border border-yellow-200">
                Saturday Cash
              </span>
            )}
            <AnomalyBadge anomalies={anomalies} />
          </div>

          {/* Anomaly detail list */}
          {anomalies.length > 0 && (
            <div className="rounded-lg border border-amber-100 bg-amber-50 p-3 space-y-1">
              {anomalies.map((a, i) => (
                <p key={i} className="text-xs text-amber-800">
                  <span className="font-semibold">{a.label}:</span> {a.detail}
                </p>
              ))}
            </div>
          )}

          {/* Earnings */}
          <div className="rounded-lg border border-gray-100 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Earnings</p>
            <Row
              label={`Ordinary hours (${payslip.ordinary_hours.toFixed(1)} hrs × R${(employeeInfo?.hourly_rate ?? 0).toFixed(2)})`}
              value={payslip.gross - payslip.ot_amount}
            />
            {payslip.ot_hours > 0 && (
              <Row
                label={`Overtime (${payslip.ot_hours.toFixed(1)} hrs)`}
                value={payslip.ot_amount}
              />
            )}
            {payslip.late_deduction > 0 && (
              <Row
                label="Late deduction"
                value={-payslip.late_deduction}
                negative
              />
            )}
            <div className="border-t border-gray-100 pt-2 mt-2">
              <Row label="Gross pay" value={payslip.gross} bold />
            </div>
          </div>

          {/* Deductions */}
          <div className="rounded-lg border border-gray-100 bg-white p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">Deductions</p>
            <Row label="UIF (employee)" value={-payslip.uif_employee} negative />
            {payslip.paye > 0 && (
              <Row label="PAYE" value={-payslip.paye} negative />
            )}
            {payslip.loan_deduction > 0 && (
              <Row label="Loan repayment" value={-payslip.loan_deduction} negative />
            )}
            {payslip.garnishee > 0 && (
              <Row label="Garnishee order" value={-payslip.garnishee} negative />
            )}
            {payslip.petty_shortfall > 0 && (
              <Row label="Petty cash shortfall" value={-payslip.petty_shortfall} negative />
            )}
            <div className="border-t border-gray-100 pt-2 mt-2">
              <Row
                label="Total deductions"
                value={-(payslip.uif_employee + payslip.paye + payslip.loan_deduction + payslip.garnishee + payslip.petty_shortfall)}
                bold
                negative
              />
            </div>
          </div>

          {/* Net pay */}
          <div className="rounded-xl bg-[#1E40AF] p-5 text-white text-center">
            <p className="text-sm font-medium opacity-80 mb-1">Net Pay</p>
            <p className="text-3xl font-bold tracking-tight">{formatCurrency(payslip.net)}</p>
          </div>

          {/* Signed status */}
          <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3 text-sm">
            <span className="text-gray-500">Signature</span>
            {payslip.signed_at ? (
              <span className="font-medium text-green-700">
                Signed {new Date(payslip.signed_at).toLocaleDateString('en-ZA', {
                  day: '2-digit', month: 'short', year: 'numeric'
                })}
              </span>
            ) : (
              <span className="font-medium text-amber-600">Not yet signed</span>
            )}
          </div>
        </div>
      )}
    </SlidePanel>
  )
}
