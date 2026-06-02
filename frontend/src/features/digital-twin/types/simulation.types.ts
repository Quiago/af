export type SimZoneId = 'nor' | 'sou' | 'eas' | 'wes' | 'cor'

export interface ZoneProjectionOverride {
  temperature?: number      // absolute °C override
  damperPosition?: number   // 0–1 override
  co2?: number              // ppm override
}

export type DebugMetricKey = 'zone_temp' | 'zone_co2' | 'fan_power'

export interface PrimaryMetric {
  key: DebugMetricKey
  label: string       // e.g. "Peak setpoint — Guestrooms W"
  unit: string        // e.g. "°C"
  zoneId?: SimZoneId  // required for zone_temp / zone_co2
}

/** Snapshot of the recommendation card data captured at simulate-click time */
export interface RecSnapshot {
  zone:         string
  severity:     'high' | 'medium'
  confidence:   number
  reason:       string
  currentLabel: string
  currentVal:   string
  recLabel:     string
  recVal:       string
  unit:         string
  impact:       string
}

/**
 * A pending CFD cinematic, set when a recommendation is applied. The 3D scene
 * plays it once (focus the primary zone, fly through the floor, zoom out) then
 * clears it. jobId makes each apply unique so a re-render can't replay it.
 */
export interface CfdCinematic {
  jobId:         string
  floor:         number
  primaryZoneId: SimZoneId       // zone the change applies to — focused first
  zoneIds:       SimZoneId[]     // flythrough order (primary first)
  kpiDeltas:     { energy: number; comfort: number; co2: number }  // % change, for the live metric deltas
}

export interface SimulationProjection {
  recommendationId: string
  zoneOverrides: Partial<Record<SimZoneId, ZoneProjectionOverride>>
  kpiDeltas: {
    energy: number    // percent change, e.g. -47
    comfort: number   // percent change, e.g. +2
    co2: number       // percent change, e.g. -12
  }
  label: string
  primaryMetric: PrimaryMetric
  recSnapshot: RecSnapshot
}
