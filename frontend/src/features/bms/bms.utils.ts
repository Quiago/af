import type { BmsSnapshot, ZoneId } from './bms.types'

// ── Unit conversions ──────────────────────────────────────────────────────────

/** Kelvin → Celsius */
export const kToC = (k: number): number => k - 273.15

/** Celsius → Kelvin (for sending to BOPTEST) */
export const cToK = (c: number): number => c + 273.15

/** Fraction 0-1 → percent 0-100 (display) */
export const fracToPct = (f: number): number => f * 100

/** Percent 0-100 → fraction 0-1 (for BOPTEST) */
export const pctToFrac = (pct: number): number => pct / 100

/** Wind direction in radians → compass label */
export function windDirLabel(rad: number): string {
  const deg = (rad * 180) / Math.PI
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
  return dirs[Math.round(deg / 45) % 8] ?? 'N'
}

/** Sim time in seconds → "Day D HH:MM" (Day 1 = January 1) */
export function simTimeLabel(secs: number): string {
  const day  = Math.floor(secs / 86400) + 1
  const hour = Math.floor((secs % 86400) / 3600)
  const min  = Math.floor((secs % 3600) / 60)
  return `Day ${day}  ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`
}

// ── Format helpers ────────────────────────────────────────────────────────────

export const fmtTempK  = (k: number, d = 1): string => `${kToC(k).toFixed(d)}°C`
export const fmtKw     = (kw: number, d = 1): string => `${kw.toFixed(d)} kW`
export const fmtFlow   = (m3s: number): string => `${m3s.toFixed(3)} m³/s`
export const fmtPa     = (pa: number): string => `${Math.round(pa)} Pa`
export const fmtLph    = (lph: number): string =>
  lph >= 1000 ? `${(lph / 1000).toFixed(1)} kL/hr` : `${Math.round(lph)} L/hr`
export const fmtCop    = (cop: number): string => cop > 0 ? cop.toFixed(2) : '—'
export const fmtRH     = (rh: number): string => `${Math.round(rh * 100)}%`
export const fmtWind   = (mps: number): string => `${mps.toFixed(1)} m/s`
export const fmtSolar  = (wm2: number): string => `${Math.round(wm2)} W/m²`

// ── Zone comfort ──────────────────────────────────────────────────────────────

// Occupied setpoints per BOPTEST spec: heating 20°C, cooling 24°C
const COMFORT_LO = 20.0
const COMFORT_HI = 24.0
const WARM_HI    = 26.0

export type TempStatus = 'comfort' | 'warm' | 'hot'

export function zoneTempStatus(tempK: number): TempStatus {
  const c = kToC(tempK)
  if (c < COMFORT_LO - 1 || c > WARM_HI) return 'hot'
  if (c > COMFORT_HI) return 'warm'
  return 'comfort'
}

export function zoneBorderColor(status: TempStatus): string {
  switch (status) {
    case 'comfort': return '#22AA44'
    case 'warm':    return '#F59E0B'
    case 'hot':     return '#EF4444'
  }
}

// ── KPI status colors ─────────────────────────────────────────────────────────

/** Total power thresholds [kW] — from BOPTEST design specs (peak 101kW chiller + 122kW HP + fan+pumps) */
export function powerStatusColor(kw: number): string {
  if (kw < 60)  return '#22AA44'
  if (kw < 100) return '#F59E0B'
  return '#EF4444'
}

/** COP thresholds for air-cooled chiller (York YCAL0033EE) */
export function chillerCopColor(cop: number): string {
  if (cop <= 0)  return '#6B7280'
  if (cop >= 3.5) return '#22AA44'
  if (cop >= 2.5) return '#F59E0B'
  return '#EF4444'
}

/** HP COP thresholds (0.3 × Carnot COP at design) */
export function hpCopColor(cop: number): string {
  if (cop <= 0)  return '#6B7280'
  if (cop >= 3.0) return '#22AA44'
  if (cop >= 2.0) return '#F59E0B'
  return '#EF4444'
}

export function co2StatusColor(kgPerHr: number): string {
  if (kgPerHr < 20) return '#22AA44'
  if (kgPerHr < 40) return '#F59E0B'
  return '#EF4444'
}

// ── Sparkline helper ──────────────────────────────────────────────────────────

export function buildSparklinePath(
  data: number[],
  width: number,
  height: number,
): string {
  if (data.length < 2) return ''
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1
  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width
      const y = height - ((v - min) / range) * (height - 2) - 1
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

// ── Zone data extraction ──────────────────────────────────────────────────────

const ZONES: ZoneId[] = ['cor', 'nor', 'sou', 'eas', 'wes']

export function getZoneField<K extends keyof BmsSnapshot>(
  snap: BmsSnapshot,
  zoneId: ZoneId,
  field: 'TZon_y' | 'V_flow_y' | 'CO2Zon_y' | 'TSup_y',
): number {
  const capId = zoneId.charAt(0).toUpperCase() + zoneId.slice(1)
  const key = `hvac_reaZon${capId}_${field}` as K
  return snap[key] as number
}

// ── Control API ───────────────────────────────────────────────────────────────

const BOPTEST_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

/**
 * Post a setpoint override to the BMS control endpoint.
 * Values MUST already be in BOPTEST native units:
 *   - temperatures → Kelvin
 *   - fractions    → 0.0–1.0
 *   - pressures    → Pa
 */
export async function postControl(payload: {
  point_name: string
  value: number
  activate: number
}): Promise<void> {
  const res = await fetch(`${BOPTEST_URL}/api/v1/bms/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`BMS control failed: ${res.status}`)
}
