import React from 'react'
import './DashboardLayout.css'

interface DashboardLayoutProps {
  leftPanel:  React.ReactNode   // 20% — Recommendations
  rightPanel: React.ReactNode   // 80% — Digital Twin
}

export function DashboardLayout({ leftPanel, rightPanel }: DashboardLayoutProps) {
  return (
    <div className="dashboard-grid">
      <aside className="dash-left">{leftPanel}</aside>
      <main  className="dash-right">{rightPanel}</main>
    </div>
  )
}
