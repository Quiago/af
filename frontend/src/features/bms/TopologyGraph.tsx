import type { BmsSnapshot } from './bms.types'
import { kToC, zoneBorderColor, zoneTempStatus } from './bms.utils'
import './TopologyGraph.css'

// ── Layout constants ──────────────────────────────────────────────────────────
const VB_W  = 1160
const VB_H  = 540
const NW    = 138   // node width
const NH    = 52    // node height
const NR    = 7     // node corner radius

// Column x-centers
const CX1 = 95     // plant
const CX2 = 330    // AHU interior
const CX3 = 570    // duct
const CX4 = 810    // zones (left edge of zone boxes)

// Plant node y-centers (column 1)
const Y_CHILLER   = 80
const Y_CHW_PUMP  = 175
const Y_HP        = 340
const Y_HW_PUMP   = 435
const Y_OA        = 505

// AHU node y-centers (column 2)
const Y_COOL_COIL = 100
const Y_HEAT_COIL = 225
const Y_MIX       = 335
const Y_FAN       = 430
const Y_RET_AIR   = 505

// Duct y-center (column 3)
const Y_DUCT = 290

// Zone y-centers (column 4)
const ZONE_YS: Record<string, number> = {
  nor: 55,
  wes: 160,
  cor: 270,
  eas: 375,
  sou: 480,
}

const ZONE_LABELS: Record<string, string> = {
  nor: 'NOR', wes: 'WES', cor: 'COR', eas: 'EAS', sou: 'SOU',
}

// AHU dashed container bounds
const AHU_X  = CX2 - NW / 2 - 12
const AHU_Y  = 60
const AHU_W  = NW + 24
const AHU_H  = VB_H - 74

// ── SVG helpers ───────────────────────────────────────────────────────────────

interface NodeProps {
  cx: number
  cy: number
  title: string
  line1?: string
  line2?: string
  borderColor?: string
  fillColor?: string
  textColor?: string
}

function EquipNode({
  cx, cy, title, line1, line2,
  borderColor = 'rgba(142,167,193,0.30)',
  fillColor   = '#111c2b',
  textColor   = '#9CA3AF',
}: NodeProps) {
  const x = cx - NW / 2
  const y = cy - NH / 2
  return (
    <g>
      <rect
        x={x} y={y} width={NW} height={NH} rx={NR}
        fill={fillColor}
        stroke={borderColor}
        strokeWidth="1.5"
      />
      <text
        x={cx} y={cy - (line1 ? 10 : 3)}
        textAnchor="middle"
        fontFamily="IBM Plex Mono, monospace"
        fontSize="10"
        fontWeight="700"
        fill="#E5E7EB"
        letterSpacing="0.05em"
      >
        {title}
      </text>
      {line1 && (
        <text
          x={cx} y={cy + 6}
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="8.5"
          fill={textColor}
        >
          {line1}
        </text>
      )}
      {line2 && (
        <text
          x={cx} y={cy + 18}
          textAnchor="middle"
          fontFamily="IBM Plex Mono, monospace"
          fontSize="8.5"
          fill={textColor}
        >
          {line2}
        </text>
      )}
    </g>
  )
}

// ── Pipe / duct path helpers ───────────────────────────────────────────────────

/** Horizontal elbow: from right of (x1,y1) → left of (x2,y2) via midpoint. */
function elbowH(
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  dashed = false,
  strokeW = 1.5,
) {
  const mx = (x1 + x2) / 2
  const d  = `M ${x1} ${y1} H ${mx} V ${y2} H ${x2}`
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={strokeW}
      strokeDasharray={dashed ? '5 4' : undefined}
      strokeLinecap="round"
    />
  )
}

/** Straight line. */
function line(
  x1: number, y1: number,
  x2: number, y2: number,
  color: string,
  dashed = false,
  strokeW = 1.5,
) {
  return (
    <line
      x1={x1} y1={y1} x2={x2} y2={y2}
      stroke={color}
      strokeWidth={strokeW}
      strokeDasharray={dashed ? '5 4' : undefined}
      strokeLinecap="round"
    />
  )
}

/** Small arrowhead triangle at (x,y) pointing right. */
function arrowR(x: number, y: number, color: string) {
  return (
    <polygon
      points={`${x},${y - 4} ${x + 7},${y} ${x},${y + 4}`}
      fill={color}
    />
  )
}

// ── Color palette ─────────────────────────────────────────────────────────────
const C_CHW   = '#3B82F6'   // chilled water
const C_HHW   = '#EF4444'   // hot water
const C_AIR   = '#6B7280'   // air (gray)
const C_ZONE  = '#22AA44'   // supply air to zones

// ── Main component ────────────────────────────────────────────────────────────

interface TopologyGraphProps {
  snapshot: BmsSnapshot
}

