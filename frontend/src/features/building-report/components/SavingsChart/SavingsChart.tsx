import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createChart,
  LineSeries,
  AreaSeries,
  TickMarkType,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
} from 'lightweight-charts'
import { useHistoryData } from '../../../maintenance/hooks/useTimelineData'
import { useBenchmarkData } from '../../hooks/useBenchmarkData'
import { useDashboardStore } from '../../../../store/dashboardStore'
import { IS_MOCKED, MOCK_SAVINGS, generateMockTimeSeries } from '../../mockData'
import './SavingsChart.css'

// Synthetic baseline factor — used for chart rendering only (visual only)
const BASELINE_FACTOR = 1.224

export function SavingsChart() {
  const containerRef   = useRef<HTMLDivElement>(null)
  const chartRef       = useRef<IChartApi | null>(null)
  const baselineRef    = useRef<ISeriesApi<'Line'> | null>(null)
  const inaiiaRef      = useRef<ISeriesApi<'Line'> | null>(null)
  const tariffRef      = useRef<ISeriesApi<'Area'> | null>(null)
  const isLiveRef      = useRef(true)

  const [isAtRealtime, setIsAtRealtime] = useState(true)

  const snapshot = useDashboardStore((s) => s.snapshot)

  // Real data hooks — only used when NOT mocked
  const { data: historyData, isLoading } = useHistoryData()
  const { data: benchmark } = useBenchmarkData()
  const savings = IS_MOCKED
    ? MOCK_SAVINGS
    : (benchmark?.status === 'completed' ? benchmark.savings : null)
  const benchmarkRunning = !IS_MOCKED && (
    benchmark?.status === 'running_baseline' || benchmark?.status === 'running_optimized'
  )

  // ── Create chart once ──────────────────────────────────────────────────────
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
      localization: {
        timeFormatter: (ts: number) =>
          new Date(ts * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
      rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.06)' },
      leftPriceScale:  {
        visible: true,
        borderColor: 'rgba(255,255,255,0.06)',
        textColor: 'rgba(239, 68, 68, 0.6)',
      },
      handleScroll: true,
      handleScale:  true,
    })

    chartRef.current = chart

    // Baseline — dashed, dim white
    baselineRef.current = chart.addSeries(LineSeries, {
      color: 'rgba(255,255,255,0.35)',
      lineWidth: 2,
      lineStyle: LineStyle.Dashed,
      title: 'Baseline',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 3,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    // INAIA optimizer — solid green
    inaiiaRef.current = chart.addSeries(LineSeries, {
      color: '#00C896',
      lineWidth: 2,
      title: 'INAIA',
      crosshairMarkerVisible: true,
      crosshairMarkerRadius: 4,
      lastValueVisible: true,
      priceLineVisible: false,
    })

    // DEWA Tariff Overlay — subtle red area mapped to left axis
    tariffRef.current = chart.addSeries(AreaSeries, {
      priceScaleId: 'left',
      topColor: 'rgba(239, 68, 68, 0.12)',
      bottomColor: 'rgba(239, 68, 68, 0.0)',
      lineColor: 'rgba(239, 68, 68, 0.4)',
      lineWidth: 1,
      title: 'Tariff',
      crosshairMarkerVisible: false,
      priceLineVisible: false,
      lastValueVisible: false,
    })

    // Track realtime state
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return
      const atEnd = range.to > -5
      if (atEnd !== isLiveRef.current) {
        isLiveRef.current = atEnd
        setIsAtRealtime(atEnd)
      }
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current && containerRef.current.clientWidth > 0) {
        chart.applyOptions({
          width:  containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        })
      }
    })
    if (containerRef.current) ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      chart.remove()
      chartRef.current    = null
      baselineRef.current = null
      inaiiaRef.current   = null
      tariffRef.current   = null
    }
  }, [])

  // ── Load data (mock or real) ───────────────────────────────────────────────
  useEffect(() => {
    if (!baselineRef.current || !inaiiaRef.current) return

    const rawPts = IS_MOCKED
      ? generateMockTimeSeries(72) // 3 days for demo
      : (historyData ?? [])

    if (!rawPts.length) return

    const seen = new Set<number>()
    const pts = [...rawPts]
      .sort((a, b) => a.timestamp - b.timestamp)
      .filter((p) => {
        const val = IS_MOCKED ? (p as ReturnType<typeof generateMockTimeSeries>[0]).fan_power_w : (p as typeof rawPts[0] & { fan_power_w?: number }).fan_power_w
        if (val == null) return false
        if (seen.has(p.timestamp)) return false
        seen.add(p.timestamp)
        return true
      })

    const inaiaPts    = pts.map((p) => ({ time: p.timestamp as unknown as string, value: (p as typeof pts[0] & { fan_power_w: number }).fan_power_w }))
    const baselinePts = inaiaPts.map((p) => ({ ...p, value: p.value * BASELINE_FACTOR }))
    const tariffPts   = pts.map((p) => {
      const d = new Date(p.timestamp * 1000)
      const isSummer = (d.getMonth() + 1) >= 5 && (d.getMonth() + 1) <= 10
      const isPeak = isSummer && d.getHours() >= 12 && d.getHours() < 18
      return { time: p.timestamp as unknown as string, value: isPeak ? 0.38 : 0.23 }
    })

    inaiiaRef.current.setData(inaiaPts)
    baselineRef.current.setData(baselinePts)
    tariffRef.current?.setData(tariffPts)

    chartRef.current?.timeScale().fitContent()
  }, [historyData])

  // ── Real-time update (only in live mode) ──────────────────────────────────
  useEffect(() => {
    if (IS_MOCKED || !snapshot) return
    const ahu      = snapshot.equipment.find((e) => e.id === 'ahu-1')
    const fanPower = ahu?.metrics['fan_power_w']
    if (fanPower == null) return

    const time = Math.floor(snapshot.timestamp) as unknown as string

    try {
      inaiiaRef.current?.update({ time, value: fanPower })
      baselineRef.current?.update({ time, value: fanPower * BASELINE_FACTOR })

      const d = new Date(time as unknown as number * 1000)
      const isSummer = (d.getMonth() + 1) >= 5 && (d.getMonth() + 1) <= 10
      const isPeak = isSummer && d.getHours() >= 12 && d.getHours() < 18
      tariffRef.current?.update({ time, value: isPeak ? 0.38 : 0.23 })
    } catch { /* duplicate time guard */ }
  }, [snapshot])

  const handleGoLive = useCallback(() => {
    chartRef.current?.timeScale().scrollToRealTime()
    setIsAtRealtime(true)
    isLiveRef.current = true
  }, [])

  const showLoading = !IS_MOCKED && isLoading
  const showNoData  = !IS_MOCKED && !isLoading && (!historyData || historyData.length === 0)

  return (
    <div className="savings-panel">
      {/* Slim stats strip above the chart */}
      <div className="savings-stats-strip">
        <div className="sstat">
          <span className="sstat-val">
            {benchmarkRunning
              ? `⟳ ${benchmark!.progress_pct.toFixed(0)}%`
              : `↓ ${savings ? savings.energy_pct.toFixed(1) : (IS_MOCKED ? '18.3' : '—')}%`}
          </span>
          <span className="sstat-lbl">energy saved vs baseline</span>
        </div>
        <div className="sstat">
          <span className="sstat-val sstat-val--blue">
            {savings ? savings.energy_kwh.toFixed(0) : (IS_MOCKED ? '412' : '—')} kWh
          </span>
          <span className="sstat-lbl">cumulative savings</span>
        </div>
        <div className="sstat sstat--right">
          {!isAtRealtime && !IS_MOCKED && (
            <button className="go-live-btn" onClick={handleGoLive}>↩ Live</button>
          )}
          {IS_MOCKED && <span className="mock-badge">DEMO MODE</span>}
        </div>
      </div>

      {/* Chart fills all remaining height */}
      <div className="savings-chart-wrap">
        {showLoading && (
          <div className="savings-state-overlay">Loading history…</div>
        )}
        {showNoData && (
          <div className="savings-state-overlay savings-state-overlay--warn">
            <span className="state-icon">⚠</span>
            <span>Backend not connected</span>
            <span className="state-sub">Awaiting data from BOPTEST server</span>
          </div>
        )}
        {/* Chart canvas — always rendered so the container is measured */}
        <div className="savings-chart-container" ref={containerRef} />

        {/* Legend overlay — absolute-positioned top-left inside the chart */}
        <div className="chart-legend-overlay">
          <span className="savings-title-inline">ENERGY CONSUMPTION — BASELINE vs INAIA</span>
          <div className="sleg-row">
            <span className="sleg"><span className="slegdot slegdot--baseline" />Baseline</span>
            <span className="sleg"><span className="slegdot slegdot--inaia" />INAIA</span>
            <span className="sleg"><span className="slegdot slegdot--tariff" />Tariff (AED/kWh)</span>
            <span className="sleg sleg--delta"><span className="slegdot slegdot--delta" />Δ Saving</span>
          </div>
        </div>
      </div>
    </div>
  )
}
