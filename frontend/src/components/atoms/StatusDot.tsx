import './StatusDot.css'

type Status = 'ok' | 'warning' | 'critical' | 'offline'

interface StatusDotProps {
  status: Status
  size?: 'sm' | 'md'
}

export function StatusDot({ status, size = 'sm' }: StatusDotProps) {
  return (
    <span
      className={`status-dot status-dot--${status} status-dot--${size}`}
      aria-label={status}
    />
  )
}
