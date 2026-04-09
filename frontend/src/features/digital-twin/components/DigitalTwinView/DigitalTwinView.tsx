import { useState } from 'react'
import { BuildingViewer } from '../BuildingViewer/BuildingViewer'
import { FloorPlanViewer } from '../FloorPlanViewer/FloorPlanViewer'
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

export function DigitalTwinView() {
  const [viewMode,    setViewMode]    = useState<'3d' | 'plan'>('3d')
  const [hoveredZone, setHoveredZone] = useState<string | null>(null)

  const { liveData } = useDigitalTwinData()
  const simulationProjection = useDashboardStore((s) => s.simulationProjection)
  const kpis                 = useDashboardStore((s) => s.snapshot?.kpis)

  const CO2_FACTOR = 0.45  // kg CO₂/kWh UAE grid
  const kpiEnergy  = kpis?.energy_kwh  != null ? `${kpis.energy_kwh.toFixed(1)} kWh`  : '—'
  const kpiCost    = kpis?.cost_total   != null ? `${kpis.cost_total.toFixed(2)} AED`   : '—'
  const kpiCO2     = kpis?.energy_kwh  != null ? `${(kpis.energy_kwh * CO2_FACTOR).toFixed(2)} kg` : '—'
  const activeFloor     = useDashboardStore((s) => s.selectedFloor)
  const setFloor        = useDashboardStore((s) => s.setSelectedFloor)
  // Zone selection lives in the store so 3D clicks surface in the watchlist
  const highlightedZone = useDashboardStore((s) => s.selectedZoneId)
  const setHighlight    = useDashboardStore((s) => s.selectZone)

  return (
    <div className={styles.view}>

      {/* ── Canvas area ───────────────────────────────────────────── */}
      <div className={styles.canvasWrapper}>

        {/* 3D exterior view */}
        <div className={`${styles.viewLayer} ${viewMode === '3d' ? styles.visible : ''}`}>
          <BuildingViewer
            viewMode={viewMode}
            liveData={liveData}
            highlightedZone={highlightedZone}
            hoveredZone={hoveredZone}
            onHoverZone={setHoveredZone}
          />
        </div>

        {/* Floor plan view */}
        <div className={`${styles.viewLayer} ${viewMode === 'plan' ? styles.visible : ''}`}>
          <FloorPlanViewer active={viewMode === 'plan'} />
        </div>

        {/* HUD top-left — climate data normally; delta impact when simulating */}
        <div className={styles.hud}>
          {simulationProjection ? (
            // ── Simulation mode: show projected KPI deltas ────────────────
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
            // ── Normal mode: live KPI values ─────────────────────────────
            <>
              <span className={styles.hudBadge}>
                <span className={styles.hudKey}>ENERGY</span>
                {kpiEnergy}
              </span>
              <span className={styles.hudBadge}>
                <span className={styles.hudKey}>COST</span>
                {kpiCost}
              </span>
              <span className={styles.hudBadge}>
                <span className={styles.hudKey}>CO₂</span>
                {kpiCO2}
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
          >
            3D
          </button>
          <button
            data-testid="view-toggle-plan"
            aria-pressed={viewMode === 'plan'}
            className={`${styles.toggleBtn} ${viewMode === 'plan' ? styles.toggleActive : ''}`}
            onClick={() => setViewMode('plan')}
          >
            Floor plan
          </button>
        </div>

        {/* Floor selector — always visible; lets users drill into any floor */}
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
      </div>
    </div>
  )
}
