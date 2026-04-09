import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { DashboardPage } from '../dashboard/DashboardPage'
import { BuildingReportView } from '../building-report/BuildingReportView'
import { PredictiveMaintenanceView } from '../maintenance/PredictiveMaintenanceView'
import { AIChatBubble } from '../../components/organisms/AIChatBubble/AIChatBubble'
import { useDashboardStore } from '../../store/dashboardStore'
import { wsManager } from '../../lib/websocket'
import type { BuildingSnapshot, ActiveView } from '../../types/building.types'
import './AppShell.css'

const API_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000'

const VIEW_TITLES: Record<ActiveView, string> = {
  dash:   'Digital Twin',
  report: 'Facility Report',
  maint:  'Machine Health',
}

interface SidebarItemProps {
  icon: string
  label: string
  active: boolean
  onClick: () => void
}

function SidebarItem({ icon, label, active, onClick }: SidebarItemProps) {
  return (
    <div className={`sbi ${active ? 'sbi--active' : ''}`} onClick={onClick}>
      <div className="sbi-icon">{icon}</div>
      <span className="sbi-label">{label}</span>
    </div>
  )
}

export function AppShell() {
  const activeView       = useDashboardStore((s) => s.activeView)
  const setActiveView    = useDashboardStore((s) => s.setActiveView)
  const setSnapshot      = useDashboardStore((s) => s.setSnapshot)
  const setConnStatus    = useDashboardStore((s) => s.setConnectionStatus)
  const connectionStatus = useDashboardStore((s) => s.connectionStatus)

  // ── Initial REST snapshot ──────────────────────────────────────────────────
  useQuery<BuildingSnapshot>({
    queryKey: ['building-snapshot-initial'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/api/v1/building/snapshot`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json() as BuildingSnapshot
      setSnapshot(data)
      return data
    },
    retry: false,
    staleTime: Infinity,
  })

  // ── WebSocket live stream ─────────────────────────────────────────────────
  useEffect(() => {
    const handleSnapshot = (s: BuildingSnapshot) => setSnapshot(s)
    const cleanupStatus  = wsManager.onStatusChange(setConnStatus)
    wsManager.subscribe(handleSnapshot)
    wsManager.connect()
    return () => {
      wsManager.unsubscribe(handleSnapshot)
      cleanupStatus()
      wsManager.disconnect()
    }
  }, [setSnapshot, setConnStatus])

  const isLive = connectionStatus === 'connected'

  return (
    <div className="app-shell">

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <nav className="sidebar">
        <div className="sb-logo">
          <img src="/light.png" alt="Tripolar" className="sb-logo-img" />
        </div>

        <div className="sb-nav">
          <div className="sb-sec">PLATFORM</div>
          <SidebarItem icon="⬡" label="Digital Twin"    active={activeView === 'dash'}   onClick={() => setActiveView('dash')} />
          <SidebarItem icon="▤" label="Facility Report" active={activeView === 'report'} onClick={() => setActiveView('report')} />
          <div className="sb-divider" />
          <div className="sb-sec">OPERATIONS</div>
          <SidebarItem icon="◎" label="Machine Health"    active={activeView === 'maint'} onClick={() => setActiveView('maint')} />
        </div>
      </nav>

      {/* ── Main ────────────────────────────────────────────────────────── */}
      <div className="main-area">

        {/* Topbar */}
        <header className="topbar">
          <div className="tb-title">
            <b>{VIEW_TITLES[activeView]}</b> / 25hours Hotel Dubai One Central
          </div>

          <div className="tb-right">
            <div className={`live-pill ${isLive ? '' : 'live-pill--offline'}`}>
              <div className={`ldot ${isLive ? '' : 'ldot--offline'}`} />
              <span className={`llbl ${isLive ? '' : 'llbl--offline'}`}>
                {isLive ? 'LIVE' : connectionStatus.toUpperCase()}
              </span>
            </div>

            <div className="tb-user">
              <div className="tb-av">CQ</div>
              <div className="tb-user-info">
                <div className="tb-nm">Carlos Q.</div>
                <div className="tb-rl">Head of AI · Tripolar</div>
              </div>
            </div>
          </div>
        </header>

        {/* Views — all mounted, CSS-toggled to preserve chart state */}
        <div className={`view-slot ${activeView === 'dash'   ? 'view-slot--active' : ''}`}>
          <DashboardPage />
        </div>
        <div className={`view-slot view-slot--scroll ${activeView === 'report' ? 'view-slot--active' : ''}`}>
          <BuildingReportView />
        </div>
        <div className={`view-slot ${activeView === 'maint' ? 'view-slot--active' : ''}`}>
          <PredictiveMaintenanceView />
        </div>

      </div>

      <AIChatBubble />
    </div>
  )
}
