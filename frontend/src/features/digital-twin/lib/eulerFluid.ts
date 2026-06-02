// ─── CPU Eulerian fluid (incompressible) ─────────────────────────────────────
// Port of Matthias Müller's "Ten Minute Physics" Euler fluid (MIT) to TypeScript,
// adapted to drive the digital-twin CFD: a 2D top-down grid of the active floor
// where interior walls are solid cells and diffusers are cold-air inlets, so the
// supply air advects through doorways from zone to zone. Trade-off: 2D plan field
// (CPU), not full 3D volumetric — believable horizontal inter-zone propagation.

import {
  BW, BD, HW, HD, D_MID, ZONE_IDS, ZONE_GEOM, isSolidAt, type ZoneId,
} from './buildingLayout'

const U_FIELD = 0
const V_FIELD = 1
const S_FIELD = 2

class Fluid {
  numX: number
  numY: number
  numCells: number
  h: number
  density: number
  u: Float32Array
  v: Float32Array
  newU: Float32Array
  newV: Float32Array
  p: Float32Array
  s: Float32Array
  m: Float32Array
  newM: Float32Array

  constructor(density: number, numX: number, numY: number, h: number) {
    this.density = density
    this.numX = numX + 2
    this.numY = numY + 2
    this.numCells = this.numX * this.numY
    this.h = h
    this.u = new Float32Array(this.numCells)
    this.v = new Float32Array(this.numCells)
    this.newU = new Float32Array(this.numCells)
    this.newV = new Float32Array(this.numCells)
    this.p = new Float32Array(this.numCells)
    this.s = new Float32Array(this.numCells)
    this.m = new Float32Array(this.numCells)
    this.newM = new Float32Array(this.numCells)
    this.m.fill(1.0)
  }

  solveIncompressibility(numIters: number, dt: number, overRelaxation: number): void {
    const n = this.numY
    const cp = this.density * this.h / dt
    for (let iter = 0; iter < numIters; iter++) {
      for (let i = 1; i < this.numX - 1; i++) {
        for (let j = 1; j < this.numY - 1; j++) {
          if (this.s[i * n + j] === 0.0) continue
          const sx0 = this.s[(i - 1) * n + j]!
          const sx1 = this.s[(i + 1) * n + j]!
          const sy0 = this.s[i * n + j - 1]!
          const sy1 = this.s[i * n + j + 1]!
          const s = sx0 + sx1 + sy0 + sy1
          if (s === 0.0) continue
          const div = this.u[(i + 1) * n + j]! - this.u[i * n + j]! +
                      this.v[i * n + j + 1]! - this.v[i * n + j]!
          let p = -div / s
          p *= overRelaxation
          this.p[i * n + j]! += cp * p
          this.u[i * n + j]! -= sx0 * p
          this.u[(i + 1) * n + j]! += sx1 * p
          this.v[i * n + j]! -= sy0 * p
          this.v[i * n + j + 1]! += sy1 * p
        }
      }
    }
  }

  extrapolate(): void {
    const n = this.numY
    for (let i = 0; i < this.numX; i++) {
      this.u[i * n + 0] = this.u[i * n + 1]!
      this.u[i * n + this.numY - 1] = this.u[i * n + this.numY - 2]!
    }
    for (let j = 0; j < this.numY; j++) {
      this.v[0 * n + j] = this.v[1 * n + j]!
      this.v[(this.numX - 1) * n + j] = this.v[(this.numX - 2) * n + j]!
    }
  }

  sampleField(x: number, y: number, field: number): number {
    const n = this.numY
    const h = this.h
    const h1 = 1.0 / h
    const h2 = 0.5 * h
    x = Math.max(Math.min(x, this.numX * h), h)
    y = Math.max(Math.min(y, this.numY * h), h)
    let dx = 0.0
    let dy = 0.0
    let f = this.m
    if (field === U_FIELD) { f = this.u; dy = h2 }
    else if (field === V_FIELD) { f = this.v; dx = h2 }
    else { f = this.m; dx = h2; dy = h2 }

    const x0 = Math.min(Math.floor((x - dx) * h1), this.numX - 1)
    const tx = ((x - dx) - x0 * h) * h1
    const x1 = Math.min(x0 + 1, this.numX - 1)
    const y0 = Math.min(Math.floor((y - dy) * h1), this.numY - 1)
    const ty = ((y - dy) - y0 * h) * h1
    const y1 = Math.min(y0 + 1, this.numY - 1)
    const sx = 1.0 - tx
    const sy = 1.0 - ty
    return sx * sy * f[x0 * n + y0]! + tx * sy * f[x1 * n + y0]! +
           tx * ty * f[x1 * n + y1]! + sx * ty * f[x0 * n + y1]!
  }

