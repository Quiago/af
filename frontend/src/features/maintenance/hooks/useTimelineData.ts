import { useCallback, useMemo, useRef, useState } from 'react'
import { useQuery, useQueryClient, keepPreviousData } from '@tanstack/react-query'
import { useDashboardStore } from '../../../store/dashboardStore'
import type { HistoryPoint, Resolution, TimePreset } from '../../../types/building.types'

const API_BASE   = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'
const IS_MOCKED  = import.meta.env.VITE_MOCKED_DATA === 'true'

// ── Asset kind detection ──────────────────────────────────────────────────────

export type AssetKind = 'chiller' | 'ahu' | 'filter' | 'ct' | 'default'

export function assetKindFromId(id: string | null): AssetKind {
  if (!id) return 'default'
  if (id.startsWith('chiller'))  return 'chiller'
  if (id.startsWith('ahu'))      return 'ahu'
  if (id.startsWith('filter'))   return 'filter'
  if (id.startsWith('ct'))       return 'ct'
  return 'default'
}

// ── Mock history data for demo mode ──────────────────────────────────────────
// Generates realistic hotel HVAC timeline data per machine type.

const MOCK_STEP_MIN: Record<TimePreset, number> = {
  '1h': 1, '1d': 5, '1M': 60, '1y': 1440,
}
const MOCK_COUNT: Record<TimePreset, number> = {
  '1h': 60, '1d': 288, '1M': 720, '1y': 365,
}

