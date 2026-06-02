import { useState, useEffect, useRef, useCallback } from 'react'
import { BuildingViewer } from '../BuildingViewer/BuildingViewer'
import { ActionTimeline } from '../ActionTimeline/ActionTimeline'
import { useDigitalTwinData } from '../../hooks/useDigitalTwinData'
import { useDashboardStore } from '../../../../store/dashboardStore'
import { computePMV, pmvCategory } from '../../lib/comfort'
import { computeZoneTemps } from '../../lib/thermalModel'
import styles from './DigitalTwinView.module.css'

function fmtDelta(pct: number, lowerIsBetter: boolean) {
  const good  = lowerIsBetter ? pct < 0 : pct > 0
  const arrow = pct < 0 ? '↓' : '↑'
  return { arrow, abs: Math.abs(pct).toFixed(0), good }
}

const CAT_COLOR: Record<string, string> = {
  Cold: '#4c8bff', Cool: '#37b6c6', Comfort: '#37c98a', Warm: '#f0a030', Hot: '#ef4d4d',
}

// Daily building-load profile (0..1) — low overnight, climbs through the day,
// peaks mid-afternoon (cooling + occupancy). Drives the live energy/CO₂/cost.
function loadFactor(h: number): number {
  const peak = Math.exp(-Math.pow((h - 15) / 5.2, 2))
  return 0.34 + 0.66 * Math.max(0, Math.min(1, peak))
}
const ENERGY_PEAK = 345   // kWh/h at the afternoon peak (Dubai hotel scale)

// ── Prominent top metric card ─────────────────────────────────────────────────
function MetricCard({
  label, value, unit, accent, delta, lowerIsBetter = true,
}: {
  label: string; value: string; unit: string; accent?: string
  delta?: number; lowerIsBetter?: boolean
}) {
  return (
    <div className={styles.metricCard}>
      <div className={styles.metricLabel}>{label}</div>
      <div className={styles.metricValue} style={accent ? { color: accent } : undefined}>
        {value}<span className={styles.metricUnit}>{unit}</span>
      </div>
      {delta != null && delta !== 0 && (() => {
        const { arrow, abs, good } = fmtDelta(delta, lowerIsBetter)
        return (
          <div className={`${styles.metricDelta} ${good ? styles.metricGood : styles.metricBad}`}>
            {arrow} {abs}%
          </div>
        )
      })()}
    </div>
  )
}

const FLOORS = [
  { id: 0, label: 'F1' },
  { id: 1, label: 'F2', boptest: true },
  { id: 2, label: 'F3' },
]

// ─── Numeric spinner ──────────────────────────────────────────────────────────

interface SpinnerProps {
  label:    string
  value:    number
  unit:     string
  step?:    number
  min:      number
  max:      number
  onChange: (updater: (prev: number) => number) => void
}

