import type { HealthMetric } from '../../../../types/building.types'
import './HealthBar.css'

interface HealthBarProps {
  metric: HealthMetric
}

export function HealthBar({ metric }: HealthBarProps) {
  const fillColor =
    metric.value >= 70 ? 'var(--color-status-ok)'
    : metric.value >= 40 ? 'var(--color-status-warning)'
    : 'var(--color-status-critical)'

  return (
    <div className="health-bar">
      <div className="health-bar-header">
        <span className="health-bar-label">{metric.label}</span>
        <span className="health-bar-display" style={{ color: fillColor }}>
          {metric.displayValue}
        </span>
      </div>
      <div className="health-bar-track">
        <div
          className="health-bar-fill"
          style={{
            width: `${metric.value}%`,
            background: fillColor,
            transition: 'width 0.5s ease, background 0.4s ease',
          }}
        />
      </div>
    </div>
  )
}
