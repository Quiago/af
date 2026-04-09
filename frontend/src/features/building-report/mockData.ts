/**
 * Mock data for the Building Report dashboard.
 * Enabled when VITE_MOCKED_DATA=true in .env
 *
 * All data is plausible for a medium-size Dubai office building (~3000 m²)
 * running the BOPTEST multizone_office_simple_air scenario.
 */

export const IS_MOCKED = import.meta.env.VITE_MOCKED_DATA === 'true'

// ── Helpers ────────────────────────────────────────────────────────────────────

function randn(mean: number, std: number) {
  // Box-Muller
  const u = Math.random(), v = Math.random()
  return mean + std * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
}

function clamp(v: number, lo: number, hi: number) { return Math.max(lo, Math.min(hi, v)) }

// ── Time-series ────────────────────────────────────────────────────────────────

export type MockPoint = {
  timestamp: number      // unix seconds
  fan_power_w: number
  core_temp_c: number
  core_co2_ppm: number
  tariff_aed_kwh: number // 0.23 off-peak / 0.38 peak (summer 12-18h)
}

/**
 * Generate N hours of mock time-series ending now.
 * Points are every 5 minutes (12 per hour).
 */
export function generateMockTimeSeries(hours = 24): MockPoint[] {
  const now   = Math.floor(Date.now() / 1000)
  const step  = 300 // 5 min
  const count = hours * 12
  const start = now - count * step

  let temp  = 22.5
  let co2   = 620
  let power = 3200

  return Array.from({ length: count }, (_, i) => {
    const ts = start + i * step
    const d  = new Date(ts * 1000)
    const h  = d.getHours()
    const m  = d.getMonth() + 1          // 1-12
    const isSummer = m >= 5 && m <= 10
    const isPeak   = isSummer && h >= 12 && h < 18
    const isOccupied = h >= 8 && h < 19  // office hours

    // Smooth walk
    temp  = clamp(temp  + randn(0, 0.08), 20, 26)
    co2   = clamp(co2   + randn(isOccupied ? 5 : -3, 8),  400, 1100)
    power = clamp(power + randn(isOccupied ? 10 : -20, 80), 800, 6500)

    return {
      timestamp:      ts,
      fan_power_w:    Math.round(power),
      core_temp_c:    parseFloat(temp.toFixed(2)),
      core_co2_ppm:   Math.round(co2),
      tariff_aed_kwh: isPeak ? 0.38 : 0.23,
    }
  })
}

// ── Building average load (25hours Hotel Dubai, ~180 rooms, 12 000 m²)
// Chiller plant: 280 kW · AHU fans total: 65 kW · avg total HVAC: 345 kW
// INAIA 18.3% savings → AED 175 000/yr · CO₂ factor 0.45 kg/kWh UAE grid
// ──────────────────────────────────────────────────────────────────────────────

// ── Equipment ─────────────────────────────────────────────────────────────────

export type MockEquipment = {
  id: string
  name: string
  type: string
  healthScore: number
  status: 'ok' | 'warning' | 'critical' | 'offline'
  displayMetric: string
  lastServiceDate: string
  healthMetrics: { label: string; value: number; displayValue: string; status: 'ok' | 'warning' | 'critical' }[]
}

export const MOCK_EQUIPMENT: MockEquipment[] = [
  {
    id: 'chiller-1',
    name: 'Chiller Unit C1',
    type: 'chiller',
    healthScore: 88,
    status: 'ok',
    displayMetric: 'COP 4.2',
    lastServiceDate: '2025-11-15',
    healthMetrics: [
      { label: 'Compressor Efficiency', value: 88, displayValue: '88%',   status: 'ok' },
      { label: 'Refrigerant Pressure',  value: 75, displayValue: '18.2 bar', status: 'ok' },
      { label: 'Condenser ΔT',          value: 90, displayValue: '5.1 K', status: 'ok' },
    ],
  },
  {
    id: 'ahu-1',
    name: 'AHU — Floor 1–3',
    type: 'ahu',
    healthScore: 72,
    status: 'warning',
    displayMetric: 'Fan 3 150 W',
    lastServiceDate: '2025-09-20',
    healthMetrics: [
      { label: 'Fan Motor Load',   value: 72, displayValue: '72%',    status: 'warning' },
      { label: 'Filter ΔP',        value: 55, displayValue: '180 Pa', status: 'warning' },
      { label: 'Coil Fouling',     value: 85, displayValue: 'Low',    status: 'ok' },
    ],
  },
  {
    id: 'ahu-2',
    name: 'AHU — Floor 4–6',
    type: 'ahu',
    healthScore: 91,
    status: 'ok',
    displayMetric: 'Fan 2 870 W',
    lastServiceDate: '2025-12-01',
    healthMetrics: [
      { label: 'Fan Motor Load',   value: 91, displayValue: '91%',    status: 'ok' },
      { label: 'Filter ΔP',        value: 82, displayValue: '95 Pa',  status: 'ok' },
      { label: 'Coil Fouling',     value: 95, displayValue: 'Very low', status: 'ok' },
    ],
  },
  {
    id: 'filter-1',
    name: 'Primary Filter Bank',
    type: 'filter',
    healthScore: 38,
    status: 'critical',
    displayMetric: 'ΔP 340 Pa',
    lastServiceDate: '2025-06-10',
    healthMetrics: [
      { label: 'Differential Pressure', value: 38, displayValue: '340 Pa', status: 'critical' },
      { label: 'Remaining Life',         value: 20, displayValue: '~3 wk',  status: 'critical' },
      { label: 'Bypass Leakage',         value: 70, displayValue: 'Low',    status: 'ok' },
    ],
  },
  {
    id: 'cooling-tower-1',
    name: 'Cooling Tower CT1',
    type: 'cooling_tower',
    healthScore: 95,
    status: 'ok',
    displayMetric: 'Approach 2.1 K',
    lastServiceDate: '2026-01-08',
    healthMetrics: [
      { label: 'Approach Temp',     value: 95, displayValue: '2.1 K', status: 'ok' },
      { label: 'Basin Level',       value: 90, displayValue: 'Nominal', status: 'ok' },
      { label: 'Fan Vibration',     value: 85, displayValue: '0.8 mm/s', status: 'ok' },
    ],
  },
]

