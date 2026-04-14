import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useDashboardStore } from '../../../store/dashboardStore'
import type { DigitalTwinState, ZoneState } from '../types/digitalTwin.types'
import { solarPosition } from '../lib/solarPhysics'

// ─── DOE multizone_office_simple_air — real building constants ───────────────
// Chicago, IL office building | Deru et al. 2009
// 5 zones: North, South, East, West (perimeter) + Core

const BW = 50       // Width East-West  (m)
const BD = 33.25    // Depth North-South (m)
const FH = 2.74     // Floor height      (m)
const NF = 3        // Floors
const HW = BW / 2
const HD = BD / 2

const D_NS  = 207.58  / BW
const D_MID = BD - 2 * D_NS
const D_EW  = 131.416 / D_MID
const D_CW  = BW - 2 * D_EW

const ZONE_IDS: ZoneState['id'][] = ['nor', 'sou', 'eas', 'wes', 'cor']

const ZONE_GEOM: Record<ZoneState['id'], { w: number; d: number; cx: number; cz: number }> = {
  nor: { w: BW,   d: D_NS,  cx: 0,             cz: -HD + D_NS / 2  },
  sou: { w: BW,   d: D_NS,  cx: 0,             cz:  HD - D_NS / 2  },
  eas: { w: D_EW, d: D_MID, cx:  HW - D_EW/2,  cz: 0               },
  wes: { w: D_EW, d: D_MID, cx: -HW + D_EW/2,  cz: 0               },
  cor: { w: D_CW, d: D_MID, cx: 0,             cz: 0               },
}

const ZONE_NAMES: Record<ZoneState['id'], string> = {
  nor: 'NORTH', sou: 'SOUTH', eas: 'EAST', wes: 'WEST', cor: 'CORE',
}

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

function drawZoneLabel(
  ctx: CanvasRenderingContext2D,
  name: string,
  tempC: number,
  color: THREE.Color,
): void {
  const W = 192, H = 64
  ctx.clearRect(0, 0, W, H)

  const r = Math.round(color.r * 255)
  const g = Math.round(color.g * 255)
  const b = Math.round(color.b * 255)

  ctx.fillStyle = `rgba(${r},${g},${b},0.84)`
  ctx.beginPath()
  if (ctx.roundRect) ctx.roundRect(2, 2, W - 4, H - 4, 12)
  else               ctx.rect(2, 2, W - 4, H - 4)
  ctx.fill()

  ctx.strokeStyle = 'rgba(255,255,255,0.52)'
  ctx.lineWidth   = 1.5
  ctx.stroke()

  ctx.fillStyle    = '#ffffff'
  ctx.font         = 'bold 22px Inter,system-ui,sans-serif'
  ctx.textAlign    = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(name, W / 2, 7)

  ctx.font         = '18px Inter,system-ui,sans-serif'
  ctx.fillStyle    = 'rgba(255,255,255,0.88)'
  ctx.textBaseline = 'top'
  ctx.fillText(`${tempC.toFixed(1)}°C`, W / 2, 36)
}

interface SpriteEntry {
  sprite:  THREE.Sprite
  canvas:  HTMLCanvasElement
  texture: THREE.CanvasTexture
}

function makeSpriteEntry(name: string, tempC: number, color: THREE.Color): SpriteEntry {
  const canvas = document.createElement('canvas')
  canvas.width  = 192
  canvas.height = 64
  const ctx  = canvas.getContext('2d')!
  drawZoneLabel(ctx, name, tempC, color)
  const texture = new THREE.CanvasTexture(canvas)
  const mat     = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false })
  const sprite  = new THREE.Sprite(mat)
  sprite.scale.set(7.5, 2.5, 1)
  return { sprite, canvas, texture }
}

// ─── Sky / sun simulation ─────────────────────────────────────────────────────

interface SkyKey { h: number; sky: THREE.Color; ground: THREE.Color }

