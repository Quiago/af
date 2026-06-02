import type { ZoneState } from '../types/digitalTwin.types'

// ─── Constants ────────────────────────────────────────────────────────────────

const LAT_RAD = (25.2048 * Math.PI) / 180  // Dubai (25hours Hotel demo facility)
const DAY_OF_YEAR = 199                     // peak_cool_day scenario (mid-July)

// ─── Solar position ────────────────────────────────────────────────────────

/**
 * Compute solar elevation, azimuth, and estimated direct normal irradiance
 * using standard declination + hour angle formula.
 *
 * @param hourOfDay - decimal hour in local solar time (0–24)
 * @param lat       - latitude in radians (default Chicago)
 * @param dayOfYear - day of year 1–365 (default peak_cool_day = 199)
 */
export function solarPosition(
  hourOfDay: number,
  lat: number = LAT_RAD,
  dayOfYear: number = DAY_OF_YEAR,
): { el: number; az: number; irr: number } {
  const decl = (23.45 * Math.PI) / 180 * Math.sin((2 * Math.PI * (284 + dayOfYear)) / 365)
  const hourAngle = ((hourOfDay - 12) * 15 * Math.PI) / 180

  const sinEl =
    Math.sin(lat) * Math.sin(decl) +
    Math.cos(lat) * Math.cos(decl) * Math.cos(hourAngle)
  const el = Math.asin(Math.max(-1, Math.min(1, sinEl)))

  const cosAz =
    (Math.sin(decl) * Math.cos(lat) - Math.cos(decl) * Math.sin(lat) * Math.cos(hourAngle)) /
    Math.max(0.001, Math.cos(el))
  const azRaw = Math.acos(Math.max(-1, Math.min(1, cosAz)))
  const az = hourOfDay > 12 ? 2 * Math.PI - azRaw : azRaw

  // Clear-sky DNI approximation — falls off with air mass
  const irr = el > 0 ? 1000 * Math.pow(0.7, 1 / Math.max(0.01, Math.sin(el))) : 0

  return { el, az, irr: Math.max(0, irr) }
}

// ─── External temperature fallback ────────────────────────────────────────────

/**
 * Chicago summer daily temperature cycle for peak_cool_day (°C).
 * Follows a realistic sine curve: min at 05:00, max at 15:00.
 */
export function externalTemp(hourOfDay: number): number {
  const minTemp = 22
  const maxTemp = 36
  const amp = (maxTemp - minTemp) / 2
  return minTemp + amp * (1 + Math.sin(((hourOfDay - 5) / 24) * 2 * Math.PI - Math.PI / 2))
}

/**
 * Relative humidity inversely correlated with temperature.
 */
export function externalRH(hourOfDay: number): number {
  const temp = externalTemp(hourOfDay)
  return Math.max(20, Math.min(90, 85 - (temp - 22) * 1.6))
}

// ─── Zone thermal fallback ─────────────────────────────────────────────────────

export interface ZoneThermalInputs {
  hourOfDay: number
  setpointC: number
}

export interface ZoneThermalState {
  temperature: number    // °C
  humidity: number       // 0-100
  co2: number            // ppm
  damperPosition: number // 0-1
}

/**
 * Simple RC-model fallback zone thermal state when BOPTEST is offline.
 * Each zone has slight offsets to demonstrate temperature differentiation.
 */
const ZONE_OFFSETS: Record<ZoneState['id'], number> = {
  nor: -1.2,
  sou:  1.4,
  eas:  2.6,
  wes: -0.4,
  cor:  0.2,
}

export function zoneThermalModel(
  zoneId: ZoneState['id'],
  inputs: ZoneThermalInputs,
): ZoneThermalState {
  const extT = externalTemp(inputs.hourOfDay)
  const solar = solarPosition(inputs.hourOfDay)
  const solarGain = solar.el > 0 ? solar.irr * 0.0035 : 0
  const offset = ZONE_OFFSETS[zoneId]

  const temperature = inputs.setpointC + offset + solarGain * (zoneId === 'sou' ? 1.3 : 0.7)
  const humidity = Math.max(30, Math.min(70, externalRH(inputs.hourOfDay) * 0.6 + 20))

  // Occupancy-driven CO2: peaks at 09:00 and 14:00
  const h = inputs.hourOfDay
  const occupied = h >= 8 && h <= 18
  const occ = occupied ? 0.7 + 0.3 * Math.sin(((h - 8) / 10) * Math.PI) : 0
  const co2 = 420 + occ * 580

  // Damper more open when zone is warm
  const delta = temperature - inputs.setpointC
  const damperPosition = Math.max(0.1, Math.min(1, 0.3 + delta * 0.15 + (extT - 24) * 0.02))

  return { temperature, humidity, co2, damperPosition }
}
