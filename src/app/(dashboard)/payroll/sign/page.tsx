'use client'

import { useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { CheckCircle, RotateCcw } from 'lucide-react'
import { formatCurrency } from '@/lib/utils'
import type { Payslip, Employee, PayrollRun } from '@/types/database'

interface PayslipWithEmployee extends Payslip {
  employee: Pick<Employee, 'full_name' | 'pt_code'>
}

// ---------- signature canvas ----------

function SignatureCanvas({
  onSave,
  saving,
}: {
  onSave: (dataUrl: string) => void
  saving: boolean
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [drawing, setDrawing] = useState(false)
  const [hasStrokes, setHasStrokes] = useState(false)

  function getPos(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function startDraw(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) {
    e.preventDefault()
    setDrawing(true)
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function draw(
    e: React.TouchEvent<HTMLCanvasElement> | React.MouseEvent<HTMLCanvasElement>
  ) {
    if (!drawing) return
    e.preventDefault()
    const ctx = canvasRef.current!.getContext('2d')!
    const { x, y } = getPos(e)
    ctx.lineTo(x, y)
    ctx.strokeStyle = '#1E293B'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
    setHasStrokes(true)
  }

  function endDraw() {
    setDrawing(false)
  }

  function clearCanvas() {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasStrokes(false)
  }

  function handleSave() {
    if (!hasStrokes) return
    const dataUrl = canvasRef.current!.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <div className="space-y-4">
      <p className="text-base font-semibold text-[#1E293B]">Sign below</p>
      <div className="rounded-xl border-2 border-dashed border-gray-300 bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={200}
          className="w-full touch-none cursor-crosshair rounded-xl"
          onMouseDown={startDraw}
          onMouseMove={draw}
          onMouseUp={endDraw}
          onMouseLeave={endDraw}
          onTouchStart={startDraw}
          onTouchMove={draw}
          onTouchEnd={endDraw}
        />
      </div>

      {/* Clear */}
      <button
        type="button"
        onClick={clearCanvas}
        className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
      >
        <RotateCcw className="h-4 w-4" />
        Clear signature
      </button>

      {/* Sign & Next */}
      <button
        type="button"
        onClick={handleSave}
        disabled={!hasStrokes || saving}
        className="h-14 w-full rounded-xl bg-[#1E40AF] text-white text-lg font-bold shadow-[0_4px_12px_rgba(30,64,175,0.35)] transition-all hover:bg-[#1d3faa] active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {saving ? 'Saving…' : 'Sign & Next'}
      </button>
    </div>
  )
}

// ---------- completion screen ----------

function AllDone() {
  return (
    <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
      <CheckCircle className="h-20 w-20 text-[#10B981]" strokeWidth={1.5} />
      <div>
        <p className="text-3xl font-black text-[#1E293B]">All done!</p>
        <p className="mt-2 text-lg text-gray-500">All payslips have been signed.</p>
      </div>
      <a
        href="/payroll"
        className="mt-4 inline-block rounded-xl border border-gray-200 bg-white px-8 py-3 text-base font-semibold text-[#1E40AF] shadow-sm hover:bg-gray-50 transition-colors"
      >
        Back to Payroll
      </a>
    </div>
  )
}

// ---------- main page ----------

export default function SignPayslipsPage() {
  const supabase = createClient()
  const { toast } = useToast()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [run, setRun] = useState<PayrollRun | null>(null)
  const [unsigned, setUnsigned] = useState<PayslipWithEmployee[]>([])
  const [currentIdx, setCurrentIdx] = useState(0)
  const [saving, setSaving] = useState(false)
  const [allDone, setAllDone] = useState(false)
  // Track total for the counter
  const [totalCount, setTotalCount] = useState(0)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)

    // 1. Get the most recent payroll run
    const { data: runData, error: runErr } = await supabase
      .from('payroll_runs')
      .select('*')
      .order('run_at', { ascending: false })
      .limit(1)
      .single()

    if (runErr || !runData) {
      setError('No payroll run found.')
      setLoading(false)
      return
    }

    setRun(runData as PayrollRun)

    // 2. Get all payslips for this run
    const { data: allSlips } = await supabase
      .from('payslips')
      .select('*, employee:employees(full_name, pt_code)')
      .eq('payroll_run_id', runData.id)
      .order('created_at')

    const slips = ((allSlips ?? []) as Record<string, unknown>[]).map((s) => ({
      ...s,
      employee: Array.isArray(s.employee) ? s.employee[0] : s.employee,
    })) as PayslipWithEmployee[]

    setTotalCount(slips.length)

    const unsignedSlips = slips.filter((s) => !s.signed_at)
    setUnsigned(unsignedSlips)
    setCurrentIdx(0)

    if (unsignedSlips.length === 0) {
      setAllDone(true)
    }

    setLoading(false)
  }, [supabase])

  useEffect(() => {
    load()
  }, [load])

  async function handleSignature(dataUrl: string) {
    const slip = unsigned[currentIdx]
    if (!slip) return
    setSaving(true)

    const signedAt = new Date().toISOString()
    const weekLabel = run?.week_end?.replace(/-/g, '') ?? 'unknown'
    const storagePath = `signatures/${slip.employee_id}/payslip-${weekLabel}.png`

    // Convert data URL to blob
    const blobRes = await fetch(dataUrl)
    const blob = await blobRes.blob()
    const sigFile = new File([blob], 'signature.png', { type: 'image/png' })

    const uploadForm = new FormData()
    uploadForm.append('file', sigFile)
    uploadForm.append('path', storagePath)

    let signatureUrl = dataUrl // fallback

    const uploadRes = await fetch('/api/upload-file', { method: 'POST', body: uploadForm })
    if (uploadRes.ok) {
      const uploadData = await uploadRes.json()
      signatureUrl = uploadData.url
    } else {
      toast('error', 'Signature upload failed — please sign again')
    }

    // Update the payslip record
    const { error: updateErr } = await supabase
      .from('payslips')
      .update({ signature_url: signatureUrl, signed_at: signedAt })
      .eq('id', slip.id)

    if (updateErr) {
      console.error('Signature save error:', updateErr.message)
      toast('error', 'Signature upload failed — please sign again')
    }

    // Advance
    const remaining = unsigned.filter((_, i) => i !== currentIdx)
    setUnsigned(remaining)
    setCurrentIdx(0)

    if (remaining.length === 0) {
      setAllDone(true)
    }

    setSaving(false)
  }

  // ---------- render ----------

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#1E40AF] border-t-transparent" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full items-center justify-center py-32">
        <p className="text-base text-gray-500">{error}</p>
      </div>
    )
  }

  if (allDone) {
    return (
      <div className="mx-auto max-w-lg px-4">
        <AllDone />
      </div>
    )
  }

  const slip = unsigned[currentIdx]
  const remaining = unsigned.length

  return (
    <div className="mx-auto max-w-lg px-4 py-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-black text-[#1E293B] tracking-tight">Sign Payslips</h1>
        <span className="rounded-full bg-[#EFF6FF] px-4 py-1.5 text-sm font-bold text-[#1E40AF]">
          {remaining} remaining
        </span>
      </div>

      {/* Progress bar */}
      {totalCount > 0 && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-gray-400">
            <span>{totalCount - remaining} of {totalCount} signed</span>
            <span>{Math.round(((totalCount - remaining) / totalCount) * 100)}%</span>
          </div>
          <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full rounded-full bg-[#10B981] transition-all duration-500"
              style={{ width: `${((totalCount - remaining) / totalCount) * 100}%` }}
            />
          </div>
        </div>
      )}

      {/* Employee card */}
      {slip && (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-[0_2px_12px_rgba(0,0,0,0.06)] space-y-5">
          {/* Name */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
              Employee
            </p>
            <p className="text-3xl font-black text-[#1E293B] leading-tight">
              {slip.employee?.full_name ?? '—'}
            </p>
            <p className="mt-1 text-sm text-gray-500 font-medium">
              {slip.employee?.pt_code ?? '—'}
            </p>
          </div>

          {/* Net pay — the one number that matters */}
          <div className="rounded-xl bg-[#1E293B] px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-bold text-white uppercase tracking-wider">
              Net Pay
            </span>
            <span className="text-2xl font-black text-[#3B82F6]">
              {formatCurrency(slip.net)}
            </span>
          </div>

          {/* Pay period */}
          {run && (
            <p className="text-sm text-gray-400 text-center">
              Week {run.week_start} — {run.week_end}
            </p>
          )}

          {/* Signature */}
          <SignatureCanvas onSave={handleSignature} saving={saving} />
        </div>
      )}
    </div>
  )
}
