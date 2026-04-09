import type { BuildingSnapshot, ZoneData, EquipmentData, HealthMetric } from '../types/building.types'

type ConnectionStatus = 'connecting' | 'connected' | 'disconnected'
type SnapshotListener = (snapshot: BuildingSnapshot) => void
type StatusListener  = (status: ConnectionStatus) => void

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true'

// Hotel zone names — 25hours Hotel Dubai, representative HVAC zones
const ZONE_NAMES = ['Lobby', 'F&B Lounge', 'Guest Rooms N', 'Guest Rooms S', 'Corridor']
const BASE_TEMPS = [22.5, 23.0, 22.0, 22.0, 21.5]

// Static per-equipment metadata — does not change between ticks
const LAST_SERVICE_DATES: Record<string, string> = {
  'chiller-1': '2026-03-10',
  'ahu-1':     '2026-03-22',
  'ahu-2':     '2026-03-28',
  'filter-1':  '2026-01-15',
  'ct-1':      '2026-02-20',
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

function scoreStatus(v: number): HealthMetric['status'] {
  if (v >= 70) return 'ok'
  if (v >= 40) return 'warning'
  return 'critical'
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, v))
}

function buildChillerHealth(cop: number, filterDp: number): {
  healthScore: number
  healthMetrics: HealthMetric[]
} {
  const copScore     = clamp((cop / 5.0) * 100)
  const vibScore     = clamp(rand(70, 95))
  const filterScore  = clamp((1 - filterDp / 250) * 100)
  const healthScore  = Math.round(copScore * 0.5 + vibScore * 0.25 + filterScore * 0.25)

  return {
    healthScore,
    healthMetrics: [
      {
        label:        'COP Efficiency',
        value:        Math.round(copScore),
        displayValue: cop.toFixed(2),
        status:       scoreStatus(copScore),
      },
      {
        label:        'Vibration',
        value:        Math.round(vibScore),
        displayValue: vibScore >= 80 ? 'Normal' : vibScore >= 60 ? 'Elevated' : 'High',
        status:       scoreStatus(vibScore),
      },
      {
        label:        'Filter ΔP',
        value:        Math.round(filterScore),
        displayValue: `${filterDp.toFixed(0)} Pa`,
        status:       scoreStatus(filterScore),
      },
    ],
  }
}

function buildAhuHealth(supplyTemp: number, fanSpeed: number, filterDp: number): {
  healthScore: number
  healthMetrics: HealthMetric[]
} {
  const deviation       = Math.abs(supplyTemp - 16)
  const tempScore       = clamp(100 - deviation * 20)
  const fanScore        = clamp(100 - Math.max(0, fanSpeed - 65) * 1.8)
  const filterScore     = clamp((1 - filterDp / 200) * 100)
  const healthScore     = Math.round(tempScore * 0.4 + fanScore * 0.35 + filterScore * 0.25)

  return {
    healthScore,
    healthMetrics: [
      {
        label:        'Supply Temp Deviation',
        value:        Math.round(tempScore),
        displayValue: `${deviation.toFixed(1)}°C`,
        status:       scoreStatus(tempScore),
      },
      {
        label:        'Fan Efficiency',
        value:        Math.round(fanScore),
        displayValue: `${fanSpeed.toFixed(0)}%`,
        status:       scoreStatus(fanScore),
      },
      {
        label:        'Filter ΔP',
        value:        Math.round(filterScore),
        displayValue: `${filterDp.toFixed(0)} Pa`,
        status:       scoreStatus(filterScore),
      },
    ],
  }
}

function buildFilterHealth(dp: number): {
  healthScore: number
  healthMetrics: HealthMetric[]
} {
  const DAYS_SINCE_CHANGE  = 45           // static mock
  const FILTER_LIFESPAN    = 180          // days
  const remainingDays      = Math.max(0, FILTER_LIFESPAN - DAYS_SINCE_CHANGE)
  const dpScore            = clamp((1 - dp / 300) * 100)
  const daysSinceScore     = clamp(100 - (DAYS_SINCE_CHANGE / FILTER_LIFESPAN) * 100)
  const remainingScore     = clamp((remainingDays / FILTER_LIFESPAN) * 100)
  const healthScore        = Math.round(dpScore * 0.5 + daysSinceScore * 0.25 + remainingScore * 0.25)

  return {
    healthScore,
    healthMetrics: [
      {
        label:        'ΔP Usage',
        value:        Math.round(dpScore),
        displayValue: `${dp.toFixed(0)} Pa`,
        status:       scoreStatus(dpScore),
      },
      {
        label:        'Days Since Change',
        value:        Math.round(daysSinceScore),
        displayValue: `${DAYS_SINCE_CHANGE} days`,
        status:       scoreStatus(daysSinceScore),
      },
      {
        label:        'Remaining Life',
        value:        Math.round(remainingScore),
        displayValue: `${remainingDays} days`,
        status:       scoreStatus(remainingScore),
      },
    ],
  }
}

