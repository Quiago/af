import { useMemo } from 'react'
import { useDashboardStore } from '../../../store/dashboardStore'
import type { EquipmentData, BuildingSnapshot } from '../../../types/building.types'

const FILTER_DP_THRESHOLD = 150 // Pa — configurable threshold
const EMPTY_EQUIPMENT: EquipmentData[] = []
const EMPTY_HISTORY: BuildingSnapshot[] = []
const SPARKLINE_POINTS = 18

export interface EnrichedEquipment extends EquipmentData {
  displayMetric: string
  statusColor: string
  sparklineData: number[]
  sparklineColor: string
}

function getStatusColor(status: EquipmentData['status']): string {
  switch (status) {
    case 'ok':       return 'var(--color-status-ok)'
    case 'warning':  return 'var(--color-status-warning)'
    case 'critical': return 'var(--color-status-critical)'
    case 'offline':  return 'var(--color-status-offline)'
  }
}

function getPrimaryMetricKey(eq: EquipmentData): string {
  switch (eq.type) {
    case 'chiller':       return 'cop'
    case 'ahu':           return 'supply_temp'
    case 'filter':        return 'differential_pressure_pa'
    case 'cooling_tower': return 'power_kw'
  }
}

function buildSparkline(history: BuildingSnapshot[], equipmentId: string, metricKey: string): number[] {
  const recent = history.slice(-SPARKLINE_POINTS)
  return recent
    .map((snap) => snap.equipment.find((e) => e.id === equipmentId)?.metrics[metricKey])
    .filter((v): v is number => v != null)
}

function computeEnriched(equipment: EquipmentData[], history: BuildingSnapshot[]): EnrichedEquipment[] {
  return equipment.map((eq) => {
    let displayMetric = ''
    let status = eq.status

    switch (eq.type) {
      case 'chiller': {
        const cop = eq.metrics['cop'] ?? 0
        displayMetric = `COP ${cop.toFixed(2)}`
        if (cop < 2.0)      status = 'critical'
        else if (cop < 3.0) status = 'warning'
        else                status = 'ok'
        break
      }
      case 'ahu': {
        const supplyTemp = eq.metrics['supply_temp'] ?? 0
        const fanSpeed = eq.metrics['fan_speed_pct'] ?? 0
        displayMetric = `${supplyTemp.toFixed(1)}°C supply`
        if (fanSpeed > 85) status = 'warning'
        break
      }
      case 'filter': {
        const dp = eq.metrics['differential_pressure_pa'] ?? 0
        displayMetric = `ΔP ${dp.toFixed(0)} Pa`
        if (dp > FILTER_DP_THRESHOLD) status = 'warning'
        break
      }
      case 'cooling_tower': {
        const power = eq.metrics['power_kw'] ?? 0
        displayMetric = `${power.toFixed(1)} kW`
        break
      }
    }

    const sparklineColor = getStatusColor(status)
    const sparklineData = buildSparkline(history, eq.id, getPrimaryMetricKey(eq))

    return {
      ...eq,
      status,
      displayMetric,
      statusColor: sparklineColor,
      sparklineData,
      sparklineColor,
    }
  })
}

export function useEquipmentData(): EnrichedEquipment[] {
  const equipment = useDashboardStore((s) => s.snapshot?.equipment ?? EMPTY_EQUIPMENT)
  const history = useDashboardStore((s) => s.history ?? EMPTY_HISTORY)
  return useMemo(() => computeEnriched(equipment, history), [equipment, history])
}
