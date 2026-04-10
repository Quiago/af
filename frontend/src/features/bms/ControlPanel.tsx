import { useState, useRef, useCallback, useEffect } from 'react'
import type { BmsSnapshot } from './bms.types'
import { postControl } from './bms.utils'
import './ControlPanel.css'

const ZONES = ['cor', 'nor', 'sou', 'eas', 'wes'] as const
type ZoneId = typeof ZONES[number]

const ZONE_LABELS: Record<ZoneId, string> = {
  cor: 'Core', nor: 'North', sou: 'South', eas: 'East', wes: 'West',
}

// ── Generic slider control ────────────────────────────────────────────────────

interface SliderControlProps {
  label: string
  pointName: string
  min: number
  max: number
  step: number
  unit: string
  defaultValue: number
  autoLabel?: string
  onSend: (pointName: string, value: number, activate: number) => void
}

function SliderControl({
  label, pointName, min, max, step, unit, defaultValue, autoLabel = 'AUTO', onSend,
}: SliderControlProps) {
  const [isManual, setIsManual] = useState(false)
  const [value, setValue] = useState(defaultValue)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleToggle = useCallback(() => {
    const next = !isManual
    setIsManual(next)
    if (!next) {
      // Switching back to AUTO — deactivate override
      onSend(pointName, value, 0)
    }
  }, [isManual, onSend, pointName, value])

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = parseFloat(e.target.value)
      setValue(v)
      if (!isManual) return
      if (debounceRef.current) clearTimeout(debounceRef.current)
      debounceRef.current = setTimeout(() => {
        onSend(pointName, v, 1)
      }, 500)
    },
    [isManual, onSend, pointName],
  )

  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
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
        <span className="cp-slider-bound">{min}{unit}</span>
        <div className="cp-slider-track">
          <div
            className="cp-slider-fill"
            style={{ width: `${pct}%` }}
          />
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            disabled={!isManual}
            onChange={handleChange}
            className="cp-range"
          />
        </div>
        <span className="cp-slider-bound">{max}{unit}</span>
        <span className={`cp-slider-val ${isManual ? 'cp-slider-val--live' : ''}`}>
          {value}{unit}
        </span>
      </div>
    </div>
  )
}

// ── Zone accordion ────────────────────────────────────────────────────────────

interface ZoneAccordionProps {
  zoneId: ZoneId
  onSend: (pointName: string, value: number, activate: number) => void
}

function ZoneAccordion({ zoneId, onSend }: ZoneAccordionProps) {
  const [open, setOpen] = useState(false)
  const capId = zoneId.charAt(0).toUpperCase() + zoneId.slice(1)

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
          <SliderControl
            label="Cooling Setpoint"
            pointName={`hvac_oveZonSup${capId}_TZonCooSet_u`}
            min={20} max={30} step={0.5} unit="°C"
            defaultValue={24}
            onSend={onSend}
          />
          <SliderControl
            label="Heating Setpoint"
            pointName={`hvac_oveZonSup${capId}_TZonHeaSet_u`}
            min={15} max={24} step={0.5} unit="°C"
            defaultValue={20}
            onSend={onSend}
          />
          <SliderControl
            label="Damper Position"
            pointName={`hvac_oveZonAct${capId}_yDam_u`}
            min={0} max={100} step={1} unit="%"
            defaultValue={50}
            autoLabel="AUTO"
            onSend={onSend}
          />
          <SliderControl
            label="Reheat Signal"
            pointName={`hvac_oveZonAct${capId}_yReaHea_u`}
            min={0} max={100} step={1} unit="%"
            defaultValue={0}
            autoLabel="AUTO"
            onSend={onSend}
          />
        </div>
      )}
    </div>
  )
}

// ── Consumption impact box ────────────────────────────────────────────────────

interface ImpactBoxProps {
  baseline: number
  current: number
}

function ImpactBox({ baseline, current }: ImpactBoxProps) {
  const delta    = current - baseline
  const deltaPct = baseline > 0 ? (delta / baseline) * 100 : 0
  const saving   = delta < 0
  const sign     = delta >= 0 ? '+' : ''

  const baseW = 100
  const curW  = baseline > 0 ? Math.min(200, Math.round((current / baseline) * 100)) : 100

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
          <div
            className="cp-impact-kw"
            style={{ color: saving ? '#22AA44' : '#EF4444' }}
          >
            {current.toFixed(1)} kW
          </div>
        </div>
        <div
          className="cp-impact-delta"
          style={{ color: saving ? '#22AA44' : '#EF4444' }}
        >
          {sign}{delta.toFixed(1)} kW
          <br />
          <span className="cp-impact-pct">{sign}{deltaPct.toFixed(1)}%</span>
        </div>
      </div>
      <div className="cp-impact-bars">
        <div className="cp-impact-bar-row">
          <span className="cp-impact-bar-label">Base</span>
          <div className="cp-impact-bar-track">
            <div
              className="cp-impact-bar-fill"
              style={{ width: `${baseW}%`, background: '#4B5563' }}
            />
          </div>
        </div>
        <div className="cp-impact-bar-row">
          <span className="cp-impact-bar-label">Now</span>
          <div className="cp-impact-bar-track">
            <div
              className="cp-impact-bar-fill"
              style={{
                width: `${Math.min(100, curW)}%`,
                background: saving ? '#22AA44' : '#EF4444',
              }}
            />
          </div>
        </div>
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

  // Capture baseline on first mount
  useEffect(() => {
    if (baselineRef.current === null && snapshot.total_elec_kw > 0) {
      baselineRef.current = snapshot.total_elec_kw
    }
  }, [snapshot.total_elec_kw])

  const handleSend = useCallback(
    async (pointName: string, value: number, activate: number) => {
      try {
        await postControl({ point_name: pointName, value, activate })
        onControlSent()
      } catch (err) {
        console.error('BMS control failed:', err)
      }
    },
    [onControlSent],
  )

  const baseline = baselineRef.current ?? snapshot.total_elec_kw

  return (
    <div className="cp-panel">
      <div className="cp-panel-title">BMS CONTROL</div>

      {/* ── AHU section ────────────────────────────────────── */}
      <div className="cp-section-label">AHU</div>

      <SliderControl
        label="Supply Air Temp Setpoint"
        pointName="hvac_oveAhu_TSupSet_u"
        min={10} max={18} step={0.5} unit="°C"
        defaultValue={12}
        onSend={handleSend}
      />
      <SliderControl
        label="Duct Static Pressure Setpoint"
        pointName="hvac_oveAhu_dpSet_u"
        min={50} max={410} step={10} unit=" Pa"
        defaultValue={248}
        onSend={handleSend}
      />
      <SliderControl
        label="Fan Speed Override"
        pointName="hvac_oveAhu_yFan_u"
        min={0} max={100} step={1} unit="%"
        defaultValue={60}
        autoLabel="AUTO"
        onSend={handleSend}
      />
      <SliderControl
        label="OA Damper Position"
        pointName="hvac_oveAhu_yOA_u"
        min={0} max={100} step={1} unit="%"
        defaultValue={30}
        autoLabel="AUTO"
        onSend={handleSend}
      />

      {/* ── Zone section ───────────────────────────────────── */}
      <div className="cp-section-label" style={{ marginTop: 'var(--space-4)' }}>
        ZONE OVERRIDES
      </div>
      {ZONES.map((z) => (
        <ZoneAccordion key={z} zoneId={z} onSend={handleSend} />
      ))}

      {/* ── Consumption impact ─────────────────────────────── */}
      <ImpactBox baseline={baseline} current={snapshot.total_elec_kw} />
    </div>
  )
}
