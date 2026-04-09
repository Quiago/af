import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useDashboardStore } from '../../../store/dashboardStore'
import { useDigitalTwinData } from './useDigitalTwinData'
import type { ZoneState } from '../types/digitalTwin.types'

// ─── DOE multizone_office_simple_air — real building dimensions ───────────────
const BW = 50       // Width East-West   (m)
const BD = 33.25    // Depth North-South (m)
const FH = 2.74     // Floor height      (m)
const HW = BW / 2   // 25 m
const HD = BD / 2   // 16.625 m

// Zone perimeter depths from real DOE zone areas
const D_NS  = 207.58  / BW         // N/S depth   = 4.152 m
const D_MID = BD - 2 * D_NS        // Middle span = 24.946 m
const D_EW  = 131.416 / D_MID      // E/W width   = 5.268 m
const D_CW  = BW - 2 * D_EW       // Core width  = 39.464 m

// Zone footprints — matches useBuildingScene geometry exactly
const ZONE_GEOM: Record<ZoneState['id'], { w: number; d: number; cx: number; cz: number }> = {
  nor: { w: BW,   d: D_NS,  cx: 0,             cz: -HD + D_NS / 2  },
  sou: { w: BW,   d: D_NS,  cx: 0,             cz:  HD - D_NS / 2  },
  eas: { w: D_EW, d: D_MID, cx:  HW - D_EW/2,  cz: 0               },
  wes: { w: D_EW, d: D_MID, cx: -HW + D_EW/2,  cz: 0               },
  cor: { w: D_CW, d: D_MID, cx: 0,             cz: 0               },
}

const DIFFUSERS: Array<{ zoneId: ZoneState['id']; x: number; z: number }> = [
  { zoneId: 'nor', x: -10,          z: -HD + D_NS / 2 },
  { zoneId: 'nor', x:  10,          z: -HD + D_NS / 2 },
  { zoneId: 'sou', x: -10,          z:  HD - D_NS / 2 },
  { zoneId: 'sou', x:  10,          z:  HD - D_NS / 2 },
  { zoneId: 'eas', x:  HW - D_EW/2, z: -5             },
  { zoneId: 'eas', x:  HW - D_EW/2, z:  5             },
  { zoneId: 'wes', x: -HW + D_EW/2, z: -5             },
  { zoneId: 'wes', x: -HW + D_EW/2, z:  5             },
  { zoneId: 'cor', x: -8,           z: -5             },
  { zoneId: 'cor', x:  8,           z: -5             },
  { zoneId: 'cor', x: -8,           z:  5             },
  { zoneId: 'cor', x:  8,           z:  5             },
]

const TEMP_COLD = new THREE.Color('#1a70c8')
const TEMP_WARM = new THREE.Color('#f08020')
const TEMP_HOT  = new THREE.Color('#e02010')

function tempToColor(tempC: number): THREE.Color {
  const t = Math.max(18, Math.min(34, tempC))
  const c = new THREE.Color()
  if (t <= 26) {
    c.lerpColors(TEMP_COLD, TEMP_WARM, (t - 18) / 8)
  } else {
    c.lerpColors(TEMP_WARM, TEMP_HOT, (t - 26) / 8)
  }
  return c
}