  avgU(i: number, j: number): number {
    const n = this.numY
    return (this.u[i * n + j - 1]! + this.u[i * n + j]! +
            this.u[(i + 1) * n + j - 1]! + this.u[(i + 1) * n + j]!) * 0.25
  }
  avgV(i: number, j: number): number {
    const n = this.numY
    return (this.v[(i - 1) * n + j]! + this.v[i * n + j]! +
            this.v[(i - 1) * n + j + 1]! + this.v[i * n + j + 1]!) * 0.25
  }

  advectVel(dt: number): void {
    this.newU.set(this.u)
    this.newV.set(this.v)
    const n = this.numY
    const h = this.h
    const h2 = 0.5 * h
    for (let i = 1; i < this.numX; i++) {
      for (let j = 1; j < this.numY; j++) {
        if (this.s[i * n + j] !== 0.0 && this.s[(i - 1) * n + j] !== 0.0 && j < this.numY - 1) {
          let x = i * h
          let y = j * h + h2
          let u = this.u[i * n + j]!
          const v = this.avgV(i, j)
          x = x - dt * u
          y = y - dt * v
          u = this.sampleField(x, y, U_FIELD)
          this.newU[i * n + j] = u
        }
        if (this.s[i * n + j] !== 0.0 && this.s[i * n + j - 1] !== 0.0 && i < this.numX - 1) {
          let x = i * h + h2
          let y = j * h
          const u = this.avgU(i, j)
          let v = this.v[i * n + j]!
          x = x - dt * u
          y = y - dt * v
          v = this.sampleField(x, y, V_FIELD)
          this.newV[i * n + j] = v
        }
      }
    }
    this.u.set(this.newU)
    this.v.set(this.newV)
  }

  advectSmoke(dt: number): void {
    this.newM.set(this.m)
    const n = this.numY
    const h = this.h
    const h2 = 0.5 * h
    for (let i = 1; i < this.numX - 1; i++) {
      for (let j = 1; j < this.numY - 1; j++) {
        if (this.s[i * n + j] !== 0.0) {
          const u = (this.u[i * n + j]! + this.u[(i + 1) * n + j]!) * 0.5
          const v = (this.v[i * n + j]! + this.v[i * n + j + 1]!) * 0.5
          const x = i * h + h2 - dt * u
          const y = j * h + h2 - dt * v
          this.newM[i * n + j] = this.sampleField(x, y, S_FIELD)
        }
      }
    }
    this.m.set(this.newM)
  }

  simulate(dt: number, numIters: number, overRelaxation: number): void {
    this.p.fill(0.0)
    this.solveIncompressibility(numIters, dt, overRelaxation)
    this.extrapolate()
    this.advectVel(dt)
    this.advectSmoke(dt)
  }
}

// ─── Floor-level wrapper: grid from the building layout + diffuser inlets ─────

interface Inlet { x: number; z: number; dx: number; dz: number }

const INLET_V = 5.5   // supply-air jet speed (m/s) — gentle so the room fills, not a thin jet
const MID = D_MID / 2

// Per-zone diffuser: position (world) + jet direction toward the zone's doorway.
const INLETS: Record<ZoneId, Inlet> = {
  nor: { x: 0,         z: -HD + 2.2, dx: 0,  dz:  1 },
  sou: { x: 0,         z:  HD - 2.2, dx: 0,  dz: -1 },
  wes: { x: -HW + 2.2, z: 0,         dx: 1,  dz:  0 },
  eas: { x:  HW - 2.2, z: 0,         dx: -1, dz:  0 },
  cor: { x: 0,         z: -MID + 2,  dx: 0,  dz:  1 },
}

export class FloorFluid {
  readonly fluid: Fluid
  readonly numX: number   // interior cells (without the +2 border)
  readonly numY: number
  readonly h: number
  private active = new Set<ZoneId>()

  constructor(targetCell = 0.55) {
    const nx = Math.floor(BW / targetCell)
    const ny = Math.floor(BD / targetCell)
    this.h = BW / nx
    this.numX = nx
    this.numY = ny
    this.fluid = new Fluid(1000, nx, ny, this.h)
    this.buildObstacles()
  }

  /** World (x,z) → grid cell (i,j) including the +1 border offset. */
  private cell(x: number, z: number): [number, number] {
    const i = Math.round((x + HW) / this.h) + 1
    const j = Math.round((z + HD) / this.h) + 1
    return [i, j]
  }

