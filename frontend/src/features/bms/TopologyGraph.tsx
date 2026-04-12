/**
 * TopologyGraph — SVG single-line diagram matching the actual BOPTEST
 * multizone_office_simple_air schematic (ASHRAE VAV 2A2-21232).
 *
 * Air-side flow (left→right inside AHU):
 *   Return Air + OA → Mixing Box → HEATING COIL → COOLING COIL → Supply Fan
 *   → Supply Duct → VAV terminal boxes (with reheat) → 5 Zone spaces
 *
 * Water loops:
 *   Blue  (CHW): Chiller → CHW Pump → Cooling Coil valve → return
 *   Red   (HHW): Heat Pump → HW Pump → Heating Coil valve + zone reheat → return
 *
 * Sensor names match BOPTEST output spec exactly.
 */
import type { BmsSnapshot } from './bms.types'
import { kToC, zoneTempStatus, zoneBorderColor } from './bms.utils'
import './TopologyGraph.css'

// ── Viewbox & node geometry ───────────────────────────────────────────────────
const VB_W = 1180
const VB_H = 550
const NW   = 138   // node width
const NH   = 50    // node height
const NR   = 7

// Column x-centers
const CX_PLANT = 88    // plant equipment
const CX_AHU   = 295   // AHU components
const CX_DUCT  = 510   // supply duct
const CX_ZONE  = 780   // zone boxes (left edge, not center)

// AHU dashed container
const AHU_X = CX_AHU - NW / 2 - 14
const AHU_Y = 38
const AHU_W = NW + 28
const AHU_H = VB_H - 50

// Plant nodes (column 1) — y-centers
const Y_CHILLER  = 78
const Y_CHW_PUMP = 170
const Y_HP       = 330
const Y_HW_PUMP  = 422
const Y_OA       = 500

// AHU nodes (column 2) — y-centers
// Correct order per spec: Mix → Heating Coil → Cooling Coil → Supply Fan
const Y_MIX      = 95
const Y_HEA_COIL = 210   // HEATING COIL first (spec: heating before cooling)
const Y_COO_COIL = 325   // COOLING COIL second
const Y_FAN      = 435
const Y_RET_AIR  = 500

// Duct & zones
const Y_DUCT = 280

// Zone y-centers (5 zones, equal spacing)
const ZONE_Y: Record<string, number> = {
  nor: 52,
  wes: 152,
  cor: 252,
  eas: 352,
  sou: 452,
}
const ZONE_LABEL: Record<string, string> = {
  nor: 'NOR', wes: 'WES', cor: 'COR', eas: 'EAS', sou: 'SOU',
}

// ── Colors ───────────────────────────────────────────────────────────────────
const C_CHW  = '#3B82F6'
const C_HHW  = '#EF4444'
const C_AIR  = '#6B7280'
const C_SA   = '#22AA44'   // supply air to zones

// ── SVG primitives ────────────────────────────────────────────────────────────

interface NodeProps {
  cx: number; cy: number
  title: string
  line1?: string; line2?: string
  border?: string; fill?: string; textColor?: string
}

function Node({ cx, cy, title, line1, line2,
  border = 'rgba(142,167,193,0.28)',
  fill   = '#101c2e',
  textColor = '#9CA3AF',
}: NodeProps) {
  const x = cx - NW / 2
  const y = cy - NH / 2
  const hasLines = !!(line1 || line2)
  return (
    <g>
      <rect x={x} y={y} width={NW} height={NH} rx={NR}
        fill={fill} stroke={border} strokeWidth="1.5" />
      <text x={cx} y={cy - (hasLines ? 10 : 2)}
        textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
        fontSize="10" fontWeight="700" fill="#E5E7EB" letterSpacing="0.04em">
        {title}
      </text>
      {line1 && <text x={cx} y={cy + 5}
        textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
        fontSize="8.5" fill={textColor}>{line1}</text>}
      {line2 && <text x={cx} y={cy + 17}
        textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
        fontSize="8.5" fill={textColor}>{line2}</text>}
    </g>
  )
}

function Pipe(props: {
  d: string; color: string; dashed?: boolean; w?: number
}) {
  return (
    <path d={props.d} fill="none" stroke={props.color}
      strokeWidth={props.w ?? 1.5}
      strokeDasharray={props.dashed ? '5 4' : undefined}
      strokeLinecap="round" />
  )
}

