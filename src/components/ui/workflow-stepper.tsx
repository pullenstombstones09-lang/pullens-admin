'use client'

import { useEffect, useState } from 'react'
import { ClipboardList, Calculator, PenTool, Printer, Landmark, Check } from 'lucide-react'
import { usePathname } from 'next/navigation'

type StepStatus = 'pending' | 'active' | 'done'

interface WorkflowStep {
  key: string
  label: string
  icon: React.ReactNode
  href: string
  status: StepStatus
  detail?: string
}

interface WorkflowData {
  weekStart: string
  weekEnd: string
  steps: {
    register: { status: string; count: number }
    payroll: { status: string; runId?: string }
    sign: { status: string; signed: number; total: number }
    print: { status: string; printed: number; total: number }
    bank: { status: string }
  }
}

export function WorkflowStepper({ compact }: { compact?: boolean }) {
  const [data, setData] = useState<WorkflowData | null>(null)
  const pathname = usePathname()

  useEffect(() => {
    fetch('/api/workflow')
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [pathname])

  if (!data) return null

  const steps: WorkflowStep[] = [
    {
      key: 'register',
      label: 'Register',
      icon: <ClipboardList size={compact ? 16 : 20} />,
      href: '/register',
      status: data.steps.register.status as StepStatus,
      detail: `${data.steps.register.count} records`,
    },
    {
      key: 'payroll',
      label: 'Payroll',
      icon: <Calculator size={compact ? 16 : 20} />,
      href: '/payroll',
      status: data.steps.payroll.status as StepStatus,
    },
    {
      key: 'sign',
      label: 'Sign',
      icon: <PenTool size={compact ? 16 : 20} />,
      href: '/payroll/payslip-viewer' + (data.steps.payroll.runId ? `?run=${data.steps.payroll.runId}` : ''),
      status: data.steps.sign.status as StepStatus,
      detail: data.steps.sign.total > 0 ? `${data.steps.sign.signed}/${data.steps.sign.total}` : undefined,
    },
    {
      key: 'print',
      label: 'Print',
      icon: <Printer size={compact ? 16 : 20} />,
      href: '/payroll',
      status: data.steps.print.status as StepStatus,
    },
    {
      key: 'bank',
      label: 'Bank',
      icon: <Landmark size={compact ? 16 : 20} />,
      href: '/payroll',
      status: data.steps.bank.status as StepStatus,
    },
  ]

  if (compact) {
    return (
      <div className="flex items-center gap-1 px-3 py-2">
        {steps.map((step, i) => (
          <div key={step.key} className="flex items-center">
            <a href={step.href} className="flex items-center gap-1 group" title={step.label}>
              <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs transition-all
                ${step.status === 'done' ? 'bg-[#10B981] text-white' :
                  step.status === 'active' ? 'bg-[#3B82F6] text-white animate-pulse-dot' :
                  'bg-gray-200 text-gray-400'}`}>
                {step.status === 'done' ? <Check size={14} /> : step.icon}
              </div>
            </a>
            {i < steps.length - 1 && (
              <div className={`w-4 h-0.5 mx-0.5 rounded ${step.status === 'done' ? 'bg-[#10B981]' : 'bg-gray-200'}`} />
            )}
          </div>
        ))}
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between bg-white rounded-xl border border-gray-100/60 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] px-6 py-4">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1">
          <a href={step.href} className="flex flex-col items-center gap-1.5 group flex-1">
            <div className={`flex items-center justify-center w-10 h-10 rounded-full transition-all
              ${step.status === 'done' ? 'bg-[#10B981] text-white shadow-md' :
                step.status === 'active' ? 'bg-[#1E40AF] text-white shadow-lg animate-pulse-blue' :
                'bg-gray-100 text-gray-400'}`}>
              {step.status === 'done' ? <Check size={20} /> : step.icon}
            </div>
            <span className={`text-xs font-semibold
              ${step.status === 'done' ? 'text-[#10B981]' :
                step.status === 'active' ? 'text-[#1E40AF]' :
                'text-gray-400'}`}>
              {step.label}
            </span>
            {step.detail && (
              <span className="text-[10px] text-gray-400">{step.detail}</span>
            )}
          </a>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-2 rounded ${step.status === 'done' ? 'bg-[#10B981]' : 'bg-gray-200'}`} />
          )}
        </div>
      ))}
    </div>
  )
}