  private buildObstacles(): void {
    const f = this.fluid
    const n = f.numY
    for (let i = 0; i < f.numX; i++) {
      for (let j = 0; j < f.numY; j++) {
        // border = solid (building envelope)
        let solid = i === 0 || i === f.numX - 1 || j === 0 || j === f.numY - 1
        if (!solid) {
          const wx = (i - 1) * this.h - HW + this.h * 0.5
          const wz = (j - 1) * this.h - HD + this.h * 0.5
          solid = isSolidAt(wx, wz)
        }
        f.s[i * n + j] = solid ? 0.0 : 1.0
      }
    }
  }

  reset(): void {
    const f = this.fluid
    f.u.fill(0); f.v.fill(0); f.p.fill(0); f.m.fill(1.0)
    this.active.clear()
  }

  setInlet(zone: ZoneId, on: boolean): void {
    if (on) this.active.add(zone); else this.active.delete(zone)
  }

  private applyInlets(): void {
    const f = this.fluid
    const n = f.numY
    const r = 5   // inlet patch radius in cells — seeds a visible cold pool per diffuser
    for (const z of this.active) {
      const inl = INLETS[z]
      const [ci, cj] = this.cell(inl.x, inl.z)
      for (let i = ci - r; i <= ci + r; i++) {
        for (let j = cj - r; j <= cj + r; j++) {
          if (i < 1 || j < 1 || i >= f.numX - 1 || j >= f.numY - 1) continue
          if (f.s[i * n + j] === 0.0) continue
          f.m[i * n + j] = 0.0                       // cold supply air
          f.u[i * n + j] = inl.dx * INLET_V
          f.u[(i + 1) * n + j] = inl.dx * INLET_V
          f.v[i * n + j] = inl.dz * INLET_V
          f.v[i * n + j + 1] = inl.dz * INLET_V
        }
      }
    }
  }

  step(dt: number, numIters = 30, overRelaxation = 1.9): void {
    this.applyInlets()
    this.fluid.simulate(dt, numIters, overRelaxation)
  }

  /** Average "coolness" (0 warm room … 1 cold supply) over a zone's fluid cells —
   *  used to tint the zone volume so the room visibly fills with cold air. */
  zoneCoolness(zone: ZoneId): number {
    const f = this.fluid
    const n = f.numY
    const g = ZONE_GEOM[zone]
    const i0 = Math.max(1, Math.round((g.cx - g.w / 2 + HW) / this.h) + 1)
    const i1 = Math.min(f.numX - 2, Math.round((g.cx + g.w / 2 + HW) / this.h) + 1)
    const j0 = Math.max(1, Math.round((g.cz - g.d / 2 + HD) / this.h) + 1)
    const j1 = Math.min(f.numY - 2, Math.round((g.cz + g.d / 2 + HD) / this.h) + 1)
    let sum = 0, cnt = 0
    for (let i = i0; i <= i1; i++) {
      for (let j = j0; j <= j1; j++) {
        if (f.s[i * n + j] === 0.0) continue
        sum += 1 - f.m[i * n + j]!
        cnt++
      }
    }
    return cnt > 0 ? sum / cnt : 0
  }

  /**
   * Write the temperature field into an RGBA byte buffer (numX*numY) for a
   * DataTexture. Cold supply air (m→0) = blue & opaque; warm room (m→1) = amber &
   * transparent so the furnished room shows through; wall cells = transparent.
   */
  writeRGBA(out: Uint8Array): void {
    const f = this.fluid
    const n = f.numY
    let k = 0
    for (let j = 1; j <= this.numY; j++) {
      for (let i = 1; i <= this.numX; i++) {
        const idx = i * n + j
        if (f.s[idx] === 0.0) { out[k] = 0; out[k + 1] = 0; out[k + 2] = 0; out[k + 3] = 0; k += 4; continue }
        const m = f.m[idx]!                  // 1 warm room → 0 cold supply
        const cool = 1 - m
        // color: blue (cold) → amber (warm)
        out[k]     = Math.round(40 + m * 215)
        out[k + 1] = Math.round(120 + m * 40)
        out[k + 2] = Math.round(255 - m * 195)
        // whole-floor field visible (faint warm baseline), cold plume strongest
        out[k + 3] = Math.round(Math.max(0, Math.min(1, 0.12 + cool * 0.92)) * 255)
        k += 4
      }
    }
  }
}

export { ZONE_IDS }
