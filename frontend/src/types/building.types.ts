export interface ZoneData {
  id: string        // "cor" | "eas" | "nor" | "sou" | "wes"
  name: string
  temperature: number       // Celsius
  setpoint: number          // Celsius (midpoint of lower/upper)
  setpoint_lower?: number   // Celsius
  setpoint_upper?: number   // Celsius
  co2?: number              // ppm
  occupancy?: boolean
  row?: number              // grid position 0-2
  col?: number              // grid position 0-2
}

export interface HealthMetric {
  label: string
  value: number       // 0-100 score
  displayValue: string
  status: 'ok' | 'warning' | 'critical'
}

export interface EquipmentData {
  id: string
  name: string
  type: 'chiller' | 'ahu' | 'filter' | 'cooling_tower'
  status: 'ok' | 'warning' | 'critical' | 'offline'
  metrics: Record<string, number>
  healthScore?: number
  healthMetrics?: HealthMetric[]
  lastServiceDate?: string | null
  zone?: string | null
  parentId?: string | null
}

export interface BuildingSnapshot {
  timestamp: number           // Unix seconds (wall clock)
  simulation_time?: number    // BOPTEST simulation time in seconds
  zones: ZoneData[]
  equipment: EquipmentData[]
  kpis: {
    pue?: number | null
    energy_kwh?: number | null
    thermal_discomfort?: number | null
    cost_total?: number | null
  }
}

// Time-series history returned by GET /api/v1/building/history
export interface HistoryPoint {
  timestamp: number           // Unix seconds (bucket start)
  core_temp_c: number | null
  fan_power_w: number | null
  core_co2_ppm: number | null
}

export type Resolution = '1m' | '1h' | '1d' | '1y'

/** A single preset controls both the fetch window and the bucket resolution. */
export type TimePreset = '1h' | '1d' | '1M' | '1y'

export type ActiveView = 'dash' | 'report' | 'maint' | 'bms'

// ─── Benchmark ────────────────────────────────────────────────────────────────

export interface PeriodKPIs {
  energy_kwh_m2: number
  energy_kwh: number
  thermal_discomfort_kh: number
  cost_usd_m2: number
  cost_usd: number
}

export interface SavingsSummary {
  energy_pct: number
  energy_kwh: number
  cost_aed: number
  cost_aed_annual: number
  discomfort_pct: number
}

export interface BenchmarkResult {
  run_id: string
  scenario: string
  period_days: number
  started_at: string
  completed_at: string | null
  status: 'pending' | 'running_baseline' | 'running_optimized' | 'completed' | 'failed'
  progress_pct: number
  baseline: PeriodKPIs | null
  optimized: PeriodKPIs | null
  savings: SavingsSummary | null
  error: string | null
}
