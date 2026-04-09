import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createChart,
  LineSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type LineSeriesOptions,
  LineStyle,
} from 'lightweight-charts'
import { useHistoryData, useOlderHistoryData, TIME_PRESETS } from '../../hooks/useTimelineData'
import { useDashboardStore } from '../../../../store/dashboardStore'
import type { BuildingSnapshot, TimePreset } from '../../../../types/building.types'
import './TimelineChart.css'

// ─── Series definition ────────────────────────────────────────────────────────

const SERIES_CONFIG = [
  { key: 'core_temp_c'  as const, label: 'Core Temp (°C)',  color: '#3b82f6', priceScaleId: 'right' as const },
  { key: 'fan_power_w'  as const, label: 'Fan Power (W)',   color: '#00d4aa', priceScaleId: 'left'  as const },
  { key: 'core_co2_ppm' as const, label: 'Core CO₂ (ppm)', color: '#f59e0b', priceScaleId: 'right' as const },
] as const

type SeriesKey = (typeof SERIES_CONFIG)[number]['key']

/** Extract the three tracked metrics from a live WebSocket snapshot. */
function snapshotToPoints(snap: BuildingSnapshot): Record<SeriesKey, number | null> {
  const core = snap.zones.find((z) => z.id === 'cor')
  const ahu  = snap.equipment.find((e) => e.id === 'ahu-1')
  return {
    core_temp_c:  core?.temperature              ?? null,
    fan_power_w:  ahu?.metrics['fan_power_w']    ?? null,
    core_co2_ppm: core?.co2                      ?? null,
  }
}

