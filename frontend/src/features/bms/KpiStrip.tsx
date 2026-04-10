import type { BmsSnapshot, KpiHistory } from './bms.types'
import {
  fmtKw,
  fmtLph,
  fmtPue,
  powerStatusColor,
  pueStatusColor,
  co2StatusColor,
  buildSparklinePath,
} from './bms.utils'
import './KpiStrip.css'

interface KpiCardProps {
  label: string
  value: string
  unit: string
  color: string
  sparkData: number[]
}

const SPARK_W = 80
const SPARK_H = 28

function KpiCard({ label, value, unit, color, sparkData }: KpiCardProps) {
  const pts = buildSparklinePath(sparkData, SPARK_W, SPARK_H)
  return (
    <div className="bms-kpi-card">
      <div className="bms-kpi-label">{label}</div>
      <div className="bms-kpi-row">
        <span className="bms-kpi-value" style={{ color }}>
          {value}
        </span>
        <span className="bms-kpi-unit">{unit}</span>
      </div>
      {pts && (
        <svg
          className="bms-kpi-spark"
          viewBox={`0 0 ${SPARK_W} ${SPARK_H}`}
          preserveAspectRatio="none"
        >
          <polyline
            points={pts}
            fill="none"
            stroke={color}
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />
        </svg>
      )}
    </div>
  )
}

interface KpiStripProps {
  snapshot: BmsSnapshot
  history: KpiHistory
}

export function KpiStrip({ snapshot, history }: KpiStripProps) {
  const elecColor   = powerStatusColor(snapshot.total_elec_kw)
  const co2Color    = co2StatusColor(snapshot.co2_kg_per_hr)
  const pueColor    = pueStatusColor(snapshot.pue)

  return (
    <div className="bms-kpi-strip">
      <KpiCard
        label="Total Power"
        value={snapshot.total_elec_kw.toFixed(1)}
        unit="kW"
        color={elecColor}
        sparkData={history.total_elec_kw}
      />
      <KpiCard
        label="Cooling Load"
        value={snapshot.cooling_load_kw.toFixed(1)}
        unit="kW"
        color="#3B82F6"
        sparkData={history.cooling_load_kw}
      />
      <KpiCard
        label="Heating Load"
        value={snapshot.heating_load_kw.toFixed(1)}
        unit="kW"
        color="#EF4444"
        sparkData={history.heating_load_kw}
      />
      <KpiCard
        label="Carbon Rate"
        value={snapshot.co2_kg_per_hr.toFixed(1)}
        unit="kg CO₂/hr"
        color={co2Color}
        sparkData={history.co2_kg_per_hr}
      />
      <KpiCard
        label="CHW Flow"
        value={fmtLph(snapshot.chw_flow_lph)}
        unit=""
        color="#60A5FA"
        sparkData={history.chw_flow_lph}
      />
      <KpiCard
        label="PUE"
        value={fmtPue(snapshot.pue)}
        unit=""
        color={pueColor}
        sparkData={history.pue}
      />
    </div>
  )
}
