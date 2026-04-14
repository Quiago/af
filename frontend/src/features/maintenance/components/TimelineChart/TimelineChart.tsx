import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  createChart,
  LineSeries,
  TickMarkType,
  type IChartApi,
  type ISeriesApi,
  type LineSeriesOptions,
  LineStyle,
} from 'lightweight-charts'
import { useHistoryData, useOlderHistoryData, TIME_PRESETS, assetKindFromId } from '../../hooks/useTimelineData'
import { useDashboardStore } from '../../../../store/dashboardStore'
import type { BuildingSnapshot, HistoryPoint, TimePreset } from '../../../../types/building.types'
import './TimelineChart.css'

// ─── Per-asset series configurations ─────────────────────────────────────────

interface SeriesConfig {
  key: string
  label: string
  color: string
  priceScaleId: 'left' | 'right'
}

const ASSET_SERIES_MAP: Record<string, SeriesConfig[]> = {
  chiller: [
    { key: 'cop',           label: 'COP',            color: '#00d4aa', priceScaleId: 'right' },
    { key: 'power_kw',      label: 'Power (kW)',      color: '#3b82f6', priceScaleId: 'left'  },
    { key: 'supply_temp_c', label: 'LWT (°C)',        color: '#f59e0b', priceScaleId: 'right' },
  ],
  ahu: [
    { key: 'fan_power_w',   label: 'Fan Power (W)',   color: '#00d4aa', priceScaleId: 'left'  },
    { key: 'supply_temp_c', label: 'Supply Air (°C)', color: '#3b82f6', priceScaleId: 'right' },
    { key: 'fan_speed_pct', label: 'Fan Speed (%)',   color: '#f59e0b', priceScaleId: 'right' },
  ],
  filter: [
    { key: 'diff_pressure_pa', label: 'ΔP (Pa)',      color: '#f59e0b', priceScaleId: 'right' },
    { key: 'airflow_pct',      label: 'Airflow (%)',  color: '#00d4aa', priceScaleId: 'left'  },
  ],
  ct: [
    { key: 'approach_temp_k',  label: 'Approach (K)', color: '#3b82f6', priceScaleId: 'right' },
    { key: 'ct_fan_speed_pct', label: 'Fan Speed (%)', color: '#00d4aa', priceScaleId: 'left' },
    { key: 'ct_power_kw',      label: 'Power (kW)',   color: '#f59e0b', priceScaleId: 'right' },
  ],
  default: [
    { key: 'core_temp_c',  label: 'Core Temp (°C)',  color: '#3b82f6', priceScaleId: 'right' },
    { key: 'fan_power_w',  label: 'Fan Power (W)',   color: '#00d4aa', priceScaleId: 'left'  },
    { key: 'core_co2_ppm', label: 'Core CO₂ (ppm)', color: '#f59e0b', priceScaleId: 'right' },
  ],
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Pull values for the current asset kind from a live WebSocket snapshot. */
function snapshotToValues(
  snap: BuildingSnapshot,
  assetId: string | null,
  kind: string,
): Record<string, number | null> {
  const eq = (id: string) => snap.equipment.find((e) => e.id === id)

  switch (kind) {
    case 'chiller': {
      const e = eq(assetId ?? 'chiller-1')
      return {
        cop:           e?.metrics['cop']         ?? null,
        power_kw:      e?.metrics['power_kw']    ?? null,
        supply_temp_c: e?.metrics['supply_temp'] ?? null,
      }
    }
    case 'ahu': {
      const e = eq(assetId ?? 'ahu-1')
      return {
        fan_power_w:   e?.metrics['fan_power_w']  ?? null,
        supply_temp_c: e?.metrics['supply_temp']  ?? null,
        fan_speed_pct: e?.metrics['fan_speed_pct'] ?? null,
      }
    }
    case 'filter': {
      const e = eq(assetId ?? 'filter-1')
      return {
        diff_pressure_pa: e?.metrics['differential_pressure_pa'] ?? null,
        airflow_pct:      e?.metrics['airflow_pct']              ?? null,
      }
    }
    case 'ct': {
      const e = eq(assetId ?? 'ct-1')
      return {
        approach_temp_k:  e?.metrics['approach_temp_k']  ?? null,
        ct_fan_speed_pct: e?.metrics['fan_speed_pct']    ?? null,
        ct_power_kw:      e?.metrics['power_kw']         ?? null,
      }
    }
    default: {
      const core = snap.zones.find((z) => z.id === 'cor')
      const ahu  = snap.equipment.find((e) => e.id === 'ahu-1')
      return {
        core_temp_c:  core?.temperature           ?? null,
        fan_power_w:  ahu?.metrics['fan_power_w'] ?? null,
        core_co2_ppm: core?.co2                   ?? null,
      }
    }
  }
}

function buildPoints(historyData: HistoryPoint[] | null | undefined, key: string) {
  if (!historyData) return []
  const seen = new Set<number>()
  return historyData
    .filter((p) => {
      const v = (p as unknown as Record<string, unknown>)[key]
      return v !== null && v !== undefined && p.timestamp > 0
    })
    .sort((a, b) => a.timestamp - b.timestamp)
    .filter((p) => {
      if (seen.has(p.timestamp)) return false
      seen.add(p.timestamp)
      return true
    })
    .map((p) => ({
      time:  p.timestamp as unknown as string,
      value: (p as unknown as Record<string, unknown>)[key] as number,
    }))
}

// ─── Component ────────────────────────────────────────────────────────────────

export function TimelineChart() {
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<IChartApi | null>(null)
  const seriesRefs    = useRef(new Map<string, ISeriesApi<'Line'>>())
  const oldestTsRef   = useRef<number>(0)
  const isLiveRef     = useRef<boolean>(true)
  const fetchOlderRef = useRef<((ts: number) => void) | null>(null)

  const [isAtRealtime, setIsAtRealtime]   = useState(true)
  const [seriesConfig, setSeriesConfig]   = useState<SeriesConfig[]>(ASSET_SERIES_MAP['default'])

  const timePreset      = useDashboardStore((s) => s.timePreset)
  const setTimePreset   = useDashboardStore((s) => s.setTimePreset)
  const snapshot        = useDashboardStore((s) => s.snapshot)
  const selectedAssetId = useDashboardStore((s) => s.selectedAssetId)

  const assetKind = useMemo(() => assetKindFromId(selectedAssetId), [selectedAssetId])

  const { data: historyData, isLoading }   = useHistoryData()
  const { fetchOlderData, data: olderData } = useOlderHistoryData()

  fetchOlderRef.current = fetchOlderData

  // ── Create chart once — no series yet ──────────────────────────────────────
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
        tickMarkFormatter: (time: number, tickMarkType: TickMarkType, locale: string) => {
          const d = new Date(time * 1000)
          switch (tickMarkType) {
            case TickMarkType.Year:         return d.toLocaleDateString(locale, { year: 'numeric' })
            case TickMarkType.Month:        return d.toLocaleDateString(locale, { month: 'short' })
            case TickMarkType.DayOfMonth:   return d.toLocaleDateString(locale, { month: 'short', day: 'numeric' })
            case TickMarkType.Time:         return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
            case TickMarkType.TimeWithSeconds:
              return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit', second: '2-digit' })
            default:                        return d.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })
          }
        },
      },
      localization: {
        timeFormatter: (timestamp: number) =>
          new Date(timestamp * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        dateFormat: 'dd MMM \'yy',
      },
      leftPriceScale:  { visible: true, borderColor: 'rgba(255,255,255,0.08)' },
      rightPriceScale: { visible: true, borderColor: 'rgba(255,255,255,0.08)' },
      handleScroll: true,
      handleScale:  true,
    })

    chartRef.current = chart

    chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
      if (!range) return
      const atEnd = range.to >= range.from && range.to > -5
      const wasLive = isLiveRef.current
      isLiveRef.current = atEnd
      if (atEnd !== wasLive) setIsAtRealtime(atEnd)

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
  }, [])

  // ── Rebuild series when asset kind changes ─────────────────────────────────
  useEffect(() => {
    const chart = chartRef.current
    if (!chart) return

    // Remove existing series
    seriesRefs.current.forEach((series) => {
      try { chart.removeSeries(series) } catch { /* ignore */ }
    })
    seriesRefs.current.clear()

    // Add series for the new asset kind
    const config = ASSET_SERIES_MAP[assetKind] ?? ASSET_SERIES_MAP['default']
    config.forEach(({ key, label, color, priceScaleId }) => {
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
    setSeriesConfig(config)
  }, [assetKind])

  // ── Load historical data ───────────────────────────────────────────────────
  useEffect(() => {
    if (!historyData || historyData.length === 0) return

    seriesRefs.current.forEach((series, key) => {
      const points = buildPoints(historyData, key)
      if (points.length > 0) series.setData(points)
    })

    const sorted = [...historyData].sort((a, b) => a.timestamp - b.timestamp)
    oldestTsRef.current = sorted[0]?.timestamp ?? 0
    chartRef.current?.timeScale().fitContent()
  }, [historyData])

  // ── Prepend older history (infinite scroll) ────────────────────────────────
  useEffect(() => {
    if (!olderData || olderData.length === 0) return

    seriesRefs.current.forEach((series, key) => {
      const merged = [...olderData, ...(historyData ?? [])]
      const points = buildPoints(merged, key)
      if (points.length > 0) series.setData(points)
    })

    const sorted = [...olderData].sort((a, b) => a.timestamp - b.timestamp)
    oldestTsRef.current = sorted[0]?.timestamp ?? oldestTsRef.current
  }, [olderData])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Real-time update (WebSocket) ───────────────────────────────────────────
  useEffect(() => {
    if (!snapshot) return

    const values = snapshotToValues(snapshot, selectedAssetId, assetKind)
    const time   = Math.floor(snapshot.timestamp) as unknown as string

    seriesRefs.current.forEach((series, key) => {
      const value = values[key]
      if (value !== null && value !== undefined) {
        try { series.update({ time, value }) } catch { /* ignore stale point */ }
      }
    })
  }, [snapshot, selectedAssetId, assetKind])

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
          {seriesConfig.map((s) => (
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