function buildPoints(historyData: ReturnType<typeof useHistoryData>['data'], key: SeriesKey) {
  if (!historyData) return []
  const seen = new Set<number>()
  return historyData
    .filter((p) => p[key] !== null && p.timestamp > 0)
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((p) => {
      if (seen.has(p.timestamp)) return false
      seen.add(p.timestamp)
      return true
    })
    .map((p) => ({
      time: p.timestamp as unknown as string,
      value: p[key] as number,
    }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelineChart() {
  const containerRef      = useRef<HTMLDivElement>(null)
  const chartRef          = useRef<IChartApi | null>(null)
  const seriesRefs        = useRef(new Map<SeriesKey, ISeriesApi<'Line'>>())
  const oldestTsRef       = useRef<number>(0)   // oldest timestamp currently loaded
  const isLiveRef         = useRef<boolean>(true)
  const fetchOlderRef     = useRef<((ts: number) => void) | null>(null)

  const [isAtRealtime, setIsAtRealtime] = useState(true)

  const timePreset    = useDashboardStore((s) => s.timePreset)
  const setTimePreset = useDashboardStore((s) => s.setTimePreset)
  const snapshot      = useDashboardStore((s) => s.snapshot)

  const { data: historyData, isLoading }          = useHistoryData()
  const { fetchOlderData, data: olderData }        = useOlderHistoryData()

  // Keep ref in sync so the once-created chart effect always calls the latest version
  fetchOlderRef.current = fetchOlderData

  // ── Create chart once ──────────────────────────────────────────────────────
  useEffect(() => {
    if (!containerRef.current) return

    const chart = createChart(containerRef.current, {
      layout: {
        background: { color: 'var(--chart-bg)' as string },
        textColor: '#9ca3af',
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.05)', style: LineStyle.Dotted },
        horzLines: { color: 'rgba(255,255,255,0.05)', style: LineStyle.Dotted },
      },
      crosshair: {
        vertLine: { color: 'rgba(0,212,170,0.5)', width: 1, style: LineStyle.Dashed },
        horzLine: { color: 'rgba(0,212,170,0.5)', width: 1, style: LineStyle.Dashed },
      },
      timeScale: {
        borderColor: 'rgba(255,255,255,0.08)',
        timeVisible: true,
        secondsVisible: false,
        // Render axis tick marks in the browser's local timezone.
        tickMarkFormatter: (time: number, tickMarkType: TickMarkType, locale: string) => {
          const d = new Date(time * 1000)
          switch (tickMarkType) {
            case TickMarkType.Year:
              return d.toLocaleDateString(locale, { year: 'numeric' })
            case TickMarkType.Month:
              return d.toLocaleDateString(locale, { month: 'short' })
            case TickMarkType.DayOfMonth:
              return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
            case TickMarkType.Time:
              return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            case TickMarkType.TimeWithSeconds:
              return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            default:
              return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
          }
        },
      },
      localization: {
        timeFormatter: (timestamp: number) => {
          const d = new Date(timestamp * 1000)
          return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        },
        dateFormat: 'dd MMM \'yy',
      },
      leftPriceScale:  { visible: true,  borderColor: 'rgba(255,255,255,0.08)' },
      rightPriceScale: { visible: true,  borderColor: 'rgba(255,255,255,0.08)' },
      handleScroll: true,
      handleScale: true,
    })

    chartRef.current = chart

    SERIES_CONFIG.forEach(({ key, label, color, priceScaleId }) => {
      const series = chart.addSeries(LineSeries, {
        color,
        lineWidth: 2,
        title: label,
        crosshairMarkerVisible: true,
        crosshairMarkerRadius: 4,
        lastValueVisible: true,
        priceLineVisible: false,
        priceScaleId,
      } as Partial<LineSeriesOptions>)
      seriesRefs.current.set(key, series)
    })

    // ── Track whether user has scrolled away from realtime ──────────────────
    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return

      // Check if we're at the rightmost edge (within ~5 bars of the end)
      const barsInfo = chart.timeScale().getVisibleRange()
      const lastSeries = seriesRefs.current.values().next().value
      if (barsInfo && lastSeries) {
        // If logical range ends near the data end, user is at realtime
        const atEnd = range.to >= range.from && range.to > -5
        const wasLive = isLiveRef.current
        isLiveRef.current = atEnd
        if (atEnd !== wasLive) setIsAtRealtime(atEnd)
      }

      // ── Infinite history: fetch older data when near left edge ─────────────
      if (range.from < 10 && oldestTsRef.current > 0) {
        fetchOlderRef.current?.(oldestTsRef.current)
      }
    })

    const ro = new ResizeObserver(() => {
      if (containerRef.current) {
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
      chartRef.current = null
      seriesRefs.current.clear()
    }
  }, [])  // create once — never re-run

  // ── Load historical data (REST) ────────────────────────────────────────────
  useEffect(() => {
    if (!historyData || historyData.length === 0) {
      console.debug('[Chart] No history data — skipping setData')
      return
    }
    console.info(`[Chart] Loading ${historyData.length} history points into chart`)

    SERIES_CONFIG.forEach(({ key }) => {
      const series = seriesRefs.current.get(key)
      if (!series) return
      const points = buildPoints(historyData, key)
      console.debug(`[Chart] series=${key} points=${points.length}`)
      if (points.length > 0) series.setData(points)
    })

    // Track oldest timestamp for infinite history
    const sorted = [...historyData].sort((a, b) => a.timestamp - b.timestamp)
    oldestTsRef.current = sorted[0]?.timestamp ?? 0

    // Fit all loaded data into view — matches range-switcher best practice
    chartRef.current?.timeScale().fitContent()
    console.debug('[Chart] fitContent() called after setData')
  }, [historyData])

  // ── Prepend older history (infinite scroll) ────────────────────────────────
  useEffect(() => {
    if (!olderData || olderData.length === 0) return
    console.info(`[Chart] Prepending ${olderData.length} older history points`)

    SERIES_CONFIG.forEach(({ key }) => {
      const series = seriesRefs.current.get(key)
      if (!series) return

      // Merge older data with existing series data (setData replaces all)
      const existing = historyData ?? []
      const merged = [...olderData, ...existing]
      const points = buildPoints(merged, key)
      if (points.length > 0) series.setData(points)
    })

    // Update oldest timestamp — DO NOT call fitContent here (preserve scroll position)
    const sorted = [...olderData].sort((a, b) => a.timestamp - b.timestamp)
    oldestTsRef.current = sorted[0]?.timestamp ?? oldestTsRef.current
  }, [olderData])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time update (WebSocket) ───────────────────────────────────────────
  useEffect(() => {
    if (!snapshot) return

    const values = snapshotToPoints(snapshot)
    const time   = Math.floor(snapshot.timestamp) as unknown as string
    console.debug('[Chart] RT update — timestamp:', snapshot.timestamp, 'values:', values)

    SERIES_CONFIG.forEach(({ key }) => {
      const series = seriesRefs.current.get(key)
      const value  = values[key]
      if (series && value !== null) {
        try {
          series.update({ time, value })
        } catch (err) {
          console.warn(`[Chart] series.update failed for ${key}:`, err)
        }
      }
    })
  }, [snapshot])

  const handleGoLive = useCallback(() => {
    chartRef.current?.timeScale().scrollToRealTime()
    setIsAtRealtime(true)
    isLiveRef.current = true
  }, [])

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="timeline-panel">
      <div className="timeline-header">
        <span className="panel-title">Timeline</span>

        <div className="timeline-legend">
          {SERIES_CONFIG.map((s) => (
            <span key={s.key} className="legend-item">
              <span className="legend-dot" style={{ background: s.color }} />
              <span className="legend-label">{s.label}</span>
            </span>
          ))}
        </div>

        <div className="timeline-controls">
          <div className="time-range-buttons">
            {TIME_PRESETS.map((p: TimePreset) => (
              <button
                key={p}
                className={`time-range-btn ${timePreset === p ? 'time-range-btn--active' : ''}`}
                onClick={() => setTimePreset(p)}
              >
                {p}
              </button>
            ))}
          </div>

          {!isAtRealtime && (
            <button className="go-live-btn" onClick={handleGoLive}>
              ↩ Live
            </button>
          )}
        </div>
      </div>

      {isLoading && <div className="timeline-loading">Loading history…</div>}
      <div className="timeline-chart-container" ref={containerRef} />
    </div>
  )
}