function generateMockHistoryTimeline(preset: TimePreset, assetId: string | null): HistoryPoint[] {
  const kind    = assetKindFromId(assetId)
  const stepMin = MOCK_STEP_MIN[preset]
  const count   = MOCK_COUNT[preset]
  const step    = stepMin * 60
  const now     = Math.floor(Date.now() / 1000)
  const start   = now - count * step

  // Use a deterministic seed offset per asset so different machines look different
  const seedOffset = assetId ? assetId.charCodeAt(assetId.length - 1) * 0.31 : 0

  return Array.from({ length: count }, (_, i) => {
    const ts = start + i * step
    const h  = new Date(ts * 1000).getHours()
    const isOcc     = h >= 7  && h < 23
    const isPeakOcc = (h >= 11 && h < 14) || (h >= 18 && h < 22)
    const r = () => Math.random()

    if (kind === 'chiller') {
      // ── Chiller: COP + Power kW + Supply Temp ──────────────────────────────
      // COP degrades midday (high load), recovers at night
      const copBase   = isPeakOcc ? 3.3 : isOcc ? 3.8 : 4.1
      const cop       = parseFloat((copBase + (r() - 0.5) * 0.28 + Math.sin(i * 0.12 + seedOffset) * 0.15).toFixed(2))
      // Power inversely tracks COP — higher load at peak
      const pwrBase   = isPeakOcc ? 295 : isOcc ? 268 : 220
      const power_kw  = parseFloat((pwrBase + (r() - 0.5) * 18).toFixed(1))
      // Leaving Water Temp rises slightly under peak load
      const lwtBase   = isPeakOcc ? 7.1 : isOcc ? 6.6 : 6.1
      const lwt       = parseFloat((lwtBase + (r() - 0.5) * 0.4).toFixed(2))
      return { timestamp: ts, cop: Math.max(2.0, Math.min(5.0, cop)), power_kw, supply_temp_c: lwt }

    } else if (kind === 'ahu') {
      // ── AHU: Fan Power + Supply Air Temp + Fan Speed ───────────────────────
      const fanTarget = isPeakOcc ? 21500 : isOcc ? 17500 : 10000
      const fan_power_w = Math.round(Math.max(7000, Math.min(26000,
        fanTarget + (r() - 0.5) * 1200 + Math.sin(i * 0.08 + seedOffset) * 800)))
      const supBase   = isPeakOcc ? 14.8 : isOcc ? 15.3 : 15.8
      const supply_temp_c = parseFloat((supBase + (r() - 0.5) * 0.5).toFixed(1))
      const fanSpd    = parseFloat(((fan_power_w / 22000) * 100 + (r() - 0.5) * 2).toFixed(1))
      return { timestamp: ts, fan_power_w, supply_temp_c, fan_speed_pct: Math.max(30, Math.min(100, fanSpd)) }

    } else if (kind === 'filter') {
      // ── Filter: Differential Pressure (trends up = clogging) + Airflow % ──
      // Slow upward drift over time with daily cycles
      const driftBase = 60 + (i / count) * 80   // 60→140 Pa across the window
      const dpTarget  = isPeakOcc ? driftBase + 15 : isOcc ? driftBase + 8 : driftBase
      const diff_pressure_pa = parseFloat((Math.max(40, Math.min(200,
        dpTarget + (r() - 0.5) * 12)).toFixed(1)))
      const airflowTarget = isPeakOcc ? 88 : isOcc ? 82 : 75
      const airflow_pct = parseFloat((Math.max(60, Math.min(100,
        airflowTarget + (r() - 0.5) * 4)).toFixed(1)))
      return { timestamp: ts, diff_pressure_pa, airflow_pct }

    } else if (kind === 'ct') {
      // ── Cooling Tower: Approach Temp + Fan Speed + Power kW ────────────────
      const appBase   = isPeakOcc ? 2.4 : isOcc ? 2.0 : 1.7
      const approach_temp_k = parseFloat((Math.max(1.0, Math.min(5.0,
        appBase + (r() - 0.5) * 0.3 + Math.sin(i * 0.09 + seedOffset) * 0.15)).toFixed(2)))
      const fanBase   = isPeakOcc ? 72 : isOcc ? 65 : 50
      const ct_fan_speed_pct = parseFloat((Math.max(30, Math.min(100,
        fanBase + (r() - 0.5) * 6)).toFixed(1)))
      const pwrBase   = isPeakOcc ? 25 : isOcc ? 21 : 16
      const ct_power_kw = parseFloat((Math.max(10, Math.min(35,
        pwrBase + (r() - 0.5) * 2.5)).toFixed(1)))
      return { timestamp: ts, approach_temp_k, ct_fan_speed_pct, ct_power_kw }

    } else {
      // ── Default / AHU generic (original data for backwards compat) ─────────
      let temp     = 22.0
      let co2      = 430
      let fanPower = 15000
      const tempTarget  = isPeakOcc ? 22.8 : isOcc ? 22.3 : 21.7
      temp     = Math.max(21.0, Math.min(23.5, temp  + (tempTarget  - temp)  * 0.06 + (r() - 0.5) * 0.18))
      const co2Target   = isPeakOcc ? 760  : isOcc ? 560  : 430
      co2      = Math.max(400, Math.min(900, co2   + (co2Target   - co2)   * 0.04 + (r() - 0.5) * 12))
      const fanTarget   = isPeakOcc ? 24000 : isOcc ? 20000 : 10500
      fanPower = Math.max(8000, Math.min(26000, fanPower + (fanTarget - fanPower) * 0.05 + (r() - 0.5) * 600))
      return {
        timestamp:    ts,
        core_temp_c:  parseFloat(temp.toFixed(2)),
        fan_power_w:  Math.round(fanPower),
        core_co2_ppm: Math.round(co2),
      }
    }
  })
}

export type { HistoryPoint, Resolution, TimePreset }

interface PresetConfig {
  resolution: Resolution   // GROUP BY bucket size passed to GET /history
  seconds: number          // how far back to query
}

/**
 * Each button defines its own time window and the most meaningful resolution for that span.
 *
 *   1h  → last 1 hour,    resolution 1m  (raw data, ~60 pts)
 *   1d  → last 24 hours,  resolution 1m  (raw data, ~1440 pts — LW Charts handles this fine)
 *   1M  → last 30 days,   resolution 1d  (daily GROUP BY, ~30 pts)
 *   1y  → last 365 days,  resolution 1d  (daily GROUP BY, ~365 pts)
 */
export const PRESET_CONFIG: Record<TimePreset, PresetConfig> = {
  '1h': { resolution: '1m', seconds: 3_600       },
  '1d': { resolution: '1m', seconds: 86_400      },
  '1M': { resolution: '1d', seconds: 2_592_000   },
  '1y': { resolution: '1d', seconds: 31_536_000  },
}