function buildCoolingTowerHealth(approachK: number, vibration: number): {
  healthScore: number
  healthMetrics: HealthMetric[]
} {
  const approachScore  = clamp((1 - Math.max(0, approachK - 1.5) / 4) * 100)
  const vibScore       = clamp(100 - Math.max(0, vibration - 0.5) * 40)
  const basinScore     = clamp(rand(80, 98))
  const healthScore    = Math.round(approachScore * 0.45 + vibScore * 0.35 + basinScore * 0.20)
  return {
    healthScore,
    healthMetrics: [
      {
        label:        'Approach Temp',
        value:        Math.round(approachScore),
        displayValue: `${approachK.toFixed(1)} K`,
        status:       scoreStatus(approachScore),
      },
      {
        label:        'Fan Vibration',
        value:        Math.round(vibScore),
        displayValue: `${vibration.toFixed(1)} mm/s`,
        status:       scoreStatus(vibScore),
      },
      {
        label:        'Basin Level',
        value:        Math.round(basinScore),
        displayValue: basinScore >= 80 ? 'Nominal' : 'Low',
        status:       scoreStatus(basinScore),
      },
    ],
  }
}

function generateSnapshot(baseTimestamp: number, tick: number): BuildingSnapshot {
  const t = baseTimestamp + tick * 300

  const zones: ZoneData[] = ZONE_NAMES.map((name, i) => ({
    id: `zone-${i + 1}`,
    name,
    temperature: BASE_TEMPS[i] + Math.sin(tick * 0.1 + i) * 1.5 + rand(-0.3, 0.3),
    setpoint: 21.5,
    co2: rand(400, 1200),
    occupancy: rand(0, 1) > 0.3,
  }))

  // Chiller — 280 kW central plant, COP oscillates with load
  const chillerCop      = 3.8 + Math.sin(tick * 0.05) * 0.6 + rand(-0.15, 0.15)
  const chillerFilterDp = rand(35, 95)
  const chillerStatus: EquipmentData['status'] =
    chillerCop < 2.5 ? 'critical' : chillerCop < 3.2 ? 'warning' : 'ok'

  // AHU-1 — Guest floors 1–3 (22 kW fan motor)
  const ahu1FanSpeed  = rand(58, 82)
  const ahu1Supply    = rand(13, 16)
  const ahu1FilterDp  = rand(35, 120)
  const ahu1Status: EquipmentData['status'] = ahu1FanSpeed > 80 ? 'warning' : 'ok'

  // AHU-2 — Guest floors 4–6 (22 kW fan motor)
  const ahu2FanSpeed  = rand(52, 78)
  const ahu2Supply    = rand(13, 16)
  const ahu2FilterDp  = rand(28, 90)

  // Filter bank — primary pre-filter in main air intake
  const filterDp      = rand(55, 165)
  const filterStatus: EquipmentData['status'] = filterDp > 150 ? 'warning' : 'ok'

  // Cooling Tower — rooftop, approach ~2 K, fan vibration low
  const ctApproach    = rand(1.6, 2.8)
  const ctVibration   = rand(0.4, 1.2)

  const chillerHealth = buildChillerHealth(parseFloat(chillerCop.toFixed(2)), chillerFilterDp)
  const ahu1Health    = buildAhuHealth(ahu1Supply, ahu1FanSpeed, ahu1FilterDp)
  const ahu2Health    = buildAhuHealth(ahu2Supply, ahu2FanSpeed, ahu2FilterDp)
  const filterHealth  = buildFilterHealth(filterDp)
  const ctHealth      = buildCoolingTowerHealth(ctApproach, ctVibration)

  const equipment: EquipmentData[] = [
    {
      id:   'chiller-1',
      name: 'Chiller Plant C1',
      type: 'chiller',
      status: chillerStatus,
      zone:   'Central Plant',
      lastServiceDate: LAST_SERVICE_DATES['chiller-1'],
      metrics: {
        cop:         parseFloat(chillerCop.toFixed(2)),
        power_kw:    rand(250, 305), // 280 kW avg hotel chiller
        supply_temp: rand(5.5, 7.5),
        return_temp: rand(10, 13),
      },
      ...chillerHealth,
    },
    {
      id:   'ahu-1',
      name: 'AHU — Floors 1–3',
      type: 'ahu',
      status: ahu1Status,
      zone:   'Guest Floors 1–3',
      lastServiceDate: LAST_SERVICE_DATES['ahu-1'],
      metrics: {
        supply_temp:    parseFloat(ahu1Supply.toFixed(1)),
        fan_speed_pct:  parseFloat(ahu1FanSpeed.toFixed(1)),
        fan_power_w:    parseFloat((ahu1FanSpeed / 100 * 22000).toFixed(0)),
        return_temp:    rand(20, 23),
        airflow_cfm:    rand(2800, 4500),
      },
      ...ahu1Health,
    },
    {
      id:   'ahu-2',
      name: 'AHU — Floors 4–6',
      type: 'ahu',
      status: 'ok',
      zone:   'Guest Floors 4–6',
      lastServiceDate: LAST_SERVICE_DATES['ahu-2'],
      metrics: {
        supply_temp:    parseFloat(ahu2Supply.toFixed(1)),
        fan_speed_pct:  parseFloat(ahu2FanSpeed.toFixed(1)),
        fan_power_w:    parseFloat((ahu2FanSpeed / 100 * 22000).toFixed(0)),
        return_temp:    rand(20, 23),
        airflow_cfm:    rand(2500, 4000),
      },
      ...ahu2Health,
    },
    {
      id:   'filter-1',
      name: 'Primary Filter Bank',
      type: 'filter',
      status: filterStatus,
      zone:   'Central Plant',
      lastServiceDate: LAST_SERVICE_DATES['filter-1'],
      metrics: {
        differential_pressure_pa: parseFloat(filterDp.toFixed(1)),
        airflow_pct:              rand(72, 96),
      },
      ...filterHealth,
    },
    {
      id:   'ct-1',
      name: 'Cooling Tower CT1',
      type: 'cooling_tower',
      status: ctHealth.healthScore >= 70 ? 'ok' : ctHealth.healthScore >= 40 ? 'warning' : 'critical',
      zone:   'Rooftop Plant',
      lastServiceDate: LAST_SERVICE_DATES['ct-1'],
      metrics: {
        approach_temp_k: parseFloat(ctApproach.toFixed(1)),
        fan_speed_pct:   parseFloat(rand(55, 80).toFixed(1)),
        basin_level_pct: parseFloat(rand(78, 96).toFixed(1)),
        power_kw:        parseFloat(rand(18, 28).toFixed(1)),
      },
      ...ctHealth,
    },
  ]

  return {
    timestamp: t,
    zones,
    equipment,
    kpis: {
      pue:                rand(1.3, 1.8),
      energy_kwh:         rand(310, 380), // hourly kWh for 345 kW avg hotel HVAC
      thermal_discomfort: rand(0, 5),
    },
  }
}

