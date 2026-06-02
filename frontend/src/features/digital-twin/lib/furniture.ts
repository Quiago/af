import * as THREE from 'three'
import { ZONE_GEOM, D_CW, HD, D_NS } from './buildingLayout'

// ─── Procedural low-poly furniture ───────────────────────────────────────────
// Builds a furnished floor (open office in the core, guestroom beds in the
// N/S strips, lounge seating on the E/W sides, plus plants) using simple boxes
// with shared geometries/materials. Returns a THREE.Group positioned in world
// space at the given floor base Y; geometries are disposed by the scene's
// building.traverse() cleanup since the group is parented under the building.

const FLOOR_Y = 0.13   // furniture sits just above the slab top

export function buildFurniture(yBase: number): THREE.Group {
  const g = new THREE.Group()
  g.userData['furniture'] = true

  // ── Shared materials (low-poly, design-system tones) ──────────────────────
  const matDeskTop = new THREE.MeshStandardMaterial({ color: 0xb9a682, roughness: 0.75 })
  const matLeg     = new THREE.MeshStandardMaterial({ color: 0x4a525c, roughness: 0.6, metalness: 0.3 })
  const matChair   = new THREE.MeshStandardMaterial({ color: 0x3b4654, roughness: 0.7 })
  const matSofa    = new THREE.MeshStandardMaterial({ color: 0x5d6b7d, roughness: 0.85 })
  const matBed     = new THREE.MeshStandardMaterial({ color: 0xe7e0d2, roughness: 0.9 })
  const matWood    = new THREE.MeshStandardMaterial({ color: 0x8a6d52, roughness: 0.8 })
  const matRug     = new THREE.MeshStandardMaterial({ color: 0x6f7e8c, roughness: 0.95 })
  const matPot     = new THREE.MeshStandardMaterial({ color: 0x6b5340, roughness: 0.8 })
  const matPlant   = new THREE.MeshStandardMaterial({ color: 0x3f7d4f, roughness: 0.95 })

  // ── Shared geometries ─────────────────────────────────────────────────────
  const geoDeskTop = new THREE.BoxGeometry(1.5, 0.06, 0.8)
  const geoLeg     = new THREE.BoxGeometry(0.06, 0.72, 0.06)
  const geoChairS  = new THREE.BoxGeometry(0.5, 0.08, 0.5)   // seat
  const geoChairB  = new THREE.BoxGeometry(0.5, 0.5, 0.06)   // back
  const geoBed     = new THREE.BoxGeometry(2.0, 0.45, 1.5)
  const geoHead    = new THREE.BoxGeometry(2.0, 0.6, 0.12)
  const geoNight   = new THREE.BoxGeometry(0.5, 0.45, 0.5)
  const geoSofaB   = new THREE.BoxGeometry(2.2, 0.45, 0.9)   // sofa base
  const geoSofaK   = new THREE.BoxGeometry(2.2, 0.4, 0.25)   // sofa back
  const geoTable   = new THREE.BoxGeometry(1.1, 0.35, 0.6)
  const geoRug     = new THREE.BoxGeometry(2.6, 0.02, 1.8)
  const geoPot     = new THREE.CylinderGeometry(0.22, 0.28, 0.42, 10)
  const geoPlant   = new THREE.IcosahedronGeometry(0.5, 0)

  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, ry = 0): void => {
    const m = new THREE.Mesh(geo, mat)
    m.position.set(x, yBase + FLOOR_Y + y, z)
    m.rotation.y = ry
    g.add(m)
  }

  const desk = (x: number, z: number, ry = 0): void => {
    add(geoDeskTop, matDeskTop, x, 0.72, z, ry)
    for (const [lx, lz] of [[-0.7, -0.36], [0.7, -0.36], [-0.7, 0.36], [0.7, 0.36]] as [number, number][]) {
      const dx = Math.cos(ry) * lx - Math.sin(ry) * lz
      const dz = Math.sin(ry) * lx + Math.cos(ry) * lz
      add(geoLeg, matLeg, x + dx, 0.36, z + dz, ry)
    }
    // chair behind the desk
    const cz = z + (ry === 0 ? 0.7 : 0)
    add(geoChairS, matChair, x, 0.45, cz, ry)
    add(geoChairB, matChair, x, 0.7, cz + 0.22, ry)
  }

  const plant = (x: number, z: number): void => {
    add(geoPot, matPot, x, 0.21, z)
    add(geoPlant, matPlant, x, 0.62, z)
  }

  const bed = (x: number, z: number, ry: number): void => {
    add(geoRug, matRug, x, 0.011, z)
    add(geoBed, matBed, x, 0.22, z, ry)
    // headboard offset toward the exterior wall
    const hz = z + (Math.sign(z) || 1) * 0 // placed by caller orientation
    add(geoHead, matWood, x, 0.42, hz + (ry === 0 ? -0.81 : 0), ry)
    add(geoNight, matWood, x + 1.2, 0.22, z, ry)
  }

  const lounge = (x: number, z: number, ry: number): void => {
    add(geoRug, matRug, x, 0.011, z, ry)
    add(geoSofaB, matSofa, x, 0.22, z, ry)
    add(geoSofaK, matSofa, x, 0.55, z - 0.32, ry)
    add(geoTable, matWood, x, 0.17, z + 0.9, ry)
  }

  // ── Core: open-office desk grid ───────────────────────────────────────────
  {
    const g0 = ZONE_GEOM.cor
    const cols = 6, rows = 3
    const mx = D_CW / 2 - 4
    const mz = g0.d / 2 - 3.5
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        const x = -mx + (2 * mx) * (c / (cols - 1))
        const z = -mz + (2 * mz) * (r / (rows - 1))
        desk(x, z, 0)
      }
    }
    plant(-D_CW / 2 + 2, -g0.d / 2 + 2)
    plant( D_CW / 2 - 2,  g0.d / 2 - 2)
  }

  // ── North / South strips: guestroom beds against the exterior wall ────────
  for (const zid of ['nor', 'sou'] as const) {
    const z0 = zid === 'nor' ? -HD + D_NS / 2 : HD - D_NS / 2
    for (let i = 0; i < 5; i++) {
      const x = -18 + i * 9
      bed(x, z0, 0)
    }
  }

  // ── East / West sides: lounge sets along the depth ────────────────────────
  for (const zid of ['eas', 'wes'] as const) {
    const g0 = ZONE_GEOM[zid]
    const ry = zid === 'eas' ? -Math.PI / 2 : Math.PI / 2
    for (let i = -1; i <= 1; i++) {
      lounge(g0.cx, i * 8, ry)
    }
    plant(g0.cx, g0.d / 2 - 1.5)
  }

  return g
}
