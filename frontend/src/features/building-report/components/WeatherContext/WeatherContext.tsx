import { useWeatherData } from '../../hooks/useWeatherData'
import type { ZoneData } from '../../../../types/building.types'
import './WeatherContext.css'

// ── SVG Sparkline for 48h forecast ────────────────────────────────────────────

function ForecastSparkline({
  temps,
  radiation,
  times,
}: {
  temps: number[]
  radiation: number[]
  times: string[]
}) {
  if (temps.length === 0) return <div className="wx-spark-placeholder">No forecast data</div>

  const W = 600, H = 90
  const slice = 48
  const T = temps.slice(0, slice)
  const R = radiation.slice(0, slice)
  const Ti = times.slice(0, slice)

  const minT = Math.min(...T)
  const maxT = Math.max(...T)
  const maxR = Math.max(...R, 1)

  const pad = { top: 8, bottom: 20, left: 0, right: 0 }
  const chartH = H - pad.top - pad.bottom
  const chartW = W

  const tx = (i: number) => (i / (T.length - 1)) * chartW
  const ty = (v: number) =>
    pad.top + chartH - ((v - minT) / (maxT - minT + 0.001)) * chartH
  const ry = (v: number) =>
    H - pad.bottom - (v / maxR) * (chartH * 0.55)

  const tempPath = T.map((t, i) => `${i === 0 ? 'M' : 'L'}${tx(i).toFixed(1)} ${ty(t).toFixed(1)}`).join(' ')

  const radPath = R.map((r, i) => `${i === 0 ? 'M' : 'L'}${tx(i).toFixed(1)} ${ry(r).toFixed(1)}`).join(' ')
  const radAreaPath = `${radPath} L${chartW} ${H - pad.bottom} L0 ${H - pad.bottom} Z`

  // Hour tick marks at every 6h
  const ticks: { x: number; label: string }[] = []
  Ti.forEach((t, i) => {
    const h = parseInt(t.split('T')[1]?.split(':')[0] ?? '99', 10)
    if (h % 6 === 0) {
      ticks.push({
        x: tx(i),
        label: h === 0 ? t.split('T')[0]?.slice(5) ?? '' : `${h}:00`,
      })
    }
  })

  // Peak tariff shade bands (12-18 Dubai local)
  const peakBands: { x1: number; x2: number }[] = []
  for (let i = 0; i < Ti.length - 1; i++) {
    const h = parseInt(Ti[i].split('T')[1]?.split(':')[0] ?? '99', 10)
    if (h >= 12 && h < 18) {
      const last = peakBands[peakBands.length - 1]
      if (last && last.x2 >= tx(i) - 2) {
        last.x2 = tx(i + 1)
      } else {
        peakBands.push({ x1: tx(i), x2: tx(i + 1) })
      }
    }
  }

  return (
    <svg
      width="100%"
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
      className="wx-spark-svg"
    >
      <defs>
        <linearGradient id="radGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F59E0B" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#F59E0B" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Peak tariff shade */}
      {peakBands.map((b, i) => (
        <rect
          key={i}
          x={b.x1}
          y={pad.top}
          width={b.x2 - b.x1}
          height={chartH}
          fill="rgba(239,68,68,0.06)"
        />
      ))}

      {/* Solar radiation area */}
      <path d={radAreaPath} fill="url(#radGrad)" />
      <path d={radPath} fill="none" stroke="rgba(245,158,11,0.45)" strokeWidth="1" />

      {/* Temperature line */}
      <path d={tempPath} fill="none" stroke="#EF4444" strokeWidth="2" strokeLinejoin="round" />

      {/* Baseline at 22°C */}
      {minT <= 22 && 22 <= maxT && (
        <line
          x1={0} y1={ty(22)} x2={W} y2={ty(22)}
          stroke="rgba(78,93,109,0.4)"
          strokeWidth="1"
          strokeDasharray="4 3"
        />
      )}

      {/* X-axis ticks */}
      {ticks.map((tk, i) => (
        <g key={i}>
          <line x1={tk.x} y1={H - pad.bottom} x2={tk.x} y2={H - pad.bottom + 3}
            stroke="rgba(78,93,109,0.4)" strokeWidth="1" />
          <text
            x={tk.x}
            y={H - 2}
            textAnchor="middle"
            fontSize="8"
            fill="rgba(78,93,109,0.7)"
            fontFamily="'IBM Plex Mono', monospace"
          >
            {tk.label}
          </text>
        </g>
      ))}

      {/* Min/Max labels */}
      <text x={4} y={ty(maxT) + 10} fontSize="8" fill="rgba(239,68,68,0.8)"
        fontFamily="'IBM Plex Mono', monospace">{maxT.toFixed(0)}°</text>
      <text x={4} y={ty(minT) - 2} fontSize="8" fill="rgba(239,68,68,0.8)"
        fontFamily="'IBM Plex Mono', monospace">{minT.toFixed(0)}°</text>
    </svg>
  )
}

// ── Occupancy bar per zone ────────────────────────────────────────────────────