const SKY_KEYS: SkyKey[] = [
  { h:  0, sky: new THREE.Color(0x020c18), ground: new THREE.Color(0x04090f) },
  { h:  4, sky: new THREE.Color(0x020c18), ground: new THREE.Color(0x04090f) },
  { h:  5, sky: new THREE.Color(0x0e1830), ground: new THREE.Color(0x0a1018) },
  { h:  6, sky: new THREE.Color(0x1c2c50), ground: new THREE.Color(0x141e30) },
  { h:  7, sky: new THREE.Color(0x3a6090), ground: new THREE.Color(0x1a2a40) },
  { h:  8, sky: new THREE.Color(0x4888c8), ground: new THREE.Color(0x1e2e40) },
  { h: 12, sky: new THREE.Color(0x3878bc), ground: new THREE.Color(0x1c2c3c) },
  { h: 16, sky: new THREE.Color(0x4888c8), ground: new THREE.Color(0x1e2e40) },
  { h: 18, sky: new THREE.Color(0x3a6090), ground: new THREE.Color(0x1a2a40) },
  { h: 19, sky: new THREE.Color(0xb05c28), ground: new THREE.Color(0x281404) },
  { h: 20, sky: new THREE.Color(0x1a1430), ground: new THREE.Color(0x100814) },
  { h: 21, sky: new THREE.Color(0x060c1a), ground: new THREE.Color(0x040810) },
  { h: 24, sky: new THREE.Color(0x020c18), ground: new THREE.Color(0x04090f) },
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
 * Convert solar elevation + azimuth (radians) to a THREE.js world position.
 * Coordinate convention: x = East, y = Up, z = South (north = -Z).
 * Azimuth is measured from North, clockwise (matching solarPhysics.ts).
 */
function sunWorldPos(el: number, az: number, R: number): THREE.Vector3 {
  const cosEl = Math.cos(el)
  return new THREE.Vector3(
    R * cosEl * Math.sin(az),    // East (+X)
    R * Math.sin(el),             // Up   (+Y)
    -R * cosEl * Math.cos(az),   // -North = +South is +Z at az=π; -Z at az=0 (North)
  )
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
  group:         THREE.Group
  zoneMeshes:    Map<ZoneState['id'], THREE.Mesh[]>
  zoneMeshMats:  Map<string, THREE.MeshPhongMaterial>   // key: "${id}_${floor}"
  glassMats:     Map<ZoneState['id'], THREE.MeshPhongMaterial>
  slabMeshes:    THREE.Mesh[]
  floorSlabMats: THREE.MeshPhongMaterial[]
}

function buildBuilding(mats: ReturnType<typeof makeMaterials>): BuildingObjects {
  const { mSteel, mSpan, mRoof } = mats
  const group = new THREE.Group()

  const zoneMeshMats = new Map<string, THREE.MeshPhongMaterial>()
  const zoneMeshes   = new Map<ZoneState['id'], THREE.Mesh[]>(ZONE_IDS.map((id) => [id, []]))
  const glassMats    = new Map<ZoneState['id'], THREE.MeshPhongMaterial>()
  const floorSlabMats: THREE.MeshPhongMaterial[] = []
  const slabMeshes:    THREE.Mesh[]               = []

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
    group.add(slab)

    // Slab edge definition lines
    const slabEdge = new THREE.LineSegments(
      new THREE.EdgesGeometry(slabGeo),
      new THREE.LineBasicMaterial({ color: 0x3a5878, opacity: 0.45, transparent: true }),
    )
    slabEdge.position.copy(slab.position)
    group.add(slabEdge)

    // ── Zone volumes — PRIMARY visual element (one per zone per floor) ─────
    for (const id of ZONE_IDS) {
      const g   = ZONE_GEOM[id]
      const mat = new THREE.MeshPhongMaterial({
        color: 0x80b8e0, shininess: 30,
        transparent: true, opacity: 0.78, depthWrite: true,
      })
      zoneMeshMats.set(`${id}_${f}`, mat)

      const geo = new THREE.BoxGeometry(g.w - 0.30, volH, g.d - 0.30)
      const vol = new THREE.Mesh(geo, mat)
      vol.position.set(g.cx, volY, g.cz)
      vol.userData['zoneId'] = id
      vol.userData['floor']  = f
      group.add(vol)
      zoneMeshes.get(id)!.push(vol)
    }

    // ── Structural columns ─────────────────────────────────────────────────
    for (const [cx, cz] of [[-HW,-HD],[HW,-HD],[-HW,HD],[HW,HD]] as [number,number][]) {
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.50, FH, 0.50), mSteel)
      col.position.set(cx, yBase + FH/2, cz)
      group.add(col)
    }
    for (const cz of [-HD, HD]) {
      for (const cx of [-16.67, -8.33, 0, 8.33, 16.67]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, FH, 0.35), mSteel)
        col.position.set(cx, yBase + FH/2, cz)
        group.add(col)
      }
    }
    for (const cx of [-HW, HW]) {
      for (const cz of [-HD + 6.65, -HD + 13.3, HD - 13.3, HD - 6.65]) {
        const col = new THREE.Mesh(new THREE.BoxGeometry(0.35, FH, 0.35), mSteel)
        col.position.set(cx, yBase + FH/2, cz)
        group.add(col)
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
      group.add(s)
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
        group.add(pane)
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.12, winH, 0.18), mSteel)
        mull.position.set(px - pW/2, yBase + winY + winH/2, sign * HD)
        group.add(mull)
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
        group.add(pane)
        const mull = new THREE.Mesh(new THREE.BoxGeometry(0.18, winH, 0.12), mSteel)
        mull.position.set(sign * HW, yBase + winY + winH/2, pz - pD/2)
        group.add(mull)
      }
    }
  }

  // ── Roof (ghost slab + parapet) ───────────────────────────────────────────
  const roofSlab = new THREE.Mesh(new THREE.BoxGeometry(BW + 0.8, 0.50, BD + 0.8), mRoof)
  roofSlab.position.set(0, NF * FH, 0)
  group.add(roofSlab)

  for (const [w, h, d, x, z] of [
    [BW,  0.9, 0.25, 0,   -HD],
    [BW,  0.9, 0.25, 0,    HD],
    [0.25, 0.9, BD, -HW,   0 ],
    [0.25, 0.9, BD,  HW,   0 ],
  ] as [number,number,number,number,number][]) {
    const para = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mRoof)
    para.position.set(x, NF * FH + 0.45, z)
    group.add(para)
  }

  // Rooftop AHUs
  const ahuY = NF * FH + 0.50 + 0.80
  for (let i = 0; i < 3; i++) {
    const ahu = new THREE.Mesh(new THREE.BoxGeometry(5.0, 1.6, 3.0), mSteel)
    ahu.position.set(-12 + i * 12, ahuY, 0)
    group.add(ahu)
  }

  // Penthouse / stairwell
  const pent = new THREE.Mesh(new THREE.BoxGeometry(7.0, 3.8, 5.5), mRoof)
  pent.position.set(-HW + 5.5, NF * FH + 1.9 + 0.25, -HD + 4.0)
  group.add(pent)

  return { group, zoneMeshes, zoneMeshMats, glassMats, slabMeshes, floorSlabMats }
}

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
    if (prev !== undefined && Math.abs(zone.temperature - prev) < 0.05) continue
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

    // Redraw sprite label
    const sd = spriteData.get(id)
    if (sd) {
      const ctx = sd.canvas.getContext('2d')!
      drawZoneLabel(ctx, ZONE_NAMES[id], zone.temperature, tc)
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
): void {
  const activeFloor = useDashboardStore((s) => s.selectedFloor)
  const setFloor    = useDashboardStore((s) => s.setSelectedFloor)
  const selectZone  = useDashboardStore((s) => s.selectZone)

  const liveDataRef    = useRef(liveData)
  const viewModeRef    = useRef(viewMode)
  const activeFloorRef = useRef(activeFloor)
  const setFloorRef    = useRef(setFloor)
  const selectZoneRef  = useRef(selectZone)
  const highlightedRef = useRef(highlightedZone)
  const onHoverRef     = useRef(onHoverZone)
  const hoverIdRef     = useRef<string | null>(null)

  useEffect(() => { liveDataRef.current    = liveData        }, [liveData])
  useEffect(() => { viewModeRef.current    = viewMode        }, [viewMode])
  useEffect(() => { activeFloorRef.current = activeFloor     }, [activeFloor])
  useEffect(() => { setFloorRef.current    = setFloor        }, [setFloor])
  useEffect(() => { selectZoneRef.current  = selectZone      }, [selectZone])
  useEffect(() => { highlightedRef.current = highlightedZone }, [highlightedZone])
  useEffect(() => { onHoverRef.current     = onHoverZone     }, [onHoverZone])

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
    scene.background = new THREE.Color(0x0e1a2e)

    // ── Camera — lower elevation to expose zone cross-section ──────────────
    const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600)
    camera.position.set(65, 40, 68)
    camera.lookAt(0, FH, 0)

    // ── OrbitControls ──────────────────────────────────────────────────────
    const controls = new OrbitControls(camera, canvas)
    controls.target.set(0, FH, 0)
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
    const groundMat = new THREE.MeshPhongMaterial({ color: 0x141e2e, shininess: 2 })
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
    const sunG    = new THREE.SphereGeometry(6, 16, 8)
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

    // ── Building ───────────────────────────────────────────────────────────
    const mats = makeMaterials()
    const {
      group: building,
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
        scene.add(edges)
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

      const hits = raycaster.intersectObjects(building.children, false)
      if (hits.length > 0) {
        setFloorRef.current(Math.max(0, Math.min(NF - 1, Math.floor(hits[0].point.y / FH))))
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
        camera.aspect = w / h
        camera.updateProjectionMatrix()
      }
    })
    if (wrapper) ro.observe(wrapper)
    if (wrapper && wrapper.clientWidth > 0) {
      renderer.setSize(wrapper.clientWidth, wrapper.clientHeight, false)
      camera.aspect = wrapper.clientWidth / wrapper.clientHeight
      camera.updateProjectionMatrix()
    }

    // ── Animation loop ─────────────────────────────────────────────────────
    let rafId  = 0
    let pulseT = 0

    function animate(): void {
      rafId = requestAnimationFrame(animate)
      pulseT += 0.045

      const live     = liveDataRef.current
      const mode     = viewModeRef.current
      const curFloor = activeFloorRef.current
      const hlZone   = highlightedRef.current
      const hvZone   = hoverIdRef.current

      // ① Update zone/glass/label colors from live temperature
      updateZoneMats(zoneMeshMats, glassMats, live.zones, prevTemps, zoneSprites)

      // ② Per-mesh opacity: active floor fully lit, other floors nearly invisible
      for (const [id, meshList] of zoneMeshes) {
        for (const mesh of meshList) {
          const mf  = mesh.userData['floor'] as number
          const mat = mesh.material as THREE.MeshPhongMaterial
          const isActive = mf === curFloor
          const isHl     = isActive && id === hlZone
          const isHv     = isActive && id === hvZone

          if (!isActive) {
            mat.opacity = 0.03          // near-invisible ghost
          } else if (isHl) {
            mat.opacity = 0.62 + 0.28 * (0.5 + 0.5 * Math.sin(pulseT))
          } else if (isHv) {
            mat.opacity = 0.94
          } else {
            mat.opacity = 0.86          // active floor — strong fill
          }
        }
      }

      // ③ Zone edge line opacity by floor
      for (const [key, edges] of zoneEdges) {
        const f   = parseInt(key.split('_')[1]!, 10)
        const mat = edges.material as THREE.LineBasicMaterial
        mat.opacity = f === curFloor ? 0.80 : 0.02   // inactive edges almost gone
      }

      // ③b Floor slab opacity: active bright, others near-invisible
      for (let f = 0; f < floorSlabMats.length; f++) {
        floorSlabMats[f]!.opacity = f === curFloor ? 0.22 : 0.03
      }

      // ④ Sprite labels: position above active floor, hide in plan mode
      for (const [id, entry] of zoneSprites) {
        const g = ZONE_GEOM[id]
        entry.sprite.position.set(g.cx, curFloor * FH + volH + 1.1, g.cz)
        entry.sprite.visible = mode === '3d'
      }

      // ⑤ Floor outline tracks selected floor
      floorOutline.position.set(0, curFloor * FH + FH / 2, 0)

      // ⑥ View mode
      if (mode === 'plan') {
        camera.position.set(controls.target.x, curFloor * FH + 65, controls.target.z)
        camera.lookAt(controls.target.x, curFloor * FH, controls.target.z)
        building.visible     = false
        floorOutline.visible = false
      } else {
        building.visible     = true
        floorOutline.visible = true
        controls.update()
      }

      // ⑦ Solar / sky simulation — real wall-clock time ──────────────────
      {
        const now       = new Date()
        const hourOfDay = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600
        const { el, az } = solarPosition(hourOfDay)
        const isDaytime  = el > -0.08   // sun above or just below horizon
        const isNight    = el < 0.05

        // Sky dome colour
        const { sky: skyColor, ground: groundColor } = interpolateSky(hourOfDay)
        skyMat.color.copy(skyColor)
        scene.background = skyColor.clone()
        renderer.setClearColor(skyColor, 1)

        // Ground colour (subtle day/night shift)
        groundMat.color.copy(groundColor)

        // Hemisphere ambient intensity
        hemiLight.color.copy(skyColor)
        hemiLight.intensity = isDaytime ? 1.0 : 0.25

        // Sun orb
        sunMesh.visible = isDaytime
        if (isDaytime) {
          const sp = sunWorldPos(el, az, 340)
          sunMesh.position.copy(sp)
          sunMat.color.copy(sunColorFromEl(el))
          keyLight.position.copy(sp)
          keyLight.intensity   = Math.max(0.05, Math.sin(Math.max(0, el)) * 1.8)
          keyLight.color.copy(sunColorFromEl(el))
          sunGlow.position.copy(sp)
          sunGlow.color.copy(sunColorFromEl(el))
          sunGlow.intensity = Math.max(0, Math.sin(Math.max(0, el))) * 0.6
        } else {
          keyLight.intensity = 0.05
          sunGlow.intensity  = 0
        }

        // Moon orb — opposite side, fixed elevation when sun is down
        moonMesh.visible = isNight
        if (isNight) {
          const moonAz = az + Math.PI
          const moonEl = 0.55   // ~31° above horizon — simplified
          const mp = sunWorldPos(moonEl, moonAz, 340)
          moonMesh.position.copy(mp)
          sunGlow.position.copy(mp)
          sunGlow.color.set(0xb8c8d8)
          sunGlow.intensity = 0.12
        }
      }

      renderer.render(scene, camera)
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

      // Extra structural materials (dispose once more; idempotent in Three.js)
      Object.values(mats).forEach((m) => m.dispose())
      floorSlabMats.forEach((m) => m.dispose())

      // Scene-level geometry
      groundG.dispose(); groundMat.dispose()
      skyG.dispose();    skyMat.dispose()
      sunG.dispose();    sunMat.dispose()
      moonG.dispose();   moonMat.dispose()
      renderer.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef])
}
