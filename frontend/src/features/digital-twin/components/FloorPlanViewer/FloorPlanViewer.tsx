import { useRef } from 'react'
import { useFloorPlan } from '../../hooks/useFloorPlan'
import styles from './FloorPlanViewer.module.css'

interface FloorPlanViewerProps {
  active: boolean
}

export function FloorPlanViewer({ active }: FloorPlanViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useFloorPlan(canvasRef, active)

  return (
    <div className={styles.wrapper}>
      <canvas ref={canvasRef} className={styles.canvas} />
    </div>
  )
}
