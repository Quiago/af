import { useEffect, useRef, useState } from 'react'
import {
  createChart,
  LineSeries,
  TickMarkType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { useDashboardStore } from '../../../../store/dashboardStore'
import { IS_MOCKED, generateComparisonData } from '../../mockData'
import type { ComparisonVariable } from '../../mockData'
import './ComparisonChart.css'

// ── Variable config ────────────────────────────────────────────────────────────

type VarMeta = { label: string; unit: string; seriesColor: string; savedLabel: string }

const VAR_META: Record<ComparisonVariable, VarMeta> = {
  energy: { label: 'Energy (kWh)', unit: 'kWh', seriesColor: '#00C896', savedLabel: '18.3% energy saved vs baseline' },
  cost:   { label: 'Cost (AED)',   unit: 'AED', seriesColor: '#6B9FFF', savedLabel: '21.4% cost saved vs baseline'   },
  co2:    { label: 'CO₂ (kg)',     unit: 'kg',  seriesColor: '#A78BFA', savedLabel: '18.3% emissions reduced vs baseline' },
}

// ── Component ──────────────────────────────────────────────────────────────────

export function ComparisonChart() {
  const timePreset = useDashboardStore((s) => s.timePreset)
  const [variable, setVariable] = useState<ComparisonVariable>('energy')

  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<IChartApi | null>(null)
  const baselineRef  = useRef<ISeriesApi<'Line'> | null>(null)
  const inaiaRef     = useRef<ISeriesApi<'Line'> | null>(null)

  const meta = VAR_META[variable]

  // ── Create chart once ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'transparent' },
        textColor: '#6B7E96',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.025)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(255,255,255,0.025)', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: 'rgba(0,200,150,0.4)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(0,200,150,0.4)', width: 1, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.06)',
        timeVisible: true,
        secondsVisible: false,
        tickMarkFormatter: (time: number, tickMarkType: TickMarkType, locale: string) => {
          const d = new Date(time * 1000)
          switch (tickMarkType) {
            case TickMarkType.Year:       return d.toLocaleDateString(locale, { year: 'numeric' })
            case TickMarkType.Month:      return d.toLocaleDateString(locale, { month: 'short' })
            case TickMarkType.DayOfMonth: return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
            default:                      return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
          }
        },
      },
      rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.06)' },
      handleScroll: true,
      handleScale:  true,
    })

    chartRef.current = chart

    baselineRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.32)',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: 'Baseline',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    inaiaRef.current = chart.addSeries(LineSeries, {
      color: VAR_META.energy.seriesColor,
      lineWidth: 2,
      title: 'INAIA',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current   = null
      baselineRef.current = null
      inaiaRef.current    = null
    }
  }, [])

  // ── Reload data when preset or variable changes ──────────────────────────────
  useEffect(() => {
    if (!baselineRef.current || !inaiaRef.current) return

    // Update INAIA series color for this variable
    inaiaRef.current.applyOptions({ color: VAR_META[variable].seriesColor })

    if (!IS_MOCKED) return

    const pts = generateComparisonData(timePreset, variable)
    if (!pts.length) return

    const inaiaPts    = pts.map((p) => ({ time: p.timestamp as unknown as string, value: p.inaia }))
    const baselinePts = pts.map((p) => ({ time: p.timestamp as unknown as string, value: p.baseline }))

    inaiaRef.current.setData(inaiaPts)
    baselineRef.current.setData(baselinePts)
    chartRef.current?.timeScale().fitContent()
  }, [timePreset, variable])

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div className="comp-panel">

      {/* Header: variable selector + stats pill */}
      <div className="comp-header">
        <div className="comp-var-selector" role="group" aria-label="Comparison variable">
          {(Object.entries(VAR_META) as [ComparisonVariable, VarMeta][]).map(([key, m]) => (
            <button
              key={key}
              className={`comp-var-btn ${variable === key ? 'comp-var-btn--active' : ''}`}
              style={variable === key ? { borderColor: m.seriesColor, color: m.seriesColor } as React.CSSProperties : undefined}
              onClick={() => setVariable(key)}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="comp-stats">
          <span className="comp-stat-pill">
            <span className="comp-stat-dot" style={{ background: meta.seriesColor }} />
            {meta.savedLabel}
          </span>
          {IS_MOCKED && <span className="mock-badge">DEMO MODE</span>}
        </div>
      </div>

      {/* Chart fills remaining height */}
      <div className="comp-chart-wrap">
        <div className="comp-chart-container" ref={containerRef} />

        {/* Legend overlay */}
        <div className="chart-legend-overlay">
          <span className="savings-title-inline">
            {variable === 'energy' ? 'ENERGY CONSUMPTION'
              : variable === 'cost' ? 'ENERGY COST'
              : 'CO₂ EMISSIONS'} — BASELINE vs INAIA · {timePreset.toUpperCase()}
          </span>
          <div className="sleg-row">
            <span className="sleg">
              <span className="slegdot slegdot--baseline" />
              Baseline
            </span>
            <span className="sleg" style={{ color: meta.seriesColor }}>
              <span className="slegdot" style={{ background: meta.seriesColor }} />
              INAIA
            </span>
            <span className="sleg sleg--unit">{meta.unit}</span>
          </div>
        </div>

        {!IS_MOCKED && (
          <div className="savings-state-overlay savings-state-overlay--warn">
            <span className="state-icon">⚠</span>
            <span>Backend not connected</span>
            <span className="state-sub">Awaiting data from BOPTEST server</span>
          </div>
        )}
      </div>

    </div>
  )
}
