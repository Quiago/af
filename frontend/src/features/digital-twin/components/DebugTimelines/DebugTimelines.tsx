/**
 * DebugTimelines — 1-hour forecast charts for simulation mode.
 *
 * Shows:
 *  - Last 30 min of history (dim solid line)
 *  - Next 60 min baseline forecast (what happens WITHOUT the recommendation)  — PRIMARY only
 *  - Next 60 min simulated forecast (what happens WITH the recommendation applied)
 *
 * All data is pre-generated once when the projection mounts — static forecast,
 * no streaming. Range selection lets the engineer ask AI about specific windows.
 */
import { useEffect, useRef, useState, useMemo } from 'react'
import {
  createChart,
  LineSeries,
  TickMarkType,
  LineStyle,
  type IChartApi,
} from 'lightweight-charts'
import type { SimulationProjection, DebugMetricKey } from '../../types/simulation.types'
import './DebugTimelines.css'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Pt { time: number; value: number }

interface ForecastData {
  historyPts:  Pt[]
  baselinePts: Pt[]
  simPts:      Pt[]
}

interface KpiDeltas { energy: number; co2: number; comfort: number }

// ─── Constants ────────────────────────────────────────────────────────────────

const HIST_STEPS = 6    // 30 min history  (6 × 5-min)
const FORE_STEPS = 12   // 60 min forecast (12 × 5-min)
const STEP_S     = 300  // 5 minutes in seconds
const LAMBDA     = 0.00038  // ~74% toward target at T=60 min

// Hotel floor AHU: 22 kW fan motor; guestroom setpoint 22 °C; unoccupied CO₂ ~430 ppm
const BASE: Record<DebugMetricKey, { base: number; amp: number; noise: number }> = {
  zone_temp: { base: 22.0, amp: 0.20, noise: 0.04 },
  zone_co2:  { base: 430,  amp: 22,   noise: 4    },
  fan_power: { base: 22000, amp: 1200, noise: 180  },
}

// ─── Forecast generation ──────────────────────────────────────────────────────

/** How much the metric changes by end of the 60-min simulated window */
function simTargetOffset(key: DebugMetricKey, kpiDeltas: KpiDeltas): number {
  const { base } = BASE[key]
  switch (key) {
    case 'zone_temp':
      // Energy-saving recs raise cooling SP → zone warms slightly
      return kpiDeltas.energy < 0 ? +1.6 : -0.8
    case 'zone_co2':
      // Positive co2 delta → less ventilation → CO₂ rises; negative → CO₂ falls
      return kpiDeltas.co2 > 0 ? +24 : -18
    case 'fan_power':
      // Energy savings map directly to fan-power reduction (% of base)
      return base * (kpiDeltas.energy / 100)   // e.g., −47% → −2 632 W
  }
}

function generateForecast(key: DebugMetricKey, kpiDeltas: KpiDeltas): ForecastData {
  const now = Math.floor(Date.now() / 1000)
  const { base, amp, noise } = BASE[key]

  // Deterministic LCG — unique seed per metric so charts look different
  const SEED: Record<DebugMetricKey, number> = {
    zone_temp: 0x4B654D4C,
    zone_co2:  0x436F3232,
    fan_power: 0x46616E50,
  }
  let rng = SEED[key]
  function rand(): number {
    rng = (Math.imul(rng, 1664525) + 1013904223) | 0
    return ((rng >>> 0) / 0xffffffff - 0.5) * 2
  }

  // History: 30 min before now
  const historyPts: Pt[] = []
  for (let i = 0; i < HIST_STEPS; i++) {
    const t   = now - (HIST_STEPS - i) * STEP_S
    const osc = amp * Math.sin((i / HIST_STEPS) * Math.PI * 1.6) * 0.4
    historyPts.push({ time: t, value: Math.max(0, base + osc + rand() * noise) })
  }

  const startVal     = historyPts[historyPts.length - 1].value
  const targetOffset = simTargetOffset(key, kpiDeltas)
  const targetVal    = startVal + targetOffset

  // Baseline: natural building dynamics, no intervention
  const baselinePts: Pt[] = []
  for (let i = 1; i <= FORE_STEPS; i++) {
    const t   = now + i * STEP_S
    const osc = amp * Math.sin(((HIST_STEPS + i) / (HIST_STEPS + FORE_STEPS)) * Math.PI * 1.6) * 0.4
    baselinePts.push({ time: t, value: Math.max(0, base + osc + rand() * noise * 0.5) })
  }

  // Simulated: exponential ramp from startVal → targetVal
  const simPts: Pt[] = []
  for (let i = 1; i <= FORE_STEPS; i++) {
    const t    = now + i * STEP_S
    const ramp = 1 - Math.exp(-LAMBDA * (i * STEP_S))
    const v    = startVal + (targetVal - startVal) * ramp
    simPts.push({ time: t, value: Math.max(0, v + rand() * noise * 0.2) })
  }

  return { historyPts, baselinePts, simPts }
}

