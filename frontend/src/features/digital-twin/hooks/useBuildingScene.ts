import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js'
import { useDashboardStore } from '../../../store/dashboardStore'
import type { DigitalTwinState, ZoneState } from '../types/digitalTwin.types'
import type { CfdCinematic } from '../types/simulation.types'
import { solarPosition } from '../lib/solarPhysics'
import {
  BW, BD, FH, NF, HW, HD,
  ZONE_IDS, ZONE_NAMES, ZONE_GEOM,
  WALL_SEGMENTS, WALL_T,
} from '../lib/buildingLayout'
import { buildFurniture } from '../lib/furniture'
import { FloorFluid } from '../lib/eulerFluid'
import { comfort, type ComfortResult } from '../lib/comfort'
import { computeZoneTemps } from '../lib/thermalModel'

// ─── Scene-specific constants (not part of the shared building layout) ───────
const EXPLODE_GAP = 3.6   // extra vertical separation (m) between floors in exploded 3D view
const SUN_EL_CAP  = 0.42  // ~24° — cap the DISPLAYED sun elevation so the orb stays in the
                          // visible sky band (azimuth stays real, so it still crosses E→S→W)

// ─── Temperature → 4-stop color ramp ────────────────────────────────────────

const C_18 = new THREE.Color('#4488cc')  // cool comfort
const C_22 = new THREE.Color('#44aa80')  // teal / thermal comfort
const C_26 = new THREE.Color('#f09020')  // warm / amber
const C_30 = new THREE.Color('#e03030')  // overheated / red

function tempToColor(t: number): THREE.Color {
  t = Math.max(18, Math.min(32, t))
  const c = new THREE.Color()
  if      (t <= 22) c.lerpColors(C_18, C_22, (t - 18) / 4)
  else if (t <= 26) c.lerpColors(C_22, C_26, (t - 22) / 4)
  else              c.lerpColors(C_26, C_30, (t - 26) / 4)
  return c
}

// ─── Zone sprite label canvas drawing ────────────────────────────────────────

const LBL_W = 224, LBL_H = 108

function drawZoneLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  tempC: number,
  cf: ComfortResult,
  color: THREE.Color,
): void {
  const W = LBL_W, H = LBL_H
  ctx.clearRect(0, 0, W, H)

  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)

  // Card background tinted by zone temperature
  ctx.fillStyle = `rgba(${r},${g},${b},0.86)`
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(2, 2, W - 4, H - 4, 14)
  else               ctx.rect(2, 2, W - 4, H - 4)
  ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.55)'
  ctx.lineWidth   = 1.5
  ctx.stroke()

  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'

  // Zone name
  ctx.fillStyle = '#ffffff'
  ctx.font      = 'bold 26px Inter,system-ui,sans-serif'
  ctx.fillText(name, W / 2, 9)

  // Temperature
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.font      = '20px Inter,system-ui,sans-serif'
  ctx.fillText(`${tempC.toFixed(1)}°C`, W / 2, 41)

  // Comfort chip — PMV value + category, coloured by category
  const cy = 72, ch = 28, cw = W - 36
  ctx.fillStyle = cf.color
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect((W - cw) / 2, cy, cw, ch, 14)
  else               ctx.rect((W - cw) / 2, cy, cw, ch)
  ctx.fill()
  ctx.fillStyle = '#0c1116'
  ctx.font      = 'bold 16px Inter,system-ui,sans-serif'
  const pmvStr  = `${cf.pmv >= 0 ? '+' : ''}${cf.pmv.toFixed(1)}`
  ctx.fillText(`PMV ${pmvStr} · ${cf.category}`, W / 2, cy + 5)
}

interface SpriteEntry {
  sprite:  THREE.Sprite
  canvas:  HTMLCanvasElement
  texture: THREE.CanvasTexture
}

function makeSpriteEntry(name: string, tempC: number, color: THREE.Color): SpriteEntry {
  const canvas = document.createElement('canvas')
  canvas.width  = LBL_W
  canvas.height = LBL_H
  const ctx  = canvas.getContext('2d')!
  drawZoneLabel(ctx, name, tempC, comfort(tempC, 50), color)
  const texture = new THREE.CanvasTexture(canvas)
  const mat     = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite  = new THREE.Sprite(mat)
  sprite.scale.set(8.6, 4.15, 1)
  return { sprite, canvas, texture }
}

// ─── Sky / sun simulation ─────────────────────────────────────────────────────

interface SkyKey { h: number; sky: THREE.Color; ground: THREE.Color }

const SKY_KEYS: SkyKey[] = [
  { h:  0, sky: new THREE.Color(0x020c18), ground: new THREE.Color(0x0d1a0a) },  // midnight
  { h:  4, sky: new THREE.Color(0x020c18), ground: new THREE.Color(0x0d1a0a) },  // deep night
  { h:  5, sky: new THREE.Color(0x0e1830), ground: new THREE.Color(0x111e0d) },  // pre-dawn
  { h:  6, sky: new THREE.Color(0x1c2c50), ground: new THREE.Color(0x182810) },  // dawn
  { h:  7, sky: new THREE.Color(0x3a6090), ground: new THREE.Color(0x243c14) },  // sunrise
  { h:  8, sky: new THREE.Color(0x4888c8), ground: new THREE.Color(0x2d4a1e) },  // morning
  { h: 12, sky: new THREE.Color(0x3878bc), ground: new THREE.Color(0x2d4a1e) },  // midday
  { h: 16, sky: new THREE.Color(0x4888c8), ground: new THREE.Color(0x2d4a1e) },  // afternoon
  { h: 18, sky: new THREE.Color(0x3a6090), ground: new THREE.Color(0x243c14) },  // pre-sunset
  { h: 19, sky: new THREE.Color(0xb05c28), ground: new THREE.Color(0x1a2c0e) },  // sunset
  { h: 20, sky: new THREE.Color(0x1a1430), ground: new THREE.Color(0x111a0d) },  // dusk
  { h: 21, sky: new THREE.Color(0x060c1a), ground: new THREE.Color(0x0d1a0a) },  // night
  { h: 24, sky: new THREE.Color(0x020c18), ground: new THREE.Color(0x0d1a0a) },  // midnight
]

function interpolateSky(h: number): { sky: THREE.Color; ground: THREE.Color } {
  const h24 = ((h % 24) + 24) % 24
  let i = SKY_KEYS.findIndex((k) => k.h > h24)
  if (i < 0) i = SKY_KEYS.length
  const a = SKY_KEYS[Math.max(0, i - 1)]!
  const b = SKY_KEYS[Math.min(SKY_KEYS.length - 1, i)]!
  const t = b.h === a.h ? 0 : (h24 - a.h) / (b.h - a.h)
  return {
    sky:    new THREE.Color().lerpColors(a.sky,    b.sky,    t),
    ground: new THREE.Color().lerpColors(a.ground, b.ground, t),
  }
}

