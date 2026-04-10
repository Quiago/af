import { useRef, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { BmsSnapshot, KpiHistory } from './bms.types'

const API_BASE =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

const HISTORY_MAX = 60  // ~5 min at 5s poll

async function fetchBmsSnapshot(): Promise<BmsSnapshot> {
  const res = await fetch(`${API_BASE}/api/v1/bms/snapshot`)
  if (!res.ok) throw new Error(`BMS snapshot fetch failed: ${res.status}`)
  return res.json() as Promise<BmsSnapshot>
}

/** Append a value to a capped history array (mutates in place). */
function appendCapped(arr: number[], val: number, max: number): void {
  arr.push(val)
  if (arr.length > max) arr.splice(0, arr.length - max)
}

export interface UseBmsDataReturn {
  snapshot: BmsSnapshot | null
  history: KpiHistory
  isStale: boolean
  isLoading: boolean
  refetchNow: () => void
}

export function useBmsData(): UseBmsDataReturn {
  const queryClient = useQueryClient()

  // Rolling history — held in a ref so it survives renders without triggering them
  const historyRef = useRef<KpiHistory>({
    total_elec_kw:   [],
    cooling_load_kw: [],
    heating_load_kw: [],
    co2_kg_per_hr:   [],
    chw_flow_lph:    [],
    pue:             [],
  })

  const query = useQuery<BmsSnapshot>({
    queryKey: ['bms-snapshot'],
    queryFn: async () => {
      const snap = await fetchBmsSnapshot()
      // Append derived KPI values to rolling history
      const h = historyRef.current
      appendCapped(h.total_elec_kw,   snap.total_elec_kw,   HISTORY_MAX)
      appendCapped(h.cooling_load_kw, snap.cooling_load_kw, HISTORY_MAX)
      appendCapped(h.heating_load_kw, snap.heating_load_kw, HISTORY_MAX)
      appendCapped(h.co2_kg_per_hr,   snap.co2_kg_per_hr,   HISTORY_MAX)
      appendCapped(h.chw_flow_lph,    snap.chw_flow_lph,    HISTORY_MAX)
      appendCapped(h.pue,             snap.pue,             HISTORY_MAX)
      return snap
    },
    refetchInterval: 5_000,
    staleTime: 4_000,
    retry: 2,
    retryDelay: 2_000,
  })

  const refetchNow = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: ['bms-snapshot'] })
  }, [queryClient])

  // isStale: query succeeded at least once but last fetch is older than 15s
  const lastUpdated = query.dataUpdatedAt
  const isStale =
    query.isSuccess && Date.now() - lastUpdated > 15_000

  return {
    snapshot:  query.data ?? null,
    history:   historyRef.current,
    isStale,
    isLoading: query.isLoading,
    refetchNow,
  }
}
