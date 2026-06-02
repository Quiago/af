import { useState } from 'react'
import { useDashboardStore } from '../../../../store/dashboardStore'
import type { SimZoneId, ZoneProjectionOverride, PrimaryMetric } from '../../../digital-twin/types/simulation.types'
import './RecommendationsPanel.css'


// ─── Static recommendation data ──────────────────────────────────────────────

type Severity = 'high' | 'medium'

// Rejection reasons for FM feedback → model training
const REJECTION_REASONS = [
  'Not relevant now',
  'Comfort concern',
  'Maintenance scheduled',
  'Override needed',
  'Other',
] as const
type RejectionReason = typeof REJECTION_REASONS[number]

interface Recommendation {
  id: string
  zone: string
  severity: Severity
  confidence: number    // 0-100 — model confidence %
  reason: string
  currentLabel: string
  currentVal: string
  recLabel: string
  recVal: string
  unit: string
  impact: string
  zoneId: SimZoneId
  projectionOverride: ZoneProjectionOverride
  kpiDeltas: { energy: number; comfort: number; co2: number }
  primaryMetric: PrimaryMetric
}

// Recommendations are framed as cooling-setpoint moves — exactly what the
// platform's two models produce in practice: a temperature/occupancy forecast +
// an MPC that returns optimal zone setpoints. No direct actuator (damper)
// overrides, so each one is defensible to a facility manager / head of engineering.
const INITIAL_RECS: Recommendation[] = [
  {
    id: 'rec-1',
    zone: 'GUESTROOMS · W',
    severity: 'high',
    confidence: 88,
    reason: 'During the afternoon peak this zone is kept cooler than it needs to be. The comfort model shows it stays comfortable at 24°C, cutting peak-hour energy.',
    currentLabel: 'CURRENT',
    currentVal: '22.5°C',
    recLabel: 'RECOMMENDED',
    recVal: '24.0°C',
    unit: 'setpoint',
    impact: '↓ 61 kWh/day · AED 7,140/yr',
    zoneId: 'wes',
    projectionOverride: { temperature: 24.0 },
    kpiDeltas: { energy: -38, comfort: -4, co2: -10 },
    primaryMetric: { key: 'zone_temp', label: 'Peak setpoint — Guestrooms W', unit: '°C', zoneId: 'wes' },
  },
  {
    id: 'rec-2',
    zone: 'GUESTROOMS · S',
    severity: 'medium',
    confidence: 81,
    reason: 'Zone running 1.8°C below its comfort setpoint. The comfort model shows it stays comfortable at 23°C, so cooling can ease off.',
    currentLabel: 'CURRENT',
    currentVal: '21.0°C',
    recLabel: 'RECOMMENDED',
    recVal: '23.0°C',
    unit: 'setpoint',
    impact: '↓ 45 kWh/day · AED 5,256/yr',
    zoneId: 'sou',
    projectionOverride: { temperature: 23.0 },
    kpiDeltas: { energy: -31, comfort: -3, co2: -8 },
    primaryMetric: { key: 'zone_temp', label: 'Cooling SP — Guestrooms S', unit: '°C', zoneId: 'sou' },
  },
  {
    id: 'rec-3',
    zone: 'F&B LOUNGE',
    severity: 'medium',
    confidence: 76,
    reason: 'The lounge is empty overnight, so it does not need full cooling. Letting it drift to 25°C until morning saves energy with no impact on guests.',
    currentLabel: 'CURRENT',
    currentVal: '22.5°C',
    recLabel: 'RECOMMENDED',
    recVal: '25.0°C',
    unit: 'setpoint',
    impact: '↓ 33 kWh/day · AED 3,860/yr',
    zoneId: 'nor',
    projectionOverride: { temperature: 25.0 },
    kpiDeltas: { energy: -26, comfort: 0, co2: -7 },
    primaryMetric: { key: 'zone_temp', label: 'Night setback — F&B Lounge', unit: '°C', zoneId: 'nor' },
  },
]

// ─── Component ────────────────────────────────────────────────────────────────

