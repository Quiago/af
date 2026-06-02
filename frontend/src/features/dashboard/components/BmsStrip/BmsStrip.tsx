import { Fragment } from 'react'
import type { SimulationProjection } from '../../../digital-twin/types/simulation.types'
import type { ZoneState } from '../../../digital-twin/types/digitalTwin.types'
import './BmsStrip.css'

// ─── Compact BMS / HMI strip ──────────────────────────────────────────────────
// A small operator-style HMI of the FAHU serving the affected zone, mirroring a
// real BMS faceplate (outside air → filter → cooling coil → fan → supply, plus
// the live setpoint move). Data is derived from the recommendation + zone state.

interface Props {
  projection: SimulationProjection
  zone: ZoneState | null
}

interface Stage { k: string; v: string; t: string; tone: 'hot' | 'ok' | 'cool' | 'on' }

function Val({ k, v }: { k: string; v: string }) {
  return (
    <div className="bms-val">
      <span className="bms-val-k">{k}</span>
      <span className="bms-val-v">{v}</span>
    </div>
  )
}

export function BmsStrip({ projection, zone }: Props) {
  const rec       = projection.recSnapshot
  const rat       = zone ? zone.temperature : 22.0               // return air ≈ zone air temp
  const sat       = 13.6                                          // cooling supply-air temp
  const fanPct    = 72
  const damperPct = zone ? Math.round(zone.damperPosition * 100) : 40
  const spRec     = parseFloat(rec.recVal) || 23
  // CHW valve opens more the further the room is above the (recommended) setpoint
  const chwPct    = Math.max(6, Math.min(100, Math.round((rat - spRec + 2.5) * 22)))
  const oaTemp    = 38.0

  const stages: Stage[] = [
    { k: 'OA',   v: `${oaTemp.toFixed(1)}°C`, t: 'Outside Air',  tone: 'hot'  },
    { k: 'FILT', v: 'OK',                     t: 'Filter',       tone: 'ok'   },
    { k: 'COIL', v: `CHW ${chwPct}%`,         t: 'Cooling Coil', tone: 'cool' },
    { k: 'FAN',  v: `${fanPct}%`,             t: 'Supply Fan',   tone: 'on'   },
    { k: 'SA',   v: `${sat.toFixed(1)}°C`,    t: 'Supply Air',   tone: 'cool' },
  ]

  return (
    <div className="bms">
      <div className="bms-head">
        <span className="bms-unit">FAHU · {rec.zone}</span>
        <span className="bms-status bms-status--ok">● RUNNING</span>
        <span className="bms-loc">25hours Hotel Dubai · BMS</span>
      </div>

      {/* Air-handling schematic strip */}
      <div className="bms-flow">
        {stages.map((s, i) => (
          <Fragment key={s.k}>
            <div className={`bms-stage bms-stage--${s.tone}`}>
              <div className="bms-stage-k">{s.k}</div>
              <div className="bms-stage-v">{s.v}</div>
              <div className="bms-stage-t">{s.t}</div>
            </div>
            {i < stages.length - 1 && <span className="bms-arrow">›</span>}
          </Fragment>
        ))}
      </div>

      {/* Setpoint move + key live values */}
      <div className="bms-foot">
        <div className="bms-sp">
          <span className="bms-sp-lbl">COOLING SP</span>
          <span className="bms-sp-cur">{rec.currentVal}</span>
          <span className="bms-sp-arrow">→</span>
          <span className="bms-sp-rec">{rec.recVal}</span>
        </div>
        <div className="bms-vals">
          <Val k="RETURN" v={`${rat.toFixed(1)}°C`} />
          <Val k="OA DAMPER" v={`${damperPct}%`} />
          <Val k="ZONE CO₂" v={zone ? `${zone.co2.toFixed(0)} ppm` : '—'} />
        </div>
      </div>
    </div>
  )
}
