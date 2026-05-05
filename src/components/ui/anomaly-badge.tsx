import { Anomaly } from '@/lib/anomalies'

interface AnomalyBadgeProps {
  anomalies: Anomaly[];
  compact?: boolean;
}

export function AnomalyBadge({ anomalies, compact = false }: AnomalyBadgeProps) {
  if (anomalies.length === 0) return null

  const hasRed = anomalies.some(a => a.severity === 'red')
  const color = hasRed ? 'bg-red-100 text-red-700 border-red-200' : 'bg-amber-100 text-amber-700 border-amber-200'

  if (compact) {
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${color}`}>
        {anomalies.length}
      </span>
    )
  }

  return (
    <div className="flex flex-wrap gap-1">
      {anomalies.map((a, i) => (
        <span
          key={i}
          title={a.detail}
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${
            a.severity === 'red'
              ? 'bg-red-100 text-red-700 border-red-200'
              : 'bg-amber-100 text-amber-700 border-amber-200'
          }`}
        >
          {a.label}
        </span>
      ))}
    </div>
  )
}
