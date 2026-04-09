export interface ZoneState {
  id: 'nor' | 'sou' | 'eas' | 'wes' | 'cor'
  temperature: number      // °C
  humidity: number         // 0-100 %
  co2: number              // ppm
  damperPosition: number   // 0-1
}

export interface SolarState {
  elevation: number    // radians
  azimuth: number      // radians
  irradiance: number   // W/m²
}

export interface WeatherState {
  externalTemp: number      // °C
  relativeHumidity: number  // 0-100
  windSpeed: number         // m/s
  windDirection: number     // radians
}

export interface DigitalTwinState {
  solar: SolarState
  weather: WeatherState
  zones: Record<ZoneState['id'], ZoneState>
  activeFloor: number
  isLiveData: boolean   // true = BOPTEST connected, false = fallback sim
}