function Arrow(props: { x: number; y: number; color: string }) {
  const { x, y, color } = props
  return (
    <polygon points={`${x},${y - 4} ${x + 8},${y} ${x},${y + 4}`} fill={color} />
  )
}

// ── Main component ────────────────────────────────────────────────────────────

interface TopologyGraphProps { snapshot: BmsSnapshot }

export function TopologyGraph({ snapshot: s }: TopologyGraphProps) {
  const t  = (k: number, d = 1): string => `${kToC(k).toFixed(d)}°C`
  const kw = (w: number): string => `${(w / 1000).toFixed(2)}kW`

  // Right / left / top / bottom edges
  const r  = (cx: number): number => cx + NW / 2
  const l  = (cx: number): number => cx - NW / 2
  const bt = (cy: number): number => cy + NH / 2
  const tp = (cy: number): number => cy - NH / 2

  return (
    <div className="bms-topo-wrap">
      <svg viewBox={`0 0 ${VB_W} ${VB_H}`}
        preserveAspectRatio="xMidYMid meet" className="bms-topo-svg">

        {/* ── AHU dashed container ─────────────────────────────── */}
        <rect x={AHU_X} y={AHU_Y} width={AHU_W} height={AHU_H} rx={10}
          fill="rgba(28,40,58,0.55)" stroke="#374151"
          strokeWidth="1" strokeDasharray="6 4" />
        <text x={AHU_X + 10} y={AHU_Y + 14}
          fontFamily="IBM Plex Mono, monospace" fontSize="8" fontWeight="700"
          fill="#4B5563" letterSpacing="0.12em">AHU</text>

        {/* ── CHW PIPE: Chiller → CHW Pump (vertical) ─────────── */}
        <Pipe color={C_CHW}
          d={`M ${CX_PLANT} ${bt(Y_CHILLER)} V ${tp(Y_CHW_PUMP)}`} />

        {/* CHW Pump → Cooling Coil (right elbow) */}
        <Pipe color={C_CHW}
          d={`M ${r(CX_PLANT)} ${Y_CHW_PUMP} H ${AHU_X - 4} V ${Y_COO_COIL} H ${l(CX_AHU)}`} />
        <Arrow x={l(CX_AHU) - 8} y={Y_COO_COIL} color={C_CHW} />

        {/* ── HHW PIPE: HP → HW Pump (vertical) ──────────────── */}
        <Pipe color={C_HHW}
          d={`M ${CX_PLANT} ${bt(Y_HP)} V ${tp(Y_HW_PUMP)}`} />

        {/* HW Pump → Heating Coil (right elbow — goes UP) */}
        <Pipe color={C_HHW}
          d={`M ${r(CX_PLANT)} ${Y_HW_PUMP} H ${AHU_X - 4} V ${Y_HEA_COIL} H ${l(CX_AHU)}`} />
        <Arrow x={l(CX_AHU) - 8} y={Y_HEA_COIL} color={C_HHW} />

        {/* ── AIR FLOW inside AHU (vertical dashed, gray) ─────── */}
        {/* OA → Mix Box (from left) */}
        <Pipe color={C_AIR} dashed
          d={`M ${r(CX_PLANT)} ${Y_OA} H ${AHU_X - 4} V ${Y_MIX} H ${l(CX_AHU)}`} />
        <Arrow x={l(CX_AHU) - 8} y={Y_MIX} color={C_AIR} />

        {/* Return Air → Mix Box (implied via arrow label) */}
        {/* Mix Box → Heating Coil (vertical) */}
        <Pipe color={C_AIR} dashed
          d={`M ${CX_AHU} ${bt(Y_MIX)} V ${tp(Y_HEA_COIL)}`} />

        {/* Heating Coil → Cooling Coil */}
        <Pipe color={C_AIR} dashed
          d={`M ${CX_AHU} ${bt(Y_HEA_COIL)} V ${tp(Y_COO_COIL)}`} />

        {/* Cooling Coil → Supply Fan */}
        <Pipe color={C_AIR} dashed
          d={`M ${CX_AHU} ${bt(Y_COO_COIL)} V ${tp(Y_FAN)}`} />

        {/* Return Air ← zones (stub going left from Return Air node) */}
        <Pipe color={C_AIR} dashed
          d={`M ${l(CX_AHU)} ${Y_RET_AIR} H ${AHU_X - 30}`} />

        {/* ── Supply Fan → Supply Duct ─────────────────────────── */}
        <Pipe color={C_AIR} dashed w={2}
          d={`M ${r(CX_AHU)} ${Y_FAN} H ${(r(CX_AHU) + l(CX_DUCT)) / 2} V ${Y_DUCT} H ${l(CX_DUCT)}`} />
        <Arrow x={l(CX_DUCT) - 8} y={Y_DUCT} color={C_AIR} />

        {/* ── Supply Duct → Each Zone (green) ─────────────────── */}
        {(Object.entries(ZONE_Y) as [string, number][]).map(([zoneId, zy]) => {
          const capId = zoneId.charAt(0).toUpperCase() + zoneId.slice(1)
          const tK = s[`hvac_reaZon${capId}_TZon_y` as keyof BmsSnapshot] as number
          const status = zoneTempStatus(tK)
          const zColor = zoneBorderColor(status)
          return (
            <g key={zoneId}>
              <Pipe color={zColor} w={2}
                d={`M ${r(CX_DUCT)} ${Y_DUCT} H ${(r(CX_DUCT) + CX_ZONE - 2)} V ${zy} H ${CX_ZONE - 2}`} />
              <Arrow x={CX_ZONE - 10} y={zy} color={zColor} />
            </g>
          )
        })}

        {/* ── PLANT NODES ───────────────────────────────────────── */}
        <Node cx={CX_PLANT} cy={Y_CHILLER} title="CHILLER"
          line1={`P:${kw(s.chi_reaPChi_y)}  Q:${kToC(s.chi_reaTSup_y).toFixed(1)}°C`}
          line2={`Tr:${t(s.chi_reaTRet_y)}  F:${s.chi_reaFloSup_y.toFixed(3)}m³/s`}
          border={C_CHW} textColor={C_CHW} />

        <Node cx={CX_PLANT} cy={Y_CHW_PUMP} title="CHW PUMP"
          line1={`P: ${kw(s.chi_reaPPumDis_y)}`}
          border={C_CHW} textColor={C_CHW} />

        <Node cx={CX_PLANT} cy={Y_HP} title="HEAT PUMP"
          line1={`P:${kw(s.heaPum_reaPHeaPum_y)}  Ts:${t(s.heaPum_reaTSup_y)}`}
          line2={`Tr:${t(s.heaPum_reaTRet_y)}  F:${s.heaPum_reaFloSup_y.toFixed(3)}m³/s`}
          border={C_HHW} textColor={C_HHW} />

        <Node cx={CX_PLANT} cy={Y_HW_PUMP} title="HW PUMP"
          line1={`P: ${kw(s.heaPum_reaPPumDis_y)}`}
          border={C_HHW} textColor={C_HHW} />

        <Node cx={CX_PLANT} cy={Y_OA} title="OUTSIDE AIR"
          line1={`T: ${t(s.weaSta_reaWeaTDryBul_y)}  RH:${Math.round(s.weaSta_reaWeaRelHum_y * 100)}%`}
          border="#6B7280" textColor="#9CA3AF" />

        {/* ── AHU NODES — in correct order: Mix→HeaCoil→CooCoil→Fan ── */}
        <Node cx={CX_AHU} cy={Y_MIX} title="MIXING BOX"
          line1={`Tmix: ${t(s.hvac_reaAhu_TMix_y)}`}
          line2={`Vret: ${s.hvac_reaAhu_V_flow_ret_y.toFixed(3)} m³/s`}
          border="#6B7280" textColor="#9CA3AF" />

        {/* HEATING COIL — comes FIRST per ASHRAE VAV spec */}
        <Node cx={CX_AHU} cy={Y_HEA_COIL} title="HEAT COIL"
          line1={`Ts:${t(s.hvac_reaAhu_THeaCoiSup_y)}  Tr:${t(s.hvac_reaAhu_THeaCoiRet_y)}`}
          line2={`Pump: ${kw(s.hvac_reaAhu_PPumHea_y)}`}
          border={C_HHW} textColor={C_HHW} />

        {/* COOLING COIL — comes SECOND per ASHRAE VAV spec */}
        <Node cx={CX_AHU} cy={Y_COO_COIL} title="COOL COIL"
          line1={`Ts:${t(s.hvac_reaAhu_TCooCoiSup_y)}  Tr:${t(s.hvac_reaAhu_TCooCoiRet_y)}`}
          line2={`Pump: ${kw(s.hvac_reaAhu_PPumCoo_y)}`}
          border={C_CHW} textColor={C_CHW} />

        <Node cx={CX_AHU} cy={Y_FAN} title="SUPPLY FAN"
          line1={`P:${kw(s.hvac_reaAhu_PFanSup_y)}  V:${s.hvac_reaAhu_V_flow_sup_y.toFixed(3)}m³/s`}
          line2={`dp:${Math.round(s.hvac_reaAhu_dp_sup_y)}Pa  Ts:${t(s.hvac_reaAhu_TSup_y)}`}
          border="#6B7280" textColor="#9CA3AF" />

        <Node cx={CX_AHU} cy={Y_RET_AIR} title="RETURN AIR"
          line1={`Tr:${t(s.hvac_reaAhu_TRet_y)}  V:${s.hvac_reaAhu_V_flow_ret_y.toFixed(3)}m³/s`}
          border="#6B7280" textColor="#9CA3AF" />

        {/* ── SUPPLY DUCT ──────────────────────────────────────── */}
        <Node cx={CX_DUCT} cy={Y_DUCT} title="SUPPLY DUCT"
          line1={`dp: ${Math.round(s.hvac_reaAhu_dp_sup_y)} Pa`}
          line2={`V: ${s.hvac_reaAhu_V_flow_sup_y.toFixed(3)} m³/s`}
          border="#6B7280" textColor="#9CA3AF" />

        {/* ── ZONE NODES (VAV terminal + space) ────────────────── */}
        {(Object.entries(ZONE_Y) as [string, number][]).map(([zoneId, zy]) => {
          const capId = zoneId.charAt(0).toUpperCase() + zoneId.slice(1)
          const tZonK = s[`hvac_reaZon${capId}_TZon_y` as keyof BmsSnapshot] as number
          const tSupK = s[`hvac_reaZon${capId}_TSup_y` as keyof BmsSnapshot] as number
          const co2   = s[`hvac_reaZon${capId}_CO2Zon_y` as keyof BmsSnapshot] as number
          const flow  = s[`hvac_reaZon${capId}_V_flow_y` as keyof BmsSnapshot] as number
          const status = zoneTempStatus(tZonK)
          const zColor = zoneBorderColor(status)

          return (
            <g key={zoneId}>
              <rect x={CX_ZONE} y={zy - 30} width={NW + 10} height={60} rx={NR}
                fill="#0c1928" stroke={zColor} strokeWidth="2" />
              {/* VAV box indicator */}
              <rect x={CX_ZONE + 2} y={zy - 28} width={16} height={56} rx={4}
                fill="rgba(107,114,128,0.15)" stroke="#374151" strokeWidth="0.5" />
              <text x={CX_ZONE + 10} y={zy + 2}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="6" fill="#6B7280" transform={`rotate(-90,${CX_ZONE + 10},${zy})`}>
                VAV
              </text>
              {/* Zone label */}
              <text x={CX_ZONE + 74} y={zy - 15}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="10" fontWeight="700" fill="#E5E7EB" letterSpacing="0.04em">
                {`ZONE ${ZONE_LABEL[zoneId]}`}
              </text>
              <text x={CX_ZONE + 74} y={zy - 1}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="8.5" fill={zColor}>
                {`T:${kToC(tZonK).toFixed(1)}°C   CO₂:${Math.round(co2)} ppm`}
              </text>
              <text x={CX_ZONE + 74} y={zy + 13}
                textAnchor="middle" fontFamily="IBM Plex Mono, monospace"
                fontSize="8.5" fill="#6B7280">
                {`Tsup:${kToC(tSupK).toFixed(1)}°C  V:${flow.toFixed(3)}m³/s`}
              </text>
            </g>
          )
        })}

        {/* ── Legend ───────────────────────────────────────────── */}
        <g transform={`translate(${VB_W - 170}, ${VB_H - 60})`}>
          {[
            [C_CHW,  'CHW (chilled water)'],
            [C_HHW,  'HHW (hot water)'],
            [C_AIR,  'Air (dashed)'],
            [C_SA,   'Supply air'],
          ].map(([color, label], i) => (
            <g key={label} transform={`translate(0, ${i * 13})`}>
              <line x1={0} y1={4} x2={18} y2={4} stroke={color} strokeWidth="2"
                strokeDasharray={color === C_AIR ? '4 3' : undefined} />
              <text x={22} y={8} fontFamily="IBM Plex Mono, monospace"
                fontSize="7.5" fill="#6B7280">{label}</text>
            </g>
          ))}
        </g>

      </svg>
    </div>
  )
}
