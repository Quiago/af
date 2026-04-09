import { useState, useMemo } from 'react'
import { useDashboardStore } from '../../store/dashboardStore'
import { useEquipmentData } from '../maintenance/hooks/useEquipmentData'
import { useHeatmapData } from './hooks/useHeatmapData'
import { useReportHistory } from './useReportHistory'
import { useBenchmarkData } from './hooks/useBenchmarkData'
import { ComparisonChart } from './components/ComparisonChart/ComparisonChart'
import { AnomalyFeed } from './components/AnomalyFeed/AnomalyFeed'
import type { Anomaly } from './components/AnomalyFeed/AnomalyFeed'
import { BoardReport } from './components/BoardReport/BoardReport'
import type { BoardReportData } from './components/BoardReport/BoardReport'
import {
  IS_MOCKED,
  MOCK_EQUIPMENT,
  MOCK_ZONES,
  MOCK_KPIS,
  MOCK_SAVINGS,
  getMockZonePerformance,
} from './mockData'
import type { ZonePerformanceRow } from './mockData'
import type { ZoneData } from '../../types/building.types'
import './BuildingReportView.css'

// ─── Utilities ────────────────────────────────────────────────────────────────

function downloadCSV(filename: string, headers: string[], rows: (string | number | boolean | null | undefined)[][]) {
  const esc = (v: string | number | boolean | null | undefined) =>
    `"${String(v ?? '').replace(/"/g, '""')}"`
  const content = [headers.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

type SortDir = 'asc' | 'desc'

function useSort<T>(initial: keyof T) {
  const [key, setKey] = useState<keyof T>(initial)
  const [dir, setDir] = useState<SortDir>('desc')

  function toggle(newKey: keyof T) {
    if (newKey === key) setDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    else { setKey(newKey); setDir('desc') }
  }

  function sortFn(a: T, b: T): number {
    const av = a[key], bv = b[key]
    if (av == null) return 1
    if (bv == null) return -1
    const cmp = av < bv ? -1 : av > bv ? 1 : 0
    return dir === 'asc' ? cmp : -cmp
  }

  return { key, dir, toggle, sortFn }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SortTh<T>({
  col, label, sort, onToggle,
}: {
  col: keyof T; label: string; sort: { key: keyof T; dir: SortDir }; onToggle: (k: keyof T) => void
}) {
  const active = sort.key === col
  return (
    <th className={`th-sort ${active ? 'th-sort--active' : ''}`} onClick={() => onToggle(col)}>
      {label}
      <span className="th-arrow">{active ? (sort.dir === 'asc' ? ' ↑' : ' ↓') : ' ⇅'}</span>
    </th>
  )
}

function KpiCard({
  label, value, sub, accent, delta, deltaGood,
}: {
  label: string; value: string; sub?: string; accent?: boolean
  delta?: string; deltaGood?: boolean
}) {
  return (
    <div className={`rpt-kpi-card ${accent ? 'rpt-kpi-card--accent' : ''}`}>
      <div className="rpt-kpi-label">{label}</div>
      <div className="rpt-kpi-value">{value}</div>
      {sub && <div className="rpt-kpi-sub">{sub}</div>}
      {delta && (
        <div className={`rpt-kpi-delta ${deltaGood ? 'delta--good' : 'delta--bad'}`}>{delta}</div>
      )}
    </div>
  )
}

function InlineBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, Math.max(0, (value / max) * 100))
  return (
    <div className="ibar">
      <div className="ibar-track">
        <div className="ibar-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
    </div>
  )
}

// ─── Anomaly computation ──────────────────────────────────────────────────────

const SEVERITY_ORDER = { critical: 0, warning: 1, info: 2 }

function computeAnomalies(
  zones: ZoneData[],
  equipment: ReturnType<typeof useEquipmentData>,
  isPeak: boolean,
): Anomaly[] {
  const anomalies: Anomaly[] = []

  // Zone thermal anomalies
  for (const zone of zones) {
    const delta = zone.temperature - zone.setpoint
    const co2   = zone.co2 ?? 0

    if (delta > 2.0) {
      anomalies.push({
        id: `zone-hot-${zone.id}`,
        severity: 'critical',
        title: 'Zone Overheating',
        location: zone.id.toUpperCase(),
        aedPerDay: parseFloat((delta * 3.5 * 0.32).toFixed(1)),
        cause: `Temperature ${delta.toFixed(1)}°C above setpoint — chilled water supply may be inadequate`,
        action: 'Lower SAT by 1.5°C and increase VAV damper to 80%',
      })
    } else if (delta > 1.0) {
      anomalies.push({
        id: `zone-warm-${zone.id}`,
        severity: 'warning',
        title: 'Zone Running Warm',
        location: zone.id.toUpperCase(),
        aedPerDay: parseFloat((delta * 2.5 * 0.32).toFixed(1)),
        cause: `Temperature ${delta.toFixed(1)}°C above setpoint`,
        action: 'Increase cooling output by 1°C and monitor 30-min trend',
      })
    } else if (delta < -2.0) {
      anomalies.push({
        id: `zone-cold-${zone.id}`,
        severity: 'warning',
        title: 'Zone Overcooling',
        location: zone.id.toUpperCase(),
        aedPerDay: parseFloat((Math.abs(delta) * 2.0 * 0.32).toFixed(1)),
        cause: `Zone is ${Math.abs(delta).toFixed(1)}°C below setpoint — excess energy use`,
        action: 'Raise setpoint by 1°C or reduce VAV damper flow',
      })
    }

    if (co2 > 1000) {
      anomalies.push({
        id: `zone-co2-crit-${zone.id}`,
        severity: 'critical',
        title: 'Critical CO₂ Level',
        location: zone.id.toUpperCase(),
        aedPerDay: 8.5,
        cause: `CO₂ at ${co2} ppm — ventilation severely inadequate, occupant health at risk`,
        action: 'Open OA damper to minimum 30% and increase fresh air supply',
      })
    } else if (co2 > 800) {
      anomalies.push({
        id: `zone-co2-${zone.id}`,
        severity: 'warning',
        title: 'Elevated CO₂',
        location: zone.id.toUpperCase(),
        aedPerDay: 4.2,
        cause: `CO₂ at ${co2} ppm — ventilation needs adjustment for occupant density`,
        action: 'Increase fresh air volume by 15%',
      })
    }
  }

  // Equipment anomalies
  const eq = IS_MOCKED ? MOCK_EQUIPMENT : equipment
  for (const e of eq) {
    if (e.status === 'critical') {
      anomalies.push({
        id: `eq-critical-${e.id}`,
        severity: 'critical',
        title: `${e.name} — Critical Fault`,
        location: 'Mechanical Room',
        aedPerDay: parseFloat((0.18 * 120 * 0.32).toFixed(1)),
        cause: `Health score ${e.healthScore ?? 0}% — operating in degraded state with significant efficiency loss`,
        action: 'Schedule immediate inspection and maintenance',
      })
    } else if (e.status === 'warning') {
      anomalies.push({
        id: `eq-warning-${e.id}`,
        severity: 'warning',
        title: `${e.name} — Performance Degraded`,
        location: 'Mechanical Room',
        aedPerDay: parseFloat((0.07 * 120 * 0.32).toFixed(1)),
        cause: `Health score ${e.healthScore ?? 0}% — performance degradation detected`,
        action: 'Review maintenance logs and schedule service in next 7 days',
      })
    }
  }

  // Peak tariff info
  if (isPeak) {
    anomalies.push({
      id: 'tariff-peak',
      severity: 'info',
      title: 'Peak Tariff Window Active',
      location: 'All Floors',
      aedPerDay: 0,
      cause: 'Currently in DEWA summer peak period (12:00–18:00) — rate AED 0.38/kWh',
      action: 'Consider pre-cooling strategy and shift non-essential loads to off-peak',
    })
  }

  return anomalies.sort((a, b) => {
    const sv = SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]
    return sv !== 0 ? sv : b.aedPerDay - a.aedPerDay
  })
}

