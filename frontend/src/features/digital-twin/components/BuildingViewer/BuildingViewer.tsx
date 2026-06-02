import { useRef } from 'react'
import { useBuildingScene } from '../../hooks/useBuildingScene'
import type { DigitalTwinState, ZoneState } from '../../types/digitalTwin.types'
import styles from './BuildingViewer.module.css'

const ZONE_NAMES: Record<ZoneState['id'], string> = {
  nor: 'NORTH', sou: 'SOUTH', eas: 'EAST', wes: 'WEST', cor: 'CORE',
}

interface BuildingViewerProps {
  viewMode:        '3d' | 'plan'
  liveData:        DigitalTwinState
  highlightedZone?: string | null
  hoveredZone?:    string | null
  onHoverZone?:    (id: string | null) => void
  simHour?:        number
  extTemp?:        number
}

export function BuildingViewer({
  viewMode,
  liveData,
  highlightedZone = null,
  hoveredZone     = null,
  onHoverZone     = () => {},
  simHour,
  extTemp,
}: BuildingViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useBuildingScene(canvasRef, viewMode, liveData, highlightedZone, onHoverZone, simHour, extTemp)

  const zone = hoveredZone ? liveData.zones[hoveredZone as ZoneState['id']] : null

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />

      {hoveredZone && zone && (
        <div className={styles.zoneTooltip}>
          <span className={styles.zoneTooltipTitle}>
            {ZONE_NAMES[hoveredZone as ZoneState['id']]}
          </span>
          <div className={styles.zoneTooltipRow}>
            <span className={styles.zoneTooltipKey}>TEMP</span>
            <span className={styles.zoneTooltipVal}>{zone.temperature.toFixed(1)}°C</span>
          </div>
          <div className={styles.zoneTooltipRow}>
            <span className={styles.zoneTooltipKey}>CO₂</span>
            <span className={styles.zoneTooltipVal}>{zone.co2.toFixed(0)} ppm</span>
          </div>
          <div className={styles.zoneTooltipRow}>
            <span className={styles.zoneTooltipKey}>DAMPER</span>
            <span className={styles.zoneTooltipVal}>{(zone.damperPosition * 100).toFixed(0)}%</span>
          </div>
        </div>
      )}
    </div>
  )
}
