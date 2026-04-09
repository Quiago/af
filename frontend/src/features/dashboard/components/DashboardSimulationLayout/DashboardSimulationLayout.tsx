import React from 'react'
import './DashboardSimulationLayout.css'

interface DashboardSimulationLayoutProps {
  twinPanel:      React.ReactNode   // Left col — mini 3D + rec card + deltas
  timelinesPanel: React.ReactNode   // Right col — streaming charts (wider)
}

export function DashboardSimulationLayout({
  twinPanel,
  timelinesPanel,
}: DashboardSimulationLayoutProps) {
  return (
    <div className="sim-grid">
      {/* Left — mini 3D viewer + current rec + deltas */}
      <div className="sim-col-twin">{twinPanel}</div>

      {/* Right — streaming timeline charts (full remaining width) */}
      <div className="sim-col-timelines">{timelinesPanel}</div>
    </div>
  )
}
