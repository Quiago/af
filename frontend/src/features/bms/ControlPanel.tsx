/**
 * ControlPanel — BMS operator setpoint overrides.
 *
 * UNIT CONVENTIONS (critical — matches BOPTEST API spec):
 *   Temperature setpoints → sent in KELVIN  (user sees °C, we convert)
 *   Fan speed / dampers / valves → sent as 0.0–1.0  (user sees %, we divide by 100)
 *   Pressures → sent in Pa  (user sees Pa as-is)
 *
 * Control point names per BOPTEST IO spec (case-sensitive):
 *   AHU:   hvac_oveAhu_TSupSet_u, hvac_oveAhu_dpSet_u, hvac_oveAhu_yFan_u,
 *          hvac_oveAhu_yOA_u, hvac_oveAhu_yCoo_u, hvac_oveAhu_yHea_u
 *   Zone setpoints: hvac_oveZonSupCor_TZonCooSet_u  (capital zone: Cor, Nor, Sou, Eas, Wes)
 *   Zone actuators: hvac_oveZonActCor_yDam_u, hvac_oveZonActCor_yReaHea_u
 */
import { useState, useRef, useCallback, useEffect } from 'react'
import type { BmsSnapshot } from './bms.types'
import { postControl, cToK, pctToFrac } from './bms.utils'
import './ControlPanel.css'

const ZONES = ['cor', 'nor', 'sou', 'eas', 'wes'] as const
type ZoneId = typeof ZONES[number]

const ZONE_LABELS: Record<ZoneId, string> = {
  cor: 'Core', nor: 'North', sou: 'South', eas: 'East', wes: 'West',
}

// ── Generic slider control ────────────────────────────────────────────────────

interface SliderDef {
  label: string
  pointName: string
  min: number; max: number; step: number
  displayUnit: string
  defaultValue: number
  autoLabel?: string
  /** Convert display value → BOPTEST native value before sending */
  toNative: (displayVal: number) => number
}

interface SliderControlProps extends SliderDef {
  onSend: (pointName: string, nativeValue: number, activate: number) => void
}

function SliderControl({
  label, pointName, min, max, step, displayUnit,
  defaultValue, autoLabel = 'AUTO', toNative, onSend,
}: SliderControlProps) {
  const [isManual, setIsManual] = useState(false)
  const [value, setValue]       = useState(defaultValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggle = useCallback(() => {
    const next = !isManual
    setIsManual(next)
    if (!next) {
      // Deactivate override — send activate=0
      onSend(pointName, toNative(value), 0)
    }
  }, [isManual, onSend, pointName, toNative, value])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const v = parseFloat(e.target.value)
    setValue(v)
    if (!isManual) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      onSend(pointName, toNative(v), 1)
    }, 500)
  }, [isManual, onSend, pointName, toNative])

  useEffect(() => () => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
  }, [])

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className={`cp-slider-row ${isManual ? 'cp-slider-row--active' : ''}`}>
      <div className="cp-slider-header">
        <span className="cp-slider-label">{label}</span>
        <button
          className={`cp-mode-btn ${isManual ? 'cp-mode-btn--manual' : ''}`}
          onClick={handleToggle}
        >
          {isManual ? 'MANUAL' : autoLabel}
        </button>
      </div>
      <div className="cp-slider-body">
        <span className="cp-slider-bound">{min}{displayUnit}</span>
        <div className="cp-slider-track">
          <div className="cp-slider-fill" style={{ width: `${pct}%` }} />
          <input type="range" min={min} max={max} step={step} value={value}
            disabled={!isManual} onChange={handleChange} className="cp-range" />
        </div>
        <span className="cp-slider-bound">{max}{displayUnit}</span>
        <span className={`cp-slider-val ${isManual ? 'cp-slider-val--live' : ''}`}>
          {value}{displayUnit}
        </span>
      </div>
    </div>
  )
}

// ── Zone accordion ────────────────────────────────────────────────────────────

