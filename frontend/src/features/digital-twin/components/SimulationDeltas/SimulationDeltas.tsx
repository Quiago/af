/**
 * SimulationDeltas — 1-hour forecast KPI comparison.
 *
 * Shows what will be consumed / spent / emitted in the NEXT HOUR,
 * contrasted with what the current rate would produce without intervention.
 * Window: 1 hour. No annual projections, no streaming mock.
 */
import type { SimulationProjection } from '../../types/simulation.types'
import { useDashboardStore } from '../../../../store/dashboardStore'
import './SimulationDeltas.css'

interface SimulationDeltasProps {
  projection: SimulationProjection
}

const DEWA_RATE  = 0.32   // AED/kWh blended
const CO2_FACTOR = 0.45   // kg CO₂/kWh UAE grid

// Fallback hourly energy when backend offline (345 kW hotel HVAC × 1 hr)
const MOCK_BASE = { energy: 345 }

// ─── Single ticker ────────────────────────────────────────────────────────────

function Ticker({
  label,
  currentVal,
  simVal,
  unit,
  pct,
  lowerIsBetter,
  precision = 1,
}: {
  label:         string
  currentVal:    number   // what will happen without rec (next hr)
  simVal:        number   // what will happen with rec applied (next hr)
  unit:          string
  pct:           number   // % change
  lowerIsBetter: boolean
  precision?:    number
}) {
  const neutral  = Math.abs(pct) < 0.5
  const good     = lowerIsBetter ? pct < 0 : pct > 0
  const sentCls  = neutral ? 'sdelta-neutral' : good ? 'sdelta-good' : 'sdelta-bad'
  const arrow    = pct < 0 ? '↓' : '↑'
  const sign     = pct < 0 ? '−' : '+'
  const absDiff  = Math.abs(simVal - currentVal)

  return (
    <div className="sdelta-ticker">
      <div className="sdelta-ticker-label">{label}</div>
      <div className="sdelta-ticker-value">
        {simVal.toFixed(precision)}
        <span className="sdelta-ticker-unit">&nbsp;{unit}</span>
      </div>
      <div className={`sdelta-ticker-delta ${sentCls}`}>
        {neutral ? (
          <span className="sdelta-neutral-text">no change projected</span>
        ) : (
          <>
            <span className="sdelta-arrow">{arrow}</span>
            <span className="sdelta-pct-text">{Math.abs(pct).toFixed(0)}%</span>
            <span className="sdelta-abs-text">
              &nbsp;{sign}{absDiff.toFixed(precision)}&nbsp;{unit}
            </span>
          </>
        )}
      </div>
      <div className="sdelta-ticker-baseline">
        vs {currentVal.toFixed(precision)} {unit} baseline
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function SimulationDeltas({ projection }: SimulationDeltasProps) {
  const kpis = useDashboardStore((s) => s.snapshot?.kpis)

  // Treat snapshot kpis as current hourly rate
  const baseKwh = kpis?.energy_kwh ?? MOCK_BASE.energy

  const { energy, co2 } = projection.kpiDeltas

  // Forecasted next-hour values with recommendation applied
  const simKwh  = baseKwh  * (1 + energy / 100)
  const simCost = simKwh   * DEWA_RATE
  const simCO2  = simKwh   * CO2_FACTOR

  // Baseline next-hour values (no intervention)
  const baseCost = baseKwh * DEWA_RATE
  const baseCO2  = baseKwh * CO2_FACTOR

  // CO₂ pct change (use the co2 delta from projection, which can differ from energy delta)
  const co2Pct   = co2   // direct pct delta from projection

  return (
    <div className="sdelta-root">
      <div className="sdelta-header">
        <span className="sdelta-badge">▶ SIM</span>
        <span className="sdelta-title">{projection.label}</span>
        <span className="sdelta-window">next 1 hr</span>
      </div>
      <div className="sdelta-tickers">
        <Ticker
          label="ENERGY"
          currentVal={baseKwh}
          simVal={simKwh}
          unit="kWh"
          pct={energy}
          lowerIsBetter
        />
        <div className="sdelta-divider" />
        <Ticker
          label="COST"
          currentVal={baseCost}
          simVal={simCost}
          unit="AED"
          pct={energy}
          lowerIsBetter
          precision={2}
        />
        <div className="sdelta-divider" />
        <Ticker
          label="CO₂"
          currentVal={baseCO2}
          simVal={simCO2}
          unit="kg"
          pct={co2Pct}
          lowerIsBetter
          precision={2}
        />
      </div>
    </div>
  )
}