export function useFloorPlan(
  canvasRef: React.RefObject<HTMLCanvasElement | null>,
  active: boolean,
): void {
  const { liveData } = useDigitalTwinData()
  const activeFloor  = useDashboardStore((s) => s.selectedFloor)

  const dataRef       = useRef(liveData)
  const activeRef     = useRef(active)
  const floorRef      = useRef(activeFloor)

  useEffect(() => { dataRef.current   = liveData    }, [liveData])
  useEffect(() => { activeRef.current = active      }, [active])
  useEffect(() => { floorRef.current  = activeFloor }, [activeFloor])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(devicePixelRatio, 2))

    const scene  = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(44, 1, 0.5, 200)

    const ambient = new THREE.AmbientLight(0x304060, 1.8)
    scene.add(ambient)

    // planGroup holds all floor-plan geometry, Y-shifted per active floor
    const planGroup = new THREE.Group()
    scene.add(planGroup)

    // Zone meshes
    const zoneMeshes = new Map<ZoneState['id'], THREE.Mesh>()
    const baseDark   = new THREE.Color(0x081828)

    const zids: ZoneState['id'][] = ['nor', 'sou', 'eas', 'wes', 'cor']
    for (const id of zids) {
      const g  = ZONE_GEOM[id]
      const geo = new THREE.BoxGeometry(g.w - 0.12, 0.2, g.d - 0.12)
      const mat = new THREE.MeshPhongMaterial({ color: 0x081828 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(g.cx, 0.1, g.cz)
      mesh.userData['zid'] = id
      planGroup.add(mesh)
      zoneMeshes.set(id, mesh)

      // Zone boundary edges
      const edgeG  = new THREE.EdgesGeometry(new THREE.BoxGeometry(g.w, 0.22, g.d))
      const edgeMat = new THREE.LineBasicMaterial({ color: 0x1e3858 })
      const edges   = new THREE.LineSegments(edgeG, edgeMat)
      edges.position.set(g.cx, 0.11, g.cz)
      planGroup.add(edges)
    }

    // Diffuser dots
    for (const d of DIFFUSERS) {
      const geo  = new THREE.CylinderGeometry(0.22, 0.22, 0.08, 8)
      const mat  = new THREE.MeshPhongMaterial({ color: 0x2a6090 })
      const mesh = new THREE.Mesh(geo, mat)
      mesh.position.set(d.x, 0.25, d.z)
      planGroup.add(mesh)
    }

    // Cardinal tick lines (scaled for larger building)
    const tickMat = new THREE.LineBasicMaterial({ color: 0x1e3858 })
    const cardinals = [
      { from: new THREE.Vector3(0, 0.3, -HD - 1.0), to: new THREE.Vector3(0, 0.3, -HD - 3.0) },
      { from: new THREE.Vector3(0, 0.3,  HD + 1.0), to: new THREE.Vector3(0, 0.3,  HD + 3.0) },
      { from: new THREE.Vector3(-HW - 1.0, 0.3, 0), to: new THREE.Vector3(-HW - 3.0, 0.3, 0) },
      { from: new THREE.Vector3( HW + 1.0, 0.3, 0), to: new THREE.Vector3( HW + 3.0, 0.3, 0) },
    ]
    for (const tick of cardinals) {
      const geo = new THREE.BufferGeometry().setFromPoints([tick.from, tick.to])
      planGroup.add(new THREE.LineSegments(geo, tickMat))
    }

    // Solar arrow (scaled for larger building)
    const solarArrow = new THREE.ArrowHelper(
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(0, 0.5, 0),
      18, 0xffd060, 3.0, 1.5,
    )
    planGroup.add(solarArrow)

    // Wind arrow
    const windArrow = new THREE.ArrowHelper(
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0.5, 0),
      10, 0x44aacc, 2.4, 1.2,
    )
    planGroup.add(windArrow)

    // ResizeObserver
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

    let rafId = 0
    let t = 0
    const tc = new THREE.Color()

    function animate(): void {
      rafId = requestAnimationFrame(animate)

      if (!activeRef.current) return   // skip render when view is hidden

      t += 0.002
      const data  = dataRef.current
      const floor = floorRef.current

      // Update planGroup Y
      planGroup.position.y = floor * FH

      // Zone colours
      for (const id of zids) {
        const mesh = zoneMeshes.get(id)
        if (!mesh) continue
        const zone = data.zones[id]
        const tCol = tempToColor(zone?.temperature ?? 23)
        tc.copy(baseDark).lerp(tCol, 0.6)
        ;(mesh.material as THREE.MeshPhongMaterial).color.copy(tc)
      }

      // Solar arrow direction (horizontal projection)
      const el  = data.solar.elevation
      const az  = data.solar.azimuth
      const sx  = Math.sin(az)
      const sz  = Math.cos(az)
      const norm = Math.sqrt(sx * sx + sz * sz) || 1
      solarArrow.setDirection(new THREE.Vector3(-sx / norm, 0, -sz / norm))
      const irr = data.solar.irradiance
      solarArrow.setLength(8 + irr / 100, 3.0, 1.5)
      // Only show when sun is up
      solarArrow.visible = el > 0.02

      // Wind arrow direction
      const wd   = data.weather.windDirection
      const ws   = data.weather.windSpeed
      const wLen = Math.max(1.5, ws * 0.8)
      const wx   = Math.sin(wd)
      const wz   = Math.cos(wd)
      windArrow.setDirection(new THREE.Vector3(wx, 0, wz))
      windArrow.setLength(wLen, Math.min(1.2, wLen * 0.3), Math.min(0.6, wLen * 0.15))

      // Camera gentle drift — height calibrated for 50 × 33 m footprint
      camera.position.set(
        Math.sin(t) * 1.2,
        floor * FH + 80,
        Math.cos(t) * 1.2,
      )
      camera.lookAt(0, floor * FH, 0)

      renderer.render(scene, camera)
    }

    animate()

    return () => {
      cancelAnimationFrame(rafId)
      ro.disconnect()
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh) {
          obj.geometry.dispose()
          ;(obj.material as THREE.Material).dispose()
        }
      })
      renderer.dispose()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canvasRef])
}
