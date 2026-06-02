import { DashboardLayout } from './components/DashboardLayout/DashboardLayout'
import { DashboardSimulationLayout } from './components/DashboardSimulationLayout/DashboardSimulationLayout'
import { RecommendationsPanel } from './components/RecommendationsPanel/RecommendationsPanel'
import { DigitalTwinView } from '../digital-twin/components/DigitalTwinView/DigitalTwinView'
import { BuildingViewer } from '../digital-twin/components/BuildingViewer/BuildingViewer'
import { SimulationDeltas } from '../digital-twin/components/SimulationDeltas/SimulationDeltas'
import { DebugTimelines } from '../digital-twin/components/DebugTimelines/DebugTimelines'
import { BmsStrip } from './components/BmsStrip/BmsStrip'
import { useDashboardStore } from '../../store/dashboardStore'
import { useDigitalTwinData } from '../digital-twin/hooks/useDigitalTwinData'
import type { SimulationProjection, SimZoneId } from '../digital-twin/types/simulation.types'
import type { ZoneState } from '../digital-twin/types/digitalTwin.types'
import './DashboardPage.css'

// ─── Compact rec card shown inside the simulation twin column ─────────────────

function SimRecCard({ projection }: { projection: SimulationProjection }) {
  const setSimulationProjection = useDashboardStore((s) => s.setSimulationProjection)
  const applyRecommendation     = useDashboardStore((s) => s.applyRecommendation)
  const { recSnapshot: rec, recommendationId } = projection

  const confClass = rec.confidence >= 85 ? 'src-conf--high'
                  : rec.confidence >= 70 ? 'src-conf--mid'
                  : 'src-conf--low'

  return (
    <div className="sim-rec-card">
      {/* Zone + badges */}
      <div className="src-top">
        <div className="src-zone-row">
          <span className="src-zone">{rec.zone}</span>
          <div className="src-badges">
            <span className={`src-conf ${confClass}`}>{rec.confidence}%</span>
            <span className={`src-sev ${rec.severity === 'high' ? 'src-sev--high' : 'src-sev--med'}`}>
              {rec.severity === 'high' ? 'HIGH' : 'MED'}
            </span>
          </div>
        </div>
        <p className="src-reason">{rec.reason}</p>
      </div>

      {/* Current → Recommended */}
      <div className="src-change">
        <div className="src-block">
          <div className="src-lbl">{rec.currentLabel}</div>
          <div className="src-val src-val--cur">{rec.currentVal}</div>
          <div className="src-unit">{rec.unit}</div>
        </div>
        <span className="src-arrow">→</span>
        <div className="src-block">
          <div className="src-lbl">{rec.recLabel}</div>
          <div className="src-val src-val--rec">{rec.recVal}</div>
          <div className="src-unit">{rec.unit}</div>
        </div>
      </div>

      <div className="src-impact">{rec.impact}</div>

      {/* Actions */}
      <div className="src-actions">
        <button
          className="src-btn src-btn--apply"
          onClick={() => applyRecommendation(recommendationId, Object.keys(projection.zoneOverrides)[0] as SimZoneId, projection.kpiDeltas)}
        >
          ✓ Apply
        </button>
        <button
          className="src-btn src-btn--back"
          onClick={() => setSimulationProjection(null)}
        >
          ← Back
        </button>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function DashboardPage() {
  const simulationProjection    = useDashboardStore((s) => s.simulationProjection)
  const { liveData } = useDigitalTwinData()

  const affectedZoneId = simulationProjection
    ? (Object.keys(simulationProjection.zoneOverrides)[0] ?? null)
    : null

  if (simulationProjection) {
    return (
      <DashboardSimulationLayout
        twinPanel={
          <>
            {/* Mini 3D viewer */}
            <div className="sim-mini-twin">
              <BuildingViewer
                viewMode="3d"
                liveData={liveData}
                highlightedZone={affectedZoneId}
                hoveredZone={null}
                onHoverZone={() => {}}
              />
            </div>

            {/* Current recommendation (compact) */}
            <SimRecCard projection={simulationProjection} />

            {/* KPI delta tickers */}
            <div className="sim-deltas-wrap">
              <SimulationDeltas projection={simulationProjection} />
            </div>
          </>
        }
        timelinesPanel={
          <div className="sim-right-stack">
            <BmsStrip
              projection={simulationProjection}
              zone={affectedZoneId ? (liveData.zones[affectedZoneId as ZoneState['id']] ?? null) : null}
            />
            <div className="sim-charts">
              <DebugTimelines projection={simulationProjection} />
            </div>
          </div>
        }
      />
    )
  }

  return (
    <DashboardLayout
      leftPanel={<DigitalTwinView />}
      rightPanel={<RecommendationsPanel />}
    />
  )
}