/** Sun color: deep orange at horizon → warm white at high elevation */
function sunColorFromEl(el: number): THREE.Color {
  const t = Math.max(0, Math.min(1, el / 0.5))
  return new THREE.Color().lerpColors(new THREE.Color(0xff7010), new THREE.Color(0xfffae0), t)
}

/**
 * Real solar arc → world direction (unit vector from the building toward the sun).
 *
 * World axes: +X = East, −X = West, +Z = South, −Z = North.
 * solarPosition() returns a compass azimuth (0 = North, increasing clockwise
 * through East) and an elevation, so:
 *   x =  cos(el)·sin(az)   (east)
 *   y =  sin(el)           (up)
 *   z = −cos(el)·cos(az)   (−Z north / +Z south)
 * At solar noon az ≈ π (due south) → the sun sits high in the southern sky.
 */
function sunWorldDir(az: number, el: number): THREE.Vector3 {
  const ce = Math.cos(el)
  return new THREE.Vector3(ce * Math.sin(az), Math.sin(el), -ce * Math.cos(az))
}

/**
 * Per-facade direct-solar load (0–1) for the four perimeter zones:
 *   load = max(0, facadeNormal · sunDir) · max(0, sin(el))
 * i.e. how square-on the sun hits each wall, scaled by how high it is.
 * All walls read 0 at night.
 */
function facadeSolarLoads(az: number, el: number): Record<ZoneState['id'], number> {
  const strength = Math.max(0, Math.sin(el))
  const dir = sunWorldDir(az, el)
  return {
    nor: Math.max(0, -dir.z) * strength,   // north normal (0,0,−1)
    sou: Math.max(0,  dir.z) * strength,   // south normal (0,0, 1)
    eas: Math.max(0,  dir.x) * strength,   // east  normal (1,0, 0)
    wes: Math.max(0, -dir.x) * strength,   // west  normal (−1,0,0)
    cor: 0,                                 // core — no exterior facade
  }
}

// ─── Heat → 4-stop ramp (facade solar + thermal load) ────────────────────────
const H_COLD  = new THREE.Color(0x2a6cff)
const H_TEAL  = new THREE.Color(0x14b8a6)
const H_AMBER = new THREE.Color(0xffae34)
const H_HOT   = new THREE.Color(0xff3a14)
function heatToColor(h: number, out: THREE.Color): THREE.Color {
  h = Math.max(0, Math.min(1, h))
  if      (h < 0.34) out.lerpColors(H_COLD,  H_TEAL,  h / 0.34)
  else if (h < 0.67) out.lerpColors(H_TEAL,  H_AMBER, (h - 0.34) / 0.33)
  else               out.lerpColors(H_AMBER, H_HOT,   (h - 0.67) / 0.33)
  return out
}

// ─── Structural materials — ghost frame, all transparent ─────────────────────

function makeMaterials() {
  return {
    mSteel: new THREE.MeshPhongMaterial({ color: 0x7090b0, opacity: 0.55, transparent: true, depthWrite: false, shininess: 80 }),
    mSpan:  new THREE.MeshPhongMaterial({ color: 0x506070, opacity: 0.14, transparent: true, depthWrite: false, shininess: 4 }),
    mRoof:  new THREE.MeshPhongMaterial({ color: 0x3d5060, opacity: 0.16, transparent: true, depthWrite: false }),
  }
}

// ─── Building geometry ────────────────────────────────────────────────────────

interface BuildingObjects {
  group:           THREE.Group
  floorGroups:     THREE.Group[]                          // one per floor — exploded vertically
  topGroup:        THREE.Group                            // roof + parapet + AHUs + penthouse
  wallGroups:      THREE.Group[]                          // interior partition walls, per floor
  furnitureGroups: THREE.Group[]                          // procedural furniture, per floor
  zoneMeshes:      Map<ZoneState['id'], THREE.Mesh[]>
  zoneMeshMats:    Map<string, THREE.MeshPhongMaterial>   // key: "${id}_${floor}"
  glassMats:       Map<ZoneState['id'], THREE.MeshPhongMaterial>
  slabMeshes:      THREE.Mesh[]
  floorSlabMats:   THREE.MeshPhongMaterial[]
}

