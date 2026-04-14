import { useEffect, useState, useRef } from 'react'
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

// ─── Facility list (mock — same platform, different building data) ────────────

interface Facility { id: string; name: string; location: string; flag: string }

const FACILITIES: Facility[] = [
  { id: 'f1', name: '25hours Hotel Dubai',          location: 'One Central, DIFC',         flag: '🇦🇪' },
  { id: 'f2', name: 'DIFC Gate Avenue Tower A',     location: 'Gate District, Dubai',       flag: '🇦🇪' },
  { id: 'f3', name: 'Dubai Marina Residence',       location: 'Marina Walk, Complex B',     flag: '🇦🇪' },
  { id: 'f4', name: 'Jumeirah Beach Hotel',         location: 'Jumeirah Road, Dubai',       flag: '🇦🇪' },
  { id: 'f5', name: 'Address Downtown',             location: 'Mohammed Bin Rashid Blvd',  flag: '🇦🇪' },
  { id: 'f6', name: 'Canary Wharf Office Tower',   location: 'London, E14',                flag: '🇬🇧' },
  { id: 'f7', name: 'Tour First La Défense',        location: 'Paris, Île-de-France',       flag: '🇫🇷' },
]

// ─── Facility selector component ──────────────────────────────────────────────

interface FacilitySelectorProps {
  facilities: Facility[]
  selectedId: string
  onChange: (id: string) => void
}

function FacilitySelector({ facilities, selectedId, onChange }: FacilitySelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const current = facilities.find((f) => f.id === selectedId) ?? facilities[0]!

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="fac-selector" ref={ref}>
      <button
        className={`fac-btn ${open ? 'fac-btn--open' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="fac-flag">{current.flag}</span>
        <span className="fac-current-name">{current.name}</span>
        <svg className="fac-caret" viewBox="0 0 10 6" width="10" height="6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>

      {open && (
        <div className="fac-dropdown" role="listbox">
          <div className="fac-dropdown-header">FACILITIES</div>
          {facilities.map((f) => (
            <button
              key={f.id}
              role="option"
              aria-selected={f.id === selectedId}
              className={`fac-item ${f.id === selectedId ? 'fac-item--active' : ''}`}
              onClick={() => { onChange(f.id); setOpen(false) }}
            >
              <span className="fac-item-flag">{f.flag}</span>
              <span className="fac-item-body">
                <span className="fac-item-name">{f.name}</span>
                <span className="fac-item-loc">{f.location}</span>
              </span>
              {f.id === selectedId && <span className="fac-item-check">✓</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Sidebar item ─────────────────────────────────────────────────────────────

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

// ─── Shell ────────────────────────────────────────────────────────────────────

export function AppShell() {
  const activeView       = useDashboardStore((s) => s.activeView)
  const setActiveView    = useDashboardStore((s) => s.setActiveView)
  const setSnapshot      = useDashboardStore((s) => s.setSnapshot)
  const setConnStatus    = useDashboardStore((s) => s.setConnectionStatus)
  const connectionStatus = useDashboardStore((s) => s.connectionStatus)

  const [facilityId, setFacilityId] = useState('f1')
  const currentFacility = FACILITIES.find((f) => f.id === facilityId) ?? FACILITIES[0]!

  // ── Initial REST snapshot ────────────────────────────────────────────────────
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

  // ── WebSocket live stream ────────────────────────────────────────────────────
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

      {/* ── Sidebar ───────────────────────────────────────────────────── */}
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
          <SidebarItem icon="◎" label="Machine Health"  active={activeView === 'maint'} onClick={() => setActiveView('maint')} />
        </div>
      </nav>

      {/* ── Main ──────────────────────────────────────────────────────── */}
      <div className="main-area">

        {/* Topbar */}
        <header className="topbar">
          <div className="tb-title">
            <b>{VIEW_TITLES[activeView]}</b>
            <span className="tb-sep">/</span>
            {currentFacility.name}
          </div>

          <div className="tb-right">
            <div className={`live-pill ${isLive ? '' : 'live-pill--offline'}`}>
              <div className={`ldot ${isLive ? '' : 'ldot--offline'}`} />
              <span className={`llbl ${isLive ? '' : 'llbl--offline'}`}>
                {isLive ? 'LIVE' : connectionStatus.toUpperCase()}
              </span>
            </div>

            {/* Facility selector — before user profile */}
            <FacilitySelector
              facilities={FACILITIES}
              selectedId={facilityId}
              onChange={setFacilityId}
            />

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