// ─── Main component ───────────────────────────────────────────────────────────

type ChartTab = 'comparison' | 'anomaly' | 'zone-performance'

export function BuildingReportView() {
  const timePreset    = useDashboardStore((s) => s.timePreset)
  const setTimePreset = useDashboardStore((s) => s.setTimePreset)
  const [activeChartTab, setActiveChartTab] = useState<ChartTab>('comparison')

  const snapshot  = useDashboardStore((s) => s.snapshot)
  const equipment = useEquipmentData()
  const heatmap   = useHeatmapData()
  const { data: historyData = [] } = useReportHistory(timePreset)
  const { data: benchmark } = useBenchmarkData()

  const benchmarkSavings = IS_MOCKED
    ? MOCK_SAVINGS
    : (benchmark?.status === 'completed' ? benchmark.savings : null)
  const benchmarkRunning = !IS_MOCKED && (
    benchmark?.status === 'running_baseline' || benchmark?.status === 'running_optimized'
  )

  const kpis  = snapshot?.kpis
  const zones: ZoneData[] = IS_MOCKED
    ? MOCK_ZONES as unknown as ZoneData[]
    : heatmap.flat().filter((z): z is NonNullable<typeof z> => z !== null)

  // ── Computed metrics ───────────────────────────────────────────────────────
  const chiller = IS_MOCKED ? null : equipment.find((e) => e.id === 'chiller-1')
  const ahu     = IS_MOCKED ? null : equipment.find((e) => e.id === 'ahu-1')

  const chillerPower_w = IS_MOCKED ? MOCK_KPIS.chiller_power_w : (chiller?.metrics['power_w'] ?? 0)
  const fanPower_w     = IS_MOCKED ? MOCK_KPIS.fan_power_w     : (ahu?.metrics['fan_power_w'] ?? 0)
  const totalPower_kW  = (chillerPower_w + fanPower_w) / 1000

  // ── Period-aware energy calculations ──────────────────────────────────────
  // totalPower_kW is instantaneous; multiply by period hours for cumulative KPIs
  const PERIOD_HOURS: Record<string, number> = { '1h': 1, '1d': 24, '1M': 24*30, '1y': 24*365 }
  const PERIOD_LABEL: Record<string, string>  = { '1h': '1 hour', '1d': '24 hours', '1M': '30 days', '1y': '12 months' }
  // Comfort complaints logged over the period (hotel-scale realistic counts)
  const PERIOD_COMPLAINTS: Record<string, number> = { '1h': 0, '1d': 2, '1M': 18, '1y': 142 }
  const periodHours = PERIOD_HOURS[timePreset] ?? 24
  const periodLabel = PERIOD_LABEL[timePreset]  ?? '24 hours'

  // Cumulative HVAC energy for the selected period (INAIA-optimised consumption)
  const periodEnergyKwh  = IS_MOCKED
    ? totalPower_kW * periodHours
    : ((kpis?.energy_kwh ?? 0) * periodHours)   // backend sends hourly kWh
  const periodBaselineKwh = periodEnergyKwh * (1 / (1 - 0.183)) // back-calculate unoptimised
  const savedKwh   = periodBaselineKwh - periodEnergyKwh
  const co2Factor  = 0.45
  const savedCO2_t = (savedKwh * co2Factor) / 1000
  const totalCO2_t = (periodEnergyKwh * co2Factor) / 1000
  const savedAed   = savedKwh * 0.32

  const comfortComplaints = IS_MOCKED
    ? (PERIOD_COMPLAINTS[timePreset] ?? 2)
    : Math.round((kpis?.thermal_discomfort ?? 0) * 2.5 * periodHours / 24)

  const now = new Date()
  const isSummer = (now.getMonth() + 1) >= 5 && (now.getMonth() + 1) <= 10
  const isPeak   = isSummer && now.getHours() >= 12 && now.getHours() < 18
  const currentDewaRate = isPeak ? 0.38 : 0.23
  const dewaRateStatus  = isPeak ? 'Peak Time' : 'Off-Peak'

  // Zone performance sort + data
  const zpSort = useSort<ZonePerformanceRow>('zone')
  const zonePerf = useMemo(
    () => IS_MOCKED ? getMockZonePerformance(timePreset) : [],
    [timePreset],
  )
  const sortedZonePerf = useMemo(
    () => [...zonePerf].sort(zpSort.sortFn),
    [zonePerf, zpSort.key, zpSort.dir],
  )

  // Anomalies
  const anomalies = useMemo(
    () => computeAnomalies(zones, equipment, isPeak),
    [zones, equipment, isPeak],
  )

  // Zones in comfort range (±0.5°C)
  const zonesInComfort = zones.filter((z) => Math.abs(z.temperature - z.setpoint) <= 0.5).length

  // Board report data
  const boardReportData: BoardReportData = {
    period: `${timePreset} period`,
    generatedAt: now.toLocaleString(),
    buildingName: 'BOPTEST — multizone_office_simple_air',
    totalPowerKw: totalPower_kW,
    energyKwh: periodEnergyKwh,
    savedKwh,
    savedPct: benchmarkSavings?.energy_pct ?? 18.3,
    savedAed,
    annualSavingsAed: benchmarkSavings?.cost_aed_annual ?? savedAed * 365,
    savedCO2_t,
    totalCO2_t,
    dewaScore: 92,
    estidamaTarget: 150,
    uaeCompliance: 'Compliant',
    comfortComplaints,
    zonesTotal: zones.length,
    zonesComfort: zonesInComfort,
    equipmentOnline: equipment.filter((e) => e.status !== 'offline').length,
    equipmentTotal: equipment.length,
    equipmentWarnings: equipment.filter((e) => e.status === 'warning').length,
    equipmentCritical: equipment.filter((e) => e.status === 'critical').length,
    totalAedWaste: anomalies.reduce((s, a) => s + a.aedPerDay, 0),
    anomalyCount: anomalies.length,
  }

  // ── Export functions ───────────────────────────────────────────────────────
  function exportZonesCSV() {
    downloadCSV(
      `zone-performance-${now.toISOString().slice(0, 10)}-${timePreset}.csv`,
      ['Zone', 'Floor', 'Energy (kWh)', 'Cost (AED)', 'CO₂ (kg)', 'Autonomous', 'Performance Score'],
      sortedZonePerf.map((z) => [
        z.zone, z.floor, z.energyKwh, z.costAed, z.co2Kg,
        z.autonomous ? 'INAIA' : 'Manual',
        z.performanceScore,
      ]),
    )
  }

  function exportAllCSV() {
    downloadCSV(
      `building-report-${now.toISOString().slice(0, 10)}.csv`,
      ['Timestamp', 'Fan Power (W)', 'Core Temp (°C)', 'Core CO₂ (ppm)'],
      historyData.map((p) => [
        new Date(p.timestamp * 1000).toISOString(),
        p.fan_power_w ?? '',
        p.core_temp_c ?? '',
        p.core_co2_ppm ?? '',
      ]),
    )
  }

  function exportPDF() { window.print() }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <>
      {/* Board Report — hidden, only visible @media print */}
      <BoardReport data={boardReportData} />

      <div className="rpt-view">

        {/* ── Summary Card ────────────────────────────────────────────────── */}
        <div className="rpt-top-section">
          {/* Toolbar */}
          <div className="rpt-toolbar" id="rpt-toolbar">
            <div className="rpt-id">
              <div className="pg-ey">ANALYTICS REPORT · BOPTEST Simulation · multizone_office_simple_air</div>
              <div className="pg-h">Facility Performance Report</div>
            </div>
            <div className="rpt-actions">
              <div className="period-tabs" role="group" aria-label="Report period">
                {(['1h', '1d', '1M', '1y'] as const).map((p) => (
                  <button
                    key={p}
                    data-testid={`period-btn-${p.toLowerCase()}`}
                    aria-pressed={timePreset === p}
                    aria-label={`Show ${p} report`}
                    className={`period-btn ${timePreset === p ? 'period-btn--active' : ''}`}
                    onClick={() => setTimePreset(p)}
                  >
                    {p}
                  </button>
                ))}
              </div>
              <div className="export-group">
                <button className="export-btn" onClick={exportAllCSV} title="Export time-series history">
                  ↓ CSV
                </button>
                <button className="export-btn export-btn--pdf" onClick={exportPDF} title="Board Report PDF">
                  ↓ Board Report
                </button>
              </div>
            </div>
          </div>

          {/* KPI Cards */}
          <div className="rpt-kpi-row">
            {/* Card 1 — instantaneous power, does NOT change with time slice */}
            <KpiCard
              label="TOTAL SYSTEM POWER"
              value={`${totalPower_kW.toFixed(0)} kW`}
              sub={`Fan ${(fanPower_w / 1000).toFixed(0)} kW · Chiller ${(chillerPower_w / 1000).toFixed(0)} kW`}
            />
            {/* Card 2 — cumulative CO₂ over selected period */}
            <KpiCard
              label="CO₂ EMISSIONS"
              value={totalCO2_t > 0 ? `${totalCO2_t.toFixed(1)} t` : '—'}
              sub={`Carbon footprint · last ${periodLabel}`}
            />
            {/* Card 3 — current tariff rate, does NOT change with time slice */}
            <KpiCard
              label="DEWA TARIFF"
              value={`AED ${currentDewaRate.toFixed(2)}`}
              sub="/ kWh current rate"
              delta={dewaRateStatus}
              deltaGood={!isPeak}
            />
            {/* Card 4 — complaint count over selected period */}
            <KpiCard
              label="COMFORT COMPLAINTS"
              value={`${comfortComplaints}`}
              sub={`Over last ${periodLabel}`}
              delta={comfortComplaints === 0 ? '✓ None' : '⚠ Active'}
              deltaGood={comfortComplaints === 0}
            />
            {/* Card 5 — always shows annualised savings; sub shows period savings */}
            <KpiCard
              label="EST. ANNUAL SAVINGS"
              value={
                benchmarkSavings
                  ? `AED ${benchmarkSavings.cost_aed_annual.toLocaleString('en', { maximumFractionDigits: 0 })}`
                  : benchmarkRunning
                  ? `⟳ ${benchmark!.progress_pct.toFixed(0)}%`
                  : 'AED —'
              }
              sub={
                benchmarkRunning
                  ? 'Benchmark running…'
                  : `AED ${savedAed.toLocaleString('en', { maximumFractionDigits: 0 })} saved last ${periodLabel}`
              }
              accent
              delta={benchmarkSavings ? `↓ ${benchmarkSavings.energy_pct.toFixed(1)}% energy vs baseline` : undefined}
              deltaGood
            />
          </div>
        </div>

        {/* ── Report Charts ─────────────────────────────────────────────────── */}
        <div className="rpt-chart-card rpt-chart-card--tabbed">
          <div className="rpt-section-head tabbed-head">
            <div className="chart-tabs">
              {(
                [
                  { key: 'comparison',       label: 'COMPARISON' },
                  { key: 'anomaly',          label: `ANOMALY FEED${anomalies.filter((a) => a.severity === 'critical').length > 0 ? ` ●` : ''}` },
                  { key: 'zone-performance', label: 'ZONE PERFORMANCE' },
                ] as { key: ChartTab; label: string }[]
              ).map(({ key, label }) => (
                <button
                  key={key}
                  className={`chart-tab ${activeChartTab === key ? 'chart-tab--active' : ''} ${key === 'anomaly' && label.includes('●') ? 'chart-tab--alert' : ''}`}
                  onClick={() => setActiveChartTab(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            {activeChartTab === 'zone-performance' && (
              <button className="export-btn" onClick={exportZonesCSV}>↓ Export CSV</button>
            )}
          </div>

          <div className="tabbed-chart-body">

            {/* ── Tab 1: Comparison chart ─────────────────────────── */}
            {activeChartTab === 'comparison' && <ComparisonChart />}

            {/* ── Tab 2: Anomaly feed (unchanged) ────────────────── */}
            {activeChartTab === 'anomaly' && (
              <AnomalyFeed anomalies={anomalies} />
            )}

            {/* ── Tab 3: Zone Performance ─────────────────────────── */}
            {activeChartTab === 'zone-performance' && (
              <div className="tab-table-wrapper">
                {!IS_MOCKED && zonePerf.length === 0 ? (
                  <div className="rpt-table-empty">⚠ Backend not connected — awaiting zone data…</div>
                ) : (
                  <div className="rpt-table-wrap">
                    <table className="rpt-table">
                      <thead>
                        <tr>
                          <SortTh col="zone"             label="Zone"              sort={zpSort} onToggle={zpSort.toggle} />
                          <SortTh col="floor"            label="Floor"             sort={zpSort} onToggle={zpSort.toggle} />
                          <SortTh col="energyKwh"        label="Energy (kWh)"      sort={zpSort} onToggle={zpSort.toggle} />
                          <SortTh col="costAed"          label="Cost (AED)"        sort={zpSort} onToggle={zpSort.toggle} />
                          <SortTh col="co2Kg"            label="CO₂ (kg)"          sort={zpSort} onToggle={zpSort.toggle} />
                          <SortTh col="autonomous"       label="Autonomous"        sort={zpSort} onToggle={zpSort.toggle} />
                          <SortTh col="performanceScore" label="Zone Performance"  sort={zpSort} onToggle={zpSort.toggle} />
                        </tr>
                      </thead>
                      <tbody>
                        {sortedZonePerf.map((z) => (
                          <tr key={z.zone} className="rpt-tr">
                            <td className="td-zone-id">{z.zone}</td>
                            <td className="td-floor">{z.floor}</td>
                            <td className="td-mono">{z.energyKwh.toLocaleString('en', { maximumFractionDigits: 1 })}</td>
                            <td className="td-mono">{z.costAed.toLocaleString('en', { maximumFractionDigits: 2 })}</td>
                            <td className="td-mono">{z.co2Kg.toLocaleString('en', { maximumFractionDigits: 1 })}</td>
                            <td>
                              <span className={`autonomous-badge ${z.autonomous ? 'autonomous-badge--inaia' : 'autonomous-badge--manual'}`}>
                                {z.autonomous ? '✓ INAIA' : '— Manual'}
                              </span>
                            </td>
                            <td>
                              <div className="comfort-score-cell">
                                <InlineBar
                                  value={z.performanceScore}
                                  max={100}
                                  color={z.performanceScore >= 75 ? '#00C896' : z.performanceScore >= 50 ? '#F59E0B' : '#EF4444'}
                                />
                                <span className="td-mono">{z.performanceScore}</span>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>

        {/* ── Report stamp ──────────────────────────────────────────────────── */}
        <div className="rpt-footer">
          <span>INAIA Platform · Building Intelligence OS</span>
          <span>Generated: {now.toLocaleString()}</span>
          <span>Data source: BOPTEST v0.7.1 · multizone_office_simple_air</span>
        </div>

      </div>
    </>
  )
}