function buildBuilding(mats: ReturnType<typeof makeMaterials>): BuildingObjects {
  const { mSteel, mSpan, mRoof } = mats
  // Root group holds per-floor sub-groups + a top group; each floor group can be
  // offset vertically (exploded view) independently.
  const group       = new THREE.Group()
  const floorGroups: THREE.Group[] = []
  const topGroup    = new THREE.Group()

  const zoneMeshMats = new Map<string, THREE.MeshPhongMaterial>()
  const zoneMeshes   = new Map<ZoneState['id'], THREE.Mesh[]>(ZONE_IDS.map((id) => [id, []]))
  const glassMats    = new Map<ZoneState['id'], THREE.MeshPhongMaterial>()
  const floorSlabMats: THREE.MeshPhongMaterial[] = []
  const slabMeshes:    THREE.Mesh[]               = []
  const wallGroups:      THREE.Group[] = []   // interior partition walls, per floor
  const furnitureGroups: THREE.Group[] = []   // procedural furniture, per floor

  const WALL_H  = FH * 0.82   // open-top dollhouse — walls below the ceiling
  const wallMat = new THREE.MeshStandardMaterial({ color: 0xd7d6cd, roughness: 0.92, metalness: 0.0 })

  // Glass pane materials — one per perimeter zone facade, colored like zone
  for (const id of ['nor', 'sou', 'eas', 'wes'] as ZoneState['id'][]) {
    glassMats.set(id, new THREE.MeshPhongMaterial({
      color: 0x80b8e0, opacity: 0.28, transparent: true, depthWrite: false, shininess: 110,
    }))
  }

  const volH = FH * 0.92    // zone volume height — fills floor
  const winH = FH * 0.47    // window height (WWR ≈ 33%)
  const winY = FH * 0.15 + 0.12

  for (let f = 0; f < NF; f++) {
    const yBase = f * FH
    const volY  = yBase + (FH - volH) / 2 + 0.04

    // Per-floor group — children keep their absolute Y; the group is offset
    // each frame for the exploded view.
    const fg = new THREE.Group()
    fg.userData['floor'] = f
    group.add(fg)
    floorGroups.push(fg)

    // ── Floor slab — transparent, provides floor separation ───────────────
    const slabMat = new THREE.MeshPhongMaterial({
      color: 0x3a5070, opacity: 0.16, transparent: true, depthWrite: false, shininess: 4,
    })
    floorSlabMats.push(slabMat)
    const slabGeo = new THREE.BoxGeometry(BW + 0.6, 0.22, BD + 0.6)
    const slab    = new THREE.Mesh(slabGeo, slabMat)
    slab.position.set(0, yBase, 0)
    slab.userData['floor'] = f
    slabMeshes.push(slab)
    fg.add(slab)

    // Slab edge definition lines
    const slabEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(slabGeo),
      new THREE.LineBasicMaterial({ color: 0x3a5878, opacity: 0.45, transparent: true }),
    )
    slabEdge.position.copy(slab.position)
    fg.add(slabEdge)

    // ── Zone volumes — PRIMARY visual element (one per zone per floor) ─────
    for (const id of ZONE_IDS) {
      const g   = ZONE_GEOM[id]
      const mat = new THREE.MeshPhongMaterial({
        color: 0x80b8e0, shininess: 30,
        transparent: true, opacity: 0.78, depthWrite: false,
      })
      zoneMeshMats.set(`${id}_${f}`, mat)

      const geo = new THREE.BoxGeometry(g.w - 0.30, volH, g.d - 0.30)
      const vol = new THREE.Mesh(geo, mat)
      vol.position.set(g.cx, volY, g.cz)
      vol.userData['zoneId'] = id
      vol.userData['floor']  = f
      fg.add(vol)
      zoneMeshes.get(id)!.push(vol)
    }

    // ── Structural columns ─────────────────────────────────────────────────
    for (const [cx, cz] of [[-HW,-HD],[HW,-HD],[-HW,HD],[HW,HD]] as [number,number][]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.50, FH, 0.50), mSteel)
      col.position.set(cx, yBase + FH/2, cz)
      fg.add(col)
    }
    for (const cz of [-HD, HD]) {
      for (const cx of [-16.67, -8.33, 0, 8.33, 16.67]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, FH, 0.35), mSteel)
        col.position.set(cx, yBase + FH/2, cz)
        fg.add(col)
      }
    }
    for (const cx of [-HW, HW]) {
      for (const cz of [-HD + 6.65, -HD + 13.3, HD - 13.3, HD - 6.65]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, FH, 0.35), mSteel)
        col.position.set(cx, yBase + FH/2, cz)
        fg.add(col)
      }
    }

    // ── Transparent facade envelope ────────────────────────────────────────
    const spanH  = FH - winH - winY
    const spanYp = yBase + FH - spanH / 2
    const kneeH  = winY
    const kneeYp = yBase + kneeH / 2

    for (const [w, h, d, x, y, z] of [
      // Spandrel panels
      [BW,   spanH, 0.22, 0,   spanYp, -HD],
      [BW,   spanH, 0.22, 0,   spanYp,  HD],
      [0.22, spanH, BD,  -HW,  spanYp,  0 ],
      [0.22, spanH, BD,   HW,  spanYp,  0 ],
      // Knee walls
      [BW,   kneeH, 0.20, 0,   kneeYp, -HD],
      [BW,   kneeH, 0.20, 0,   kneeYp,  HD],
      [0.20, kneeH, BD,  -HW,  kneeYp,  0 ],
      [0.20, kneeH, BD,   HW,  kneeYp,  0 ],
    ] as [number,number,number,number,number,number][]) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mSpan)
      s.position.set(x, y, z)
      fg.add(s)
    }

    // ── N/S glazing — 12 panes, WWR ≈ 33% ─────────────────────────────────
    for (const sign of [-1, 1] as const) {
      const zid: ZoneState['id'] = sign < 0 ? 'nor' : 'sou'
      const gmat   = glassMats.get(zid)!
      const nPanes = 12
      const pW     = (BW - 0.7) / nPanes
      for (let p = 0; p < nPanes; p++) {
        const px = -HW + 0.35 + pW * (p + 0.5)
        const pane = new THREE.Mesh(new THREE.BoxGeometry(pW - 0.12, winH, 0.10), gmat)
        pane.position.set(px, yBase + winY + winH/2, sign * HD)
        fg.add(pane)
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.12, winH, 0.18), mSteel)
        mull.position.set(px - pW/2, yBase + winY + winH/2, sign * HD)
        fg.add(mull)
      }
    }

    // ── E/W glazing — 8 panes ─────────────────────────────────────────────
    for (const sign of [-1, 1] as const) {
      const zid: ZoneState['id'] = sign > 0 ? 'eas' : 'wes'
      const gmat   = glassMats.get(zid)!
      const nPanes = 8
      const pD     = (BD - 0.7) / nPanes
      for (let p = 0; p < nPanes; p++) {
        const pz = -HD + 0.35 + pD * (p + 0.5)
        const pane = new THREE.Mesh(new THREE.BoxGeometry(0.10, winH, pD - 0.12), gmat)
        pane.position.set(sign * HW, yBase + winY + winH/2, pz)
        fg.add(pane)
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.18, winH, 0.12), mSteel)
        mull.position.set(sign * HW, yBase + winY + winH/2, pz - pD/2)
        fg.add(mull)
      }
    }

    // ── Interior partition walls (with door gaps) — dollhouse, active floor ──
    const wallG = new THREE.Group()
    wallG.userData['floor'] = f
    const wallY = yBase + 0.13 + WALL_H / 2
    for (const s of WALL_SEGMENTS) {
      const len = s.to - s.from
      const mid = (s.from + s.to) / 2
      const geo = s.orient === 'h'
        ? new THREE.BoxGeometry(len, WALL_H, WALL_T)
        : new THREE.BoxGeometry(WALL_T, WALL_H, len)
      const wall = new THREE.Mesh(geo, wallMat)
      if (s.orient === 'h') wall.position.set(mid, wallY, s.at)
      else                  wall.position.set(s.at, wallY, mid)
      wallG.add(wall)
    }
    fg.add(wallG)
    wallGroups.push(wallG)

    // ── Procedural furniture (shown on the active floor only) ───────────────
    const furn = buildFurniture(yBase)
    fg.add(furn)
    furnitureGroups.push(furn)
  }

  // ── Roof (ghost slab + parapet) — rides with the top floor ────────────────
  group.add(topGroup)
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.8, 0.50, BD + 0.8), mRoof)
  roofSlab.position.set(0, NF * FH, 0)
  topGroup.add(roofSlab)

  for (const [w, h, d, x, z] of [
    [BW,  0.9, 0.25, 0,   -HD],
    [BW,  0.9, 0.25, 0,    HD],
    [0.25, 0.9, BD, -HW,   0 ],
    [0.25, 0.9, BD,  HW,   0 ],
  ] as [number,number,number,number,number][]) {
    const para = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mRoof)
    para.position.set(x, NF * FH + 0.45, z)
    topGroup.add(para)
  }

  // Rooftop AHUs
  const ahuY = NF * FH + 0.50 + 0.80
  for (let i = 0; i < 3; i++) {
    const ahu = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.6, 3.0), mSteel)
    ahu.position.set(-12 + i * 12, ahuY, 0)
    topGroup.add(ahu)
  }

  // Penthouse / stairwell
  const pent = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.8, 5.5), mRoof)
  pent.position.set(-HW + 5.5, NF * FH + 1.9 + 0.25, -HD + 4.0)
  topGroup.add(pent)

  return { group, floorGroups, topGroup, wallGroups, furnitureGroups, zoneMeshes, zoneMeshMats, glassMats, slabMeshes, floorSlabMats }
}