export function RecommendationsPanel() {
  const setSimulationProjection = useDashboardStore((s) => s.setSimulationProjection)
  const applyRecommendation     = useDashboardStore((s) => s.applyRecommendation)
  const appliedRecIds           = useDashboardStore((s) => s.appliedRecIds)

  // simulatingId derived from store — survives layout swaps
  const simulationProjection = useDashboardStore((s) => s.simulationProjection)
  const simulatingId = simulationProjection?.recommendationId ?? null

  const [recs, setRecs] = useState<Recommendation[]>(INITIAL_RECS)
  // rejection flow: id → 'pending' | reason string
  const [rejecting, setRejecting] = useState<Record<string, string | null>>({})



  function handleSimulate(rec: Recommendation) {
    setSimulationProjection({
      recommendationId: rec.id,
      zoneOverrides: { [rec.zoneId]: rec.projectionOverride },
      kpiDeltas: rec.kpiDeltas,
      label: rec.zone,
      primaryMetric: rec.primaryMetric,
      recSnapshot: {
        zone:         rec.zone,
        severity:     rec.severity,
        confidence:   rec.confidence,
        reason:       rec.reason,
        currentLabel: rec.currentLabel,
        currentVal:   rec.currentVal,
        recLabel:     rec.recLabel,
        recVal:       rec.recVal,
        unit:         rec.unit,
        impact:       rec.impact,
      },
    })
  }

  function handleDiscard() {
    setSimulationProjection(null)
  }

  function handleApply(rec: Recommendation) {
    applyRecommendation(rec.id, rec.zoneId, rec.kpiDeltas)
  }

  // Step 1 — show rejection reason sheet
  function handleDeclineClick(id: string) {
    setRejecting((prev) => ({ ...prev, [id]: null }))   // null = "show sheet, no reason chosen yet"
  }

  // Step 2 — FM selected a reason, confirm and dismiss
  function handleDeclineConfirm(id: string, reason: RejectionReason) {
    console.info('[INAIA] Rejection feedback:', { id, reason })
    setRecs((prev) => prev.filter((r) => r.id !== id))
    setRejecting((prev) => { const n = { ...prev }; delete n[id]; return n })
    if (simulatingId === id) setSimulationProjection(null)
  }

  // Cancel rejection without dismissing
  function handleDeclineCancel(id: string) {
    setRejecting((prev) => { const n = { ...prev }; delete n[id]; return n })
  }

  const activeRecs  = recs.filter((r) => !appliedRecIds.has(r.id))
  const appliedRecs = recs.filter((r) =>  appliedRecIds.has(r.id))

  return (
    <div className="rec-panel">
      {/* Header */}
      <div className="rp-head">
        <span className="rp-title">RECOMMENDATIONS</span>
        {activeRecs.length > 0 && (
          <span className="rp-count">{activeRecs.length} action{activeRecs.length !== 1 ? 's' : ''}</span>
        )}
      </div>

      {/* Recommendation cards — grouped by building when simulating */}
      <div className="rec-list">
        {simulatingId ? (
          <>
            {/* Simulated section first — Apply/Discard immediately visible */}
            <div className="rec-group-header rec-group-header--sim">◈ Simulated</div>
            {activeRecs.filter((r) => r.id === simulatingId).map((rec) => (
              <RecCard
                key={rec.id}
                rec={rec}
                isSimulating={true}
                isRejecting={rec.id in rejecting}
                onSimulate={handleSimulate}
                onDiscard={handleDiscard}
                onApply={handleApply}
                onDeclineClick={handleDeclineClick}
                onDeclineConfirm={handleDeclineConfirm}
                onDeclineCancel={handleDeclineCancel}
              />
            ))}
            <div className="rec-group-header rec-group-header--live">◈ Pending</div>
            {activeRecs.filter((r) => r.id !== simulatingId).map((rec) => (
              <RecCard
                key={rec.id}
                rec={rec}
                isSimulating={false}
                isRejecting={rec.id in rejecting}
                onSimulate={handleSimulate}
                onDiscard={handleDiscard}
                onApply={handleApply}
                onDeclineClick={handleDeclineClick}
                onDeclineConfirm={handleDeclineConfirm}
                onDeclineCancel={handleDeclineCancel}
              />
            ))}
            {activeRecs.filter((r) => r.id !== simulatingId).length === 0 && (
              <div className="rec-empty-sub">No other pending actions</div>
            )}
          </>
        ) : (
          activeRecs.map((rec) => (
            <RecCard
              key={rec.id}
              rec={rec}
              isSimulating={false}
              isRejecting={rec.id in rejecting}
              onSimulate={handleSimulate}
              onDiscard={handleDiscard}
              onApply={handleApply}
              onDeclineClick={handleDeclineClick}
              onDeclineConfirm={handleDeclineConfirm}
              onDeclineCancel={handleDeclineCancel}
            />
          ))
        )}

        {appliedRecs.map((rec) => (
          <div key={rec.id} className="rec-card rec-card--applied">
            <div className="rec-top">
              <div className="rec-zone-row">
                <span className="rec-zone-name">{rec.zone}</span>
                <span className="rec-sev rec-sev--applied">✓ APPLIED</span>
              </div>
              <div className="rec-reason">{rec.reason}</div>
            </div>
          </div>
        ))}

        {recs.length === 0 && (
          <div className="rec-empty">No active recommendations</div>
        )}
      </div>
    </div>
  )
}