function NumericSpinner({ label, value, unit, step = 1, min, max, onChange }: SpinnerProps) {
  const timerRef    = useRef<ReturnType<typeof setTimeout>  | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const clearAll = useCallback(() => {
    if (timerRef.current)    clearTimeout(timerRef.current)
    if (intervalRef.current) clearInterval(intervalRef.current)
    timerRef.current = null
    intervalRef.current = null
  }, [])

  useEffect(() => clearAll, [clearAll])

  const press = (delta: number) => {
    onChange((v) => Math.max(min, Math.min(max, v + delta)))
    timerRef.current = setTimeout(() => {
      intervalRef.current = setInterval(() => {
        onChange((v) => Math.max(min, Math.min(max, v + delta)))
      }, 100)
    }, 400)
  }

  return (
    <div className={styles.spinner}>
      <div className={styles.spinnerLabel}>{label}</div>
      <div className={styles.spinnerBody}>
        <button
          className={styles.spinnerBtn}
          onMouseDown={() => press(step)}
          onMouseUp={clearAll}
          onMouseLeave={clearAll}
          aria-label={`Increase ${label}`}
        >▲</button>
        <span className={styles.spinnerVal}>{value}{unit}</span>
        <button
          className={styles.spinnerBtn}
          onMouseDown={() => press(-step)}
          onMouseUp={clearAll}
          onMouseLeave={clearAll}
          aria-label={`Decrease ${label}`}
        >▼</button>
      </div>
    </div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function DigitalTwinView() {
  const [viewMode,    setViewMode]    = useState<'3d' | 'plan'>('3d')
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  // ── Time simulation ──────────────────────────────────────────────────────
  const [simHour, setSimHour] = useState<number>(() => {
    const n = new Date(); return n.getHours() + n.getMinutes() / 60
  })
  const [isLiveTime, setIsLiveTime] = useState(true)

  useEffect(() => {
    if (!isLiveTime) return
    const tick = () => {
      const n = new Date(); setSimHour(n.getHours() + n.getMinutes() / 60)
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [isLiveTime])

  const handleSlider = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSimHour(parseFloat(e.target.value))
    setIsLiveTime(false)
  }
  const resetToNow = () => {
    const n = new Date(); setSimHour(n.getHours() + n.getMinutes() / 60)
    setIsLiveTime(true)
  }

  const h   = Math.floor(simHour)
  const m   = Math.floor((simHour % 1) * 60)
  const tod = h >= 6 && h < 20 ? '☀' : '☾'
  const timeLabel = `${tod} ${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
  const sliderPct = (simHour / 24) * 100

  // ── Weather ──────────────────────────────────────────────────────────────
  const [extTemp, setExtTemp] = useState(32)

  // ── Live data ────────────────────────────────────────────────────────────
  const { liveData } = useDigitalTwinData()
  const cfd          = useDashboardStore((s) => s.cfdCinematic)

  // ── Live metrics — follow a realistic daily flow (energy/CO₂/cost climb
  //    through the day & with ext-temp; comfort is steadier). Move as the user
  //    scrubs the time slider or as the day advances. ────────────────────────
  const CO2_FACTOR  = 0.45   // kg CO₂ per kWh
  const DEWA_TARIFF = 0.44   // AED per kWh
  const extFactor   = 1 + (extTemp - 30) * 0.02
  const energyBase  = ENERGY_PEAK * loadFactor(simHour) * extFactor

  // Average thermal comfort (PMV) — same dynamic model as the 3D labels
  const dynT    = computeZoneTemps(extTemp, simHour, null)
  const zoneArr = Object.values(liveData.zones)
  const pmvBase = zoneArr.length
    ? zoneArr.reduce((s, z) => s + computePMV(dynT[z.id], z.humidity ?? 50), 0) / zoneArr.length
    : 0

  // While the CFD animation plays (a recommendation was just applied), ramp the
  // metrics toward their post-change values and show a delta on each card.
  const applying = cfd != null
  const [applyProg, setApplyProg] = useState(0)
  useEffect(() => {
    if (!applying) { setApplyProg(0); return }
    let raf = 0
    const start = performance.now()
    const tick = () => {
      const t = Math.min(1, (performance.now() - start) / 2400)
      setApplyProg(1 - Math.pow(1 - t, 3))      // easeOutCubic
      if (t < 1) raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [applying])

  const dE = cfd?.kpiDeltas.energy ?? 0
  const dC = cfd?.kpiDeltas.co2 ?? 0
  const dK = cfd?.kpiDeltas.comfort ?? 0
  const energyNow = energyBase * (1 + (dE / 100) * applyProg)
  const co2Now    = energyNow * CO2_FACTOR
  const costNow   = energyNow * DEWA_TARIFF
  // Applying a warming setpoint nudges PMV up (a touch less comfortable)
  const pmvNow    = pmvBase + (dK !== 0 ? 0.35 : 0) * applyProg

  const energyVal = energyNow.toFixed(0)
  const co2Val    = co2Now.toFixed(0)
  const costVal   = costNow.toFixed(0)
  const pmvCat    = pmvCategory(pmvNow)
  const pmvStr    = `${pmvNow >= 0 ? '+' : ''}${pmvNow.toFixed(1)}`

  const activeFloor     = useDashboardStore((s) => s.selectedFloor)
  const setFloor        = useDashboardStore((s) => s.setSelectedFloor)
  const highlightedZone = useDashboardStore((s) => s.selectedZoneId)
  const setHighlight    = useDashboardStore((s) => s.selectZone)

  return (
    <div className={styles.view}>

      {/* ── Canvas area ───────────────────────────────────────────── */}
      <div className={styles.canvasWrapper}>

        {/* Building viewer */}
        <div className={`${styles.viewLayer} ${styles.visible}`}>
          <BuildingViewer
            viewMode={viewMode}
            liveData={liveData}
            highlightedZone={highlightedZone}
            hoveredZone={hoveredZone}
            onHoverZone={setHoveredZone}
            simHour={simHour}
            extTemp={extTemp}
          />
        </div>

        {/* HUD top-left — prominent live metrics (deltas only while applying) */}
        <div className={styles.metrics}>
          <MetricCard
            label="ENERGY" value={energyVal} unit=" kWh"
            delta={applying ? dE : undefined} lowerIsBetter
          />
          <MetricCard
            label="CO₂" value={co2Val} unit=" kg"
            delta={applying ? dC : undefined} lowerIsBetter
          />
          <MetricCard
            label="COST" value={costVal} unit=" AED"
            delta={applying ? dE : undefined} lowerIsBetter
          />
          <MetricCard
            label="COMFORT" value={pmvStr} unit={` PMV · ${pmvCat}`}
            accent={CAT_COLOR[pmvCat]}
            delta={applying ? dK : undefined} lowerIsBetter={false}
          />
          {applying
            ? <span className={`${styles.metricTag} ${styles.metricSim}`}>▶ APPLYING</span>
            : liveData.isLiveData && <span className={`${styles.metricTag} ${styles.metricLive}`}>● LIVE</span>}
        </div>

        {/* View toggle top-right */}
        <div className={styles.viewToggle} role="group" aria-label="View mode">
          <button
            data-testid="view-toggle-3d"
            aria-pressed={viewMode === '3d'}
            className={`${styles.toggleBtn} ${viewMode === '3d' ? styles.toggleActive : ''}`}
            onClick={() => setViewMode('3d')}
          >3D</button>
          <button
            data-testid="view-toggle-plan"
            aria-pressed={viewMode === 'plan'}
            className={`${styles.toggleBtn} ${viewMode === 'plan' ? styles.toggleActive : ''}`}
            onClick={() => setViewMode('plan')}
          >Floor plan</button>
        </div>

        {/* Floor selector */}
        <div className={styles.floorBar} role="group" aria-label="Floor selector">
          {FLOORS.map((f) => (
            <button
              key={f.id}
              data-testid={`floor-btn-${f.label.toLowerCase()}`}
              aria-label={`Floor ${f.label}`}
              aria-pressed={activeFloor === f.id}
              className={`${styles.floorBtn} ${activeFloor === f.id ? styles.floorActive : ''}`}
              onClick={() => { setFloor(f.id); setHighlight(null) }}
            >
              {f.label}{f.boptest ? ' ✦' : ''}
            </button>
          ))}
        </div>

        {/* Action timeline — 3D mode only */}
        {viewMode === '3d' && <ActionTimeline />}

        {/* ── Bottom control bar ─────────────────────────────────── */}
        <div className={styles.controlBar}>

          {/* Time section */}
          <div className={styles.timeSection}>
            <span className={styles.timeDisplay}>{timeLabel}</span>
            <span className={styles.timeRangeLabel}>6 AM</span>
            <input
              type="range"
              min="0"
              max="24"
              step="0.0833"
              value={simHour}
              onChange={handleSlider}
              className={styles.timeSlider}
              style={{ '--slider-pct': `${sliderPct}%` } as React.CSSProperties}
              aria-label="Time of day"
            />
            <span className={styles.timeRangeLabel}>6 PM</span>
            <button
              className={`${styles.nowBtn} ${isLiveTime ? styles.nowBtnActive : ''}`}
              onClick={resetToNow}
              title="Reset to current time"
            >NOW</button>
          </div>

          <div className={styles.ctrlSep} />

          {/* Weather section */}
          <div className={styles.weatherSection}>
            <NumericSpinner
              label="EXT TEMP"
              value={extTemp}
              unit="°C"
              step={1}
              min={-10}
              max={55}
              onChange={setExtTemp}
            />
          </div>

        </div>

      </div>
    </div>
  )
}