// ── Zones ─────────────────────────────────────────────────────────────────────

export type MockZone = {
  id: string
  temperature: number
  setpoint: number
  co2: number
  occupancy: boolean
  comfortScore: number
}

// Hotel zone IDs: descriptive of 25hours Hotel context
const ZONE_NAMES = ['LOBBY', 'F&B_LOUNGE', 'GR_NORTH_F1', 'GR_SOUTH_F1', 'CORRIDOR_F2', 'GR_NORTH_F2']

export const MOCK_ZONES: MockZone[] = ZONE_NAMES.map((id) => {
  const sp   = 22.0  // hotel standard comfort setpoint
  const temp = clamp(randn(sp, 1.2), 19, 26)
  const co2  = clamp(Math.round(randn(650, 120)), 400, 1100)
  const occ  = co2 > 600 && temp > 21
  const tScore = Math.max(0, 100 - Math.abs(temp - sp) * 20)
  const cScore = Math.max(0, 100 - Math.max(0, co2 - 400) / 8)
  return {
    id,
    temperature: parseFloat(temp.toFixed(1)),
    setpoint: sp,
    co2,
    occupancy: occ,
    comfortScore: Math.round((tScore + cScore) / 2),
  }
  // stable seed per build run
}, [] as MockZone[])

// ── KPI snapshot ──────────────────────────────────────────────────────────────

export type MockKpis = {
  energy_kwh: number
  thermal_discomfort: number
  fan_power_w: number
  chiller_power_w: number
}

export const MOCK_KPIS: MockKpis = {
  energy_kwh:         345,    // kWh in the last hour (345 kW × 1 h)
  thermal_discomfort: 3.2,
  fan_power_w:        65000,  // 65 kW total AHU fans
  chiller_power_w:    280000, // 280 kW central chiller plant
}

// ── Benchmark savings ─────────────────────────────────────────────────────────

export const MOCK_SAVINGS = {
  energy_kwh:      1_515,   // kWh saved per day (18.3 % of 8 280 kWh/day)
  energy_pct:      18.3,
  cost_aed_annual: 175_000, // AED 175 000/year vs unoptimised baseline
}

// ── Comparison chart ──────────────────────────────────────────────────────────

export type ComparisonPoint = {
  timestamp: number
  inaia:     number
  baseline:  number
}

export type ComparisonVariable = 'energy' | 'cost' | 'co2'

const PRESET_CONFIG: Record<string, { stepMin: number; count: number }> = {
  '1h': { stepMin: 5,    count: 12  },
  '1d': { stepMin: 30,   count: 48  },
  '1M': { stepMin: 360,  count: 120 },
  '1y': { stepMin: 1440, count: 365 },
}

/**
 * Generate comparison chart data (INAIA vs Baseline) for a given time preset
 * and variable type. Called inside useEffect so Math.random() is fine.
 */