function ZoneAccordion({
  zoneId, onSend,
}: { zoneId: ZoneId; onSend: (p: string, v: number, a: number) => void }) {
  const [open, setOpen] = useState(false)
  // BOPTEST requires capital zone ID: Cor, Nor, Sou, Eas, Wes
  const capId = zoneId.charAt(0).toUpperCase() + zoneId.slice(1)

  const zoneSliders: SliderDef[] = [
    {
      label: 'Cooling Setpoint',
      pointName: `hvac_oveZonSup${capId}_TZonCooSet_u`,
      min: 20, max: 30, step: 0.5, displayUnit: '°C',
      defaultValue: 24,
      // BOPTEST spec: [K] min=285.15 max=313.15
      toNative: cToK,
    },
    {
      label: 'Heating Setpoint',
      pointName: `hvac_oveZonSup${capId}_TZonHeaSet_u`,
      min: 15, max: 24, step: 0.5, displayUnit: '°C',
      defaultValue: 20,
      toNative: cToK,
    },
    {
      label: 'Damper Position',
      pointName: `hvac_oveZonAct${capId}_yDam_u`,
      min: 0, max: 100, step: 1, displayUnit: '%',
      defaultValue: 50,
      // BOPTEST spec: [1] min=0.0 max=1.0
      toNative: pctToFrac,
    },
    {
      label: 'Reheat Signal',
      pointName: `hvac_oveZonAct${capId}_yReaHea_u`,
      min: 0, max: 100, step: 1, displayUnit: '%',
      defaultValue: 0,
      toNative: pctToFrac,
    },
  ]

  return (
    <div className="cp-zone-accordion">
      <button
        className={`cp-zone-header ${open ? 'cp-zone-header--open' : ''}`}
        onClick={() => setOpen((p) => !p)}
      >
        <span className="cp-zone-icon">{open ? '▾' : '▸'}</span>
        <span className="cp-zone-name">Zone {ZONE_LABELS[zoneId]}</span>
        <span className="cp-zone-id">{zoneId.toUpperCase()}</span>
      </button>
      {open && (
        <div className="cp-zone-body">
          {zoneSliders.map((def) => (
            <SliderControl key={def.pointName} {...def} onSend={onSend} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Consumption impact box ────────────────────────────────────────────────────

function ImpactBox({ baseline, current }: { baseline: number; current: number }) {
  const delta    = current - baseline
  const deltaPct = baseline > 0 ? (delta / baseline) * 100 : 0
  const saving   = delta < 0
  const sign     = delta >= 0 ? '+' : ''
  const curW     = baseline > 0 ? Math.min(200, Math.round((current / baseline) * 100)) : 100

  return (
    <div className="cp-impact">
      <div className="cp-impact-title">CONSUMPTION IMPACT</div>
      <div className="cp-impact-row">
        <div className="cp-impact-col">
          <div className="cp-impact-label">BASELINE</div>
          <div className="cp-impact-kw">{baseline.toFixed(1)} kW</div>
        </div>
        <div className="cp-impact-arrow">→</div>
        <div className="cp-impact-col">
          <div className="cp-impact-label">CURRENT</div>
          <div className="cp-impact-kw" style={{ color: saving ? '#22AA44' : '#EF4444' }}>
            {current.toFixed(1)} kW
          </div>
        </div>
        <div className="cp-impact-delta" style={{ color: saving ? '#22AA44' : '#EF4444' }}>
          {sign}{delta.toFixed(1)} kW
          <br />
          <span className="cp-impact-pct">{sign}{deltaPct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="cp-impact-bars">
        {[['Base', 100, '#4B5563'], ['Now', Math.min(100, curW), saving ? '#22AA44' : '#EF4444']].map(
          ([lbl, w, bg]) => (
            <div className="cp-impact-bar-row" key={String(lbl)}>
              <span className="cp-impact-bar-label">{lbl}</span>
              <div className="cp-impact-bar-track">
                <div className="cp-impact-bar-fill"
                  style={{ width: `${w}%`, background: String(bg) }} />
              </div>
            </div>
          )
        )}
      </div>
    </div>
  )
}

// ── Root control panel ────────────────────────────────────────────────────────

interface ControlPanelProps {
  snapshot: BmsSnapshot
  onControlSent: () => void
}

export function ControlPanel({ snapshot, onControlSent }: ControlPanelProps) {
  const baselineRef = useRef<number | null>(null)

  useEffect(() => {
    if (baselineRef.current === null && snapshot.total_elec_kw > 0) {
      baselineRef.current = snapshot.total_elec_kw
    }
  }, [snapshot.total_elec_kw])

  const handleSend = useCallback(
    async (pointName: string, nativeValue: number, activate: number) => {
      try {
        await postControl({ point_name: pointName, value: nativeValue, activate })
        onControlSent()
      } catch (err) {
        console.error('BMS control failed:', err)
      }
    },
    [onControlSent],
  )

  const baseline = baselineRef.current ?? snapshot.total_elec_kw

  // AHU slider definitions with correct BOPTEST units
  const ahuSliders: SliderDef[] = [
    {
      label: 'Supply Air Temp Setpoint',
      pointName: 'hvac_oveAhu_TSupSet_u',
      min: 10, max: 18, step: 0.5, displayUnit: '°C',
      defaultValue: 12,
      // BOPTEST spec: [K] min=285.15 (≈12°C) max=313.15 (≈40°C)
      toNative: cToK,
    },
    {
      label: 'Duct Static Pressure Setpoint',
      pointName: 'hvac_oveAhu_dpSet_u',
      min: 50, max: 410, step: 10, displayUnit: ' Pa',
      defaultValue: 248,
      // BOPTEST spec: [Pa] min=50 max=410 — no conversion
      toNative: (v) => v,
    },
    {
      label: 'Fan Speed Override',
      pointName: 'hvac_oveAhu_yFan_u',
      min: 0, max: 100, step: 1, displayUnit: '%',
      defaultValue: 60,
      // BOPTEST spec: [1] min=0.0 max=1.0
      toNative: pctToFrac,
    },
    {
      label: 'OA Damper Position',
      pointName: 'hvac_oveAhu_yOA_u',
      min: 0, max: 100, step: 1, displayUnit: '%',
      defaultValue: 30,
      toNative: pctToFrac,
    },
    {
      label: 'Cooling Coil Valve',
      pointName: 'hvac_oveAhu_yCoo_u',
      min: 0, max: 100, step: 1, displayUnit: '%',
      defaultValue: 0,
      toNative: pctToFrac,
    },
    {
      label: 'Heating Coil Valve',
      pointName: 'hvac_oveAhu_yHea_u',
      min: 0, max: 100, step: 1, displayUnit: '%',
      defaultValue: 0,
      toNative: pctToFrac,
    },
  ]

  return (
    <div className="cp-panel">
      <div className="cp-panel-title">BMS CONTROL OVERRIDE</div>

      <div className="cp-section-label">AHU</div>
      {ahuSliders.map((def) => (
        <SliderControl key={def.pointName} {...def} onSend={handleSend} />
      ))}

      <div className="cp-section-label" style={{ marginTop: 'var(--space-4)' }}>
        ZONE OVERRIDES
      </div>
      <div className="cp-unit-note">
        Temps sent in K · Signals as 0–1 fraction
      </div>
      {ZONES.map((z) => (
        <ZoneAccordion key={z} zoneId={z} onSend={handleSend} />
      ))}

      <ImpactBox baseline={baseline} current={snapshot.total_elec_kw} />
    </div>
  )
}
