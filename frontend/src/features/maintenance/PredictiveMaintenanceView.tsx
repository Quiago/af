import { AssetDetail } from './components/EquipmentPanel/AssetDetail'
import { TreeView } from './components/EquipmentPanel/TreeView'
import { TimelineChart } from './components/TimelineChart/TimelineChart'
import { SystemDiagram } from './components/SystemDiagram'
import { useEquipmentData } from './hooks/useEquipmentData'
import { useDashboardStore } from '../../store/dashboardStore'
import { useMemo } from 'react'
import './PredictiveMaintenanceView.css'

export function PredictiveMaintenanceView() {
  const equipment      = useEquipmentData()
  const selectedAssetId = useDashboardStore((s) => s.selectedAssetId)

  const selectedAsset = useMemo(
    () => equipment.find((e) => e.id === selectedAssetId) ?? null,
    [equipment, selectedAssetId],
  )

  return (
    <div className="maint-view">

      {/* ── Equipment column (LEFT 20%) ───────────────────────────────────── */}
      <div className="eq-col">
        <div className="eq-col-head">
          <span className="rp-title">MACHINE HEALTH</span>
          <span className="eq-count">{equipment.length} assets</span>
        </div>

        <div className="eq-detail-section">
          <AssetDetail asset={selectedAsset} />
        </div>

        <div className="eq-tree-section">
          <TreeView />
        </div>
      </div>

      {/* ── Right area (80%) — System Diagram top + Timeline bottom ──────── */}
      <div className="maint-right">

        <div className="maint-diagram">
          <div className="maint-diagram-head">
            <span className="rp-title">HVAC SYSTEM DIAGRAM</span>
            {selectedAsset && (
              <span className="maint-sel-badge">{selectedAsset.name}</span>
            )}
          </div>
          <div className="maint-diagram-canvas">
            <SystemDiagram />
          </div>
        </div>

        <div className="maint-timeline">
          <TimelineChart />
        </div>

      </div>
    </div>
  )
}
