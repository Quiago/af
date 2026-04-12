import type { BmsSnapshot, KpiHistory } from './bms.types'
import {
  kToC, fmtKw, fmtRH, fmtWind, simTimeLabel,
  powerStatusColor, chillerCopColor, hpCopColor, co2StatusColor,
  buildSparklinePath,
} from './bms.utils'
import './KpiStrip.css'

const SPARK_W = 80
const SPARK_H = 26

interface KpiCardProps {
  label: string
  value: string
  sub?: string
  color: string
  sparkData?: number[]
}

function KpiCard({ label, value, sub, color, sparkData }: KpiCardProps) {
  const pts = sparkData ? buildSparklinePath(sparkData, SPARK_W, SPARK_H) : ''
  return (
    <div className="bms-kpi-card">
      <div className="bms-kpi-label">{label}</div>
      <div className="bms-kpi-row">
        <span className="bms-kpi-value" style={{ color }}>
          {value}
        </span>
        {sub && <span className="bms-kpi-unit">{sub}</span>}
      </div>
      {pts && (
        <svg className="bms-kpi-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
        </svg>
      )}
    </div>
  )
}

interface WeatherCardProps {
  snap: BmsSnapshot
  oaHistory: number[]
}

function WeatherCard({ snap, oaHistory }: WeatherCardProps) {
  const oaC  = kToC(snap.weaSta_reaWeaTDryBul_y)
  const wbC  = kToC(snap.weaSta_reaWeaTWetBul_y)
  const solar = snap.weaSta_reaWeaHGloHor_y
  const wind  = snap.weaSta_reaWeaWinSpe_y
  const rh    = snap.weaSta_reaWeaRelHum_y

  // Color based on OA vs mixed air — when OA < return → economizer potential
  const oaColor = oaC < 13 ? '#22AA44' : oaC < 24 ? '#60A5FA' : '#EF4444'
  const pts = buildSparklinePath(oaHistory, SPARK_W, SPARK_H)

  return (
    <div className="bms-kpi-card bms-kpi-card--weather">
      <div className="bms-kpi-label">OUTSIDE AIR  ·  CHICAGO</div>
      <div className="bms-kpi-row">
        <span className="bms-kpi-value" style={{ color: oaColor }}>
          {oaC.toFixed(1)}°C
        </span>
        <span className="bms-kpi-unit">DB / {wbC.toFixed(1)}°C WB</span>
      </div>
      <div className="bms-kpi-weather-row">
        <span>{fmtRH(rh)}</span>
        <span>{fmtWind(wind)}</span>
        <span>{Math.round(solar)} W/m²</span>
      </div>
      {pts && (
        <svg className="bms-kpi-spark" viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} preserveAspectRatio="none">
          <polyline points={pts} fill="none" stroke={oaColor} strokeWidth="1.5"
            strokeLinecap="round" strokeLinejoin="round" opacity="0.65" />
        </svg>
      )}
    </div>
  )
}

interface KpiStripProps {
  snapshot: BmsSnapshot
  history: KpiHistory
}

export function KpiStrip({ snapshot: s, history: h }: KpiStripProps) {
  return (
    <div className="bms-kpi-strip">
      {/* Sim time clock */}
      <div className="bms-kpi-clock">
        <div className="bms-kpi-label">SIM TIME</div>
        <div className="bms-kpi-clock-val">{simTimeLabel(s.sim_time_s)}</div>
        <div className="bms-kpi-label" style={{ marginTop: 3 }}>BOPTEST · Chicago VAV</div>
      </div>

      <KpiCard
        label="TOTAL POWER"
        value={s.total_elec_kw.toFixed(1)}
        sub="kW"
        color={powerStatusColor(s.total_elec_kw)}
        sparkData={h.total_elec_kw}
      />
      <KpiCard
        label="COOLING LOAD"
        value={s.cooling_load_kw.toFixed(1)}
        sub="kW"
        color="#3B82F6"
        sparkData={h.cooling_load_kw}
      />
      <KpiCard
        label="HEATING LOAD"
        value={s.heating_load_kw.toFixed(1)}
        sub="kW"
        color="#EF4444"
        sparkData={h.heating_load_kw}
      />
      <KpiCard
        label="CHILLER COP"
        value={s.chiller_cop > 0 ? s.chiller_cop.toFixed(2) : '—'}
        sub={s.chiller_cop > 0 ? '(York YCAL)' : 'OFF'}
        color={chillerCopColor(s.chiller_cop)}
        sparkData={h.chiller_cop}
      />
      <KpiCard
        label="HP COP"
        value={s.hp_cop > 0 ? s.hp_cop.toFixed(2) : '—'}
        sub={s.hp_cop > 0 ? '(0.3×Carnot)' : 'OFF'}
        color={hpCopColor(s.hp_cop)}
        sparkData={h.hp_cop}
      />
      <KpiCard
        label="CARBON RATE"
        value={s.co2_kg_per_hr.toFixed(1)}
        sub="kg CO₂/hr"
        color={co2StatusColor(s.co2_kg_per_hr)}
        sparkData={h.co2_kg_per_hr}
      />
      <WeatherCard snap={s} oaHistory={h.oa_temp_c} />
    </div>
  )
}
