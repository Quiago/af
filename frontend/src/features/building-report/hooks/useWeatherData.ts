import { useQuery } from '@tanstack/react-query'

// Dubai, UAE
const LAT = 25.2048
const LON = 55.2708

export interface WeatherCurrent {
  temperature_2m: number
  relative_humidity_2m: number
  wind_speed_10m: number
  shortwave_radiation: number
}

export interface WeatherHourly {
  time: string[]                  // ISO 8601, local Dubai time
  temperature_2m: number[]
  relative_humidity_2m: number[]
  shortwave_radiation: number[]
  precipitation_probability: number[]
}

export interface WeatherData {
  current: WeatherCurrent
  hourly: WeatherHourly
}

export function useWeatherData() {
  return useQuery<WeatherData>({
    queryKey: ['weather-dubai'],
    queryFn: async () => {
      const params = new URLSearchParams({
        latitude: String(LAT),
        longitude: String(LON),
        current: 'temperature_2m,relative_humidity_2m,wind_speed_10m,shortwave_radiation',
        hourly: 'temperature_2m,relative_humidity_2m,shortwave_radiation,precipitation_probability',
        forecast_days: '2',
        timezone: 'Asia/Dubai',
      })
      const res = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
      if (!res.ok) throw new Error(`Weather API ${res.status}`)
      return res.json() as Promise<WeatherData>
    },
    staleTime: 10 * 60 * 1000,   // cache 10 min
    retry: 2,
    retryDelay: 5000,
  })
}