function OccupancyBar({ zone }: { zone: ZoneData }) {
  const co2  = zone.co2 ?? 0
  const occ  = zone.occupancy || co2 > 600
  const pct  = Math.min(100, Math.max(0, (co2 - 400) / 6)) // 400 ppm → 0%, 1000 ppm → 100%
  const co2Color = co2 > 1000 ? 'var(--color-status-critical)'
    : co2 > 800 ? 'var(--color-status-warning)'
    : 'var(--color-status-ok)'

  return (
    <div className="wx-occ-row">
      <span className="wx-occ-id">{zone.id.toUpperCase()}</span>
      <div className="wx-occ-bar-track">
        <div className="wx-occ-bar-fill" style={{ width: `${pct}%`, background: co2Color }} />
      </div>
      <span className="wx-occ-co2" style={{ color: co2Color }}>{co2 > 0 ? `${co2} ppm` : '—'}</span>
      <span className={`wx-occ-badge ${occ ? 'wx-occ-badge--yes' : 'wx-occ-badge--no'}`}>
        {occ ? 'Occupied' : 'Vacant'}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface WeatherContextProps {
  zones: ZoneData[]
}

export function WeatherContext({ zones }: WeatherContextProps) {
  const { data: weather, isLoading, isError } = useWeatherData()

  const current  = weather?.current
  const hourly   = weather?.hourly

  // Estimated HVAC load from outdoor temp: Dubai office baseline ~35 W/m² cooling
  const hourlyTemps = hourly?.temperature_2m?.slice(0, 48) ?? []
  const peakLoad    = hourlyTemps.length > 0
    ? Math.max(...hourlyTemps.map((t) => Math.max(0, (t - 18) * 1.8))).toFixed(0)
    : null
  const peakHour    = hourlyTemps.length > 0
    ? hourlyTemps.indexOf(Math.max(...hourlyTemps))
    : null
  const peakTimeStr = peakHour != null && hourly?.time[peakHour]
    ? hourly.time[peakHour].split('T')[1]?.slice(0, 5)
    : null

  // HVAC load estimate (W/m²) for each hour
  const hvacLoad = hourlyTemps.map((t) => Math.max(0, (t - 18) * 1.8))

  return (
    <div className="wx-ctx">

      {/* ── Current conditions ───────────────────────────────────── */}
      <div className="wx-section">
        <div className="wx-section-label">CURRENT CONDITIONS — DUBAI, UAE</div>
        {isLoading && <div className="wx-loading">Fetching weather data…</div>}
        {isError && <div className="wx-error">⚠ Weather service unavailable</div>}
        {current && (
          <div className="wx-stats-row">
            <div className="wx-stat">
              <span className="wx-stat-val wx-stat-val--hot">{current.temperature_2m.toFixed(1)}°C</span>
              <span className="wx-stat-lbl">Outdoor Temp</span>
            </div>
            <div className="wx-stat-divider" />
            <div className="wx-stat">
              <span className="wx-stat-val">{current.relative_humidity_2m}%</span>
              <span className="wx-stat-lbl">Humidity</span>
            </div>
            <div className="wx-stat-divider" />
            <div className="wx-stat">
              <span className="wx-stat-val">{current.wind_speed_10m.toFixed(0)} km/h</span>
              <span className="wx-stat-lbl">Wind Speed</span>
            </div>
            <div className="wx-stat-divider" />
            <div className="wx-stat">
              <span className="wx-stat-val wx-stat-val--solar">{Math.round(current.shortwave_radiation)} W/m²</span>
              <span className="wx-stat-lbl">Solar Radiation</span>
            </div>
            {peakLoad != null && (
              <>
                <div className="wx-stat-divider" />
                <div className="wx-stat">
                  <span className="wx-stat-val wx-stat-val--hot">{peakLoad} W/m²</span>
                  <span className="wx-stat-lbl">
                    {peakTimeStr ? `Peak HVAC Load at ${peakTimeStr}` : 'Peak HVAC Load'}
                  </span>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {/* ── 48h Forecast ─────────────────────────────────────────── */}
      <div className="wx-section wx-section--forecast">
        <div className="wx-section-header">
          <div className="wx-section-label">48-HOUR FORECAST</div>
          <div className="wx-forecast-legend">
            <span className="wx-leg wx-leg--temp">── Outdoor Temp (°C)</span>
            <span className="wx-leg wx-leg--solar">── Solar (W/m²)</span>
            <span className="wx-leg wx-leg--peak">Peak tariff 12–18h</span>
          </div>
        </div>
        {hourly ? (
          <div className="wx-spark-wrap">
            <ForecastSparkline
              temps={hourly.temperature_2m}
              radiation={hourly.shortwave_radiation}
              times={hourly.time}
            />
            {/* Predicted HVAC load bars */}
            {hvacLoad.length > 0 && (
              <div className="wx-load-row">
                <span className="wx-load-lbl">HVAC Load</span>
                <div className="wx-load-bars">
                  {hvacLoad.map((v, i) => {
                    const maxV = Math.max(...hvacLoad, 1)
                    const h = parseInt(hourly.time[i]?.split('T')[1]?.split(':')[0] ?? '0', 10)
                    const isPeak = h >= 12 && h < 18
                    return (
                      <div
                        key={i}
                        className="wx-load-bar"
                        style={{
                          height: `${(v / maxV) * 100}%`,
                          background: isPeak ? 'rgba(239,68,68,0.55)' : 'rgba(78,93,109,0.35)',
                        }}
                        title={`${hourly.time[i]?.split('T')[1]?.slice(0, 5)}: ${v.toFixed(0)} W/m²`}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          !isLoading && <div className="wx-loading">No forecast data</div>
        )}
      </div>

      {/* ── Zone Occupancy ───────────────────────────────────────── */}
      <div className="wx-section">
        <div className="wx-section-label">ZONE OCCUPANCY — CO₂ PROXY</div>
        {zones.length === 0 ? (
          <div className="wx-loading">Awaiting zone data…</div>
        ) : (
          <div className="wx-occ-list">
            {zones.map((z) => (
              <OccupancyBar key={z.id} zone={z} />
            ))}
          </div>
        )}
      </div>

    </div>
  )
}
