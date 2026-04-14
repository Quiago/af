import { useState, useEffect, useRef, useCallback } from 'react'
import { BuildingViewer } from '../BuildingViewer/BuildingViewer'
import { ActionTimeline } from '../ActionTimeline/ActionTimeline'
import { useDigitalTwinData } from '../../hooks/useDigitalTwinData'
import { useDashboardStore } from '../../../../store/dashboardStore'
import styles from './DigitalTwinView.module.css'

function fmtDelta(pct: number, lowerIsBetter: boolean) {
  const good  = lowerIsBetter ? pct < 0 : pct > 0
  const arrow = pct < 0 ? '↓' : '↑'
  return { arrow, abs: Math.abs(pct).toFixed(0), good }
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
  const [extTemp,   setExtTemp]   = useState(32)
  const [humidity,  setHumidity]  = useState(65)
  const [windSpeed, setWindSpeed] = useState(12)

  // ── Live data ────────────────────────────────────────────────────────────
  const { liveData } = useDigitalTwinData()
  const simulationProjection = useDashboardStore((s) => s.simulationProjection)
  const kpis                 = useDashboardStore((s) => s.snapshot?.kpis)

  const CO2_FACTOR = 0.45
  const kpiEnergy  = kpis?.energy_kwh  != null ? `${kpis.energy_kwh.toFixed(1)} kWh`  : '—'
  const kpiCost    = kpis?.cost_total   != null ? `${kpis.cost_total.toFixed(2)} AED`   : '—'
  const kpiCO2     = kpis?.energy_kwh  != null ? `${(kpis.energy_kwh * CO2_FACTOR).toFixed(2)} kg` : '—'

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
            humidity={humidity}
            windSpeed={windSpeed}
          />
        </div>

        {/* HUD top-left */}
        <div className={styles.hud}>
          {simulationProjection ? (
            <>
              {simulationProjection.kpiDeltas.energy !== 0 && (() => {
                const { arrow, abs, good } = fmtDelta(simulationProjection.kpiDeltas.energy, true)
                return (
                  <span className={`${styles.hudBadge} ${good ? styles.hudDeltaGood : styles.hudDeltaBad}`}>
                    <span className={styles.hudKey}>ENERGY</span>
                    {arrow} {abs}%
                  </span>
                )
              })()}
              {simulationProjection.kpiDeltas.co2 !== 0 && (() => {
                const { arrow, abs, good } = fmtDelta(simulationProjection.kpiDeltas.co2, true)
                return (
                  <span className={`${styles.hudBadge} ${good ? styles.hudDeltaGood : styles.hudDeltaBad}`}>
                    <span className={styles.hudKey}>CO₂</span>
                    {arrow} {abs}%
                  </span>
                )
              })()}
              {simulationProjection.kpiDeltas.comfort !== 0 && (() => {
                const { arrow, abs, good } = fmtDelta(simulationProjection.kpiDeltas.comfort, false)
                return (
                  <span className={`${styles.hudBadge} ${good ? styles.hudDeltaGood : styles.hudDeltaBad}`}>
                    <span className={styles.hudKey}>COMFORT</span>
                    {arrow} {abs}%
                  </span>
                )
              })()}
              <span className={`${styles.hudBadge} ${styles.hudSimulate}`}>▶ SIM</span>
            </>
          ) : (
            <>
              <span className={styles.hudBadge}>
                <span className={styles.hudKey}>ENERGY</span>{kpiEnergy}
              </span>
              <span className={styles.hudBadge}>
                <span className={styles.hudKey}>COST</span>{kpiCost}
              </span>
              <span className={styles.hudBadge}>
                <span className={styles.hudKey}>CO₂</span>{kpiCO2}
              </span>
              {liveData.isLiveData && (
                <span className={`${styles.hudBadge} ${styles.hudLive}`}>LIVE</span>
              )}
            </>
          )}
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
            <NumericSpinner
              label="HUMIDITY"
              value={humidity}
              unit="%"
              step={1}
              min={0}
              max={100}
              onChange={setHumidity}
            />
            <NumericSpinner
              label="WIND"
              value={windSpeed}
              unit=" km/h"
              step={1}
              min={0}
              max={120}
              onChange={setWindSpeed}
            />
          </div>

        </div>

      </div>
    </div>
  )
}
