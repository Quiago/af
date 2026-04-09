import './AnomalyFeed.css'

export interface Anomaly {
  id: string
  severity: 'critical' | 'warning' | 'info'
  title: string
  location: string
  aedPerDay: number
  cause: string
  action: string
}

interface AnomalyFeedProps {
  anomalies: Anomaly[]
}

export function AnomalyFeed({ anomalies }: AnomalyFeedProps) {
  const critical = anomalies.filter((a) => a.severity === 'critical').length
  const warnings = anomalies.filter((a) => a.severity === 'warning').length
  const infos    = anomalies.filter((a) => a.severity === 'info').length
  const totalWaste = anomalies.reduce((s, a) => s + a.aedPerDay, 0)

  return (
    <div className="anomaly-feed">
      {/* Summary strip */}
      <div className="anom-strip">
        <div className="anom-count anom-count--crit">
          <span className="anom-count-val">{critical}</span>
          <span className="anom-count-lbl">Critical</span>
        </div>
        <div className="anom-divider" />
        <div className="anom-count anom-count--warn">
          <span className="anom-count-val">{warnings}</span>
          <span className="anom-count-lbl">Warning</span>
        </div>
        <div className="anom-divider" />
        <div className="anom-count anom-count--info">
          <span className="anom-count-val">{infos}</span>
          <span className="anom-count-lbl">Info</span>
        </div>
        <div className="anom-waste-total">
          <span className="anom-waste-val">AED {totalWaste.toFixed(0)}</span>
          <span className="anom-waste-lbl">estimated waste / day</span>
        </div>
      </div>

      {/* List */}
      {anomalies.length === 0 ? (
        <div className="anom-empty">
          <span className="anom-empty-icon">✓</span>
          <span className="anom-empty-msg">No active anomalies detected</span>
          <span className="anom-empty-sub">All systems operating within normal parameters</span>
        </div>
      ) : (
        <div className="anom-list">
          {anomalies.map((a) => (
            <div key={a.id} className={`anom-card anom-card--${a.severity}`}>
              <div className="anom-sev-bar" />
              <div className="anom-body">
                <div className="anom-top">
                  <div className="anom-header">
                    <span className={`anom-dot anom-dot--${a.severity}`} />
                    <span className="anom-title">{a.title}</span>
                    <span className="anom-loc">{a.location}</span>
                  </div>
                  {a.aedPerDay > 0 && (
                    <div className="anom-cost">
                      <span className="anom-cost-val">AED {a.aedPerDay.toFixed(1)}</span>
                      <span className="anom-cost-period">/day</span>
                    </div>
                  )}
                </div>
                <div className="anom-cause">{a.cause}</div>
                <div className="anom-action">→ {a.action}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