// ─── Chart options ────────────────────────────────────────────────────────────

function chartOptions() {
  return {
    autoSize: true,
    layout: {
      background:      { color: 'transparent' },
      textColor:       '#6D8196',
      attributionLogo: false,
    },
    grid: {
      vertLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
      horzLines: { color: 'rgba(255,255,255,0.04)', style: LineStyle.Dotted },
    },
    crosshair: {
      vertLine: { color: 'rgba(110,130,150,0.40)', width: 1, style: LineStyle.Dashed },
      horzLine: { color: 'rgba(110,130,150,0.40)', width: 1, style: LineStyle.Dashed },
    },
    timeScale: {
      borderColor:    'rgba(191,205,220,0.14)',
      timeVisible:    true,
      secondsVisible: false,
      tickMarkFormatter: (time: number, type: TickMarkType, locale: string) => {
        const d = new Date(time * 1000)
        if (type === TickMarkType.DayOfMonth)
          return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
        return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
      },
    },
    rightPriceScale: { visible: true, borderColor: 'rgba(191,205,220,0.14)' },
    leftPriceScale:  { visible: false },
    handleScroll: true,
    handleScale:  true,
  }
}

// ─── Single forecast chart ────────────────────────────────────────────────────

interface SingleChartProps {
  metricKey:  DebugMetricKey
  label:      string
  unit:       string
  color:      string
  isPrimary:  boolean
  kpiDeltas:  KpiDeltas
}

