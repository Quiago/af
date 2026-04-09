export type SimZoneId = 'nor' | 'sou' | 'eas' | 'wes' | 'cor'

export interface ZoneProjectionOverride {
  temperature?: number      // absolute °C override
  damperPosition?: number   // 0–1 override
  co2?: number              // ppm override
}

export type DebugMetricKey = 'zone_temp' | 'zone_co2' | 'fan_power'

export interface PrimaryMetric {
  key: DebugMetricKey
  label: string       // e.g. "Damper effect — Core Temp"
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
