import { useMemo } from 'react'
import { ZoomableSVG } from '../../../components/atoms/ZoomableSVG/ZoomableSVG'
import { useDashboardStore } from '../../../store/dashboardStore'
import { useEquipmentData } from '../hooks/useEquipmentData'

// ── Equipment box geometry ──────────────────────────────────────────────────
// ViewBox: 0 0 520 320

// Color helpers — brochure palette
function statusColor(status: string): string {
  switch (status) {
    case 'ok':       return '#4B8B68'
    case 'warning':  return '#C29048'
    case 'critical': return '#B85C73'
    default:         return '#8C96A6'
  }
}

function statusFill(status: string): string {
  switch (status) {
    case 'ok':       return 'rgba(75,139,104,0.10)'
    case 'warning':  return 'rgba(194,144,72,0.08)'
    case 'critical': return 'rgba(184,92,115,0.08)'
    default:         return 'rgba(140,150,166,0.06)'
  }
}

interface EqBoxProps {
  x: number; y: number; w: number; h: number
  label: string
  sublabel?: string
  status: string
  value?: string
  icon?: string
  onClick?: () => void
  selected?: boolean
}

function EqBox({ x, y, w, h, label, sublabel, status, value, icon, onClick, selected }: EqBoxProps) {
  const c = statusColor(status)
  const f = statusFill(status)
  return (
    <g style={{ cursor: onClick ? 'pointer' : 'default' }} onClick={onClick}>
      {selected && (
        <rect x={x-2} y={y-2} width={w+4} height={h+4} rx={5}
          fill="none" stroke="rgba(93,99,169,0.5)" strokeWidth={2.5}/>
      )}
      <rect x={x} y={y} width={w} height={h} rx={3}
        fill={f} stroke={c} strokeWidth={selected ? 1.2 : 0.8}/>
      {icon && (
        <text x={x + w/2} y={y + h/2 - 8} textAnchor="middle"
          fontSize="14" fill={c} style={{ pointerEvents: 'none' }}>{icon}</text>
      )}
      <text x={x + w/2} y={y + (icon ? h/2 + 5 : h/2 + 2)} textAnchor="middle"
        fontSize={7} fontWeight="600" fill={c}
        fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.07em"
        style={{ pointerEvents: 'none' }}>{label}</text>
      {sublabel && (
        <text x={x + w/2} y={y + h/2 + 14} textAnchor="middle"
          fontSize={6} fill="rgba(255,255,255,0.3)"
          fontFamily="'IBM Plex Mono', monospace"
          style={{ pointerEvents: 'none' }}>{sublabel}</text>
      )}
      {value && (
        <text x={x + w/2} y={y + h - 6} textAnchor="middle"
          fontSize={6.5} fill="rgba(255,255,255,0.55)"
          fontFamily="'IBM Plex Mono', monospace"
          style={{ pointerEvents: 'none' }}>{value}</text>
      )}
      {/* Status dot */}
      <circle cx={x + w - 7} cy={y + 7} r={3} fill={c} opacity={0.9}/>
    </g>
  )
}

// Animated flow dot along a path
function FlowArrow({ d, color = 'rgba(75,139,104,0.5)' }: { d: string; color?: string }) {
  return (
    <path d={d} fill="none" stroke={color} strokeWidth={1.5}
      strokeDasharray="5 4" opacity={0.55}/>
  )
}

interface SystemDiagramProps {
  onEquipmentClick?: (assetId: string) => void
}

