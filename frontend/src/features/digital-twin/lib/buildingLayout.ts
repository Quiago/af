// ─── DOE multizone_office_simple_air — shared building layout ────────────────
// Single source of truth for dimensions, zone footprints and the interior wall
// layout (with door openings). Consumed by both the 3D geometry (walls/furniture)
// and the CPU fluid grid (wall = solid cells, door gaps = fluid → air flows
// between zones). Coordinate frame: +X = East, −X = West, +Z = South, −Z = North.

import type { ZoneState } from '../types/digitalTwin.types'

export type ZoneId = ZoneState['id']

export const BW = 50      // building width  East–West   (m)
export const BD = 33.25   // building depth  North–South  (m)
export const FH = 2.74    // floor height                 (m)
export const NF = 3       // number of floors
export const HW = BW / 2
export const HD = BD / 2

// Perimeter strip depth / middle-band split (from the DOE reference areas)
export const D_NS  = 207.58 / BW            // north & south strip depth
export const D_MID = BD - 2 * D_NS          // middle band depth
export const D_EW  = 131.416 / D_MID        // east & west zone width
export const D_CW  = BW - 2 * D_EW          // core width

export const ZONE_IDS: ZoneId[] = ['nor', 'sou', 'eas', 'wes', 'cor']

export const ZONE_NAMES: Record<ZoneId, string> = {
  nor: 'NORTH', sou: 'SOUTH', eas: 'EAST', wes: 'WEST', cor: 'CORE',
}

export interface ZoneGeom { w: number; d: number; cx: number; cz: number }

export const ZONE_GEOM: Record<ZoneId, ZoneGeom> = {
  nor: { w: BW,   d: D_NS,  cx: 0,            cz: -HD + D_NS / 2 },
  sou: { w: BW,   d: D_NS,  cx: 0,            cz:  HD - D_NS / 2 },
  eas: { w: D_EW, d: D_MID, cx:  HW - D_EW/2, cz: 0             },
  wes: { w: D_EW, d: D_MID, cx: -HW + D_EW/2, cz: 0             },
  cor: { w: D_CW, d: D_MID, cx: 0,            cz: 0             },
}

// ─── Interior wall layout (with centered door openings) ──────────────────────
export const WALL_T = 0.20   // wall thickness (m)
export const DOOR_W = 2.4    // door opening width (m)

const MID = D_MID / 2        // |z| of the nor/sou ↔ middle-band walls
const COR = D_CW / 2         // |x| of the wes/cor and cor/eas walls

/** A solid wall sub-segment (the wall minus its door gap). */
export interface WallSeg {
  orient: 'h' | 'v'   // 'h' = runs along X at fixed Z; 'v' = runs along Z at fixed X
  at:     number      // fixed Z (h) or fixed X (v)
  from:   number      // start along the run axis
  to:     number      // end along the run axis
}

/** Split a full wall run [a,b] at a centered door of width DOOR_W into solids. */
function withDoor(orient: 'h' | 'v', at: number, a: number, b: number, doorAt = 0): WallSeg[] {
  const d0 = doorAt - DOOR_W / 2
  const d1 = doorAt + DOOR_W / 2
  const segs: WallSeg[] = []
  if (d0 > a) segs.push({ orient, at, from: a, to: d0 })
  if (b > d1) segs.push({ orient, at, from: d1, to: b })
  return segs
}

// nor ↔ middle band (full width, door at x=0); sou ↔ middle band;
// wes ↔ cor (middle-band height, door at z=0); cor ↔ eas.
export const WALL_SEGMENTS: WallSeg[] = [
  ...withDoor('h', -MID, -HW, HW),
  ...withDoor('h',  MID, -HW, HW),
  ...withDoor('v', -COR, -MID, MID),
  ...withDoor('v',  COR, -MID, MID),
]

/** True if (x,z) lies inside a solid interior wall (within half thickness). */
export function isSolidAt(x: number, z: number): boolean {
  const t = WALL_T / 2
  for (const s of WALL_SEGMENTS) {
    if (s.orient === 'h') {
      if (Math.abs(z - s.at) <= t && x >= s.from - t && x <= s.to + t) return true
    } else {
      if (Math.abs(x - s.at) <= t && z >= s.from - t && z <= s.to + t) return true
    }
  }
  return false
}