export function generateComparisonData(
  preset: string,
  variable: ComparisonVariable,
): ComparisonPoint[] {
  const { stepMin, count } = PRESET_CONFIG[preset] ?? PRESET_CONFIG['1d']
  const now   = Math.floor(Date.now() / 1000)
  const step  = stepMin * 60
  const start = now - count * step

  // Average HVAC load 345 kW (280 kW chiller + 65 kW fans) → kWh per interval
  const kwhPerStep = 345 * (stepMin / 60)
  let baseEnergy   = kwhPerStep

  return Array.from({ length: count }, (_, i) => {
    const ts = start + i * step
    const d  = new Date(ts * 1000)
    const h  = d.getHours()
    const mo = d.getMonth() + 1
    const isSummer   = mo >= 5 && mo <= 10
    const isPeak     = isSummer && h >= 12 && h < 18
    const isOccupied = h >= 7 && h < 20

    const loadFactor = isOccupied ? (isPeak ? 1.35 : 1.15) : 0.65
    baseEnergy = clamp(
      baseEnergy + randn(0, kwhPerStep * 0.04),
      kwhPerStep * 0.4,
      kwhPerStep * 1.6,
    )

    const baselineEnergy = baseEnergy * loadFactor
    const savingsFactor  = clamp(randn(0.817, 0.015), 0.78, 0.86)
    const inaiaEnergy    = baselineEnergy * savingsFactor

    let baseline: number, inaia: number

    if (variable === 'energy') {
      baseline = baselineEnergy
      inaia    = inaiaEnergy
    } else if (variable === 'cost') {
      const tariff = isPeak ? 0.38 : 0.23
      baseline = baselineEnergy * tariff
      inaia    = inaiaEnergy    * tariff
    } else {
      // co2 in kg
      baseline = baselineEnergy * 0.45
      inaia    = inaiaEnergy    * 0.45
    }

    return {
      timestamp: ts,
      inaia:    parseFloat(inaia.toFixed(2)),
      baseline: parseFloat(baseline.toFixed(2)),
    }
  })
}

// ── Zone Performance ──────────────────────────────────────────────────────────

export type ZonePerformanceRow = {
  zone:             string
  floor:            string
  energyKwh:        number
  costAed:          number
  co2Kg:            number
  autonomous:       boolean
  performanceScore: number
}

// Hotel-scale base energy per zone (kWh/h at avg HVAC load)
// Total of 6 zones = 74.6 kWh/h ≈ 74.6 kW zone subset of 345 kW plant
const ZONE_BASE_KWH_H: Record<string, number> = {
  LOBBY:        18.5, // large lobby + reception air handling
  'F&B_LOUNGE': 14.2, // restaurant/bar — high OA + cooling load
  GR_NORTH_F1:  14.8, // guestrooms north wing floor 1
  GR_SOUTH_F1:  13.2, // guestrooms south wing floor 1
  CORRIDOR_F2:   4.9, // corridor + service — lower load
  GR_NORTH_F2:  13.0, // guestrooms north wing floor 2
}

const ZONE_FLOOR_MAP: Record<string, string> = {
  LOBBY:        'Ground Floor',
  'F&B_LOUNGE': 'Ground Floor',
  GR_NORTH_F1:  'Floor 1',
  GR_SOUTH_F1:  'Floor 1',
  CORRIDOR_F2:  'Floor 2',
  GR_NORTH_F2:  'Floor 2',
}

const ZONE_AUTONOMOUS_MAP: Record<string, boolean> = {
  LOBBY:        true,
  'F&B_LOUNGE': true,
  GR_NORTH_F1:  true,
  GR_SOUTH_F1:  false,  // manual — demo of mixed autonomy
  CORRIDOR_F2:  false,
  GR_NORTH_F2:  true,
}

const ZONE_PERF_SCORE: Record<string, number> = {
  LOBBY:        91,
  'F&B_LOUNGE': 87,
  GR_NORTH_F1:  85,
  GR_SOUTH_F1:  62,  // not autonomous → lower efficiency score
  CORRIDOR_F2:  55,
  GR_NORTH_F2:  83,
}

const PRESET_HOURS: Record<string, number> = {
  '1h': 1,
  '1d': 24,
  '1M': 24 * 30,
  '1y': 24 * 365,
}

const BLENDED_TARIFF = 0.285  // AED/kWh
const CO2_FACTOR     = 0.45   // kg/kWh
const INAIA_FACTOR   = 0.817  // 18.3% savings when autonomous

export function getMockZonePerformance(preset: string): ZonePerformanceRow[] {
  const hours = PRESET_HOURS[preset] ?? 24
  return ZONE_NAMES.map((id) => {
    const isAuto  = ZONE_AUTONOMOUS_MAP[id] ?? false
    const factor  = isAuto ? INAIA_FACTOR : 1.0
    const baseKwh = (ZONE_BASE_KWH_H[id] ?? 2.5) * hours * factor
    return {
      zone:             id,
      floor:            ZONE_FLOOR_MAP[id] ?? 'Floor 1',
      energyKwh:        parseFloat(baseKwh.toFixed(1)),
      costAed:          parseFloat((baseKwh * BLENDED_TARIFF).toFixed(2)),
      co2Kg:            parseFloat((baseKwh * CO2_FACTOR).toFixed(2)),
      autonomous:       isAuto,
      performanceScore: ZONE_PERF_SCORE[id] ?? 70,
    }
  })
}