export function SystemDiagram({ onEquipmentClick }: SystemDiagramProps) {
  const equipment      = useEquipmentData()
  const selectedAssetId = useDashboardStore((s) => s.selectedAssetId)
  const setSelectedAsset = useDashboardStore((s) => s.setSelectedAsset)
  const snapshot        = useDashboardStore((s) => s.snapshot)

  const eqMap = useMemo(() => {
    const m = new Map(equipment.map((e) => [e.id, e]))
    return m
  }, [equipment])

  const chiller = eqMap.get('chiller-1')
  const ahu     = eqMap.get('ahu-1')
  const filter  = eqMap.get('filter-1')

  function handleEqClick(id: string) {
    setSelectedAsset(id === selectedAssetId ? null : id)
    onEquipmentClick?.(id)
  }

  // Metrics from snapshot for display
  const ahuFanPower = ahu?.metrics['fan_power_w']
  const chillerCop  = snapshot?.kpis?.pue
  const supplyTemp  = ahu?.metrics['supply_temp_c']
  const ductPres    = ahu?.metrics['duct_pressure_pa']

  return (
    <ZoomableSVG contentWidth={520} contentHeight={320}>
      {/* Background */}
      <defs>
        <pattern id="sd-grid" width="20" height="20" patternUnits="userSpaceOnUse">
          <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.025)" strokeWidth="0.5"/>
        </pattern>
        <marker id="arrow-green" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(75,139,104,0.6)"/>
        </marker>
        <marker id="arrow-blue" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(59,130,246,0.6)"/>
        </marker>
        <marker id="arrow-gray" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto">
          <path d="M0,0 L0,6 L6,3 z" fill="rgba(107,126,150,0.5)"/>
        </marker>
      </defs>
      <rect width="520" height="320" fill="url(#sd-grid)" />

      {/* ── Title ────────────────────────────────────────────── */}
      <text x="14" y="20" fontSize="8" fill="rgba(255,255,255,0.25)"
        fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.1em">
        SINGLE DUCT VAV — HVAC SYSTEM DIAGRAM
      </text>

      {/* ── Outside Air (OA) source ───────────────────────────── */}
      <g transform="translate(18, 60)">
        <rect width="54" height="40" rx="3"
          fill="rgba(107,126,150,0.06)" stroke="rgba(107,126,150,0.3)" strokeWidth="0.7"/>
        <text x="27" y="16" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.4)"
          fontFamily="'IBM Plex Mono', monospace">OUTSIDE</text>
        <text x="27" y="26" textAnchor="middle" fontSize="6.5" fill="rgba(255,255,255,0.4)"
          fontFamily="'IBM Plex Mono', monospace">AIR</text>
        <text x="27" y="36" textAnchor="middle" fontSize="6" fill="rgba(107,126,150,0.6)"
          fontFamily="'IBM Plex Mono', monospace">OA</text>
      </g>

      {/* OA → Filter duct */}
      <FlowArrow d="M 72 80 L 112 80" />
      <line x1="72" y1="80" x2="112" y2="80" stroke="rgba(107,126,150,0.3)" strokeWidth="3" opacity={0.4}/>

      {/* ── Filter ───────────────────────────────────────────── */}
      <EqBox x={112} y={58} w={60} h={44}
        label="FILTER"
        sublabel={filter ? undefined : 'F-01'}
        status={filter?.status ?? 'offline'}
        value={filter ? undefined : undefined}
        icon="▦"
        selected={selectedAssetId === 'filter-1'}
        onClick={() => handleEqClick('filter-1')}
      />

      {/* Filter → AHU duct */}
      <FlowArrow d="M 172 80 L 210 80" />
      <line x1="172" y1="80" x2="210" y2="80" stroke="rgba(107,126,150,0.3)" strokeWidth="3" opacity={0.4}/>

      {/* ── AHU ──────────────────────────────────────────────── */}
      <EqBox x={210} y={50} w={90} h={60}
        label="AHU-01"
        sublabel="Air Handling Unit"
        status={ahu?.status ?? 'offline'}
        value={ahuFanPower != null ? `${(ahuFanPower/1000).toFixed(2)} kW` : undefined}
        icon="⊛"
        selected={selectedAssetId === 'ahu-1'}
        onClick={() => handleEqClick('ahu-1')}
      />

      {/* ── Supply duct (AHU → main supply spine) ────────────── */}
      {/* Vertical supply riser from AHU */}
      <FlowArrow d="M 300 80 L 360 80 L 360 120" color="rgba(75,139,104,0.5)"/>
      <line x1="300" y1="80" x2="360" y2="80"   stroke="rgba(75,139,104,0.2)" strokeWidth="5" opacity={0.3}/>
      <line x1="360" y1="80" x2="360" y2="120"  stroke="rgba(75,139,104,0.2)" strokeWidth="5" opacity={0.3}/>

      {/* Supply duct label */}
      <text x="323" y="74" fontSize="6" fill="rgba(75,139,104,0.55)"
        fontFamily="'IBM Plex Mono', monospace">SUPPLY</text>

      {/* ── VAV Boxes → Zones ─────────────────────────────────── */}
      {/* NOR, WES, COR, EAS, SOU — 5 VAV boxes in a column */}
      {[
        { id: 'nor', label: 'NOR', y: 120 },
        { id: 'wes', label: 'WES', y: 155 },
        { id: 'cor', label: 'COR', y: 190 },
        { id: 'eas', label: 'EAS', y: 225 },
        { id: 'sou', label: 'SOU', y: 260 },
      ].map(({ id, label, y }) => {
        const zone = snapshot?.zones.find((z) => z.id === id)
        const temp = zone?.temperature
        return (
          <g key={id}>
            {/* Branch duct from spine */}
            <line x1="360" y1={y + 10} x2="396" y2={y + 10}
              stroke="rgba(0,200,150,0.2)" strokeWidth="3" opacity={0.4}/>
            <FlowArrow d={`M 360 ${y+10} L 396 ${y+10}`} color="rgba(0,200,150,0.4)"/>

            {/* VAV box */}
            <rect x={396} y={y} width={34} height={20} rx={2}
              fill="rgba(75,139,104,0.06)" stroke="rgba(75,139,104,0.25)" strokeWidth={0.7}/>
            <text x={413} y={y+13} textAnchor="middle" fontSize={6}
              fill="rgba(75,139,104,0.65)" fontFamily="'IBM Plex Mono', monospace">VAV</text>

            {/* Zone label */}
            <rect x={432} y={y} width={72} height={20} rx={2}
              fill="rgba(255,255,255,0.03)" stroke="rgba(255,255,255,0.08)" strokeWidth={0.7}/>
            <text x={468} y={y+8} textAnchor="middle" fontSize={6.5} fontWeight="600"
              fill="rgba(255,255,255,0.55)" fontFamily="'IBM Plex Mono', monospace"
              letterSpacing="0.06em">{label}</text>
            <text x={468} y={y+16} textAnchor="middle" fontSize={6}
              fill="rgba(255,255,255,0.3)" fontFamily="'IBM Plex Mono', monospace">
              {temp != null ? `${temp.toFixed(1)}°C` : '—'}
            </text>

            {/* Return air arrow (right → return duct) */}
            <line x1="504" y1={y+10} x2="508" y2={y+10}
              stroke="rgba(107,126,150,0.15)" strokeWidth="2"/>
          </g>
        )
      })}

      {/* Return duct vertical (right side) */}
      <line x1="508" y1="130" x2="508" y2="270"
        stroke="rgba(107,126,150,0.18)" strokeWidth="4" opacity={0.5} strokeDasharray="6 3"/>
      <text x="511" y="200" fontSize="5.5" fill="rgba(107,126,150,0.4)"
        fontFamily="'IBM Plex Mono', monospace" transform="rotate(90 511 200)">RETURN AIR</text>

      {/* Return → Chiller path */}
      <FlowArrow d="M 508 270 L 508 290 L 260 290 L 260 250" color="rgba(59,130,246,0.4)"/>
      <line x1="508" y1="270" x2="508" y2="290" stroke="rgba(59,130,246,0.15)" strokeWidth="4" opacity={0.4}/>
      <line x1="508" y1="290" x2="260" y2="290" stroke="rgba(59,130,246,0.15)" strokeWidth="4" opacity={0.4}/>
      <line x1="260"  y1="290" x2="260" y2="250" stroke="rgba(59,130,246,0.15)" strokeWidth="4" opacity={0.4}/>
      <text x="380" y="285" textAnchor="middle" fontSize="5.5" fill="rgba(59,130,246,0.35)"
        fontFamily="'IBM Plex Mono', monospace">RETURN</text>

      {/* ── Chiller ───────────────────────────────────────────── */}
      <EqBox x={210} y={188} w={90} h={60}
        label="CHILLER-01"
        sublabel="Cooling Plant"
        status={chiller?.status ?? 'offline'}
        value={chillerCop != null ? `COP ${chillerCop.toFixed(2)}` : undefined}
        icon="❄"
        selected={selectedAssetId === 'chiller-1'}
        onClick={() => handleEqClick('chiller-1')}
      />

      {/* Chiller → AHU (chilled water loop) */}
      <FlowArrow d="M 255 188 L 255 140 L 210 140" color="rgba(59,130,246,0.45)"/>
      <line x1="255" y1="188" x2="255" y2="140" stroke="rgba(59,130,246,0.15)" strokeWidth="3" opacity={0.4}/>
      <line x1="255" y1="140" x2="210" y2="140" stroke="rgba(59,130,246,0.15)" strokeWidth="3" opacity={0.4}/>
      <text x="218" y="135" fontSize="5.5" fill="rgba(59,130,246,0.4)"
        fontFamily="'IBM Plex Mono', monospace">CHW LOOP</text>

      {/* ── Live metrics bar (bottom left) ──────────────────────── */}
      <g transform="translate(14, 180)">
        <text fontSize="6.5" fill="rgba(255,255,255,0.2)"
          fontFamily="'IBM Plex Mono', monospace" letterSpacing="0.08em">LIVE METRICS</text>
        {[
          { label: 'Fan Power',    value: ahuFanPower != null ? `${(ahuFanPower/1000).toFixed(2)} kW` : '—', color: '#4B8B68' },
          { label: 'Supply Temp',  value: supplyTemp  != null ? `${supplyTemp.toFixed(1)} °C` : '—',          color: '#60a5fa' },
          { label: 'Duct Press.',  value: ductPres    != null ? `${ductPres.toFixed(0)} Pa`  : '—',           color: '#fbbf24' },
        ].map(({ label, value, color }, i) => (
          <g key={label} transform={`translate(0, ${16 + i * 20})`}>
            <text fontSize="6" fill="rgba(255,255,255,0.3)" fontFamily="'IBM Plex Mono', monospace">{label}</text>
            <text x="90" fontSize="8" fontWeight="600" fill={color} fontFamily="'IBM Plex Mono', monospace">{value}</text>
          </g>
        ))}
      </g>
    </ZoomableSVG>
  )
}