export function TopologyGraph({ snapshot: s }: TopologyGraphProps) {
  const chi_kw     = s.chi_reaPChi_y / 1000
  const chwPump_kw = s.chi_reaPPumDis_y / 1000
  const hp_kw      = s.heaPum_reaPHeaPum_y / 1000
  const hwPump_kw  = s.heaPum_reaPPumDis_y / 1000
  const fan_kw     = s.hvac_reaAhu_PFanSup_y / 1000

  const t = (k: number, d = 1) => `${kToC(k).toFixed(d)}°C`

  return (
    <div className="bms-topo-wrap">
      <svg
        viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet"
        className="bms-topo-svg"
      >
        {/* ── AHU dashed container ────────────────────────────────── */}
        <rect
          x={AHU_X} y={AHU_Y} width={AHU_W} height={AHU_H}
          rx={10}
          fill="rgba(31,41,55,0.5)"
          stroke="#374151"
          strokeWidth="1"
          strokeDasharray="6 4"
        />
        <text
          x={AHU_X + 10} y={AHU_Y + 16}
          fontFamily="IBM Plex Mono, monospace"
          fontSize="9"
          fontWeight="600"
          fill="#4B5563"
          letterSpacing="0.1em"
        >
          AHU
        </text>

        {/* ── CHW water loop connections (blue) ───────────────────── */}
        {/* Chiller → CHW Pump (vertical) */}
        {line(CX1, Y_CHILLER + NH / 2, CX1, Y_CHW_PUMP - NH / 2, C_CHW)}
        {/* CHW Pump → Cooling Coil (elbow right) */}
        {elbowH(CX1 + NW / 2, Y_CHW_PUMP, CX2 - NW / 2, Y_COOL_COIL, C_CHW)}
        {arrowR(CX2 - NW / 2 - 7, Y_COOL_COIL, C_CHW)}

        {/* ── Hot water loop connections (red) ────────────────────── */}
        {/* Heat Pump → HW Pump (vertical) */}
        {line(CX1, Y_HP + NH / 2, CX1, Y_HW_PUMP - NH / 2, C_HHW)}
        {/* HW Pump → Heating Coil (elbow right) */}
        {elbowH(CX1 + NW / 2, Y_HW_PUMP, CX2 - NW / 2, Y_HEAT_COIL, C_HHW)}
        {arrowR(CX2 - NW / 2 - 7, Y_HEAT_COIL, C_HHW)}

        {/* ── Air connections (gray dashed) ────────────────────────── */}
        {/* OA → Mixed Air (elbow right) */}
        {elbowH(CX1 + NW / 2, Y_OA, CX2 - NW / 2, Y_MIX, C_AIR, true)}
        {arrowR(CX2 - NW / 2 - 7, Y_MIX, C_AIR)}

        {/* Cooling Coil → Mixed Air (vertical dashed inside AHU) */}
        {line(CX2, Y_COOL_COIL + NH / 2, CX2, Y_HEAT_COIL - NH / 2, C_AIR, true)}
        {line(CX2, Y_HEAT_COIL + NH / 2, CX2, Y_MIX - NH / 2, C_AIR, true)}
        {/* Mixed Air → Supply Fan */}
        {line(CX2, Y_MIX + NH / 2, CX2, Y_FAN - NH / 2, C_AIR, true)}

        {/* Supply Fan → Supply Duct (elbow right) */}
        {elbowH(CX2 + NW / 2, Y_FAN, CX3 - NW / 2, Y_DUCT, C_AIR, true, 2)}
        {arrowR(CX3 - NW / 2 - 7, Y_DUCT, C_AIR)}

        {/* Return Air → loop label (just a stub line going left) */}
        {line(CX2 - NW / 2, Y_RET_AIR, CX1 + NW / 2 + 10, Y_RET_AIR, C_AIR, true)}

        {/* ── Zone supply lines (green) ────────────────────────────── */}
        {Object.entries(ZONE_YS).map(([zoneId, zy]) => {
          const status = zoneTempStatus(
            s[`hvac_reaZon${zoneId.charAt(0).toUpperCase() + zoneId.slice(1)}_TZon_y` as keyof BmsSnapshot] as number
          )
          const zoneColor = zoneBorderColor(status)
          return (
            <g key={zoneId}>
              {elbowH(CX3 + NW / 2, Y_DUCT, CX4 - 2, zy, zoneColor, false, 2)}
              {arrowR(CX4 - 9, zy, zoneColor)}
            </g>
          )
        })}

        {/* ── PLANT COLUMN nodes ────────────────────────────────────── */}
        <EquipNode
          cx={CX1} cy={Y_CHILLER}
          title="CHILLER"
          line1={`P: ${chi_kw.toFixed(1)}kW`}
          line2={`Ts:${t(s.chi_reaTSup_y)} Tr:${t(s.chi_reaTRet_y)}`}
          borderColor={C_CHW}
          textColor={C_CHW}
        />
        <EquipNode
          cx={CX1} cy={Y_CHW_PUMP}
          title="CHW PUMP"
          line1={`P: ${chwPump_kw.toFixed(2)}kW`}
          borderColor={C_CHW}
          textColor={C_CHW}
        />
        <EquipNode
          cx={CX1} cy={Y_HP}
          title="HEAT PUMP"
          line1={`P: ${hp_kw.toFixed(1)}kW`}
          line2={`Ts:${t(s.heaPum_reaTSup_y)} Tr:${t(s.heaPum_reaTRet_y)}`}
          borderColor={C_HHW}
          textColor={C_HHW}
        />
        <EquipNode
          cx={CX1} cy={Y_HW_PUMP}
          title="HW PUMP"
          line1={`P: ${hwPump_kw.toFixed(2)}kW`}
          borderColor={C_HHW}
          textColor={C_HHW}
        />
        <EquipNode
          cx={CX1} cy={Y_OA}
          title="OUTSIDE AIR"
          line1={`T: ${t(s.weaSta_reaWeaTDryBul_y)}`}
          borderColor="#6B7280"
          textColor="#9CA3AF"
        />

        {/* ── AHU COLUMN nodes ─────────────────────────────────────── */}
        <EquipNode
          cx={CX2} cy={Y_COOL_COIL}
          title="COOL COIL"
          line1={`Ts:${t(s.hvac_reaAhu_TCooCoiSup_y)} Tr:${t(s.hvac_reaAhu_TCooCoiRet_y)}`}
          borderColor={C_CHW}
          textColor={C_CHW}
        />
        <EquipNode
          cx={CX2} cy={Y_HEAT_COIL}
          title="HEAT COIL"
          line1={`Ts:${t(s.heaPum_reaTSup_y)}`}
          borderColor={C_HHW}
          textColor={C_HHW}
        />
        <EquipNode
          cx={CX2} cy={Y_MIX}
          title="MIXED AIR"
          line1={`Tmix: ${t(s.hvac_reaAhu_TMix_y)}`}
          borderColor="#6B7280"
          textColor="#9CA3AF"
        />
        <EquipNode
          cx={CX2} cy={Y_FAN}
          title="SUPPLY FAN"
          line1={`P:${fan_kw.toFixed(2)}kW  V:${s.hvac_reaAhu_V_flow_sup_y.toFixed(3)}m³/s`}
          borderColor="#6B7280"
          textColor="#9CA3AF"
        />
        <EquipNode
          cx={CX2} cy={Y_RET_AIR}
          title="RETURN AIR"
          line1={`Tr:${t(s.hvac_reaAhu_TRet_y)}  V:${s.hvac_reaAhu_V_flow_ret_y.toFixed(3)}m³/s`}
          borderColor="#6B7280"
          textColor="#9CA3AF"
        />

        {/* ── DUCT node ────────────────────────────────────────────── */}
        <EquipNode
          cx={CX3} cy={Y_DUCT}
          title="SUPPLY DUCT"
          line1={`dp:${Math.round(s.hvac_reaAhu_dp_sup_y)}Pa`}
          line2={`V:${s.hvac_reaAhu_V_flow_sup_y.toFixed(3)}m³/s`}
          borderColor="#6B7280"
          textColor="#9CA3AF"
        />

        {/* ── ZONE nodes ───────────────────────────────────────────── */}
        {(['nor', 'wes', 'cor', 'eas', 'sou'] as const).map((zoneId) => {
          const capId = zoneId.charAt(0).toUpperCase() + zoneId.slice(1)
          const tZonK = s[`hvac_reaZon${capId}_TZon_y` as keyof BmsSnapshot] as number
          const co2   = s[`hvac_reaZon${capId}_CO2Zon_y` as keyof BmsSnapshot] as number
          const flow  = s[`hvac_reaZon${capId}_V_flow_y` as keyof BmsSnapshot] as number
          const status = zoneTempStatus(tZonK)
          const color  = zoneBorderColor(status)
          const zy     = ZONE_YS[zoneId]
          return (
            <g key={zoneId}>
              <rect
                x={CX4} y={zy - NH / 2}
                width={NW} height={NH} rx={NR}
                fill="#0f1c2e"
                stroke={color}
                strokeWidth="2"
              />
              <text
                x={CX4 + NW / 2} y={zy - 11}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="10"
                fontWeight="700"
                fill="#E5E7EB"
                letterSpacing="0.05em"
              >
                {`ZONE ${ZONE_LABELS[zoneId]}`}
              </text>
              <text
                x={CX4 + NW / 2} y={zy + 3}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="8.5"
                fill={color}
              >
                {`T:${kToC(tZonK).toFixed(1)}°C  CO₂:${Math.round(co2)}ppm`}
              </text>
              <text
                x={CX4 + NW / 2} y={zy + 15}
                textAnchor="middle"
                fontFamily="IBM Plex Mono, monospace"
                fontSize="8.5"
                fill="#6B7280"
              >
                {`V:${flow.toFixed(3)} m³/s`}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}
