import { useMemo } from 'react'
import { useDashboardStore } from '../../../store/dashboardStore'
import type { ZoneData } from '../../../types/building.types'

const EMPTY_ZONES: ZoneData[] = []

export interface ZoneWithColor extends ZoneData {
  colorClass: 'cold' | 'ok' | 'warm' | 'hot'
  delta: number
}

export type HeatmapGrid = (ZoneWithColor | null)[][]

function tempToColorClass(temp: number): ZoneWithColor['colorClass'] {
  if (temp < 19)  return 'cold'
  if (temp <= 22) return 'ok'
  if (temp <= 24) return 'warm'
  return 'hot'
}

export function useHeatmapData(): HeatmapGrid {
  const zones = useDashboardStore((s) => s.snapshot?.zones ?? EMPTY_ZONES)

  return useMemo(() => {
    const grid: (ZoneWithColor | null)[][] = Array.from({ length: 3 }, () => Array(3).fill(null))
    for (const z of zones) {
      const row = z.row ?? 1
      const col = z.col ?? 1
      if (row >= 0 && row < 3 && col >= 0 && col < 3) {
        grid[row][col] = {
          ...z,
          colorClass: tempToColorClass(z.temperature),
          delta: parseFloat((z.temperature - z.setpoint).toFixed(1)),
        }
      }
    }
    return grid
  }, [zones])
}
