/**
 * Board Report — structured A4 print template.
 * Hidden from normal view; becomes visible via @media print.
 * Triggered by the "↓ PDF" button in BuildingReportView.
 */
import './BoardReport.css'

export interface BoardReportData {
  period: string
  generatedAt: string
  buildingName: string

  // KPIs
  totalPowerKw: number
  energyKwh: number
  savedKwh: number
  savedPct: number
  savedAed: number
  annualSavingsAed: number
  savedCO2_t: number
  totalCO2_t: number

  // Compliance
  dewaScore: number
  estidamaTarget: number
  uaeCompliance: string

  // Comfort
  comfortComplaints: number
  zonesTotal: number
  zonesComfort: number   // zones within ±0.5°C

  // Equipment
  equipmentOnline: number
  equipmentTotal: number
  equipmentWarnings: number
  equipmentCritical: number

  // Anomalies summary
  totalAedWaste: number
  anomalyCount: number
}

interface BoardReportProps {
  data: BoardReportData
}

export function BoardReport({ data }: BoardReportProps) {
  const savingsPct = data.savedPct.toFixed(1)
  const co2PctReduced = data.totalCO2_t > 0
    ? ((data.savedCO2_t / (data.totalCO2_t + data.savedCO2_t)) * 100).toFixed(1)
    : '0.0'

  return (
    <div className="board-report" aria-hidden="true">
      {/* ── Cover strip ──────────────────────────────────────────── */}
      <div className="br-cover">
        <div className="br-cover-left">
          <div className="br-brand">INAIA</div>
          <div className="br-report-type">Building Performance Board Report</div>
        </div>
        <div className="br-cover-right">
          <div className="br-building">{data.buildingName}</div>
          <div className="br-meta">{data.period} · Generated {data.generatedAt}</div>
        </div>
      </div>

      {/* ── Executive KPIs ───────────────────────────────────────── */}
      <div className="br-section">
        <div className="br-section-title">Executive Summary</div>
        <div className="br-kpi-grid">
          <div className="br-kpi br-kpi--accent">
            <div className="br-kpi-label">Energy Saved</div>
            <div className="br-kpi-value">↓ {savingsPct}%</div>
            <div className="br-kpi-sub">{data.savedKwh.toFixed(0)} kWh vs baseline</div>
          </div>
          <div className="br-kpi br-kpi--accent">
            <div className="br-kpi-label">Cost Savings (YTD est.)</div>
            <div className="br-kpi-value">AED {data.annualSavingsAed.toLocaleString('en', { maximumFractionDigits: 0 })}</div>
            <div className="br-kpi-sub">DEWA blended rate 0.32 AED/kWh</div>
          </div>
          <div className="br-kpi">
            <div className="br-kpi-label">CO₂ Reduced</div>
            <div className="br-kpi-value">{data.savedCO2_t.toFixed(2)} t</div>
            <div className="br-kpi-sub">{co2PctReduced}% total reduction</div>
          </div>
          <div className="br-kpi">
            <div className="br-kpi-label">System Power</div>
            <div className="br-kpi-value">{data.totalPowerKw.toFixed(1)} kW</div>
            <div className="br-kpi-sub">Current consumption</div>
          </div>
          <div className="br-kpi">
            <div className="br-kpi-label">Comfort Complaints</div>
            <div className="br-kpi-value">{data.comfortComplaints}</div>
            <div className="br-kpi-sub">
              {data.zonesComfort}/{data.zonesTotal} zones in comfort range
            </div>
          </div>
          <div className="br-kpi">
            <div className="br-kpi-label">Active Anomalies</div>
            <div className="br-kpi-value">{data.anomalyCount}</div>
            <div className="br-kpi-sub">Est. waste AED {data.totalAedWaste.toFixed(0)}/day</div>
          </div>
        </div>
      </div>

      {/* ── Energy Performance ───────────────────────────────────── */}
      <div className="br-section">
        <div className="br-section-title">Energy Performance</div>
        <div className="br-table">
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                <th>Baseline</th>
                <th>With INAIA</th>
                <th>Δ Improvement</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Energy Consumption</td>
                <td>{(data.energyKwh * 1.224).toFixed(0)} kWh</td>
                <td>{data.energyKwh.toFixed(0)} kWh</td>
                <td className="br-td-good">↓ {data.savedKwh.toFixed(0)} kWh ({savingsPct}%)</td>
              </tr>
              <tr>
                <td>Operating Cost</td>
                <td>AED {(data.energyKwh * 1.224 * 0.32).toFixed(0)}</td>
                <td>AED {(data.energyKwh * 0.32).toFixed(0)}</td>
                <td className="br-td-good">↓ AED {data.savedAed.toFixed(0)}</td>
              </tr>
              <tr>
                <td>Carbon Footprint</td>
                <td>{((data.totalCO2_t + data.savedCO2_t)).toFixed(2)} tCO₂</td>
                <td>{data.totalCO2_t.toFixed(2)} tCO₂</td>
                <td className="br-td-good">↓ {data.savedCO2_t.toFixed(2)} tCO₂</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Compliance ───────────────────────────────────────────── */}
      <div className="br-section">
        <div className="br-section-title">Regulatory Compliance</div>
        <div className="br-compliance-row">
          <div className="br-comp-item">
            <div className="br-comp-label">DEWA D33 Readiness</div>
            <div className="br-comp-score">{data.dewaScore}%</div>
            <div className="br-comp-bar">
              <div className="br-comp-fill" style={{ width: `${data.dewaScore}%` }} />
            </div>
          </div>
          <div className="br-comp-item">
            <div className="br-comp-label">Estidama — CO₂ Reduction</div>
            <div className="br-comp-score">{data.savedCO2_t.toFixed(1)} t / {data.estidamaTarget} t target</div>
            <div className="br-comp-bar">
              <div
                className="br-comp-fill br-comp-fill--green"
                style={{ width: `${Math.min(100, (data.savedCO2_t / data.estidamaTarget) * 100)}%` }}
              />
            </div>
          </div>
          <div className="br-comp-item">
            <div className="br-comp-label">UAE Climate Law 2050</div>
            <div className="br-comp-score br-comp-score--ok">{data.uaeCompliance}</div>
          </div>
        </div>
      </div>

      {/* ── Equipment Health Summary ─────────────────────────────── */}
      <div className="br-section">
        <div className="br-section-title">Equipment Health Summary</div>
        <div className="br-eq-row">
          <div className="br-eq-stat">
            <span className="br-eq-val">{data.equipmentOnline}/{data.equipmentTotal}</span>
            <span className="br-eq-lbl">Online</span>
          </div>
          <div className="br-eq-stat">
            <span className="br-eq-val br-eq-val--warn">{data.equipmentWarnings}</span>
            <span className="br-eq-lbl">Warnings</span>
          </div>
          <div className="br-eq-stat">
            <span className="br-eq-val br-eq-val--crit">{data.equipmentCritical}</span>
            <span className="br-eq-lbl">Critical</span>
          </div>
          <div className="br-eq-note">
            Full equipment timeline and health metrics available in the Machine Health module.
          </div>
        </div>
      </div>

      {/* ── Footer ───────────────────────────────────────────────── */}
      <div className="br-footer">
        <div className="br-footer-left">
          <div className="br-footer-title">INAIA Platform · Building Intelligence OS</div>
          <div className="br-footer-sub">Powered by BOPTEST v0.7.1 · multizone_office_simple_air simulation</div>
        </div>
        <div className="br-signature">
          <div className="br-sig-line" />
          <div className="br-sig-label">Facilities Manager</div>
          <div className="br-sig-date">{data.generatedAt}</div>
        </div>
      </div>
    </div>
  )
}
