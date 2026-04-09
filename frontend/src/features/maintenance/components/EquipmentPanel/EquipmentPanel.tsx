import { useMemo } from 'react'
import { useDashboardStore } from '../../../../store/dashboardStore'
import { useEquipmentData } from '../../hooks/useEquipmentData'
import { AssetDetail } from './AssetDetail'
import { TreeView } from './TreeView'
import './EquipmentPanel.css'

export function EquipmentPanel() {
  const selectedAssetId = useDashboardStore((s) => s.selectedAssetId)
  const equipment       = useEquipmentData()

  const selectedAsset = useMemo(
    () => equipment.find((e) => e.id === selectedAssetId) ?? null,
    [equipment, selectedAssetId],
  )

  return (
    <div className="equipment-panel">
      <div className="equipment-panel-detail">
        <AssetDetail asset={selectedAsset} />
      </div>
      <div className="equipment-panel-tree">
        <TreeView />
      </div>
    </div>
  )
}
