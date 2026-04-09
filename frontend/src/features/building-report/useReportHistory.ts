import { useQuery } from '@tanstack/react-query'
import type { HistoryPoint } from '../../types/building.types'
import type { TimePreset } from '../maintenance/hooks/useTimelineData'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

const PERIOD_CONFIG: Record<TimePreset, { resolution: string; seconds: number }> = {
  '1h':  { resolution: '1m', seconds: 3600 },
  '1d':  { resolution: '1m', seconds: 86_400 },
  '1M':  { resolution: '1d', seconds: 2_592_000 },
  '1y':  { resolution: '1d', seconds: 31_536_000 },
}

export function useReportHistory(period: TimePreset) {
  const config = PERIOD_CONFIG[period]
  if (!config) throw new Error(`Invalid period: ${period}`)
  
  const { resolution, seconds } = config
  const endTime   = Math.floor(Date.now() / 60_000) * 60
  const startTime = endTime - seconds

  return useQuery<HistoryPoint[]>({
    queryKey: ['report-history', period, startTime],
    queryFn: async () => {
      const url = new URL(`${API_BASE}/api/v1/building/history`)
      url.searchParams.set('resolution', resolution)
      url.searchParams.set('start_time', new Date(startTime * 1000).toISOString())
      url.searchParams.set('end_time',   new Date(endTime   * 1000).toISOString())
      const res = await fetch(url.toString())
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      return res.json() as Promise<HistoryPoint[]>
    },
    staleTime: 120_000,
    retry: 2,
  })
}
