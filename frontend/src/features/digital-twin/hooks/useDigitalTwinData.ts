import { useMemo } from 'react'
import { useDashboardStore } from '../../../store/dashboardStore'
import { solarPosition, externalTemp, externalRH, zoneThermalModel } from '../lib/solarPhysics'
import type { DigitalTwinState, SolarState, ZoneState } from '../types/digitalTwin.types'

const K_TO_C = 273.15
const SETPOINT_C = 23.5

// ─── Helpers ─────────────────────────────────────────────────────────────────

function kToC(k: number): number { return k - K_TO_C }

function currentHourOfDay(): number {
  const now = new Date()
  return now.getHours() + now.getMinutes() / 60
}

// ─── Return type ──────────────────────────────────────────────────────────────

export interface DigitalTwinDataResult {
  liveData: DigitalTwinState        // always raw BOPTEST/physics — no overrides
  projectedData: DigitalTwinState   // liveData + simulation overrides when active
  isSimulating: boolean
  activeSimulationId: string | null
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useDigitalTwinData(): DigitalTwinDataResult {
  const snapshot    = useDashboardStore((s) => s.snapshot)
  const connStatus  = useDashboardStore((s) => s.connectionStatus)
  const activeFloor = useDashboardStore((s) => s.selectedFloor)
  const simulation  = useDashboardStore((s) => s.simulationProjection)
  const isLiveData  = connStatus === 'connected' && snapshot !== null

  const { liveData, projectedData } = useMemo(() => {
    const hourOfDay = currentHourOfDay()

    // ── Solar & weather ────────────────────────────────────────────────────
    const sp = solarPosition(hourOfDay)
    let solar: SolarState = { elevation: sp.el, azimuth: sp.az, irradiance: sp.irr }
    let externalTempC = externalTemp(hourOfDay)
    let relativeHumidity = externalRH(hourOfDay)
    let windSpeed = 2.5
    let windDirection = Math.PI * 0.75

    if (isLiveData && snapshot) {
      const s = snapshot as unknown as Record<string, number | undefined>
      const solAlt  = s['weaSta_reaWeaSolAlt_y']
      const solHou  = s['weaSta_reaWeaSolHouAng_y']
      const dirNor  = s['weaSta_reaWeaHDirNor_y']
      const tDryBul = s['weaSta_reaWeaTDryBul_y']
      const relHum  = s['weaSta_reaWeaRelHum_y']
      const winSpe  = s['weaSta_reaWeaWinSpe_y']
      const winDir  = s['weaSta_reaWeaWinDir_y']

      if (solAlt != null && solHou != null) {
        solar = { elevation: solAlt, azimuth: Math.PI - solHou, irradiance: dirNor ?? solar.irradiance }
      }
      if (tDryBul != null) externalTempC     = kToC(tDryBul)
      if (relHum   != null) relativeHumidity = relHum * 100
      if (winSpe   != null) windSpeed        = winSpe
      if (winDir   != null) windDirection    = winDir
    }

    // ── Base zones (live/physics — no overrides) ───────────────────────────
    const zoneIds: ZoneState['id'][] = ['nor', 'sou', 'eas', 'wes', 'cor']
    const baseZones = {} as Record<ZoneState['id'], ZoneState>

    for (const id of zoneIds) {
      const cap = id.charAt(0).toUpperCase() + id.slice(1)
      if (isLiveData && snapshot) {
        const s = snapshot as unknown as Record<string, number | undefined>
        const tempK  = s[`hvac_reaZon${cap}_TZon_y`]
        const co2    = s[`hvac_reaZon${cap}_CO2Zon_y`]
        const damper = s[`hvac_oveZonAct${cap}_yDam_u`]
        const humidity = Math.max(30, Math.min(65, relativeHumidity * 0.55 + 18))
        baseZones[id] = {
          id,
          temperature:    tempK != null ? kToC(tempK) : SETPOINT_C,
          humidity,
          co2:            co2    ?? 600,
          damperPosition: damper ?? 0.4,
        }
      } else {
        const thermal = zoneThermalModel(id, { hourOfDay, setpointC: SETPOINT_C })
        baseZones[id] = {
          id,
          temperature:    thermal.temperature,
          humidity:       thermal.humidity,
          co2:            thermal.co2,
          damperPosition: thermal.damperPosition,
        }
      }
    }

    const solarState: SolarState = {
      elevation:  solar.elevation,
      azimuth:    solar.azimuth,
      irradiance: solar.irradiance,
    }
    const weatherState = { externalTemp: externalTempC, relativeHumidity, windSpeed, windDirection }

    const liveData: DigitalTwinState = {
      solar: solarState,
      weather: weatherState,
      zones: baseZones,
      activeFloor,
      isLiveData,
    }

    // ── Projected zones — apply simulation overrides ───────────────────────
    let projectedData = liveData
    if (simulation) {
      const projectedZones = { ...baseZones }
      for (const [zoneId, override] of Object.entries(simulation.zoneOverrides)) {
        const id = zoneId as ZoneState['id']
        if (projectedZones[id] && override) {
          projectedZones[id] = {
            ...projectedZones[id],
            ...(override.temperature    != null ? { temperature: override.temperature }       : {}),
            ...(override.damperPosition != null ? { damperPosition: override.damperPosition } : {}),
            ...(override.co2            != null ? { co2: override.co2 }                       : {}),
          }
        }
      }
      projectedData = { ...liveData, zones: projectedZones }
    }

    return { liveData, projectedData }
  }, [snapshot, isLiveData, activeFloor, simulation])

  return {
    liveData,
    projectedData,
    isSimulating: simulation !== null,
    activeSimulationId: simulation?.recommendationId ?? null,
  }
}
