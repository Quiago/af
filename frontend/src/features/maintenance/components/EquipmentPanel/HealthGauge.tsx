import './HealthGauge.css'

interface HealthGaugeProps {
  score: number // 0-100
}

export function HealthGauge({ score }: HealthGaugeProps) {
  const cx = 50
  const cy = 58
  const r  = 36

  const circumference = 2 * Math.PI * r          // ≈ 226.2
  const arcSpan       = (270 / 360) * circumference // ≈ 169.6 — the 270° sweep
  const gapSpan       = circumference - arcSpan     // ≈ 56.6

  const filled = (score / 100) * arcSpan

  const trackDash  = `${arcSpan} ${gapSpan}`
  const scoreDash  = `${filled} ${circumference - filled}`

  const scoreColor =
    score >= 80 ? 'var(--color-status-ok)'
    : score >= 60 ? 'var(--color-status-warning)'
    : 'var(--color-status-critical)'

  const label =
    score >= 80 ? 'Good'
    : score >= 60 ? 'Fair'
    : 'Poor'

  return (
    <div className="health-gauge">
      <svg viewBox="0 0 100 80" className="health-gauge-svg" aria-label={`Health score: ${score}`}>
        {/* Background track */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={trackDash}
          transform={`rotate(135, ${cx}, ${cy})`}
        />
        {/* Score fill */}
        <circle
          cx={cx} cy={cy} r={r}
          fill="none"
          stroke={scoreColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={scoreDash}
          transform={`rotate(135, ${cx}, ${cy})`}
          style={{ transition: 'stroke-dasharray 0.6s ease, stroke 0.4s ease' }}
        />
        {/* Score number */}
        <text
          x={cx} y={cy - 4}
          textAnchor="middle"
          className="gauge-score"
          fill={scoreColor}
        >
          {score}
        </text>
        {/* Label */}
        <text
          x={cx} y={cy + 12}
          textAnchor="middle"
          className="gauge-label"
          fill="rgba(255,255,255,0.4)"
        >
          {label}
        </text>
      </svg>
    </div>
  )
}
