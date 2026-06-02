import { ZONE_IDS, type ZoneId } from './buildingLayout'

// ─── Dynamic zone thermal model ───────────────────────────────────────────────
// Per-zone air temperature as a function of exterior conditions (shared by the
// 3D scene labels and the top metric cards so they stay consistent).
//   extTemp       — exterior air temperature (°C), from the UI spinner
//   simHour       — time of day 0–24
//   incidenceZone — façade currently receiving direct solar gain (or null)
// Mixing ratios (higher = more coupled to exterior): perimeter ≈ 0.40–0.44,
// core ≈ 0.18 (insulated, equipment-dominated).

export const ZONE_MIXING: Record<ZoneId, number> = {
  nor: 0.42, sou: 0.40, eas: 0.44, wes: 0.44, cor: 0.18,
}
export const HVAC_SETPOINT = 22.5  // °C — representative HVAC target

export function computeZoneTemps(
  extTemp: number,
  simHour: number,
  incidenceZone: ZoneId | null,
): Record<ZoneId, number> {
  const h = ((simHour % 24) + 24) % 24
  const solarFrac = (h >= 6 && h <= 20) ? Math.sin(Math.PI * (h - 6) / 14) : 0
  const result = {} as Record<ZoneId, number>
  for (const id of ZONE_IDS) {
    const mix  = ZONE_MIXING[id]!
    const base = mix * extTemp + (1 - mix) * HVAC_SETPOINT + solarFrac * mix * 1.8
    const solar = id === incidenceZone ? solarFrac * 4.2 : 0
    result[id] = base + solar
  }
  return result
}