class MockWebSocketManager {
  private listeners: Set<SnapshotListener> = new Set()
  private statusListeners: Set<StatusListener> = new Set()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private tick = 0
  private readonly baseTimestamp = Math.floor(Date.now() / 1000) - 3600
  private _status: ConnectionStatus = 'disconnected'

  private setStatus(status: ConnectionStatus): void {
    if (this._status === status) return
    this._status = status
    this.statusListeners.forEach((l) => l(status))
  }

  onStatusChange(listener: StatusListener): () => void {
    this.statusListeners.add(listener)
    return () => this.statusListeners.delete(listener)
  }

  get connectionStatus(): ConnectionStatus {
    return this._status
  }

  connect(): void {
    if (this.intervalId) return
    this.setStatus('connected')
    this.tick = 0

    // Pre-fill 2 hours of historical data (24 × 5-min ticks) immediately
    const PREFILL_TICKS = 24
    for (let i = 0; i < PREFILL_TICKS; i++) {
      const snap = generateSnapshot(this.baseTimestamp, this.tick++)
      this.listeners.forEach((l) => l(snap))
    }

    // Then stream live updates every 2s
    this.intervalId = setInterval(() => {
      const snap = generateSnapshot(this.baseTimestamp, this.tick++)
      this.listeners.forEach((l) => l(snap))
    }, 2000)
  }

  disconnect(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }
    this.setStatus('disconnected')
  }

  subscribe(listener: SnapshotListener): void {
    this.listeners.add(listener)
  }

  unsubscribe(listener: SnapshotListener): void {
    this.listeners.delete(listener)
  }

  get isConnected(): boolean {
    return this.intervalId !== null
  }
}

export const mockWsManager = new MockWebSocketManager()
