'use client'

import { useState } from 'react'
import { Pencil, Check, X, AlertTriangle } from 'lucide-react'

interface InfoSection {
  title: string
  fields: { label: string; key: string; value: string | null; masked?: boolean; type?: string }[]
}

interface EmployeeInfoCardProps {
  employee: any
  canEdit: boolean
  onUpdate: (updates: Record<string, any>) => void
}

export function EmployeeInfoCard({ employee, canEdit, onUpdate }: EmployeeInfoCardProps) {
  const [editingSection, setEditingSection] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<Record<string, any>>({})
  const [saving, setSaving] = useState(false)

  const sections: InfoSection[] = [
    {
      title: 'Personal',
      fields: [
        { label: 'Gender', key: 'gender', value: employee.gender },
        { label: 'Race', key: 'race', value: employee.race },
        { label: 'Date of Birth', key: 'dob', value: employee.dob, type: 'date' },
        { label: 'ID Number', key: 'id_number', value: employee.id_number },
        { label: 'Home Address', key: 'home_address', value: employee.home_address },
      ],
    },
    {
      title: 'Contact',
      fields: [
        { label: 'Cell', key: 'cell', value: employee.cell },
        { label: 'Email', key: 'email', value: employee.email },
        { label: 'Emergency Name', key: 'emergency_name', value: employee.emergency_name },
        { label: 'Emergency Phone', key: 'emergency_phone', value: employee.emergency_phone },
      ],
    },
    {
      title: 'Employment',
      fields: [
        { label: 'Start Date', key: 'start_date', value: employee.start_date, type: 'date' },
        { label: 'Occupation', key: 'occupation', value: employee.occupation },
        { label: 'Weekly Hours', key: 'weekly_hours', value: employee.weekly_hours?.toString(), type: 'number' },
        { label: 'Weekly Wage', key: 'weekly_wage', value: employee.weekly_wage ? `R${employee.weekly_wage}` : null, type: 'number' },
        { label: 'Payment Method', key: 'payment_method', value: employee.payment_method },
      ],
    },
    {
      title: 'Banking',
      fields: [
        { label: 'Bank', key: 'bank_name', value: employee.bank_name },
        { label: 'Account', key: 'bank_acc', value: employee.bank_acc, masked: true },
        { label: 'Branch Code', key: 'bank_branch', value: employee.bank_branch },
      ],
    },
    {
      title: 'Compliance',
      fields: [
        { label: 'Tax Number', key: 'tax_number', value: employee.tax_number },
        { label: 'UIF Ref', key: 'uif_ref', value: employee.uif_ref },
        { label: 'EIF on File', key: 'eif_on_file', value: employee.eif_on_file ? 'Yes' : 'No' },
      ],
    },
  ]

  const startEdit = (sectionTitle: string) => {
    const section = sections.find(s => s.title === sectionTitle)
    if (!section) return
    const values: Record<string, any> = {}
    section.fields.forEach(f => {
      values[f.key] = f.key === 'weekly_wage' ? employee.weekly_wage : (employee[f.key] ?? '')
    })
    setEditValues(values)
    setEditingSection(sectionTitle)
  }

  const saveEdit = async (sectionTitle: string) => {
    setSaving(true)
    onUpdate(editValues)
    setSaving(false)
    setEditingSection(null)
  }

  const hasWarningNote = employee.notes &&
    /missing|still to capture|not yet|banking|eif/i.test(employee.notes)

  return (
    <div className="space-y-4">
      {hasWarningNote && (
        <div className="flex items-start gap-2 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3">
          <AlertTriangle size={16} className="text-amber-500 mt-0.5 shrink-0" />
          <p className="text-sm text-amber-800">{employee.notes}</p>
        </div>
      )}

      {sections.map(section => (
        <div key={section.title} className="rounded-xl border border-gray-100/60 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)]">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-[#1E293B] uppercase tracking-wide">{section.title}</h3>
            {canEdit && editingSection !== section.title && (
              <button onClick={() => startEdit(section.title)}
                className="p-1.5 rounded-lg text-gray-400 hover:text-[#1E40AF] hover:bg-blue-50 transition-colors">
                <Pencil size={14} />
              </button>
            )}
            {editingSection === section.title && (
              <div className="flex gap-1">
                <button onClick={() => saveEdit(section.title)} disabled={saving}
                  className="p-1.5 rounded-lg text-[#10B981] hover:bg-green-50">
                  <Check size={14} />
                </button>
                <button onClick={() => setEditingSection(null)}
                  className="p-1.5 rounded-lg text-gray-400 hover:bg-gray-50">
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2">
            {section.fields.map(field => (
              <div key={field.key}>
                <p className="text-xs text-gray-400">{field.label}</p>
                {editingSection === section.title ? (
                  <input
                    type={field.type || 'text'}
                    value={editValues[field.key] ?? ''}
                    onChange={(e) => setEditValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                    className="w-full h-9 rounded-lg border border-gray-300 px-2 text-sm mt-0.5 focus:ring-2 focus:ring-[#3B82F6]/40 focus:outline-none"
                  />
                ) : (
                  <p className="text-sm font-medium text-[#1E293B]">
                    {field.masked && field.value
                      ? '••••' + field.value.slice(-4)
                      : field.value || <span className="text-gray-300">—</span>}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