// Dynamic zone thermal model lives in lib/thermalModel.ts (shared with the
// metric cards). computeZoneTemps is imported at the top of this file.

// ─── Update zone + glass colors from live temperature ────────────────────────

const BASE_ZONE = new THREE.Color(0x80b8e0)

function updateZoneMats(
  zoneMeshMats: Map<string, THREE.MeshPhongMaterial>,
  glassMats:    Map<ZoneState['id'], THREE.MeshPhongMaterial>,
  zones:        Record<ZoneState['id'], ZoneState>,
  prevTemps:    Map<ZoneState['id'], number>,
  spriteData:   Map<ZoneState['id'], SpriteEntry>,
): void {
  for (const id of ZONE_IDS) {
    const zone = zones[id]
    if (!zone) continue
    const prev = prevTemps.get(id)
    if (prev !== undefined && Math.abs(zone.temperature - prev) < 0.01) continue
    prevTemps.set(id, zone.temperature)

    const tc = tempToColor(zone.temperature)

    // Update all 3 floor zone materials with same hue
    for (let f = 0; f < NF; f++) {
      const mat = zoneMeshMats.get(`${id}_${f}`)
      if (!mat) continue
      mat.color.copy(BASE_ZONE).lerp(tc, 0.60)
      mat.emissive.copy(tc).multiplyScalar(0.14)
    }

    // Update glass pane material for this zone (if perimeter)
    const gm = glassMats.get(id)
    if (gm) {
      gm.color.copy(BASE_ZONE).lerp(tc, 0.50)
    }

    // Redraw sprite label (temperature + PMV thermal comfort)
    const sd = spriteData.get(id)
    if (sd) {
      const ctx = sd.canvas.getContext('2d')!
      const cf  = comfort(zone.temperature, zone.humidity ?? 50)
      drawZoneLabel(ctx, ZONE_NAMES[id], zone.temperature, cf, tc)
      sd.texture.needsUpdate = true
    }
  }
}

// ─── Selected-floor teal outline ─────────────────────────────────────────────

