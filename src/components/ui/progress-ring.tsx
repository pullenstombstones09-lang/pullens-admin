interface ProgressRingProps {
  percent: number
  size?: number
  strokeWidth?: number
  className?: string
}

export function ProgressRing({ percent, size = 32, strokeWidth = 3, className }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percent / 100) * circumference

  const color = percent < 50 ? '#EF4444' : percent < 80 ? '#F59E0B' : '#10B981'

  return (
    <svg width={size} height={size} className={className}>
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke="#E5E7EB" strokeWidth={strokeWidth}
      />
      <circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeDasharray={circumference} strokeDashoffset={offset}
        strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 500ms ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central"
            fill={color} fontSize={size * 0.3} fontWeight="700">
        {Math.round(percent)}
      </text>
    </svg>
  )
}