// ─── Sub-components ───────────────────────────────────────────────────────────


function RecCard({
  rec,
  isSimulating,
  isRejecting,
  onSimulate,
  onDiscard,
  onApply,
  onDeclineClick,
  onDeclineConfirm,
  onDeclineCancel,
}: {
  rec: Recommendation
  isSimulating: boolean
  isRejecting: boolean
  onSimulate: (rec: Recommendation) => void
  onDiscard: () => void
  onApply: (rec: Recommendation) => void
  onDeclineClick: (id: string) => void
  onDeclineConfirm: (id: string, reason: RejectionReason) => void
  onDeclineCancel: (id: string) => void
}) {
  const confClass = rec.confidence >= 85 ? 'conf-badge--high'
                  : rec.confidence >= 70 ? 'conf-badge--mid'
                  : 'conf-badge--low'

  return (
    <div className={`rec-card ${isSimulating ? 'rec-card--simulating' : ''}`}>
      <div className="rec-top">
        <div className="rec-zone-row">
          <span className="rec-zone-name">{rec.zone}</span>
          <div className="rec-badges">
            <span className={`conf-badge ${confClass}`}>{rec.confidence}%</span>
            <span className={`rec-sev ${rec.severity === 'high' ? 'rec-sev--high' : 'rec-sev--medium'}`}>
              {rec.severity === 'high' ? 'HIGH' : 'MED'}
            </span>
          </div>
        </div>
        <div className="rec-reason">{rec.reason}</div>
        <div className="rec-change">
          <div className="rc-block">
            <div className="rc-label">{rec.currentLabel}</div>
            <div className="rc-val rc-val--cur">{rec.currentVal}</div>
            <div className="rc-unit">{rec.unit}</div>
          </div>
          <div className="rc-arrow">→</div>
          <div className="rc-block">
            <div className="rc-label">{rec.recLabel}</div>
            <div className="rc-val rc-val--rec">{rec.recVal}</div>
            <div className="rc-unit">{rec.unit}</div>
          </div>
        </div>
        <div className="rc-impact">{rec.impact}</div>
      </div>

      {/* Rejection reason sheet */}
      {isRejecting && (
        <div className="rejection-sheet">
          <div className="rejection-title">Why are you declining?</div>
          <div className="rejection-options">
            {REJECTION_REASONS.map((r) => (
              <button
                key={r}
                className="rejection-option"
                onClick={() => onDeclineConfirm(rec.id, r)}
              >
                {r}
              </button>
            ))}
          </div>
          <button className="rejection-cancel" onClick={() => onDeclineCancel(rec.id)}>
            Cancel
          </button>
        </div>
      )}

      {!isRejecting && (
        <div className="rec-actions">
          {isSimulating ? (
            <>
              <button className="btn-apply" onClick={() => onApply(rec)}>✓ Apply</button>
              <button className="btn-exit-sim" onClick={onDiscard}>✕ Discard</button>
            </>
          ) : (
            <>
              <button className="btn-simulate" onClick={() => onSimulate(rec)}>▶ Simulate</button>
              <button className="btn-decline" onClick={() => onDeclineClick(rec.id)}>✕ Decline</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