function makeFloorOutline(): THREE.LineSegments {
  const geo = new THREE.EdgesGeometry(new THREE.BoxGeometry(BW + 1.4, FH + 0.08, BD + 1.4))
  const mat = new THREE.LineBasicMaterial({ color: 0x00d4aa })
  return new THREE.LineSegments(geo, mat)
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useBuildingScene(
  canvasRef:       React.RefObject<HTMLCanvasElement | null>,
  viewMode:        '3d' | 'plan',
  liveData:        DigitalTwinState,
  highlightedZone: string | null,
  onHoverZone:     (id: string | null) => void,
  simHour?:        number,
  extTemp?:        number,   // °C — drives glass tint flash
): void {
  const activeFloor = useDashboardStore((s) => s.selectedFloor)
  const setFloor    = useDashboardStore((s) => s.setSelectedFloor)
  const selectZone  = useDashboardStore((s) => s.selectZone)
  const cfd         = useDashboardStore((s) => s.cfdCinematic)
  const endCfd      = useDashboardStore((s) => s.endCfd)

  const liveDataRef    = useRef(liveData)
  const viewModeRef    = useRef(viewMode)
  const activeFloorRef = useRef(activeFloor)
  const setFloorRef    = useRef(setFloor)
  const selectZoneRef  = useRef(selectZone)
  const highlightedRef = useRef(highlightedZone)
  const onHoverRef     = useRef(onHoverZone)
  const hoverIdRef     = useRef<string | null>(null)
  const simHourRef     = useRef(simHour)
  const extTempRef     = useRef(extTemp    ?? 30)
  const cfdRef         = useRef<CfdCinematic | null>(cfd)
  const endCfdRef      = useRef(endCfd)

  useEffect(() => { liveDataRef.current    = liveData              }, [liveData])
  useEffect(() => { viewModeRef.current    = viewMode              }, [viewMode])
  useEffect(() => { activeFloorRef.current = activeFloor           }, [activeFloor])
  useEffect(() => { setFloorRef.current    = setFloor              }, [setFloor])
  useEffect(() => { selectZoneRef.current  = selectZone            }, [selectZone])
  useEffect(() => { highlightedRef.current = highlightedZone       }, [highlightedZone])
  useEffect(() => { onHoverRef.current     = onHoverZone           }, [onHoverZone])
  useEffect(() => { simHourRef.current     = simHour               }, [simHour])
  useEffect(() => { extTempRef.current     = extTemp   ?? 30       }, [extTemp])
  useEffect(() => { cfdRef.current         = cfd                   }, [cfd])
  useEffect(() => { endCfdRef.current      = endCfd                }, [endCfd])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // ── Renderer ───────────────────────────────────────────────────────────
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))
    renderer.setClearColor(0x0e1a2e, 1)
    // Shadows disabled: transparent materials + shadow maps produce z-fighting artefacts
    renderer.shadowMap.enabled = false

    // ── Scene ──────────────────────────────────────────────────────────────
    const scene = new THREE.Scene()
    // scene.background is set via sceneBg (persistent Color) before animate()

    // ── Camera — north-side vantage looking toward the southern sky, so the
    //    real solar arc (E→S→W) sweeps across the frame; wide-ish FOV for sky ─
    const camera = new THREE.PerspectiveCamera(54, 1, 0.5, 600)
    camera.position.set(30, 30, -82)
    camera.lookAt(0, 13, 3)

    // ── OrbitControls ──────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, canvas)
    controls.target.set(0, 13, 3)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance   = 35
    controls.maxDistance   = 220
    controls.maxPolarAngle = Math.PI / 2.1
    controls.update()

    // ── Lighting ───────────────────────────────────────────────────────────
    const hemiLight = new THREE.HemisphereLight(0xc8ddf0, 0x6888a0, 1.0)
    scene.add(hemiLight)

    const keyLight = new THREE.DirectionalLight(0xfff5e8, 1.8)
    keyLight.position.set(60, 100, 50)
    scene.add(keyLight)

    const fillLight = new THREE.DirectionalLight(0xa0c8e8, 0.6)
    fillLight.position.set(-50, 40, -40)
    scene.add(fillLight)

    const rimLight = new THREE.DirectionalLight(0xd0e8ff, 0.3)
    rimLight.position.set(0, 20, -80)
    scene.add(rimLight)

    // ── Ground ─────────────────────────────────────────────────────────────
    const groundG   = new THREE.PlaneGeometry(300, 300)
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x1a2c10, shininess: 2 })
    const ground    = new THREE.Mesh(groundG, groundMat)
    ground.rotation.x = -Math.PI / 2
    ground.position.y = -0.15
    scene.add(ground)

    // ── Sky dome — color driven by real wall-clock time each frame ─────────
    const skyG    = new THREE.SphereGeometry(390, 24, 12)
    const skyMat  = new THREE.MeshBasicMaterial({ color: 0x020c18, side: THREE.BackSide })
    const skyMesh = new THREE.Mesh(skyG, skyMat)
    scene.add(skyMesh)

    // ── Sun disc ──────────────────────────────────────────────────────────
    const sunG    = new THREE.SphereGeometry(9, 20, 12)
    const sunMat  = new THREE.MeshBasicMaterial({ color: 0xfffae0 })
    const sunMesh = new THREE.Mesh(sunG, sunMat)
    scene.add(sunMesh)

    // ── Moon disc ─────────────────────────────────────────────────────────
    const moonG    = new THREE.SphereGeometry(4, 12, 6)
    const moonMat  = new THREE.MeshBasicMaterial({ color: 0xd4dce8 })
    const moonMesh = new THREE.Mesh(moonG, moonMat)
    scene.add(moonMesh)

    // ── Sun glow point light (warm during day, cool silver at night) ───────
    const sunGlow = new THREE.PointLight(0xfff0cc, 0, 600)
    scene.add(sunGlow)

    // ── Post-processing: bloom so the sun + hot facades glow ───────────────
    const composer  = new EffectComposer(renderer)
    composer.setPixelRatio(renderer.getPixelRatio())
    composer.addPass(new RenderPass(scene, camera))
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.7, 0.5, 0.82)
    composer.addPass(bloomPass)
    composer.addPass(new OutputPass())

    // ── Building ───────────────────────────────────────────────────────────
    const mats = makeMaterials()
    const {
      group: building,
      floorGroups, topGroup, wallGroups, furnitureGroups,
      zoneMeshes, zoneMeshMats, glassMats,
      slabMeshes, floorSlabMats,
    } = buildBuilding(mats)
    scene.add(building)

    // ── Floor selection outline ────────────────────────────────────────────
    const floorOutline = makeFloorOutline()
    scene.add(floorOutline)

    // ── Zone edge lines — per (zone × floor) ──────────────────────────────
    // key = "${id}_${floor}"
    const volH    = FH * 0.92
    const zoneEdges = new Map<string, THREE.LineSegments>()
    for (const id of ZONE_IDS) {
      const g = ZONE_GEOM[id]
      for (let f = 0; f < NF; f++) {
        const volY    = f * FH + (FH - volH) / 2 + 0.04
        const edgeGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(g.w - 0.1, volH, g.d - 0.1))
        const edgeMat = new THREE.LineBasicMaterial({ color: 0x88ccff, opacity: 0.70, transparent: true })
        const edges   = new THREE.LineSegments(edgeGeo, edgeMat)
        edges.position.set(g.cx, volY, g.cz)
        floorGroups[f]!.add(edges)   // parented to floor group → rides the exploded offset
        zoneEdges.set(`${id}_${f}`, edges)
      }
    }

    // ── Floating zone sprite labels (5, repositioned each frame) ──────────
    const zoneSprites  = new Map<ZoneState['id'], SpriteEntry>()
    const prevTemps    = new Map<ZoneState['id'], number>()
    const initColor    = new THREE.Color('#4488cc')

    for (const id of ZONE_IDS) {
      const entry = makeSpriteEntry(ZONE_NAMES[id], 22, initColor)
      scene.add(entry.sprite)
      zoneSprites.set(id, entry)
    }

    // ── CFD field — one floor-wide plane textured by a CPU Euler fluid sim ────
    //    (walls = solid cells, diffusers = cold inlets; air advects through the
    //    doorways between zones). Hidden until a recommendation is applied.
    const floorFluid = new FloorFluid()
    const cfdBuf     = new Uint8Array(floorFluid.numX * floorFluid.numY * 4)
    const cfdTex     = new THREE.DataTexture(cfdBuf, floorFluid.numX, floorFluid.numY, THREE.RGBAFormat)
    cfdTex.magFilter = THREE.LinearFilter
    cfdTex.minFilter = THREE.LinearFilter
    cfdTex.needsUpdate = true
    const cfdMat = new THREE.MeshBasicMaterial({
      map: cfdTex, transparent: true, depthTest: false, depthWrite: false, opacity: 0,
    })
    const cfdPlane = new THREE.Mesh(new THREE.PlaneGeometry(BW, BD), cfdMat)
    cfdPlane.rotation.x  = -Math.PI / 2
    cfdPlane.rotation.z  =  Math.PI       // align texture (i,j) with world (x,z)
    cfdPlane.renderOrder = 999
    cfdPlane.visible     = false
    scene.add(cfdPlane)

    // ── Collect zone volumes for raycasting ────────────────────────────────
    const allZoneVols: THREE.Mesh[] = []
    for (const meshList of zoneMeshes.values()) allZoneVols.push(...meshList)

    const raycaster = new THREE.Raycaster()
    const mouse     = new THREE.Vector2()

    // ── Click handler ──────────────────────────────────────────────────────
    function onCanvasClick(e: MouseEvent): void {
      if (viewModeRef.current !== '3d' || !canvas) return
      const rect = canvas.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      // Only raycast against the active floor's zone volumes to prevent cross-floor selection
      const activeVols = allZoneVols.filter((m) => m.userData['floor'] === activeFloorRef.current)
      const zoneHits = raycaster.intersectObjects(activeVols, false)
      if (zoneHits.length > 0) {
        const obj = zoneHits[0].object
        selectZoneRef.current(obj.userData['zoneId'] as string)
        return
      }

      // Click outside zones on any slab → switch floor
      const slabHits = raycaster.intersectObjects(slabMeshes, false)
      if (slabHits.length > 0) {
        setFloorRef.current(slabHits[0].object.userData['floor'] as number)
        return
      }

      const hits = raycaster.intersectObject(building, true)
      if (hits.length > 0) {
        const f = hits[0].object.userData['floor']
        if (typeof f === 'number') setFloorRef.current(f)
      }
    }

    // ── Hover handler ──────────────────────────────────────────────────────
    function onCanvasMouseMove(e: MouseEvent): void {
      if (viewModeRef.current !== '3d' || !canvas) return
      const rect = canvas.getBoundingClientRect()
      mouse.x =  ((e.clientX - rect.left) / rect.width)  * 2 - 1
      mouse.y = -((e.clientY - rect.top)  / rect.height) * 2 + 1
      raycaster.setFromCamera(mouse, camera)

      // Only hover-detect on the active floor
      const activeVols = allZoneVols.filter((m) => m.userData['floor'] === activeFloorRef.current)
      const hits = raycaster.intersectObjects(activeVols, false)
      const next  = hits.length > 0 ? (hits[0].object.userData['zoneId'] as string) : null
      if (next !== hoverIdRef.current) {
        hoverIdRef.current = next
        canvas.style.cursor = next ? 'pointer' : 'default'
        onHoverRef.current(next)
      }
    }

    canvas.addEventListener('click', onCanvasClick)
    canvas.addEventListener('mousemove', onCanvasMouseMove)

    // ── ResizeObserver ─────────────────────────────────────────────────────
    const wrapper = canvas.parentElement
    const ro = new ResizeObserver(() => {
      if (!wrapper) return
      const w = wrapper.clientWidth
      const h = wrapper.clientHeight
      if (w > 0 && h > 0) {
        renderer.setSize(w, h, false)
        composer.setSize(w, h)
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
    })
    if (wrapper) ro.observe(wrapper)
    if (wrapper && wrapper.clientWidth > 0) {
      renderer.setSize(wrapper.clientWidth, wrapper.clientHeight, false)
      composer.setSize(wrapper.clientWidth, wrapper.clientHeight)
      camera.aspect = wrapper.clientWidth / wrapper.clientHeight
      camera.updateProjectionMatrix()
    }

    // ── Persistent colours (reused every frame to avoid GC pressure) ──────
    const sceneBg    = new THREE.Color(0x020c18)
    scene.background = sceneBg
    const _tempTint  = new THREE.Color()           // lerped heat color — reused

    // ── Animation loop ─────────────────────────────────────────────────────
    let rafId          = 0
    let pulseT         = 0
    let lastFrameTime  = performance.now()
    // Temperature flash state (local, not a React ref — lives with the GL scene)
    let tempFlash      = 0
    let prevExtTempGL  = extTempRef.current

    // ── CFD cinematic state (lives with the GL scene) ─────────────────────
    interface CineShot { zone: ZoneState['id'] | null; pos: THREE.Vector3; target: THREE.Vector3; dur: number }
    interface Cine {
      jobId: string; floor: number; shots: CineShot[]; idx: number; shotStartMs: number
      fromPos: THREE.Vector3; fromTarget: THREE.Vector3; activated: Set<ZoneState['id']>
    }
    let cine:          Cine | null = null
    let cfdPlayedId:   string | null = null
    let cfdShownFloor: number = -1        // floor whose flow field is shown (−1 = none)
    let cfdFadeStart:  number = 0         // ms timestamp when the field begins fading out (0 = none)
    const _cineTarget  = new THREE.Vector3()
    const easeInOut    = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2)

    function animate(): void {
      rafId = requestAnimationFrame(animate)
      const nowMs = performance.now()
      const dt    = Math.min((nowMs - lastFrameTime) / 1000, 0.05)  // seconds, capped
      lastFrameTime = nowMs
      pulseT += 0.045

      const live     = liveDataRef.current
      const mode     = viewModeRef.current
      const curFloor = activeFloorRef.current
      const hlZone   = highlightedRef.current
      const hvZone   = hoverIdRef.current

      // ──⓪ CFD cinematic trigger — a freshly-applied recommendation starts the
      //    focus → flythrough → zoom-out sequence (played once per jobId) ─────
      {
        const job = cfdRef.current
        if (job && job.jobId !== cfdPlayedId && cine === null && mode === '3d') {
          cfdPlayedId = job.jobId
          setFloorRef.current(job.floor)          // make that floor active (solid, centred)
          const fy = job.floor * FH
          const shots: CineShot[] = job.zoneIds.map((zid) => {
            const g = ZONE_GEOM[zid]
            return {
              zone:   zid,
              pos:    new THREE.Vector3(g.cx + 10, fy + 13, g.cz - 20),
              target: new THREE.Vector3(g.cx, fy + 1.4, g.cz),
              dur:    zid === job.primaryZoneId ? 1.8 : 1.4,
            }
          })
          // Final shot — high-angle reveal of the whole floor's airflow field
          shots.push({
            zone: null,
            pos:    new THREE.Vector3(0, fy + 30, 18),
            target: new THREE.Vector3(0, fy + 1, 0),
            dur:    2.2,
          })
          cine = {
            jobId: job.jobId, floor: job.floor, shots, idx: 0, shotStartMs: nowMs,
            fromPos: camera.position.clone(), fromTarget: controls.target.clone(),
            activated: new Set<ZoneState['id']>(),
          }
          controls.enabled = false
          cfdShownFloor = job.floor
          cfdFadeStart  = 0
          floorFluid.reset()
          cfdPlane.visible = true
        }
      }

      // ── Shared sim-time / solar state (used by zones, sky, facades, weather)
      const _now2      = new Date()
      const realHour   = _now2.getHours() + _now2.getMinutes() / 60 + _now2.getSeconds() / 3600
      const hourOfDay  = simHourRef.current !== undefined ? simHourRef.current : realHour
      const { el, az } = solarPosition(hourOfDay)
      const elDisp     = Math.min(el, SUN_EL_CAP)   // capped elevation for the visible orb/light
      const isDaytime  = el > -0.08
      const isNight    = el < 0.05
      // Real per-facade solar load + the dominant lit facade (for the thermal model)
      const fLoads = facadeSolarLoads(az, el)
      let incidenceId: ZoneState['id'] | null = null
      let _maxLoad = 0.06
      for (const id of ['nor', 'sou', 'eas', 'wes'] as ZoneState['id'][]) {
        if (fLoads[id] > _maxLoad) { _maxLoad = fLoads[id]; incidenceId = id }
      }

      // ① Dynamic zone temperatures — driven by ext temp, time of day, and solar incidence
      const dynTemps = computeZoneTemps(extTempRef.current, hourOfDay, incidenceId)
      const dynZones = { ...live.zones }
      for (const id of ZONE_IDS) {
        if (dynZones[id]) dynZones[id] = { ...dynZones[id]!, temperature: dynTemps[id]! }
      }
      updateZoneMats(zoneMeshMats, glassMats, dynZones, prevTemps, zoneSprites)

      // ①b Exploded floors — active floor is the reference (offset 0); the rest
      // spread away vertically so the stack reads clearly. Collapsed in plan mode.
      const exploded = mode === '3d'
      const lerpK    = Math.min(1, dt * 6)
      for (let f = 0; f < floorGroups.length; f++) {
        const fg      = floorGroups[f]!
        const targetY = exploded ? (f - curFloor) * EXPLODE_GAP : 0
        fg.position.y += (targetY - fg.position.y) * lerpK
        // Active floor swells slightly (XZ only) — "se agranda" emphasis
        const targetS = (exploded && f === curFloor) ? 1.035 : 1.0
        const s = fg.scale.x + (targetS - fg.scale.x) * lerpK
        fg.scale.set(s, 1, s)
      }
      // Roof / AHUs ride with the top floor's exploded offset
      {
        const topTargetY = exploded ? (NF - 1 - curFloor) * EXPLODE_GAP : 0
        topGroup.position.y += (topTargetY - topGroup.position.y) * lerpK
      }

      // ②₀ Dollhouse — walls + furniture shown only on the active floor
      for (let f = 0; f < wallGroups.length; f++) {
        const on = f === curFloor
        wallGroups[f]!.visible      = on
        furnitureGroups[f]!.visible = on
      }

      // ② Zone fills — active floor = faint temp tint (so walls/furniture read);
      //    inactive floors = hidden (wireframe only)
      for (const [id, meshList] of zoneMeshes) {
        for (const mesh of meshList) {
          const mf  = mesh.userData['floor'] as number
          const mat = mesh.material as THREE.MeshPhongMaterial
          const isActive = mf === curFloor
          if (!isActive) { mesh.visible = false; continue }
          mesh.visible = true
          const isHl = id === hlZone
          const isHv = id === hvZone
          if      (isHl) mat.opacity = 0.26 + 0.16 * (0.5 + 0.5 * Math.sin(pulseT))
          else if (isHv) mat.opacity = 0.30
          else           mat.opacity = 0.13   // faint air-tint over the furnished room
        }
      }

      // ③ Zone edges — active = crisp bright AutoCAD lines; inactive = dim steel wireframe
      for (const [key, edges] of zoneEdges) {
        const f   = parseInt(key.split('_')[1]!, 10)
        const mat = edges.material as THREE.LineBasicMaterial
        const isActive = f === curFloor
        mat.opacity = isActive ? 0.95 : 0.32
        mat.color.setHex(isActive ? 0xdcefff : 0x46637c)
      }

      // ③b Floor slab opacity: active bright, inactive thin (slab edge lines keep the wireframe read)
      for (let f = 0; f < floorSlabMats.length; f++) {
        floorSlabMats[f]!.opacity = f === curFloor ? 0.30 : 0.06
      }

      // ④ Sprite labels: position above active floor, hide in plan mode
      for (const [id, entry] of zoneSprites) {
        const g = ZONE_GEOM[id]
        // In 3D: float above zone; in plan: sit at zone centre height (sprites billboard toward camera)
        const spriteY = mode === 'plan'
          ? curFloor * FH + volH * 0.5        // centred in zone for top-down read
          : curFloor * FH + volH + 1.1        // floating above zone for 3D view
        entry.sprite.position.set(g.cx, spriteY, g.cz)
        entry.sprite.visible = true           // visible in both 3D and plan modes
      }

      // ⑤ Floor outline tracks selected floor
      floorOutline.position.set(0, curFloor * FH + FH / 2, 0)

      // ⑥ View mode — the CFD cinematic drives the camera directly when active
      if (cine) {
        camera.up.set(0, 1, 0)
        building.visible     = true
        floorOutline.visible = true
      } else if (mode === 'plan') {
        // Top-down orthographic-style view: camera straight above active floor
        // camera.up = North (−Z) so North zone appears at the top of the screen
        controls.enabled = false
        camera.up.set(0, 0, -1)
        camera.position.set(0, curFloor * FH + 58, 0)
        camera.lookAt(0, curFloor * FH, 0)
        building.visible     = true
        floorOutline.visible = true
      } else {
        controls.enabled     = true
        camera.up.set(0, 1, 0)
        building.visible     = true
        floorOutline.visible = true
        controls.update()
      }

      // ⑥b CFD cinematic — camera keyframes (focus → flythrough → zoom out) +
      //    flow-plane activation/animation. Runs over the GL scene's own clock.
      if (cine) {
        const shot = cine.shots[cine.idx]!
        const t    = Math.min(1, (nowMs - cine.shotStartMs) / (shot.dur * 1000))
        const te   = easeInOut(t)
        camera.position.lerpVectors(cine.fromPos, shot.pos, te)
        _cineTarget.lerpVectors(cine.fromTarget, shot.target, te)
        camera.lookAt(_cineTarget)

        // Open this zone's diffuser inlet on arrival (cold air starts entering)
        if (shot.zone && !cine.activated.has(shot.zone)) {
          cine.activated.add(shot.zone)
          floorFluid.setInlet(shot.zone, true)
        }

        if (t >= 1) {
          cine.idx++
          if (cine.idx >= cine.shots.length) {
            cine = null
            controls.enabled = true
            controls.target.copy(_cineTarget)
            cfdFadeStart = nowMs + 2600         // hold the revealed field, then fade
            endCfdRef.current()
          } else {
            cine.fromPos.copy(camera.position)
            cine.fromTarget.copy(_cineTarget)
            cine.shotStartMs = nowMs
          }
        }
      }

      // ⑥c Step the CPU Euler fluid + refresh the field texture on the active floor
      if (cfdShownFloor >= 0) {
        const offY = floorGroups[cfdShownFloor]?.position.y ?? 0
        // Master fade: full during/just-after the cinematic, then ease out
        let master = 0.85
        if (cfdFadeStart > 0 && nowMs > cfdFadeStart) {
          master = 0.85 * Math.max(0, 1 - (nowMs - cfdFadeStart) / 2000)
        }
        // Advance the fluid by real elapsed time (frame-rate independent spread)
        const sub = Math.max(1, Math.min(4, Math.round(dt / (1 / 60))))
        for (let s2 = 0; s2 < sub; s2++) floorFluid.step(1 / 60)
        floorFluid.writeRGBA(cfdBuf)
        cfdTex.needsUpdate = true
        cfdPlane.position.set(0, cfdShownFloor * FH + 1.4 + offY, 0)
        cfdMat.opacity = master

        // Volumetric read — fill each active-floor zone toward cold blue by how
        // much cold air has reached it (base → temp colour → cold, non-compounding)
        if (cfdShownFloor === curFloor) {
          for (const zid of ZONE_IDS) {
            const zmat = zoneMeshMats.get(`${zid}_${curFloor}`)
            const zone = dynZones[zid]
            if (!zmat || !zone) continue
            const cool = Math.min(1, floorFluid.zoneCoolness(zid)) * master
            const tc = tempToColor(zone.temperature)
            zmat.color.copy(BASE_ZONE).lerp(tc, 0.6).lerp(H_COLD, cool)
            zmat.opacity = Math.max(zmat.opacity, 0.13 + cool * 0.5)
          }
        }
        if (master <= 0.001) {
          cfdPlane.visible = false
          if (cine === null) { cfdShownFloor = -1; cfdFadeStart = 0; prevTemps.clear() }
        }
      }

      // ⑦ Solar / sky simulation (hourOfDay / isDaytime / isNight computed above)
      {
        // Sky dome + background colour (mutates sceneBg in-place — no allocation)
        const { sky: skyColor, ground: groundColor } = interpolateSky(hourOfDay)
        skyMat.color.copy(skyColor)
        sceneBg.copy(skyColor)

        // Ground colour (subtle day/night shift)
        groundMat.color.copy(groundColor)

        // Hemisphere ambient
        hemiLight.color.copy(skyColor)
        hemiLight.intensity = isDaytime ? 1.0 : 0.25

        // Sun orb — real azimuth arc (east → south → west) with capped elevation
        // so the disc stays in the visible sky band; bloomed via post-fx
        sunMesh.visible = el > -0.05
        if (sunMesh.visible) {
          const sp = sunWorldDir(az, elDisp).multiplyScalar(280)
          sunMesh.position.copy(sp)
          sunMat.color.copy(sunColorFromEl(el))
          keyLight.position.copy(sp)
          keyLight.intensity = Math.max(0.04, Math.sin(Math.max(0, el)) * 2.1)
          keyLight.color.copy(sunColorFromEl(el))
          sunGlow.position.copy(sp)
          sunGlow.color.copy(sunColorFromEl(el))
          sunGlow.intensity = Math.max(0, Math.sin(Math.max(0, el))) * 0.7
        } else {
          keyLight.intensity = 0.04
          sunGlow.intensity  = 0
        }

        // Moon orb — simple east→west night arc
        moonMesh.visible = isNight
        if (isNight) {
          const h24    = ((hourOfDay % 24) + 24) % 24
          const nightT = Math.max(0, Math.min(1, h24 >= 20 ? (h24 - 20) / 10 : (h24 + 4) / 10))
          const mAz    = Math.PI * 0.5 + nightT * Math.PI            // E → W
          const mEl    = Math.sin(nightT * Math.PI) * 0.7
          moonMesh.position.copy(sunWorldDir(mAz, mEl).multiplyScalar(330))
          sunGlow.position.copy(moonMesh.position)
          sunGlow.color.set(0xb8c8d8)
          sunGlow.intensity = 0.14
        }

        // ⑧ Facade solar impact + heat transfer
        // Each perimeter facade's glass glows blue→amber→red by (ambient air +
        // direct sun), and the active-floor zone behind the sunniest facade warms
        // — reads as solar radiation landing and heat moving inward.
        {
          const et = extTempRef.current
          if (Math.abs(et - prevExtTempGL) > 0.4) { tempFlash = 1.0; prevExtTempGL = et }
          tempFlash = Math.max(0, tempFlash - dt * 0.55)            // decay ~1.8 s
          const flashI = Math.sin(tempFlash * Math.PI) * 0.5
          const ambN   = Math.max(0, Math.min(1, (et - 15) / 40))   // ambient warmth 0..1
          const pulse  = 0.78 + 0.22 * (0.5 + 0.5 * Math.sin(pulseT * 0.9))

          for (const id of ['nor', 'sou', 'eas', 'wes'] as ZoneState['id'][]) {
            const load = fLoads[id]
            const heat = Math.max(0, Math.min(1, ambN * 0.5 + load * 0.9))
            heatToColor(heat, _tempTint)

            // Glass facade emissive — brighter where the sun hits square-on
            const gmat = glassMats.get(id)
            if (gmat) {
              const inten = 0.10 + heat * 0.5 + load * 0.35 * pulse + flashI * 0.4
              gmat.emissive.copy(_tempTint).multiplyScalar(inten)
            }
            // Heat transfer inward — active-floor perimeter zone warms with sun load
            const zmat = zoneMeshMats.get(`${id}_${curFloor}`)
            if (zmat) zmat.emissive.copy(_tempTint).multiplyScalar(0.08 + load * 0.5 * pulse)
          }
        }
      }

      composer.render()
    }

    animate()

    // ── Cleanup ────────────────────────────────────────────────────────────
    return () => {
      cancelAnimationFrame(rafId)
      canvas.removeEventListener('click', onCanvasClick)
      canvas.removeEventListener('mousemove', onCanvasMouseMove)
      ro.disconnect()
      controls.dispose()

      // Building geometry + shared structural materials
      building.traverse((obj) => {
        if (obj instanceof THREE.Mesh || obj instanceof THREE.LineSegments) {
          obj.geometry.dispose()
          const m = obj.material
          if (Array.isArray(m)) m.forEach((x) => (x as THREE.Material).dispose())
          else (m as THREE.Material).dispose()
        }
      })

      // Zone edge lines (not in building group)
      zoneEdges.forEach((ls) => {
        ls.geometry.dispose()
        ;(ls.material as THREE.Material).dispose()
      })

      // Sprite labels (not in building group)
      zoneSprites.forEach((entry) => {
        entry.texture.dispose()
        entry.sprite.material.dispose()
      })

      // CFD field plane + texture
      cfdPlane.geometry.dispose()
      cfdMat.dispose()
      cfdTex.dispose()

      // Extra structural materials (dispose once more; idempotent in Three.js)
      Object.values(mats).forEach((m) => m.dispose())
      floorSlabMats.forEach((m) => m.dispose())

      // Scene-level geometry
      groundG.dispose(); groundMat.dispose()
      skyG.dispose();    skyMat.dispose()
      sunG.dispose();    sunMat.dispose()
      moonG.dispose();   moonMat.dispose()
      composer.dispose()
      renderer.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef])
}