export const TIME_PRESETS: TimePreset[] = ['1h', '1d', '1M', '1y']

/**
 * Fetch downsampled time-series history from the backend.
 * When VITE_MOCKED_DATA=true, returns generated mock data instead of calling the API.
 * Timestamps are rounded to the nearest minute for stable query keys.
 */
export function useHistoryData() {
  const timePreset      = useDashboardStore((s) => s.timePreset)
  const selectedAssetId = useDashboardStore((s) => s.selectedAssetId)
  const { resolution, seconds } = PRESET_CONFIG[timePreset]

  // Pre-generate mock data (stable per preset + asset — regenerates when either changes)
  const mockData = useMemo(
    () => IS_MOCKED ? generateMockHistoryTimeline(timePreset, selectedAssetId) : null,
    [timePreset, selectedAssetId],
  )

  const endTime   = Math.floor(Date.now() / 60_000) * 60
  const startTime = endTime - seconds

  const query = useQuery<HistoryPoint[]>({
    queryKey: ['building-history', timePreset, startTime, selectedAssetId],
    enabled:  !IS_MOCKED,   // skip API when mocked
    queryFn: async () => {
      const url = new URL(`${API_BASE}/api/v1/building/history`)
      url.searchParams.set('resolution', resolution)
      url.searchParams.set('start_time', new Date(startTime * 1000).toISOString())
      url.searchParams.set('end_time',   new Date(endTime   * 1000).toISOString())
      console.debug(`[History] preset=${timePreset} resolution=${resolution} window=${seconds}s`)
      const res = await fetch(url.toString())
      if (!res.ok) {
        console.error(`[History] HTTP ${res.status}`, url.toString())
        throw new Error(`HTTP ${res.status}`)
      }
      const data = await res.json() as HistoryPoint[]
      console.info(`[History] Received ${data.length} points for preset=${timePreset}`)
      return data
    },
    staleTime: 20_000,
    refetchInterval: 30_000,
    placeholderData: keepPreviousData,
    retry: 2,
  })

  // Return mock data directly — no loading state, no network call
  if (IS_MOCKED) return { data: mockData, isLoading: false, isError: false }
  return query
}

/**
 * Infinite history: fetch a chunk of data older than `beforeTimestamp`.
 * Returns accumulated older data + a trigger function called by the chart
 * when the user scrolls left past the loaded range.
 */
export function useOlderHistoryData() {
  const timePreset = useDashboardStore((s) => s.timePreset)
  const { resolution } = PRESET_CONFIG[timePreset]
  const queryClient = useQueryClient()

  const [data, setData] = useState<HistoryPoint[] | null>(null)
  const isFetchingRef = useRef(false)

  const fetchOlderData = useCallback(async (beforeTimestamp: number) => {
    if (isFetchingRef.current || beforeTimestamp <= 0) return
    isFetchingRef.current = true

    // Fetch 7 days before the oldest currently loaded point
    const endTime   = beforeTimestamp
    const startTime = endTime - 7 * 86_400

    console.debug(`[History] Fetching older data before=${new Date(beforeTimestamp * 1000).toISOString()}`)

    try {
      // Use queryClient cache so repeated scroll-lefts don't re-fetch
      const result = await queryClient.fetchQuery<HistoryPoint[]>({
        queryKey: ['building-history-older', beforeTimestamp, resolution],
        queryFn: async () => {
          const url = new URL(`${API_BASE}/api/v1/building/history`)
          url.searchParams.set('resolution', resolution)
          url.searchParams.set('start_time', new Date(startTime * 1000).toISOString())
          url.searchParams.set('end_time',   new Date(endTime   * 1000).toISOString())
          const res = await fetch(url.toString())
          if (!res.ok) throw new Error(`HTTP ${res.status}`)
          const points = await res.json() as HistoryPoint[]
          console.info(`[History] Older fetch: ${points.length} points`)
          return points
        },
        staleTime: 5 * 60_000,
      })
      if (result.length > 0) setData(result)
    } finally {
      isFetchingRef.current = false
    }
  }, [queryClient, resolution])

  return { fetchOlderData, data }
}
