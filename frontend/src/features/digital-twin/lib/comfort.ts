// ─── Thermal comfort — Fanger PMV (ISO 7730) ─────────────────────────────────
// Predicted Mean Vote: −3 cold … 0 neutral … +3 hot. The comfort band is
// roughly −0.5..+0.5. Standard algorithm (fixed-point iteration for the clothing
// surface temperature), adapted with sensible HVAC defaults.

export type ComfortCategory = 'Cold' | 'Cool' | 'Comfort' | 'Warm' | 'Hot'

export interface ComfortResult {
  pmv: number
  category: ComfortCategory
  color: string          // category colour (CSS), for labels/metrics
}

/**
 * @param ta  air temperature (°C)
 * @param tr  mean radiant temperature (°C) — defaults to ta
 * @param vel relative air velocity (m/s)
 * @param rh  relative humidity (%)
 * @param met metabolic rate (met) — 1.1 ≈ seated/light office
 * @param clo clothing insulation (clo) — 0.6 ≈ light indoor clothing
 */
export function computePMV(
  ta: number,
  rh: number,
  vel = 0.12,
  tr = ta,
  met = 1.1,
  clo = 0.6,
): number {
  const pa = rh * 10 * Math.exp(16.6536 - 4030.183 / (ta + 235))
  const icl = 0.155 * clo
  const m = met * 58.15
  const w = 0
  const mw = m - w
  const fcl = icl <= 0.078 ? 1 + 1.29 * icl : 1.05 + 0.645 * icl
  const hcf = 12.1 * Math.sqrt(Math.max(0, vel))
  const taa = ta + 273
  const tra = tr + 273
  const tcla = taa + (35.5 - ta) / (3.5 * icl + 0.1)

  const p1 = icl * fcl
  const p2 = p1 * 3.96
  const p3 = p1 * 100
  const p4 = p1 * taa
  const p5 = 308.7 - 0.028 * mw + p2 * Math.pow(tra / 100, 4)

  let xn = tcla / 100
  let xf = xn
  let hc = hcf
  for (let n = 0; n < 150; n++) {
    xf = (xf + xn) / 2
    const hcn = 2.38 * Math.pow(Math.abs(100 * xf - taa), 0.25)
    hc = hcf > hcn ? hcf : hcn
    const next = (p5 + p4 * hc - p2 * Math.pow(xf, 4)) / (100 + p3 * hc)
    if (Math.abs(next - xn) < 1e-5) { xn = next; break }
    xn = next
  }
  const tcl = 100 * xn - 273

  const hl1 = 3.05 * 0.001 * (5733 - 6.99 * mw - pa)
  const hl2 = mw > 58.15 ? 0.42 * (mw - 58.15) : 0
  const hl3 = 1.7 * 0.00001 * m * (5867 - pa)
  const hl4 = 0.0014 * m * (34 - ta)
  const hl5 = 3.96 * fcl * (Math.pow(xn, 4) - Math.pow(tra / 100, 4))
  const hl6 = fcl * hc * (tcl - ta)

  const ts = 0.303 * Math.exp(-0.036 * m) + 0.028
  const pmv = ts * (mw - hl1 - hl2 - hl3 - hl4 - hl5 - hl6)
  return Math.max(-3, Math.min(3, pmv))
}

export function pmvCategory(pmv: number): ComfortCategory {
  if (pmv <= -1.5) return 'Cold'
  if (pmv <= -0.5) return 'Cool'
  if (pmv <   0.5) return 'Comfort'
  if (pmv <   1.5) return 'Warm'
  return 'Hot'
}

const CAT_COLOR: Record<ComfortCategory, string> = {
  Cold:    '#4c8bff',
  Cool:    '#37b6c6',
  Comfort: '#37c98a',
  Warm:    '#f0a030',
  Hot:     '#ef4d4d',
}

export function comfort(ta: number, rh: number, vel = 0.12): ComfortResult {
  const pmv = computePMV(ta, rh, vel)
  const category = pmvCategory(pmv)
  return { pmv, category, color: CAT_COLOR[category] }
}