function SingleDebugChart({ metricKey, label, unit, color, isPrimary, kpiDeltas }: SingleChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)

  // Range-pick state: refs for inside the chart event handler, state for render
  const pickStepRef   = useRef<'start' | 'end' | null>(null)
  const rangeStartRef = useRef<number | null>(null)
  const [pickStep, setPickStep]           = useState<'start' | 'end' | null>(null)
  const [selectedRange, setSelectedRange] = useState<{ start: number; end: number } | null>(null)

  // Generate forecast data once per mount (projection is stable while mounted)
  const { historyPts, baselinePts, simPts } = useMemo(
    () => generateForecast(metricKey, kpiDeltas),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  )

  const precision  = metricKey === 'fan_power' ? 0 : 1
  const endSimVal  = simPts[simPts.length - 1]?.value ?? null
  const endBasVal  = baselinePts[baselinePts.length - 1]?.value ?? null
  const deltaVal   = isPrimary && endSimVal !== null && endBasVal !== null ? endSimVal - endBasVal : null
  const deltaStr   = deltaVal !== null
    ? `${deltaVal > 0 ? '+' : ''}${deltaVal.toFixed(precision)} ${unit}`
    : null

  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, chartOptions())
    chartRef.current = chart

    // 1 — History (dim, solid)
    const histS = chart.addSeries(LineSeries, {
      color:            'rgba(110,130,150,0.45)',
      lineWidth:        1,
      lastValueVisible: false,
      priceLineVisible: false,
    })
    histS.setData(historyPts.map((p) => ({ time: p.time as unknown as string, value: p.value })))

    // 2 — Baseline forecast (dashed muted) — primary chart only
    if (isPrimary) {
      const baseS = chart.addSeries(LineSeries, {
        color:            'rgba(140,155,170,0.50)',
        lineWidth:        1,
        lineStyle:        LineStyle.Dashed,
        lastValueVisible: false,
        priceLineVisible: false,
      })
      baseS.setData(baselinePts.map((p) => ({ time: p.time as unknown as string, value: p.value })))
    }

    // 3 — Simulated forecast (solid, color)
    const simS = chart.addSeries(LineSeries, {
      color,
      lineWidth:        2,
      lastValueVisible: true,
      priceLineVisible: false,
    })
    simS.setData(simPts.map((p) => ({ time: p.time as unknown as string, value: p.value })))

    chart.timeScale().fitContent()

    // Range selection via chart clicks
    chart.subscribeClick((param) => {
      if (!param.time || !pickStepRef.current) return
      const t = param.time as unknown as number
      if (pickStepRef.current === 'start') {
        rangeStartRef.current = t
        pickStepRef.current   = 'end'
        setPickStep('end')
      } else if (pickStepRef.current === 'end' && rangeStartRef.current !== null) {
        const start = Math.min(rangeStartRef.current, t)
        const end   = Math.max(rangeStartRef.current, t)
        pickStepRef.current   = null
        rangeStartRef.current = null
        setPickStep(null)
        setSelectedRange({ start, end })
      }
    })

    return () => {
      chart.remove()
      chartRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function startRangePick() {
    setSelectedRange(null)
    rangeStartRef.current = null
    pickStepRef.current   = 'start'
    setPickStep('start')
  }

  function cancelRange() {
    pickStepRef.current   = null
    rangeStartRef.current = null
    setPickStep(null)
    setSelectedRange(null)
  }

  function handleAskAI() {
    if (!selectedRange) return
    const fmt = (t: number) =>
      new Date(t * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const msg = [
      `[Forecast analysis · ${label}]`,
      `Time range: ${fmt(selectedRange.start)} → ${fmt(selectedRange.end)}.`,
      isPrimary && endBasVal !== null && endSimVal !== null
        ? `Baseline end: ${endBasVal.toFixed(precision)} ${unit}. Simulated end: ${endSimVal.toFixed(precision)} ${unit}.`
        : `Simulated end: ${endSimVal?.toFixed(precision) ?? '—'} ${unit}.`,
      `What does this segment tell us about the recommendation impact?`,
    ].filter(Boolean).join(' ')
    window.dispatchEvent(new CustomEvent('inaia:ask', { detail: { message: msg } }))
    cancelRange()
  }

  return (
    <div className={`dbt-chart-block ${isPrimary ? 'dbt-chart-block--primary' : ''}`}>
      {/* Header */}
      <div className="dbt-chart-header">
        <div className="dbt-chart-meta">
          {isPrimary && <span className="dbt-primary-badge">FORECAST</span>}
          <span className="dbt-chart-label" style={{ color }}>{label}</span>
        </div>
        <div className="dbt-chart-right">
          {endSimVal !== null && (
            <span className="dbt-sim-val" style={{ color }}>
              {endSimVal.toFixed(precision)}&nbsp;{unit}
              {deltaStr && (
                <span className={`dbt-delta ${(deltaVal ?? 0) < 0 ? 'dbt-delta--down' : 'dbt-delta--up'}`}>
                  &nbsp;{deltaStr}
                </span>
              )}
            </span>
          )}

          {selectedRange ? (
            <>
              <button className="dbt-ask-btn" onClick={handleAskAI}>Ask AI →</button>
              <button className="dbt-range-cancel" onClick={cancelRange} title="Clear range">✕</button>
            </>
          ) : pickStep !== null ? (
            <button className="dbt-range-btn dbt-range-btn--picking" onClick={cancelRange}>
              {pickStep === 'start' ? '▷ click start' : '▶ click end'}
            </button>
          ) : (
            <button className="dbt-range-btn" onClick={startRangePick} title="Select a time range for AI analysis">
              ◫ Range
            </button>
          )}
        </div>
      </div>

      {/* Legend — primary chart only */}
      {isPrimary && (
        <div className="dbt-legend">
          <span className="dbt-leg dbt-leg--history">━ History</span>
          <span className="dbt-leg dbt-leg--baseline">╌ Baseline</span>
          <span className="dbt-leg dbt-leg--sim" style={{ color }}>━ Simulated</span>
        </div>
      )}

      {/* Chart canvas */}
      <div className="dbt-chart-canvas" ref={containerRef} />
    </div>
  )
}

// ─── Chart definition list ────────────────────────────────────────────────────

interface ChartDef {
  metricKey: DebugMetricKey
  label:     string
  unit:      string
  color:     string
}

// ─── Main component ───────────────────────────────────────────────────────────

interface DebugTimelinesProps {
  projection: SimulationProjection
}

export function DebugTimelines({ projection }: DebugTimelinesProps) {
  const { primaryMetric, kpiDeltas } = projection
  const affectedZoneId = primaryMetric.zoneId ?? 'cor'

  const primary: ChartDef = {
    metricKey: primaryMetric.key,
    label:     primaryMetric.label,
    unit:      primaryMetric.unit,
    color:     '#658D88',
  }

  const secondaryDefs: ChartDef[] = [
    primaryMetric.key !== 'zone_temp'
      ? { metricKey: 'zone_temp', label: `Zone Temp — ${affectedZoneId.toUpperCase()}`, unit: '°C',  color: '#8EA7C1' }
      : null,
    primaryMetric.key !== 'zone_co2'
      ? { metricKey: 'zone_co2',  label: `Zone CO₂ — ${affectedZoneId.toUpperCase()}`,  unit: 'ppm', color: '#C29048' }
      : null,
    { metricKey: 'fan_power', label: 'Fan Power — AHU-1', unit: 'W', color: '#9A93C9' },
  ].filter(Boolean) as ChartDef[]

  const allDefs = [primary, ...secondaryDefs]

  return (
    <div className="dbt-root">
      <div className="dbt-header">
        <span className="dbt-header-title">1-HOUR FORECAST</span>
        <span className="dbt-header-sub">{projection.label} · next 60 min</span>
      </div>
      <div className="dbt-scroll">
        {allDefs.map((def, i) => {
          const { metricKey, ...rest } = def
          return (
            <SingleDebugChart
              key={`${metricKey}-${projection.recommendationId}`}
              metricKey={metricKey}
              {...rest}
              isPrimary={i === 0}
              kpiDeltas={kpiDeltas}
            />
          )
        })}
      </div>
    </div>
  )
}
