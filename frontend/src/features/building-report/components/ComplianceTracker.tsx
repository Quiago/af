import './ComplianceTracker.css'

interface ComplianceTrackerProps {
  savedCO2: number
  totalCO2: number
}

export function ComplianceTracker({ savedCO2, totalCO2 }: ComplianceTrackerProps) {
  // Mock targets for Demo
  const estidamaTarget = 150.0 // Tonnes/month
  const dewaScore = 92 // Out of 100
  const uaeCompliance = 'Compliant'
  
  // Use totalCO2 to avoid unused variable warning mathematically
  const reducedPct = totalCO2 > 0 ? ((savedCO2 / (totalCO2 + savedCO2)) * 100).toFixed(1) : '0.0'

  return (
    <div className="comp-tracker fade-in">
      <div className="comp-tracker-header">
        <h3 className="comp-title">REGULATORY READINESS & EMISSIONS</h3>
        <p className="comp-desc">Real-time status for UAE sustainability benchmarks</p>
      </div>

      <div className="comp-grid">
        <div className="comp-card">
          <div className="comp-card-top">
            <span className="comp-label">CO₂ REDUCED THIS MONTH</span>
            <span className="comp-score comp-score--good">{savedCO2.toFixed(1)} t</span>
          </div>
          <div className="comp-card-bot">
            <span className="comp-tgt">Target (Estidama): {estidamaTarget} t</span>
            <div className="comp-prog">
              <div 
                className="comp-prog-fill comp-prog-fill--green" 
                style={{ width: `${Math.min(100, (savedCO2 / estidamaTarget) * 100)}%` }} 
              />
            </div>
          </div>
        </div>

        <div className="comp-card">
          <div className="comp-card-top">
            <span className="comp-label">DEWA D33 READINESS</span>
            <span className="comp-score">{dewaScore}%</span>
          </div>
          <div className="comp-card-bot">
            <span className="comp-tgt">Based on Dubai Economic Agenda D33</span>
            <div className="comp-prog">
              <div 
                className="comp-prog-fill comp-prog-fill--blue" 
                style={{ width: `${dewaScore}%` }} 
              />
            </div>
          </div>
        </div>

        <div className="comp-card">
          <div className="comp-card-top">
            <span className="comp-label">UAE CLIMATE LAW</span>
            <span className="comp-score comp-score--good">{uaeCompliance}</span>
          </div>
          <div className="comp-card-bot">
            <span className="comp-tgt">Net Zero by 2050 Framework</span>
            <span className="comp-tgt" style={{ color: 'var(--color-primary)' }}>{reducedPct}% Total Emissions Reduction</span>
          </div>
        </div>
      </div>

      <div className="comp-report-action">
        <div className="comp-rap">
          <span className="comp-ra-lbl">Auditor-Ready Reporting</span>
          <span className="comp-ra-desc">Automatically populates official UAE regulatory templates. Complete data packages ready for export.</span>
        </div>
        <button className="comp-btn-export">
          Generate Full Compliance Report
        </button>
      </div>
    </div>
  )
}
