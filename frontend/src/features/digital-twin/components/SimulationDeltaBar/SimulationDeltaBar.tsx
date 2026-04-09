import type { SimulationProjection } from '../../types/simulation.types'
import styles from './SimulationDeltaBar.module.css'

interface SimulationDeltaBarProps {
  projection: SimulationProjection
}

export function SimulationDeltaBar({ projection }: SimulationDeltaBarProps) {
  const { energy, comfort, co2 } = projection.kpiDeltas
  return (
    <div className={styles.bar}>
      <span className={styles.label}>PROJECTION</span>
      <Pill label="ENERGY"  value={energy}  lowerBetter />
      <Pill label="COMFORT" value={comfort} lowerBetter={false} />
      <Pill label="CO₂"     value={co2}     lowerBetter />
    </div>
  )
}

function Pill({ label, value, lowerBetter }: { label: string; value: number; lowerBetter: boolean }) {
  const good  = lowerBetter ? value < 0 : value > 0
  const sign  = value > 0 ? '+' : ''
  const arrow = value < 0 ? ' ↓' : value > 0 ? ' ↑' : ''
  return (
    <span className={`${styles.pill} ${good ? styles.pillGood : styles.pillBad}`}>
      {label} {sign}{value}%{arrow}
    </span>
  )
}
