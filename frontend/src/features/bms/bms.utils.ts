import type { BmsSnapshot, ZoneComfort, ZoneId } from './bms.types'

/** Kelvin → Celsius */
export const kToC = (k: number): number => k - 273.15

/** Format a temperature value [K input] as °C string */
export const fmtTempK = (k: number, decimals = 1): string =>
  `${(k - 273.15).toFixed(decimals)}°C`

/** Format kW */
export const fmtKw = (kw: number, decimals = 1): string =>
  `${kw.toFixed(decimals)} kW`

/** Format m³/s */
export const fmtFlow = (m3s: number): string => `${m3s.toFixed(3)} m³/s`

/** Format Pa */
export const fmtPa = (pa: number): string => `${Math.round(pa)} Pa`

/** Format L/hr */
export const fmtLph = (lph: number): string =>
  lph >= 1000
    ? `${(lph / 1000).toFixed(1)} kL/hr`
    : `${Math.round(lph)} L/hr`

/** Format PUE */
export const fmtPue = (pue: number): string => pue.toFixed(2)

/** Comfort thresholds [°C] */
const COMFORT_LO = 20.0
const COMFORT_HI = 24.0
const WARM_HI    = 26.0

export type TempStatus = 'comfort' | 'warm' | 'hot'

export function zoneTempStatus(tempK: number): TempStatus {
  const c = kToC(tempK)
  if (c < COMFORT_LO || c > WARM_HI) return 'hot'
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

const ZONES: ZoneId[] = ['cor', 'nor', 'sou', 'eas', 'wes']

export function extractZoneComfort(snap: BmsSnapshot): ZoneComfort[] {
  return ZONES.map((z) => {
    const prefix = `hvac_reaZon${z.charAt(0).toUpperCase() + z.slice(1)}`
    const tempK = snap[`${prefix}_TZon_y` as keyof BmsSnapshot] as number
    return {
      zoneId: z,
      tempC: kToC(tempK),
      co2: snap[`${prefix}_CO2Zon_y` as keyof BmsSnapshot] as number,
      flowM3s: snap[`${prefix}_V_flow_y` as keyof BmsSnapshot] as number,
      status: zoneTempStatus(tempK),
    }
  })
}

/** Build a normalized SVG polyline points string from a number array. */
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
      const y = height - ((v - min) / range) * height
      return `${x.toFixed(1)},${y.toFixed(1)}`
    })
    .join(' ')
}

/** Total power status color */
export function powerStatusColor(kw: number): string {
  if (kw < 60)  return '#22AA44'
  if (kw < 90)  return '#F59E0B'
  return '#EF4444'
}

/** PUE status color */
export function pueStatusColor(pue: number): string {
  if (pue < 1.4) return '#22AA44'
  if (pue < 1.8) return '#F59E0B'
  return '#EF4444'
}

/** CO₂ emission rate status color */
export function co2StatusColor(kgPerHr: number): string {
  if (kgPerHr < 30) return '#22AA44'
  if (kgPerHr < 50) return '#F59E0B'
  return '#EF4444'
}

const BOPTEST_URL =
  (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

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
